import {createClient, type SupabaseClient} from '@supabase/supabase-js'

const url = 'https://boqzceccrhragjopnmwz.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !anonKey) {
    throw new Error(
        'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local',
    )
}

// Supabase configures headers at client construction time (no per-query API).
// Since our auth headers depend on the current project, we cache clients
// keyed by header content and rebuild only when needed.
const clientCache = new Map<string, SupabaseClient>()

interface ClientOptions {
    memberToken?: string
    adminToken?: string
}

function buildClient({memberToken, adminToken}: ClientOptions): SupabaseClient {
    const headers: Record<string, string> = {}
    if (memberToken) headers['x-member-token'] = memberToken
    if (adminToken) headers['x-admin-token'] = adminToken

    return createClient(url, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        global: {headers},
    })
}

export function getSupabase(opts: ClientOptions = {}): SupabaseClient {
    const key = `${opts.memberToken ?? ''}|${opts.adminToken ?? ''}`
    let client = clientCache.get(key)
    if (!client) {
        client = buildClient(opts)
        clientCache.set(key, client)
    }
    return client
}

// Token-less client for the project-creation path.
export const supabase = getSupabase()

// Common case: client authenticated as a member (optionally admin) of a
// specific project.
export function getSupabaseForProject(
    memberToken: string,
    adminToken?: string,
): SupabaseClient {
    return getSupabase({memberToken, adminToken})
}