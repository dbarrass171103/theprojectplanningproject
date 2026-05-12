// Suggestion configuration for @card mentions in the note editor.
//
// Passed into the CardMention extension at editor construction time. Controls
// how items are fetched, how the popup is positioned, and how keyboard events
// inside the popup are routed.
//
// Popup positioning uses @floating-ui rather than a fixed offset — it flips
// above the cursor when near the bottom of the viewport and shifts inward
// when near the edges, so the list is always fully visible.
//
// The floating container is appended directly to document.body (not a portal
// inside the editor) to avoid overflow:hidden clipping from editor wrappers.

import {ReactRenderer} from '@tiptap/react'
import {computePosition, flip, shift, offset} from '@floating-ui/dom'
import type {SuggestionOptions} from '@tiptap/suggestion'
import {MentionList, type MentionListRef, type MentionItem} from './MentionList'
import {useKanbanStore} from '../store/kanbanStore'

export function createCardMentionSuggestion(): Omit<SuggestionOptions<MentionItem>, 'editor'> {
    return {
        char: '@',

        items: ({query}) => {
            const {board} = useKanbanStore.getState()
            const lower = query.toLowerCase()
            const items: MentionItem[] = []

            for (const column of board.columns) {
                for (const cardId of column.cardIds) {
                    const card = board.cards[cardId]
                    if (!card) continue

                    const title = card.title || 'Untitled'

                    if (title.toLowerCase().includes(lower)) {
                        items.push({
                            id: card.id,
                            label: title,
                            // Column title shown as sublabel so the user can
                            // distinguish cards with the same name.
                            sublabel: column.title,
                        } as MentionItem & {sublabel: string})
                    }
                }
            }

            return items.slice(0, 10)
        },

        render: () => {
            let component: ReactRenderer<MentionListRef> | null = null
            let floatingEl: HTMLElement | null = null

            // floating-ui needs a reference element with getBoundingClientRect.
            // We build a virtual one from the cursor rect rather than using the
            // editor element, so the popup tracks the cursor as the query grows.
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
