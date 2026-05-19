// Header indicator showing the realtime connection status, plus an
// auto-dismissing "Updated by X" badge when a remote peer makes a change.

import {useEffect} from 'react'
import {useSyncStatus} from '../../store/syncStatus'

export default function SyncIndicator() {
    const connection = useSyncStatus(s => s.connection)
    const remoteUpdate = useSyncStatus(s => s.recentRemoteUpdate)
    const clearRemoteUpdate = useSyncStatus(s => s.clearRemoteUpdate)

    // Auto-hide the "Updated by X" badge after 4 seconds.
    useEffect(() => {
        if (!remoteUpdate) return
        const t = window.setTimeout(() => clearRemoteUpdate(), 4000)
        return () => window.clearTimeout(t)
    }, [remoteUpdate, clearRemoteUpdate])

    if (connection === 'idle') return null

    let dotColor = 'bg-gray-300'
    let label = ''
    let labelClass = 'text-gray-500'

    if (connection === 'connecting') {
        dotColor = 'bg-amber-400 animate-pulse'
        label = 'Connecting'
    } else if (connection === 'connected') {
        dotColor = 'bg-green-500'
        label = 'Connected'
    } else if (connection === 'offline') {
        dotColor = 'bg-red-400'
        label = 'Offline'
        labelClass = 'text-red-600'
    } else if (connection === 'access-revoked') {
        dotColor = 'bg-red-500'
        label = 'Access revoked'
        labelClass = 'text-red-600 font-medium'
    }

    return (
        <div className="flex items-center gap-3 shrink-0">
            {remoteUpdate && (
                <span className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 animate-in">
                    Updated by {remoteUpdate.by}
                </span>
            )}

            <div className="flex items-center gap-1.5" title={label}>
                <span className={`w-2 h-2 rounded-full ${dotColor}`}/>
                <span className={`text-xs ${labelClass}`}>{label}</span>
            </div>
        </div>
    )
}
