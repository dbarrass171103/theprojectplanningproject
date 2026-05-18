// Thin wrapper around createMentionSuggestion. Kept as its own file so
// existing imports don't need to change.

import {createMentionSuggestion} from './createMentionSuggestion'
import {useKanbanStore} from '../store/kanbanStore'
import type {MentionItem} from './MentionList'

export function createCardMentionSuggestion() {
    return createMentionSuggestion((query) => {
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
                        sublabel: column.title,
                    })
                }
            }
        }

        return items.slice(0, 10)
    })
}
