// Route wrapper around KanbanBoard. All state, drag-and-drop orchestration,
// and sync logic live in the board component and the kanbanStore; this page
// exists purely to give the router something to render at /p/:projectId.

import KanbanBoard from "../components/kanban/KanbanBoard.tsx";
export default function KanbanPage() {
    return <KanbanBoard/>
}
