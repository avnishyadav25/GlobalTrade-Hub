import 'server-only';
import { getServiceClient } from '@/lib/supabase/server';
import type { AutomationLease } from './lease';

// Server-side access to the rows the runner needs.
//
// The browser reaches gth_app_state through /api/state/[key]; the runner cannot, because
// it has no session cookie. It uses the service-role client directly — which means the
// monotonicity guard living in that route does NOT protect it, and has to be rebuilt
// here as an explicit precondition. See `writePaperIfUnchanged`.

const LEASE_KEY = 'automation';

function uid(): string | null {
    return process.env.ADMIN_USER_ID || null;
}

export async function readState<T = Record<string, unknown>>(key: string): Promise<T | null> {
    const supabase = getServiceClient();
    const user = uid();
    if (!supabase || !user) return null;
    const { data, error } = await supabase
        .from('gth_app_state')
        .select('value')
        .eq('user_id', user)
        .eq('key', key)
        .maybeSingle();
    if (error) return null;
    return (data?.value as T) ?? null;
}

export async function readLease(): Promise<AutomationLease | null> {
    return await readState<AutomationLease>(LEASE_KEY);
}

/** Merge-write the lease. Read-modify-write, so a heartbeat cannot clobber serverRanAt. */
export async function mergeLease(patch: Partial<AutomationLease>): Promise<boolean> {
    const supabase = getServiceClient();
    const user = uid();
    if (!supabase || !user) return false;
    const current = (await readLease()) ?? {};
    const { error } = await supabase
        .from('gth_app_state')
        .upsert({ user_id: user, key: LEASE_KEY, value: { ...current, ...patch }, updated_at: new Date().toISOString() },
                { onConflict: 'user_id,key' });
    return !error;
}

/**
 * Write the paper book back, but ONLY if nobody else has written since we read it.
 *
 * This is the guard that makes a lost order impossible rather than merely unlikely. The
 * lease keeps the browser and the runner from acting at the same time, but a tab can open
 * mid-run: the runner reads seq 100, the tab places and writes seq 101, and a blind write
 * from the runner would erase that order while leaving a perfectly balanced book behind.
 *
 * Postgres evaluates the predicate atomically, so `expectedSeq` is a real compare-and-set
 * rather than a check-then-write race of its own. Zero rows updated means someone got
 * there first, and the run is abandoned rather than merged — merging two divergent order
 * books is not solvable correctly.
 */
export async function writePaperIfUnchanged(
    value: Record<string, unknown>,
    expectedSeq: number
): Promise<{ written: boolean; reason?: string }> {
    const supabase = getServiceClient();
    const user = uid();
    if (!supabase || !user) return { written: false, reason: 'supabase not configured' };

    const { data, error } = await supabase
        .from('gth_app_state')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('user_id', user)
        .eq('key', 'paper')
        // The precondition. `->'state'->>'seq'` is text in jsonb, hence the string.
        .eq('value->state->>seq', String(expectedSeq))
        .select('key');

    if (error) return { written: false, reason: error.message };
    if (!data || data.length === 0) {
        return { written: false, reason: `book changed underneath us (expected seq ${expectedSeq})` };
    }
    return { written: true };
}
