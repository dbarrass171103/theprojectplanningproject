export interface ChatMessage {
    id: string
    tempId?: string
    projectId: string
    senderName: string
    senderColor: string
    body: string
    createdAt: number
    status: 'sending' | 'sent' | 'failed'
    replyToId?: string
    replyToBody?: string
    replyToSender?: string
    editedAt?: number
    deleted?: boolean
}