import {useEffect, useState} from 'react'
import {Outlet, useNavigate, useParams} from 'react-router-dom'
import {useProjectsStore} from '../../store/projectsStore'
import {useKanbanStore} from '../../store/kanbanStore'
import {useNotesStore} from '../../store/notesStore'
import {startSyncForProject, stopSync} from '../../sync/syncEngine'

function parseTokenFragment(): {memberToken?: string; adminToken?: string} {
    const hash = window.location.hash
    if (!hash || hash.length <= 1) return {}
    const params = new URLSearchParams(hash.slice(1))
    return {
        memberToken: params.get('tok') ?? undefined,
        adminToken: params.get('admin') ?? undefined,
    }
}

function clearFragment() {
    history.replaceState(null, '', window.location.pathname + window.location.search)
}

type Phase =
    | {kind: 'loading'}
    | {kind: 'needs-name'; projectId: string; memberToken: string; adminToken?: string}
    | {kind: 'ready'}
    | {kind: 'error'; message: string}

export default function ProjectGuard() {
    const {projectId} = useParams<{projectId: string}>()
    const navigate = useNavigate()
    const knownProjects = useProjectsStore(s => s.knownProjects)
    const setCurrentProject = useProjectsStore(s => s.setCurrentProject)
    const joinProject = useProjectsStore(s => s.joinProject)
    const loadKanban = useKanbanStore(s => s.loadForProject)
    const clearKanban = useKanbanStore(s => s.clearActiveProject)
    const loadNotes = useNotesStore(s => s.loadForProject)
    const clearNotes = useNotesStore(s => s.clearActiveProject)

    const [phase, setPhase] = useState<Phase>({kind: 'loading'})
    const [displayName, setDisplayName] = useState('')
    const [joining, setJoining] = useState(false)

    useEffect(() => {
        if (!projectId) return

        const {memberToken, adminToken} = parseTokenFragment()

        if (knownProjects[projectId]) {
            setCurrentProject(projectId)
            if (memberToken) clearFragment()
            if (adminToken && !knownProjects[projectId].adminToken) {
                useProjectsStore.setState((state) => ({
                    knownProjects: {
                        ...state.knownProjects,
                        [projectId]: {
                            ...state.knownProjects[projectId],
                            adminToken,
                        },
                    },
                }))
            }
            setPhase({kind: 'ready'})
            return
        }

        if (memberToken) {
            setPhase({kind: 'needs-name', projectId, memberToken, adminToken})
            return
        }

        setPhase({
            kind: 'error',
            message: "You don't have access to this project. If you have an invite link, open it again.",
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId])

    // Once ready, load local data and start the sync engine. The sync engine
    // will overlay server data on top of local during initial fetch (server
    // wins per user's choice), then keep them in sync via push/realtime.
    useEffect(() => {
        if (phase.kind !== 'ready' || !projectId) return

        // Load local first so the UI has *something* to render while sync
        // initialises. Sync will replace this with server data shortly.
        loadKanban(projectId)
        loadNotes(projectId)

        const project = useProjectsStore.getState().knownProjects[projectId]
        if (project) {
            startSyncForProject(project)
        }

        return () => {
            stopSync()
            clearKanban()
            clearNotes()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase.kind, projectId])

    async function handleJoin() {
        if (phase.kind !== 'needs-name') return
        if (!displayName.trim()) return

        setJoining(true)
        try {
            await joinProject(phase.projectId, phase.memberToken, displayName.trim())
            if (phase.adminToken) {
                useProjectsStore.setState((state) => {
                    const project = state.knownProjects[phase.projectId]
                    if (!project) return state
                    return {
                        knownProjects: {
                            ...state.knownProjects,
                            [phase.projectId]: {...project, adminToken: phase.adminToken},
                        },
                    }
                })
            }
            clearFragment()
            setPhase({kind: 'ready'})
        } catch (e) {
            setPhase({
                kind: 'error',
                message: e instanceof Error ? e.message : 'Failed to join project',
            })
        } finally {
            setJoining(false)
        }
    }

    if (phase.kind === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-[60vh] text-gray-500 text-sm">
                Loading…
            </div>
        )
    }

    if (phase.kind === 'error') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
                <div className="text-4xl mb-3 opacity-40">⚠️</div>
                <h2 className="text-lg font-semibold text-gray-700 mb-2">Can't open project</h2>
                <p className="text-sm text-gray-500 mb-4 max-w-md">{phase.message}</p>
                <button
                    onClick={() => navigate('/')}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg px-4 py-2"
                >
                    Back to projects
                </button>
            </div>
        )
    }

    if (phase.kind === 'needs-name') {
        return (
            <div className="flex items-center justify-center min-h-[60vh] px-6">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 max-w-sm w-full">
                    <h2 className="text-lg font-semibold text-gray-800 mb-1">Joining project</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        What should we call you in this project?
                    </p>
                    <input
                        autoFocus
                        type="text"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && displayName.trim() && !joining) {
                                handleJoin()
                            }
                        }}
                        placeholder="Your name"
                        className="text-sm rounded-lg border border-gray-300 px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3"
                    />
                    <p className="text-xs text-gray-400 mb-4">
                        Just a label, not verified. Other members will see this on your edits.
                    </p>
                    <button
                        onClick={handleJoin}
                        disabled={!displayName.trim() || joining}
                        className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm rounded-lg px-4 py-2 w-full transition-colors"
                    >
                        {joining ? 'Joining…' : 'Join project'}
                    </button>
                </div>
            </div>
        )
    }

    return <Outlet/>
}