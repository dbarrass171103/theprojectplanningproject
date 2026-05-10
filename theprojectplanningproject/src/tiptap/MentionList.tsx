import {forwardRef, useEffect, useImperativeHandle, useState} from 'react'

// A suggestion item
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

/**
 * The popup list shown when typing '@'.
 * Uses forwardRef so TipTap can call onKeyDown() directly.
 */
export const MentionList = forwardRef<MentionListRef, MentionListProps>(
    function MentionList({items, command}, ref) {
        // Which item is currently highlighted
        const [selectedIndex, setSelectedIndex] = useState(0)

        // Reset selection when the items list changes
        useEffect(() => setSelectedIndex(0), [items])

        // Select an item by index and call the command callback.

        function selectItem(index: number) {
            const item = items[index]
            if (item) command(item)
        }

        // Keyboard handling
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
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`
                                w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between gap-2
                                ${index === selectedIndex
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }
                            `}
                        >
                            {/* Main label (card title) */}
                            <span className="truncate">{item.label || 'Untitled'}</span>

                            {/* Sublabel (column title) */}
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
