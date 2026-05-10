import {useState} from "react";
import {useKanbanStore} from "../../store/kanbanStore";

export default function AddColumnButton() {
    const addColumn = useKanbanStore(state => state.addColumn)

    // Whether the form is expanded or collapsed.
    const [isOpen, setIsOpen] = useState(false)
    // Controlled input for the column title.
    const [title, setTitle] = useState('')

    function handleSubmit() {
        // Prevent empty column names.
        if (!title.trim()) return

        // Add the column to the store.
        addColumn(title.trim())

        // Reset the form for next use.
        setTitle('')
        setIsOpen(false)
    }

    // Keyboard shortcuts.
    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') handleSubmit()
        if (e.key === 'Escape') setIsOpen(false)
    }

    // When the form is closed, show a "+ Add column" button.
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

    // When open, show the full input form.
    return (
        <div className="bg-gray-100 rounded-xl p-3 w-72 shrink-0 flex flex-col gap-2">
            {/* Title input */}
            <input
                autoFocus
                type="text"
                placeholder="Column title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-sm rounded-lg border border-gray-300 px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            {/* Action buttons */}
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
