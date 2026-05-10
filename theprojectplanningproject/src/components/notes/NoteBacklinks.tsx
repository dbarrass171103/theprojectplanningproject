import {useMemo, useState, useEffect} from 'react'
import {useKanbanStore} from '../../store/kanbanStore'
import {extractMentionedNoteIds} from '../../utils/Kanbancontent'

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

    // Whether the backlinks list is expanded
    const [isOpen, setIsOpen] = useState(false)
    // Whether the floating button should appear (only when scrolled to bottom)
    const [showButton, setShowButton] = useState(false)

    //Compute backlinks by scanning all cards for @mentions of this note.
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

    if (backlinks.length === 0) return null

    // Deteects when at the bottom of the notes container
    useEffect(() => {
        const container = document.getElementById('notes-scroll-container')
        if (!container) return

        function handleScroll() {
            const atBottom =
                container.scrollTop + container.clientHeight >= container.scrollHeight - 20

            setShowButton(atBottom)
        }

        container.addEventListener('scroll', handleScroll)
        return () => container.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <div className="relative">
            {/* Floating button — appears only when scrolled to bottom */}
            {showButton && (
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
                    Card mentions
                </button>
            )}

            {/* Backlinks list */}
            {isOpen && (
                <ul className="flex flex-col gap-1 px-8 pb-4 pt-4">
                    {backlinks.map(b => (
                        <li
                            key={b.cardId}
                            className="text-sm text-gray-700 flex items-center gap-2"
                        >
                            <span
                                className="
                                    text-xs text-gray-400 bg-white border border-gray-200
                                    rounded px-1.5 py-0.5
                                "
                            >
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
