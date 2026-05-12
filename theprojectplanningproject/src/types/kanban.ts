// Core kanban data types.
//
// The board uses a normalised structure: Column.cardIds holds an ordered list
// of IDs; Board.cards is the flat lookup. This avoids duplicating card data
// across columns and makes card access O(1) regardless of which column it's in.
//
// `description` is typed as `unknown` because it holds a serialised Tiptap
// JSON document — we don't want to import editor types into the domain layer.
// Consumers cast it to TiptapNode when they need to inspect or render it.

export interface Card {
    id: string
    title: string
    description?: unknown
    createdAt: number
}

export interface Column {
    id: string
    title: string
    cardIds: string[]
}

export interface Board {
    columns: Column[]
    cards: Record<string, Card>
}
