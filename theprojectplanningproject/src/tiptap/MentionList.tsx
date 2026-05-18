// Dropdown list for @mention suggestions, shared by card and note mentions.
// Keyboard events are routed in from Tiptap via the imperative ref.

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

        // Reset highlight whenever the filtered list changes.
        useEffect(() => setSelectedIndex(0), [items])

        function selectItem(index: number) {
            const item = items[index]
            if (item) command(item)
        }

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
                    <div className="px-3 py-2 text-xs text-gray-400">No matches.</div>
                ) : (
                    items.map((item, index) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => selectItem(index)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`
                                w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-2
                                ${index === selectedIndex
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-700 hover:bg-gray-50'}
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
