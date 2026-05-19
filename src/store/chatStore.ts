import {create} from 'zustand'
import type {RealtimeChannel} from '@supabase/supabase-js'
import {getSupabaseForProject} from '../lib/supabase'
import {colorForName} from '../utils/userColor'
import type {ChatMessage} from '../types/chat'

const PAGE_SIZE = 50
const BROADCAST_EVENT = 'chat-message'
const TYPING_EVENT = 'typing'
const EDIT_EVENT = 'chat-edit'
const DELETE_EVENT = 'chat-delete'
const TYPING_TIMEOUT_MS = 4000

interface TypingUser {
    name: string
    color: string
    at: number
}

interface ChatStore {
    activeProjectId: string | null
    messages: ChatMessage[]
    hasMore: boolean
    loadingOlder: boolean
    unreadCount: number
    active: boolean
    typingUsers: TypingUser[]

    /** Message currently being replied to. */
    replyingTo: ChatMessage | null
    /** Message currently being edited (by id). */
    editingId: string | null

    bindToProject: (
        projectId: string,
        memberToken: string,
        adminToken: string | undefined,
        displayName: string,
    ) => Promise<void>
    unbind: () => void

    loadOlderMessages: () => Promise<void>
    sendMessage: (body: string) => Promise<void>
    retryMessage: (tempId: string) => Promise<void>
    editMessage: (id: string, newBody: string) => Promise<void>
    deleteMessage: (id: string) => Promise<void>
    setReplyingTo: (msg: ChatMessage | null) => void
    setEditingId: (id: string | null) => void
    setTyping: () => void
    markRead: () => void
    setActive: (active: boolean) => void
}

// Held outside Zustand to avoid re-renders on channel churn.
let channel: RealtimeChannel | null = null
let currentMemberToken: string | null = null
let currentAdminToken: string | undefined = undefined
let currentDisplayName = ''
let typingCleanupInterval: number | null = null

function rowToMessage(row: Record<string, unknown>): ChatMessage {
    return {
        id: row.id as string,
        projectId: row.project_id as string,
        senderName: row.sender_name as string,
        senderColor: row.sender_color as string,
        body: row.body as string,
        createdAt: new Date(row.created_at as string).getTime(),
        status: 'sent',
        replyToId: (row.reply_to_id as string | undefined) ?? undefined,
        replyToBody: (row.reply_to_body as string | undefined) ?? undefined,
        replyToSender: (row.reply_to_sender as string | undefined) ?? undefined,
        editedAt: row.edited_at
            ? new Date(row.edited_at as string).getTime()
            : undefined,
    }
}

function generateTempId(): string {
    return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const useChatStore = create<ChatStore>((set, get) => ({
    activeProjectId: null,
    messages: [],
    hasMore: false,
    loadingOlder: false,
    unreadCount: 0,
    active: false,
    typingUsers: [],
    replyingTo: null,
    editingId: null,

    bindToProject: async (projectId, memberToken, adminToken, displayName) => {
        if (channel) {
            const client = getSupabaseForProject(currentMemberToken!, currentAdminToken)
            client.removeChannel(channel)
            channel = null
        }

        if (typingCleanupInterval !== null) {
            window.clearInterval(typingCleanupInterval)
            typingCleanupInterval = null
        }

        currentMemberToken = memberToken
        currentAdminToken = adminToken
        currentDisplayName = displayName

        set({
            activeProjectId: projectId,
            messages: [],
            hasMore: false,
            unreadCount: 0,
            typingUsers: [],
            replyingTo: null,
            editingId: null,
        })

        const client = getSupabaseForProject(memberToken, adminToken)

        const {data, error} = await client
            .from('chat_messages')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', {ascending: false})
            .limit(PAGE_SIZE)

        if (error) {
            console.warn('Failed to load chat history:', error)
        } else if (data) {
            const messages = (data as Record<string, unknown>[])
                .map(rowToMessage)
                .reverse()
            set({messages, hasMore: data.length === PAGE_SIZE})
        }

        channel = client.channel(`chat:${projectId}`, {
            config: {broadcast: {self: false}},
        })

        channel
            .on('broadcast', {event: BROADCAST_EVENT}, (msg) => {
                const payload = msg.payload as ChatMessage | undefined
                if (!payload) return
                set(state => {
                    if (state.messages.some(m => m.id === payload.id)) return state
                    return {
                        messages: [...state.messages, {...payload, status: 'sent' as const}],
                        unreadCount: state.active
                            ? state.unreadCount
                            : state.unreadCount + 1,
                    }
                })
            })
            .on('broadcast', {event: EDIT_EVENT}, (msg) => {
                const payload = msg.payload as {id: string; body: string; editedAt: number} | undefined
                if (!payload) return
                set(state => ({
                    messages: state.messages.map(m =>
                        m.id === payload.id
                            ? {...m, body: payload.body, editedAt: payload.editedAt}
                            : m,
                    ),
                }))
            })
            .on('broadcast', {event: DELETE_EVENT}, (msg) => {
                const payload = msg.payload as {id: string} | undefined
                if (!payload) return
                set(state => ({
                    messages: state.messages.filter(m => m.id !== payload.id),
                }))
            })
            .on('broadcast', {event: TYPING_EVENT}, (msg) => {
                const payload = msg.payload as {name: string; color: string} | undefined
                if (!payload?.name || payload.name === currentDisplayName) return
                set(state => {
                    const existing = state.typingUsers.filter(u => u.name !== payload.name)
                    return {
                        typingUsers: [
                            ...existing,
                            {name: payload.name, color: payload.color, at: Date.now()},
                        ],
                    }
                })
            })
            .subscribe()

        typingCleanupInterval = window.setInterval(() => {
            const now = Date.now()
            set(state => {
                const fresh = state.typingUsers.filter(u => now - u.at < TYPING_TIMEOUT_MS)
                if (fresh.length === state.typingUsers.length) return state
                return {typingUsers: fresh}
            })
        }, 1000)
    },

    unbind: () => {
        if (channel && currentMemberToken) {
            const client = getSupabaseForProject(currentMemberToken, currentAdminToken)
            client.removeChannel(channel)
            channel = null
        }

        if (typingCleanupInterval !== null) {
            window.clearInterval(typingCleanupInterval)
            typingCleanupInterval = null
        }

        currentMemberToken = null
        currentAdminToken = undefined
        currentDisplayName = ''

        set({
            activeProjectId: null,
            messages: [],
            hasMore: false,
            loadingOlder: false,
            unreadCount: 0,
            active: false,
            typingUsers: [],
            replyingTo: null,
            editingId: null,
        })
    },

    loadOlderMessages: async () => {
        const {activeProjectId, messages, hasMore, loadingOlder} = get()
        if (!activeProjectId || !currentMemberToken || !hasMore || loadingOlder) return

        set({loadingOlder: true})

        const oldest = messages[0]
        const client = getSupabaseForProject(currentMemberToken, currentAdminToken)

        const {data, error} = await client
            .from('chat_messages')
            .select('*')
            .eq('project_id', activeProjectId)
            .lt('created_at', new Date(oldest.createdAt).toISOString())
            .order('created_at', {ascending: false})
            .limit(PAGE_SIZE)

        if (error) {
            console.warn('Failed to load older messages:', error)
            set({loadingOlder: false})
            return
        }

        const older = (data as Record<string, unknown>[])
            .map(rowToMessage)
            .reverse()

        set(state => ({
            messages: [...older, ...state.messages],
            hasMore: data.length === PAGE_SIZE,
            loadingOlder: false,
        }))
    },

    sendMessage: async (body) => {
        const trimmed = body.trim()
        if (!trimmed) return

        const {activeProjectId, replyingTo} = get()
        if (!activeProjectId || !currentMemberToken) return

        const tempId = generateTempId()
        const senderColor = colorForName(currentDisplayName)

        const optimistic: ChatMessage = {
            id: tempId,
            tempId,
            projectId: activeProjectId,
            senderName: currentDisplayName,
            senderColor,
            body: trimmed,
            createdAt: Date.now(),
            status: 'sending',
            replyToId: replyingTo?.id,
            replyToBody: replyingTo?.body,
            replyToSender: replyingTo?.senderName,
        }

        set(state => ({
            messages: [...state.messages, optimistic],
            replyingTo: null,
        }))

        await doSend(tempId, activeProjectId, trimmed, senderColor, replyingTo, set)
    },

    retryMessage: async (tempId) => {
        const {messages, activeProjectId} = get()
        if (!activeProjectId || !currentMemberToken) return

        const msg = messages.find(m => m.tempId === tempId)
        if (!msg) return

        set(state => ({
            messages: state.messages.map(m =>
                m.tempId === tempId ? {...m, status: 'sending' as const} : m,
            ),
        }))

        const replyingTo = msg.replyToId
            ? {
                id: msg.replyToId,
                body: msg.replyToBody ?? '',
                senderName: msg.replyToSender ?? '',
            } as ChatMessage
            : null

        await doSend(tempId, activeProjectId, msg.body, msg.senderColor, replyingTo, set)
    },

    editMessage: async (id, newBody) => {
        const trimmed = newBody.trim()
        if (!trimmed) return

        const editedAt = Date.now()

        // Apply locally before the network confirms.
        set(state => ({
            messages: state.messages.map(m =>
                m.id === id ? {...m, body: trimmed, editedAt} : m,
            ),
            editingId: null,
        }))

        const client = getSupabaseForProject(currentMemberToken!, currentAdminToken)

        const {error} = await client
            .from('chat_messages')
            .update({body: trimmed, edited_at: new Date(editedAt).toISOString()})
            .eq('id', id)

        if (error) {
            console.warn('Failed to edit message:', error)
            return
        }

        await channel?.send({
            type: 'broadcast',
            event: EDIT_EVENT,
            payload: {id, body: trimmed, editedAt},
        })
    },

    deleteMessage: async (id) => {
        // Remove locally before the network confirms.
        set(state => ({
            messages: state.messages.filter(m => m.id !== id),
        }))

        const client = getSupabaseForProject(currentMemberToken!, currentAdminToken)

        const {error} = await client
            .from('chat_messages')
            .delete()
            .eq('id', id)

        if (error) {
            console.warn('Failed to delete message:', error)
            return
        }

        await channel?.send({
            type: 'broadcast',
            event: DELETE_EVENT,
            payload: {id},
        })
    },

    setReplyingTo: (msg) => set({replyingTo: msg, editingId: null}),

    setEditingId: (id) => set({editingId: id, replyingTo: null}),

    setTyping: () => {
        if (!channel) return
        void channel.send({
            type: 'broadcast',
            event: TYPING_EVENT,
            payload: {
                name: currentDisplayName,
                color: colorForName(currentDisplayName),
            },
        })
    },

    markRead: () => set({unreadCount: 0}),

    setActive: (active) => {
        set({active})
        if (active) set({unreadCount: 0})
    },
}))

async function doSend(
    tempId: string,
    projectId: string,
    body: string,
    senderColor: string,
    replyingTo: ChatMessage | null,
    set: (fn: (state: ChatStore) => Partial<ChatStore>) => void,
) {
    const client = getSupabaseForProject(currentMemberToken!, currentAdminToken)

    const {data, error} = await client
        .from('chat_messages')
        .insert({
            project_id: projectId,
            sender_name: currentDisplayName,
            sender_color: senderColor,
            body,
            reply_to_id: replyingTo?.id ?? null,
            reply_to_body: replyingTo?.body ?? null,
            reply_to_sender: replyingTo?.senderName ?? null,
        })
        .select()
        .single()

    if (error) {
        console.warn('Failed to send message:', error)
        set(state => ({
            messages: state.messages.map(m =>
                m.tempId === tempId ? {...m, status: 'failed' as const} : m,
            ),
        }))
        return
    }

    const confirmed = rowToMessage(data as Record<string, unknown>)

    set(state => ({
        messages: state.messages.map(m =>
            m.tempId === tempId ? {...confirmed, tempId} : m,
        ),
    }))

    await channel?.send({
        type: 'broadcast',
        event: BROADCAST_EVENT,
        payload: confirmed,
    })
}