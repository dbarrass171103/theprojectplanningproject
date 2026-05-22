// CalendarBoard — month, week, and day views for project calendar events.
// Clicking any date cell opens EventModal to create; clicking an existing
// event chip opens it to view or edit.

import {useState, useMemo} from 'react'
import {useCalendarStore} from '../../store/calendarStore'
import type {CalendarEvent} from '../../types/calendar'
import EventModal from './EventModal'

type View = 'month' | 'week' | 'day'

function toDateStr(d: Date): string {
    return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
    const r = new Date(d)
    r.setDate(r.getDate() + n)
    return r
}

function startOfWeek(d: Date): Date {
    const r = new Date(d)
    r.setDate(r.getDate() - r.getDay()) // Sunday = 0
    return r
}

function eventSpansDate(event: CalendarEvent, dateStr: string): boolean {
    return dateStr >= event.startDate && dateStr <= event.endDate
}

const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
]
const DAY_NAMES_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAY_NAMES_LONG  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const HOURS = Array.from({length: 24}, (_, i) => i)

function formatHour(h: number): string {
    if (h === 0) return '12 AM'
    if (h < 12) return `${h} AM`
    if (h === 12) return '12 PM'
    return `${h - 12} PM`
}

export default function CalendarBoard() {
    const events = useCalendarStore(s => s.events)

    const today = toDateStr(new Date())
    const [view, setView] = useState<View>('month')
    const [cursor, setCursor] = useState(new Date())  // governs which period is shown

    const [modalDate, setModalDate] = useState<string | null>(null)       // creating on date
    const [modalEvent, setModalEvent] = useState<CalendarEvent | null>(null) // viewing/editing

    function prev() {
        setCursor(c => {
            const d = new Date(c)
            if (view === 'month') d.setMonth(d.getMonth() - 1)
            else if (view === 'week') d.setDate(d.getDate() - 7)
            else d.setDate(d.getDate() - 1)
            return d
        })
    }

    function next() {
        setCursor(c => {
            const d = new Date(c)
            if (view === 'month') d.setMonth(d.getMonth() + 1)
            else if (view === 'week') d.setDate(d.getDate() + 7)
            else d.setDate(d.getDate() + 1)
            return d
        })
    }

    function goToday() {
        setCursor(new Date())
    }

    const monthStart = useMemo(() => {
        return new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    }, [cursor])

    const weekStart = useMemo(() => startOfWeek(cursor), [cursor])

    const periodLabel = useMemo(() => {
        if (view === 'month') {
            return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`
        }
        if (view === 'week') {
            const ws = startOfWeek(cursor)
            const we = addDays(ws, 6)
            if (ws.getMonth() === we.getMonth()) {
                return `${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()}–${we.getDate()}, ${ws.getFullYear()}`
            }
            return `${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()} – ${MONTH_NAMES[we.getMonth()]} ${we.getDate()}, ${ws.getFullYear()}`
        }
        return `${DAY_NAMES_LONG[cursor.getDay()]}, ${MONTH_NAMES[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`
    }, [view, cursor])

    function eventsOnDate(dateStr: string): CalendarEvent[] {
        return events.filter(e => eventSpansDate(e, dateStr))
    }

    function allDayEventsOnDate(dateStr: string): CalendarEvent[] {
        return events.filter(e => eventSpansDate(e, dateStr) && !e.startTime)
    }

    function handleDateClick(dateStr: string) {
        setModalDate(dateStr)
        setModalEvent(null)
    }

    function handleEventClick(e: CalendarEvent, stopProp: React.MouseEvent) {
        stopProp.stopPropagation()
        setModalEvent(e)
        setModalDate(null)
    }

    function closeModal() {
        setModalDate(null)
        setModalEvent(null)
    }

    function renderMonth() {
        // Grid: pad to fill weeks
        const firstDow = monthStart.getDay() // 0=Sun
        const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
        const cells: (string | null)[] = [
            ...Array(firstDow).fill(null),
            ...Array.from({length: daysInMonth}, (_, i) =>
                toDateStr(new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))
            ),
        ]
        // Pad to complete last row
        while (cells.length % 7 !== 0) cells.push(null)

        const weeks: (string | null)[][] = []
        for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

        return (
            <div className="flex-1 flex flex-col min-h-0">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-gray-200">
                    {DAY_NAMES_SHORT.map(d => (
                        <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Weeks */}
                <div className="flex-1 grid overflow-hidden" style={{gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))`}}>
                    {weeks.map((week, wi) => (
                        <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-0">
                            {week.map((dateStr, di) => {
                                if (!dateStr) {
                                    return <div key={di} className="bg-gray-50/50 border-r border-gray-100 last:border-0"/>
                                }

                                const dayNum = parseInt(dateStr.slice(8), 10)
                                const isToday = dateStr === today
                                const isCurrentMonth = dateStr.slice(0, 7) === toDateStr(monthStart).slice(0, 7)
                                const dayEvents = eventsOnDate(dateStr).slice(0, 3)
                                const overflow = eventsOnDate(dateStr).length - 3

                                return (
                                    <div
                                        key={dateStr}
                                        onClick={() => handleDateClick(dateStr)}
                                        className={`
                                            border-r border-gray-100 last:border-0 p-1.5 cursor-pointer
                                            hover:bg-blue-50/60 transition-colors flex flex-col gap-0.5
                                            ${!isCurrentMonth ? 'bg-gray-50/50' : ''}
                                        `}
                                    >
                                        <span className={`
                                            text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full self-start
                                            ${isToday ? 'bg-blue-500 text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}
                                        `}>
                                            {dayNum}
                                        </span>

                                        {dayEvents.map(ev => (
                                            <button
                                                key={ev.id}
                                                onClick={e => handleEventClick(ev, e)}
                                                className="w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate font-medium text-white leading-snug"
                                                style={{backgroundColor: ev.color}}
                                                title={ev.title}
                                            >
                                                {!ev.startTime && ''}
                                                {ev.startTime && <span className="opacity-80 mr-1">{ev.startTime}</span>}
                                                {ev.title}
                                            </button>
                                        ))}

                                        {overflow > 0 && (
                                            <span className="text-[10px] text-gray-400 px-1">+{overflow} more</span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    function renderWeek() {
        const days = Array.from({length: 7}, (_, i) => addDays(weekStart, i))
        const dayStrs = days.map(toDateStr)

        const HOUR_HEIGHT = 56 // px per hour (h-14 = 56px)

        //
        // Both helpers are day-aware so multi-day timed events are clipped
        // correctly: on the start day the event runs startTime→midnight; on
        // the end day it runs midnight→endTime; on intermediate days it fills
        // the whole day (00:00→24:00).

        function timeToMinutes(t: string): number {
            const [h, m] = t.split(':').map(Number)
            return h * 60 + m
        }

        function evStartMin(ev: CalendarEvent, dateStr: string): number {
            // If this is not the event's start date, the segment begins at midnight
            return ev.startDate === dateStr ? timeToMinutes(ev.startTime!) : 0
        }

        function evEndMin(ev: CalendarEvent, dateStr: string): number {
            // If this is not the event's end date, the segment runs to midnight (1440)
            if (ev.endDate !== dateStr) return 1440
            // On the end date: use endTime, or default to startTime+60 if same-day no endTime
            if (ev.endTime) return timeToMinutes(ev.endTime)
            // Same-day event with no end time
            return evStartMin(ev, dateStr) + 60
        }

        interface WeekSlot {
            ev: CalendarEvent
            col: number
            totalCols: number
        }

        function layoutForDay(dateStr: string): WeekSlot[] {
            const timedEvs = events
                .filter(e => eventSpansDate(e, dateStr) && !!e.startTime)
                .sort((a, b) => {
                    const d = evStartMin(a, dateStr) - evStartMin(b, dateStr)
                    return d !== 0 ? d : evEndMin(b, dateStr) - evEndMin(a, dateStr)
                })

            const result: WeekSlot[] = []
            let i = 0
            while (i < timedEvs.length) {
                const cluster: CalendarEvent[] = [timedEvs[i]]
                let clusterEnd = evEndMin(timedEvs[i], dateStr)
                let j = i + 1
                while (j < timedEvs.length && evStartMin(timedEvs[j], dateStr) < clusterEnd) {
                    clusterEnd = Math.max(clusterEnd, evEndMin(timedEvs[j], dateStr))
                    cluster.push(timedEvs[j])
                    j++
                }
                const columns: number[] = []
                for (const ev of cluster) {
                    let col = columns.findIndex(end => end <= evStartMin(ev, dateStr))
                    if (col === -1) { col = columns.length; columns.push(0) }
                    columns[col] = evEndMin(ev, dateStr)
                    result.push({ ev, col, totalCols: 0 })
                }
                const numCols = columns.length
                for (let k = result.length - cluster.length; k < result.length; k++) {
                    result[k].totalCols = numCols
                }
                i = j
            }
            return result
        }

        // Pre-compute layouts for all 7 days
        const weekLayouts = Object.fromEntries(dayStrs.map(ds => [ds, layoutForDay(ds)]))

        return (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Column headers */}
                <div className="grid border-b border-gray-200 shrink-0" style={{gridTemplateColumns: '56px repeat(7, 1fr)'}}>
                    <div /> {/* gutter */}
                    {days.map((d, i) => {
                        const ds = dayStrs[i]
                        const isToday = ds === today
                        return (
                            <div key={ds} className="py-2 text-center border-l border-gray-100 first:border-0">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">{DAY_NAMES_SHORT[d.getDay()]}</div>
                                <div className={`
                                    mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold
                                    ${isToday ? 'bg-blue-500 text-white' : 'text-gray-700'}
                                `}>
                                    {d.getDate()}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* All-day row */}
                {dayStrs.some(ds => allDayEventsOnDate(ds).length > 0) && (
                    <div className="grid border-b border-gray-200 shrink-0" style={{gridTemplateColumns: '56px repeat(7, 1fr)'}}>
                        <div className="text-[10px] text-gray-400 text-right pr-2 py-1 self-center">all day</div>
                        {dayStrs.map(ds => (
                            <div key={ds} className="border-l border-gray-100 first:border-0 p-1 flex flex-col gap-0.5 min-h-[28px]"
                                onClick={() => handleDateClick(ds)}>
                                {allDayEventsOnDate(ds).map(ev => (
                                    <button
                                        key={ev.id}
                                        onClick={e => handleEventClick(ev, e)}
                                        className="w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate font-medium text-white"
                                        style={{backgroundColor: ev.color}}
                                    >
                                        {ev.title}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* Timed grid — hour labels on left, one absolute-positioned canvas per day */}
                <div className="flex-1 overflow-y-auto">
                    <div className="grid" style={{gridTemplateColumns: '56px repeat(7, 1fr)'}}>
                        {/* Hour label column */}
                        <div>
                            {HOURS.map(hour => (
                                <div
                                    key={hour}
                                    className="text-[10px] text-gray-400 text-right pr-2 pt-1 border-t border-gray-100"
                                    style={{height: HOUR_HEIGHT}}
                                >
                                    {hour !== 0 && formatHour(hour)}
                                </div>
                            ))}
                        </div>

                        {/* One canvas per day */}
                        {dayStrs.map(ds => {
                            const slots = weekLayouts[ds]
                            return (
                                <div
                                    key={ds}
                                    className="relative border-l border-gray-100 cursor-pointer"
                                    style={{height: HOUR_HEIGHT * 24}}
                                    onClick={() => handleDateClick(ds)}
                                >
                                    {/* Hour stripe backgrounds */}
                                    {HOURS.map(hour => (
                                        <div
                                            key={hour}
                                            className="absolute inset-x-0 border-t border-gray-100 hover:bg-blue-50/40 transition-colors"
                                            style={{top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT}}
                                        />
                                    ))}

                                    {/* Timed events */}
                                    {slots.map(({ev, col, totalCols}) => {
                                        const colW = 100 / totalCols
                                        const GAP = 1
                                        const top = (evStartMin(ev, ds) / 60) * HOUR_HEIGHT
                                        const height = (Math.max(evEndMin(ev, ds) - evStartMin(ev, ds), 30) / 60) * HOUR_HEIGHT
                                        return (
                                            <button
                                                key={ev.id}
                                                onClick={e => handleEventClick(ev, e)}
                                                className="absolute rounded font-medium text-white text-[11px] px-1 py-0.5 text-left overflow-hidden shadow-sm hover:brightness-110 transition-all"
                                                style={{
                                                    backgroundColor: ev.color,
                                                    top,
                                                    height,
                                                    left: `calc(${col * colW}% + ${GAP}px)`,
                                                    width: `calc(${colW}% - ${GAP * 2}px)`,
                                                }}
                                                title={`${ev.startTime}${ev.endTime ? ` – ${ev.endTime}` : ''} · ${ev.title}`}
                                            >
                                                <span className="block font-semibold leading-tight truncate">{ev.title}</span>
                                                <span className="block opacity-80 leading-tight truncate">
                                                    {ev.startTime}{ev.endTime ? `–${ev.endTime}` : ''}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        )
    }

    function renderDay() {
        const dateStr = toDateStr(cursor)
        const isToday = dateStr === today
        const adEvents = allDayEventsOnDate(dateStr)

        const HOUR_HEIGHT = 64 // px per hour

        //
        // Day-aware clipping: on the start date use startTime, otherwise 00:00.
        // On the end date use endTime, otherwise 24:00 (1440 min = fills to midnight).

        function timeToMinutes(t: string): number {
            const [h, m] = t.split(':').map(Number)
            return h * 60 + m
        }

        function eventStartMin(ev: CalendarEvent): number {
            return ev.startDate === dateStr ? timeToMinutes(ev.startTime!) : 0
        }

        function eventEndMin(ev: CalendarEvent): number {
            if (ev.endDate !== dateStr) return 1440
            if (ev.endTime) return timeToMinutes(ev.endTime)
            return eventStartMin(ev) + 60
        }

        function eventTop(ev: CalendarEvent): number {
            return (eventStartMin(ev) / 60) * HOUR_HEIGHT
        }

        function eventHeight(ev: CalendarEvent): number {
            return (Math.max(eventEndMin(ev) - eventStartMin(ev), 30) / 60) * HOUR_HEIGHT
        }

        //
        // 1. Sort events by start time (then by end time descending so longer
        //    events get earlier column slots).
        // 2. Walk through them, grouping into clusters: a cluster is a maximal
        //    set of events where every event overlaps at least one other in
        //    the set. Track the cluster's running end time as the max end seen.
        // 3. Within each cluster, assign each event to the first column slot
        //    where it doesn't collide with an already-placed event.
        // 4. The event's left/width are then (col / totalCols) and (1 / totalCols).

        const timedEvents = events
            .filter(e => eventSpansDate(e, dateStr) && !!e.startTime)
            .sort((a, b) => {
                const ds = eventStartMin(a) - eventStartMin(b)
                return ds !== 0 ? ds : eventEndMin(b) - eventEndMin(a)
            })

        interface LayoutSlot {
            ev: CalendarEvent
            col: number
            totalCols: number
        }

        const layout: LayoutSlot[] = []

        let i = 0
        while (i < timedEvents.length) {
            // Build cluster starting at i
            const cluster: CalendarEvent[] = [timedEvents[i]]
            let clusterEnd = eventEndMin(timedEvents[i])

            let j = i + 1
            while (j < timedEvents.length && eventStartMin(timedEvents[j]) < clusterEnd) {
                clusterEnd = Math.max(clusterEnd, eventEndMin(timedEvents[j]))
                cluster.push(timedEvents[j])
                j++
            }

            // Assign column slots within the cluster
            // columns[c] = end time of the last event placed in column c
            const columns: number[] = []

            for (const ev of cluster) {
                const start = eventStartMin(ev)
                // Find first column where the last event has already ended
                let col = columns.findIndex(endTime => endTime <= start)
                if (col === -1) {
                    col = columns.length
                    columns.push(0)
                }
                columns[col] = eventEndMin(ev)
                layout.push({ ev, col, totalCols: 0 }) // totalCols filled below
            }

            // Now we know how many columns this cluster needs
            const numCols = columns.length
            // Back-fill totalCols for all events in this cluster
            for (let k = layout.length - cluster.length; k < layout.length; k++) {
                layout[k].totalCols = numCols
            }

            i = j
        }

        return (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Header */}
                <div className="border-b border-gray-200 px-4 py-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
                            ${isToday ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}
                        `}>
                            {cursor.getDate()}
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-gray-700">{DAY_NAMES_LONG[cursor.getDay()]}</div>
                            <div className="text-xs text-gray-400">{MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}</div>
                        </div>
                    </div>
                </div>

                {/* All-day events */}
                {adEvents.length > 0 && (
                    <div className="border-b border-gray-200 px-4 py-2 shrink-0 flex flex-col gap-1">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">All day</div>
                        {adEvents.map(ev => (
                            <button
                                key={ev.id}
                                onClick={e => handleEventClick(ev, e)}
                                className="text-left text-sm px-3 py-1.5 rounded-lg font-medium text-white w-full"
                                style={{backgroundColor: ev.color}}
                            >
                                {ev.title}
                            </button>
                        ))}
                    </div>
                )}

                {/* Timed grid */}
                <div className="flex-1 overflow-y-auto">
                    <div className="grid" style={{gridTemplateColumns: '64px 1fr'}}>
                        {/* Hour labels */}
                        <div>
                            {HOURS.map(hour => (
                                <div
                                    key={hour}
                                    className="text-xs text-gray-400 text-right pr-3 pt-1 border-t border-gray-100"
                                    style={{height: HOUR_HEIGHT}}
                                >
                                    {hour !== 0 && formatHour(hour)}
                                </div>
                            ))}
                        </div>

                        {/* Event canvas */}
                        <div
                            className="relative border-l border-gray-100 cursor-pointer"
                            style={{height: HOUR_HEIGHT * 24}}
                            onClick={() => handleDateClick(dateStr)}
                        >
                            {/* Hour stripe backgrounds */}
                            {HOURS.map(hour => (
                                <div
                                    key={hour}
                                    className="absolute inset-x-0 border-t border-gray-100 hover:bg-blue-50/40 transition-colors"
                                    style={{top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT}}
                                />
                            ))}

                            {/* Events — width/left derived from collision layout */}
                            {layout.map(({ev, col, totalCols}) => {
                                const colW = 100 / totalCols
                                const leftPct  = col * colW
                                const widthPct = colW
                                // Small gap between columns so adjacent events are visually separate
                                const GAP = 2 // px
                                return (
                                    <button
                                        key={ev.id}
                                        onClick={e => handleEventClick(ev, e)}
                                        className="absolute rounded-lg font-medium text-white text-sm px-2 py-1 text-left overflow-hidden shadow-sm hover:brightness-110 transition-all"
                                        style={{
                                            backgroundColor: ev.color,
                                            top: eventTop(ev),
                                            height: eventHeight(ev),
                                            left: `calc(${leftPct}% + ${GAP}px)`,
                                            width: `calc(${widthPct}% - ${GAP * 2}px)`,
                                        }}
                                        title={`${ev.startTime}${ev.endTime ? ` – ${ev.endTime}` : ''} · ${ev.title}`}
                                    >
                                        <span className="block font-semibold leading-tight truncate">{ev.title}</span>
                                        <span className="block text-xs opacity-80 leading-tight">
                                            {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-[calc(100vh-57px)]">
            {/* Toolbar */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 shrink-0">
                {/* Navigation */}
                <button
                    onClick={prev}
                    className="text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg px-2 py-1.5 transition-colors text-sm"
                    aria-label="Previous"
                >
                    ‹
                </button>
                <button
                    onClick={next}
                    className="text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg px-2 py-1.5 transition-colors text-sm"
                    aria-label="Next"
                >
                    ›
                </button>
                <button
                    onClick={goToday}
                    className="text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg px-3 py-1.5 transition-colors border border-gray-200"
                >
                    Today
                </button>

                <h2 className="text-sm font-semibold text-gray-800 flex-1">{periodLabel}</h2>

                {/* View switcher */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                    {(['month', 'week', 'day'] as View[]).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-3 py-1.5 capitalize transition-colors ${
                                view === v
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            {v}
                        </button>
                    ))}
                </div>

                {/* Quick create */}
                <button
                    onClick={() => handleDateClick(today)}
                    className="text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-3 py-1.5 transition-colors shrink-0"
                >
                    + New event
                </button>
            </div>

            {/* Calendar body */}
            {view === 'month' && renderMonth()}
            {view === 'week' && renderWeek()}
            {view === 'day'  && renderDay()}

            {/* Modals */}
            {(modalDate || modalEvent) && (
                <EventModal
                    initialDate={modalDate ?? undefined}
                    event={modalEvent ?? undefined}
                    onClose={closeModal}
                />
            )}
        </div>
    )
}