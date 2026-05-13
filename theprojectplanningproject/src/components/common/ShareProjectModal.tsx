import {useEffect, useRef, useState} from 'react'
import type {KnownProject} from '../../store/projectsStore'

interface ShareProjectModalProps {
    project: KnownProject
    onClose: () => void
}

// Build the invite link for regular members.
function buildInviteUrl(projectId: string, memberToken: string): string {
    return `${window.location.origin}/p/${projectId}#tok=${memberToken}`
}

// Build the admin link (includes both member + admin tokens).
function buildAdminUrl(projectId: string, memberToken: string, adminToken: string): string {
    return `${window.location.origin}/p/${projectId}#tok=${memberToken}&admin=${adminToken}`
}

export default function ShareProjectModal({project, onClose}: ShareProjectModalProps) {
    // Tracks which link was just copied ("invite", "admin", or null)
    const [copiedLink, setCopiedLink] = useState<'invite' | 'admin' | null>(null)

    // Ref to the modal dialog container
    const dialogRef = useRef<HTMLDivElement | null>(null)

    // Pre-build the URLs
    const inviteUrl = buildInviteUrl(project.id, project.memberToken)
    const adminUrl = project.adminToken
        ? buildAdminUrl(project.id, project.memberToken, project.adminToken)
        : null

    // Close modal when user clicks outside box, or presses escape.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose()
        }

        function onClick(e: MouseEvent) {
            // If click target is NOT inside the dialog, close modal
            if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
                onClose()
            }
        }

        document.addEventListener('keydown', onKey)
        document.addEventListener('mousedown', onClick)

        // Cleanup listeners when modal unmounts
        return () => {
            document.removeEventListener('keydown', onKey)
            document.removeEventListener('mousedown', onClick)
        }
    }, [onClose])

    // Copies link to clipboard, shows "copied" message for two seconds
    async function copyToClipboard(text: string, kind: 'invite' | 'admin') {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedLink(kind)

            // Reset "Copied" indicator after 2 seconds
            window.setTimeout(() => setCopiedLink(null), 2000)
        } catch {
            // Incase clipboard API fails
            console.warn('Clipboard write failed; user can select and copy manually')
        }
    }

    return (
        // Modal backdrop (darkened background)
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">

            {/* Modal container */}
            <div
                ref={dialogRef}
                className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6"
            >
                {/* Header row: title + close button */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">Share project</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{project.name}</p>
                    </div>

                    {/* Close button (×) */}
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-700 text-xl leading-none"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Invite link section */}
                <div className="mb-5">
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Invite link</h3>
                    <p className="text-xs text-gray-500 mb-2">
                        Anyone with this link can read and edit this project.
                    </p>

                    <div className="flex gap-2">
                        {/* Read-only input showing the invite URL */}
                        <input
                            readOnly
                            value={inviteUrl}
                            onFocus={(e) => e.currentTarget.select()} // auto-select on click
                            className="flex-1 text-xs font-mono rounded-lg border border-gray-300 px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />

                        {/* Copy button */}
                        <button
                            onClick={() => copyToClipboard(inviteUrl, 'invite')}
                            className="bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg px-3 py-2 transition-colors shrink-0"
                        >
                            {copiedLink === 'invite' ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                </div>

                {/* Admin link section (only shown if adminToken exists) */}
                {adminUrl && (
                    <div className="border-t border-gray-100 pt-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-1">
                            Admin link
                            <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
                                Keep secret
                            </span>
                        </h3>

                        <p className="text-xs text-gray-500 mb-2">
                            Use this link on a new device to manage the project (rename,
                            kick everyone, delete, etc). <strong>Don't share this with anyone.</strong>
                            {' '}, Copy it somewhere, or you cannot recover admin access.
                        </p>

                        <div className="flex gap-2">
                            {/* Admin URL input */}
                            <input
                                readOnly
                                value={adminUrl}
                                onFocus={(e) => e.currentTarget.select()}
                                className="flex-1 text-xs font-mono rounded-lg border border-amber-300 px-3 py-2 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />

                            {/* Copy admin link */}
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
