// Single kanban card. Display mode shows the title and rendered description.
// Edit mode switches to a collaborative description editor and disables drag.

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
    const [isEditing, setIsEditing] = useState(false)

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

    // Scroll into view when arriving via a mention flash.
    useEffect(() => {
        if (!isFlashed || !elRef.current) return
        elRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
        })
    }, [isFlashed])

    const style = {transform: CSS.Transform.toString(transform), transition}

    function startEditing() {
        setIsEditing(true)
    }

    function closeEditor() {
        setIsEditing(false)
    }

    return (
        <div
            ref={setRef}
            style={style}
            // Detach the drag handle while editing so clicks inside the
            // editor don't start a drag.
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
            <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 leading-snug break-words">
                    {card.title}
                </p>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={() => isEditing ? closeEditor() : startEditing()}
                        className="text-gray-300 hover:text-blue-500 transition-colors text-sm leading-none"
                        aria-label={isEditing ? "Close editor" : "Edit description"}
                        title={isEditing ? "Done" : "Edit description"}
                    >
                        ✎
                    </button>

                    <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={() => deleteCard(columnId, card.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                        aria-label="Delete card"
                    >
                        ×
                    </button>
                </div>
            </div>

            {isEditing ? (
                <div className="mt-2 flex flex-col gap-2">
                    <div className="border border-gray-200 rounded p-2 bg-gray-50">
                        <CardDescriptionEditor
                            cardId={card.id}
                            onSubmit={closeEditor}
                            onCancel={closeEditor}
                            autoFocus
                        />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-gray-400">
                            Type @ to link a note · ⌘/Ctrl+Enter to close
                        </span>

                        <button
                            onClick={closeEditor}
                            className="bg-blue-500 hover:bg-blue-600 text-white text-xs rounded px-2 py-1 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            ) : (
                card.description != null && (
                    <div className="mt-1">
                        <CardDescriptionDisplay doc={card.description}/>
                    </div>
                )
            )}
        </div>
    )
}
