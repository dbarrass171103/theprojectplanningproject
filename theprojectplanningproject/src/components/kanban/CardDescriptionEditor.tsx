import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {NoteMention} from '../../tiptap/NoteMention'
import {createNoteMentionSuggestion} from '../../tiptap/noteMentionSuggestion'
import {useEffect} from 'react'

/**
 * Props for the card description editor.
 * - initialContent: TipTap JSON or null
 * - onChange: called whenever the editor content updates
 * - onSubmit: optional callback for Cmd/Ctrl + Enter
 * - onCancel: optional callback for Escape
 * - autoFocus: whether to focus the editor on mount
 * - placeholder: placeholder text for empty editor
 */
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
            // StarterKit provides basic formatting (bold, italic, lists) which can be activated with hotkeys for now.
            // Other features disabled as not necessary
            StarterKit.configure({
                heading: false,
                codeBlock: false,
                blockquote: false,
                horizontalRule: false,
            }),

            // Placeholder text when the editor is empty.
            Placeholder.configure({placeholder}),

            // Custom @note mention extension with suggestion dropdown.
            NoteMention.configure({
                suggestion: createNoteMentionSuggestion(),
            }),
        ],

        // Initial content for the editor.
        content: initialContent ?? '',

        // Auto-focus behaviour (goes to the end of the line).
        autofocus: autoFocus ? 'end' : false,

        // Called whenever the editor content changes.
        onUpdate: ({editor}) => {
            onChange(editor.getJSON())
        },

        // Editor DOM behaviour
        editorProps: {
            attributes: {
                class: 'prose-editor card-description-editor focus:outline-none text-sm',
            },

            // Custom keyboard shortcuts.
            handleKeyDown: (_view, event) => {
                // Cmd/Ctrl + Enter submits
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    onSubmit?.()
                    return true
                }

                // Escape cancels.
                if (event.key === 'Escape') {
                    event.preventDefault()
                    onCancel?.()
                    return true
                }

                return false
            },
        },
    })

    // Sync external changes to initial content.
    useEffect(() => {
        if (!editor) return

        const current = editor.getJSON()
        const emptyDoc = {type: 'doc', content: [{type: 'paragraph'}]}

        // Only update if the content actually differs.
        if (JSON.stringify(current) !== JSON.stringify(initialContent ?? emptyDoc)) {
            editor.commands.setContent((initialContent ?? '') as never, {emitUpdate: false})
        }
    }, [editor, JSON.stringify(initialContent)])

    // Render the TipTap editor.
    return <EditorContent editor={editor}/>
}
