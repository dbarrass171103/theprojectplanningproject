// Share modal for the current project. Shows the member invite link and, for
// admins, the admin link. Member management (revoke, rotate, rename, delete)
// lives on the dedicated Admin page.

import {useEffect, useRef, useState} from 'react'
import type {KnownProject} from '../../store/projectsStore'

interface ShareProjectModalProps {
    project: KnownProject
    onClose: () => void
}

function buildInviteUrl(projectId: string, inviteToken: string): string {
    return `${window.location.origin}/p/${projectId}#tok=${inviteToken}`
}

function buildAdminUrl(projectId: string, inviteToken: string, adminToken: string): string {
    return `${window.location.origin}/p/${projectId}#tok=${inviteToken}&admin=${adminToken}`
}

export default function ShareProjectModal({project, onClose}: ShareProjectModalProps) {
    const [copiedLink, setCopiedLink] = useState<'invite' | 'admin' | null>(null)
    const dialogRef = useRef<HTMLDivElement | null>(null)

    const inviteToken = project.inviteToken
    const inviteUrl = inviteToken ? buildInviteUrl(project.id, inviteToken) : null
    const adminUrl = inviteToken && project.adminToken
        ? buildAdminUrl(project.id, inviteToken, project.adminToken)
        : null

    // Close on Escape or outside-click.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose()
        }

        function onClick(e: MouseEvent) {
            if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
                onClose()
            }
        }

        document.addEventListener('keydown', onKey)
        document.addEventListener('mousedown', onClick)

        return () => {
            document.removeEventListener('keydown', onKey)
            document.removeEventListener('mousedown', onClick)
        }
    }, [onClose])

    async function copyToClipboard(text: string, kind: 'invite' | 'admin') {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedLink(kind)
            window.setTimeout(() => setCopiedLink(null), 2000)
        } catch {
            console.warn('Clipboard write failed; user can copy manually')
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div
                ref={dialogRef}
                className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6"
            >
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">Share project</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{project.name}</p>
                    </div>

                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-700 text-xl leading-none"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {inviteUrl ? (
                    <div className="mb-5">
                        <h3 className="text-sm font-medium text-gray-700 mb-1">Invite link</h3>
                        <p className="text-xs text-gray-500 mb-2">
                            Anyone with this link can edit the project.
                        </p>

                        <div className="flex gap-2">
                            <input
                                readOnly
                                value={inviteUrl}
                                onFocus={e => e.currentTarget.select()}
                                className="flex-1 text-xs font-mono rounded-lg border border-gray-300 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />

                            <button
                                onClick={() => copyToClipboard(inviteUrl, 'invite')}
                                className="bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg px-3 py-2 transition-colors shrink-0"
                            >
                                {copiedLink === 'invite' ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mb-5 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                        Only an admin can invite new members to this project.
                    </div>
                )}

                {adminUrl && (
                    <div className="border-t border-gray-100 pt-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-1">
                            Admin link
                            <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
                                Keep secret
                            </span>
                        </h3>

                        <p className="text-xs text-gray-500 mb-2">
                            This link grants full control of the project. Store it safely.
                        </p>

                        <div className="flex gap-2">
                            <input
                                readOnly
                                value={adminUrl}
                                onFocus={e => e.currentTarget.select()}
                                className="flex-1 text-xs font-mono rounded-lg border border-amber-300 px-3 py-2 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />

                            <button
                                onClick={() => copyToClipboard(adminUrl, 'admin')}
                                className="bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg px-3 py-2 transition-colors shrink-0"
                            >
                                {copiedLink === 'admin' ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
