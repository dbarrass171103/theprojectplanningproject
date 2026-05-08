import {SortableContext, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {useDroppable} from "@dnd-kit/core";
import type {Column} from "../../types/kanban";
import {useKanbanStore} from "../../store/kanbanStore";
import KanbanCard from "./KanbanCard";
import AddCardForm from "./AddCardForm";

interface KanbanColumnProps {
    column: Column
}

export default function KanbanColumn({column}: KanbanColumnProps) {
    const cards = useKanbanStore(state => state.board.cards)
    const deleteColumn = useKanbanStore(state => state.deleteColumn)

    const {setNodeRef} = useDroppable({id: column.id})

    const columnCards = column.cardIds.map(id => cards[id]).filter(Boolean)

    return (
        <div className="bg-gray-100 rounded-xl p-3 w-72 shrink-0 flex flex-col gap-3">

            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-700 text-sm break-words">{column.title}</h2>
                    <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                        {columnCards.length}
                    </span>
                </div>
                <button onClick={() => deleteColumn(column.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                        aria-label="Delete column">
                    ×
                </button>
            </div>

            <div ref={setNodeRef} className="flex flex-col gap-2 min-h-20">
                <SortableContext
                    items={column.cardIds}
                    strategy={verticalListSortingStrategy}
                >
                    {columnCards.map(card => (
                        <KanbanCard key={card.id} card={card} columnId={column.id}/>
                    ))}
                </SortableContext>
            </div>

            <AddCardForm columnId={column.id}/>

        </div>
    )
}