import type {JSONContent} from '@tiptap/core'

export interface Card {
    id: string
    title: string
    description?: JSONContent
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
