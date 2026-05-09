import {useEditor, EditorContent} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import {useEffect, useRef, useState} from 'react'
import type {Note} from '../../types/notes'
import {useNotesStore} from '../../store/notesStore'
import EditorToolbar from './EditorToolbar'

interface NoteEditorProps {
    note: Note
}

type SaveStatus = 'idle' | 'saving' | 'saved'

export default function NoteEditor({note}: NoteEditorProps) {
    const updateNoteContent = useNotesStore(s => s.updateNoteContent)
    const updateNoteTitle = useNotesStore(s => s.updateNoteTitle)

    const saveTimer = useRef<number | null>(null)
    const savedFlashTimer = useRef<number | null>(null)
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: "Start writing… (try ** for bold, # for headings)",
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
        },
    })

    useEffect(() => {
        return () => {
            if (saveTimer.current !== null) {
                window.clearTimeout(saveTimer.current)
            }
            if (savedFlashTimer.current !== null) {
                window.clearTimeout(savedFlashTimer.current)
            }
        }
    }, [])

    function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault()
            editor?.commands.focus('start')
        }
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto">
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