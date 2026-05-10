/**
 * Convert a TipTap JSON document into plain text.
 * Used for:
 * - search indexing
 * - previews
 * - card titles derived from content
 */
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

// walk the tiptop document and extract text
function walk(node: TiptapNode, out: string[]) {
    // Raw text node
    if (node.type === "text" && typeof node.text === "string") {
        out.push(node.text)
        return
    }

    // Inline @note mention, convert to "@Label"
    if (node.type === "noteMention") {
        const label = (node.attrs?.label as string | undefined) ?? "note"
        out.push(`@${label}`)
        return
    }

    // Recurse into children
    if (Array.isArray(node.content)) {
        for (let i = 0; i < node.content.length; i++) {
            walk(node.content[i], out)

            // Add a space between block nodes to avoid words merging
            if (i < node.content.length - 1 && isBlock(node.content[i])) {
                out.push(" ")
            }
        }
    }
}

/**
 * Determines whether a node is a block-level element.
 * Used to insert spacing between blocks.
 */
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

/**
 * Extract all note IDs referenced via @noteMention nodes.
 * Used for:
 * - backlinks
 * - dependency tracking
 * - graph views
 */
export function extractMentionedNoteIds(doc: unknown): string[] {
    if (!doc || typeof doc !== "object") return []

    const ids: string[] = []
    walkForMentions(doc as TiptapNode, ids)
    return ids
}

// Recursively collect IDs from @noteMention nodes.
function walkForMentions(node: TiptapNode, out: string[]) {
    if (node.type === "noteMention") {
        const id = node.attrs?.id as string | undefined
        if (id) out.push(id)
        return
    }

    if (Array.isArray(node.content)) {
        for (const child of node.content) {
            walkForMentions(child, out)
        }
    }
}
