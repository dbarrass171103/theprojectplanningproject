// Calendar store — backed by Supabase rows, same pattern as chatStore.

import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseForProject } from '../lib/supabase'
import type { CalendarEvent } from '../types/calendar'

const BROADCAST_CREATE = 'calendar-create'
const BROADCAST_UPDATE = 'calendar-update'
const BROADCAST_DELETE = 'calendar-delete'

interface CalendarStore {
    activeProjectId: string | null
    events: CalendarEvent[]
    loading: boolean

    bindToProject: (
        projectId: string,
        memberToken: string,
        adminToken: string | undefined,
        displayName: string,
    ) => Promise<void>
    unbind: () => void

    createEvent: (event: Omit<CalendarEvent, 'id' | 'projectId' | 'createdAt'>) => Promise<void>
    updateEvent: (id: string, updates: Partial<Omit<CalendarEvent, 'id' | 'projectId' | 'createdAt' | 'createdBy'>>) => Promise<void>
    deleteEvent: (id: string) => Promise<void>
}

// Held outside Zustand to avoid re-renders on channel churn.
let channel: RealtimeChannel | null = null
let currentMemberToken: string | null = null
let currentAdminToken: string | undefined = undefined
let currentDisplayName = ''

function rowToEvent(row: Record<string, unknown>): CalendarEvent {
    return {
        id: row.id as string,
        projectId: row.project_id as string,
        title: row.title as string,
        startDate: row.start_date as string,
        endDate: row.end_date as string,
        startTime: (row.start_time as string | null) ?? undefined,
        endTime: (row.end_time as string | null) ?? undefined,
        color: row.color as string,
        createdBy: row.created_by as string,
        createdAt: new Date(row.created_at as string).getTime(),
        description: (row.description as string | null) ?? undefined,
    }
}

function generateId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
    activeProjectId: null,
    events: [],
    loading: false,

    bindToProject: async (projectId, memberToken, adminToken, displayName) => {
        // Tear down any previous subscription
        if (channel && currentMemberToken) {
            const client = getSupabaseForProject(currentMemberToken, currentAdminToken)
            client.removeChannel(channel)
            channel = null
        }

        currentMemberToken = memberToken
        currentAdminToken = adminToken
        currentDisplayName = displayName

        set({ activeProjectId: projectId, events: [], loading: true })

        const client = getSupabaseForProject(memberToken, adminToken)

        const { data, error } = await client
            .from('calendar_events')
            .select('*')
            .eq('project_id', projectId)
            .order('start_date', { ascending: true })

        if (error) {
            console.warn('Failed to load calendar events:', error)
        } else if (data) {
            set({ events: (data as Record<string, unknown>[]).map(rowToEvent) })
        }

        set({ loading: false })

        channel = client.channel(`calendar:${projectId}`, {
            config: { broadcast: { self: false } },
        })

        channel
            .on('broadcast', { event: BROADCAST_CREATE }, (msg) => {
                const event = msg.payload as CalendarEvent | undefined
                if (!event) return
                set(state => {
                    if (state.events.some(e => e.id === event.id)) return state
                    return { events: [...state.events, event].sort(sortByDate) }
                })
            })
            .on('broadcast', { event: BROADCAST_UPDATE }, (msg) => {
                const event = msg.payload as CalendarEvent | undefined
                if (!event) return
                set(state => ({
                    events: state.events
                        .map(e => (e.id === event.id ? event : e))
                        .sort(sortByDate),
                }))
            })
            .on('broadcast', { event: BROADCAST_DELETE }, (msg) => {
                const payload = msg.payload as { id: string } | undefined
                if (!payload) return
                set(state => ({
                    events: state.events.filter(e => e.id !== payload.id),
                }))
            })
            .subscribe()
    },

    unbind: () => {
        if (channel && currentMemberToken) {
            const client = getSupabaseForProject(currentMemberToken, currentAdminToken)
            client.removeChannel(channel)
            channel = null
        }

        currentMemberToken = null
        currentAdminToken = undefined
        currentDisplayName = ''

        set({ activeProjectId: null, events: [], loading: false })
    },

    createEvent: async (eventData) => {
        const { activeProjectId } = get()
        if (!activeProjectId || !currentMemberToken) return

        const id = generateId()
        const now = Date.now()

        const newEvent: CalendarEvent = {
            ...eventData,
            id,
            projectId: activeProjectId,
            createdAt: now,
            createdBy: currentDisplayName,
        }

        set(state => ({
            events: [...state.events, newEvent].sort(sortByDate),
        }))

        const client = getSupabaseForProject(currentMemberToken, currentAdminToken)

        const { error } = await client.from('calendar_events').insert({
            id,
            project_id: activeProjectId,
            title: newEvent.title,
            start_date: newEvent.startDate,
            end_date: newEvent.endDate,
            start_time: newEvent.startTime ?? null,
            end_time: newEvent.endTime ?? null,
            color: newEvent.color,
            created_by: newEvent.createdBy,
            created_at: new Date(now).toISOString(),
            description: newEvent.description ?? null,
        })

        if (error) {
            console.warn('Failed to create calendar event:', error)
            set(state => ({ events: state.events.filter(e => e.id !== id) }))
            return
        }

        await channel?.send({
            type: 'broadcast',
            event: BROADCAST_CREATE,
            payload: newEvent,
        })
    },

    updateEvent: async (id, updates) => {
        const { events } = get()
        if (!currentMemberToken) return

        const original = events.find(e => e.id === id)
        if (!original) return

        const updated: CalendarEvent = { ...original, ...updates }

        set(state => ({
            events: state.events
                .map(e => (e.id === id ? updated : e))
                .sort(sortByDate),
        }))

        const client = getSupabaseForProject(currentMemberToken, currentAdminToken)

        const { error } = await client
            .from('calendar_events')
            .update({
                title: updates.title ?? original.title,
                start_date: updates.startDate ?? original.startDate,
                end_date: updates.endDate ?? original.endDate,
                start_time: (updates.startTime !== undefined ? updates.startTime : original.startTime) ?? null,
                end_time: (updates.endTime !== undefined ? updates.endTime : original.endTime) ?? null,
                color: updates.color ?? original.color,
                description: (updates.description !== undefined ? updates.description : original.description) ?? null,
            })
            .eq('id', id)

        if (error) {
            console.warn('Failed to update calendar event:', error)
            set(state => ({
                events: state.events.map(e => (e.id === id ? original : e)).sort(sortByDate),
            }))
            return
        }

        await channel?.send({
            type: 'broadcast',
            event: BROADCAST_UPDATE,
            payload: updated,
        })
    },

    deleteEvent: async (id) => {
        const { events } = get()
        if (!currentMemberToken) return

        const original = events.find(e => e.id === id)

        set(state => ({ events: state.events.filter(e => e.id !== id) }))

        const client = getSupabaseForProject(currentMemberToken, currentAdminToken)

        const { error } = await client
            .from('calendar_events')
            .delete()
            .eq('id', id)

        if (error) {
            console.warn('Failed to delete calendar event:', error)
            if (original) {
                set(state => ({
                    events: [...state.events, original].sort(sortByDate),
                }))
            }
            return
        }

        await channel?.send({
            type: 'broadcast',
            event: BROADCAST_DELETE,
            payload: { id },
        })
    },
}))

function sortByDate(a: CalendarEvent, b: CalendarEvent): number {
    const d = a.startDate.localeCompare(b.startDate)
    if (d !== 0) return d
    const ta = a.startTime ?? '00:00'
    const tb = b.startTime ?? '00:00'
    return ta.localeCompare(tb)
}