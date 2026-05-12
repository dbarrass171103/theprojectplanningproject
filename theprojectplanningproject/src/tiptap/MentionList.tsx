// Dropdown list rendered inside the @mention suggestion popup.
//
// Shared by both card and note mention suggestions — the only difference
// is whether items carry a sublabel (card mentions include the column name;
// note mentions don't).
//
// Uses forwardRef so the parent suggestion handler can call onKeyDown()
// imperatively. Tiptap's suggestion system intercepts keyboard events before
// they reach the React tree, so we can't rely on normal React event handlers
// for arrow-key navigation.
//
// Selection state resets whenever the items list changes (the query updated
// and the results shifted), so the highlighted row doesn't drift to the
// wrong item as the user types.

import {forwardRef, useEffect, useImperativeHandle, useState} from 'react'

export interface MentionItem {
    id: string
    label: string
    sublabel?: string
}

export interface MentionListProps {
    items: MentionItem[]
    command: (item: MentionItem) => void
}

export interface MentionListRef {
    onKeyDown: (props: {event: KeyboardEvent}) => boolean
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
    function MentionList({items, command}, ref) {
        const [selectedIndex, setSelectedIndex] = useState(0)

        // Reset highlight to the first row whenever the filtered list changes.
        useEffect(() => setSelectedIndex(0), [items])

        function selectItem(index: number) {
            const item = items[index]
            if (item) command(item)
        }

        // Exposed to the parent via ref so Tiptap can route keyboard events
        // here even though they never enter the React event system.
        useImperativeHandle(ref, () => ({
            onKeyDown: ({event}) => {
                if (event.key === 'ArrowUp') {
                    setSelectedIndex(i => (i + items.length - 1) % items.length)
                    return true
                }
                if (event.key === 'ArrowDown') {
                    setSelectedIndex(i => (i + 1) % items.length)
                    return true
                }
                if (event.key === 'Enter') {
                    selectItem(selectedIndex)
                    return true
                }
                return false
            },
        }))

        return (
            <div className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-48 max-h-64 overflow-y-auto">
                {items.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400">
                        No matches.
                    </div>
                ) : (
                    items.map((item, index) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => selectItem(index)}
                            // Sync mouse hover with keyboard selection so the
                            // two don't fight — moving the mouse snaps the
                            // highlight to the hovered row.
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`
                                w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between gap-2
                                ${index === selectedIndex
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }
                            `}
                        >
                            <span className="truncate">{item.label || 'Untitled'}</span>

                            {item.sublabel && (
                                <span
                                    className={`
                                        text-xs shrink-0
                                        ${index === selectedIndex ? 'text-blue-400' : 'text-gray-400'}
                                    `}
                                >
                                    {item.sublabel}
                                </span>
                            )}
                        </button>
                    ))
                )}
            </div>
        )
    }
)
