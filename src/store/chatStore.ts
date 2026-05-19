// Chat store for a project's message history.
//
// On bindToProject:
//   1. Fetches the last 100 messages from `chat_messages` as history.
//   2. Subscribes to a Supabase broadcast channel for live delivery.
//      Incoming broadcast events are appended to the in-memory list.
//
// On sendMessage:
//   Inserts the row into Supabase and broadcasts it to peers
//
// The store also tracks `unreadCount` incremented whenever a message
// arrives from someone else while `active` is false. The Chat tab clears
// it on mount via markRead().

import {create} from 'zustand'
import type {RealtimeChannel} from '@supabase/supabase-js'
import {getSupabaseForProject} from '../lib/supabase'
import {colorForName} from '../utils/userColor'
import type {ChatMessage} from '../types/chat'

const HISTORY_LIMIT = 100
const BROADCAST_EVENT = 'chat-message'

interface ChatStore {
    activeProjectId: string | null
    messages: ChatMessage[]
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

        set({activeProjectId: projectId, messages: [], unreadCount: 0})

        const client = getSupabaseForProject(memberToken, adminToken)

        // Fetch history.
        const {data, error} = await client
            .from('chat_messages')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', {ascending: true})
            .limit(HISTORY_LIMIT)

        if (error) {
            console.warn('Failed to load chat history:', error)
        } else if (data) {
            set({messages: (data as Record<string, unknown>[]).map(rowToMessage)})
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

        set({activeProjectId: null, messages: [], unreadCount: 0, active: false})
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

        // Append locally (self=false on the channel means won't receive
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