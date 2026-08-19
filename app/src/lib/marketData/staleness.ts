import type { Market } from '@/lib/constants';
import { isOpen } from '@/lib/sessions';

// How old is this price, really?
//
// Until now the app could not answer that. `ProviderQuote` carried no timestamp and
// `marketStore.applyQuote` fell back to `ts: Date.now()`, so a price served from cache
// because the token bucket was empty — which the cache does deliberately — arrived
// stamped with the current time. Combined with rotation (see priority.ts), where a
// low-priority symbol may legitimately be a few minutes old, that would have meant
// showing minutes-old numbers as if they were live.

export type Freshness =
    /** Real-time feed, recently updated. */
    | 'live'
    /** Provider is delayed by design (Yahoo equities ~15 min), but the fetch is recent. */
    | 'delayed'
    /** The exchange is shut. An old price is correct, not a fault. */
    | 'closed'
    /** Older than we expect — the poll has not reached it or upstream is failing. */
    | 'stale'
    /** Deliberately not polled this cycle by the rotation planner. */
    | 'queued'
    /** No price has ever arrived. */
    | 'none';

export type FeedState = 'live' | 'delayed' | 'sim';

/** The client's market-data poll interval. */
export const POLL_INTERVAL_MS = 60_000;

/**
 * Age past which a quote is stale, per market.
 * Crypto streams over a WebSocket, so a 30s gap already means something is wrong.
 * Everything else is polled, so allow three cycles before crying wolf.
 */
export function staleAfterMs(market: Market, pollIntervalMs = POLL_INTERVAL_MS): number {
    return market === 'crypto' ? 30_000 : pollIntervalMs * 3;
}

export interface FreshnessInput {
    /** Quote timestamp — the UPSTREAM fetch time, not when it was served. */
    ts?: number | null;
    market: Market;
    /** Provenance reported by the router for this market. */
    feedState?: FeedState;
    /** True when the rotation planner deferred this symbol. */
    deferred?: boolean;
    now?: number;
    pollIntervalMs?: number;
}

export function freshness(input: FreshnessInput): Freshness {
    const { ts, market, feedState, deferred } = input;
    const now = input.now ?? Date.now();

    if (ts == null || !Number.isFinite(ts) || ts <= 0) return deferred ? 'queued' : 'none';

    // A clock skew between server and browser must not read as "from the future".
    const age = Math.max(0, now - ts);
    const stale = age > staleAfterMs(market, input.pollIntervalMs);

    // A shut exchange is the single most common reason a price stops moving. Calling
    // that "stale" told the user something was broken when nothing was — an NSE quote
    // from Friday afternoon is exactly right at 3am on Sunday.
    if (!isOpen(market, now)) return 'closed';

    if (stale) return deferred ? 'queued' : 'stale';
    if (feedState === 'sim') return 'stale';
    if (feedState === 'delayed') return 'delayed';
    return 'live';
}

/** Compact human age: "just now", "40s ago", "4m ago", "2h ago". */
export function ageLabel(ts: number | null | undefined, now = Date.now()): string {
    if (ts == null || !Number.isFinite(ts) || ts <= 0) return 'never';
    const secs = Math.max(0, Math.round((now - ts) / 1000));
    if (secs < 10) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}

/** Whether a price should be rendered at all, or replaced with an em-dash. */
export function shouldShowPrice(f: Freshness): boolean {
    return f !== 'none';
}
