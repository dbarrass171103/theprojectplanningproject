// Individual card in a kanban column.
//
// Modes:
//   - Display mode: shows title + optional description (rendered read-only
//     via CardDescriptionDisplay). Card is draggable.
//   - Edit mode: shows title + a Tiptap editor for the description, plus
//     Save/Cancel. Drag is disabled while editing so cursor interactions
//     inside the editor don't fight with dnd-kit.
//
// Drag-and-drop: registered with @dnd-kit/sortable. dnd-kit gives us refs,
// listeners, and inline transform styles which we spread onto the root div.
// We skip these props when editing (the spread is conditional).
//
// "Flashing": when a card-mention link is clicked elsewhere in the app, the
// board sets `isFlashed` on the matched card. We scroll it into view and
// apply a CSS animation class. The animation itself is defined in editor.css.

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

export default function KanbanCard({card, columnId, isFlashed}: KanbanCardProps) {
    const deleteCard = useKanbanStore(state => state.deleteCard)
    const updateCardDescription = useKanbanStore(state => state.updateCardDescription)

    const [isEditing, setIsEditing] = useState(false)
    // Local draft of the description while editing. Committed to the store
    // only when the user clicks Save (avoids spamming the store + sync engine
    // with every keystroke).
    const [draft, setDraft] = useState<unknown>(card.description ?? null)

    // dnd-kit's sortable hook gives us everything needed to make this draggable:
    //   - attributes/listeners: spread onto the draggable element
    //   - setNodeRef: ref callback dnd-kit uses to track the element
    //   - transform/transition: live CSS transforms applied during drag
    //   - isDragging: whether this specific card is being dragged
    // We disable dragging while editing so editor interactions work normally.
    const {
        attributes,
        listeners,
        setNodeRef: setSortableRef,
        transform,
        transition,
        isDragging
    } = useSortable({id: card.id, disabled: isEditing})

    // We need our own ref to call scrollIntoView on flash. We compose with
    // dnd-kit's ref by chaining both in a single setter.
    const elRef = useRef<HTMLDivElement | null>(null)
    function setRef(el: HTMLDivElement | null) {
        elRef.current = el
        setSortableRef(el)
    }

    // Scroll this card into view when it becomes the flashed card.
    useEffect(() => {
        if (!isFlashed || !elRef.current) return
        elRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
        })
    }, [isFlashed])

    // Convert dnd-kit's transform value to a CSS string for inline styling.
    const style = {transform: CSS.Transform.toString(transform), transition}

    function startEditing() {
        // Seed the draft with current card state so we don't lose unsaved
        // changes if the user clicks somewhere else accidentally.
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
            // Spread dnd-kit's attributes/listeners only when not editing.
            // While editing, the editor itself handles all pointer/keyboard
            // interactions and dragging would just get in the way.
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
            {/* Title row + action buttons (edit/delete) */}
            <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 leading-snug break-words">
                    {card.title}
                </p>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        // Stop pointerdown bubbling to the drag handle —
                        // otherwise clicking edit would also start a drag.
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => isEditing ? cancel() : startEditing()}
                        className="text-gray-300 hover:text-blue-500 transition-colors text-sm leading-none"
                        aria-label={isEditing ? "Cancel edit" : "Edit description"}
                        title={isEditing ? "Cancel" : "Edit description"}
                    >
                        ✎
                    </button>

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

            {isEditing ? (
                // Edit mode: full description editor + save/cancel buttons.
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
                // Display mode: only render description block if one exists.
                // Cards with no description shouldn't have an empty gap below
                // the title.
                card.description != null && (
                    <div className="mt-1">
                        <CardDescriptionDisplay doc={card.description}/>
                    </div>
                )
            )}
        </div>
    )
}