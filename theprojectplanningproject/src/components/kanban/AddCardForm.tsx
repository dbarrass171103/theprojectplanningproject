import {useState} from "react";
import {useKanbanStore} from "../../store/kanbanStore";
import CardDescriptionEditor from "./CardDescriptionEditor";

interface AddCardFormProps {
    columnId: string // Column the card will belong to
}

export default function AddCardForm({columnId}: AddCardFormProps) {
    const addCard = useKanbanStore(state => state.addCard)

    // Controls whether the form is expanded or collapsed.
    const [isOpen, setIsOpen] = useState(false)
    // controls input for the card title.
    const [title, setTitle] = useState('')
    // controls input for the description
    const [description, setDescription] = useState<unknown>(null)

    function handleSubmit() {
        // Prevent empty titles.
        if (!title.trim()) return

        // Determine whether the description actually contains content.
        const hasContent =
            description &&
            typeof description === 'object' &&
            JSON.stringify(description) !== JSON.stringify({
                type: 'doc',
                content: [{type: 'paragraph'}]
            })

        // Add the card to the store.
        addCard(columnId, title.trim(), hasContent ? description : undefined)

        // Reset form state for next use.
        setTitle('')
        setDescription(null)
        setIsOpen(false)
    }

    // Keyboard shortcuts for the title input.
    function handleTitleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault() // Prevents form submission from reloading the page.
            handleSubmit()
        }
        if (e.key === 'Escape') setIsOpen(false)
    }

    // When the form is closed, show a "+ Add card" button.
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg px-2 py-1.5 text-sm transition-colors text-left w-full"
            >
                + Add card
            </button>
        )
    }

    // When open, show the full form.
    return (
        <div className="flex flex-col gap-2">
            {/* Title input field */}
            <input
                autoFocus
                type="text"
                placeholder="Card title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                className="text-sm rounded-lg border border-gray-300 px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            {/* Description editor wrapper */}
            <div className="rounded-lg border border-gray-300 px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-400">
                <CardDescriptionEditor
                    initialContent={null}
                    onChange={setDescription}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsOpen(false)}
                    placeholder="Description (optional) — type @ to link a note"
                />
            </div>

            {/* Action buttons */}
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
