// Preset colour palettes for the text-colour and highlight-colour pickers.
//
// Hex values are picked to match Tailwind's colour scale, so swatches
// visually harmonise with the rest of the UI. Comments next to each
// entry name the Tailwind class for reference.
//
// Text colours: at -600 weight so they're readable on white background.
// Highlights: at -200 weight so dark text remains legible on top.

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