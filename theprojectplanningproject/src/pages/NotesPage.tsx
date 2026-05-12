// Notes page — a two-panel layout: collapsible sidebar on the left, editor
// (or empty state) on the right.
//
// The sidebar manages selection and creation. The editor is keyed on
// selectedNote.id so React unmounts and remounts it when the user switches
// notes, which resets all editor state cleanly without manual teardown.
//
// Empty state logic distinguishes between "no notes exist at all" and
// "notes exist but none is selected" so the copy and CTA stay relevant.

import {useState} from 'react'
import {useNotesStore, useSelectedNote} from '../store/notesStore'
import NotesSidebar from "../components/notes/NotesSidebar.tsx";
import NoteEditor from "../components/notes/NoteEditor.tsx";
export default function NotesPage() {
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const selectedNote = useSelectedNote()
    const createNote = useNotesStore(s => s.createNote)
    const hasAnyNotes = useNotesStore(s => s.order.length > 0)

    return (
        <div className="flex h-[calc(100vh-57px)]">
            <NotesSidebar
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(o => !o)}
            />

            <div className="flex-1 overflow-hidden bg-white">
                {selectedNote ? (
                    // Key on note ID so the editor fully remounts on note change —
                    // simpler and safer than trying to reset Tiptap/Yjs state in place.
                    <NoteEditor key={selectedNote.id} note={selectedNote}/>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                        <div className="text-5xl mb-4 opacity-40">📝</div>

                        <h2 className="text-xl font-semibold text-gray-700 mb-2">
                            {hasAnyNotes ? 'No note selected' : 'No notes yet'}
                        </h2>

                        <p className="text-sm text-gray-500 mb-6 max-w-md">
                            {hasAnyNotes
                                ? 'Pick a note from the sidebar, or create a new one.'
                                : 'Create your first note to get started.'}
                        </p>

                        <button
                            onClick={() => createNote()}
                            className="bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg px-4 py-2 transition-colors"
                        >
                            + New note
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
