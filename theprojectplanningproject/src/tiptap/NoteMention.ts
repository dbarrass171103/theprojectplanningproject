import {Node, mergeAttributes} from "@tiptap/react"
import {Suggestion, type SuggestionOptions} from '@tiptap/suggestion'

export interface NoteMentionAttrs {
    id: string
    label: string
}

export interface NoteMentionOptions {
    HTMLAttributes: Record<string, unknown>
    suggestion: Omit<SuggestionOptions, 'editor'>
}

// TipTap Node extension representing an inline @note mention.
export const NoteMention = Node.create<NoteMentionOptions>({
    name: 'noteMention',
    group: 'inline',
    inline: true,
    selectable: false,
    atom: true,

    // Default options for the extension.
    addOptions() {
        return {
            HTMLAttributes: {},
            suggestion: {
                char: '@',

                // Called when the user selects an item from the suggestion list.
                command: ({editor, range, props}) => {
                    const attrs = props as NoteMentionAttrs

                    editor
                        .chain()
                        .focus()
                        .insertContentAt(range, [
                            {type: 'noteMention', attrs},
                            {type: 'text', text: ' '},
                        ])
                        .run()
                },

                // Items are provided by noteMentionSuggestions.ts
                items: () => [],
            },
        }
    },

    // Attributes stored on the node
    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: el => el.getAttribute('data-note-id'),
                renderHTML: attrs =>
                    attrs.id ? {'data-note-id': attrs.id} : {},
            },

            label: {
                default: '',
                parseHTML: el => el.getAttribute('data-note-label'),
                renderHTML: attrs =>
                    attrs.label ? {'data-note-label': attrs.label} : {},
            },
        }
    },

    parseHTML() {
        return [{tag: 'span[data-note-mention]'}]
    },

    // How the node is rendered
    renderHTML({node, HTMLAttributes}) {
        return [
            'span',
            mergeAttributes(
                {'data-note-mention': '', class: 'note-mention'},
                this.options.HTMLAttributes,
                HTMLAttributes,
            ),
            `@${node.attrs.label || 'note'}`,
        ]
    },

    // lets @ trigger the popup
    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ]
    },
})
