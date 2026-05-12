import {create} from 'zustand'

export type SyncConnectionStatus =
    | 'idle'           // no project active
    | 'connecting'     // initial fetch / subscription setup
    | 'connected'      // healthy
    | 'offline'        // network/socket down
    | 'access-revoked' // token rejected by RLS

export interface RemoteUpdate {
    by: string          // display name from the remote client
    key: 'kanban' | 'notes'
    at: number          // local timestamp when we received it
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