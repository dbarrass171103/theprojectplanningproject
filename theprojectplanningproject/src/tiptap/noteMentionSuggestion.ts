// Suggestion configuration for @note mentions in card description editors.
//
// Mirror of cardMentionSuggestion.ts — same popup positioning strategy
// (floating-ui appended to document.body), same keyboard routing through
// MentionList's imperative ref. The only differences are the data source
// (notesStore instead of kanbanStore) and the absence of a sublabel, since
// notes aren't grouped by column.
//
// Items are ordered by recency (the store's `order` array) rather than
// alphabetically, matching the sidebar ordering the user already sees.

import {ReactRenderer} from '@tiptap/react'
import {computePosition, flip, shift, offset} from '@floating-ui/dom'
import type {SuggestionOptions} from '@tiptap/suggestion'
import {MentionList, type MentionListRef, type MentionItem} from './MentionList'
import {useNotesStore} from '../store/notesStore'

export function createNoteMentionSuggestion(): Omit<SuggestionOptions<MentionItem>, 'editor'> {
    return {
        char: '@',

        items: ({query}) => {
            const {notes, order} = useNotesStore.getState()
            const lower = query.toLowerCase()

            // Walk the order array (recency-sorted) rather than Object.values
            // so the list matches the sidebar's ordering.
            return order
                .map(id => {
                    const note = notes[id]
                    return note
                        ? {id: note.id, label: note.title || 'Untitled'}
                        : null
                })
                .filter((n): n is MentionItem => n !== null)
                .filter(n => n.label.toLowerCase().includes(lower))
                .slice(0, 10)
        },

        render: () => {
            let component: ReactRenderer<MentionListRef> | null = null
            let floatingEl: HTMLElement | null = null

            function buildVirtualEl(rect: DOMRect) {
                return {
                    getBoundingClientRect: () => rect,
                }
            }

            async function updatePosition(rect: DOMRect | null) {
                if (!floatingEl || !rect) return

                const {x, y} = await computePosition(
                    buildVirtualEl(rect),
                    floatingEl,
                    {
                        placement: 'bottom-start',
                        middleware: [
                            offset(4),
                            flip(),
                            shift({padding: 8}),
                        ],
                    }
                )

                Object.assign(floatingEl.style, {
                    left: `${x}px`,
                    top: `${y}px`,
                })
            }

            return {
                onStart: props => {
                    component = new ReactRenderer(MentionList, {
                        props,
                        editor: props.editor,
                    })

                    if (!props.clientRect) return

                    floatingEl = document.createElement('div')
                    floatingEl.style.position = 'absolute'
                    floatingEl.style.zIndex = '50'
                    floatingEl.appendChild(component.element)
                    document.body.appendChild(floatingEl)

                    void updatePosition(props.clientRect())
                },

                onUpdate: props => {
                    component?.updateProps(props)

                    if (props.clientRect) {
                        void updatePosition(props.clientRect())
                    }
                },

                onKeyDown: props => {
                    if (props.event.key === 'Escape') {
                        floatingEl?.remove()
                        return true
                    }

                    return component?.ref?.onKeyDown({event: props.event}) ?? false
                },

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
