import {useNotesStore} from "../../store/notesStore";

interface NotesSidebarProps {
    isOpen: boolean
    onToggle: () => void
}

// Sidebar listing all notes, allows adding, deleting,
export default function NotesSidebar({isOpen, onToggle}: NotesSidebarProps) {
    const order = useNotesStore(s => s.order)
    const notes = useNotesStore(s => s.notes)
    const selectedId = useNotesStore(s => s.selectedId)
    const createNote = useNotesStore(s => s.createNote)
    const selectNote = useNotesStore(s => s.selectNote)
    const deleteNote = useNotesStore(s => s.deleteNote)


    // Collapsed sidebar
    if (!isOpen) {
        return (
            <div className="border-r border-gray-200 bg-white w-10 shrink-0 flex flex-col items-center py-3">
                <button
                    onClick={onToggle}
                    className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded p-1.5 transition-colors"
                    aria-label="Open notes sidebar"
                    title="Open sidebar"
                >
                    ›
                </button>
            </div>
        )
    }

    // Expanded sidebar
    return (
        <aside className="border-r border-gray-200 bg-white w-64 shrink-0 flex flex-col">

            {/* Header: title and new note and collapse */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-700">Notes</h2>

                <div className="flex items-center gap-1">
                    {/* Create new note */}
                    <button
                        onClick={() => createNote()}
                        className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded p-1 transition-colors text-lg leading-none"
                        aria-label="New note"
                        title="New note"
                    >
                        +
                    </button>

                    {/* Collapse sidebar */}
                    <button
                        onClick={onToggle}
                        className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded p-1 transition-colors"
                        aria-label="Collapse sidebar"
                        title="Collapse"
                    >
                        ‹
                    </button>
                </div>
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto">
                {order.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-gray-400 text-center">
                        No notes yet. Click + to create one.
                    </div>
                ) : (
                    <ul className="py-1">
                        {order.map(id => {
                            const note = notes[id]
                            if (!note) return null

                            const isSelected = id === selectedId

                            return (
                                <li key={id}>
                                    <div
                                        className={`
                                            group flex items-center justify-between px-3 py-2 cursor-pointer
                                            transition-colors
                                            ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                                        `}
                                        onClick={() => selectNote(id)}
                                    >
                                        {/* Note title */}
                                        <span
                                            className={`
                                                text-sm truncate flex-1
                                                ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-700'}
                                            `}
                                        >
                                            {note.title || 'Untitled'}
                                        </span>

                                        {/* Delete button (only visible on hover) */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (confirm(`Delete "${note.title || 'Untitled'}"?`)) {
                                                    deleteNote(id)
                                                }
                                            }}
                                            className="
                                                opacity-0 group-hover:opacity-100
                                                text-gray-300 hover:text-red-400
                                                transition-all text-lg leading-none ml-2 shrink-0
                                            "
                                            aria-label="Delete note"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </aside>
    )
}
