import {useSortable} from "@dnd-kit/sortable"
import {CSS} from "@dnd-kit/utilities"
import {useEffect, useRef, useState} from "react"
import type {Card} from "../../types/kanban"
import {useKanbanStore} from "../../store/kanbanStore"
import CardDescriptionDisplay from "./CardDescriptionDisplay"
import CardDescriptionEditor from "./CardDescriptionEditor"

interface KanbanCardProps {
    card: Card
    columnId: string
    isFlashed?: boolean
}

/**
 * Kanban card. Handles:
 * - drag & drop behaviour
 * - editing the description
 * - deleting the card
 * - flashing when navigated to
 */
export default function KanbanCard({card, columnId, isFlashed}: KanbanCardProps) {
    const deleteCard = useKanbanStore(state => state.deleteCard)
    const updateCardDescription = useKanbanStore(state => state.updateCardDescription)
    // Whether the card is currently in "edit mode".
    const [isEditing, setIsEditing] = useState(false)
    // Local draft of the description while editing.
    const [draft, setDraft] = useState<unknown>(card.description ?? null)

    /**
     * dnd-kit sortable hook.
     * - attributes & listeners: props to spread onto the draggable element
     * - setNodeRef: ref callback required by dnd-kit
     * - transform & transition: CSS transforms applied during drag
     * - isDragging: whether this card is currently being dragged
     * Dragging is disabled while editing.
     */
    const {
        attributes,
        listeners,
        setNodeRef: setSortableRef,
        transform,
        transition,
        isDragging
    } = useSortable({id: card.id, disabled: isEditing})

    const elRef = useRef<HTMLDivElement | null>(null)
    function setRef(el: HTMLDivElement | null) {
        elRef.current = el
        setSortableRef(el)
    }

    // When card becomes flashed card, scroll into view
    useEffect(() => {
        if (!isFlashed || !elRef.current) return
        elRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
        })
    }, [isFlashed])

    // dnd-kit transform to inline style.
    const style = {transform: CSS.Transform.toString(transform), transition}

    function startEditing() {
        setDraft(card.description ?? null)
        setIsEditing(true)
    }

    function saveAndClose() {
        updateCardDescription(card.id, draft)
        setIsEditing(false)
    }

    function cancel() {
        setIsEditing(false)
    }

    return (
        <div
            ref={setRef}
            style={style}
            // Disable drag attributes/listeners while editing.
            {...(isEditing ? {} : attributes)}
            {...(isEditing ? {} : listeners)}
            className={`
                bg-white rounded-lg border border-gray-200 p-3
                shadow-sm hover:shadow-md hover:border-gray-300
                transition-all duration-150
                ${isEditing ? '' : 'cursor-grab'}
                ${isDragging ? 'opacity-50 shadow-lg' : ''}
                ${isFlashed ? 'card-flash' : ''}
            `}
        >
            {/* Header row: title + action buttons */}
            <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 leading-snug break-words">
                    {card.title}
                </p>

                <div className="flex items-center gap-1 shrink-0">
                    {/* Edit button */}
                    <button
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
                        onClick={() => isEditing ? cancel() : startEditing()}
                        className="text-gray-300 hover:text-blue-500 transition-colors text-sm leading-none"
                        aria-label={isEditing ? "Cancel edit" : "Edit description"}
                        title={isEditing ? "Cancel" : "Edit description"}
                    >
                        ✎
                    </button>

                    {/* Delete button */}
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => deleteCard(columnId, card.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                        aria-label="Delete card"
                    >
                        ×
                    </button>
                </div>
            </div>

            {/* Description section */}
            {isEditing ? (
                <div className="mt-2 flex flex-col gap-2">
                    <div className="border border-gray-200 rounded p-2 bg-gray-50">
                        <CardDescriptionEditor
                            initialContent={card.description}
                            onChange={setDraft}
                            onSubmit={saveAndClose}
                            onCancel={cancel}
                            autoFocus
                        />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-gray-400">
                            Type @ to link a note · ⌘/Ctrl+Enter to save
                        </span>

                        <div className="flex gap-1">
                            <button
                                onClick={saveAndClose}
                                className="bg-blue-500 hover:bg-blue-600 text-white text-xs rounded px-2 py-1 transition-colors"
                            >
                                Save
                            </button>
                            <button
                                onClick={cancel}
                                className="text-gray-500 hover:text-gray-700 text-xs rounded px-2 py-1 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                // Only show description if it exists.
                card.description != null && (
                    <div className="mt-1">
                        <CardDescriptionDisplay doc={card.description}/>
                    </div>
                )
            )}
        </div>
    )
}
