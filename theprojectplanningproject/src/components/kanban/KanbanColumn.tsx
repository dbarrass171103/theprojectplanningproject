// One column on the kanban board.
//
// Renders the column header (title + card count + delete button), a
// vertically-sortable list of cards, and an "Add card" form at the bottom.
//
// The droppable area is the card list; dropping on the empty space below
// the last card also works because the list has `min-h-20` ensuring it
// always has clickable area even when empty.

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

export default function KanbanColumn({column, flashedCardId}: KanbanColumnProps) {
    const cards = useKanbanStore(state => state.board.cards)
    const deleteColumn = useKanbanStore(state => state.deleteColumn)

    // Registers this column as a drop target. dnd-kit will fire events when
    // a card is dragged over it.
    const {setNodeRef} = useDroppable({id: column.id})

    // Cards are stored in a flat `cards` lookup keyed by id; the column owns
    // an ordered list of ids. We materialise the cards here. The .filter(Boolean)
    // guards against transient mismatches where a card id is in the column
    // before the card object has been hydrated (e.g. during sync).
    const columnCards = column.cardIds.map(id => cards[id]).filter(Boolean)

    return (
        <div className="bg-gray-100 rounded-xl p-3 w-72 shrink-0 flex flex-col gap-3">

            {/* Header: title + count + delete */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-700 text-sm break-words">
                        {column.title}
                    </h2>

                    <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                        {columnCards.length}
                    </span>
                </div>

                <button
                    onClick={() => deleteColumn(column.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                    aria-label="Delete column"
                >
                    ×
                </button>
            </div>

            {/* Card list — also the drop target. min-h-20 keeps the area
                droppable even when the column is empty. */}
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

            <AddCardForm columnId={column.id}/>
        </div>
    )
}