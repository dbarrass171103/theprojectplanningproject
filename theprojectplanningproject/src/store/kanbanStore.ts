// Kanban store, a view layer over the project's board Y.Doc.
//
// The Y.Doc itself is owned by BoardProvider. On connect, BoardProvider
// calls bindToDoc() to wire the store to the live Y.Doc:
//   - Reads: the store mirrors the Y.Doc into a plain `board` object that
//     React reads via selectors. The mirror regenerates on every 'update'.
//   - Writes: mutation actions call boardYdoc helpers that run Y.Doc
//     transactions.
//   - Doc access: getBoardDoc() exposes the underlying Y.Doc to components
//     that need it directly (e.g. CardDescriptionEditor wiring up
//     CollaborationCaret awareness).

import {create} from 'zustand'
import * as Y from 'yjs'
import type {Schema} from 'prosemirror-model'
import type {Board} from '../types/kanban'
import {
    snapshotBoard,
    addColumn as ydocAddColumn,
    deleteColumn as ydocDeleteColumn,
    addCard as ydocAddCard,
    addCardWithDescriptionJSON,
    deleteCard as ydocDeleteCard,
    moveCard as ydocMoveCard,
    renameColumn as ydocRenameColumn,
    renameCard as ydocRenameCard,
    getCardDescriptionById,
} from '../utils/boardYdoc'

interface KanbanStore {
    activeProjectId: string | null
    board: Board

    bindToDoc: (projectId: string, doc: Y.Doc) => void
    unbind: () => void

    addColumn: (title: string) => void
    deleteColumn: (columnId: string) => void

    addCard: (columnId: string, title: string) => void
    addCardWithDescription: (
        columnId: string,
        title: string,
        descriptionJson: unknown | null,
    ) => void

    deleteCard: (columnId: string, cardId: string) => void
    moveCard: (fromColumnId: string, toColumnId: string, cardId: string, toIndex: number) => void
    renameColumn: (columnId: string, title: string) => void
    updateCard: (cardId: string, updates: {title?: string}) => void

    getCardDescriptionFragment: (cardId: string) => Y.XmlFragment | null
    getBoardDoc: () => Y.Doc | null

    setProseSchema: (schema: Schema) => void
}

const EMPTY_BOARD: Board = {columns: [], cards: {}}

// Held outside Zustand state to avoid spurious re-renders when the doc rebinds.
let currentDoc: Y.Doc | null = null
let observerCleanup: (() => void) | null = null
let proseSchema: Schema | null = null

function generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function requireDoc(): Y.Doc | null {
    if (!currentDoc) {
        console.warn('Kanban action called before board doc was bound; ignoring')
        return null
    }
    return currentDoc
}

export const useKanbanStore = create<KanbanStore>((set) => ({
    activeProjectId: null,
    board: EMPTY_BOARD,

    bindToDoc: (projectId, doc) => {
        if (observerCleanup) {
            observerCleanup()
            observerCleanup = null
        }
        currentDoc = doc

        set({activeProjectId: projectId, board: snapshotBoard(doc)})

        const onUpdate = () => {
            set({board: snapshotBoard(doc)})
        }
        doc.on('update', onUpdate)
        observerCleanup = () => doc.off('update', onUpdate)
    },

    unbind: () => {
        if (observerCleanup) {
            observerCleanup()
            observerCleanup = null
        }
        currentDoc = null
        proseSchema = null
        set({activeProjectId: null, board: EMPTY_BOARD})
    },

    addColumn: (title) => {
        const doc = requireDoc()
        if (!doc) return
        ydocAddColumn(doc, generateId('col'), title)
    },

    deleteColumn: (columnId) => {
        const doc = requireDoc()
        if (!doc) return
        ydocDeleteColumn(doc, columnId)
    },

    addCard: (columnId, title) => {
        const doc = requireDoc()
        if (!doc) return
        ydocAddCard(doc, columnId, generateId('card'), title)
    },

    addCardWithDescription: (columnId, title, descriptionJson) => {
        const doc = requireDoc()
        if (!doc) return

        if (!descriptionJson || !proseSchema) {
            ydocAddCard(doc, columnId, generateId('card'), title)
            return
        }

        addCardWithDescriptionJSON(
            doc,
            columnId,
            generateId('card'),
            title,
            descriptionJson,
            proseSchema,
        )
    },

    deleteCard: (columnId, cardId) => {
        const doc = requireDoc()
        if (!doc) return
        ydocDeleteCard(doc, columnId, cardId)
    },

    moveCard: (fromColumnId, toColumnId, cardId, toIndex) => {
        const doc = requireDoc()
        if (!doc) return
        ydocMoveCard(doc, fromColumnId, toColumnId, cardId, toIndex)
    },

    renameColumn: (columnId, title) => {
        const doc = requireDoc()
        if (!doc) return
        ydocRenameColumn(doc, columnId, title)
    },

    updateCard: (cardId, updates) => {
        const doc = requireDoc()
        if (!doc) return
        if (updates.title !== undefined) {
            ydocRenameCard(doc, cardId, updates.title)
        }
    },

    getCardDescriptionFragment: (cardId) => {
        if (!currentDoc) return null
        return getCardDescriptionById(currentDoc, cardId)
    },

    getBoardDoc: () => currentDoc,

    setProseSchema: (schema) => {
        proseSchema = schema
    },
}))
