// Sidebar for the notes page — lists all notes in the current project and
// lets the user select, create, or delete them.
//
// Collapsible. When collapsed, shrinks to a 40px-wide strip with just an
// expand chevron. When expanded, shows the full list with new-note button
// and per-note delete button (only visible on row hover).
//
// The list order comes from `notesStore.order` which is maintained by the
// store (recent-first, bumping on title or content updates). We render in
// that order directly — no sorting here.

import {useNotesStore} from "../../store/notesStore";

interface NotesSidebarProps {
    isOpen: boolean
    onToggle: () => void
}

export default function NotesSidebar({isOpen, onToggle}: NotesSidebarProps) {
    const order = useNotesStore(s => s.order)
    const notes = useNotesStore(s => s.notes)
    const selectedId = useNotesStore(s => s.selectedId)
    const createNote = useNotesStore(s => s.createNote)
    const selectNote = useNotesStore(s => s.selectNote)
    const deleteNote = useNotesStore(s => s.deleteNote)

    // Collapsed state — just an expand button.
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

    // Expanded state.
    return (
        <aside className="border-r border-gray-200 bg-white w-64 shrink-0 flex flex-col">

            {/* Header: title + add + collapse */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-700">Notes</h2>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => createNote()}
                        className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded p-1 transition-colors text-lg leading-none"
                        aria-label="New note"
                        title="New note"
                    >
                        +
                    </button>

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

            {/* List body */}
            <div className="flex-1 overflow-y-auto">
                {order.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-gray-400 text-center">
                        No notes yet. Click + to create one.
                    </div>
                ) : (
                    <ul className="py-1">
                        {order.map(id => {
                            const note = notes[id]
                            // Guard against transient ordering/notes mismatches —
                            // can happen briefly during a sync update.
                            if (!note) return null

                            const isSelected = id === selectedId

                            return (
                                <li key={id}>
                                    <div
                                        // `group` enables the hover-reveal pattern on the
                                        // delete button below.
                                        className={`
                                            group flex items-center justify-between px-3 py-2 cursor-pointer
                                            transition-colors
                                            ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                                        `}
                                        onClick={() => selectNote(id)}
                                    >
                                        <span
                                            className={`
                                                text-sm truncate flex-1
                                                ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-700'}
                                            `}
                                        >
                                            {note.title || 'Untitled'}
                                        </span>

                                        {/* Delete button — hidden by default, fades in on
                                            row hover via the `group-hover` opacity trick. */}
                                        <button
                                            onClick={(e) => {
                                                // Stop the row's onClick from firing
                                                // (which would select the note we're deleting).
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