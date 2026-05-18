// Cards-that-mention-this-note panel, shown at the bottom of NoteEditor.

import {useMemo, useState, useEffect} from 'react'
import {useKanbanStore} from '../../store/kanbanStore'
import {extractMentionedNoteIds} from "../../utils/kanbanContent.ts";

interface NoteBacklinksProps {
    noteId: string
}

interface BacklinkEntry {
    cardId: string
    cardTitle: string
    columnTitle: string
}

export default function NoteBacklinks({noteId}: NoteBacklinksProps) {
    const board = useKanbanStore(s => s.board)

    const [isOpen, setIsOpen] = useState(false)
    const [atBottom, setAtBottom] = useState(false)

    const backlinks = useMemo<BacklinkEntry[]>(() => {
        const result: BacklinkEntry[] = []

        for (const column of board.columns) {
            for (const cardId of column.cardIds) {
                const card = board.cards[cardId]
                if (!card?.description) continue

                const mentioned = extractMentionedNoteIds(card.description)
                if (mentioned.includes(noteId)) {
                    result.push({
                        cardId: card.id,
                        cardTitle: card.title,
                        columnTitle: column.title,
                    })
                }
            }
        }

        return result
    }, [board, noteId])

    // Detect when the notes container is near the bottom. Re-typed as
    // HTMLElement after the null guard so the closure doesn't see it as
    // possibly null.
    useEffect(() => {
        const el: HTMLElement | null = document.getElementById('notes-scroll-container')
        if (!el) return

        const container: HTMLElement = el

        function handleScroll() {
            const nearBottom =
                container.scrollTop + container.clientHeight >= container.scrollHeight - 20
            setAtBottom(nearBottom)
        }

        handleScroll()
        container.addEventListener('scroll', handleScroll)
        return () => container.removeEventListener('scroll', handleScroll)
    }, [])

    // No need to reset isOpen on note change: NoteEditor is keyed by
    // note.id in NotesPage, so this component remounts on switch.

    if (backlinks.length === 0) return null

    return (
        <div className="relative">
            {(atBottom || isOpen) && (
                <button
                    type="button"
                    onClick={() => setIsOpen(o => !o)}
                    className="
                        absolute bottom-4 right-4
                        bg-gray-800 text-white
                        px-4 py-2 rounded-full shadow-lg
                        text-xs font-semibold tracking-wide
                        hover:bg-gray-600 active:bg-gray-400
                        transition-all
                        z-20
                    "
                >
                    {isOpen ? 'Hide mentions' : `Card mentions (${backlinks.length})`}
                </button>
            )}

            {isOpen && (
                <ul className="flex flex-col gap-1 px-8 pb-16 pt-4">
                    {backlinks.map(b => (
                        <li
                            key={b.cardId}
                            className="text-sm text-gray-700 flex items-center gap-2"
                        >
                            <span className="text-xs text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5">
                                {b.columnTitle}
                            </span>
                            <span>{b.cardTitle || 'Untitled card'}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
