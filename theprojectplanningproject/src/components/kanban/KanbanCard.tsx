import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import type {Card} from "../../types/kanban";
import {useKanbanStore} from "../../store/kanbanStore";

interface KanbanCardProps {
    card: Card
    columnId: string
}

export default function KanbanCard({card, columnId}: KanbanCardProps) {
    const deleteCard = useKanbanStore(state => state.deleteCard)

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({id: card.id})

    const style = {transform: CSS.Transform.toString(transform), transition}

    return (
        <div ref={setNodeRef}
             style={style}
             {...attributes}
             {...listeners}
             className={`
            bg-white rounded-lg border border-gray-200 p-3 cursor-grab
            shadow-sm hover:shadow-md hover:border-gray-300
            transition-all duration-150
            ${isDragging ? 'opacity-50 shadow-lg' : ''}
          `}
        >
            <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 leading-snug break-words">
                    {card.title}
                </p>
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => deleteCard(columnId, card.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors shrink-0 text-lg leading-none"
                    aria-label="Delete card"
                >
                    ×
                </button>
            </div>

            {card.description && (
                <p className="text-xs text-gray-400 mt-1 leading-snug break-words">
                    {card.description}
                </p>
            )}
        </div>
    )
}