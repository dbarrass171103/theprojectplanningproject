// Thin route wrapper around KanbanBoard.
//
// All state, drag-and-drop orchestration, and sync logic live in the board
// component itself and the kanbanStore. This page exists purely to give the
// router something to render at /p/:projectId (the index route).

import KanbanBoard from "../components/kanban/KanbanBoard.tsx";
export default function KanbanPage() {
    return <KanbanBoard/>
}
