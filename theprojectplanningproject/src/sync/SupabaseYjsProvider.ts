import * as Y from 'yjs'
import {Awareness, encodeAwarenessUpdate, applyAwarenessUpdate} from 'y-protocols/awareness'
import type {RealtimeChannel, SupabaseClient} from '@supabase/supabase-js'

// A custom Yjs network provider built on Supabase Realtime broadcast channels.
//
// Architecture summary:
//   - On connect, fetch the most recent snapshot from `note_documents` and
//     apply it. This brings us up to date with the server's persisted state.
//   - Subscribe to a per-note broadcast channel. Other clients editing the
//     same note are also subscribed; we relay Yjs updates through it.
//   - Send a sync-request on subscribe; already-connected peers respond with
//     their full state. This handles in-memory content that hasn't been
//     snapshotted yet — without it, late joiners would only see the snapshot.
//   - Local Y.Doc 'update' events are encoded as base64 and broadcast.
//   - Awareness changes (caret position, user info) ride a separate event.
//   - Every N seconds after the last edit, persist a snapshot to the DB.
//   - As a safety net, refetch the snapshot every 30 seconds to recover from
//     any dropped broadcast messages.

export interface SupabaseYjsProviderOptions {
    client: SupabaseClient
    projectId: string
    noteId: string
    doc: Y.Doc
    awareness: Awareness
    user: {name: string; color: string}
    onSync?: () => void
    snapshotDebounceMs?: number
    resyncIntervalMs?: number
}

const DEFAULT_SNAPSHOT_DEBOUNCE = 3000
const DEFAULT_RESYNC_INTERVAL = 30000

const EVENT_DOC_UPDATE = 'doc-update'
const EVENT_AWARENESS = 'awareness'
const EVENT_SYNC_REQUEST = 'sync-request'

function uint8ToBase64(arr: Uint8Array): string {
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.subarray(i, i + chunkSize)
        binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    return btoa(binary)
}

function base64ToUint8(b64: string): Uint8Array {
    const binary = atob(b64)
    const len = binary.length
    const arr = new Uint8Array(len)
    for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i)
    return arr
}

export class SupabaseYjsProvider {
    private client: SupabaseClient
    private projectId: string
    private noteId: string
    public doc: Y.Doc
    public awareness: Awareness
    private user: {name: string; color: string}
    private onSyncCallback?: () => void

    private channel: RealtimeChannel | null = null
    private channelReady = false
    public synced = false

    private snapshotTimer: number | null = null
    private snapshotDebounceMs: number
    private resyncInterval: number | null = null
    private resyncIntervalMs: number

    private destroyed = false
    private remoteOrigin = Symbol('supabase-yjs-remote')

    constructor(opts: SupabaseYjsProviderOptions) {
        this.client = opts.client
        this.projectId = opts.projectId
        this.noteId = opts.noteId
        this.doc = opts.doc
        this.awareness = opts.awareness
        this.user = opts.user
        this.onSyncCallback = opts.onSync
        this.snapshotDebounceMs = opts.snapshotDebounceMs ?? DEFAULT_SNAPSHOT_DEBOUNCE
        this.resyncIntervalMs = opts.resyncIntervalMs ?? DEFAULT_RESYNC_INTERVAL
    }

    async connect() {
        if (this.destroyed) return

        this.awareness.setLocalStateField('user', {
            name: this.user.name,
            color: this.user.color,
        })

        await this.fetchSnapshot()
        if (this.destroyed) return

        this.doc.on('update', this.onDocUpdate)
        this.awareness.on('update', this.onAwarenessUpdate)

        this.subscribeToChannel()

        this.resyncInterval = window.setInterval(() => {
            void this.fetchSnapshot()
        }, this.resyncIntervalMs)
    }

    destroy() {
        if (this.destroyed) return
        // Remember whether we ever truly subscribed before flipping the flag.
        // This distinguishes "real cleanup after a session" from "StrictMode
        // teardown before we ever got going". We only clear awareness in the
        // first case — clearing it in the second case races with the next
        // mount's connect() and wipes the cursor permanently.
        const wasReallyConnected = this.channelReady

        this.destroyed = true

        let pendingSnapshot: Uint8Array | null = null
        try {
            pendingSnapshot = Y.encodeStateAsUpdate(this.doc)
        } catch {
            // Ignore — periodic snapshot saves would have captured anything
            // important up to a few seconds before this.
        }

        if (this.snapshotTimer !== null) {
            window.clearTimeout(this.snapshotTimer)
            this.snapshotTimer = null
        }
        if (this.resyncInterval !== null) {
            window.clearInterval(this.resyncInterval)
            this.resyncInterval = null
        }

        this.doc.off('update', this.onDocUpdate)
        this.awareness.off('update', this.onAwarenessUpdate)

        // Only signal "I've left" if we ever truly joined. Otherwise we'd
        // be racing with the next provider's setLocalStateField in the
        // StrictMode remount and leaving local awareness null permanently.
        if (wasReallyConnected) {
            try {
                this.awareness.setLocalState(null)
            } catch {
                // ignore
            }
        }

        if (this.channel) {
            this.client.removeChannel(this.channel)
            this.channel = null
        }

        if (pendingSnapshot && pendingSnapshot.length > 2) {
            void this.uploadSnapshot(pendingSnapshot)
        }
    }

    private async fetchSnapshot() {
        if (this.destroyed) return
        const {data, error} = await this.client
            .from('note_documents')
            .select('state_b64')
            .eq('project_id', this.projectId)
            .eq('note_id', this.noteId)
            .maybeSingle()

        if (error || !data || !data.state_b64) return

        try {
            const update = base64ToUint8(data.state_b64)
            Y.applyUpdate(this.doc, update, this.remoteOrigin)
        } catch {
            // ignore
        }
    }

    private subscribeToChannel() {
        const channelName = `note:${this.projectId}:${this.noteId}`

        this.channel = this.client.channel(channelName, {
            config: {
                broadcast: {
                    self: false,
                },
            },
        })

        this.channel
            .on('broadcast', {event: EVENT_DOC_UPDATE}, (msg) => {
                if (this.destroyed) return
                const payload = msg.payload as {update: string}
                if (typeof payload?.update !== 'string') return
                try {
                    const update = base64ToUint8(payload.update)
                    Y.applyUpdate(this.doc, update, this.remoteOrigin)
                } catch {
                    // ignore
                }
            })
            .on('broadcast', {event: EVENT_AWARENESS}, (msg) => {
                if (this.destroyed) return
                const payload = msg.payload as {update: string}
                if (typeof payload?.update !== 'string') return
                try {
                    const update = base64ToUint8(payload.update)
                    applyAwarenessUpdate(this.awareness, update, this.remoteOrigin)
                } catch {
                    // ignore
                }
            })
            .on('broadcast', {event: EVENT_SYNC_REQUEST}, async () => {
                if (this.destroyed || !this.channel) return
                try {
                    const state = Y.encodeStateAsUpdate(this.doc)
                    await this.channel.send({
                        type: 'broadcast',
                        event: EVENT_DOC_UPDATE,
                        payload: {update: uint8ToBase64(state)},
                    })
                    const awarenessUpdate = encodeAwarenessUpdate(
                        this.awareness,
                        [this.doc.clientID],
                    )
                    await this.channel.send({
                        type: 'broadcast',
                        event: EVENT_AWARENESS,
                        payload: {update: uint8ToBase64(awarenessUpdate)},
                    })
                } catch {
                    // ignore
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    this.channelReady = true

                    await this.channel!.send({
                        type: 'broadcast',
                        event: EVENT_SYNC_REQUEST,
                        payload: {},
                    })

                    const awarenessUpdate = encodeAwarenessUpdate(
                        this.awareness,
                        [this.doc.clientID],
                    )
                    await this.channel!.send({
                        type: 'broadcast',
                        event: EVENT_AWARENESS,
                        payload: {update: uint8ToBase64(awarenessUpdate)},
                    })

                    this.synced = true
                    this.onSyncCallback?.()
                } else {
                    this.channelReady = false
                }
            })
    }

    private onDocUpdate = (update: Uint8Array, origin: unknown) => {
        if (origin === this.remoteOrigin) return
        if (!this.channelReady || !this.channel) {
            this.scheduleSnapshotSave()
            return
        }

        void this.channel.send({
            type: 'broadcast',
            event: EVENT_DOC_UPDATE,
            payload: {update: uint8ToBase64(update)},
        })

        this.scheduleSnapshotSave()
    }

    private onAwarenessUpdate = (
        {added, updated, removed}: {added: number[]; updated: number[]; removed: number[]},
        origin: unknown,
    ) => {
        if (origin === this.remoteOrigin) return
        if (!this.channelReady || !this.channel) return

        const changedClients = added.concat(updated).concat(removed)
        const update = encodeAwarenessUpdate(this.awareness, changedClients)
        void this.channel.send({
            type: 'broadcast',
            event: EVENT_AWARENESS,
            payload: {update: uint8ToBase64(update)},
        })
    }

    private scheduleSnapshotSave() {
        if (this.snapshotTimer !== null) {
            window.clearTimeout(this.snapshotTimer)
        }
        this.snapshotTimer = window.setTimeout(() => {
            this.snapshotTimer = null
            if (this.destroyed) return
            try {
                const state = Y.encodeStateAsUpdate(this.doc)
                void this.uploadSnapshot(state)
            } catch {
                // ignore
            }
        }, this.snapshotDebounceMs)
    }

    private async uploadSnapshot(state: Uint8Array) {
        const stateB64 = uint8ToBase64(state)
        await this.client
            .from('note_documents')
            .upsert({
                project_id: this.projectId,
                note_id: this.noteId,
                state_b64: stateB64,
                updated_at: new Date().toISOString(),
                updated_by: this.user.name,
            }, {onConflict: 'project_id,note_id'})
    }
}