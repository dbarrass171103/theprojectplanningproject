import {create} from 'zustand'
import {supabase, getSupabaseForProject} from '../lib/supabase'
import {generateProjectId, generateToken} from '../utils/projectIds'

export interface KnownProject {
    id: string
    name: string
    memberToken: string
    adminToken?: string
    displayName: string
    joinedAt: number
}

interface ProjectsStore {
    knownProjects: Record<string, KnownProject>
    currentProjectId: string | null
    createProject: (name: string, displayName: string) => Promise<KnownProject>
    joinProject: (id: string, memberToken: string, displayName: string) => Promise<KnownProject>
    setCurrentProject: (id: string | null) => void
    leaveProject: (id: string) => void
    updateDisplayName: (projectId: string, displayName: string) => void
}

interface PersistedState {
    knownProjects: Record<string, KnownProject>
    currentProjectId: string | null
}

const STORAGE_KEY = 'projects-store'

function loadState(): PersistedState {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (!saved) return {knownProjects: {}, currentProjectId: null}
        return JSON.parse(saved)
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
        const memberToken = generateToken()
        const adminToken = generateToken()

        // The unauthenticated client is fine here — RLS allows anonymous
        // INSERTs into projects.
        const {error} = await supabase
            .from('projects')
            .insert({
                id,
                name: name.trim() || 'Untitled project',
                member_token: memberToken,
                admin_token: adminToken,
            })

        if (error) {
            throw new Error(`Failed to create project: ${error.message}`)
        }

        const project: KnownProject = {
            id,
            name: name.trim() || 'Untitled project',
            memberToken,
            adminToken,
            displayName,
            joinedAt: Date.now(),
        }

        set((state) => {
            const knownProjects = {...state.knownProjects, [id]: project}
            saveState({knownProjects, currentProjectId: id})
            return {knownProjects, currentProjectId: id}
        })

        return project
    },

    joinProject: async (id, memberToken, displayName) => {
        // Use a project-scoped client so the request carries the token. If
        // the token is wrong, RLS blocks the read and we get null data.
        const client = getSupabaseForProject(memberToken)
        const {data, error} = await client
            .from('projects')
            .select('id, name')
            .eq('id', id)
            .maybeSingle()

        if (error) {
            throw new Error(`Failed to verify project: ${error.message}`)
        }
        if (!data) {
            throw new Error('Project not found, or the link is invalid.')
        }

        const project: KnownProject = {
            id: data.id,
            name: data.name,
            memberToken,
            displayName,
            joinedAt: Date.now(),
        }

        set((state) => {
            const knownProjects = {...state.knownProjects, [id]: project}
            saveState({knownProjects, currentProjectId: id})
            return {knownProjects, currentProjectId: id}
        })

        return project
    },

    setCurrentProject: (id) => set((state) => {
        if (id !== null && !state.knownProjects[id]) {
            console.warn(`Tried to set unknown project as current: ${id}`)
            return state
        }
        saveState({knownProjects: state.knownProjects, currentProjectId: id})
        return {currentProjectId: id}
    }),

    leaveProject: (id) => set((state) => {
        const knownProjects = {...state.knownProjects}
        delete knownProjects[id]
        const currentProjectId = state.currentProjectId === id ? null : state.currentProjectId
        saveState({knownProjects, currentProjectId})
        return {knownProjects, currentProjectId}
    }),

    updateDisplayName: (projectId, displayName) => set((state) => {
        const project = state.knownProjects[projectId]
        if (!project) return state
        const knownProjects = {
            ...state.knownProjects,
            [projectId]: {...project, displayName},
        }
        saveState({knownProjects, currentProjectId: state.currentProjectId})
        return {knownProjects}
    }),
}))

export function useCurrentProject(): KnownProject | null {
    const id = useProjectsStore(s => s.currentProjectId)
    const known = useProjectsStore(s => s.knownProjects)
    return id ? known[id] ?? null : null
}

export function getCurrentProject(): KnownProject | null {
    const {currentProjectId, knownProjects} = useProjectsStore.getState()
    return currentProjectId ? knownProjects[currentProjectId] ?? null : null
}