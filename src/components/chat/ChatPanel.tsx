// Chat panel — message history and input for the project chat.

import {useEffect, useRef, useState} from 'react'
import {useChatStore} from '../../store/chatStore'
import {useCurrentProject} from '../../store/projectsStore'

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
}

export default function ChatPanel() {
    const project = useCurrentProject()
    const messages = useChatStore(s => s.messages)
    const hasMore = useChatStore(s => s.hasMore)
    const loadingOlder = useChatStore(s => s.loadingOlder)
    const typingUsers = useChatStore(s => s.typingUsers)
    const sendMessage = useChatStore(s => s.sendMessage)
    const retryMessage = useChatStore(s => s.retryMessage)
    const loadOlderMessages = useChatStore(s => s.loadOlderMessages)
    const setTyping = useChatStore(s => s.setTyping)
    const setActive = useChatStore(s => s.setActive)

    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)

    const scrollRef = useRef<HTMLDivElement | null>(null)
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const inputRef = useRef<HTMLTextAreaElement | null>(null)
    const isNearBottomRef = useRef(true)
    const prevMessageCountRef = useRef(messages.length)
    const scrollHeightBeforeLoadRef = useRef(0)

    // Throttle typing broadcasts — at most one per 2s.
    const lastTypingSentRef = useRef(0)

    useEffect(() => {
        setActive(true)
        return () => setActive(false)
    }, [setActive])

    // Scroll to bottom on initial load only.
    useEffect(() => {
        bottomRef.current?.scrollIntoView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Handle scroll position after messages array changes.
    useEffect(() => {
        const container = scrollRef.current
        if (!container) return

        const prevCount = prevMessageCountRef.current
        const newCount = messages.length
        prevMessageCountRef.current = newCount

        if (newCount <= prevCount) return

        if (scrollHeightBeforeLoadRef.current > 0) {
            // Older messages were prepended — restore the viewport position.
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

        // Reset textarea height
        if (inputRef.current) {
            inputRef.current.style.height = 'auto'
        }

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

    function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        setInput(e.target.value)

        // Broadcast typing indicator, throttled to once per 2s.
        const now = Date.now()
        if (now - lastTypingSentRef.current > 2000) {
            lastTypingSentRef.current = now
            setTyping()
        }
    }

    const displayName = project?.displayName ?? ''

    // Typing indicator label, excluding ourselves.
    const othersTyping = typingUsers.filter(u => u.name !== displayName)
    const typingLabel =
        othersTyping.length === 1
            ? `${othersTyping[0].name} is typing…`
            : othersTyping.length === 2
            ? `${othersTyping[0].name} and ${othersTyping[1].name} are typing…`
            : othersTyping.length > 2
            ? 'Several people are typing…'
            : null

    return (
        <div className="flex flex-col h-[calc(100vh-57px)] max-w-2xl mx-auto">
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1"
            >
                {hasMore && (
                    <div className="flex justify-center py-2">
                        {loadingOlder
                            ? <span className="text-xs text-gray-400">Loading…</span>
                            : <span className="text-xs text-gray-400">Scroll up for older messages</span>
                        }
                    </div>
                )}

                {messages.length === 0 && !hasMore ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="text-4xl mb-3 opacity-30">💬</div>
                        <p className="text-sm text-gray-400">No messages yet. Say hello!</p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isOwn = msg.senderName === displayName
                        const prevMsg = messages[i - 1]
                        const isGrouped =
                            prevMsg &&
                            prevMsg.senderName === msg.senderName &&
                            msg.createdAt - prevMsg.createdAt < 5 * 60 * 1000

                        return (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}
                            >
                                {/* Sender name + timestamp — only on first of a group */}
                                {!isGrouped && (
                                    <div className={`flex items-baseline gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                                        <span
                                            className="text-xs font-semibold"
                                            style={{color: msg.senderColor}}
                                        >
                                            {msg.senderName}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {formatTime(msg.createdAt)}
                                        </span>
                                    </div>
                                )}

                                {/* Bubble */}
                                <div
                                    className={`
                                        max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                                        whitespace-pre-wrap break-words
                                        ${isOwn
                                            ? 'bg-blue-500 text-white rounded-br-sm'
                                            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                                        }
                                        ${msg.status === 'sending' ? 'opacity-60' : ''}
                                    `}
                                >
                                    {msg.body}
                                </div>

                                {/* Send status */}
                                {isOwn && msg.status === 'sending' && (
                                    <span className="text-[10px] text-gray-400 mt-0.5">
                                        Sending…
                                    </span>
                                )}
                                {isOwn && msg.status === 'failed' && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] text-red-500">
                                            Failed to send
                                        </span>
                                        <button
                                            onClick={() => msg.tempId && retryMessage(msg.tempId)}
                                            className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
                <div ref={bottomRef}/>
            </div>

            {/* Typing indicator */}
            <div className="px-4 h-5 flex items-center">
                {typingLabel && (
                    <span className="text-xs text-gray-400 italic">{typingLabel}</span>
                )}
            </div>

            <div className="border-t border-gray-200 px-4 py-3 bg-white">
                <div className="flex gap-2 items-end">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Send a message…"
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