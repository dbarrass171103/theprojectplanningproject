import KanbanBoard from '../components/kanban/KanbanBoard'

export default function KanbanPage() {
    return (
        <main className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200 px-6 py-4">
                <h1 className="text-lg font-semibold text-gray-800">My Board</h1>
            </header>
            <KanbanBoard/>
        </main>
    )
}