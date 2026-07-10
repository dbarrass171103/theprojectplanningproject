// Admin console for a project: manage members (revoke/restore), rotate the
// invite link, and rename or delete the project.

import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useCurrentProject, useProjectsStore} from '../store/projectsStore'
import {useMembersStore} from '../store/membersStore'

function formatLastSeen(ts: number | null): string {
    if (!ts) return 'never'
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
    })
}

export default function AdminPage() {
    const navigate = useNavigate()
    const project = useCurrentProject()

    const members = useMembersStore(s => s.members)
    const loading = useMembersStore(s => s.loading)
    const error = useMembersStore(s => s.error)
    const loadMembers = useMembersStore(s => s.loadMembers)
    const setRevoked = useMembersStore(s => s.setRevoked)
    const rotateInvite = useMembersStore(s => s.rotateInvite)
    const resetMembers = useMembersStore(s => s.reset)

    const renameProject = useProjectsStore(s => s.renameProject)
    const deleteProject = useProjectsStore(s => s.deleteProject)

    const isAdmin = !!project?.adminToken

    const [copied, setCopied] = useState(false)
    const [confirmRotate, setConfirmRotate] = useState(false)
    const [rotating, setRotating] = useState(false)

    const [nameDraft, setNameDraft] = useState(project?.name ?? '')
    const [renaming, setRenaming] = useState(false)
    const [renameError, setRenameError] = useState<string | null>(null)

    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    useEffect(() => {
        if (project?.id && isAdmin) void loadMembers(project.id)
        return () => resetMembers()
    }, [project?.id, isAdmin, loadMembers, resetMembers])

    if (!project) return null

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
                <div className="text-4xl mb-3 opacity-40">🔒</div>
                <h2 className="text-lg font-semibold text-gray-700 mb-2">Admin only</h2>
                <p className="text-sm text-gray-500 mb-4 max-w-md">
                    You need the admin link for this project to manage members.
                </p>
                <button
                    onClick={() => navigate(`/p/${project.id}`)}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg px-4 py-2"
                >
                    Back to board
                </button>
            </div>
        )
    }

    const inviteToken = project.inviteToken
    const inviteUrl = inviteToken
        ? `${window.location.origin}/p/${project.id}#tok=${inviteToken}`
        : ''

    const activeCount = members.filter(m => !m.revoked).length

    async function copyInvite() {
        try {
            await navigator.clipboard.writeText(inviteUrl)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
        } catch {
            console.warn('Clipboard write failed; user can copy manually')
        }
    }

    async function handleRotate() {
        setRotating(true)
        try {
            await rotateInvite(project!.id)
        } finally {
            setRotating(false)
            setConfirmRotate(false)
        }
    }

    async function handleRename() {
        if (!nameDraft.trim() || nameDraft.trim() === project!.name) return
        setRenaming(true)
        setRenameError(null)
        try {
            await renameProject(project!.id, nameDraft.trim())
        } catch (e) {
            setRenameError(e instanceof Error ? e.message : 'Failed to rename')
        } finally {
            setRenaming(false)
        }
    }

    async function handleDelete() {
        setDeleting(true)
        setDeleteError(null)
        try {
            await deleteProject(project!.id)
            navigate('/')
        } catch (e) {
            setDeleteError(e instanceof Error ? e.message : 'Failed to delete')
            setDeleting(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto p-8 flex flex-col gap-8">
            <div>
                <h1 className="text-2xl font-semibold text-gray-800">Project admin</h1>
                <p className="text-sm text-gray-500 mt-1">{project.name}</p>
            </div>

            {/* Members */}
            <section className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-700">Members</h2>
                    <span className="text-xs text-gray-400">
                        {activeCount} active{members.length !== activeCount ? ` · ${members.length - activeCount} revoked` : ''}
                    </span>
                </div>

                {error && (
                    <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-2">{error}</p>
                )}

                {loading && members.length === 0 ? (
                    <p className="text-xs text-gray-400">Loading members…</p>
                ) : members.length === 0 ? (
                    <p className="text-xs text-gray-400">No members yet.</p>
                ) : (
                    <ul className="flex flex-col divide-y divide-gray-100">
                        {members.map(m => (
                            <li key={m.id} className="flex items-center gap-3 py-2.5">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-medium truncate ${m.revoked ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                            {m.displayName}
                                        </span>
                                        {m.role === 'admin' && (
                                            <span className="text-[10px] text-amber-600 bg-amber-50 rounded px-1 py-0.5 shrink-0">
                                                admin
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-gray-400">
                                        {m.revoked
                                            ? 'Revoked'
                                            : `Active · seen ${formatLastSeen(m.lastSeenAt)}`
                                        }
                                        {` · joined ${formatDate(m.createdAt)}`}
                                    </div>
                                </div>

                                {m.revoked ? (
                                    <button
                                        onClick={() => setRevoked(project.id, m.id, false)}
                                        className="text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded px-2.5 py-1 transition-colors shrink-0"
                                    >
                                        Restore
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setRevoked(project.id, m.id, true)}
                                        className="text-xs text-red-600 hover:bg-red-50 rounded px-2.5 py-1 transition-colors shrink-0"
                                    >
                                        Revoke
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Invite link */}
            <section className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-1">Invite link</h2>
                <p className="text-xs text-gray-500 mb-3">
                    Anyone with this link can join and edit. Rotating it stops new joins on
                    the old link; current members keep their access.
                </p>

                <div className="flex gap-2">
                    <input
                        readOnly
                        value={inviteUrl}
                        onFocus={e => e.currentTarget.select()}
                        className="flex-1 text-xs font-mono rounded-lg border border-gray-300 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                        onClick={copyInvite}
                        className="bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg px-3 py-2 transition-colors shrink-0"
                    >
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>

                <div className="mt-2 flex items-center gap-2">
                    {confirmRotate ? (
                        <>
                            <span className="text-xs text-gray-500">
                                Rotate? The old link stops working for new joins.
                            </span>
                            <button
                                onClick={handleRotate}
                                disabled={rotating}
                                className="text-xs bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded px-2 py-1 transition-colors"
                            >
                                {rotating ? 'Rotating…' : 'Rotate'}
                            </button>
                            <button
                                onClick={() => setConfirmRotate(false)}
                                className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-1"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setConfirmRotate(true)}
                            className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
                        >
                            Rotate invite link…
                        </button>
                    )}
                </div>
            </section>

            {/* Danger zone */}
            <section className="bg-white border border-red-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-red-700 mb-3">Danger zone</h2>

                {/* Rename */}
                <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Project name</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={nameDraft}
                            onChange={e => setNameDraft(e.target.value)}
                            className="flex-1 text-sm rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button
                            onClick={handleRename}
                            disabled={renaming || !nameDraft.trim() || nameDraft.trim() === project.name}
                            className="text-sm bg-gray-700 hover:bg-gray-800 disabled:opacity-40 text-white rounded-lg px-3 py-2 transition-colors shrink-0"
                        >
                            {renaming ? 'Saving…' : 'Rename'}
                        </button>
                    </div>
                    {renameError && (
                        <p className="text-xs text-red-600 mt-1">{renameError}</p>
                    )}
                </div>

                {/* Delete */}
                <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-sm font-medium text-gray-800">Delete project</div>
                            <div className="text-xs text-gray-500">
                                Permanently removes the board, notes, chat, and calendar for everyone.
                            </div>
                        </div>
                        {!confirmDelete && (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className="text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors shrink-0"
                            >
                                Delete
                            </button>
                        )}
                    </div>

                    {confirmDelete && (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-xs text-red-700 mb-2">
                                This cannot be undone. All project data will be permanently deleted for everyone.
                            </p>
                            {deleteError && (
                                <p className="text-xs text-red-600 mb-2">{deleteError}</p>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition-colors"
                                >
                                    {deleting ? 'Deleting…' : 'Delete permanently'}
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    disabled={deleting}
                                    className="text-sm text-gray-500 hover:text-gray-700 rounded-lg px-3 py-1.5"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}
