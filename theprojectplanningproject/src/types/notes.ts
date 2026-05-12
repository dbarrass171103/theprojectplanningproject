// Core note data type.
//
// Note body content is stored separately as a Yjs document in the
// `note_documents` table — only metadata lives here. This keeps the notes
// store small and cheap to sync via project_data; the heavy CRDT state stays
// in SupabaseYjsProvider and is never serialised into the Zustand store.

export interface Note {
    id: string
    title: string
    createdAt: number
    updatedAt: number
}
