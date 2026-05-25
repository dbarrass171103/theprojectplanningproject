// Resizable image node for the note editor.
//
// Extends @tiptap/extension-image with a `width` attribute and a custom
// NodeView that wraps the image in a span containing a bottom-right drag
// handle. Width is stored as a pixel number (null = natural size) so it
// round-trips cleanly through the Y.Doc.
//
// The NodeView is plain DOM rather than React: cheaper to mount, no
// React reconciler in the editor's hot path, and we don't need any of
// the React-specific NodeViewWrapper machinery for what amounts to two
// elements and a pointer listener.

import Image from '@tiptap/extension-image'
import type {NodeViewRendererProps} from '@tiptap/core'

const MIN_WIDTH = 60
const MAX_WIDTH = 1200

export const ResizableImage = Image.extend({
    name: 'image',

    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null as number | null,
                parseHTML: el => {
                    const raw = (el as HTMLElement).getAttribute('width')
                        ?? (el as HTMLImageElement).style?.width
                    if (!raw) return null
                    const n = parseInt(String(raw).replace('px', ''), 10)
                    return Number.isFinite(n) ? n : null
                },
                renderHTML: attrs => {
                    if (!attrs.width) return {}
                    return {width: String(attrs.width)}
                },
            },
        }
    },

    addNodeView() {
        return ({node, editor, getPos}: NodeViewRendererProps) => {
            // Inline-block wrapper so it hugs the image and lets the
            // parent block's text-align position it (left / centre / right).
            const wrapper = document.createElement('span')
            wrapper.className = 'editor-image-wrapper'
            wrapper.style.display = 'inline-block'
            wrapper.style.position = 'relative'
            wrapper.style.maxWidth = '100%'

            const img = document.createElement('img')
            img.className = 'editor-image'
            img.src = node.attrs.src
            if (node.attrs.alt) img.alt = node.attrs.alt
            if (node.attrs.title) img.title = node.attrs.title
            if (node.attrs.width) img.style.width = `${node.attrs.width}px`
            img.draggable = false

            // Hidden by default; CSS reveals it on hover or node selection.
            const handle = document.createElement('span')
            handle.className = 'editor-image-resize-handle'
            handle.setAttribute('aria-hidden', 'true')

            wrapper.appendChild(img)
            wrapper.appendChild(handle)

            let dragging = false
            let startX = 0
            let startWidth = 0

            function onPointerMove(e: PointerEvent) {
                if (!dragging) return
                const delta = e.clientX - startX
                const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta))
                img.style.width = `${next}px`
            }

            function onPointerUp(e: PointerEvent) {
                if (!dragging) return
                dragging = false
                handle.releasePointerCapture?.(e.pointerId)
                window.removeEventListener('pointermove', onPointerMove)
                window.removeEventListener('pointerup', onPointerUp)

                // Commit the final width to the Y.Doc once on pointer-up
                // rather than on every move — otherwise we'd spam the
                // snapshot table with hundreds of intermediate updates
                // and saturate the realtime channel for collaborators.
                const finalWidth = parseInt(img.style.width, 10)
                if (!Number.isFinite(finalWidth)) return
                if (typeof getPos !== 'function') return
                const pos = getPos()
                if (typeof pos !== 'number') return

                editor
                    .chain()
                    .command(({tr}) => {
                        tr.setNodeMarkup(pos, undefined, {
                            ...node.attrs,
                            width: finalWidth,
                        })
                        return true
                    })
                    .run()
            }

            handle.addEventListener('pointerdown', (e: PointerEvent) => {
                e.preventDefault()
                e.stopPropagation()
                dragging = true
                startX = e.clientX
                startWidth = img.getBoundingClientRect().width
                handle.setPointerCapture?.(e.pointerId)
                window.addEventListener('pointermove', onPointerMove)
                window.addEventListener('pointerup', onPointerUp)
            })

            return {
                dom: wrapper,
                // Re-sync the DOM when the node's attrs change from
                // outside this NodeView — remote edits, undo, etc.
                update(updatedNode) {
                    if (updatedNode.type.name !== 'image') return false
                    if (updatedNode.attrs.src !== img.src) {
                        img.src = updatedNode.attrs.src
                    }
                    img.alt = updatedNode.attrs.alt ?? ''
                    if (updatedNode.attrs.width) {
                        img.style.width = `${updatedNode.attrs.width}px`
                    } else {
                        img.style.removeProperty('width')
                    }
                    return true
                },
                destroy() {
                    window.removeEventListener('pointermove', onPointerMove)
                    window.removeEventListener('pointerup', onPointerUp)
                },
                // Image is atomic; clicking selects the whole node rather
                // than trying to place a cursor inside it.
                selectNode() {
                    wrapper.classList.add('ProseMirror-selectednode')
                },
                deselectNode() {
                    wrapper.classList.remove('ProseMirror-selectednode')
                },
                stopEvent(event) {
                    // Swallow pointerdown on the handle so ProseMirror
                    // doesn't try to start a node drag from it.
                    return (event.target as HTMLElement | null)?.classList?.contains(
                        'editor-image-resize-handle',
                    ) ?? false
                },
            }
        }
    },
})