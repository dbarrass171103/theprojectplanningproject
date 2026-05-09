import {useEditorState, type Editor} from '@tiptap/react'

interface ToolbarButtonProps {
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    label: string
    shortcut?: string
    children: React.ReactNode
}

function ToolbarButton({onClick, isActive, disabled, label, shortcut, children}: ToolbarButtonProps) {
    const title = shortcut ? `${label} (${shortcut})` : label
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-pressed={isActive}
            title={title}
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


const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl'
const shift = isMac ? '⇧' : 'Shift'

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
                isLink: editor.isActive('link'),
                isH1: editor.isActive('heading', {level: 1}),
                isH2: editor.isActive('heading', {level: 2}),
                isH3: editor.isActive('heading', {level: 3}),
                canUndo: editor.can().undo(),
                canRedo: editor.can().redo(),
            }
        },
    })

    if (!editor || !state) return null

    function handleLinkClick() {
        if (!editor) return
        const previousUrl = editor.getAttributes('link').href as string | undefined
        const url = window.prompt('Enter URL', previousUrl ?? 'https://')

        if (url === null) return

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
        }

        editor.chain().focus().extendMarkRange('link').setLink({href: url}).run()
    }

    function handleClearFormatting() {
        if (!editor) return

        editor.chain().focus().unsetAllMarks().clearNodes().run()
    }

    return (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-white sticky top-0 z-10 flex-wrap">
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={state.isBold}
                label="Bold"
                shortcut={`${mod}+B`}
            >
                <strong>B</strong>
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={state.isItalic}
                label="Italic"
                shortcut={`${mod}+I`}
            >
                <em>I</em>
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={state.isStrike}
                label="Strikethrough"
                shortcut={`${mod}+${shift}+S`}
            >
                <s>S</s>
            </ToolbarButton>
            <ToolbarButton
                onClick={handleLinkClick}
                isActive={state.isLink}
                label={state.isLink ? "Edit link" : "Add link"}
                shortcut={`${mod}+K`}
            >
                🔗
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-200 mx-1"/>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}
                isActive={state.isH1}
                label="Heading 1"
                shortcut={`${mod}+Alt+1`}
            >
                H1
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
                isActive={state.isH2}
                label="Heading 2"
                shortcut={`${mod}+Alt+2`}
            >
                H2
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}
                isActive={state.isH3}
                label="Heading 3"
                shortcut={`${mod}+Alt+3`}
            >
                H3
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-200 mx-1"/>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={state.isBulletList}
                label="Bullet list"
                shortcut={`${mod}+${shift}+8`}
            >
                •
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={state.isOrderedList}
                label="Numbered list"
                shortcut={`${mod}+${shift}+7`}
            >
                1.
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-200 mx-1"/>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                isActive={state.isCode}
                label="Inline code"
                shortcut={`${mod}+E`}
            >
                {'<>'}
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                isActive={state.isCodeBlock}
                label="Code block"
                shortcut={`${mod}+Alt+C`}
            >
                {'{ }'}
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={state.isBlockquote}
                label="Blockquote"
                shortcut={`${mod}+${shift}+B`}
            >
                "
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-200 mx-1"/>

            <ToolbarButton
                onClick={handleClearFormatting}
                label="Clear formatting"
            >
                ⌫
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-200 mx-1"/>

            <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!state.canUndo}
                label="Undo"
                shortcut={`${mod}+Z`}
            >
                ↶
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!state.canRedo}
                label="Redo"
                shortcut={`${mod}+${shift}+Z`}
            >
                ↷
            </ToolbarButton>
        </div>
    )
}