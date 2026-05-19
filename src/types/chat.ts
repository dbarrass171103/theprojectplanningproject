export interface ChatMessage {
    id: string
    tempId?: string
    projectId: string
    senderName: string
    senderColor: string
    body: string
    createdAt: number
    status: 'sending' | 'sent' | 'failed'
}