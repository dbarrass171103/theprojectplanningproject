import {useState} from "react";
import {useKanbanStore} from "../../store/kanbanStore";

interface AddCardFormProps {
    columnId: string
}

export default function AddCardForm({columnId}: AddCardFormProps) {
    const addCard = useKanbanStore(state => state.addCard)

    const [isOpen, setIsOpen] = useState(false)
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')

    function handleSubmit() {
        if (!title.trim()) return
        addCard(columnId, title.trim(), description.trim() || undefined)
        setTitle('')
        setDescription('')
        setIsOpen(false)
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') handleSubmit()
        if (e.key === 'Escape') setIsOpen(false)
    }

    if (!isOpen) {
        return (
            <button onClick={() => setIsOpen(true)}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg px-2 py-1.5 text-sm transition-colors text-left w-full">
                + Add card
            </button>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            <input
                autoFocus
                type="text"
                placeholder="Card title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-sm rounded-lg border border-gray-300 px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                className="text-sm rounded-lg border border-gray-300 px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
            <div className="flex gap-2">
                <button
                    onClick={handleSubmit}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg px-3 py-1.5 transition-colors"
                >
                    Add
                </button>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600 text-sm rounded-lg px-3 py-1.5 transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}