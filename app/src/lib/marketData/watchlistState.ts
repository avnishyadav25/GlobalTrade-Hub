import 'server-only';
import { getServiceClient } from '@/lib/supabase/server';
import { universeFromWatchlistState, type InstrumentHint } from './universe';

// Read the user's persisted watchlist server-side.
//
// The cron tick has no browser to ask, so unlike the interactive poll it cannot be
// handed instrument descriptors in a request body. It reads the same row cloudSync
// already writes — `gth_app_state` key `watchlists` — whose `customInstruments` are
// complete Assets and therefore already carry `market` and `quoteCcy`. No migration.

export interface PersistedWatchlist {
    symbols: string[];
    hints: InstrumentHint[];
}

/**
 * Null when Supabase or ADMIN_USER_ID is unset, the row is absent, or `value` is
 * malformed — callers fall back to the seeded catalog rather than failing.
 */
export async function loadPersistedWatchlist(): Promise<PersistedWatchlist | null> {
    const supabase = getServiceClient();
    const uid = process.env.ADMIN_USER_ID || null;
    if (!supabase || !uid) return null;

    try {
        const { data, error } = await supabase
            .from('gth_app_state')
            .select('value')
            .eq('user_id', uid)
            .eq('key', 'watchlists')
            .maybeSingle();
        if (error || !data?.value) return null;

        const { symbols, hints } = universeFromWatchlistState(data.value);
        return symbols.length ? { symbols, hints } : null;
    } catch {
        return null;
    }
}
