import {useEditor, EditorContent} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import {TextAlign} from '@tiptap/extension-text-align'
import {TextStyleKit} from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import {useEffect, useRef, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import type {Note} from '../../types/notes'
import {useNotesStore} from '../../store/notesStore'
import {useKanbanStore} from '../../store/kanbanStore'
import {CardMention} from '../../tiptap/CardMention'
import {createCardMentionSuggestion} from '../../tiptap/cardMentionSuggestion'
import EditorToolbar from './EditorToolbar'
import EditorBubbleMenu from './EditorBubbleMenu'
import NoteBacklinks from './NoteBacklinks'

interface NoteEditorProps {
    note: Note
}

type SaveStatus = 'idle' | 'saving' | 'saved'

export default function NoteEditor({note}: NoteEditorProps) {
    const updateNoteContent = useNotesStore(s => s.updateNoteContent)
    const updateNoteTitle = useNotesStore(s => s.updateNoteTitle)
    const navigate = useNavigate()

    const saveTimer = useRef<number | null>(null)
    const savedFlashTimer = useRef<number | null>(null)
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

    // Tiptap editor setup
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            TextStyleKit.configure({
                fontSize: false,
                fontFamily: false,
                lineHeight: false,
                backgroundColor: false,
            }),
            Highlight.configure({multicolor: true}),
            Superscript,
            Subscript,
            Placeholder.configure({
                placeholder: "Start writing…",
            }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                HTMLAttributes: {
                    rel: 'noopener noreferrer',
                    target: '_blank',
                    class: 'editor-link',
                },
            }),
            CardMention.configure({
                suggestion: createCardMentionSuggestion(),
            }),
        ],
        content: note.content ?? '',
        onUpdate: ({editor}) => {
            setSaveStatus('saving')

            if (saveTimer.current !== null) {
                window.clearTimeout(saveTimer.current)
            }

            saveTimer.current = window.setTimeout(() => {
                updateNoteContent(note.id, editor.getJSON())
                setSaveStatus('saved')

                if (savedFlashTimer.current !== null) {
                    window.clearTimeout(savedFlashTimer.current)
                }

                savedFlashTimer.current = window.setTimeout(() => {
                    setSaveStatus('idle')
                }, 1500)
            }, 500)
        },
        editorProps: {
            attributes: {
                class: 'prose-editor focus:outline-none min-h-[60vh] px-8 py-6',
            },
            // Clicking a card mention navigates to the board
            handleClickOn: (_view, _pos, _node, _nodePos, event) => {
                const target = event.target as HTMLElement | null
                const chipEl = target?.closest('[data-card-mention]') as HTMLElement | null
                if (!chipEl) return false

                const cardId = chipEl.getAttribute('data-card-id')
                if (!cardId) return false

                const {board} = useKanbanStore.getState()
                if (!board.cards[cardId]) {
                    event.preventDefault()
                    return true
                }

                event.preventDefault()
                navigate('/', {state: {flashCardId: cardId}})
                return true
            },
        },
    })

   // Cleanup timers
    useEffect(() => {
        return () => {
            if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
            if (savedFlashTimer.current !== null) window.clearTimeout(savedFlashTimer.current)
        }
    }, [])

    // Styling for non-existent cards.
    useEffect(() => {
        if (!editor) return

        function applyStaleClasses() {
            const root = editor?.view.dom
            if (!root) return

            const {board} = useKanbanStore.getState()
            const chips = root.querySelectorAll<HTMLElement>('[data-card-mention]')

            chips.forEach(chip => {
                const id = chip.getAttribute('data-card-id')
                const isStale = !id || !board.cards[id]
                chip.classList.toggle('stale', isStale)
            })
        }

        applyStaleClasses()
        const unsubscribe = useKanbanStore.subscribe(applyStaleClasses)
        editor.on('update', applyStaleClasses)

        return () => {
            unsubscribe()
            editor.off('update', applyStaleClasses)
        }
    }, [editor])

    function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault()
            editor?.commands.focus('start')
        }
    }

    return (
        <div
            id="notes-scroll-container"
            className="flex flex-col h-full overflow-y-auto relative"
        >
            <EditorToolbar editor={editor}/>

            <div className="flex items-center justify-between px-8 pt-8 pb-2 gap-4">
                <input
                    type="text"
                    value={note.title}
                    onChange={e => updateNoteTitle(note.id, e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    placeholder="Untitled"
                    className="text-3xl font-bold text-gray-800 focus:outline-none bg-transparent placeholder-gray-300 flex-1 min-w-0"
                />
                <SaveIndicator status={saveStatus}/>
            </div>

            <EditorContent editor={editor} className="flex-1"/>

            <EditorBubbleMenu editor={editor}/>

            <NoteBacklinks noteId={note.id}/>
        </div>
    )
}

function SaveIndicator({status}: {status: SaveStatus}) {
    return (
        <div className="text-xs text-gray-400 shrink-0 w-16 text-right transition-opacity duration-300">
            {status === 'saving' && <span>Saving…</span>}
            {status === 'saved' && <span className="text-green-500">Saved</span>}
        </div>
    )
}
