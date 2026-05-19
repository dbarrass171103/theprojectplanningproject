import {useEffect, useRef, useState} from 'react'
import {useChatStore} from '../../store/chatStore'
import {useCurrentProject} from '../../store/projectsStore'
import type {ChatMessage} from '../../types/chat'

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
}

function ReplyPreview({
    replyToId,
    replyToSender,
    replyToBody,
    isOwn,
    onScrollTo,
    originalExists,
}: {
    replyToId: string
    replyToSender: string
    replyToBody: string
    isOwn: boolean
    onScrollTo: (id: string) => void
    originalExists: boolean
}) {
    const baseClass = `
        w-full text-left mb-1.5 px-2 py-1 rounded-lg border-l-2 text-xs
        ${isOwn
            ? 'border-blue-300 bg-blue-400/30 text-blue-100'
            : 'border-gray-300 bg-gray-200/60 text-gray-500'
        }
    `

    if (!originalExists) {
        return (
            <div className={`${baseClass} opacity-60 cursor-default`}>
                <span className="block italic">Original message deleted</span>
            </div>
        )
    }

    return (
        <button
            type="button"
            onClick={() => onScrollTo(replyToId)}
            className={`${baseClass} transition-opacity hover:opacity-80`}
        >
            <span className="font-semibold block truncate">{replyToSender}</span>
            <span className="block truncate">{replyToBody}</span>
        </button>
    )
}

// Action buttons rendered inline above/below the bubble, aligned to the
// same side, so they never overflow the panel edge.
function MessageActions({
    isOwn,
    onReply,
    onEdit,
    onDelete,
}: {
    isOwn: boolean
    onReply: () => void
    onEdit?: () => void
    onDelete?: () => void
}) {
    return (
        <div className={`
            flex items-center gap-1 mb-1
            opacity-0 group-hover:opacity-100 transition-opacity
            ${isOwn ? 'justify-end' : 'justify-start'}
        `}>
            <button
                type="button"
                onClick={onReply}
                title="Reply"
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                           bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700
                           transition-colors border border-gray-200"
            >
                <span>↩</span>
                <span>Reply</span>
            </button>

            {isOwn && onEdit && (
                <button
                    type="button"
                    onClick={onEdit}
                    title="Edit"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                               bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700
                               transition-colors border border-gray-200"
                >
                    <span>✎</span>
                    <span>Edit</span>
                </button>
            )}

            {isOwn && onDelete && (
                <button
                    type="button"
                    onClick={onDelete}
                    title="Delete"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                               bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500
                               transition-colors border border-gray-200 hover:border-red-200"
                >
                    <span>✕</span>
                    <span>Delete</span>
                </button>
            )}
        </div>
    )
}

export default function ChatPanel() {
    const project = useCurrentProject()
    const messages = useChatStore(s => s.messages)
    const hasMore = useChatStore(s => s.hasMore)
    const loadingOlder = useChatStore(s => s.loadingOlder)
    const typingUsers = useChatStore(s => s.typingUsers)
    const replyingTo = useChatStore(s => s.replyingTo)
    const editingId = useChatStore(s => s.editingId)
    const sendMessage = useChatStore(s => s.sendMessage)
    const retryMessage = useChatStore(s => s.retryMessage)
    const editMessage = useChatStore(s => s.editMessage)
    const deleteMessage = useChatStore(s => s.deleteMessage)
    const setReplyingTo = useChatStore(s => s.setReplyingTo)
    const setEditingId = useChatStore(s => s.setEditingId)
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
    const lastTypingSentRef = useRef(0)
    const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const displayName = project?.displayName ?? ''

    useEffect(() => {
        setActive(true)
        return () => setActive(false)
    }, [setActive])

    useEffect(() => {
        bottomRef.current?.scrollIntoView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (editingId) {
            const msg = messages.find(m => m.id === editingId)
            if (msg) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setInput(msg.body)
                inputRef.current?.focus()
            }
        }
    }, [editingId])

    useEffect(() => {
        const container = scrollRef.current
        if (!container) return

        const prevCount = prevMessageCountRef.current
        const newCount = messages.length
        prevMessageCountRef.current = newCount

        if (newCount <= prevCount) return

        if (scrollHeightBeforeLoadRef.current > 0) {
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

    function scrollToMessage(id: string) {
        const el = messageRefs.current[id]
        if (!el) return
        el.scrollIntoView({behavior: 'smooth', block: 'center'})
        el.classList.add('ring-2', 'ring-blue-300', 'rounded-2xl')
        window.setTimeout(() => {
            el.classList.remove('ring-2', 'ring-blue-300', 'rounded-2xl')
        }, 1500)
    }

    async function handleSend() {
        const trimmed = input.trim()
        if (!trimmed || sending) return

        setSending(true)
        setInput('')
        if (inputRef.current) inputRef.current.style.height = 'auto'

        if (editingId) {
            await editMessage(editingId, trimmed)
        } else {
            await sendMessage(trimmed)
        }

        setSending(false)
        inputRef.current?.focus()
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
        if (e.key === 'Escape') {
            handleCancelCompose()
        }
    }

    function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        setInput(e.target.value)
        const now = Date.now()
        if (now - lastTypingSentRef.current > 2000) {
            lastTypingSentRef.current = now
            setTyping()
        }
    }

    function handleStartEdit(msg: ChatMessage) {
        setEditingId(msg.id)
        setInput(msg.body)
        inputRef.current?.focus()
    }

    function handleCancelCompose() {
        setEditingId(null)
        setReplyingTo(null)
        setInput('')
        if (inputRef.current) inputRef.current.style.height = 'auto'
    }

    const othersTyping = typingUsers.filter(u => u.name !== displayName)
    const typingLabel =
        othersTyping.length === 1
            ? `${othersTyping[0].name} is typing…`
            : othersTyping.length === 2
            ? `${othersTyping[0].name} and ${othersTyping[1].name} are typing…`
            : othersTyping.length > 2
            ? 'Several people are typing…'
            : null

    const isEditing = editingId !== null

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
                                ref={el => { messageRefs.current[msg.id] = el }}
                                className={`
                                    group flex flex-col
                                    ${isOwn ? 'items-end' : 'items-start'}
                                    ${isGrouped ? 'mt-0.5' : 'mt-3'}
                                `}
                            >
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

                                {/* Action buttons — inline above bubble, same alignment */}
                                {msg.status === 'sent' && (
                                    <MessageActions
                                        isOwn={isOwn}
                                        onReply={() => setReplyingTo(msg)}
                                        onEdit={isOwn ? () => handleStartEdit(msg) : undefined}
                                        onDelete={isOwn ? () => deleteMessage(msg.id) : undefined}
                                    />
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
                                    {msg.replyToId && msg.replyToBody && msg.replyToSender && (
                                        <ReplyPreview
                                            replyToId={msg.replyToId}
                                            replyToSender={msg.replyToSender}
                                            replyToBody={msg.replyToBody}
                                            isOwn={isOwn}
                                            onScrollTo={scrollToMessage}
                                            originalExists={messages.some(m => m.id === msg.replyToId)}
                                        />
                                    )}

                                    {msg.body}
                                </div>

                                {msg.editedAt && (
                                    <span className="text-[10px] text-gray-400 mt-0.5">
                                        edited
                                    </span>
                                )}

                                {isOwn && msg.status === 'sending' && (
                                    <span className="text-[10px] text-gray-400 mt-0.5">
                                        Sending…
                                    </span>
                                )}
                                {isOwn && msg.status === 'failed' && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] text-red-500">Failed to send</span>
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

            <div className="px-4 h-5 flex items-center">
                {typingLabel && (
                    <span className="text-xs text-gray-400 italic">{typingLabel}</span>
                )}
            </div>

            {(replyingTo || isEditing) && (
                <div className="mx-4 mb-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-500 mb-0.5">
                            {isEditing ? 'Editing message' : `Replying to ${replyingTo!.senderName}`}
                        </p>
                        {!isEditing && (
                            <p className="text-xs text-gray-400 truncate">{replyingTo!.body}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={handleCancelCompose}
                        className="text-gray-400 hover:text-gray-700 text-sm shrink-0 leading-none"
                        aria-label="Cancel"
                    >
                        ✕
                    </button>
                </div>
            )}

            <div className="border-t border-gray-200 px-4 py-3 bg-white">
                <div className="flex gap-2 items-end">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={isEditing ? 'Edit message…' : 'Send a message…'}
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
                        {isEditing ? 'Save' : 'Send'}
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                    Enter to {isEditing ? 'save' : 'send'} · Shift+Enter for new line · Esc to cancel
                </p>
            </div>
        </div>
    )
}