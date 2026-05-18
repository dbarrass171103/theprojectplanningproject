// Factory for Tiptap suggestion configs used by @mention extensions.
//
// Wraps the render / positioning machinery (ReactRenderer + floating-ui)
// so each mention kind only needs to supply an `items(query)` function.

import {ReactRenderer} from '@tiptap/react'
import {computePosition, flip, shift, offset} from '@floating-ui/dom'
import type {SuggestionOptions} from '@tiptap/suggestion'
import {MentionList, type MentionListRef, type MentionItem} from './MentionList'

export function createMentionSuggestion(
    getItems: (query: string) => MentionItem[],
): Omit<SuggestionOptions<MentionItem>, 'editor'> {
    return {
        char: '@',

        items: ({query}) => getItems(query),

        render: () => {
            let component: ReactRenderer<MentionListRef> | null = null
            let floatingEl: HTMLElement | null = null

            const virtualEl = (rect: DOMRect) => ({
                getBoundingClientRect: () => rect,
            })

            async function updatePosition(rect: DOMRect | null) {
                if (!floatingEl || !rect) return

                const {x, y} = await computePosition(
                    virtualEl(rect),
                    floatingEl,
                    {
                        placement: 'bottom-start',
                        middleware: [offset(4), flip(), shift({padding: 8})],
                    },
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