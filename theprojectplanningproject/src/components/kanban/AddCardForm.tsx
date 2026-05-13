// Inline form for adding a card to a kanban column.
//
// Collapsed state: shows a faint "+ Add card" button at the bottom of the column.
// Expanded state: shows a title input, a rich-text description editor
// (CardDescriptionEditor — same Tiptap setup as the full card edit), and
// Add / Cancel buttons.
//
// Keyboard:
//   - Enter in the title submits the form.
//   - Escape closes the form without adding.
//
// The description editor returns a Tiptap JSON document. We only pass the
// description to `addCard` if it actually contains content — an empty doc
// (just the default paragraph node) is treated as "no description."

import {useState} from "react";
import {useKanbanStore} from "../../store/kanbanStore";
import CardDescriptionEditor from "./CardDescriptionEditor";

interface AddCardFormProps {
    columnId: string
}

export default function AddCardForm({columnId}: AddCardFormProps) {
    const addCard = useKanbanStore(state => state.addCard)

    const [isOpen, setIsOpen] = useState(false)
    const [title, setTitle] = useState('')
    // Tiptap document — typed as `unknown` because it's a JSON tree whose
    // exact shape varies with the extensions enabled.
    const [description, setDescription] = useState<unknown>(null)

    function handleSubmit() {
        if (!title.trim()) return

        // Detect whether the description has actual content. An empty Tiptap
        // doc still has the default paragraph node, so we compare against that
        // exact shape to decide whether to save the description at all.
        const hasContent =
            description &&
            typeof description === 'object' &&
            JSON.stringify(description) !== JSON.stringify({
                type: 'doc',
                content: [{type: 'paragraph'}]
            })

        addCard(columnId, title.trim(), hasContent ? description : undefined)

        // Reset form state for next use.
        setTitle('')
        setDescription(null)
        setIsOpen(false)
    }

    function handleTitleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') {
            // preventDefault stops native form-submit behaviour from reloading the page.
            e.preventDefault()
            handleSubmit()
        }
        if (e.key === 'Escape') setIsOpen(false)
    }

    // Collapsed state.
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

    // Expanded form.
    return (
        <div className="flex flex-col gap-2">
            <input
                autoFocus
                type="text"
                placeholder="Card title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                className="text-sm rounded-lg border border-gray-300 px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            <div className="rounded-lg border border-gray-300 px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-400">
                <CardDescriptionEditor
                    initialContent={null}
                    onChange={setDescription}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsOpen(false)}
                    placeholder="Description (optional) "
                />
            </div>

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