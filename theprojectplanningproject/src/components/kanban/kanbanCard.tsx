import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {Card} from "../../types/kanban.ts";
import {useKanbanStore} from "../../store/kanbanStore.ts";

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
        transtion,
        isDragging
    } = useSortable({id: card.id})

    const style = {transform: CSS.Transform.toString(transform), transtion}

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
                <p className="text-sm font-medium text-gray-800 leading-snug">
                    {card.title}
                </p>
                <button onClick={() => deleteCard(columnId, card.id)}
                        className="text-gray-300 hover: text-red-400 transition-colors shrink-0 text-lg leading-none">
                    Delete
                </button>
            </div>

            {card.description && (
                <p className="text-xs text-gray-400 mt-1 leading-snug">
                    {card.description}
                </p>
            )}
        </div>
    )
}