// Read-only Tiptap editor for displaying a card's description.
//
// A read-only Tiptap instance with the same extension list as the editor
// means every mark and node type the editor can produce is rendered here
// too — including any extensions added in the future. The previous
// hand-rolled JSON walker silently dropped any formatting it didn't know
// about (strikethrough, underline, highlight, etc.).

import {useEffect} from 'react'
import {useEditor, EditorContent, type JSONContent} from '@tiptap/react'
import {createCardDescriptionExtensions} from '../../tiptap/cardDescriptionExtensions'
import {useNavigate, useParams} from 'react-router-dom'
import {useNotesStore} from '../../store/notesStore'

interface CardDescriptionDisplayProps {
    doc: JSONContent
}

export default function CardDescriptionDisplay({doc}: CardDescriptionDisplayProps) {
    const notes = useNotesStore(s => s.notes)
    const navigate = useNavigate()
    const {projectId} = useParams<{ projectId: string }>()

    const editor = useEditor({
        editable: false,

        // Mirror CardDescriptionEditor's extension list (minus Collaboration
        // and Placeholder, which are editor-only concerns). NoteMention
        // without .configure() uses the default suggestion (items: () => [])
        // which is inert in a non-editable editor.
        extensions: createCardDescriptionExtensions({mentionSuggestion: false}),

        content: (doc as JSONContent) ?? null,

        editorProps: {
            attributes: {
                class: 'card-description-display focus:outline-none',
            },
        },
    })

    // Push description updates (from remote collaborators) into the editor.
    // emitUpdate: false applies the new content without firing an 'update'
    // event, avoiding any potential feedback loop.
    useEffect(() => {
        if (!editor || editor.isDestroyed || !doc) return
        editor.commands.setContent(doc as JSONContent, {emitUpdate: false})
    }, [editor, doc])

    // Keep @note chips visually in sync with the live notes store. Reads
    // state imperatively inside the callback so the closure is never stale.
    useEffect(() => {
        if (!editor) return

        function applyChipState() {
            if (editor.isDestroyed) return
            const currentNotes = useNotesStore.getState().notes

            editor.view.dom
                .querySelectorAll<HTMLElement>('[data-note-mention]')
                .forEach(chip => {
                    const noteId = chip.getAttribute('data-note-id')
                    const note = noteId ? currentNotes[noteId] : undefined
                    const isStale = !note

                    chip.classList.toggle('stale', isStale)
                    chip.setAttribute('aria-disabled', String(isStale))
                    chip.setAttribute(
                        'title',
                        isStale
                            ? 'This note has been deleted'
                            : `Open ${note!.title || 'Untitled'}`,
                    )
                })
        }

        applyChipState()
        editor.on('update', applyChipState)
        const unsubNotes = useNotesStore.subscribe(applyChipState)

        return () => {
            editor.off('update', applyChipState)
            unsubNotes()
        }
    }, [editor])

    return (
        <div
            className="text-xs text-gray-500 leading-snug break-words"
            onPointerDown={(e) => {
                // Stop dnd-kit stealing the pointer when a mention chip
                // is pressed.
                if ((e.target as HTMLElement).closest('[data-note-mention]')) {
                    e.stopPropagation()
                }
            }}
            onClick={(e) => {
                // Event delegation: handle chip clicks anywhere in the
                // description without per-node React handlers.
                const chip = (e.target as HTMLElement)
                    .closest('[data-note-mention]') as HTMLElement | null
                if (!chip) return

                e.stopPropagation()

                const noteId = chip.getAttribute('data-note-id')
                if (!noteId) return

                const note = notes[noteId]
                if (!note) return // stale chip — click is a no-op

                useNotesStore.getState().selectNote(noteId)
                navigate(`/p/${projectId}/notes`)
            }}
        >
            <EditorContent editor={editor}/>
        </div>
    )
}
