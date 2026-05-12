// Tiptap node extension for inline @card mentions.
//
// Rendered as an atomic inline chip — not editable, not selectable as text.
// Stores the card's ID and a label snapshot in its attrs. The label is
// captured at insertion time so the chip still shows something readable if
// the card is later renamed; the ID is the authoritative reference.
//
// The actual suggestion popup and item list are wired up separately via
// cardMentionSuggestion.ts, which is passed in through options.suggestion
// when the extension is registered in the editor.

import {Node, mergeAttributes} from '@tiptap/core'
import {Suggestion, type SuggestionOptions} from '@tiptap/suggestion'

export interface CardMentionAttrs {
    id: string
    label: string
}

export interface CardMentionOptions {
    HTMLAttributes: Record<string, unknown>
    suggestion: Omit<SuggestionOptions, 'editor'>
}

export const CardMention = Node.create<CardMentionOptions>({
    name: 'cardMention',
    group: 'inline',
    inline: true,
    selectable: false,
    atom: true,

    addOptions() {
        return {
            HTMLAttributes: {},
            suggestion: {
                char: '@',

                // Called when the user picks an item from the suggestion list.
                // Inserts the mention node followed by a space so the cursor
                // lands outside the atom and typing can continue naturally.
                command: ({editor, range, props}) => {
                    const attrs = props as CardMentionAttrs

                    editor
                        .chain()
                        .focus()
                        .insertContentAt(range, [
                            {type: 'cardMention', attrs},
                            {type: 'text', text: ' '},
                        ])
                        .run()
                },

                // Items are provided by cardMentionSuggestion.ts at registration time.
                items: () => [],
            },
        }
    },

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: el => el.getAttribute('data-card-id'),
                renderHTML: attrs =>
                    attrs.id ? {'data-card-id': attrs.id} : {},
            },

            label: {
                default: '',
                parseHTML: el => el.getAttribute('data-card-label'),
                renderHTML: attrs =>
                    attrs.label ? {'data-card-label': attrs.label} : {},
            },
        }
    },

    parseHTML() {
        return [{tag: 'span[data-card-mention]'}]
    },

    renderHTML({node, HTMLAttributes}) {
        return [
            'span',
            mergeAttributes(
                {'data-card-mention': '', class: 'card-mention'},
                this.options.HTMLAttributes,
                HTMLAttributes,
            ),
            `@${node.attrs.label || 'card'}`,
        ]
    },

    // Register the Suggestion ProseMirror plugin that watches for the @
    // trigger character and drives the popup lifecycle.
    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ]
    },
})
