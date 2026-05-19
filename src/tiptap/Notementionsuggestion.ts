// Thin wrapper around createMentionSuggestion. Kept as its own file so
// existing imports don't need to change.

import {createMentionSuggestion} from './createMentionSuggestion'
import {useNotesStore} from '../store/notesStore'
import type {MentionItem} from './MentionList'

export function createNoteMentionSuggestion() {
    return createMentionSuggestion((query) => {
        const {notes, order} = useNotesStore.getState()
        const lower = query.toLowerCase()

        return order
            .map(id => {
                const note = notes[id]
                return note ? {id: note.id, label: note.title || 'Untitled'} : null
            })
            .filter((n): n is MentionItem => n !== null)
            .filter(n => n.label.toLowerCase().includes(lower))
            .slice(0, 10)
    })
}
