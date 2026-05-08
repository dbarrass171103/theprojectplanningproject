import {useEditorState, type Editor} from '@tiptap/react'

interface ToolbarButtonProps {
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    label: string
    children: React.ReactNode
}

function ToolbarButton({onClick, isActive, disabled, label, children}: ToolbarButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            className={`
                px-2 py-1 text-sm rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                ${isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }
            `}
        >
            {children}
        </button>
    )
}

interface EditorToolbarProps {
    editor: Editor | null
}

export default function EditorToolbar({editor}: EditorToolbarProps) {
    const state = useEditorState({
        editor,
        selector: ({editor}) => {
            if (!editor) return null
            return {
                isBold: editor.isActive('bold'),
                isItalic: editor.isActive('italic'),
                isStrike: editor.isActive('strike'),
                isCode: editor.isActive('code'),
                isCodeBlock: editor.isActive('codeBlock'),
                isBlockquote: editor.isActive('blockquote'),
                isBulletList: editor.isActive('bulletList'),
                isOrderedList: editor.isActive('orderedList'),
                isH1: editor.isActive('heading', {level: 1}),
                isH2: editor.isActive('heading', {level: 2}),
                isH3: editor.isActive('heading', {level: 3}),
                canUndo: editor.can().undo(),
                canRedo: editor.can().redo(),
            }
        },
    })

    if (!editor || !state) return null

    return (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-white sticky top-0 z-10 flex-wrap">
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={state.isBold}
                label="Bold"
            >
                <strong>B</strong>
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={state.isItalic}
                label="Italic"
            >
                <em>I</em>
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={state.isStrike}
                label="Strikethrough"
            >
                <s>S</s>
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-200 mx-1"/>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}
                isActive={state.isH1}
                label="Heading 1"
            >
                H1
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
                isActive={state.isH2}
                label="Heading 2"
            >
                H2
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}
                isActive={state.isH3}
                label="Heading 3"
            >
                H3
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-200 mx-1"/>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={state.isBulletList}
                label="Bullet list"
            >
                •
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={state.isOrderedList}
                label="Numbered list"
            >
                1.
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-200 mx-1"/>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                isActive={state.isCode}
                label="Inline code"
            >
                {'<>'}
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                isActive={state.isCodeBlock}
                label="Code block"
            >
                {'{ }'}
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={state.isBlockquote}
                label="Blockquote"
            >
                "
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-200 mx-1"/>

            <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!state.canUndo}
                label="Undo"
            >
                ↶
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!state.canRedo}
                label="Redo"
            >
                ↷
            </ToolbarButton>
        </div>
    )
}