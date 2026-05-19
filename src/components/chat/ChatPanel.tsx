// Chat panel — message history and input for the project chat.

import {useEffect, useRef, useState} from 'react'
import {useChatStore} from '../../store/chatStore'

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
}

export default function ChatPanel() {
    const messages = useChatStore(s => s.messages)
    const hasMore = useChatStore(s => s.hasMore)
    const loadingOlder = useChatStore(s => s.loadingOlder)
    const sendMessage = useChatStore(s => s.sendMessage)
    const loadOlderMessages = useChatStore(s => s.loadOlderMessages)
    const setActive = useChatStore(s => s.setActive)

    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)

    const scrollRef = useRef<HTMLDivElement | null>(null)
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const inputRef = useRef<HTMLTextAreaElement | null>(null)

    // Track whether the user is scrolled near the bottom so we only
    // auto-scroll on new messages when they're already there.
    const isNearBottomRef = useRef(true)

    // Track the previous message count and scroll height so we can
    // restore position after prepending older messages.
    const prevMessageCountRef = useRef(messages.length)
    const scrollHeightBeforeLoadRef = useRef(0)

    // Mark the tab as active so unread count pauses while open.
    useEffect(() => {
        setActive(true)
        return () => setActive(false)
    }, [setActive])

    // Scroll to bottom on initial load only.
    useEffect(() => {
        bottomRef.current?.scrollIntoView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // After new messages arrive: scroll to bottom only if we were already there.
    // After older messages are prepended: restore scroll position so the view
    // doesn't jump.
    useEffect(() => {
        const container = scrollRef.current
        if (!container) return

        const prevCount = prevMessageCountRef.current
        const newCount = messages.length
        prevMessageCountRef.current = newCount

        if (newCount <= prevCount) return

        const addedAtTop = scrollHeightBeforeLoadRef.current > 0

        if (addedAtTop) {
            // Restore position: pin to where the user was before prepend.
            const newScrollHeight = container.scrollHeight
            container.scrollTop += newScrollHeight - scrollHeightBeforeLoadRef.current
            scrollHeightBeforeLoadRef.current = 0
        } else if (isNearBottomRef.current) {
            bottomRef.current?.scrollIntoView({behavior: 'smooth'})
        }
    }, [messages])

    function handleScroll() {
        const container = scrollRef.current
        if (!container) return

        const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight

        isNearBottomRef.current = distanceFromBottom < 80

        // Trigger older message load when within 60px of the top.
        if (container.scrollTop < 60 && hasMore && !loadingOlder) {
            scrollHeightBeforeLoadRef.current = container.scrollHeight
            void loadOlderMessages()
        }
    }

    async function handleSend() {
        const trimmed = input.trim()
        if (!trimmed || sending) return

        setSending(true)
        setInput('')
        await sendMessage(trimmed)
        setSending(false)
        inputRef.current?.focus()
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-57px)] max-w-2xl mx-auto">
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
            >
                {/* Older messages indicator */}
                {hasMore && (
                    <div className="flex justify-center py-2">
                        {loadingOlder ? (
                            <span className="text-xs text-gray-400">Loading…</span>
                        ) : (
                            <span className="text-xs text-gray-400">Scroll up for older messages</span>
                        )}
                    </div>
                )}

                {messages.length === 0 && !hasMore ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="text-4xl mb-3 opacity-30">💬</div>
                        <p className="text-sm text-gray-400">
                            No messages yet. Say hello!
                        </p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const prevMsg = messages[i - 1]
                        // Group consecutive messages from the same sender
                        // sent within 5 minutes of each other.
                        const isGrouped =
                            prevMsg &&
                            prevMsg.senderName === msg.senderName &&
                            msg.createdAt - prevMsg.createdAt < 5 * 60 * 1000

                        return (
                            <div key={msg.id} className={isGrouped ? 'mt-0.5' : 'mt-2'}>
                                {!isGrouped && (
                                    <div className="flex items-baseline gap-2 mb-0.5">
                                        <span
                                            className="text-sm font-semibold"
                                            style={{color: msg.senderColor}}
                                        >
                                            {msg.senderName}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {formatTime(msg.createdAt)}
                                        </span>
                                    </div>
                                )}
                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                                    {msg.body}
                                </p>
                            </div>
                        )
                    })
                )}
                <div ref={bottomRef}/>
            </div>

            <div className="border-t border-gray-200 px-4 py-3 bg-white">
                <div className="flex gap-2 items-end">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Send a message… (Enter to send, Shift+Enter for new line)"
                        rows={1}
                        className="
                            flex-1 resize-none text-sm rounded-lg border border-gray-300
                            px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400
                            max-h-32 overflow-y-auto
                        "
                        style={{minHeight: '38px'}}
                        onInput={e => {
                            const el = e.currentTarget
                            el.style.height = 'auto'
                            el.style.height = `${el.scrollHeight}px`
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || sending}
                        className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm rounded-lg px-4 py-2 transition-colors shrink-0"
                    >
                        Send
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                    Enter to send · Shift+Enter for new line
                </p>
            </div>
        </div>
    )
}