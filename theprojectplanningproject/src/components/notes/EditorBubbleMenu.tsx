// Floating formatting menu shown above selected text. Quick inline actions
// (marks, alignment, colours, links). Uses a dark theme to distinguish it
// from the main toolbar.

import {BubbleMenu} from '@tiptap/react/menus'
import {useEditorState, type Editor} from '@tiptap/react'
import ColorPickerButton from './ColorPickerButton'
import {TEXT_COLOR_SWATCHES, HIGHLIGHT_SWATCHES} from './ColorSwatches'

interface EditorBubbleMenuProps {
    editor: Editor | null
}

interface BubbleButtonProps {
    onClick: () => void
    isActive?: boolean
    label: string
    children: React.ReactNode
}

function BubbleButton({onClick, isActive, label, children}: BubbleButtonProps) {
    return (
        <button
            type="button"
            // preventDefault keeps the editor selection alive while clicking.
            onMouseDown={e => e.preventDefault()}
            onClick={onClick}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            className={`
                px-2 py-1 text-sm rounded transition-colors
                ${isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-200 hover:bg-gray-700 hover:text-white'}
            `}
        >
            {children}
        </button>
    )
}

export default function EditorBubbleMenu({editor}: EditorBubbleMenuProps) {
    // Subscribe only to the state this menu cares about, to avoid
    // re-rendering on every keystroke.
    const state = useEditorState({
        editor,
        selector: ({editor}) => {
            if (!editor) return null
            return {
                isBold: editor.isActive('bold'),
                isItalic: editor.isActive('italic'),
                isUnderline: editor.isActive('underline'),
                isStrike: editor.isActive('strike'),
                isCode: editor.isActive('code'),
                isLink: editor.isActive('link'),
                isSuperscript: editor.isActive('superscript'),
                isSubscript: editor.isActive('subscript'),
                alignLeft: editor.isActive({textAlign: 'left'}),
                alignCenter: editor.isActive({textAlign: 'center'}),
                alignRight: editor.isActive({textAlign: 'right'}),
                currentColor:
                    (editor.getAttributes('textStyle').color as string | undefined) ?? null,
                currentHighlight:
                    (editor.getAttributes('highlight').color as string | undefined) ?? null,
            }
        },
    })

    if (!editor) return null

    function handleLinkClick() {
        if (!editor) return;

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
        if (!editor) return;
        editor.chain().focus().unsetAllMarks().clearNodes().run()
    }

    return (
        <BubbleMenu
            editor={editor}
            options={{placement: 'top', offset: 8}}
            shouldShow={({editor, from, to}) => {
                if (from === to) return false
                if (editor.isActive('codeBlock')) return false
                return true
            }}
        >
            <div className="flex items-center gap-0.5 bg-gray-800 rounded-lg shadow-lg px-1 py-1">
                <BubbleButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={state?.isBold}
                    label="Bold"
                >
                    <strong>B</strong>
                </BubbleButton>

                <BubbleButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={state?.isItalic}
                    label="Italic"
                >
                    <em>I</em>
                </BubbleButton>

                <BubbleButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={state?.isUnderline}
                    label="Underline"
                >
                    <u>U</u>
                </BubbleButton>

                <BubbleButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    isActive={state?.isStrike}
                    label="Strikethrough"
                >
                    <s>S</s>
                </BubbleButton>

                <BubbleButton
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    isActive={state?.isCode}
                    label="Inline code"
                >
                    {'<>'}
                </BubbleButton>

                <div className="w-px h-5 bg-gray-600 mx-0.5"/>

                <ColorPickerButton
                    label="Text colour"
                    icon={<span className="text-sm font-bold">A</span>}
                    swatches={TEXT_COLOR_SWATCHES}
                    currentColor={state?.currentColor ?? null}
                    onSelect={color => editor.chain().focus().setColor(color).run()}
                    onClear={() => editor.chain().focus().unsetColor().run()}
                    isActive={!!state?.currentColor}
                    variant="dark"
                />

                <ColorPickerButton
                    label="Highlight"
                    icon={<span className="text-sm">🖍</span>}
                    swatches={HIGHLIGHT_SWATCHES}
                    currentColor={state?.currentHighlight ?? null}
                    onSelect={color =>
                        editor.chain().focus().toggleHighlight({color}).run()
                    }
                    onClear={() => editor.chain().focus().unsetHighlight().run()}
                    isActive={!!state?.currentHighlight}
                    variant="dark"
                />

                <div className="w-px h-5 bg-gray-600 mx-0.5"/>

                <BubbleButton
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    isActive={state?.alignLeft}
                    label="Align left"
                >
                    ⬱
                </BubbleButton>

                <BubbleButton
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    isActive={state?.alignCenter}
                    label="Align center"
                >
                    ☰
                </BubbleButton>

                <BubbleButton
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    isActive={state?.alignRight}
                    label="Align right"
                >
                    ⇶
                </BubbleButton>

                <div className="w-px h-5 bg-gray-600 mx-0.5"/>

                <BubbleButton
                    onClick={() => editor.chain().focus().toggleSuperscript().run()}
                    isActive={state?.isSuperscript}
                    label="Superscript"
                >
                    X²
                </BubbleButton>

                <BubbleButton
                    onClick={() => editor.chain().focus().toggleSubscript().run()}
                    isActive={state?.isSubscript}
                    label="Subscript"
                >
                    X₂
                </BubbleButton>

                <div className="w-px h-5 bg-gray-600 mx-0.5"/>

                <BubbleButton
                    onClick={handleLinkClick}
                    isActive={state?.isLink}
                    label={state?.isLink ? "Edit link" : "Add link"}
                >
                    🔗
                </BubbleButton>

                <BubbleButton
                    onClick={handleClearFormatting}
                    label="Clear formatting"
                >
                    ⌫
                </BubbleButton>
            </div>
        </BubbleMenu>
    )
}
