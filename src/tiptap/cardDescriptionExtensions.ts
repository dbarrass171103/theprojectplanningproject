// Shared Tiptap extension base for card descriptions.
//
// All three components that handle card descriptions — AddCardForm,
// CardDescriptionEditor, and CardDescriptionDisplay — need the same core
// extensions. Centralising them here means adding an extension (e.g.
// TextStyle for colour support) only needs one edit and automatically
// applies to display too.
//
// Each consumer spreads the result and appends only what's unique to it:
//   - AddCardForm:           Placeholder
//   - CardDescriptionEditor: Placeholder + Collaboration
//   - CardDescriptionDisplay: nothing extra

import StarterKit from '@tiptap/starter-kit'
import type {Extensions} from '@tiptap/core'
import {NoteMention} from './NoteMention'
import {createNoteMentionSuggestion} from "./Notementionsuggestion.ts";

interface CardDescriptionExtensionOptions {
    /**
     * Set true when Collaboration is also in the extension list. Disables
     * StarterKit's built-in undo/redo since Collaboration provides its own.
     */
    collaboration?: boolean
    /**
     * Set false in read-only display contexts where the suggestion dropdown
     * will never be triggered.
     */
    mentionSuggestion?: boolean
}

export function createCardDescriptionExtensions({
    collaboration = false,
    mentionSuggestion = true,
}: CardDescriptionExtensionOptions = {}): Extensions {
    return [
        StarterKit.configure({
            heading: false,
            codeBlock: false,
            blockquote: false,
            horizontalRule: false,
            ...(collaboration && {undoRedo: false}),
        }),
        mentionSuggestion
            ? NoteMention.configure({suggestion: createNoteMentionSuggestion()})
            : NoteMention,
    ]
}
