// Root component of the kanban view. Renders columns horizontally with the
// "+ Add column" button on the right.
//
// Two responsibilities beyond rendering:
//
//   1. Drag-and-drop coordination via @dnd-kit. The board owns the
//      DndContext; individual columns and cards register as droppable/sortable
//      via their own hooks. We handle both onDragOver (live preview as you
//      drag between columns) and onDragEnd (commit the final position).
//
//   2. Card flashing. When the user clicks a card-mention chip in a note or
//      card description, we navigate here with `{state: {flashCardId}}`. The
//      board picks that up, scrolls the card into view, and applies a
//      temporary glow class for ~2 seconds. After flashing once we strip
//      the state from history so a back/forward navigation doesn't re-flash.

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
    // Cards in this state get the temporary highlight class.
    const [flashedCardId, setFlashedCardId] = useState<string | null>(null)

    // Handle the flash-on-arrival behaviour. Cleared via setTimeout so the
    // glow fades and doesn't persist if the user navigates away mid-flash.
    useEffect(() => {
        const stateCardId = (location.state as {flashCardId?: string} | null)?.flashCardId
        if (!stateCardId) return

        setFlashedCardId(stateCardId)

        // Strip the navigation state immediately so a refresh or back nav
        // doesn't re-trigger the flash.
        navigate(location.pathname, {replace: true, state: null})

        const t = window.setTimeout(() => setFlashedCardId(null), 2000)
        return () => window.clearTimeout(t)
    }, [location.state])

    // 8px activation distance avoids accidental drags when clicking edit/delete
    // buttons on a card — short clicks won't be interpreted as drags.
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {distance: 8},
        })
    )

    // Helper used by both drag handlers — locate which column currently owns
    // a given card by id.
    function findColumnOfCard(cardId: string): string | undefined {
        return columns.find(col => col.cardIds.includes(cardId))?.id
    }

    // Fires continuously while dragging. Used to preview the drop position
    // by moving the card live as the cursor crosses columns/cards.
    function handleDragOver(event: DragOverEvent) {
        const {active, over} = event
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        const activeColumnId = findColumnOfCard(activeId)
        if (!activeColumnId) return

        // `overId` is either a card id (hovering over another card) or a column
        // id (hovering over the empty area of a column). Resolve to a column.
        const overColumnId = findColumnOfCard(overId) ?? overId
        if (activeColumnId === overColumnId) return

        const overColumn = columns.find(col => col.id === overColumnId)
        if (!overColumn) return

        // If hovering over a specific card, insert before it; otherwise append.
        const overCardIndex = overColumn.cardIds.indexOf(overId)
        const toIndex = overCardIndex !== -1
            ? overCardIndex
            : overColumn.cardIds.length

        moveCard(activeColumnId, overColumnId, activeId, toIndex)
    }

    // Fires once when the user releases. Confirms the final drop position.
    // Same logic as handleDragOver but also handles within-column reorders.
    function handleDragEnd(event: DragEndEvent) {
        const {active, over} = event
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        // No-op when a card is dropped on itself.
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
            // closestCorners picks the drop target whose corners are nearest
            // to the dragged card. Works well for horizontal kanban layouts
            // where cards stack vertically within columns.
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