import 'server-only';

// Server Supabase client using the service-role key. NEVER import this from a
// client component — the service role bypasses RLS and must stay server-side.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function getServiceClient(): SupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}
