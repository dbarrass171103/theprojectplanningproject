import {create} from 'zustand'
import type {Board, Card, Column} from "../types/kanban"

/**
 * The shape of the Kanban store.
 * Handles:
 * - columns
 * - cards
 * - moving cards
 * - updating card content
 * - persistence to localStorage
 */
interface KanbanStore {
    board: Board
    addColumn: (title: string) => void
    deleteColumn: (columnId: string) => void
    addCard: (columnId: string, title: string, description?: unknown) => void
    deleteCard: (columnId: string, cardId: string) => void
    moveCard: (
        fromColumnId: string,
        toColumnId: string,
        cardId: string,
        toIndex: number
    ) => void
    updateCard: (cardId: string, updates: Partial<Card>) => void
    updateCardDescription: (cardId: string, description: unknown) => void
}

// Default board
const DEFAULT_BOARD: Board = {
    columns: [
        {id: "col-1", title: "To Do", cardIds: []},
        {id: "col-2", title: "In Progress", cardIds: []},
        {id: "col-3", title: "Done", cardIds: []}
    ],
    cards: {}
}

// Load board from local storage
function loadBoard(): Board {
    try {
        const saved = localStorage.getItem("kanban-board")
        return saved ? JSON.parse(saved) : DEFAULT_BOARD
    } catch {
        return DEFAULT_BOARD
    }
}

// Save board to local storage
function saveBoard(board: Board) {
    try {
        localStorage.setItem('kanban-board', JSON.stringify(board))
    } catch (e) {
        console.warn('Failed to save board to localStorage', e)
    }
}

// Generate a unique Id
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const initialBoard = loadBoard()

/**
 * Zustand store for the Kanban board.
 * All mutations:
 * - create a new board object (immutability)
 * - save to localStorage
 * - return the new board
 */
export const useKanbanStore = create<KanbanStore>((set) => ({
    board: initialBoard,

    // Add a new column
    addColumn: title => set((state) => {
        const newColumn: Column = {id: generateId(), title, cardIds: []}

        const board = {
            ...state.board,
            columns: [...state.board.columns, newColumn]
        }

        saveBoard(board)
        return {board}
    }),

    // Delete a column and its cards
    deleteColumn: (columnId) => set((state) => {
        const column = state.board.columns.find(c => c.id === columnId)
        if (!column) return state

        // Remove all cards belonging to this column.
        const cards = {...state.board.cards}
        column.cardIds.forEach(id => delete cards[id])

        const board = {
            columns: state.board.columns.filter(c => c.id !== columnId),
            cards
        }

        saveBoard(board)
        return {board}
    }),

    // add a new card
    addCard: (columnId, title, description) => set((state) => {
        const card: Card = {
            id: generateId(),
            title,
            description,
            createdAt: Date.now()
        }

        const columns = state.board.columns.map(col =>
            col.id === columnId
                ? {...col, cardIds: [...col.cardIds, card.id]}
                : col
        )

        const board = {
            columns,
            cards: {...state.board.cards, [card.id]: card}
        }

        saveBoard(board)
        return {board}
    }),

    // delete a card
    deleteCard: (columnId, cardId) => set((state) => {
        const columns = state.board.columns.map(col =>
            col.id === columnId
                ? {...col, cardIds: col.cardIds.filter(id => id !== cardId)}
                : col
        )

        const cards = {...state.board.cards}
        delete cards[cardId]

        const board = {columns, cards}
        saveBoard(board)
        return {board}
    }),

    // Move a card.
    moveCard: (fromColumnId, toColumnId, cardId, toIndex) => set((state) => {
        const fromColumn = state.board.columns.find(c => c.id === fromColumnId)
        const toColumn = state.board.columns.find(c => c.id === toColumnId)
        if (!fromColumn || !toColumn) return state

        const fromIndex = fromColumn.cardIds.indexOf(cardId)
        if (fromIndex === -1) return state

        // Fix index when dragging downward inside the same column.
        let normalisedIndex = toIndex
        if (fromColumnId === toColumnId && toIndex > fromIndex) {
            normalisedIndex = toIndex - 1
        }

        const columns = state.board.columns.map(col => {
            // Remove from source column (if different).
            if (col.id === fromColumnId && col.id !== toColumnId) {
                return {...col, cardIds: col.cardIds.filter(id => id !== cardId)}
            }

            // Insert into destination column
            if (col.id === toColumnId) {
                const ids =
                    col.id === fromColumnId
                        ? col.cardIds.filter(id => id !== cardId)
                        : [...col.cardIds]

                const clamped = Math.max(0, Math.min(normalisedIndex, ids.length))
                ids.splice(clamped, 0, cardId)

                return {...col, cardIds: ids}
            }

            return col
        })

        const board = {...state.board, columns}
        saveBoard(board)
        return {board}
    }),

    // Update card fields
    updateCard: (cardId, updates) => set((state) => {
        const board = {
            ...state.board,
            cards: {
                ...state.board.cards,
                [cardId]: {...state.board.cards[cardId], ...updates}
            }
        }

        saveBoard(board)
        return {board}
    }),

    // Update cards description
    updateCardDescription: (cardId, description) => set((state) => {
        const existing = state.board.cards[cardId]
        if (!existing) return state

        const board = {
            ...state.board,
            cards: {
                ...state.board.cards,
                [cardId]: {...existing, description}
            }
        }

        saveBoard(board)
        return {board}
    }),
}))
