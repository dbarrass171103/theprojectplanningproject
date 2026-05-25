// Tracks image URLs in the editor doc and deletes orphaned uploads from
// storage when an image is removed from the note. Wired up in NoteEditor.
//
// On every editor update, the hook diffs the previous URL set against
// the current one. URLs that disappeared get a deferred storage delete
// scheduled — UNDO_GRACE_MS later. If the URL reappears in the doc
// within that window (because the user hit Ctrl-Z), the pending delete
// is cancelled and the file stays put.
//
// On unmount, any still-pending deletes are flushed immediately: the
// user has navigated away from the note, so the undo window is over.

import {useEffect, useRef} from 'react'
import type {Editor} from '@tiptap/react'
import {deleteImageByUrl} from '../../utils/uploadNoteImage'
import type {KnownProject} from '../../store/projectsStore'

const UNDO_GRACE_MS = 5000

// Walk the editor doc and collect every image src currently present.
function collectImageUrls(editor: Editor): Set<string> {
    const urls = new Set<string>()
    editor.state.doc.descendants(node => {
        if (node.type.name === 'image') {
            const src = node.attrs.src as string | undefined
            if (src) urls.add(src)
        }
        return true
    })
    return urls
}

export function useImageCleanup(
    editor: Editor | null,
    project: KnownProject,
): void {
    // The URL set we believe currently exists in the doc. Initialised
    // on first mount from the live doc so we don't schedule deletes for
    // images that were already present when we connected.
    const knownUrlsRef = useRef<Set<string> | null>(null)

    // Pending deletes keyed by URL -> setTimeout id. Lets us cancel the
    // delete if the URL reappears (undo).
    const pendingDeletesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
        new Map(),
    )

    useEffect(() => {
        if (!editor) return

        function handleUpdate() {
            if (!editor) return
            const current = collectImageUrls(editor)

            // First update after mount: seed the set without scheduling
            // any deletes. We don't want to wipe images that arrived as
            // part of the initial sync.
            if (knownUrlsRef.current === null) {
                knownUrlsRef.current = current
                return
            }

            const previous = knownUrlsRef.current

            // URLs that vanished -> schedule delete.
            for (const url of previous) {
                if (current.has(url)) continue
                if (pendingDeletesRef.current.has(url)) continue

                const timerId = setTimeout(() => {
                    pendingDeletesRef.current.delete(url)
                    void deleteImageByUrl(project, url)
                }, UNDO_GRACE_MS)
                pendingDeletesRef.current.set(url, timerId)
            }

            // URLs that came back (undo) -> cancel pending delete.
            for (const url of current) {
                if (previous.has(url)) continue
                const pending = pendingDeletesRef.current.get(url)
                if (pending) {
                    clearTimeout(pending)
                    pendingDeletesRef.current.delete(url)
                }
            }

            knownUrlsRef.current = current
        }

        // Seed the initial set synchronously so we don't fire deletes on
        // the very first user edit just because we hadn't observed the
        // doc yet.
        knownUrlsRef.current = collectImageUrls(editor)

        editor.on('update', handleUpdate)

        return () => {
            editor.off('update', handleUpdate)

            // Flush remaining pending deletes on unmount — the undo
            // window is closed as soon as the user leaves the note.
            const pending = pendingDeletesRef.current
            for (const [url, timerId] of pending) {
                clearTimeout(timerId)
                void deleteImageByUrl(project, url)
            }
            pending.clear()
            knownUrlsRef.current = null
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, project.id, project.memberToken])
}