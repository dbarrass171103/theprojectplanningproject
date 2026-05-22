// Preset palettes for the text-colour and highlight pickers.
// Hex values match Tailwind's scale so swatches harmonise with the rest of
// the UI. Text colours use -600 weights to read on white; highlights use
// -200 so dark text remains legible on top.

export const TEXT_COLOR_SWATCHES = [
    {name: 'Default', value: '#1f2937'},   // gray-800
    {name: 'Gray',    value: '#6b7280'},   // gray-500
    {name: 'Brown',   value: '#92400e'},   // amber-800
    {name: 'Red',     value: '#dc2626'},   // red-600
    {name: 'Orange',  value: '#ea580c'},   // orange-600
    {name: 'Yellow',  value: '#ca8a04'},   // yellow-600
    {name: 'Green',   value: '#16a34a'},   // green-600
    {name: 'Blue',    value: '#2563eb'},   // blue-600
    {name: 'Purple',  value: '#9333ea'},   // purple-600
    {name: 'Pink',    value: '#db2777'},   // pink-600
]

export const HIGHLIGHT_SWATCHES = [
    {name: 'Yellow', value: '#fef08a'},   // yellow-200
    {name: 'Green',  value: '#bbf7d0'},   // green-200
    {name: 'Blue',   value: '#bfdbfe'},   // blue-200
    {name: 'Pink',   value: '#fbcfe8'},   // pink-200
    {name: 'Purple', value: '#e9d5ff'},   // purple-200
    {name: 'Orange', value: '#fed7aa'},   // orange-200
    {name: 'Red',    value: '#fecaca'},   // red-200
    {name: 'Gray',   value: '#e5e7eb'},   // gray-200
    {name: 'Lime',   value: '#d9f99d'},   // lime-200
    {name: 'Cyan',   value: '#a5f3fc'},   // cyan-200
]

// Colour pairs for kanban columns. `cardColor` (-100) tints the card
// background; `columnColor` (-200) tints the column background behind them.
// null represents "no colour" (white cards, gray-100 column).
export interface ColumnColorSwatch {
    name: string
    cardColor: string | null
    columnColor: string | null
}

export const COLUMN_COLOR_SWATCHES: ColumnColorSwatch[] = [
    {name: 'None',   cardColor: null,      columnColor: null},
    {name: 'Red',    cardColor: '#fee2e2', columnColor: '#fecaca'},   // red-100   / red-200
    {name: 'Orange', cardColor: '#ffedd5', columnColor: '#fed7aa'},   // orange-100 / orange-200
    {name: 'Yellow', cardColor: '#fef9c3', columnColor: '#fef08a'},   // yellow-100 / yellow-200
    {name: 'Green',  cardColor: '#dcfce7', columnColor: '#bbf7d0'},   // green-100  / green-200
    {name: 'Teal',   cardColor: '#ccfbf1', columnColor: '#99f6e4'},   // teal-100   / teal-200
    {name: 'Blue',   cardColor: '#dbeafe', columnColor: '#bfdbfe'},   // blue-100   / blue-200
    {name: 'Indigo', cardColor: '#e0e7ff', columnColor: '#c7d2fe'},   // indigo-100 / indigo-200
    {name: 'Purple', cardColor: '#f3e8ff', columnColor: '#e9d5ff'},   // purple-100 / purple-200
    {name: 'Pink',   cardColor: '#fce7f3', columnColor: '#fbcfe8'},   // pink-100   / pink-200
    {name: 'Gray',   cardColor: '#f3f4f6', columnColor: '#e5e7eb'},   // gray-100   / gray-200
]

export const EVENT_COLORS = [
    {name: 'Blue',   value: '#3b82f6'},
    {name: 'Green',  value: '#22c55e'},
    {name: 'Red',    value: '#ef4444'},
    {name: 'Purple', value: '#a855f7'},
    {name: 'Orange', value: '#f97316'},
    {name: 'Pink',   value: '#ec4899'},
    {name: 'Teal',   value: '#14b8a6'},
    {name: 'Yellow', value: '#eab308'},
]
