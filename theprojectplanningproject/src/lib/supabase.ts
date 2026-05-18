// Supabase client factory with per-project auth headers. Clients are
// cached by header signature to avoid rebuilding on every request.

import {createClient, type SupabaseClient} from '@supabase/supabase-js'

const url = 'https://boqzceccrhragjopnmwz.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !anonKey) {
    throw new Error(
        'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local',
    )
}

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

/** Token-less client, used for project creation. */
export const supabase = getSupabase()

/** Project-scoped client with member token (and optional admin token). */
export function getSupabaseForProject(
    memberToken: string,
    adminToken?: string,
): SupabaseClient {
    return getSupabase({memberToken, adminToken})
}
