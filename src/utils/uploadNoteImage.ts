// Image upload + storage cleanup for the note editor.
//
// Images are uploaded to the `note-images` Supabase Storage bucket,
// partitioned by project and note: `{projectId}/{noteId}/{uuid}.{ext}`.
// The bucket is public, so we store the public URL directly in the Y.Doc
// (small, fast to sync) and let the browser fetch the image on render.
//
// Cleanup runs in two places:
//   - deleteImagesForNote: the whole prefix, on note deletion
//   - deleteImageByUrl:    a single object, on in-note image removal
//
// Both reuse the project's member-token client so the same RLS policy
// that gates note_documents also gates image uploads and deletes.

import {getSupabaseForProject} from '../lib/supabase'
import type {KnownProject} from '../store/projectsStore'

const BUCKET = 'note-images'
// 10MB cap. Keeps individual fetches sane and avoids surprises with the
// 5MB Supabase Storage default upload size on hobby tiers.
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_PREFIX = 'image/'

export class ImageUploadError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ImageUploadError'
    }
}

function extensionFor(file: File): string {
    // Prefer the filename extension; fall back to the MIME subtype.
    const fromName = file.name.includes('.')
        ? file.name.split('.').pop()?.toLowerCase()
        : undefined
    if (fromName && /^[a-z0-9]+$/.test(fromName) && fromName.length <= 5) {
        return fromName
    }
    const fromMime = file.type.split('/')[1]?.split(';')[0]?.toLowerCase()
    return fromMime && /^[a-z0-9]+$/.test(fromMime) ? fromMime : 'png'
}

/**
 * Upload an image to storage and return its public URL. Throws
 * ImageUploadError on validation or upload failure so the caller can
 * surface a sensible message.
 */
export async function uploadNoteImage(
    file: File,
    project: KnownProject,
    noteId: string,
): Promise<string> {
    if (!file.type.startsWith(ALLOWED_PREFIX)) {
        throw new ImageUploadError(`Not an image file (${file.type || 'unknown type'})`)
    }
    if (file.size > MAX_BYTES) {
        throw new ImageUploadError(
            `Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB; max 10MB)`,
        )
    }

    const ext = extensionFor(file)
    const id = crypto.randomUUID()
    const path = `${project.id}/${noteId}/${id}.${ext}`

    const client = getSupabaseForProject(project.memberToken, project.adminToken)

    // upsert: false — the UUID in the path makes collisions effectively
    // impossible, so a conflict means something has gone wrong upstream
    // and we'd rather fail loudly than silently overwrite a sibling.
    const {error} = await client.storage
        .from(BUCKET)
        .upload(path, file, {
            contentType: file.type,
            upsert: false,
        })

    if (error) {
        throw new ImageUploadError(`Upload failed: ${error.message}`)
    }

    const {data} = client.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
}

/**
 * Reverse a public Supabase Storage URL into a storage path. Returns null
 * if the URL isn't one of ours (so we can't accidentally try to delete an
 * externally-hosted image embedded by some future feature).
 *
 * https://xxx.supabase.co/storage/v1/object/public/note-images/p1/n2/abc.png
 * -> "p1/n2/abc.png"
 */
function urlToStoragePath(url: string): string | null {
    try {
        const parsed = new URL(url)
        const marker = `/storage/v1/object/public/${BUCKET}/`
        const idx = parsed.pathname.indexOf(marker)
        if (idx === -1) return null
        // decodeURIComponent in case Supabase URL-encoded any path segments.
        return decodeURIComponent(parsed.pathname.slice(idx + marker.length))
    } catch {
        return null
    }
}

/**
 * Delete a single uploaded image by its public URL. Best-effort: errors
 * are logged and swallowed because cleaning up orphans is a nicety, not
 * a correctness requirement.
 */
export async function deleteImageByUrl(
    project: KnownProject,
    url: string,
): Promise<void> {
    const path = urlToStoragePath(url)
    if (!path) return

    // Guard against cross-project deletes. The URL was inserted into a
    // note in the current project, so its first path segment must match
    // — anything else means someone pasted in a foreign URL and we
    // should leave it alone.
    const firstSegment = path.split('/')[0]
    if (firstSegment !== project.id) {
        console.warn(
            `Refusing to delete image at ${path}: project id mismatch`,
        )
        return
    }

    const client = getSupabaseForProject(project.memberToken, project.adminToken)

    try {
        const {error} = await client.storage.from(BUCKET).remove([path])
        if (error) {
            console.warn(`Failed to delete image ${path}:`, error)
        }
    } catch (e) {
        console.warn(`Image delete threw for ${path}:`, e)
    }
}

/**
 * Delete every image stored under a note's prefix. Used on note delete.
 * Best-effort: any failure is logged and swallowed so a storage hiccup
 * can't leave the note metadata half-deleted.
 */
export async function deleteImagesForNote(
    project: KnownProject,
    noteId: string,
): Promise<void> {
    const client = getSupabaseForProject(project.memberToken, project.adminToken)
    const prefix = `${project.id}/${noteId}`

    try {
        const {data: entries, error: listError} = await client.storage
            .from(BUCKET)
            .list(prefix, {limit: 1000})

        if (listError) {
            console.warn(`Failed to list images for note ${noteId}:`, listError)
            return
        }
        if (!entries || entries.length === 0) return

        const paths = entries.map(e => `${prefix}/${e.name}`)
        const {error: removeError} = await client.storage.from(BUCKET).remove(paths)
        if (removeError) {
            console.warn(`Failed to remove images for note ${noteId}:`, removeError)
        }
    } catch (e) {
        console.warn(`Image cleanup threw for note ${noteId}:`, e)
    }
}