'use client';

// Browser Supabase client. Returns null (and the app falls back to local
// persistence) until NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are configured.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
    if (cached !== undefined) return cached;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    cached = url && key ? createClient(url, key, { auth: { persistSession: true } }) : null;
    return cached;
}

export const isSupabaseConfigured = () =>
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
