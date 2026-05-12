// The always-visible top toolbar of the note editor.
//
// Includes everything in the editor's command set: marks, headings, lists,
// alignment, colours, links, code, undo/redo. The bubble menu (which floats
// over selected text) is a subset of these — block-level actions like
// "Heading 1" only live here.
//
// Buttons show tooltips with their keyboard shortcuts, formatted differently
// for Mac (⌘) vs other platforms (Ctrl).

import {useEditorState, type Editor} from '@tiptap/react'
import ColorPickerButton from './ColorPickerButton'
import {TEXT_COLOR_SWATCHES, HIGHLIGHT_SWATCHES} from './ColorSwatches'

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
            // preventDefault on mousedown keeps the editor's selection alive.
            // Without it, clicking the button would blur the editor and
            // formatting commands would have nothing to operate on.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-pressed={isActive}
            title={title}
            className={`
                px-2 py-1 text-sm rounded transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed
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

// Platform-specific shortcut display. Mac uses ⌘/⇧ glyphs; others use the
// words "Ctrl"/"Shift". Tiptap itself binds both Cmd and Ctrl to the same
// commands so the actual keys work either way.
const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform)

const mod = isMac ? '⌘' : 'Ctrl'
const shift = isMac ? '⇧' : 'Shift'

export default function EditorToolbar({editor}: EditorToolbarProps) {
    // useEditorState subscribes to the editor and only re-renders the
    // toolbar when one of these selected values changes. Without it,
    // the toolbar would re-render on every keystroke.
    const state = useEditorState({
        editor,
        selector: ({editor}) => {
            if (!editor) return null
            return {
                isBold: editor.isActive('bold'),
                isItalic: editor.isActive('italic'),
                isStrike: editor.isActive('strike'),
                isUnderline: editor.isActive('underline'),
                isCode: editor.isActive('code'),
                isCodeBlock: editor.isActive('codeBlock'),
                isBlockquote: editor.isActive('blockquote'),
                isBulletList: editor.isActive('bulletList'),
                isOrderedList: editor.isActive('orderedList'),
                isLink: editor.isActive('link'),
                isSuperscript: editor.isActive('superscript'),
                isSubscript: editor.isActive('subscript'),
                isH1: editor.isActive('heading', {level: 1}),
                isH2: editor.isActive('heading', {level: 2}),
                isH3: editor.isActive('heading', {level: 3}),
                alignLeft: editor.isActive({textAlign: 'left'}),
                alignCenter: editor.isActive({textAlign: 'center'}),
                alignRight: editor.isActive({textAlign: 'right'}),
                currentColor:
                    (editor.getAttributes('textStyle').color as string | undefined) ?? null,
                currentHighlight:
                    (editor.getAttributes('highlight').color as string | undefined) ?? null,
                canUndo: editor.can().undo(),
                canRedo: editor.can().redo(),
            }
        },
    })

    if (!editor || !state) return null

    // Three-state link prompt: cancel → no-op, empty → unset, anything else
    // → apply. extendMarkRange makes the action operate on the whole link
    // mark even if only part of it is selected.
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

    // Strip marks AND structural nodes — returns the selection to plain text.
    function handleClearFormatting() {
        if (!editor) return
        editor.chain().focus().unsetAllMarks().clearNodes().run()
    }

    return (
        <div className="
            flex items-center gap-1 px-3 py-2 border-b border-gray-200
            bg-white sticky top-0 z-10 flex-wrap
        ">
            {/* Inline marks */}
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
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={state.isUnderline}
                label="Underline"
                shortcut={`${mod}+U`}
            >
                <u>U</u>
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

            {/* Colours */}
            <ColorPickerButton
                label="Text colour"
                icon={<span className="text-sm font-bold">A</span>}
                swatches={TEXT_COLOR_SWATCHES}
                currentColor={state.currentColor}
                onSelect={(color) => editor.chain().focus().setColor(color).run()}
                onClear={() => editor.chain().focus().unsetColor().run()}
                isActive={!!state.currentColor}
            />

            <ColorPickerButton
                label="Highlight"
                icon={<span className="text-sm">🖍</span>}
                swatches={HIGHLIGHT_SWATCHES}
                currentColor={state.currentHighlight}
                onSelect={(color) =>
                    editor.chain().focus().toggleHighlight({color}).run()
                }
                onClear={() => editor.chain().focus().unsetHighlight().run()}
                isActive={!!state.currentHighlight}
            />

            <div className="w-px h-5 bg-gray-200 mx-1"/>

            {/* Headings */}
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

            {/* Alignment */}
            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                isActive={state.alignLeft}
                label="Align left"
                shortcut={`${mod}+${shift}+L`}
            >
                ⬱
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                isActive={state.alignCenter}
                label="Align center"
                shortcut={`${mod}+${shift}+E`}
            >
                ☰
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                isActive={state.alignRight}
                label="Align right"
                shortcut={`${mod}+${shift}+R`}
            >
                ⇶
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-200 mx-1"/>

            {/* Lists */}
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

            {/* Super/subscript */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleSuperscript().run()}
                isActive={state.isSuperscript}
                label="Superscript"
                shortcut={`${mod}+.`}
            >
                X²
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleSubscript().run()}
                isActive={state.isSubscript}
                label="Subscript"
                shortcut={`${mod}+,`}
            >
                X₂
            </ToolbarButton>

            <div className="w-px h-5 bg-gray-200 mx-1"/>

            {/* Code + blockquote */}
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

            {/* Undo/redo. Note that Collaboration replaces the default undo
                stack with a per-user one — Ctrl+Z only undoes YOUR edits,
                not your collaborator's. canUndo/canRedo reflect that. */}
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