// Thin wrapper around createMentionExtension. Kept as its own file so
// existing imports of NoteMention and NoteMentionAttrs don't need to change.

import {createMentionExtension, type MentionAttrs, type MentionOptions} from './createMentionExtension'

export type NoteMentionAttrs = MentionAttrs
export type NoteMentionOptions = MentionOptions

export const NoteMention = createMentionExtension({
    name: 'noteMention',
    dataPrefix: 'note',
    className: 'note-mention',
    fallbackLabel: 'note',
})
