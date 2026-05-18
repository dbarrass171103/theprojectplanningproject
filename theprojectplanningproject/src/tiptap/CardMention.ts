// Thin wrapper around createMentionExtension. Kept as its own file so
// existing imports of CardMention and CardMentionAttrs don't need to change.

import {createMentionExtension, type MentionAttrs, type MentionOptions} from './createMentionExtension'

export type CardMentionAttrs = MentionAttrs
export type CardMentionOptions = MentionOptions

export const CardMention = createMentionExtension({
    name: 'cardMention',
    dataPrefix: 'card',
    className: 'card-mention',
    fallbackLabel: 'card',
})
