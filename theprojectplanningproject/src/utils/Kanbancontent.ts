// Utilities for reading content out of Tiptap JSON documents without
// mounting a full editor instance.
//
// Two public functions:
//   tiptapDocToText       — plain-text extraction for search previews
//   extractMentionedNoteIds — collect all @note mention IDs for backlinks
//
// Both walk the document tree recursively. The TiptapNode type here is
// intentionally loose — we only read the fields we care about and ignore
// any extension-specific attrs we don't recognise.

export function tiptapDocToText(doc: unknown): string {
    if (!doc || typeof doc !== "object") return ""

    const parts: string[] = []
    walk(doc as TiptapNode, parts)

    return parts.join("").trim()
}

interface TiptapNode {
    type?: string
    text?: string
    attrs?: Record<string, unknown>
    content?: TiptapNode[]
}

function walk(node: TiptapNode, out: string[]) {
    if (node.type === "text" && typeof node.text === "string") {
        out.push(node.text)
        return
    }

    // @note mention — render as "@Label" so the plain text stays readable
    // in search previews rather than showing a raw ID.
    if (node.type === "noteMention") {
        const label = (node.attrs?.label as string | undefined) ?? "note"
        out.push(`@${label}`)
        return
    }

    if (Array.isArray(node.content)) {
        for (let i = 0; i < node.content.length; i++) {
            walk(node.content[i], out)

            // Insert a space between adjacent block nodes so words at block
            // boundaries don't run together (e.g. "firstsecond" → "first second").
            if (i < node.content.length - 1 && isBlock(node.content[i])) {
                out.push(" ")
            }
        }
    }
}

function isBlock(node: TiptapNode): boolean {
    return (
        node.type === "paragraph" ||
        node.type === "heading" ||
        node.type === "bulletList" ||
        node.type === "orderedList" ||
        node.type === "blockquote" ||
        node.type === "codeBlock"
    )
}

// Collect all note IDs referenced by @noteMention nodes anywhere in the
// document. Used by NoteBacklinks to find cards that link to a given note.
export function extractMentionedNoteIds(doc: unknown): string[] {
    if (!doc || typeof doc !== "object") return []

    const ids: string[] = []
    walkForMentions(doc as TiptapNode, ids)
    return ids
}

function walkForMentions(node: TiptapNode, out: string[]) {
    if (node.type === "noteMention") {
        const id = node.attrs?.id as string | undefined
        if (id) out.push(id)
        // noteMention is an atom — no children to recurse into.
        return
    }

    if (Array.isArray(node.content)) {
        for (const child of node.content) {
            walkForMentions(child, out)
        }
    }
}
