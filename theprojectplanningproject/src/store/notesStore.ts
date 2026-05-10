import {create} from 'zustand'
import type {Note} from "../types/notes"

/**
 * The shape of the Notes store.
 * Handles:
 * - creating notes
 * - deleting notes
 * - updating title/content
 * - selecting notes
 * - persistence to localStorage
 */
interface NotesStore {
    notes: Record<string, Note>
    order: string[]              // note IDs in recency order
    selectedId: string | null    // currently opened note

    createNote: () => string
    deleteNote: (id: string) => void
    updateNoteTitle: (id: string, title: string) => void
    updateNoteContent: (id: string, content: unknown) => void
    selectNote: (id: string | null) => void
}

interface PersistedState {
    notes: Record<string, Note>
    order: string[]
    selectedId: string | null
}

const STORAGE_KEY = 'notes-store'

// Load notes from local storage
function loadState(): PersistedState {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (!saved) return {notes: {}, order: [], selectedId: null}
        return JSON.parse(saved)
    } catch {
        return {notes: {}, order: [], selectedId: null}
    }
}

// Save notes to local storage
function saveState(state: PersistedState) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
        console.warn('Failed to save notes to localStorage', e)
    }
}

// Generate a unique ID
function generateId(): string {
    return `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const initial = loadState()

/**
 * Zustand store for notes.
 * All mutations:
 * - create new objects (immutability)
 * - persist to localStorage
 * - return updated state
 */
export const useNotesStore = create<NotesStore>((set) => ({
    notes: initial.notes,
    order: initial.order,
    selectedId: initial.selectedId,

    // Create a new note
    createNote: () => {
        const id = generateId()
        const now = Date.now()

        const note: Note = {
            id,
            title: 'Untitled',
            content: null,
            createdAt: now,
            updatedAt: now,
        }

        set((state) => {
            const notes = {...state.notes, [id]: note}
            const order = [id, ...state.order]

            saveState({notes, order, selectedId: id})
            return {notes, order, selectedId: id}
        })

        return id
    },

    // Delete a note
    deleteNote: (id) => set((state) => {
        if (!state.notes[id]) return state

        const notes = {...state.notes}
        delete notes[id]

        const order = state.order.filter(noteId => noteId !== id)

        const selectedId =
            state.selectedId === id
                ? (order[0] ?? null)
                : state.selectedId

        saveState({notes, order, selectedId})
        return {notes, order, selectedId}
    }),

    // Update a notes title
    updateNoteTitle: (id, title) => set((state) => {
        const existing = state.notes[id]
        if (!existing) return state

        const notes = {
            ...state.notes,
            [id]: {...existing, title, updatedAt: Date.now()}
        }

        // Move this note to the top of the list
        const order = [id, ...state.order.filter(noteId => noteId !== id)]

        saveState({notes, order, selectedId: state.selectedId})
        return {notes, order}
    }),

    // Update a notes content
    updateNoteContent: (id, content) => set((state) => {
        const existing = state.notes[id]
        if (!existing) return state

        const notes = {
            ...state.notes,
            [id]: {...existing, content, updatedAt: Date.now()}
        }

        const order = [id, ...state.order.filter(noteId => noteId !== id)]

        saveState({notes, order, selectedId: state.selectedId})
        return {notes, order}
    }),

    // Select a note
    selectNote: (id) => set((state) => {
        saveState({notes: state.notes, order: state.order, selectedId: id})
        return {selectedId: id}
    }),
}))

// Returns note object
export function useSelectedNote(): Note | null {
    const selectedId = useNotesStore(s => s.selectedId)
    const notes = useNotesStore(s => s.notes)
    return selectedId ? notes[selectedId] ?? null : null
}
