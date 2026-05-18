// Home page: lists known projects and lets the user create a new one.

import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useProjectsStore} from '../store/projectsStore'

export default function HomePage() {
    const navigate = useNavigate()
    const knownProjects = useProjectsStore(s => s.knownProjects)
    const createProject = useProjectsStore(s => s.createProject)
    const setCurrentProject = useProjectsStore(s => s.setCurrentProject)

    const [creating, setCreating] = useState(false)
    const [newProjectName, setNewProjectName] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    // Clear the active project when landing here.
    useEffect(() => {
        setCurrentProject(null)
    }, [setCurrentProject])

    const sortedProjects = Object.values(knownProjects).sort(
        (a, b) => b.joinedAt - a.joinedAt,
    )

    async function handleCreate() {
        if (!newProjectName.trim()) {
            setError('Please give your project a name.')
            return
        }
        if (!displayName.trim()) {
            setError('Please tell us what to call you in this project.')
            return
        }

        setError(null)
        setBusy(true)
        try {
            const project = await createProject(
                newProjectName.trim(),
                displayName.trim(),
            )
            navigate(`/p/${project.id}`)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create project')
        } finally {
            setBusy(false)
        }
    }

    function handleOpenProject(id: string) {
        setCurrentProject(id)
        navigate(`/p/${id}`)
    }

    return (
        <div className="max-w-2xl mx-auto p-8">
            <h1 className="text-2xl font-semibold text-gray-800 mb-2">Your projects</h1>
            <p className="text-sm text-gray-500 mb-6">
                Projects are shared workspaces. Create one or open an existing one.
            </p>

            {sortedProjects.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Recent
                    </h2>
                    <ul className="flex flex-col gap-2">
                        {sortedProjects.map(p => (
                            <li key={p.id}>
                                <button
                                    onClick={() => handleOpenProject(p.id)}
                                    className="w-full text-left bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm rounded-lg px-4 py-3 transition-all"
                                >
                                    <div className="font-medium text-gray-800">{p.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        as {p.displayName}
                                        {p.adminToken && (
                                            <span className="ml-2 text-amber-600">· admin</span>
                                        )}
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg p-5">
                {!creating ? (
                    <button
                        onClick={() => setCreating(true)}
                        className="bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg px-4 py-2 transition-colors"
                    >
                        + Create new project
                    </button>
                ) : (
                    <div className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-gray-700">New project</h3>

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Project name
                            </label>
                            <input
                                autoFocus
                                type="text"
                                value={newProjectName}
                                onChange={e => setNewProjectName(e.target.value)}
                                placeholder="e.g. Trip to Spain"
                                className="text-sm rounded-lg border border-gray-300 px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Your name in this project
                            </label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                placeholder="e.g. Dan"
                                className="text-sm rounded-lg border border-gray-300 px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                                Used for attribution only.
                            </p>
                        </div>

                        {error && (
                            <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                                {error}
                            </p>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={handleCreate}
                                disabled={busy}
                                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm rounded-lg px-4 py-2 transition-colors"
                            >
                                {busy ? 'Creating…' : 'Create'}
                            </button>

                            <button
                                onClick={() => {
                                    setCreating(false)
                                    setError(null)
                                    setNewProjectName('')
                                    setDisplayName('')
                                }}
                                disabled={busy}
                                className="text-gray-500 hover:text-gray-700 text-sm rounded-lg px-3 py-2 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <p className="text-xs text-gray-400 mt-6">
                To join an existing project, paste the invite link into your browser's address bar.
            </p>
        </div>
    )
}
