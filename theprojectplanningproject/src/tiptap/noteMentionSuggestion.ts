import {ReactRenderer} from '@tiptap/react'
import {computePosition, flip, shift, offset} from '@floating-ui/dom'
import type {SuggestionOptions} from '@tiptap/suggestion'
import {MentionList, type MentionListRef, type MentionItem} from './MentionList'
import {useNotesStore} from '../store/notesStore'

/**
 * Creates the suggestion configuration for @note mentions.
 * This is passed into the NoteMention extension.
 */
export function createNoteMentionSuggestion(): Omit<SuggestionOptions<MentionItem>, 'editor'> {
    return {
        char: '@',

        /**
         * Build the list of suggestion items based on the user's query.
         * Pulls from the Notes store:
         * - note title
         * - note ID
         * Ordered by recency (order array).
         */
        items: ({query}) => {
            const {notes, order} = useNotesStore.getState()
            const lower = query.toLowerCase()

            return order
                .map(id => {
                    const note = notes[id]
                    return note
                        ? {id: note.id, label: note.title || 'Untitled'}
                        : null
                })
                .filter((n): n is MentionItem => n !== null)
                .filter(n => n.label.toLowerCase().includes(lower))
                .slice(0, 10) // limit for readability
        },

        // Render logic
        render: () => {
            let component: ReactRenderer<MentionListRef> | null = null
            let floatingEl: HTMLElement | null = null

            function buildVirtualEl(rect: DOMRect) {
                return {
                    getBoundingClientRect: () => rect,
                }
            }

            // Position relative to cursor
            async function updatePosition(rect: DOMRect | null) {
                if (!floatingEl || !rect) return

                const {x, y} = await computePosition(
                    buildVirtualEl(rect),
                    floatingEl,
                    {
                        placement: 'bottom-start',
                        middleware: [
                            offset(4),   // small gap below cursor
                            flip(),      // flip if near screen edge
                            shift({padding: 8}), // keep inside viewport
                        ],
                    }
                )

                Object.assign(floatingEl.style, {
                    left: `${x}px`,
                    top: `${y}px`,
                })
            }

            return {
                // Called when user types @
                onStart: props => {
                    component = new ReactRenderer(MentionList, {
                        props,
                        editor: props.editor,
                    })

                    if (!props.clientRect) return

                    // Create floating container
                    floatingEl = document.createElement('div')
                    floatingEl.style.position = 'absolute'
                    floatingEl.style.zIndex = '50'
                    floatingEl.appendChild(component.element)
                    document.body.appendChild(floatingEl)

                    void updatePosition(props.clientRect())
                },

                // Called when query or items update
                onUpdate: props => {
                    component?.updateProps(props)

                    if (props.clientRect) {
                        void updatePosition(props.clientRect())
                    }
                },

                // Keyboard handling
                onKeyDown: props => {
                    if (props.event.key === 'Escape') {
                        floatingEl?.remove()
                        return true
                    }

                    return component?.ref?.onKeyDown({event: props.event}) ?? false
                },

                // Cleanup when the suggestion finishes
                onExit: () => {
                    floatingEl?.remove()
                    floatingEl = null

                    component?.destroy()
                    component = null
                },
            }
        },
    }
}
