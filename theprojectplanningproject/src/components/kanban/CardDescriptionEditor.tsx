import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {NoteMention} from '../../tiptap/NoteMention'
import {createNoteMentionSuggestion} from '../../tiptap/noteMentionSuggestion'
import {useEffect, useRef} from 'react'

interface CardDescriptionEditorProps {
    initialContent: unknown
    onChange: (doc: unknown) => void
    onSubmit?: () => void
    onCancel?: () => void
    autoFocus?: boolean
    placeholder?: string
}

export default function CardDescriptionEditor({
    initialContent,
    onChange,
    onSubmit,
    onCancel,
    autoFocus,
    placeholder = "Description...",
}: CardDescriptionEditorProps) {

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,
                codeBlock: false,
                blockquote: false,
                horizontalRule: false,
            }),
            Placeholder.configure({placeholder}),
            NoteMention.configure({
                suggestion: createNoteMentionSuggestion(),
            }),
        ],

        content: initialContent ?? '',
        autofocus: autoFocus ? 'end' : false,

        onUpdate: ({editor}) => {
            onChange(editor.getJSON())
        },

        editorProps: {
            attributes: {
                class: 'prose-editor card-description-editor focus:outline-none text-sm',
            },

            handleKeyDown: (_view, event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    onSubmit?.()
                    return true
                }
                if (event.key === 'Escape') {
                    event.preventDefault()
                    onCancel?.()
                    return true
                }
                return false
            },
        },
    })

    // Track previous initialContent with a ref to avoid putting
    // JSON.stringify in the dependency array, which creates a new string on
    // every render and can cause infinite update loops.
    const prevContentRef = useRef<unknown>(initialContent)

    useEffect(() => {
        if (!editor) return

        const prev = prevContentRef.current
        prevContentRef.current = initialContent

        const emptyDoc = {type: 'doc', content: [{type: 'paragraph'}]}
        const incoming = initialContent ?? emptyDoc

        // Only update if the incoming content is actually different from what
        // the editor currently shows. Avoids clobbering the user's cursor.
        if (JSON.stringify(prev) !== JSON.stringify(incoming)) {
            editor.commands.setContent(incoming as never, {emitUpdate: false})
        }
    }, [editor, initialContent])

    return <EditorContent editor={editor}/>
}