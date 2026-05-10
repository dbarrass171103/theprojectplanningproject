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
