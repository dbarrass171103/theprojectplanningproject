// Inline form for adding a card to a kanban column.
//
// The description editor isn't collaborative here: until the card is
// submitted it doesn't exist in the Y.Doc, so there's nothing for peers
// to subscribe to. On submit, the store creates the card and deserialises
// the editor's JSON into the new card's Y.XmlFragment in a single Y.Doc
// transaction, so peers see one atomic appearance.

import {useEffect, useState} from "react"
import {EditorContent, useEditor} from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import {createCardDescriptionExtensions} from '../../tiptap/cardDescriptionExtensions'
import {useKanbanStore} from "../../store/kanbanStore"

interface AddCardFormProps {
    columnId: string
}

export default function AddCardForm({columnId}: AddCardFormProps) {
    const addCardWithDescription = useKanbanStore(s => s.addCardWithDescription)
    const setProseSchema = useKanbanStore(s => s.setProseSchema)

    const [isOpen, setIsOpen] = useState(false)
    const [title, setTitle] = useState('')

    const editor = useEditor({
        extensions: [
            ...createCardDescriptionExtensions(),
            Placeholder.configure({
                placeholder: "Description (optional) — type @ to link a note",
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'prose-editor card-description-editor focus:outline-none text-sm',
            },
            handleKeyDown: (_view, event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    handleSubmit()
                    return true
                }
                if (event.key === 'Escape') {
                    event.preventDefault()
                    setIsOpen(false)
                    return true
                }
                return false
            },
        },
    })

    // Register this editor's ProseMirror schema with the store so it can
    // deserialise description JSON into a Y.XmlFragment on submit. Re-
    // registering on every mount is safe — all AddCardForm instances use
    // the same extension list, so the schema is identical.
    useEffect(() => {
        if (editor) {
            setProseSchema(editor.schema)
        }
    }, [editor, setProseSchema])

    function isEmpty(json: unknown): boolean {
        if (!json || typeof json !== 'object') return true
        return JSON.stringify(json) === JSON.stringify({
            type: 'doc',
            content: [{type: 'paragraph'}],
        })
    }

    function handleSubmit() {
        if (!title.trim()) return

        const json = editor?.getJSON()
        const descriptionJson = json && !isEmpty(json) ? json : null

        addCardWithDescription(columnId, title.trim(), descriptionJson)

        setTitle('')
        editor?.commands.setContent('')
        setIsOpen(false)
    }

    function handleTitleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSubmit()
        }
        if (e.key === 'Escape') setIsOpen(false)
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg px-2 py-1.5 text-sm transition-colors text-left w-full"
            >
                + Add card
            </button>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            <input
                autoFocus
                type="text"
                placeholder="Card title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                className="text-sm rounded-lg border border-gray-300 px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            <div className="rounded-lg border border-gray-300 px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-400">
                <EditorContent editor={editor}/>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleSubmit}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg px-3 py-1.5 transition-colors"
                >
                    Add
                </button>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600 text-sm rounded-lg px-3 py-1.5 transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}
