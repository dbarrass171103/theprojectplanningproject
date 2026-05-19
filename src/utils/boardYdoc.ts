// Y.Doc schema and helpers for the Kanban board.
//
// This module defines the canonical structure of the board inside a Y.Doc,
// and provides all mutation helpers used by the Kanban store.
//
// Schema:
//   columns:      Y.Map<columnId, Y.Map>
//                   Each column-map contains:
//                     title:   Y.Text
//                     cardIds: Y.Array<string>
//
//   cards:        Y.Map<cardId, Y.Map>
//                   Each card-map contains:
//                     title:       Y.Text
//                     description: Y.XmlFragment (Tiptap-compatible)
//                     createdAt:   number
//
//   columnOrder:  Y.Array<string>
//
// All mutations are wrapped in Y.Doc transactions so updates are atomic
// and sync correctly across clients.

import * as Y from 'yjs'
import {prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON} from 'y-prosemirror'
import type {JSONContent} from '@tiptap/core'
import {Schema} from 'prosemirror-model'
import type {Board, Card, Column} from '../types/kanban'
import type {Note} from '../types/notes'

// ---------------------------------------------------------
// Top-level Y.Doc accessors
// ---------------------------------------------------------

/** Returns the Y.Map containing all columns. */
export function getColumnsMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
    return doc.getMap('columns') as Y.Map<Y.Map<unknown>>
}

/** Returns the Y.Map containing all cards. */
export function getCardsMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
    return doc.getMap('cards') as Y.Map<Y.Map<unknown>>
}

/** Returns the ordered list of column IDs. */
export function getColumnOrder(doc: Y.Doc): Y.Array<string> {
    return doc.getArray<string>('columnOrder')
}

// ---------------------------------------------------------
// Column field helpers
// ---------------------------------------------------------

/** Ensures a column has a Y.Text title and returns it. */
function getColumnTitle(colMap: Y.Map<unknown>): Y.Text {
    let t = colMap.get('title') as Y.Text | undefined
    if (!t) {
        t = new Y.Text()
        colMap.set('title', t)
    }
    return t
}

/** Ensures a column has a Y.Array of card IDs and returns it. */
function getColumnCardIds(colMap: Y.Map<unknown>): Y.Array<string> {
    let a = colMap.get('cardIds') as Y.Array<string> | undefined
    if (!a) {
        a = new Y.Array<string>()
        colMap.set('cardIds', a)
    }
    return a
}

// ---------------------------------------------------------
// Card field helpers
// ---------------------------------------------------------

/** Ensures a card has a Y.Text title and returns it. */
function getCardTitle(cardMap: Y.Map<unknown>): Y.Text {
    let t = cardMap.get('title') as Y.Text | undefined
    if (!t) {
        t = new Y.Text()
        cardMap.set('title', t)
    }
    return t
}

/** Ensures a card has a Y.XmlFragment description and returns it. */
export function getCardDescription(cardMap: Y.Map<unknown>): Y.XmlFragment {
    let f = cardMap.get('description') as Y.XmlFragment | undefined
    if (!f) {
        f = new Y.XmlFragment()
        cardMap.set('description', f)
    }
    return f
}

/** Returns the description fragment for a card by ID, or null if missing. */
export function getCardDescriptionById(doc: Y.Doc, cardId: string): Y.XmlFragment | null {
    const card = getCardsMap(doc).get(cardId)
    if (!card) return null
    return getCardDescription(card)
}

// ---------------------------------------------------------
// Mutations — Columns
// ---------------------------------------------------------

/** Creates a new column with the given ID and title. */
export function addColumn(doc: Y.Doc, id: string, title: string): void {
    doc.transact(() => {
        const colMap = new Y.Map<unknown>()
        const t = new Y.Text()
        t.insert(0, title)

        colMap.set('title', t)
        colMap.set('cardIds', new Y.Array<string>())

        getColumnsMap(doc).set(id, colMap)
        getColumnOrder(doc).push([id])
    })
}

/** Deletes a column and all cards inside it. */
export function deleteColumn(doc: Y.Doc, columnId: string): void {
    doc.transact(() => {
        const colMap = getColumnsMap(doc).get(columnId)
        if (!colMap) return

        // Delete all cards in the column
        const cardIds = colMap.get('cardIds') as Y.Array<string> | undefined
        if (cardIds) {
            const cards = getCardsMap(doc)
            for (const cid of cardIds.toArray()) {
                cards.delete(cid)
            }
        }

        // Remove column
        getColumnsMap(doc).delete(columnId)

        // Remove from order
        const order = getColumnOrder(doc)
        const idx = order.toArray().indexOf(columnId)
        if (idx !== -1) order.delete(idx, 1)
    })
}

/** Renames a column. */
export function renameColumn(doc: Y.Doc, columnId: string, newTitle: string): void {
    doc.transact(() => {
        const colMap = getColumnsMap(doc).get(columnId)
        if (!colMap) return

        const t = getColumnTitle(colMap)
        t.delete(0, t.length)
        t.insert(0, newTitle)
    })
}

/** Sets colour of kanban column */
export function setColumnColor(
    doc: Y.Doc,
    columnId: string,
    cardColor: string | null,
    columnColor: string | null,
): void {
    doc.transact(() => {
        const colMap = getColumnsMap(doc).get(columnId)
        if (!colMap) return

        if (cardColor === null) {
            colMap.delete('color')
        } else {
            colMap.set('color', cardColor)
        }

        if (columnColor === null) {
            colMap.delete('columnColor')
        } else {
            colMap.set('columnColor', columnColor)
        }
    })
}

// ---------------------------------------------------------
// Mutations — Cards
// ---------------------------------------------------------

/** Adds a card with a title and empty description. */
export function addCard(
    doc: Y.Doc,
    columnId: string,
    cardId: string,
    title: string,
): void {
    doc.transact(() => {
        const colMap = getColumnsMap(doc).get(columnId)
        if (!colMap) return

        const cardMap = new Y.Map<unknown>()
        const titleText = new Y.Text()
        titleText.insert(0, title)

        cardMap.set('title', titleText)
        cardMap.set('description', new Y.XmlFragment())
        cardMap.set('createdAt', Date.now())

        getCardsMap(doc).set(cardId, cardMap)
        getColumnCardIds(colMap).push([cardId])
    })
}

/**
 * Adds a card and seeds its description from Tiptap JSON.
 * Used when importing or creating cards with pre-existing content.
 */
export function addCardWithDescriptionJSON(
    doc: Y.Doc,
    columnId: string,
    cardId: string,
    title: string,
    descriptionJson: unknown,
    schema: Schema,
): void {
    doc.transact(() => {
        const colMap = getColumnsMap(doc).get(columnId)
        if (!colMap) return

        // Build card skeleton
        const cardMap = new Y.Map<unknown>()
        const titleText = new Y.Text()
        titleText.insert(0, title)

        const descFrag = new Y.XmlFragment()

        cardMap.set('title', titleText)
        cardMap.set('description', descFrag)
        cardMap.set('createdAt', Date.now())

        // Attach card to doc
        getCardsMap(doc).set(cardId, cardMap)

        // Populate description
        try {
            prosemirrorJSONToYXmlFragment(schema, descriptionJson, descFrag)
        } catch (e) {
            console.warn('Failed to seed card description from JSON', e)
        }

        // Add to column
        getColumnCardIds(colMap).push([cardId])
    })
}

/** Deletes a card from a column. */
export function deleteCard(doc: Y.Doc, columnId: string, cardId: string): void {
    doc.transact(() => {
        const colMap = getColumnsMap(doc).get(columnId)
        if (colMap) {
            const ids = getColumnCardIds(colMap)
            const idx = ids.toArray().indexOf(cardId)
            if (idx !== -1) ids.delete(idx, 1)
        }
        getCardsMap(doc).delete(cardId)
    })
}

/** Moves a card between columns or within the same column. */
export function moveCard(
    doc: Y.Doc,
    fromColumnId: string,
    toColumnId: string,
    cardId: string,
    toIndex: number,
): void {
    doc.transact(() => {
        const fromCol = getColumnsMap(doc).get(fromColumnId)
        const toCol = getColumnsMap(doc).get(toColumnId)
        if (!fromCol || !toCol) return

        const fromIds = getColumnCardIds(fromCol)
        const toIds = getColumnCardIds(toCol)

        const fromIndex = fromIds.toArray().indexOf(cardId)
        if (fromIndex === -1) return

        // Adjust index when moving downward inside same column
        let normalisedIndex = toIndex
        if (fromColumnId === toColumnId && toIndex > fromIndex) {
            normalisedIndex = toIndex - 1
        }

        fromIds.delete(fromIndex, 1)
        const clamped = Math.max(0, Math.min(normalisedIndex, toIds.length))
        toIds.insert(clamped, [cardId])
    })
}

/** Renames a card. */
export function renameCard(doc: Y.Doc, cardId: string, newTitle: string): void {
    doc.transact(() => {
        const cardMap = getCardsMap(doc).get(cardId)
        if (!cardMap) return

        const t = getCardTitle(cardMap)
        t.delete(0, t.length)
        t.insert(0, newTitle)
    })
}

// ---------------------------------------------------------
// Snapshot — used by the Kanban store to mirror the Y.Doc
// ---------------------------------------------------------

/** Creates a plain JS snapshot of the entire board. */
export function snapshotBoard(doc: Y.Doc): Board {
    const columnsMap = getColumnsMap(doc)
    const cardsMap = getCardsMap(doc)
    const order = getColumnOrder(doc)

    const columns: Column[] = []
    for (const colId of order.toArray()) {
        const colMap = columnsMap.get(colId)
        if (!colMap) continue

        columns.push({
            id: colId,
            title: (colMap.get('title') as Y.Text)?.toString() ?? '',
            cardIds: (colMap.get('cardIds') as Y.Array<string>)?.toArray() ?? [],
            color: (colMap.get('color') as string | undefined) ?? undefined,
            columnColor: (colMap.get('columnColor') as string | undefined) ?? undefined,
        })
    }

    const cards: Record<string, Card> = {}
    cardsMap.forEach((cardMap, cardId) => {
        const titleText = cardMap.get('title') as Y.Text
        const descFrag = cardMap.get('description') as Y.XmlFragment
        const createdAt = cardMap.get('createdAt') as number

        // Convert the Y.XmlFragment to proper ProseMirror JSON.
        //
        // NB: descFrag.toJSON() returns an XML *string* (e.g.
        // "<paragraph>hello</paragraph>"), not Tiptap JSON. Using it directly
        // would surface literal tags in the rendered description. The
        // y-prosemirror helper below is the correct inverse of
        // prosemirrorJSONToYXmlFragment used on the write side.
        const description =
            descFrag && descFrag.length > 0
                ? yXmlFragmentToProsemirrorJSON(descFrag) as JSONContent
                : undefined

        cards[cardId] = {
            id: cardId,
            title: titleText?.toString() ?? '',
            description,
            createdAt: createdAt ?? 0,
        }
    })

    return {columns, cards}
}

// ---------------------------------------------------------
// Seeding — initial state for a brand-new board
// ---------------------------------------------------------

/**
 * Default columns created when a project is first created.
 * Applied as a Yjs snapshot at creation time so every joiner sees the
 * same starting state without any client needing to seed at runtime.
 */
export const DEFAULT_COLUMN_TITLES = ['To do', 'In progress', 'Complete']

/**
 * Builds a fresh Y.Doc containing the default columns and returns its
 * encoded state as a base64 string, ready to be written into the
 * `board_documents` table.
 *
 * Used by the project-creation flow (projectsStore.createProject) to
 * persist an initial board snapshot before any client connects, which
 * avoids races between multiple early joiners who would otherwise each
 * see an empty board and try to seed it themselves.
 */
export function buildSeededBoardStateB64(): string {
    const doc = new Y.Doc()
    const now = Date.now()
    DEFAULT_COLUMN_TITLES.forEach((title, i) => {
        const id = `col-seed-${i}-${now}-${Math.random().toString(36).slice(2, 7)}`
        addColumn(doc, id, title)
    })

    const state = Y.encodeStateAsUpdate(doc)

    // Chunked binary→base64 conversion (matches SupabaseYjsProvider's
    // approach so the row is round-trippable).
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < state.length; i += chunkSize) {
        const chunk = state.subarray(i, i + chunkSize)
        binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    return btoa(binary)
}

// ---------------------------------------------------------
// Notes metadata — stored in the board Y.Doc so note titles
// and ordering are synced via the same channel as the board.
// Mirrors the kanban schema: top-level Y.Map + Y.Array.
//
// Schema additions:
//   notesMeta:   Y.Map<noteId, Y.Map>
//                  Each note-map contains:
//                    title:     Y.Text
//                    createdAt: number
//                    updatedAt: number
//
//   notesOrder:  Y.Array<string>
// ---------------------------------------------------------

export function getNotesMetaMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
    return doc.getMap('notesMeta') as Y.Map<Y.Map<unknown>>
}

export function getNotesOrder(doc: Y.Doc): Y.Array<string> {
    return doc.getArray<string>('notesOrder')
}

function getNoteText(noteMap: Y.Map<unknown>): Y.Text {
    let t = noteMap.get('title') as Y.Text | undefined
    if (!t) {
        t = new Y.Text()
        noteMap.set('title', t)
    }
    return t
}

/** Adds a note to the front of the ordered list. */
export function addNote(doc: Y.Doc, id: string, title: string, createdAt: number): void {
    doc.transact(() => {
        const noteMap = new Y.Map<unknown>()
        const t = new Y.Text()
        t.insert(0, title)
        noteMap.set('title', t)
        noteMap.set('createdAt', createdAt)
        noteMap.set('updatedAt', createdAt)
        getNotesMetaMap(doc).set(id, noteMap)
        getNotesOrder(doc).insert(0, [id])
    })
}

/** Removes a note from metadata and order. */
export function removeNote(doc: Y.Doc, id: string): void {
    doc.transact(() => {
        getNotesMetaMap(doc).delete(id)
        const order = getNotesOrder(doc)
        const idx = order.toArray().indexOf(id)
        if (idx !== -1) order.delete(idx, 1)
    })
}

/** Updates a note's title and `updatedAt` timestamp. */
export function setNoteTitle(doc: Y.Doc, id: string, title: string): void {
    doc.transact(() => {
        const noteMap = getNotesMetaMap(doc).get(id)
        if (!noteMap) return
        const t = getNoteText(noteMap)
        t.delete(0, t.length)
        t.insert(0, title)
        noteMap.set('updatedAt', Date.now())
    })
}

/** Moves a note to the front of the order (e.g. on rename / blur). */
export function promoteNote(doc: Y.Doc, id: string): void {
    doc.transact(() => {
        const order = getNotesOrder(doc)
        const arr = order.toArray()
        const idx = arr.indexOf(id)
        if (idx <= 0) return
        order.delete(idx, 1)
        order.insert(0, [id])
    })
}

export interface NotesSnapshot {
    notes: Record<string, Note>
    order: string[]
}

/** Reads notes metadata from the Y.Doc into plain JS. */
export function snapshotNotes(doc: Y.Doc): NotesSnapshot {
    const metaMap = getNotesMetaMap(doc)
    const order = getNotesOrder(doc).toArray()

    const notes: Record<string, Note> = {}
    metaMap.forEach((noteMap, id) => {
        notes[id] = {
            id,
            title: (noteMap.get('title') as Y.Text | undefined)?.toString() ?? '',
            createdAt: (noteMap.get('createdAt') as number | undefined) ?? 0,
            updatedAt: (noteMap.get('updatedAt') as number | undefined) ?? 0,
        }
    })

    return {notes, order}
}