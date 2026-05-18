// Collaborative Tiptap editor for a card's description. Binds directly to
// the card's Y.XmlFragment via the Collaboration extension. Mounted only
// while a card is in edit mode; display mode is handled separately.

import {EditorContent, useEditor} from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import {createCardDescriptionExtensions} from '../../tiptap/cardDescriptionExtensions'
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'
import {useEffect, useMemo} from 'react'
import {useKanbanStore} from '../../store/kanbanStore'

interface CardDescriptionEditorProps {
    cardId: string
    onSubmit?: () => void
    onCancel?: () => void
    autoFocus?: boolean
    placeholder?: string
}

export default function CardDescriptionEditor({
    cardId,
    onSubmit,
    onCancel,
    autoFocus,
    placeholder = "Description...",
}: CardDescriptionEditorProps) {
    const fragment = useMemo(
        () => useKanbanStore.getState().getCardDescriptionFragment(cardId),
        [cardId],
    )

    const editor = useEditor({
        extensions: fragment ? [
            ...createCardDescriptionExtensions({collaboration: true}),
            Placeholder.configure({placeholder}),
            Collaboration.configure({
                fragment: fragment as unknown as Y.XmlFragment,
            }),
        ] : [],

        autofocus: autoFocus ? 'end' : false,

        editorProps: {
            attributes: {
                class: 'prose-editor card-description-editor focus:outline-none text-sm',
            },
            handleKeyDown: (_view, event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    onSubmit?.()
                    return true
                }
                if (event.key === 'Escape') {
                    event.preventDefault()
                    onCancel?.()
                    return true
                }
                return false
            },
        },
    // Recreate the editor if the fragment identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fragment])

    useEffect(() => {
        if (!fragment) {
            console.warn(`CardDescriptionEditor: no Y.XmlFragment for card ${cardId}`)
        }
    }, [fragment, cardId])

    if (!fragment) {
        return (
            <div className="card-description-editor text-sm text-gray-400 italic">
                Loading description…
            </div>
        )
    }

    return <EditorContent editor={editor}/>
}
