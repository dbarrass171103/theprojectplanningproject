import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    closestCorners,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import {useKanbanStore} from '../../store/kanbanStore';
import KanbanColumn from './KanbanColumn';
import AddColumnButton from './AddColumnButton';

export default function KanbanBoard() {
    const columns = useKanbanStore(state => state.board.columns)
const moveCard = useKanbanStore(state => state.moveCard)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {distance: 8}
        })
    )

    function findColumnOfCard(cardId: string): string | undefined {
        return columns.find(col => col.cardIds.includes(cardId))?.id
    }

    function handleDragOver(event: DragOverEvent) {
        const {active, over} = event
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        const activeColumnId = findColumnOfCard(activeId)
        if (!activeColumnId) return

        const overColumnId = findColumnOfCard(overId) ?? overId

        if (activeColumnId === overColumnId) return

        const overColumn = columns.find(col => col.id === overColumnId)
        if (!overColumn) return

        const toIndex = overColumn.cardIds.length
        moveCard(activeColumnId, overColumnId, activeId, toIndex)
    }

    function handleDragEnd(event: DragEndEvent) {
        const {active, over} = event
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        const activeColumnId = findColumnOfCard(activeId)
        const overColumnId = findColumnOfCard(overId) ?? overId

        if (!activeColumnId || !overColumnId) return;

        const overColumn = columns.find(col => col.id === overColumnId)
        if (!overColumn) return;

        const toIndex = overColumn.cardIds.indexOf(overId) !== -1 ?
            overColumn.cardIds.indexOf(overId) : overColumn.cardIds.length

        moveCard(activeColumnId, overColumnId, activeId, toIndex)
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 items-start p-6 overflow-x-auto min-h-screen">
                {columns.map(column => (
                    <KanbanColumn key={column.id} column={column}/>
                ))}
                <AddColumnButton/>
            </div>
        </DndContext>
    )
}