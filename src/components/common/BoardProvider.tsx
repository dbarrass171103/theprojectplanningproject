// Owns the kanban board's Y.Doc for the current project. Delegates the
// doc + provider lifecycle to useSyncedYDoc; binds the Kanban, Notes, and
// Chat stores to the project on sync, and unbinds them on teardown.

import {useEffect} from 'react'
import {useCurrentProject} from '../../store/projectsStore'
import {useKanbanStore} from '../../store/kanbanStore'
import {useNotesStore} from '../../store/notesStore'
import {useChatStore} from '../../store/chatStore'
import {useSyncedYDoc} from '../../sync/useSyncedYDoc'
import {useSyncStatus} from '../../store/syncStatus'

interface BoardProviderProps {
    children: React.ReactNode
}

export default function BoardProvider({children}: BoardProviderProps) {
    const project = useCurrentProject()

    const {synced} = useSyncedYDoc({
        project,
        docKey: project?.id ?? '',
        channelPrefix: 'board',
        snapshotTable: 'board_documents',

        // Bind the stores BEFORE `synced` flips. Children mount on
        // synced=true and immediately read from a populated store —
        // no empty-board flash.
        onSync: (doc) => {
            if (project) {
                useKanbanStore.getState().bindToDoc(project.id, doc)
                useNotesStore.getState().bindToDoc(project.id, doc)
            }
        },
        onStatusChange: (status) => {
            useSyncStatus.getState().setConnection(status)
        },
        onRemoteUpdate: (by) => {
            useSyncStatus.getState().noteRemoteUpdate({by, at: Date.now()})
        },
    })

    useEffect(() => {
        if (!project) return
        void useChatStore.getState().bindToProject(
            project.id,
            project.memberToken,
            project.adminToken,
            project.displayName,
        )
    }, [project?.id])

    // Paired with the binds above.
    useEffect(() => {
        return () => {
            useKanbanStore.getState().unbind()
            useNotesStore.getState().unbind()
            useChatStore.getState().unbind()
            useSyncStatus.getState().setConnection('idle')
        }
    }, [project?.id])

    if (!project) return <>{children}</>

    if (!synced) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] text-gray-500 text-sm">
                Loading project…
            </div>
        )
    }

    return <>{children}</>
}
