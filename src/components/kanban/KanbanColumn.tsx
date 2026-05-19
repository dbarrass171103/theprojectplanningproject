// Single kanban column: header, sortable card list, add-card form.

import {useState} from 'react'
import {SortableContext, verticalListSortingStrategy} from "@dnd-kit/sortable"
import {useDroppable} from "@dnd-kit/core"
import type {Column} from "../../types/kanban"
import {useKanbanStore} from "../../store/kanbanStore"
import KanbanCard from "./KanbanCard"
import AddCardForm from "./AddCardForm"
import EditColumnModal from "./EditColumnModal"

interface KanbanColumnProps {
    column: Column
    flashedCardId?: string | null
}

export default function KanbanColumn({column, flashedCardId}: KanbanColumnProps) {
    const cards = useKanbanStore(state => state.board.cards)
    const deleteColumn = useKanbanStore(state => state.deleteColumn)
    const [editOpen, setEditOpen] = useState(false)

    const {setNodeRef} = useDroppable({id: column.id})

    const columnCards = column.cardIds.map(id => cards[id]).filter(Boolean)

    return (
        <>
            <div
                className="rounded-xl p-3 w-72 shrink-0 flex flex-col gap-3"
                style={{backgroundColor: column.columnColor ?? '#f3f4f6'}}
            >
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        {column.color && (
                            <span
                                className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                                style={{backgroundColor: column.color}}
                            />
                        )}

                        <h2 className="font-semibold text-gray-700 text-sm break-words">
                            {column.title}
                        </h2>

                        <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                            {columnCards.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setEditOpen(true)}
                            className="text-gray-300 hover:text-gray-500 transition-colors text-sm leading-none"
                            aria-label="Edit column"
                            title="Edit column"
                        >
                            ✎
                        </button>

                        <button
                            onClick={() => deleteColumn(column.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                            aria-label="Delete column"
                        >
                            ×
                        </button>
                    </div>
                </div>

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
                                columnColor={column.color}
                            />
                        ))}
                    </SortableContext>
                </div>

                <AddCardForm columnId={column.id} columnColor={column.color}/>
            </div>

            {editOpen && (
                <EditColumnModal
                    column={column}
                    onClose={() => setEditOpen(false)}
                />
            )}
        </>
    )
}