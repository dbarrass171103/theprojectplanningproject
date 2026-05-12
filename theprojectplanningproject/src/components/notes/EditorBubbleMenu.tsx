// The floating menu that appears above selected text in the note editor.
//
// Distinct from the always-visible EditorToolbar at the top of the editor —
// the bubble menu is a quick-access set of inline-relevant actions (text
// formatting, alignment, colours, links) that pops up where the user is
// currently working. Block-level actions like headings and lists live only
// in the top toolbar.
//
// The dark colour scheme is deliberate: lets the menu stand out against
// the document background and signals "ephemeral overlay" rather than
// "permanent UI."

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

// Small button used throughout the bubble menu. Factored out so each
// formatting button doesn't duplicate the class/aria boilerplate.
function BubbleButton({onClick, isActive, label, children}: BubbleButtonProps) {
    return (
        <button
            type="button"
            // Prevent the editor from losing focus on mousedown. Without this,
            // clicking a button would clear the selection and the toggle
            // commands below would have nothing to apply to.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            className={`
                px-2 py-1 text-sm rounded transition-colors
                ${isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-200 hover:bg-gray-700 hover:text-white'
                }
            `}
        >
            {children}
        </button>
    )
}

export default function EditorBubbleMenu({editor}: EditorBubbleMenuProps) {
    // useEditorState subscribes to the editor and only re-renders this
    // component when one of the selected values actually changes. Avoids
    // re-rendering the bubble menu on every keystroke.
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

    // Prompt the user for a URL using a native prompt. Three outcomes:
    //   - Cancel (null): do nothing
    //   - Empty string: remove the link mark from the selection
    //   - Non-empty: set/update the link mark
    // extendMarkRange makes the action operate on the entire link mark
    // even if only part of it is selected.
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

    // Strip both marks (bold/italic/etc) AND structural nodes (h1, lists,
    // blockquote) from the selection, returning to plain paragraphs.
    function handleClearFormatting() {
        if (!editor) return
        editor.chain().focus().unsetAllMarks().clearNodes().run()
    }

    return (
        <BubbleMenu
            editor={editor}
            options={{
                placement: 'top',
                offset: 8,
            }}
            // Only show the menu when there's an actual selection (from !== to)
            // and not inside a code block — code blocks should look like raw
            // code, not formatted text.
            shouldShow={({editor, from, to}) => {
                if (from === to) return false
                if (editor.isActive('codeBlock')) return false
                return true
            }}
        >
            <div className="flex items-center gap-0.5 bg-gray-800 rounded-lg shadow-lg px-1 py-1">

                {/* Inline marks: bold, italic, underline, strike, code */}
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

                {/* Colours */}
                <ColorPickerButton
                    label="Text colour"
                    icon={<span className="text-sm font-bold">A</span>}
                    swatches={TEXT_COLOR_SWATCHES}
                    currentColor={state?.currentColor ?? null}
                    onSelect={(color) => editor.chain().focus().setColor(color).run()}
                    onClear={() => editor.chain().focus().unsetColor().run()}
                    isActive={!!state?.currentColor}
                    variant="dark"
                />

                <ColorPickerButton
                    label="Highlight"
                    icon={<span className="text-sm">🖍</span>}
                    swatches={HIGHLIGHT_SWATCHES}
                    currentColor={state?.currentHighlight ?? null}
                    onSelect={(color) =>
                        editor.chain().focus().toggleHighlight({color}).run()
                    }
                    onClear={() => editor.chain().focus().unsetHighlight().run()}
                    isActive={!!state?.currentHighlight}
                    variant="dark"
                />

                <div className="w-px h-5 bg-gray-600 mx-0.5"/>

                {/* Text alignment */}
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

                {/* Super/subscript */}
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

                {/* Link + clear */}
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