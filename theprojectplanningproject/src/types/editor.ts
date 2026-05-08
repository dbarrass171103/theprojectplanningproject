export interface Document {
    id: string
    title: string
    content: string
    createdAt: number
    updatedAt: number
}

export interface EditorStore {
    documents: Record<string, Document>
    documentIds: string[]
    activeDocumentId: string | null
}

