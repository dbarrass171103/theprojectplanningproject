// Admin-only member management: lists members and revokes/restores access,
// and rotates the shared invite token.

import {create} from 'zustand'
import {getSupabaseForProject} from '../lib/supabase'
import {generateToken} from '../utils/projectIds'
import {useProjectsStore} from './projectsStore'

export interface ProjectMember {
    id: string
    displayName: string
    role: 'member' | 'admin'
    revoked: boolean
    createdAt: number
    lastSeenAt: number | null
}

interface MembersStore {
    members: ProjectMember[]
    loading: boolean
    error: string | null

    loadMembers: (projectId: string) => Promise<void>
    setRevoked: (projectId: string, memberId: string, revoked: boolean) => Promise<void>
    rotateInvite: (projectId: string) => Promise<string | null>
    reset: () => void
}

function rowToMember(row: Record<string, unknown>): ProjectMember {
    return {
        id: row.id as string,
        displayName: row.display_name as string,
        role: (row.role as 'member' | 'admin'),
        revoked: row.revoked as boolean,
        createdAt: new Date(row.created_at as string).getTime(),
        lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at as string).getTime() : null,
    }
}

function adminClient(projectId: string) {
    const project = useProjectsStore.getState().knownProjects[projectId]
    if (!project) return null
    return getSupabaseForProject(project.memberToken, project.adminToken)
}

export const useMembersStore = create<MembersStore>((set) => ({
    members: [],
    loading: false,
    error: null,

    loadMembers: async (projectId) => {
        const client = adminClient(projectId)
        if (!client) return

        set({loading: true, error: null})

        const {data, error} = await client.rpc('list_project_members', {
            p_project_id: projectId,
        })

        if (error) {
            set({loading: false, error: error.message})
            return
        }

        const rows = (data as Record<string, unknown>[] | null) ?? []
        set({members: rows.map(rowToMember), loading: false})
    },

    setRevoked: async (projectId, memberId, revoked) => {
        const client = adminClient(projectId)
        if (!client) return

        set(state => ({
            members: state.members.map(m =>
                m.id === memberId ? {...m, revoked} : m,
            ),
        }))

        const {error} = await client.rpc('set_member_revoked', {
            p_member_id: memberId,
            p_revoked: revoked,
        })

        if (error) {
            // Roll back.
            set(state => ({
                members: state.members.map(m =>
                    m.id === memberId ? {...m, revoked: !revoked} : m,
                ),
                error: error.message,
            }))
        }
    },

    rotateInvite: async (projectId) => {
        const client = adminClient(projectId)
        if (!client) return null

        const newToken = generateToken()
        const {error} = await client.rpc('rotate_invite_token', {
            p_project_id: projectId,
            p_new_token: newToken,
        })

        if (error) {
            set({error: error.message})
            return null
        }

        // Keep our local invite link in sync so the Share modal shows the new one.
        useProjectsStore.getState().updateInviteToken(projectId, newToken)

        return newToken
    },

    reset: () => set({members: [], loading: false, error: null}),
}))
