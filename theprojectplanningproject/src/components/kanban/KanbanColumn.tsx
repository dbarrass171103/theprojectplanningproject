import {SortableContext, verticalListSortingStrategy} from "@dnd-kit/sortable"
import {useDroppable} from "@dnd-kit/core"
import type {Column} from "../../types/kanban"
import {useKanbanStore} from "../../store/kanbanStore"
import KanbanCard from "./KanbanCard"
import AddCardForm from "./AddCardForm"

interface KanbanColumnProps {
    column: Column
    flashedCardId?: string | null
}

/**
 * A Kanban column.
 * Handles:
 * - displaying the column title and card count
 * - rendering all cards inside a SortableContext
 * - allowing drag & drop
 * - deleting the column
 * - rendering the "Add card" form
 */
export default function KanbanColumn({column, flashedCardId}: KanbanColumnProps) {
    const cards = useKanbanStore(state => state.board.cards)
    // Action to delete the entire column.
    const deleteColumn = useKanbanStore(state => state.deleteColumn)
    // Make the column a droppable area.
    const {setNodeRef} = useDroppable({id: column.id})
    // Convert hte card id's into card objects.
    const columnCards = column.cardIds.map(id => cards[id]).filter(Boolean)

    return (
        <div className="bg-gray-100 rounded-xl p-3 w-72 shrink-0 flex flex-col gap-3">

            {/* Column header: title + card count + delete button */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-700 text-sm break-words">
                        {column.title}
                    </h2>

                    {/* Badge showing number of cards */}
                    <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                        {columnCards.length}
                    </span>
                </div>

                {/* Delete column button */}
                <button
                    onClick={() => deleteColumn(column.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                    aria-label="Delete column"
                >
                    ×
                </button>
            </div>

            {/* Card list area and drag and drop zone */}
            <div ref={setNodeRef} className="flex flex-col gap-2 min-h-20">
                <SortableContext
                    items={column.cardIds}
                    strategy={verticalListSortingStrategy}
                >
                    {columnCards.map(card => (
                        <KanbanCard
                            key={card.id}
                            card={card}
                            columnId={column.id}
                            isFlashed={card.id === flashedCardId}
                        />
                    ))}
                </SortableContext>
            </div>

            {/* Add new card form */}
            <AddCardForm columnId={column.id}/>
        </div>
    )
}
