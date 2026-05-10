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

// Handles rendering, drag and drop, highlighting cards when coming from other page.
export default function KanbanBoard() {
    const columns = useKanbanStore(state => state.board.columns)

    // Action to move a card between columns or within a column.
    const moveCard = useKanbanStore(state => state.moveCard)
    // Router utilities for reading navigation state and updating the URL.
    const location = useLocation()
    const navigate = useNavigate()
    // Used to temporarily highlight a card.
    const [flashedCardId, setFlashedCardId] = useState<string | null>(null)

    // Flash a card
    useEffect(() => {
        const stateCardId = (location.state as {flashCardId?: string} | null)?.flashCardId
        if (!stateCardId) return

        // Trigger the flash.
        setFlashedCardId(stateCardId)

        // Remove the state from the URL so refreshing doesn't re-flash.
        navigate(location.pathname, {replace: true, state: null})

        // Clear the flash after 2 seconds.
        const t = window.setTimeout(() => setFlashedCardId(null), 2000)
        return () => window.clearTimeout(t)
    }, [location.state])


    // Configure dragging sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {distance: 8},
        })
    )

    function findColumnOfCard(cardId: string): string | undefined {
        return columns.find(col => col.cardIds.includes(cardId))?.id
    }

    // Used to move cards between columns, fires constantly
    function handleDragOver(event: DragOverEvent) {
        const {active, over} = event
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        const activeColumnId = findColumnOfCard(activeId)
        if (!activeColumnId) return

        // If `overId` is a column, use that. Otherwise it's a card.
        const overColumnId = findColumnOfCard(overId) ?? overId
        if (activeColumnId === overColumnId) return

        const overColumn = columns.find(col => col.id === overColumnId)
        if (!overColumn) return

        // Determine where in the target column to insert the card.
        const overCardIndex = overColumn.cardIds.indexOf(overId)
        const toIndex = overCardIndex !== -1
            ? overCardIndex
            : overColumn.cardIds.length

        moveCard(activeColumnId, overColumnId, activeId, toIndex)
    }

    // Used when the user lets go of the card to confirm its position
    function handleDragEnd(event: DragEndEvent) {
        const {active, over} = event
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        // If dropped on itself, nothing to do.
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
            collisionDetection={closestCorners} // Determines how drop targets are chosen.
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

                {/* Button to add new columns */}
                <AddColumnButton/>
            </div>
        </DndContext>
    )
}
