// Chat store for a project's message history.
//
// On bindToProject:
//   1. Fetches the most recent PAGE_SIZE messages as initial history.
//   2. Sets hasMore=true if exactly PAGE_SIZE rows came back, indicating
//      older pages exist.
//   3. Subscribes to a Supabase broadcast channel for live delivery.
//
// On loadOlderMessages:
//   Fetches the next page using the oldest loaded message's createdAt as
//   a cursor (lt filter), then prepends the results. Sets hasMore=false
//   when fewer than PAGE_SIZE rows come back.
//
// On sendMessage:
//   Inserts the row into Supabase (durable) and broadcasts it to peers
//   so they don't have to wait for a refetch.

// Optimistic sends: sendMessage immediately appends a message with
// status='sending', then replaces it with the confirmed row on success
// or marks it status='failed' on error. retryMessage re-attempts a failed
// send by tempId.
//
// Typing indicators: setTyping broadcasts a 'typing' event on the chat
// channel. Incoming typing events are stored in typingUsers keyed by
// sender name with a timestamp; a cleanup interval expires entries older
// than TYPING_TIMEOUT_MS so the indicator disappears automatically.

import {create} from 'zustand'
import type {RealtimeChannel} from '@supabase/supabase-js'
import {getSupabaseForProject} from '../lib/supabase'
import {colorForName} from '../utils/userColor'
import type {ChatMessage} from '../types/chat'

const PAGE_SIZE = 50
const BROADCAST_EVENT = 'chat-message'
const TYPING_EVENT = 'typing'
const TYPING_TIMEOUT_MS = 2000

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

        // Expire stale typing indicators every second.
        typingCleanupInterval = window.setInterval(() => {
            const now = Date.now()
            set(state => {
                const fresh = state.typingUsers.filter(
                    u => now - u.at < TYPING_TIMEOUT_MS,
                )
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

        const {activeProjectId} = get()
        if (!activeProjectId || !currentMemberToken) return

        const tempId = generateTempId()
        const senderColor = colorForName(currentDisplayName)

        // Append optimistically before the network round-trip.
        const optimistic: ChatMessage = {
            id: tempId,
            tempId,
            projectId: activeProjectId,
            senderName: currentDisplayName,
            senderColor,
            body: trimmed,
            createdAt: Date.now(),
            status: 'sending',
        }

        set(state => ({messages: [...state.messages, optimistic]}))

        await doSend(tempId, activeProjectId, trimmed, senderColor, set)
    },

    retryMessage: async (tempId) => {
        const {messages, activeProjectId} = get()
        if (!activeProjectId || !currentMemberToken) return

        const msg = messages.find(m => m.tempId === tempId)
        if (!msg) return

        // Reset to sending state before retrying.
        set(state => ({
            messages: state.messages.map(m =>
                m.tempId === tempId ? {...m, status: 'sending' as const} : m,
            ),
        }))

        await doSend(tempId, activeProjectId, msg.body, msg.senderColor, set)
    },

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

// Extracted so both sendMessage and retryMessage can share the same
// insert + broadcast logic without duplicating error handling.
async function doSend(
    tempId: string,
    projectId: string,
    body: string,
    senderColor: string,
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

    // Replace the optimistic entry with the confirmed one, preserving tempId
    // so retryMessage can still find it if needed.
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