// Chat panel, message history and input for the project chat.

import {useEffect, useRef, useState} from 'react'
import {useChatStore} from '../../store/chatStore'

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
}

export default function ChatPanel() {
    const messages = useChatStore(s => s.messages)
    const sendMessage = useChatStore(s => s.sendMessage)
    const setActive = useChatStore(s => s.setActive)

    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const inputRef = useRef<HTMLTextAreaElement | null>(null)

    // Mark the tab as active so unread count pauses while open.
    useEffect(() => {
        setActive(true)
        return () => setActive(false)
    }, [setActive])

    // Scroll to bottom when new messages arrive.
    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: 'smooth'})
    }, [messages])

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
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="text-4xl mb-3 opacity-30">💬</div>
                        <p className="text-sm text-gray-400">
                            No messages yet. Say hello!
                        </p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const prevMsg = messages[i - 1]
                        // Group consecutive messages from the same sender.
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
                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words pl-0">
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
                        style={{
                            height: 'auto',
                            minHeight: '38px',
                        }}
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
