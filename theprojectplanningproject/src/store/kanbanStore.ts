import {create} from 'zustand'
import type {Board, Card, Column} from "../types/kanban";

interface KanbanStore {
    activeProjectId: string | null
    board: Board

    loadForProject: (projectId: string) => void
    clearActiveProject: () => void

    addColumn: (title: string) => void
    deleteColumn: (columnId: string) => void
    addCard: (columnId: string, title: string, description?: unknown) => void
    deleteCard: (columnId: string, cardId: string) => void
    moveCard: (fromColumnId: string, toColumnId: string, cardId: string, toIndex: number) => void
    updateCard: (cardId: string, updates: Partial<Card>) => void
    updateCardDescription: (cardId: string, description: unknown) => void
}

const EMPTY_BOARD: Board = {columns: [], cards: {}}

const DEFAULT_BOARD: Board = {
    columns: [
        {id: "col-1", title: "To Do", cardIds: []},
        {id: "col-2", title: "In Progress", cardIds: []},
        {id: "col-3", title: "Done", cardIds: []}
    ],
    cards: {}
}

function storageKey(projectId: string): string {
    return `kanban-board:${projectId}`
}

function loadBoard(projectId: string): Board {
    try {
        const saved = localStorage.getItem(storageKey(projectId))
        return saved ? JSON.parse(saved) : DEFAULT_BOARD
    } catch {
        return DEFAULT_BOARD
    }
}

// Debounced save — avoids writing to localStorage on every drag event
// (which fires many times per second). Writes happen at most once per 300ms.
let saveTimer: number | null = null
function saveBoard(projectId: string, board: Board) {
    if (saveTimer !== null) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
        saveTimer = null
        try {
            localStorage.setItem(storageKey(projectId), JSON.stringify(board))
        } catch (e) {
            console.warn('Failed to save board to localStorage', e)
        }
    }, 300)
}

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function withActiveProject<T>(
    state: KanbanStore,
    fn: (projectId: string) => T,
): T | null {
    if (!state.activeProjectId) {
        console.warn('Kanban action called with no active project; ignoring')
        return null
    }
    return fn(state.activeProjectId)
}

export const useKanbanStore = create<KanbanStore>((set) => ({
    activeProjectId: null,
    board: EMPTY_BOARD,

    loadForProject: (projectId) => set(() => {
        const board = loadBoard(projectId)
        return {activeProjectId: projectId, board}
    }),

    clearActiveProject: () => set(() => ({activeProjectId: null, board: EMPTY_BOARD})),

    addColumn: title => set((state) => {
        return withActiveProject(state, (projectId) => {
            const newColumn: Column = {id: generateId(), title, cardIds: []}
            const board = {...state.board, columns: [...state.board.columns, newColumn]}
            saveBoard(projectId, board)
            return {board}
        }) ?? state
    }),

    deleteColumn: (columnId) => set((state) => {
        return withActiveProject(state, (projectId) => {
            const column = state.board.columns.find(c => c.id === columnId)
            if (!column) return state
            const cards = {...state.board.cards}
            column.cardIds.forEach(id => delete cards[id])
            const board = {
                columns: state.board.columns.filter(c => c.id !== columnId),
                cards
            }
            saveBoard(projectId, board)
            return {board}
        }) ?? state
    }),

    addCard: (columnId, title, description) => set((state) => {
        return withActiveProject(state, (projectId) => {
            const card: Card = {id: generateId(), title, description, createdAt: Date.now()}
            const columns = state.board.columns.map(col =>
                col.id === columnId ? {...col, cardIds: [...col.cardIds, card.id]} : col)
            const board = {columns, cards: {...state.board.cards, [card.id]: card}}
            saveBoard(projectId, board)
            return {board}
        }) ?? state
    }),

    deleteCard: (columnId, cardId) => set((state) => {
        return withActiveProject(state, (projectId) => {
            const columns = state.board.columns.map(col =>
                col.id === columnId
                    ? {...col, cardIds: col.cardIds.filter(id => id !== cardId)}
                    : col)
            const cards = {...state.board.cards}
            delete cards[cardId]
            const board = {columns, cards}
            saveBoard(projectId, board)
            return {board}
        }) ?? state
    }),

    moveCard: (fromColumnId, toColumnId, cardId, toIndex) => set((state) => {
        return withActiveProject(state, (projectId) => {
            const fromColumn = state.board.columns.find(c => c.id === fromColumnId)
            const toColumn = state.board.columns.find(c => c.id === toColumnId)
            if (!fromColumn || !toColumn) return state

            const fromIndex = fromColumn.cardIds.indexOf(cardId)
            if (fromIndex === -1) return state

            let normalisedIndex = toIndex
            if (fromColumnId === toColumnId && toIndex > fromIndex) {
                normalisedIndex = toIndex - 1
            }

            const columns = state.board.columns.map(col => {
                if (col.id === fromColumnId && col.id !== toColumnId) {
                    return {...col, cardIds: col.cardIds.filter(id => id !== cardId)}
                }
                if (col.id === toColumnId) {
                    const ids = col.id === fromColumnId
                        ? col.cardIds.filter(id => id !== cardId)
                        : [...col.cardIds]
                    const clamped = Math.max(0, Math.min(normalisedIndex, ids.length))
                    ids.splice(clamped, 0, cardId)
                    return {...col, cardIds: ids}
                }
                return col
            })
            const board = {...state.board, columns}
            saveBoard(projectId, board)
            return {board}
        }) ?? state
    }),

    updateCard: (cardId, updates) => set((state) => {
        return withActiveProject(state, (projectId) => {
            const board = {
                ...state.board,
                cards: {
                    ...state.board.cards,
                    [cardId]: {...state.board.cards[cardId], ...updates}
                }
            }
            saveBoard(projectId, board)
            return {board}
        }) ?? state
    }),

    updateCardDescription: (cardId, description) => set((state) => {
        return withActiveProject(state, (projectId) => {
            const existing = state.board.cards[cardId]
            if (!existing) return state
            const board = {
                ...state.board,
                cards: {
                    ...state.board.cards,
                    [cardId]: {...existing, description}
                }
            }
            saveBoard(projectId, board)
            return {board}
        }) ?? state
    }),
}))