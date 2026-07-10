// Local store for project membership and metadata.
// Persists known projects + current selection to localStorage.

import {create} from 'zustand'
import {supabase, getSupabaseForProject} from '../lib/supabase'
import {generateProjectId, generateToken} from '../utils/projectIds'
import {buildSeededBoardStateB64} from '../utils/boardYdoc'

export interface KnownProject {
    id: string
    name: string
    memberToken: string
    inviteToken?: string
    adminToken?: string
    displayName: string
    joinedAt: number
    tokenMigrated?: boolean
}

interface ProjectsStore {
    knownProjects: Record<string, KnownProject>
    currentProjectId: string | null

    createProject: (name: string, displayName: string) => Promise<KnownProject>
    joinProject: (id: string, inviteToken: string, adminToken: string | undefined, displayName: string) => Promise<KnownProject>
    ensureMembership: (id: string) => Promise<void>
    setCurrentProject: (id: string | null) => void
    leaveProject: (id: string) => void
    updateDisplayName: (projectId: string, displayName: string) => void
    updateInviteToken: (projectId: string, inviteToken: string) => void
    renameProject: (projectId: string, name: string) => Promise<void>
    deleteProject: (projectId: string) => Promise<void>
}

interface PersistedState {
    knownProjects: Record<string, KnownProject>
    currentProjectId: string | null
}

const STORAGE_KEY = 'projects-store'

function loadState(): PersistedState {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : {knownProjects: {}, currentProjectId: null}
    } catch {
        return {knownProjects: {}, currentProjectId: null}
    }
}

function saveState(state: PersistedState) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
        console.warn('Failed to save projects store', e)
    }
}

const initial = loadState()

export const useProjectsStore = create<ProjectsStore>((set) => ({
    knownProjects: initial.knownProjects,
    currentProjectId: initial.currentProjectId,

    createProject: async (name, displayName) => {
        const id = generateProjectId()
        const inviteToken = generateToken()
        const adminToken = generateToken()
        const personalToken = generateToken()

        const {error} = await supabase
            .from('projects')
            .insert({
                id,
                name: name.trim() || 'Untitled project',
                member_token: inviteToken,
                admin_token: adminToken,
            })

        if (error) {
            throw new Error(`Failed to create project: ${error.message}`)
        }

        // Register the creator as an admin member and mint their token
        const {error: joinError} = await supabase.rpc('join_project', {
            p_project_id: id,
            p_invite_token: inviteToken,
            p_admin_token: adminToken,
            p_display_name: displayName,
            p_member_token: personalToken,
        })
        if (joinError) {
            throw new Error(`Failed to create project membership: ${joinError.message}`)
        }

        // Seed the board document with the three default columns
        // (To do / In progress / Complete) before anyone connects.
        //
        // We do this here — rather than in BoardProvider on first connect —
        // because seeding at connect-time has a race: if the creator shares
        // the link before the snapshot debounce fires, a second client can
        // connect to an empty board and seed it again, producing duplicates.
        // Writing the snapshot at creation time eliminates that window.
        //
        // Failure here is non-fatal: the project is still usable, it will
        // just open with no columns and the user can add their own.
        try {
            const projectClient = getSupabaseForProject(personalToken, adminToken)
            const {error: seedError} = await projectClient
                .from('board_documents')
                .upsert(
                    {
                        project_id: id,
                        state_b64: buildSeededBoardStateB64(),
                        updated_at: new Date().toISOString(),
                        updated_by: displayName,
                    },
                    {onConflict: 'project_id'},
                )
            if (seedError) {
                console.warn('Failed to seed default columns:', seedError)
            }
        } catch (e) {
            console.warn('Failed to seed default columns:', e)
        }

        const project: KnownProject = {
            id,
            name: name.trim() || 'Untitled project',
            memberToken: personalToken,
            inviteToken,
            adminToken,
            displayName,
            joinedAt: Date.now(),
            tokenMigrated: true,
        }

        set((state) => {
            const knownProjects = {...state.knownProjects, [id]: project}
            saveState({knownProjects, currentProjectId: id})
            return {knownProjects, currentProjectId: id}
        })

        return project
    },

    joinProject: async (id, inviteToken, adminToken, displayName) => {
        const personalToken = generateToken()

        const {data, error} = await supabase.rpc('join_project', {
            p_project_id: id,
            p_invite_token: inviteToken,
            p_admin_token: adminToken ?? '',
            p_display_name: displayName,
            p_member_token: personalToken,
        })

        if (error) {
            throw new Error('Project not found, or the link is invalid.')
        }

        // join_project returns a single {role, project_name} row.
        const row = Array.isArray(data) ? data[0] : data
        const role: string | undefined = row?.role
        const projectName: string = row?.project_name ?? 'Untitled project'

        const isAdmin = role === 'admin'

        const project: KnownProject = {
            id,
            name: projectName,
            memberToken: personalToken,
            inviteToken: isAdmin ? inviteToken : undefined,
            adminToken: isAdmin ? adminToken : undefined,
            displayName,
            joinedAt: Date.now(),
            tokenMigrated: true,
        }

        set((state) => {
            const knownProjects = {...state.knownProjects, [id]: project}
            saveState({knownProjects, currentProjectId: id})
            return {knownProjects, currentProjectId: id}
        })

        return project
    },

    ensureMembership: async (id) => {
        const existing = useProjectsStore.getState().knownProjects[id]
        if (!existing || existing.tokenMigrated) return

        // Legacy: the stored memberToken is still the shared invite
        // token. Exchange it for a personal token via join_project.
        const inviteToken = existing.memberToken
        const personalToken = generateToken()

        const {error} = await supabase.rpc('join_project', {
            p_project_id: id,
            p_invite_token: inviteToken,
            p_admin_token: existing.adminToken ?? '',
            p_display_name: existing.displayName,
            p_member_token: personalToken,
        })

        if (error) {
            console.warn('Failed to migrate to a personal token:', error)
            return
        }

        set((state) => {
            const prev = state.knownProjects[id]
            if (!prev) return state
            const isAdmin = !!prev.adminToken
            const updated: KnownProject = {
                ...prev,
                memberToken: personalToken,
                inviteToken: isAdmin ? inviteToken : undefined,
                tokenMigrated: true,
            }
            const knownProjects = {...state.knownProjects, [id]: updated}
            saveState({knownProjects, currentProjectId: state.currentProjectId})
            return {knownProjects}
        })
    },

    setCurrentProject: (id) =>
        set((state) => {
            if (id !== null && !state.knownProjects[id]) {
                console.warn(`Tried to set unknown project as current: ${id}`)
                return state
            }
            saveState({knownProjects: state.knownProjects, currentProjectId: id})
            return {currentProjectId: id}
        }),

    leaveProject: (id) =>
        set((state) => {
            const knownProjects = {...state.knownProjects}
            delete knownProjects[id]

            const currentProjectId =
                state.currentProjectId === id ? null : state.currentProjectId

            saveState({knownProjects, currentProjectId})
            return {knownProjects, currentProjectId}
        }),

    updateDisplayName: (projectId, displayName) =>
        set((state) => {
            const project = state.knownProjects[projectId]
            if (!project) return state

            const knownProjects = {
                ...state.knownProjects,
                [projectId]: {...project, displayName},
            }

            saveState({knownProjects, currentProjectId: state.currentProjectId})
            return {knownProjects}
        }),

    updateInviteToken: (projectId, inviteToken) =>
        set((state) => {
            const project = state.knownProjects[projectId]
            if (!project) return state

            const knownProjects = {
                ...state.knownProjects,
                [projectId]: {...project, inviteToken},
            }

            saveState({knownProjects, currentProjectId: state.currentProjectId})
            return {knownProjects}
        }),

    renameProject: async (projectId, name) => {
        const project = useProjectsStore.getState().knownProjects[projectId]
        if (!project?.adminToken) throw new Error('Only admins can rename a project')

        const trimmed = name.trim() || 'Untitled project'
        const client = getSupabaseForProject(project.memberToken, project.adminToken)
        const {error} = await client
            .from('projects')
            .update({name: trimmed})
            .eq('id', projectId)

        if (error) throw new Error(`Failed to rename project: ${error.message}`)

        set((state) => {
            const prev = state.knownProjects[projectId]
            if (!prev) return state
            const knownProjects = {
                ...state.knownProjects,
                [projectId]: {...prev, name: trimmed},
            }
            saveState({knownProjects, currentProjectId: state.currentProjectId})
            return {knownProjects}
        })
    },

    deleteProject: async (projectId) => {
        const project = useProjectsStore.getState().knownProjects[projectId]
        if (!project?.adminToken) throw new Error('Only admins can delete a project')

        const client = getSupabaseForProject(project.memberToken, project.adminToken)
        const {error} = await client
            .from('projects')
            .delete()
            .eq('id', projectId)

        if (error) throw new Error(`Failed to delete project: ${error.message}`)

        // Drop it from this device (cascade removes its data server-side).
        useProjectsStore.getState().leaveProject(projectId)
    },
}))

export function useCurrentProject(): KnownProject | null {
    const id = useProjectsStore((s) => s.currentProjectId)
    const known = useProjectsStore((s) => s.knownProjects)
    return id ? known[id] ?? null : null
}

export function getCurrentProject(): KnownProject | null {
    const {currentProjectId, knownProjects} = useProjectsStore.getState()
    return currentProjectId ? knownProjects[currentProjectId] ?? null : null
}