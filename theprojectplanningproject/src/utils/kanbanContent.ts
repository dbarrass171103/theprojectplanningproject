// Plain-text extraction and note-mention scanning for Tiptap JSON docs.

import type {JSONContent} from '@tiptap/core'

export function tiptapDocToText(doc: JSONContent | undefined): string {
    if (!doc) return ""
    const parts: string[] = []
    walk(doc, parts)
    return parts.join("").trim()
}

function walk(node: JSONContent, out: string[]) {
    if (node.type === "text" && typeof node.text === "string") {
        out.push(node.text)
        return
    }

    // Render @noteMention as "@Label" so previews stay readable.
    if (node.type === "noteMention") {
        const label = (node.attrs?.label as string | undefined) ?? "note"
        out.push(`@${label}`)
        return
    }

    if (Array.isArray(node.content)) {
        for (let i = 0; i < node.content.length; i++) {
            walk(node.content[i], out)
            if (i < node.content.length - 1 && isBlock(node.content[i])) {
                out.push(" ")
            }
        }
    }
}

function isBlock(node: JSONContent): boolean {
    return (
        node.type === "paragraph" ||
        node.type === "heading" ||
        node.type === "bulletList" ||
        node.type === "orderedList" ||
        node.type === "blockquote" ||
        node.type === "codeBlock"
    )
}

/** Collect every @noteMention ID in the document, used for backlinks. */
export function extractMentionedNoteIds(doc: JSONContent | undefined): string[] {
    if (!doc) return []
    const ids: string[] = []
    walkForMentions(doc, ids)
    return ids
}

function walkForMentions(node: JSONContent, out: string[]) {
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
