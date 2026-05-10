import {ReactRenderer} from '@tiptap/react'
import {computePosition, flip, shift, offset} from '@floating-ui/dom'
import type {SuggestionOptions} from '@tiptap/suggestion'
import {MentionList, type MentionListRef, type MentionItem} from './MentionList'
import {useKanbanStore} from '../store/kanbanStore'

/**
 * Creates the suggestion configuration for @card mentions.
 * This is passed into the CardMention extension.
 */
export function createCardMentionSuggestion(): Omit<SuggestionOptions<MentionItem>, 'editor'> {
    return {
        char: '@',

        /**
         * Build the list of suggestion items based on the user's query.
         * Pulls from the Kanban store:
         * - card title
         * - card ID
         * - column title (as sublabel)
         */
        items: ({query}) => {
            const {board} = useKanbanStore.getState()
            const lower = query.toLowerCase()
            const items: MentionItem[] = []

            for (const column of board.columns) {
                for (const cardId of column.cardIds) {
                    const card = board.cards[cardId]
                    if (!card) continue

                    const title = card.title || 'Untitled'

                    // Substring match
                    if (title.toLowerCase().includes(lower)) {
                        items.push({
                            id: card.id,
                            label: title,
                            sublabel: column.title,
                        } as MentionItem & {sublabel: string})
                    }
                }
            }

            // Limit to 10 results for readability
            return items.slice(0, 10)
        },

        // Render logic for the popup
        render: () => {
            let component: ReactRenderer<MentionListRef> | null = null
            let floatingEl: HTMLElement | null = null

            function buildVirtualEl(rect: DOMRect) {
                return {
                    getBoundingClientRect: () => rect,
                }
            }

            // Popup relative to cursor
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
                // called when user types @
                onStart: props => {
                    component = new ReactRenderer(MentionList, {
                        props,
                        editor: props.editor,
                    })

                    if (!props.clientRect) return

                    // floating container
                    floatingEl = document.createElement('div')
                    floatingEl.style.position = 'absolute'
                    floatingEl.style.zIndex = '50'
                    floatingEl.appendChild(component.element)
                    document.body.appendChild(floatingEl)

                    void updatePosition(props.clientRect())
                },

                // Called when query changes or items update
                onUpdate: props => {
                    component?.updateProps(props)

                    if (props.clientRect) {
                        void updatePosition(props.clientRect())
                    }
                },

                // Keyboard use in the list
                onKeyDown: props => {
                    if (props.event.key === 'Escape') {
                        floatingEl?.remove()
                        return true
                    }

                    return component?.ref?.onKeyDown({event: props.event}) ?? false
                },

                // Cleanup upon close
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
