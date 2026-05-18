// Factory for inline @mention Node extensions.
//
// Card and note mentions share the same structure: an atomic inline node
// with id and label attributes, rendered as a `@Label` chip with data
// attributes the host editor or display layer can hook into. The factory
// captures that pattern; callers supply a suggestion config (items, render)
// which Tiptap deep-merges with the defaults below.

import {Node, mergeAttributes} from '@tiptap/core'
import {Suggestion, type SuggestionOptions} from '@tiptap/suggestion'

export interface MentionAttrs {
    id: string
    label: string
}

export interface MentionOptions {
    HTMLAttributes: Record<string, unknown>
    suggestion: Omit<SuggestionOptions, 'editor'>
}

interface MentionExtensionConfig {
    /** Tiptap node name, e.g. 'cardMention'. */
    name: string
    /**
     * Lowercase noun used to derive the DOM attribute names:
     * `card` → data-card-mention, data-card-id, data-card-label.
     */
    dataPrefix: string
    /** CSS class applied to the rendered chip. */
    className: string
    /** Fallback chip text when the stored label is empty. */
    fallbackLabel: string
}

export function createMentionExtension(config: MentionExtensionConfig) {
    const idAttr = `data-${config.dataPrefix}-id`
    const labelAttr = `data-${config.dataPrefix}-label`
    const wrapperAttr = `data-${config.dataPrefix}-mention`

    return Node.create<MentionOptions>({
        name: config.name,
        group: 'inline',
        inline: true,
        selectable: false,
        atom: true,

        addOptions() {
            return {
                HTMLAttributes: {},
                suggestion: {
                    char: '@',

                    // Insert the mention plus a trailing space. Capturing
                    // config.name means each factory invocation produces a
                    // command bound to its own node type.
                    command: ({editor, range, props}) => {
                        const attrs = props as MentionAttrs
                        editor
                            .chain()
                            .focus()
                            .insertContentAt(range, [
                                {type: config.name, attrs},
                                {type: 'text', text: ' '},
                            ])
                            .run()
                    },

                    items: () => [],
                },
            }
        },

        addAttributes() {
            return {
                id: {
                    default: null,
                    parseHTML: el => el.getAttribute(idAttr),
                    renderHTML: attrs =>
                        attrs.id ? {[idAttr]: attrs.id} : {},
                },
                label: {
                    default: '',
                    parseHTML: el => el.getAttribute(labelAttr),
                    renderHTML: attrs =>
                        attrs.label ? {[labelAttr]: attrs.label} : {},
                },
            }
        },

        parseHTML() {
            return [{tag: `span[${wrapperAttr}]`}]
        },

        renderHTML({node, HTMLAttributes}) {
            return [
                'span',
                mergeAttributes(
                    {[wrapperAttr]: '', class: config.className},
                    this.options.HTMLAttributes,
                    HTMLAttributes,
                ),
                `@${node.attrs.label || config.fallbackLabel}`,
            ]
        },

        addProseMirrorPlugins() {
            return [
                Suggestion({
                    editor: this.editor,
                    ...this.options.suggestion,
                }),
            ]
        },
    })
}
