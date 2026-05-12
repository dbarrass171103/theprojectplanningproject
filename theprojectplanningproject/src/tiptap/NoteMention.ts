// Tiptap node extension for inline @note mentions in card descriptions.
//
// Structurally identical to CardMention — an atomic inline chip storing the
// note's ID and a label snapshot. The ID is the link; the label is a cached
// display string so the chip renders even if the note is later renamed or
// deleted (CardDescriptionDisplay marks it stale in the deleted case).
//
// Suggestion items and popup behaviour are wired up by noteMentionSuggestion.ts
// and passed in through options.suggestion at editor registration time.

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

export const NoteMention = Node.create<NoteMentionOptions>({
    name: 'noteMention',
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
                // Inserts the mention node then a trailing space so the cursor
                // exits the atom and typing continues naturally.
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

                // Items provided by noteMentionSuggestion.ts at registration time.
                items: () => [],
            },
        }
    },

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

    // Register the Suggestion ProseMirror plugin that watches for the @
    // trigger and drives the popup lifecycle.
    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ]
    },
})
