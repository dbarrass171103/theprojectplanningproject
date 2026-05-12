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

    const [isOpen, setIsOpen] = useState(false)
    // Whether the scroll container is at (or near) the bottom.
    const [atBottom, setAtBottom] = useState(false)

    // Compute backlinks by scanning all cards for @mentions of this note.
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

    // All hooks must be called before any conditional return.
    // This effect detects when the user is near the bottom of the notes
    // scroll container so we can show the floating button.
    useEffect(() => {
        const container = document.getElementById('notes-scroll-container')
        if (!container) return

        function handleScroll() {
            if (!container) return
            const nearBottom =
                container.scrollTop + container.clientHeight >= container.scrollHeight - 20
            setAtBottom(nearBottom)
        }

        // Run once on mount so the button appears immediately if the note is
        // short enough that the container never scrolls.
        handleScroll()

        container.addEventListener('scroll', handleScroll)
        return () => container.removeEventListener('scroll', handleScroll)
    }, [])

    // Close the list whenever the note changes.
    useEffect(() => {
        setIsOpen(false)
    }, [noteId])

    if (backlinks.length === 0) return null

    return (
        <div className="relative">
            {/* Show button when at the bottom OR when the list is already open.
                Previously the button only appeared when scrolled to the bottom,
                which meant it was permanently hidden on short notes. */}
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