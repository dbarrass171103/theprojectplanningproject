// Type definitions for calendar events.
// Events are project-scoped and persisted as Supabase rows (see calendarStore).

export interface CalendarEvent {
    id: string
    projectId: string
    title: string
    startDate: string
    endDate: string
    startTime?: string
    endTime?: string
    color: string
    createdBy: string
    createdAt: number
    description?: string
}