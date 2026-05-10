import {useMemo} from 'react'
import {useNavigate} from 'react-router-dom'
import {useNotesStore} from '../../store/notesStore'

interface CardDescriptionDisplayProps {
    doc: unknown
}

export default function CardDescriptionDisplay({doc}: CardDescriptionDisplayProps) {
    const notes = useNotesStore(s => s.notes)

    // React Router hook for programmatic navigation.
    const navigate = useNavigate()

    // Memoize the rendered output, recalculates when the document changes or the notes change.
    const rendered = useMemo(() => {
        if (!doc || typeof doc !== 'object') return null
        return renderNode(doc as TiptapNode, notes, navigate, 'root')
    }, [doc, notes, navigate])

    // If nothing was rendered, don't output an empty wrapper.
    if (!rendered) return null

    return (
        <div className="text-xs text-gray-500 leading-snug break-words">
            {rendered}
        </div>
    )
}

// Tiptap node that can represent a number of things
interface TiptapNode {
    type?: string
    text?: string
    attrs?: Record<string, unknown>
    content?: TiptapNode[]
    marks?: {type: string}[]
}

// Renders a Tiptap JSON element into React elements.
function renderNode(
    node: TiptapNode,
    notes: ReturnType<typeof useNotesStore.getState>['notes'],
    navigate: ReturnType<typeof useNavigate>,
    keyPrefix: string,
): React.ReactNode {

    // Text node
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

    // Note mention node (@note)
    if (node.type === 'noteMention') {
        const id = node.attrs?.id as string | undefined
        const fallbackLabel = (node.attrs?.label as string | undefined) ?? 'note'

        // Look up the note in Zustand store.
        const liveNote = id ? notes[id] : undefined
        const isStale = !liveNote

        // Use the note title if available.
        const label = liveNote?.title || fallbackLabel || 'Untitled'

        return (
            <button
                type="button"
                // Prevents dragging the card or triggering parent events.
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation()
                    if (id && liveNote) {
                        // Select the note in the store and navigate to the notes page.
                        useNotesStore.getState().selectNote(id)
                        navigate('/notes')
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

    // Render all children nodes.
    const children = (node.content ?? []).map((child, i) =>
        renderNode(child, notes, navigate, `${keyPrefix}-${i}`)
    )

    // Map tiptap nodes to HTML elements.
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

    // Fallback, if unknown return this
    return <span key={keyPrefix}>{children}</span>
}
