import {useEffect, useRef, useState} from 'react'

interface ColorOption {
    name: string
    value: string
}

interface ColorPickerButtonProps {
    label: string
    icon: React.ReactNode
    swatches: ColorOption[]
    currentColor: string | null
    onSelect: (color: string) => void
    onClear: () => void
    isActive?: boolean
    variant?: 'light' | 'dark'
}

/**
 * A toolbar/bubble-menu button that opens a popover containing:
 * - preset colour swatches
 * - a custom colour picker
 * - a "clear" option
 * Used for both text colour and highlight colour.
 */
export default function ColorPickerButton({
    label,
    icon,
    swatches,
    currentColor,
    onSelect,
    onClear,
    isActive,
    variant = 'light',
}: ColorPickerButtonProps) {
    // Whether the popover is open.
    const [isOpen, setIsOpen] = useState(false)
    // Ref to the whole component so we can detect outside clicks.
    const containerRef = useRef<HTMLDivElement | null>(null)

    // Close whenever clicking outside.

    useEffect(() => {
        if (!isOpen) return

        function onDocMouseDown(e: MouseEvent) {
            if (!containerRef.current) return
            if (!containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', onDocMouseDown)
        return () => document.removeEventListener('mousedown', onDocMouseDown)
    }, [isOpen])

    // Prevent the editor losing focus when interacting with popup
    const stopBlur = (e: React.MouseEvent) => e.preventDefault()

    // Styling variants for toolbar vs bubble menu.
    const buttonBase =
        variant === 'dark'
            ? 'text-gray-200 hover:bg-gray-700 hover:text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'

    const activeStyle =
        variant === 'dark'
            ? 'bg-gray-700 text-white'
            : 'bg-blue-100 text-blue-700'

    return (
        <div ref={containerRef} className="relative">
            {/* Main button that toggles the popover */}
            <button
                type="button"
                onMouseDown={stopBlur}
                onClick={() => setIsOpen(o => !o)}
                aria-label={label}
                aria-pressed={isActive}
                aria-expanded={isOpen}
                title={label}
                className={`
                    flex items-center gap-0.5 px-1.5 py-1 text-sm rounded transition-colors
                    ${isActive ? activeStyle : buttonBase}
                `}
            >
                <span className="flex flex-col items-center">
                    {icon}

                    {/* Small colour indicator bar under the icon */}
                    <span
                        className="block w-4 h-0.5 mt-0.5 rounded-sm"
                        style={{backgroundColor: currentColor ?? '#d1d5db'}}
                    />
                </span>

                {/* Dropdown arrow */}
                <span className="text-[10px] opacity-60">▾</span>
            </button>

            {/* Popover */}
            {isOpen && (
                <div
                    onMouseDown={stopBlur}
                    className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[180px]"
                >
                    {/* Swatch grid */}
                    <div className="grid grid-cols-5 gap-1 mb-2">
                        {swatches.map(swatch => {
                            const isCurrent =
                                currentColor?.toLowerCase() === swatch.value.toLowerCase()

                            return (
                                <button
                                    key={swatch.value}
                                    type="button"
                                    onMouseDown={stopBlur}
                                    onClick={() => {
                                        onSelect(swatch.value)
                                        setIsOpen(false)
                                    }}
                                    aria-label={swatch.name}
                                    title={swatch.name}
                                    className={`
                                        w-7 h-7 rounded border transition-transform hover:scale-110
                                        ${isCurrent
                                            ? 'border-blue-500 ring-2 ring-blue-200'
                                            : 'border-gray-200'}
                                    `}
                                    style={{backgroundColor: swatch.value}}
                                />
                            )
                        })}
                    </div>

                    {/* Custom colour and Clear button */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                        <label
                            onMouseDown={stopBlur}
                            className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer hover:text-gray-800"
                        >
                            {/* Colour wheel preview */}
                            <span
                                className="w-5 h-5 rounded border border-gray-200"
                                style={{
                                    background:
                                        'conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)',
                                }}
                            />

                            Custom

                            {/* Hidden native colour picker */}
                            <input
                                type="color"
                                value={currentColor ?? '#000000'}
                                onChange={(e) => onSelect(e.target.value)}
                                className="sr-only"
                            />
                        </label>

                        {/* Clear button */}
                        <button
                            type="button"
                            onMouseDown={stopBlur}
                            onClick={() => {
                                onClear()
                                setIsOpen(false)
                            }}
                            className="ml-auto text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
