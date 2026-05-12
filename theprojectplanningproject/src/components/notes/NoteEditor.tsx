import {useEditor, EditorContent} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {TextAlign} from '@tiptap/extension-text-align'
import {TextStyleKit} from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import * as Y from 'yjs'
import {Awareness} from 'y-protocols/awareness'
import {useEffect, useMemo, useRef, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import type {Note} from '../../types/notes'
import {useNotesStore} from '../../store/notesStore'
import {useKanbanStore} from '../../store/kanbanStore'
import {useCurrentProject, type KnownProject} from '../../store/projectsStore'
import {getSupabaseForProject} from '../../lib/supabase'
import {SupabaseYjsProvider} from '../../sync/SupabaseYjsProvider'
import {colorForName} from '../../utils/userColor'
import {CardMention} from '../../tiptap/CardMention'
import {createCardMentionSuggestion} from '../../tiptap/cardMentionSuggestion'
import EditorToolbar from './EditorToolbar'
import EditorBubbleMenu from './EditorBubbleMenu'
import NoteBacklinks from './NoteBacklinks'

interface NoteEditorProps {
    note: Note
}

const TITLE_FIELD = 'title'

// Outer wrapper — owns Y.Doc + provider lifecycle, waits for sync, then mounts
// SyncedNoteEditor with a populated doc.
export default function NoteEditor({note}: NoteEditorProps) {
    const project = useCurrentProject()
    const doc = useMemo(() => new Y.Doc(), [])
    const awareness = useMemo(() => new Awareness(doc), [doc])
    const [synced, setSynced] = useState(false)
    const providerRef = useRef<SupabaseYjsProvider | null>(null)

    useEffect(() => {
        if (!project) return

        const client = getSupabaseForProject(project.memberToken, project.adminToken)
        const user = {
            name: project.displayName,
            color: colorForName(project.displayName),
        }

        const provider = new SupabaseYjsProvider({
            client,
            projectId: project.id,
            noteId: note.id,
            doc,
            awareness,
            user,
            onSync: () => setSynced(true),
        })
        providerRef.current = provider
        void provider.connect()

        return () => {
            provider.destroy()
            providerRef.current = null
            // DO NOT call doc.destroy() here. The provider captures the
            // doc state synchronously during destroy() and fire-and-forgets
            // the upload. Destroying the doc here would race with the
            // upload's encoding step.
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project?.id, note.id])

    if (!project) {
        return null
    }

    if (!synced) {
        return (
            <div className="flex flex-col h-full overflow-y-auto">
                <div className="px-8 pt-8 pb-2">
                    <input
                        type="text"
                        value=""
                        disabled
                        placeholder="Loading…"
                        className="text-3xl font-bold text-gray-300 focus:outline-none bg-transparent w-full"
                    />
                </div>
                <div className="px-8 py-6 text-sm text-gray-400">
                    Loading note…
                </div>
            </div>
        )
    }

    return (
        <SyncedNoteEditor
            note={note}
            project={project}
            doc={doc}
            awareness={awareness}
        />
    )
}

interface SyncedProps {
    note: Note
    project: KnownProject
    doc: Y.Doc
    awareness: Awareness
}

function SyncedNoteEditor({note, project, doc, awareness}: SyncedProps) {
    const updateNoteTitle = useNotesStore(s => s.updateNoteTitle)
    const setActiveNoteTitle = useNotesStore(s => s.setActiveNoteTitle)
    const navigate = useNavigate()

    const [titleValue, setTitleValue] = useState('')

    useEffect(() => {
        const yTitle = doc.getText(TITLE_FIELD)

        const sync = () => {
            const v = yTitle.toString()
            setTitleValue(v)
            setActiveNoteTitle(note.id, v || 'Untitled')
        }

        sync()
        yTitle.observe(sync)
        return () => {
            yTitle.unobserve(sync)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc, note.id])

    function handleTitleChange(newValue: string) {
        const yTitle = doc.getText(TITLE_FIELD)
        const current = yTitle.toString()
        if (current === newValue) return

        doc.transact(() => {
            yTitle.delete(0, current.length)
            yTitle.insert(0, newValue)
        })
    }

    const editor = useEditor({
        extensions: [
            // StarterKit v3 already includes Link and Underline — we do NOT
            // import them separately, which previously caused "Duplicate
            // extension names" warnings and silent content drops during
            // Yjs schema reconciliation.
            StarterKit.configure({
                undoRedo: false,
                link: {
                    openOnClick: false,
                    autolink: true,
                    HTMLAttributes: {
                        rel: 'noopener noreferrer',
                        target: '_blank',
                        class: 'editor-link',
                    },
                },
            }),
            TextAlign.configure({types: ['heading', 'paragraph']}),
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
                placeholder: "Start writing… (try ** for bold, # for headings, @ to link a card)",
            }),
            CardMention.configure({suggestion: createCardMentionSuggestion()}),
            Collaboration.configure({document: doc}),
            CollaborationCaret.configure({
                provider: {awareness} as never,
                user: {
                    name: project.displayName,
                    color: colorForName(project.displayName),
                },
            }),
        ],
        editorProps: {
            attributes: {
                class: 'prose-editor focus:outline-none min-h-[60vh] px-8 py-6',
            },
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc, awareness, project.displayName])

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

    function handleTitleBlur() {
        updateNoteTitle(note.id, titleValue || 'Untitled')
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <EditorToolbar editor={editor}/>

            <div className="px-8 pt-8 pb-2">
                <input
                    type="text"
                    value={titleValue}
                    onChange={e => handleTitleChange(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    onBlur={handleTitleBlur}
                    placeholder="Untitled"
                    className="text-3xl font-bold text-gray-800 focus:outline-none bg-transparent placeholder-gray-300 w-full"
                />
            </div>

            <EditorContent editor={editor} className="flex-1"/>

            <EditorBubbleMenu editor={editor}/>

            <NoteBacklinks noteId={note.id}/>
        </div>
    )
}