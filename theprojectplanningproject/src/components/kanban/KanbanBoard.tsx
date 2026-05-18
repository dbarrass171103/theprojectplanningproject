// Root kanban board. Lays out columns horizontally and manages
// drag-and-drop plus the card-flash on arrival via a mention.

import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    closestCorners,
} from '@dnd-kit/core'
import type {DragEndEvent, DragOverEvent} from "@dnd-kit/core"
import {useEffect, useState} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {useKanbanStore} from '../../store/kanbanStore'
import KanbanColumn from './KanbanColumn'
import AddColumnButton from './AddColumnButton'

export default function KanbanBoard() {
    const columns = useKanbanStore(state => state.board.columns)
    const moveCard = useKanbanStore(state => state.moveCard)

    const location = useLocation()
    const navigate = useNavigate()

    const [flashedCardId, setFlashedCardId] = useState<string | null>(null)

    // Flash a card when arriving via a note mention. The flash card ID is
    // passed through router state; clear it from history so back/forward
    // doesn't re-flash.
    useEffect(() => {
        const stateCardId = (location.state as {flashCardId?: string} | null)?.flashCardId
        if (!stateCardId) return

        setFlashedCardId(stateCardId)
        navigate(location.pathname, {replace: true, state: null})

        const t = window.setTimeout(() => setFlashedCardId(null), 2000)
        return () => window.clearTimeout(t)
    }, [location.state])

    // 8px activation distance avoids treating a short click as a drag.
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {distance: 8},
        })
    )

    function findColumnOfCard(cardId: string): string | undefined {
        return columns.find(col => col.cardIds.includes(cardId))?.id
    }

    // Live preview while dragging.
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

        const overCardIndex = overColumn.cardIds.indexOf(overId)
        const toIndex = overCardIndex !== -1
            ? overCardIndex
            : overColumn.cardIds.length

        moveCard(activeColumnId, overColumnId, activeId, toIndex)
    }

    function handleDragEnd(event: DragEndEvent) {
        const {active, over} = event
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        if (activeId === overId) return

        const activeColumnId = findColumnOfCard(activeId)
        const overColumnId = findColumnOfCard(overId) ?? overId

        if (!activeColumnId || !overColumnId) return

        const overColumn = columns.find(col => col.id === overColumnId)
        if (!overColumn) return

        const overCardIndex = overColumn.cardIds.indexOf(overId)
        const toIndex = overCardIndex !== -1
            ? overCardIndex
            : overColumn.cardIds.length

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
                    <KanbanColumn
                        key={column.id}
                        column={column}
                        flashedCardId={flashedCardId}
                    />
                ))}

                <AddColumnButton/>
            </div>
        </DndContext>
    )
}
