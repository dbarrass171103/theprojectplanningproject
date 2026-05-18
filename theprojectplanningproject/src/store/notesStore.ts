// Notes store, backed by the project's board Y.Doc.
//
// Notes metadata (titles, order) lives in the same Y.Doc as the kanban board
// and is synced via the same SupabaseYjsProvider. The store mirrors Y.Doc
// state into plain JS (same pattern as kanbanStore) and is bound / unbound
// by BoardProvider in onSync / cleanup.
//
// Local UI state — selectedId — stays in localStorage because it is
// per-user, per-device, and should not sync to collaborators.
//
// On first bindToDoc, if the Y.Doc has no notes yet, the store reads the
// old "notes-store:${projectId}" localStorage key and imports all notes
// into the Y.Doc. This is a one-time, silent migration so existing
// projects don't lose their note list on upgrade.

import {create} from 'zustand'
import * as Y from 'yjs'
import type {Note} from '../types/notes'
import {
    addNote as ydocAddNote,
    removeNote as ydocRemoveNote,
    setNoteTitle as ydocSetNoteTitle,
    promoteNote,
    snapshotNotes,
    getNotesOrder,
} from '../utils/boardYdoc'

function selectedIdKey(projectId: string): string {
    return `notes-selected:${projectId}`
}

function loadSelectedId(projectId: string): string | null {
    try {
        return localStorage.getItem(selectedIdKey(projectId))
    } catch {
        return null
    }
}

function saveSelectedId(projectId: string, id: string | null): void {
    try {
        if (id === null) {
            localStorage.removeItem(selectedIdKey(projectId))
        } else {
            localStorage.setItem(selectedIdKey(projectId), id)
        }
    } catch {
        // ignore
    }
}

// Shape written by the old localStorage-based notesStore.
interface LegacyNotesState {
    notes: Record<string, Note>
    order: string[]
    selectedId: string | null
}

function loadLegacyState(projectId: string): LegacyNotesState | null {
    try {
        const raw = localStorage.getItem(`notes-store:${projectId}`)
        return raw ? (JSON.parse(raw) as LegacyNotesState) : null
    } catch {
        return null
    }
}

function generateId(): string {
    return `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// Held outside Zustand state to avoid spurious re-renders when the doc rebinds.
let currentDoc: Y.Doc | null = null
let observerCleanup: (() => void) | null = null

function requireDoc(): Y.Doc | null {
    if (!currentDoc) {
        console.warn('notesStore action called before doc was bound; ignoring')
        return null
    }
    return currentDoc
}

interface NotesStore {
    activeProjectId: string | null

    /** Y.Doc-mirrored state, refreshed by the observer on every doc change. */
    notes: Record<string, Note>
    order: string[]

    /** Local UI state — which note is open in the editor. */
    selectedId: string | null

    /**
     * Bind to the project's board Y.Doc. Sets up the observer that keeps
     * notes + order in sync, and migrates from localStorage if needed.
     * Called by BoardProvider in onSync, before synced flips to true.
     */
    bindToDoc: (projectId: string, doc: Y.Doc) => void
    unbind: () => void

    createNote: () => string
    deleteNote: (id: string) => void

    /**
     * Write the title to the Y.Doc and promote the note to the front of
     * the order. Called on blur of the title input in NoteEditor.
     */
    updateNoteTitle: (id: string, title: string) => void

    /**
     * Update the store's local title for a note WITHOUT writing to the
     * Y.Doc. Called per-keystroke from NoteEditor so the sidebar label
     * stays current while typing; the authoritative Y.Doc write happens
     * on blur via updateNoteTitle.
     */
    setActiveNoteTitle: (id: string, title: string) => void

    selectNote: (id: string | null) => void
}

export const useNotesStore = create<NotesStore>((set) => ({
    activeProjectId: null,
    notes: {},
    order: [],
    selectedId: null,

    bindToDoc: (projectId, doc) => {
        if (observerCleanup) {
            observerCleanup()
            observerCleanup = null
        }
        currentDoc = doc

        // One-time migration from the old localStorage-based store.
        if (getNotesOrder(doc).length === 0) {
            const legacy = loadLegacyState(projectId)
            if (legacy && legacy.order.length > 0) {
                doc.transact(() => {
                    // Reverse so that inserting at position 0 each time
                    // preserves the original order.
                    for (const id of [...legacy.order].reverse()) {
                        const note = legacy.notes[id]
                        if (note) {
                            ydocAddNote(doc, note.id, note.title, note.createdAt)
                        }
                    }
                })
            }
        }

        // Load selectedId, validating the note still exists.
        const snapshot = snapshotNotes(doc)
        const rawSelected = loadSelectedId(projectId)
        const selectedId = rawSelected && snapshot.notes[rawSelected] ? rawSelected : null

        set({
            activeProjectId: projectId,
            notes: snapshot.notes,
            order: snapshot.order,
            selectedId,
        })

        // Mirror Y.Doc changes into the store on every update. The board
        // Y.Doc fires for any field change (board OR notes), so this keeps
        // the sidebar in sync with remote edits too.
        const onUpdate = () => set(snapshotNotes(doc))
        doc.on('update', onUpdate)
        observerCleanup = () => doc.off('update', onUpdate)
    },

    unbind: () => {
        if (observerCleanup) {
            observerCleanup()
            observerCleanup = null
        }
        currentDoc = null
        set({activeProjectId: null, notes: {}, order: [], selectedId: null})
    },

    createNote: () => {
        const doc = requireDoc()
        if (!doc) return ''

        const id = generateId()
        ydocAddNote(doc, id, 'Untitled', Date.now())
        // The observer above will refresh notes + order from the Y.Doc.

        set(state => {
            if (state.activeProjectId) saveSelectedId(state.activeProjectId, id)
            return {selectedId: id}
        })

        return id
    },

    deleteNote: (id) => {
        const doc = requireDoc()
        if (!doc) return

        ydocRemoveNote(doc, id)

        // The Y.Doc 'update' event fires synchronously, so by the time
        // this set() runs, state.order is the post-deletion array.
        set(state => {
            if (state.selectedId !== id) return {}
            const next = state.order[0] ?? null
            if (state.activeProjectId) saveSelectedId(state.activeProjectId, next)
            return {selectedId: next}
        })
    },

    updateNoteTitle: (id, title) => {
        const doc = requireDoc()
        if (!doc) return
        ydocSetNoteTitle(doc, id, title)
        promoteNote(doc, id)
    },

    setActiveNoteTitle: (id, title) => {
        // Local-only update so the sidebar title stays current while
        // typing. When the observer next fires (after the blur write),
        // it will re-snapshot the same value, so there's no flicker.
        set(state => {
            const existing = state.notes[id]
            if (!existing || existing.title === title) return {}
            return {
                notes: {
                    ...state.notes,
                    [id]: {...existing, title, updatedAt: Date.now()},
                },
            }
        })
    },

    selectNote: (id) =>
        set(state => {
            if (state.activeProjectId) saveSelectedId(state.activeProjectId, id)
            return {selectedId: id}
        }),
}))

export function useSelectedNote(): Note | null {
    const selectedId = useNotesStore(s => s.selectedId)
    const notes = useNotesStore(s => s.notes)
    return selectedId ? (notes[selectedId] ?? null) : null
}
