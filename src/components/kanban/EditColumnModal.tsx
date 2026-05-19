// Modal for editing a column's title and accent colour. Triggered by the
// edit button in the column header. Picking a swatch sets both the card
// tint and the column background in a single Y.Doc transaction.

import {useEffect, useRef, useState} from 'react'
import {useKanbanStore} from '../../store/kanbanStore'
import { COLUMN_COLOR_SWATCHES} from "../common/ColorSwatches.ts";
import type {Column} from '../../types/kanban'

interface EditColumnModalProps {
    column: Column
    onClose: () => void
}

export default function EditColumnModal({column, onClose}: EditColumnModalProps) {
    const renameColumn = useKanbanStore(s => s.renameColumn)
    const setColumnColor = useKanbanStore(s => s.setColumnColor)

    const [title, setTitle] = useState(column.title)
    const dialogRef = useRef<HTMLDivElement | null>(null)
    const inputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
    }, [])

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose()
        }
        function onMouseDown(e: MouseEvent) {
            if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
                handleSave()
            }
        }

        document.addEventListener('keydown', onKey)
        document.addEventListener('mousedown', onMouseDown)
        return () => {
            document.removeEventListener('keydown', onKey)
            document.removeEventListener('mousedown', onMouseDown)
        }
    }, [title])

    function handleSave() {
        const trimmed = title.trim()
        if (trimmed && trimmed !== column.title) {
            renameColumn(column.id, trimmed)
        }
        onClose()
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') handleSave()
    }

    return (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 pt-32 px-4">
            <div
                ref={dialogRef}
                className="bg-white rounded-xl shadow-xl w-72 p-4 flex flex-col gap-4"
            >
                <h3 className="text-sm font-semibold text-gray-700">Edit column</h3>

                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        Title
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="text-sm rounded-lg border border-gray-300 px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                        Colour
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {COLUMN_COLOR_SWATCHES.map(swatch => {
                            const isSelected =
                                swatch.cardColor === null
                                    ? !column.color
                                    : column.color === swatch.cardColor

                            return (
                                <button
                                    key={swatch.name}
                                    type="button"
                                    title={swatch.name}
                                    onClick={() =>
                                        setColumnColor(
                                            column.id,
                                            swatch.cardColor,
                                            swatch.columnColor,
                                        )
                                    }
                                    className={`
                                        w-7 h-7 rounded-full border-2 transition-transform hover:scale-110
                                        ${isSelected
                                            ? 'border-blue-500 ring-2 ring-blue-200'
                                            : 'border-gray-200'
                                        }
                                    `}
                                    style={{
                                        backgroundColor: swatch.columnColor ?? '#ffffff',
                                        backgroundImage: swatch.cardColor === null
                                            ? 'repeating-linear-gradient(45deg, #d1d5db 0, #d1d5db 1px, transparent 0, transparent 50%)'
                                            : undefined,
                                        backgroundSize: swatch.cardColor === null ? '6px 6px' : undefined,
                                    }}
                                    aria-pressed={isSelected}
                                    aria-label={swatch.name}
                                />
                            )
                        })}
                    </div>
                    {/* Preview strip showing card vs column shade side by side */}
                    {column.color && (
                        <div className="mt-3 flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                            <div
                                className="flex-1 px-2 py-1.5 text-gray-600"
                                style={{backgroundColor: column.columnColor ?? '#f3f4f6'}}
                            >
                                Column
                            </div>
                            <div
                                className="flex-1 px-2 py-1.5 text-gray-600"
                                style={{backgroundColor: column.color}}
                            >
                                Cards
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    )
}
