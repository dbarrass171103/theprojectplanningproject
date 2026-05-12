import {create} from 'zustand'
import type {Note} from "../types/notes";

interface NotesStore {
    activeProjectId: string | null
    notes: Record<string, Note>
    order: string[]
    selectedId: string | null

    loadForProject: (projectId: string) => void
    clearActiveProject: () => void

    createNote: () => string
    deleteNote: (id: string) => void
    updateNoteTitle: (id: string, title: string) => void
    selectNote: (id: string | null) => void
    // Called by the Yjs editor on every title change for the active note.
    // Doesn't bump updatedAt because Yjs awareness updates fire constantly;
    // we'd flood project_data sync. Title metadata catches up via the
    // periodic snapshot save.
    setActiveNoteTitle: (id: string, title: string) => void
}

interface PersistedState {
    notes: Record<string, Note>
    order: string[]
    selectedId: string | null
}

const EMPTY_STATE: PersistedState = {notes: {}, order: [], selectedId: null}

function storageKey(projectId: string): string {
    return `notes-store:${projectId}`
}

function loadState(projectId: string): PersistedState {
    try {
        const saved = localStorage.getItem(storageKey(projectId))
        if (!saved) return EMPTY_STATE
        return JSON.parse(saved)
    } catch {
        return EMPTY_STATE
    }
}

function saveState(projectId: string, state: PersistedState) {
    try {
        localStorage.setItem(storageKey(projectId), JSON.stringify(state))
    } catch (e) {
        console.warn('Failed to save notes store', e)
    }
}

function persistIfActive(
    activeProjectId: string | null,
    expectedProjectId: string,
    state: PersistedState,
) {
    if (activeProjectId !== expectedProjectId) return
    saveState(expectedProjectId, state)
}

function generateId(): string {
    return `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const useNotesStore = create<NotesStore>((set) => ({
    activeProjectId: null,
    notes: {},
    order: [],
    selectedId: null,

    loadForProject: (projectId) => set(() => {
        const loaded = loadState(projectId)
        return {
            activeProjectId: projectId,
            notes: loaded.notes,
            order: loaded.order,
            selectedId: loaded.selectedId,
        }
    }),

    clearActiveProject: () => set(() => ({
        activeProjectId: null,
        notes: {},
        order: [],
        selectedId: null,
    })),

    createNote: () => {
        const id = generateId()
        const now = Date.now()
        const note: Note = {
            id,
            title: 'Untitled',
            createdAt: now,
            updatedAt: now,
        }
        set((state) => {
            if (!state.activeProjectId) {
                console.warn('createNote called with no active project')
                return state
            }
            const notes = {...state.notes, [id]: note}
            const order = [id, ...state.order]
            persistIfActive(state.activeProjectId, state.activeProjectId,
                {notes, order, selectedId: id})
            return {notes, order, selectedId: id}
        })
        return id
    },

    deleteNote: (id) => set((state) => {
        if (!state.activeProjectId) return state
        if (!state.notes[id]) return state
        const notes = {...state.notes}
        delete notes[id]
        const order = state.order.filter(noteId => noteId !== id)
        const selectedId = state.selectedId === id
            ? (order[0] ?? null)
            : state.selectedId
        persistIfActive(state.activeProjectId, state.activeProjectId,
            {notes, order, selectedId})
        return {notes, order, selectedId}
    }),

    updateNoteTitle: (id, title) => set((state) => {
        if (!state.activeProjectId) return state
        const existing = state.notes[id]
        if (!existing) return state
        const notes = {
            ...state.notes,
            [id]: {...existing, title, updatedAt: Date.now()},
        }
        const order = [id, ...state.order.filter(noteId => noteId !== id)]
        persistIfActive(state.activeProjectId, state.activeProjectId,
            {notes, order, selectedId: state.selectedId})
        return {notes, order}
    }),

    setActiveNoteTitle: (id, title) => set((state) => {
        if (!state.activeProjectId) return state
        const existing = state.notes[id]
        if (!existing) return state
        if (existing.title === title) return state
        const notes = {
            ...state.notes,
            [id]: {...existing, title, updatedAt: Date.now()},
        }
        // Don't reorder on every keystroke — too noisy. Order updates happen
        // when the note is initially selected/created or via explicit title
        // edit (updateNoteTitle).
        persistIfActive(state.activeProjectId, state.activeProjectId,
            {notes, order: state.order, selectedId: state.selectedId})
        return {notes}
    }),

    selectNote: (id) => set((state) => {
        if (!state.activeProjectId) return state
        persistIfActive(state.activeProjectId, state.activeProjectId,
            {notes: state.notes, order: state.order, selectedId: id})
        return {selectedId: id}
    }),
}))

export function useSelectedNote(): Note | null {
    const selectedId = useNotesStore(s => s.selectedId)
    const notes = useNotesStore(s => s.notes)
    return selectedId ? notes[selectedId] ?? null : null
}