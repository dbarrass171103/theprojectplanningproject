// Collaborative note editor bound to a Y.Doc. The outer component gates on
// sync state; SyncedNoteEditor wires up the actual editor once the doc is
// ready.

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
import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import type {Note} from '../../types/notes'
import {useNotesStore} from '../../store/notesStore'
import {useKanbanStore} from '../../store/kanbanStore'
import {useCurrentProject, type KnownProject} from '../../store/projectsStore'
import {useSyncedYDoc} from '../../sync/useSyncedYDoc'
import {colorForName} from '../../utils/userColor'
import {CardMention} from '../../tiptap/CardMention'
import {createCardMentionSuggestion} from '../../tiptap/cardMentionSuggestion'
import {ResizableImage} from '../../tiptap/ResizableImage'
import {uploadNoteImage, ImageUploadError} from '../../utils/uploadNoteImage'
import EditorToolbar from './EditorToolbar'
import EditorBubbleMenu from './EditorBubbleMenu'
import NoteBacklinks from './NoteBacklinks'
import {useImageCleanup} from './useImageCleanup'

interface NoteEditorProps {
    note: Note
}

const TITLE_FIELD = 'title'

export default function NoteEditor({note}: NoteEditorProps) {
    const project = useCurrentProject()

    const {doc, awareness, synced} = useSyncedYDoc({
        project,
        docKey: note.id,
        channelPrefix: 'note',
        snapshotTable: 'note_documents',
    })

    if (!project) return null

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

    // Keep the title input in sync with the Y.Text.
    useEffect(() => {
        const yTitle = doc.getText(TITLE_FIELD)

        const sync = () => {
            const v = yTitle.toString()
            setTitleValue(v)
            setActiveNoteTitle(note.id, v || 'Untitled')
        }

        sync()
        yTitle.observe(sync)
        return () => yTitle.unobserve(sync)
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
            // URL-only image attribute. Base64 would bloat the Y.Doc
            // snapshot we write to Postgres on every debounced update,
            // and one large image could push us past the row size limit.
            ResizableImage.configure({
                allowBase64: false,
                inline: false,
                HTMLAttributes: {class: 'editor-image'},
            }),
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
            // Intercept clicks on card-mention chips: navigate to the
            // board and flash the target card.
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
            // Paste images from the clipboard: upload them, then insert
            // each one at the current selection.
            handlePaste: (_view, event) => {
                const files = Array.from(event.clipboardData?.files ?? [])
                    .filter(f => f.type.startsWith('image/'))
                if (files.length === 0) return false

                event.preventDefault()
                insertImageFiles(files, project, note.id, editor)
                return true
            },
            // Drag-and-drop image files from the OS into the editor.
            // `moved` is true when ProseMirror is dragging a node from
            // within the doc; we leave those alone.
            handleDrop: (_view, event, _slice, moved) => {
                if (moved) return false

                const dragEvent = event as DragEvent
                const files = Array.from(dragEvent.dataTransfer?.files ?? [])
                    .filter(f => f.type.startsWith('image/'))
                if (files.length === 0) return false

                event.preventDefault()
                insertImageFiles(files, project, note.id, editor)
                return true
            },
        },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc, awareness, project.displayName])

    // Mark card mentions whose target has been deleted so they render as
    // stale. Subscribes to both editor 'update' (chip might be inserted)
    // and kanbanStore (card might be deleted).
    useEffect(() => {
        if (!editor) return

        function applyStaleClasses() {
            const root = editor.view.dom
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

    // Diff image URLs across editor updates and delete orphans from
    // storage. Deferred so undo can rescue an accidentally-removed
    // image before the file is actually gone.
    useImageCleanup(editor, project)

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
            <EditorToolbar editor={editor} project={project} noteId={note.id}/>

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

// Upload each file and insert it at the current selection in order.
// Failures use window.alert — crude, but it matches handleLinkClick's
// existing prompt-based UX and we don't have a toast system yet.
function insertImageFiles(
    files: File[],
    project: KnownProject,
    noteId: string,
    editor: ReturnType<typeof useEditor>,
): void {
    if (!editor) return

    files.forEach(async file => {
        try {
            const url = await uploadNoteImage(file, project, noteId)
            editor.chain().focus().setImage({src: url}).run()
        } catch (e) {
            const message = e instanceof ImageUploadError
                ? e.message
                : 'Failed to upload image'
            console.error(e)
            window.alert(message)
        }
    })
}