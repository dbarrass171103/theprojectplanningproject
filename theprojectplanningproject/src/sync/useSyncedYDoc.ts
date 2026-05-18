// useSyncedYDoc
//
// Owns the full lifecycle of a Y.Doc synchronised via SupabaseYjsProvider.
// Previously this pattern was duplicated between BoardProvider and NoteEditor.
//
// `project` may be null, in which case the hook is inert (no effect runs,
// `synced` stays false) so it can be called unconditionally before a
// project is selected.
//
// `doc` and `awareness` are memoised on (project.id + docKey), so they are
// stable references safe to pass into Tiptap extension dep arrays.

import {useEffect, useMemo, useRef, useState} from 'react'
import * as Y from 'yjs'
import {Awareness} from 'y-protocols/awareness'
import {getSupabaseForProject} from '../lib/supabase'
import {SupabaseYjsProvider, type SupabaseYjsProviderOptions} from '../sync/SupabaseYjsProvider'
import {colorForName} from '../utils/userColor'
import type {KnownProject} from '../store/projectsStore'

export interface UseSyncedYDocOptions {
    project: KnownProject | null
    docKey: string
    channelPrefix: string
    snapshotTable: SupabaseYjsProviderOptions['snapshotTable']
    /**
     * Called once after the initial snapshot is applied and the realtime
     * channel is open. Receives the live doc + awareness so callers can do
     * one-time setup (e.g. binding the kanban store) before children render.
     */
    onSync?: (doc: Y.Doc, awareness: Awareness) => void
    onStatusChange?: (status: 'connecting' | 'connected' | 'offline') => void
    onRemoteUpdate?: (by: string) => void
}

export interface UseSyncedYDocResult {
    doc: Y.Doc
    awareness: Awareness
    synced: boolean
}

export function useSyncedYDoc({
    project,
    docKey,
    channelPrefix,
    snapshotTable,
    onSync,
    onStatusChange,
    onRemoteUpdate,
}: UseSyncedYDocOptions): UseSyncedYDocResult {
    // Stable references, recreated only when the logical document changes.
    // When project is null the doc never gets a provider attached, so it
    // stays empty and unsynced.
    const doc = useMemo(() => new Y.Doc(), [project?.id, docKey])
    const awareness = useMemo(() => new Awareness(doc), [doc])

    const [synced, setSynced] = useState(false)

    // Hold callbacks in refs so the effect doesn't re-run every render when
    // callers pass inline arrows.
    const onSyncRef = useRef(onSync)
    onSyncRef.current = onSync
    const onStatusChangeRef = useRef(onStatusChange)
    onStatusChangeRef.current = onStatusChange
    const onRemoteUpdateRef = useRef(onRemoteUpdate)
    onRemoteUpdateRef.current = onRemoteUpdate

    useEffect(() => {
        if (!project) return

        setSynced(false)

        const client = getSupabaseForProject(project.memberToken, project.adminToken)
        const user = {
            name: project.displayName,
            color: colorForName(project.displayName),
        }

        const provider = new SupabaseYjsProvider({
            client,
            projectId: project.id,
            docKey,
            channelPrefix,
            snapshotTable,
            doc,
            awareness,
            user,
            onSync: () => {
                onSyncRef.current?.(doc, awareness)
                setSynced(true)
            },
            onStatusChange: (status) => onStatusChangeRef.current?.(status),
            onRemoteUpdate: (by) => onRemoteUpdateRef.current?.(by),
        })

        void provider.connect()

        return () => {
            provider.destroy()
        }

        // Keyed on `doc` (which already encodes project.id + docKey via
        // useMemo above) rather than listing the raw strings again.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc])

    return {doc, awareness, synced}
}
