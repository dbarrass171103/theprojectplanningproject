// Realtime Y.Doc provider backed by a Supabase channel for live updates and
// a Postgres table for snapshot persistence.

import * as Y from 'yjs'
import {Awareness, encodeAwarenessUpdate, applyAwarenessUpdate} from 'y-protocols/awareness'
import type {RealtimeChannel, SupabaseClient} from '@supabase/supabase-js'

export interface SupabaseYjsProviderOptions {
    client: SupabaseClient
    projectId: string

    docKey: string
    channelPrefix: string
    snapshotTable: 'note_documents' | 'board_documents'

    doc: Y.Doc
    awareness: Awareness
    user: {name: string; color: string}

    onSync?: () => void
    /**
     * Fires 'connecting' at the start of connect(), then 'connected' or
     * 'offline' as the channel subscription progresses.
     */
    onStatusChange?: (status: 'connecting' | 'connected' | 'offline') => void
    /**
     * Called when a doc-update broadcast is received from a remote peer.
     * `by` is the display name of the user who made the change.
     */
    onRemoteUpdate?: (by: string) => void

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
    private docKey: string
    private channelPrefix: string
    private snapshotTable: 'note_documents' | 'board_documents'

    public doc: Y.Doc
    public awareness: Awareness
    private user: {name: string; color: string}
    private onSyncCallback?: () => void
    private onStatusChangeCallback?: (status: 'connecting' | 'connected' | 'offline') => void
    private onRemoteUpdateCallback?: (by: string) => void

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
        this.docKey = opts.docKey
        this.channelPrefix = opts.channelPrefix
        this.snapshotTable = opts.snapshotTable
        this.doc = opts.doc
        this.awareness = opts.awareness
        this.user = opts.user
        this.onSyncCallback = opts.onSync
        this.onStatusChangeCallback = opts.onStatusChange
        this.onRemoteUpdateCallback = opts.onRemoteUpdate
        this.snapshotDebounceMs = opts.snapshotDebounceMs ?? DEFAULT_SNAPSHOT_DEBOUNCE
        this.resyncIntervalMs = opts.resyncIntervalMs ?? DEFAULT_RESYNC_INTERVAL
    }

    async connect() {
        if (this.destroyed) return

        // Signal immediately so the UI shows "Connecting" rather than
        // staying on whatever state it had previously.
        this.onStatusChangeCallback?.('connecting')

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
        const wasReallyConnected = this.channelReady
        this.destroyed = true

        // Capture a final snapshot before tearing down, in case the user
        // navigated away mid-edit between debounced writes.
        let pendingSnapshot: Uint8Array | null = null
        try {
            pendingSnapshot = Y.encodeStateAsUpdate(this.doc)
        } catch {
            // Periodic snapshots will have captured anything important.
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

    private snapshotMatch(): Record<string, string> {
        if (this.snapshotTable === 'note_documents') {
            return {project_id: this.projectId, note_id: this.docKey}
        }
        return {project_id: this.projectId}
    }

    private async fetchSnapshot() {
        if (this.destroyed) return
        const match = this.snapshotMatch()

        let query = this.client.from(this.snapshotTable).select('state_b64')
        for (const [k, v] of Object.entries(match)) {
            query = query.eq(k, v)
        }
        const {data, error} = await query.maybeSingle()

        if (error || !data || !data.state_b64) return

        try {
            const update = base64ToUint8(data.state_b64)
            Y.applyUpdate(this.doc, update, this.remoteOrigin)
        } catch {
            // ignore
        }
    }

    private subscribeToChannel() {
        const channelName = `${this.channelPrefix}:${this.projectId}:${this.docKey}`

        this.channel = this.client.channel(channelName, {
            config: {broadcast: {self: false}},
        })

        this.channel
            .on('broadcast', {event: EVENT_DOC_UPDATE}, (msg) => {
                if (this.destroyed) return

                // Payload carries the binary update plus the sender's
                // display name, which we forward to onRemoteUpdate so
                // callers can surface "Updated by X" badges.
                const payload = msg.payload as {update: string; by?: string}
                if (typeof payload?.update !== 'string') return

                try {
                    const update = base64ToUint8(payload.update)
                    Y.applyUpdate(this.doc, update, this.remoteOrigin)

                    if (payload.by) {
                        this.onRemoteUpdateCallback?.(payload.by)
                    }
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
                        payload: {update: uint8ToBase64(state), by: this.user.name},
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
                    this.onStatusChangeCallback?.('connected')
                } else {
                    this.channelReady = false

                    if (
                        status === 'CHANNEL_ERROR' ||
                        status === 'TIMED_OUT' ||
                        status === 'CLOSED'
                    ) {
                        this.onStatusChangeCallback?.('offline')
                    }
                }
            })
    }

    private onDocUpdate = (update: Uint8Array, origin: unknown) => {
        if (origin === this.remoteOrigin) return
        if (!this.channelReady || !this.channel) {
            this.scheduleSnapshotSave()
            return
        }

        // Include sender's display name so recipients can attribute the edit.
        void this.channel.send({
            type: 'broadcast',
            event: EVENT_DOC_UPDATE,
            payload: {update: uint8ToBase64(update), by: this.user.name},
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
        const row = {
            ...this.snapshotMatch(),
            state_b64: stateB64,
            updated_at: new Date().toISOString(),
            updated_by: this.user.name,
        }
        const onConflict = this.snapshotTable === 'note_documents'
            ? 'project_id,note_id'
            : 'project_id'

        await this.client
            .from(this.snapshotTable)
            .upsert(row, {onConflict})
    }
}
