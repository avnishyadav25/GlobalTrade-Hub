import 'server-only';
import { getServiceClient } from '@/lib/supabase/server';
import { contractInfo, optionChain, type OptionChain, type OptionRoot } from '@/lib/marketData/providers/nseOptionChain';

// Accumulating option-chain history, one trading day at a time.
//
// This exists because no free source publishes PAST Indian option chains — NSE's
// historical F&O endpoints answer 503 and there is no substitute. Options can therefore
// be paper-traded against a live chain today and backtested against real premiums only
// after enough days have been captured. The warehouse does not fix that limitation; it
// starts the clock on fixing it, and the UI states how many days exist so far rather
// than implying a history that is not there.

/** A strike, stripped to what a backtester can actually use. */
export interface CompactStrike {
    k: number;
    ce?: CompactSide;
    pe?: CompactSide;
}
interface CompactSide {
    /** Last traded premium. */
    p: number;
    /** NSE's implied volatility, omitted when it reported none. */
    iv?: number;
    oi?: number;
    /** The touch, so a backtest can charge a realistic spread rather than mid. */
    b?: number;
    a?: number;
}

/**
 * Strip a chain to about a fiftieth of its size.
 *
 * Measured, not estimated: a live NIFTY expiry arrives as ~240KB of JSON and stores as
 * 4.2KB across 105 strikes; BANKNIFTY is ~355KB in and 5.8KB out across 147. Storing the
 * raw payload would make a year of two underlyings roughly 150MB of jsonb for no
 * benefit, and every backtest would pay that cost on every read.
 */
export function compactChain(chain: OptionChain): CompactStrike[] {
    const side = (q: OptionChain['strikes'][number]['call']): CompactSide | undefined => {
        if (!q || q.lastPrice == null || q.lastPrice <= 0) return undefined;
        return {
            p: q.lastPrice,
            ...(q.impliedVolatility != null ? { iv: q.impliedVolatility } : {}),
            ...(q.openInterest != null ? { oi: q.openInterest } : {}),
            ...(q.bid != null && q.bid > 0 ? { b: q.bid } : {}),
            ...(q.ask != null && q.ask > 0 ? { a: q.ask } : {}),
        };
    };

    return chain.strikes
        .map((s) => {
            const ce = side(s.call);
            const pe = side(s.put);
            // A strike with no traded price on either side carries no information.
            return ce || pe ? { k: s.strike, ...(ce ? { ce } : {}), ...(pe ? { pe } : {}) } : null;
        })
        .filter((s): s is CompactStrike => s !== null);
}

/** IST trading date for an instant. IST is UTC+5:30 with no daylight saving, ever. */
export function istDate(nowMs: number): string {
    return new Date(nowMs + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

/** NSE's '18-Aug-2026' to an ISO date, for the `expiry` column. */
function isoExpiry(expiry: string): string | null {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(expiry.trim());
    if (!m) return null;
    const month = months.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
    if (month < 0) return null;
    return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export interface SnapshotOutcome {
    symbol: OptionRoot;
    expiry: string;
    strikes: number;
    stored: boolean;
    reason?: string;
}

/**
 * Capture the nearest expiry for each underlying.
 *
 * Only the nearest: the far months barely trade, and capturing every listed expiry would
 * multiply the request count against an unofficial endpoint for data nobody will read.
 *
 * Idempotent by primary key `(user_id, symbol, expiry, captured)`, so running the cron
 * more than once in a day overwrites rather than duplicating.
 */
export async function snapshotChains(roots: OptionRoot[], nowMs: number): Promise<SnapshotOutcome[]> {
    const supabase = getServiceClient();
    const userId = process.env.ADMIN_USER_ID || null;
    const captured = istDate(nowMs);
    const out: SnapshotOutcome[] = [];

    for (const symbol of roots) {
        const info = await contractInfo(symbol);
        const expiry = info?.data?.expiries?.[0];
        if (!expiry) {
            out.push({ symbol, expiry: '', strikes: 0, stored: false, reason: 'NSE did not return an expiry list.' });
            continue;
        }

        const chain = await optionChain(symbol, expiry);
        if (!chain?.data) {
            out.push({ symbol, expiry, strikes: 0, stored: false, reason: 'NSE did not return a chain.' });
            continue;
        }

        const compact = compactChain(chain.data);
        const iso = isoExpiry(expiry);

        // Refuse to store a chain we cannot key or reprice. A row with a null underlying
        // is worse than no row: a backtest would read it and silently produce nothing.
        if (!iso || chain.data.underlying == null || compact.length === 0) {
            out.push({ symbol, expiry, strikes: compact.length, stored: false, reason: 'Chain was unusable — no underlying level, unparseable expiry, or no traded strikes.' });
            continue;
        }

        if (!supabase || !userId) {
            out.push({ symbol, expiry, strikes: compact.length, stored: false, reason: 'Supabase is not configured, so nothing was stored.' });
            continue;
        }

        const { error } = await supabase.from('gth_option_chains').upsert(
            {
                user_id: userId,
                symbol,
                expiry: iso,
                captured,
                underlying: chain.data.underlying,
                quoted_at: chain.data.quotedAt,
                chain: compact,
            },
            { onConflict: 'user_id,symbol,expiry,captured' }
        );

        out.push({ symbol, expiry, strikes: compact.length, stored: !error, reason: error?.message });
    }

    return out;
}

export interface Coverage {
    days: number;
    from: string | null;
    to: string | null;
}

/**
 * How much real history exists, per underlying.
 *
 * Rendered verbatim by the backtest screen. "Snapshots began on X, N trading days
 * available" is the honest form of a limitation that would otherwise show up as an
 * empty chart.
 */
export async function chainCoverage(symbol: OptionRoot): Promise<Coverage> {
    const supabase = getServiceClient();
    const userId = process.env.ADMIN_USER_ID || null;
    if (!supabase || !userId) return { days: 0, from: null, to: null };

    const { data, error } = await supabase
        .from('gth_option_chains')
        .select('captured')
        .eq('user_id', userId)
        .eq('symbol', symbol)
        .order('captured', { ascending: true });

    if (error || !data?.length) return { days: 0, from: null, to: null };

    const days = [...new Set(data.map((r) => r.captured as string))];
    return { days: days.length, from: days[0], to: days[days.length - 1] };
}
