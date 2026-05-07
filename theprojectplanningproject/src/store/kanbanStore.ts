import {create} from 'zustand'
import type {Board, Card, Column} from "../types/kanban.ts";

interface KanbanStore {
    board: Board
    addColumn: (title: string) => void
    deleteColumn: (columnId: string) => void
    addCard: (columnId: string, title: string, description: string) => void
    deleteCard: (columnId: string, cardId: string) => void
    moveCard: (fromColumnId: string, toColumnId: string, cardId: string, toIndex: number) => void
    updateCard: (cardId: string, updates: Partial<Card>) => void
}

const DEFAULT_BOARD: Board = {
    columns: [
        {id: "col-1", title: "To Do", cardIds: []},
        {id: "col-2", title: "In Progress", cardIds: []},
        {id: "col-3", title: "Done", cardIds: []}
    ],
    cards: {}
}

function loadBoard(): Board {
    try {
        const saved = localStorage.getItem("kanban-board")
        return saved ? JSON.parse(saved) : DEFAULT_BOARD
    } catch {
        return DEFAULT_BOARD
    }
}

function saveBoard(board: Board) {
    localStorage.setItem('kanban-board', JSON.stringify(board))
}

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const useKanbanStore = create<KanbanStore>((set) => ({
        board: loadBoard(),

        addColumn: title => set((state) => {
            const newColumn: Column = {id: generateId(), title, cardIds: []}
            const board = {
                ...state.board,
                columns: [...state.board.columns, newColumn]
            }
            saveBoard(board)
            return {board}
        }),

        deleteColumn: (columnId) => set((state) => {
            const column = state.board.columns.find(c => c.id === columnId)
            if (!column) return state
            const cards = {...state.board.cards}
            column.cardIds.forEach(id => delete cards[id])
            const board = {
                columns: state.board.columns.filter(c => c.id !== columnId),
                cards
            }
            saveBoard(board)
            return {board}
        }),

        addCard: (columnId, title, description) => set((state) => {
            const card: Card = {id: generateId(), title, description, createdAt: Date.now()}
            const columns = state.board.columns.map(col =>
                col.id === columnId ? {...col, cardIds: [...col.cardIds, card.id]} : col)
            const board = {columns, cards: {...state.board.cards, [card.id]: card}}
            saveBoard(board)
            return {board}
        }),

        deleteCard: (columnId, cardId) => set((state) => {
            const columns = state.board.columns.map(col =>
            col.id === columnId ? { ...col, cardIds: col.cardIds.filter(id => id !== cardId) } : col)

            const cards  = { ...state.board.cards }
            delete cards[cardId]
            const board = {columns, cards}
            saveBoard(board)
            return { board}
        }),

        moveCard: (fromColumnId, toColumnId, cardId, toIndex) => set((state) => {
            const columns = state.board.columns.map(col => {
                if (col.id === fromColumnId && col.id !== toColumnId) {
                    return { ...col, cardIds: col.cardIds.filter(id => id !== cardId) }
                }
                if (col.id === toColumnId) {
                    const ids = col.id ===fromColumnId ? col.cardIds.filter(id => id !== cardId) : [...col.cardIds]
                    ids.splice(toIndex, 0, cardId)
                    return { ...col, cardIds: ids }
                }
                return col
            })
            const board = { ...state.board, columns }
            saveBoard(board)
            return { board}
        }),

        updateCard: (cardId, updates) => set((state) => {
            const board = {
                ...state.board,
                cards : {
                    ...state.board.cards,
                    [cardId]: { ...state.board.cards[cardId], ...updates}
                }
            }
            saveBoard(board)
            return { board}
        })
    })
)