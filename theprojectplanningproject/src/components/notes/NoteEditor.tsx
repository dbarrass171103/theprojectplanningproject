import {useEditor, EditorContent} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {useEffect, useRef} from 'react'
import type {Note} from '../../types/notes'
import {useNotesStore} from '../../store/notesStore'
import EditorToolbar from './EditorToolbar'

interface NoteEditorProps {
    note: Note
}

export default function NoteEditor({note}: NoteEditorProps) {
    const updateNoteContent = useNotesStore(s => s.updateNoteContent)
    const updateNoteTitle = useNotesStore(s => s.updateNoteTitle)

    const saveTimer = useRef<number | null>(null)

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: "Start writing… (try ** for bold, # for headings)",
            }),
        ],
        content: note.content ?? '',
        onUpdate: ({editor}) => {
            if (saveTimer.current !== null) {
                window.clearTimeout(saveTimer.current)
            }
            saveTimer.current = window.setTimeout(() => {
                updateNoteContent(note.id, editor.getJSON())
            }, 500)
        },
        editorProps: {
            attributes: {
                class: 'prose-editor focus:outline-none min-h-[60vh] px-8 py-6',
            },
        },
    })

    useEffect(() => {
        if (!editor) return
        const current = editor.getJSON()
        const incoming = note.content ?? {type: 'doc', content: [{type: 'paragraph'}]}
        if (JSON.stringify(current) !== JSON.stringify(incoming)) {
            editor.commands.setContent(incoming as never, {emitUpdate: false})
        }
    }, [note.id, editor])

    useEffect(() => {
        return () => {
            if (saveTimer.current !== null) {
                window.clearTimeout(saveTimer.current)
                saveTimer.current = null
            }
        }
    }, [note.id])

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <EditorToolbar editor={editor}/>
            <input
                type="text"
                value={note.title}
                onChange={e => updateNoteTitle(note.id, e.target.value)}
                placeholder="Untitled"
                className="text-3xl font-bold text-gray-800 px-8 pt-8 pb-2 focus:outline-none bg-transparent placeholder-gray-300"
            />
            <EditorContent editor={editor} className="flex-1"/>
        </div>
    )
}