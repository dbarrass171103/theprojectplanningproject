import type {RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient} from '@supabase/supabase-js'
import {getSupabaseForProject} from '../lib/supabase'
import type {KnownProject} from '../store/projectsStore'
import {useKanbanStore} from '../store/kanbanStore'
import {useNotesStore} from '../store/notesStore'
import {useSyncStatus} from '../store/syncStatus'

function generateSessionId(): string {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

const SESSION_ID = generateSessionId()
const SEPARATOR = '::'

function packUpdatedBy(displayName: string): string {
    return `${displayName}${SEPARATOR}${SESSION_ID}`
}

function parseUpdatedBy(s: string | null | undefined): { name: string; sessionId: string } {
    if (!s) return {name: 'someone', sessionId: ''}
    const idx = s.lastIndexOf(SEPARATOR)
    if (idx === -1) return {name: s, sessionId: ''}
    return {name: s.slice(0, idx), sessionId: s.slice(idx + SEPARATOR.length)}
}

type DataKey = 'kanban' | 'notes'

interface ProjectDataRow {
    project_id: string
    key: string
    value: unknown
    updated_at: string
    updated_by: string | null
}

const PUSH_DEBOUNCE_MS = 500

export class SyncEngine {
    private project: KnownProject
    private client: SupabaseClient
    private channel: RealtimeChannel | null = null

    private pushTimers: Record<DataKey, number | null> = {kanban: null, notes: null}
    private pushPending: Record<DataKey, boolean> = {kanban: false, notes: false}
    // Tracks when we last SUCCESSFULLY pushed each key so stale realtime
    // echoes arriving after a newer local push are ignored.
    private lastPushedAt: Record<DataKey, number> = {kanban: 0, notes: 0}

    private storeUnsubs: Array<() => void> = []

    // Prevents remote-applied store updates from triggering a push back up,
    // which causes the ping-pong / disappearing card bug.
    private isApplyingRemote = false

    private stopped = false

    constructor(project: KnownProject) {
        this.project = project
        this.client = getSupabaseForProject(project.memberToken, project.adminToken)
    }

    async start() {
        useSyncStatus.getState().setConnection('connecting')

        try {
            await this.initialFetch()
        } catch (e) {
            console.error('Initial sync fetch failed', e)
            useSyncStatus.getState().setConnection('offline')
        }

        if (this.stopped) return
        this.subscribeToStores()
        this.subscribeToRealtime()
    }

    stop() {
        this.stopped = true

        for (const key of ['kanban', 'notes'] as DataKey[]) {
            const timer = this.pushTimers[key]
            if (timer !== null) {
                window.clearTimeout(timer)
                this.pushTimers[key] = null
            }
            this.pushPending[key] = false
        }

        this.storeUnsubs.forEach(fn => fn())
        this.storeUnsubs = []

        if (this.channel) {
            this.client.removeChannel(this.channel)
            this.channel = null
        }

        useSyncStatus.getState().reset()
    }

    private async initialFetch() {
        const {data, error} = await this.client
            .from('project_data')
            .select('*')
            .eq('project_id', this.project.id)

        if (error) {
            if (error.code === 'PGRST301' || error.message.toLowerCase().includes('jwt')) {
                useSyncStatus.getState().setConnection('access-revoked')
                throw error
            }
            throw error
        }

        const rows = (data ?? []) as ProjectDataRow[]

        this.isApplyingRemote = true
        try {
            for (const row of rows) {
                this.applyRemoteToStore(row.key as DataKey, row.value)
            }
        } finally {
            this.isApplyingRemote = false
        }

        useSyncStatus.getState().setConnection('connected')
    }

    private applyRemoteToStore(key: DataKey, value: unknown) {
        if (key === 'kanban') {
            const current = useKanbanStore.getState()
            if (current.activeProjectId !== this.project.id) return
            useKanbanStore.setState({board: value as typeof current.board})
        } else if (key === 'notes') {
            const current = useNotesStore.getState()
            if (current.activeProjectId !== this.project.id) return
            const v = value as { notes: typeof current.notes; order: typeof current.order }
            useNotesStore.setState({notes: v.notes, order: v.order})
        }
    }

    private subscribeToStores() {
        const kanbanUnsub = useKanbanStore.subscribe((state, prev) => {
            if (this.isApplyingRemote) return
            if (state.activeProjectId !== this.project.id) return
            if (state.board === prev.board) return
            this.schedulePush('kanban')
        })
        this.storeUnsubs.push(kanbanUnsub)

        const notesUnsub = useNotesStore.subscribe((state, prev) => {
            if (this.isApplyingRemote) return
            if (state.activeProjectId !== this.project.id) return
            if (state.notes === prev.notes && state.order === prev.order) return
            this.schedulePush('notes')
        })
        this.storeUnsubs.push(notesUnsub)
    }

    private schedulePush(key: DataKey) {
        if (this.stopped) return

        const existing = this.pushTimers[key]
        if (existing !== null) window.clearTimeout(existing)
        this.pushPending[key] = true

        this.pushTimers[key] = window.setTimeout(() => {
            this.pushTimers[key] = null
            void this.doPush(key)
        }, PUSH_DEBOUNCE_MS)
    }

    private async doPush(key: DataKey) {
        if (this.stopped) return

        const value = this.snapshotForKey(key)
        if (value === null) {
            this.pushPending[key] = false
            return
        }

        const updatedBy = packUpdatedBy(this.project.displayName)
        const updatedAt = new Date().toISOString()

        const {error} = await this.client
            .from('project_data')
            .upsert({
                project_id: this.project.id,
                key,
                value,
                updated_by: updatedBy,
                updated_at: updatedAt,
            }, {onConflict: 'project_id,key'})

        this.pushPending[key] = false

        if (error) {
            console.error(`Failed to push ${key}`, error)
            if (
                error.message.toLowerCase().includes('row-level security') ||
                error.message.toLowerCase().includes('permission denied')
            ) {
                useSyncStatus.getState().setConnection('access-revoked')
            } else {
                useSyncStatus.getState().setConnection('offline')
            }
            return
        }

        // Record timestamp on SUCCESS only. The previous version recorded it
        // on error, which meant the stale-update guard never fired correctly.
        this.lastPushedAt[key] = Date.now()

        if (useSyncStatus.getState().connection === 'offline') {
            useSyncStatus.getState().setConnection('connected')
        }
    }

    private snapshotForKey(key: DataKey): unknown | null {
        if (key === 'kanban') {
            const s = useKanbanStore.getState()
            if (s.activeProjectId !== this.project.id) return null
            return s.board
        }
        if (key === 'notes') {
            const s = useNotesStore.getState()
            if (s.activeProjectId !== this.project.id) return null
            return {notes: s.notes, order: s.order}
        }
        return null
    }

    private subscribeToRealtime() {
        this.channel = this.client
            .channel(`project:${this.project.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'project_data',
                    filter: `project_id=eq.${this.project.id}`,
                },
                (payload) => this.handleRealtimePayload(payload),
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    if (useSyncStatus.getState().connection !== 'access-revoked') {
                        useSyncStatus.getState().setConnection('connected')
                    }
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    if (useSyncStatus.getState().connection !== 'access-revoked') {
                        useSyncStatus.getState().setConnection('offline')
                    }
                }
            })
    }

    private handleRealtimePayload(payload: RealtimePostgresChangesPayload<Record<string, unknown>>) {
        const rawNew = payload.new
        if (!rawNew || typeof rawNew !== 'object') return

        const newRow = rawNew as Record<string, unknown>
        const key = newRow.key
        if (key !== 'kanban' && key !== 'notes') return

        const updatedBy = typeof newRow.updated_by === 'string' ? newRow.updated_by : null
        const value = newRow.value

        const {name, sessionId} = parseUpdatedBy(updatedBy)
        if (sessionId === SESSION_ID) return
        if (this.pushPending[key]) return

        const remoteAt = typeof newRow.updated_at === 'string'
            ? new Date(newRow.updated_at).getTime()
            : 0
        if (remoteAt < this.lastPushedAt[key]) return

        this.isApplyingRemote = true
        try {
            this.applyRemoteToStore(key, value)
        } finally {
            this.isApplyingRemote = false
        }

        useSyncStatus.getState().noteRemoteUpdate({
            by: name,
            key,
            at: Date.now(),
        })
    }
}

let currentEngine: SyncEngine | null = null

export function startSyncForProject(project: KnownProject): SyncEngine {
    if (currentEngine) {
        console.warn('Starting a sync engine while one is already running. Stopping the old one.')
        currentEngine.stop()
    }
    currentEngine = new SyncEngine(project)
    void currentEngine.start()
    return currentEngine
}

export function stopSync() {
    if (currentEngine) {
        currentEngine.stop()
        currentEngine = null
    }
}