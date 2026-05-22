// Modal for creating, viewing, and editing a calendar event.
// Opened from CalendarBoard either by clicking a date cell (create) or an
// existing event chip (view/edit). Editing is restricted to the event's
// creator or any admin-token holder.

import {useEffect, useRef, useState} from 'react'
import type {CalendarEvent} from '../../types/calendar'
import {useCalendarStore} from '../../store/calendarStore'
import {useCurrentProject} from '../../store/projectsStore'
import {EVENT_COLORS} from '../common/ColorSwatches'

// Converts a YYYY-MM-DD storage string to DD/MM/YYYY for display.
// The stored format is kept as-is so date comparisons work without parsing.
function formatDateUK(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
}

interface EventModalProps {
    initialDate?: string   // pre-fills dates when creating from a date click
    event?: CalendarEvent  // present when viewing or editing an existing event
    onClose: () => void
}

export default function EventModal({initialDate, event, onClose}: EventModalProps) {
    const project = useCurrentProject()
    const createEvent = useCalendarStore(s => s.createEvent)
    const updateEvent = useCalendarStore(s => s.updateEvent)
    const deleteEvent = useCalendarStore(s => s.deleteEvent)

    const isEditing = !!event
    const [mode, setMode] = useState<'view' | 'edit'>(isEditing ? 'view' : 'edit')

    const [title, setTitle] = useState(event?.title ?? '')
    const [startDate, setStartDate] = useState(event?.startDate ?? initialDate ?? '')
    const [rawEndDate, setRawEndDate] = useState(event?.endDate ?? initialDate ?? '')
    // Clamp end date so it can never fall before start date — derived, no effect needed.
    const endDate = rawEndDate < startDate ? startDate : rawEndDate
    const [startTime, setStartTime] = useState(event?.startTime ?? '')
    const [endTime, setEndTime] = useState(event?.endTime ?? '')
    const [allDay, setAllDay] = useState(!event?.startTime)
    const [color, setColor] = useState(event?.color ?? '#3b82f6')
    const [description, setDescription] = useState(event?.description ?? '')
    const [busy, setBusy] = useState(false)

    const dialogRef = useRef<HTMLDivElement | null>(null)
    const titleRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        if (mode === 'edit') {
            setTimeout(() => titleRef.current?.focus(), 50)
        }
    }, [mode])

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose()
        }
        function onMouseDown(e: MouseEvent) {
            if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('keydown', onKey)
        document.addEventListener('mousedown', onMouseDown)
        return () => {
            document.removeEventListener('keydown', onKey)
            document.removeEventListener('mousedown', onMouseDown)
        }
    }, [onClose])

    async function handleSave() {
        if (!title.trim()) return
        setBusy(true)
        try {
            const payload = {
                title: title.trim(),
                startDate,
                endDate: endDate || startDate,
                startTime: allDay ? undefined : (startTime || undefined),
                endTime: allDay ? undefined : (endTime || undefined),
                color,
                description: description.trim() || undefined,
            }
            if (isEditing && event) {
                await updateEvent(event.id, payload)
            } else {
                await createEvent({
                    ...payload,
                    createdBy: project?.displayName ?? 'Unknown',
                })
            }
            onClose()
        } finally {
            setBusy(false)
        }
    }

    async function handleDelete() {
        if (!event) return
        if (!confirm(`Delete "${event.title}"?`)) return
        setBusy(true)
        await deleteEvent(event.id)
        onClose()
    }

    const canEdit = !isEditing || project?.displayName === event?.createdBy || !!project?.adminToken

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div
                ref={dialogRef}
                className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{backgroundColor: color}}
                        />
                        <h2 className="text-lg font-semibold text-gray-800">
                            {mode === 'view' ? (event?.title || 'Event') : (isEditing ? 'Edit event' : 'New event')}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditing && mode === 'view' && canEdit && (
                            <button
                                onClick={() => setMode('edit')}
                                className="text-gray-400 hover:text-gray-700 text-sm"
                                title="Edit"
                            >
                                ✎
                            </button>
                        )}
                        {isEditing && canEdit && (
                            <button
                                onClick={handleDelete}
                                disabled={busy}
                                className="text-gray-400 hover:text-red-500 text-sm"
                                title="Delete"
                            >
                                🗑
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {mode === 'view' && event ? (
                    <div className="flex flex-col gap-3 text-sm text-gray-700">
                        <div className="flex items-center gap-2 text-gray-500">
                            <span>📅</span>
                            <span>
                                {event.startDate === event.endDate
                                    ? formatDateUK(event.startDate)
                                    : `${formatDateUK(event.startDate)} → ${formatDateUK(event.endDate)}`}
                                {event.startTime && (
                                    <span className="ml-2">
                                        {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}
                                    </span>
                                )}
                                {!event.startTime && <span className="ml-2 text-xs">(All day)</span>}
                            </span>
                        </div>
                        {event.description && (
                            <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
                        )}
                        <p className="text-xs text-gray-400">Created by {event.createdBy}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {/* Title */}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                            <input
                                ref={titleRef}
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                                placeholder="Event title"
                                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>

                        {/* Dates */}
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">End date</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    min={startDate}
                                    onChange={e => setRawEndDate(e.target.value)}
                                    className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                        </div>

                        {/* All-day toggle */}
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={allDay}
                                onChange={e => setAllDay(e.target.checked)}
                                className="rounded"
                            />
                            All day
                        </label>

                        {/* Times */}
                        {!allDay && (
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Start time</label>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={e => setStartTime(e.target.value)}
                                        className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">End time</label>
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={e => setEndTime(e.target.value)}
                                        className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Colour */}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2">Colour</label>
                            <div className="flex gap-2 flex-wrap">
                                {EVENT_COLORS.map(c => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        title={c.name}
                                        onClick={() => setColor(c.value)}
                                        className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                                            color === c.value
                                                ? 'border-gray-800 ring-2 ring-gray-300'
                                                : 'border-transparent'
                                        }`}
                                        style={{backgroundColor: c.value}}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Optional notes…"
                                rows={2}
                                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 justify-end pt-1">
                            <button
                                onClick={onClose}
                                disabled={busy}
                                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!title.trim() || busy}
                                className="text-sm bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                {busy ? 'Saving…' : (isEditing ? 'Save changes' : 'Create event')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}