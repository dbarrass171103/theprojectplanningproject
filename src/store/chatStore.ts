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

import {create} from 'zustand'
import type {RealtimeChannel} from '@supabase/supabase-js'
import {getSupabaseForProject} from '../lib/supabase'
import {colorForName} from '../utils/userColor'
import type {ChatMessage} from '../types/chat'

const PAGE_SIZE = 50
const BROADCAST_EVENT = 'chat-message'

interface ChatStore {
    activeProjectId: string | null
    messages: ChatMessage[]
    hasMore: boolean
    loadingOlder: boolean
    unreadCount: number

    /** Whether the Chat tab is currently open. Controls unread counting. */
    active: boolean

    bindToProject: (
        projectId: string,
        memberToken: string,
        adminToken: string | undefined,
        displayName: string,
    ) => Promise<void>
    unbind: () => void

    loadOlderMessages: () => Promise<void>
    sendMessage: (body: string) => Promise<void>
    markRead: () => void
    setActive: (active: boolean) => void
}

// Held outside Zustand to avoid re-renders on channel churn.
let channel: RealtimeChannel | null = null
let currentMemberToken: string | null = null
let currentAdminToken: string | undefined = undefined
let currentDisplayName = ''

function rowToMessage(row: Record<string, unknown>): ChatMessage {
    return {
        id: row.id as string,
        projectId: row.project_id as string,
        senderName: row.sender_name as string,
        senderColor: row.sender_color as string,
        body: row.body as string,
        createdAt: new Date(row.created_at as string).getTime(),
    }
}

export const useChatStore = create<ChatStore>((set, get) => ({
    activeProjectId: null,
    messages: [],
    hasMore: false,
    loadingOlder: false,
    unreadCount: 0,
    active: false,

    bindToProject: async (projectId, memberToken, adminToken, displayName) => {
        // Clean up any previous subscription.
        if (channel) {
            const client = getSupabaseForProject(
                currentMemberToken!,
                currentAdminToken,
            )
            client.removeChannel(channel)
            channel = null
        }

        currentMemberToken = memberToken
        currentAdminToken = adminToken
        currentDisplayName = displayName

        set({activeProjectId: projectId, messages: [], hasMore: false, unreadCount: 0})

        const client = getSupabaseForProject(memberToken, adminToken)

        // Fetch the most recent PAGE_SIZE messages. We fetch descending so
        // Supabase returns the newest first (needed for the cursor to work),
        // then reverse before storing so the list is chronological.
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
            set({
                messages,
                // If we got a full page back, there are likely older messages.
                hasMore: data.length === PAGE_SIZE,
            })
        }

        // Subscribe for live messages from peers.
        channel = client.channel(`chat:${projectId}`, {
            config: {broadcast: {self: false}},
        })

        channel
            .on('broadcast', {event: BROADCAST_EVENT}, (msg) => {
                const payload = msg.payload as ChatMessage | undefined
                if (!payload) return

                set(state => {
                    // Guard against double-delivery when bindToProject is called
                    // more than once before the previous channel tears down
                    // (e.g. React Strict Mode double-invoke in development).
                    if (state.messages.some(m => m.id === payload.id)) return state

                    return {
                        messages: [...state.messages, payload],
                        unreadCount: state.active
                            ? state.unreadCount
                            : state.unreadCount + 1,
                    }
                })
            })
            .subscribe()
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
            // Fetch messages older than the oldest one we already have.
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

    unbind: () => {
        if (channel && currentMemberToken) {
            const client = getSupabaseForProject(
                currentMemberToken,
                currentAdminToken,
            )
            client.removeChannel(channel)
            channel = null
        }

        currentMemberToken = null
        currentAdminToken = undefined
        currentDisplayName = ''

        set({activeProjectId: null, messages: [], hasMore: false, loadingOlder: false, unreadCount: 0, active: false})
    },

    sendMessage: async (body) => {
        const trimmed = body.trim()
        if (!trimmed) return

        const {activeProjectId} = get()
        if (!activeProjectId || !currentMemberToken) return

        const client = getSupabaseForProject(currentMemberToken, currentAdminToken)
        const senderColor = colorForName(currentDisplayName)

        const row = {
            project_id: activeProjectId,
            sender_name: currentDisplayName,
            sender_color: senderColor,
            body: trimmed,
        }

        const {data, error} = await client
            .from('chat_messages')
            .insert(row)
            .select()
            .single()

        if (error) {
            console.warn('Failed to send message:', error)
            return
        }

        const message = rowToMessage(data as Record<string, unknown>)

        // Append locally (self=false on the channel means we won't receive
        // our own broadcast).
        set(state => ({messages: [...state.messages, message]}))

        // Broadcast to peers so they get it instantly without polling.
        await channel?.send({
            type: 'broadcast',
            event: BROADCAST_EVENT,
            payload: message,
        })
    },

    markRead: () => set({unreadCount: 0}),

    setActive: (active) => {
        set({active})
        if (active) set({unreadCount: 0})
    },
}))