// Sync status for the project's active connection.
// Written by BoardProvider (via useSyncedYDoc / SupabaseYjsProvider), read
// by SyncIndicator. Since notes metadata now lives in the board Y.Doc, a
// single connection status covers both the board and the notes list.

import {create} from 'zustand'

export type SyncConnectionStatus =
    | 'idle'           // no project active / provider not yet started
    | 'connecting'     // initial setup
    | 'connected'      // healthy
    | 'offline'        // network/socket down
    | 'access-revoked' // token rejected by RLS

export interface RemoteUpdate {
    by: string
    at: number
}

interface SyncStatusStore {
    connection: SyncConnectionStatus
    recentRemoteUpdate: RemoteUpdate | null

    setConnection: (status: SyncConnectionStatus) => void
    noteRemoteUpdate: (update: RemoteUpdate) => void
    clearRemoteUpdate: () => void
    reset: () => void
}

export const useSyncStatus = create<SyncStatusStore>((set) => ({
    connection: 'idle',
    recentRemoteUpdate: null,

    setConnection: (connection) => set({connection}),
    noteRemoteUpdate: (recentRemoteUpdate) => set({recentRemoteUpdate}),
    clearRemoteUpdate: () => set({recentRemoteUpdate: null}),
    reset: () => set({connection: 'idle', recentRemoteUpdate: null}),
}))
