// Home page: lists known projects and lets the user create a new one.

import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useProjectsStore} from '../store/projectsStore'

export default function HomePage() {
    const navigate = useNavigate()
    const knownProjects = useProjectsStore(s => s.knownProjects)
    const createProject = useProjectsStore(s => s.createProject)
    const setCurrentProject = useProjectsStore(s => s.setCurrentProject)
    const leaveProject = useProjectsStore(s => s.leaveProject)
    const updateDisplayName = useProjectsStore(s => s.updateDisplayName)

    const [creating, setCreating] = useState(false)
    const [newProjectName, setNewProjectName] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

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

    function startRename(id: string, currentName: string) {
        setConfirmRemoveId(null)
        setEditingId(id)
        setEditingName(currentName)
    }

    function commitRename() {
        if (editingId && editingName.trim()) {
            updateDisplayName(editingId, editingName.trim())
        }
        setEditingId(null)
        setEditingName('')
    }

    function cancelRename() {
        setEditingId(null)
        setEditingName('')
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
                        {sortedProjects.map(p => {
                            const isEditing = editingId === p.id
                            const isConfirming = confirmRemoveId === p.id

                            if (isEditing) {
                                return (
                                    <li key={p.id}>
                                        <div className="bg-white border border-blue-300 rounded-lg px-4 py-3 flex flex-col gap-2">
                                            <div className="font-medium text-gray-800">{p.name}</div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500 shrink-0">Your name:</span>
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={editingName}
                                                    onChange={e => setEditingName(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') commitRename()
                                                        if (e.key === 'Escape') cancelRename()
                                                    }}
                                                    className="flex-1 text-sm rounded-lg border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                />
                                                <button
                                                    onClick={commitRename}
                                                    disabled={!editingName.trim()}
                                                    className="text-sm bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg px-3 py-1 transition-colors"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={cancelRename}
                                                    className="text-sm text-gray-500 hover:text-gray-700 rounded-lg px-2 py-1"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                )
                            }

                            return (
                                <li key={p.id} className="relative group">
                                    <button
                                        onClick={() => handleOpenProject(p.id)}
                                        className="w-full text-left bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm rounded-lg px-4 py-3 pr-28 transition-all"
                                    >
                                        <div className="font-medium text-gray-800">{p.name}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            as {p.displayName}
                                            {p.adminToken && (
                                                <span className="ml-2 text-amber-600">· admin</span>
                                            )}
                                        </div>
                                    </button>

                                    <div className="absolute top-1/2 -translate-y-1/2 right-3 flex items-center gap-1">
                                        {isConfirming ? (
                                            <>
                                                <span className="text-xs text-gray-500 mr-1">Remove?</span>
                                                <button
                                                    onClick={() => {
                                                        leaveProject(p.id)
                                                        setConfirmRemoveId(null)
                                                    }}
                                                    title="You'll need the invite link to rejoin"
                                                    className="text-xs bg-red-500 hover:bg-red-600 text-white rounded px-2 py-1 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                                <button
                                                    onClick={() => setConfirmRemoveId(null)}
                                                    className="text-xs text-gray-500 hover:text-gray-700 rounded px-1.5 py-1"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => startRename(p.id, p.displayName)}
                                                    title="Change your display name"
                                                    className="text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded px-2 py-1 transition-colors"
                                                >
                                                    Rename
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setConfirmRemoveId(p.id)
                                                        setEditingId(null)
                                                    }}
                                                    title="Remove from this device"
                                                    className="text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded px-2 py-1 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </li>
                            )
                        })}
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
