// Stable, name-derived colours so each user gets a recognisable cursor.
// Same name → same colour. Picked from a hand-tuned palette that's readable
// on white backgrounds and distinct from each other.

const PALETTE = [
    '#e11d48', // rose-600
    '#ea580c', // orange-600
    '#ca8a04', // yellow-600
    '#16a34a', // green-600
    '#0891b2', // cyan-600
    '#2563eb', // blue-600
    '#7c3aed', // violet-600
    '#db2777', // pink-600
    '#65a30d', // lime-600
    '#0d9488', // teal-600
]

// Simple deterministic hash: not cryptographically meaningful, just a way
// to derive a stable index from a name string.
function hashString(s: string): number {
    let h = 0
    for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) | 0
    }
    return Math.abs(h)
}

export function colorForName(name: string): string {
    if (!name) return PALETTE[0]
    return PALETTE[hashString(name) % PALETTE.length]
}