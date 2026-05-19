// Inline form for adding a new column. Collapsed shows a "+ Add column"
// button; expanded shows a title input plus Add/Cancel.

import {useState} from "react";
import {useKanbanStore} from "../../store/kanbanStore";

export default function AddColumnButton() {
    const addColumn = useKanbanStore(state => state.addColumn)

    const [isOpen, setIsOpen] = useState(false)
    const [title, setTitle] = useState('')

    function handleSubmit() {
        if (!title.trim()) return
        addColumn(title.trim())
        setTitle('')
        setIsOpen(false)
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') handleSubmit()
        if (e.key === 'Escape') setIsOpen(false)
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 rounded-xl px-4 py-3 text-sm font-medium transition-colors w-72 shrink-0 text-left"
            >
                + Add column
            </button>
        )
    }

    return (
        <div className="bg-gray-100 rounded-xl p-3 w-72 shrink-0 flex flex-col gap-2">
            <input
                autoFocus
                type="text"
                placeholder="Column title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-sm rounded-lg border border-gray-300 px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            <div className="flex gap-2">
                <button
                    onClick={handleSubmit}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg px-3 py-1.5 transition-colors"
                >
                    Add
                </button>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600 text-sm rounded-lg px-3 py-1.5 transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}
