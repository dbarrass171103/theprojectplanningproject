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

// Tiptap node extension for the cardmentions
export const CardMention = Node.create<CardMentionOptions>({
    name: 'cardMention',
    group: 'inline',
    inline: true,
    selectable: false,
    atom: true,

    // Default options
    addOptions() {
        return {
            HTMLAttributes: {},
            suggestion: {
                char: '@',

                // Called when the user selects an item from the suggestion list
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

                // Items are given by cardMentionSuggestion.ts
                items: () => [],
            },
        }
    },

    // Attributes stored in the node.
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

    // How the node is rendered
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

    // Let's @ trigger popup
    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ]
    },
})
