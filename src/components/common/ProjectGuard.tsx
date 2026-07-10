// Guards every /p/:projectId/* route. Parses tokens from the URL fragment,
// handles the join flow for new members, and mounts BoardProvider when
// access is confirmed.

import {useEffect, useState} from 'react'
import {Outlet, useNavigate, useParams} from 'react-router-dom'
import {useProjectsStore} from '../../store/projectsStore'
import {getSupabaseForProject} from '../../lib/supabase'
import BoardProvider from './BoardProvider'

const ACCESS_CHECK_INTERVAL_MS = 20_000

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
    | {kind: 'revoked'}
    | {kind: 'error'; message: string}

export default function ProjectGuard() {
    const {projectId} = useParams<{projectId: string}>()
    const navigate = useNavigate()

    const knownProjects = useProjectsStore(s => s.knownProjects)
    const setCurrentProject = useProjectsStore(s => s.setCurrentProject)
    const joinProject = useProjectsStore(s => s.joinProject)
    const ensureMembership = useProjectsStore(s => s.ensureMembership)

    const [phase, setPhase] = useState<Phase>({kind: 'loading'})
    const [displayName, setDisplayName] = useState('')
    const [joining, setJoining] = useState(false)

    // Decide the access path: already-known project, join flow, or denied.
    useEffect(() => {
        if (!projectId) return

        let cancelled = false
        const {memberToken, adminToken} = parseTokenFragment()

        if (knownProjects[projectId]) {
            setCurrentProject(projectId)

            if (memberToken) clearFragment()

            // Upgrade to admin if a new admin token was supplied.
            if (adminToken && !knownProjects[projectId].adminToken) {
                useProjectsStore.setState(state => ({
                    knownProjects: {
                        ...state.knownProjects,
                        [projectId]: {
                            ...state.knownProjects[projectId],
                            adminToken,
                        },
                    },
                }))
            }

            // Fix old projects to work with new systems
            void (async () => {
                await ensureMembership(projectId)
                if (!cancelled) setPhase({kind: 'ready'})
            })()
            return () => { cancelled = true }
        }

        if (memberToken) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPhase({kind: 'needs-name', projectId, memberToken, adminToken})
            return
        }

        setPhase({
            kind: 'error',
            message: "You don't have access to this project. If you have an invite link, open it again.",
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId])

    // while the project is open, periodically confirm the current token is still a valid, non-revoked member.
    // If it isn't, flip to the revoked phase
    useEffect(() => {
        if (phase.kind !== 'ready' || !projectId) return

        let cancelled = false

        async function check() {
            const project = useProjectsStore.getState().knownProjects[projectId!]
            if (!project) return

            const client = getSupabaseForProject(project.memberToken, project.adminToken)
            const {data, error} = await client.rpc('is_project_member', {
                p_project_id: projectId,
            })

            if (!cancelled && !error && data === false) {
                setPhase({kind: 'revoked'})
            }
        }

        void check()
        const interval = window.setInterval(() => void check(), ACCESS_CHECK_INTERVAL_MS)
        const onVisible = () => {
            if (document.visibilityState === 'visible') void check()
        }
        document.addEventListener('visibilitychange', onVisible)

        return () => {
            cancelled = true
            window.clearInterval(interval)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [phase.kind, projectId])


    async function handleJoin() {
        if (phase.kind !== 'needs-name') return
        if (!displayName.trim()) return

        setJoining(true)
        try {
            await joinProject(phase.projectId, phase.memberToken, phase.adminToken, displayName.trim())

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

    if (phase.kind === 'revoked') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
                <div className="text-4xl mb-3 opacity-40">🔒</div>
                <h2 className="text-lg font-semibold text-gray-700 mb-2">Access revoked</h2>
                <p className="text-sm text-gray-500 mb-4 max-w-md">
                    Your access to this project has been revoked by an admin.
                </p>
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
                        This name is shown to other members.
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

    return (
        <BoardProvider>
            <Outlet/>
        </BoardProvider>
    )
}
