import {useMemo} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {useNotesStore} from '../../store/notesStore'

interface CardDescriptionDisplayProps {
    doc: unknown
}

export default function CardDescriptionDisplay({doc}: CardDescriptionDisplayProps) {
    const notes = useNotesStore(s => s.notes)
    const navigate = useNavigate()
    // Read projectId from the URL so we can build the correct notes path.
    const {projectId} = useParams<{projectId: string}>()

    const rendered = useMemo(() => {
        if (!doc || typeof doc !== 'object') return null
        return renderNode(doc as TiptapNode, notes, navigate, projectId ?? '', 'root')
    }, [doc, notes, navigate, projectId])

    if (!rendered) return null

    return (
        <div className="text-xs text-gray-500 leading-snug break-words">
            {rendered}
        </div>
    )
}

interface TiptapNode {
    type?: string
    text?: string
    attrs?: Record<string, unknown>
    content?: TiptapNode[]
    marks?: {type: string}[]
}

function renderNode(
    node: TiptapNode,
    notes: ReturnType<typeof useNotesStore.getState>['notes'],
    navigate: ReturnType<typeof useNavigate>,
    projectId: string,
    keyPrefix: string,
): React.ReactNode {

    if (node.type === 'text') {
        let element: React.ReactNode = node.text

        for (const mark of node.marks ?? []) {
            if (mark.type === 'bold') {
                element = <strong key={`${keyPrefix}-b`}>{element}</strong>
            } else if (mark.type === 'italic') {
                element = <em key={`${keyPrefix}-i`}>{element}</em>
            } else if (mark.type === 'code') {
                element = <code key={`${keyPrefix}-c`}>{element}</code>
            }
        }

        return element
    }

    if (node.type === 'noteMention') {
        const id = node.attrs?.id as string | undefined
        const fallbackLabel = (node.attrs?.label as string | undefined) ?? 'note'

        const liveNote = id ? notes[id] : undefined
        const isStale = !liveNote

        const label = liveNote?.title || fallbackLabel || 'Untitled'

        return (
            <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation()
                    if (id && liveNote) {
                        useNotesStore.getState().selectNote(id)
                        // Fixed: navigate to the project-scoped notes route
                        // instead of the bare '/notes' path which doesn't exist.
                        navigate(`/p/${projectId}/notes`)
                    }
                }}
                disabled={isStale}
                className={`
                    inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium
                    ${isStale
                        ? 'bg-gray-100 text-gray-400 line-through cursor-not-allowed'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer'
                    }
                `}
                title={isStale ? 'This note has been deleted' : `Open ${label}`}
            >
                @{label}
            </button>
        )
    }

    const children = (node.content ?? []).map((child, i) =>
        renderNode(child, notes, navigate, projectId, `${keyPrefix}-${i}`)
    )

    if (node.type === 'paragraph') {
        if (children.length === 0) return null
        return <p key={keyPrefix}>{children}</p>
    }

    if (node.type === 'bulletList') {
        return <ul key={keyPrefix} className="list-disc pl-4">{children}</ul>
    }

    if (node.type === 'orderedList') {
        return <ol key={keyPrefix} className="list-decimal pl-4">{children}</ol>
    }

    if (node.type === 'listItem') {
        return <li key={keyPrefix}>{children}</li>
    }

    return <span key={keyPrefix}>{children}</span>
}