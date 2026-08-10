import 'server-only';

// Shared upstream-request discipline for every market-data provider.
//
// Four separate concerns, all of which the previous inline fetchers lacked:
//   TTL cache        — repeat requests inside the window reuse the response
//   single-flight    — three browser tabs asking at once make ONE upstream call
//   token bucket     — hard per-provider rate limit, so a free tier can't be blown
//   circuit breaker  — after repeated failures, stop calling for a cool-off period
//                      and let the router fall through to the next provider
//
// The 15s poll in MarketEngine was making 5,760 requests/day against an 800/day
// free tier, and only backed off when the provider was *unconfigured* — never on
// a 429. This module is what makes that impossible to repeat.

interface Entry {
    at: number;
    value: unknown;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 500;

export interface RateLimit {
    /** Requests allowed per minute. */
    perMinute: number;
    /** Requests allowed per day; omit for effectively unlimited. */
    perDay?: number;
}

interface Bucket {
    minuteStart: number;
    minuteCount: number;
    dayStart: number;
    dayCount: number;
    /** Timestamp until which the circuit is open (no calls allowed). */
    openUntil: number;
    failures: number;
}

const buckets = new Map<string, Bucket>();
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLOFF_MS = 5 * 60_000;

function bucketFor(provider: string): Bucket {
    let b = buckets.get(provider);
    const now = Date.now();
    if (!b) {
        b = { minuteStart: now, minuteCount: 0, dayStart: now, dayCount: 0, openUntil: 0, failures: 0 };
        buckets.set(provider, b);
    }
    if (now - b.minuteStart >= 60_000) {
        b.minuteStart = now;
        b.minuteCount = 0;
    }
    if (now - b.dayStart >= 86_400_000) {
        b.dayStart = now;
        b.dayCount = 0;
    }
    return b;
}

/** True when the provider may be called right now. */
export function canCall(provider: string, limit: RateLimit): boolean {
    const b = bucketFor(provider);
    if (Date.now() < b.openUntil) return false;
    if (b.minuteCount >= limit.perMinute) return false;
    if (limit.perDay != null && b.dayCount >= limit.perDay) return false;
    return true;
}

function noteCall(provider: string) {
    const b = bucketFor(provider);
    b.minuteCount++;
    b.dayCount++;
}

export function noteSuccess(provider: string) {
    const b = bucketFor(provider);
    b.failures = 0;
    b.openUntil = 0;
}

export function noteFailure(provider: string) {
    const b = bucketFor(provider);
    b.failures++;
    if (b.failures >= CIRCUIT_THRESHOLD) {
        b.openUntil = Date.now() + CIRCUIT_COOLOFF_MS;
        b.failures = 0;
        console.warn(`[marketdata] circuit opened for ${provider} — pausing ${CIRCUIT_COOLOFF_MS / 60000} min`);
    }
}

/** Diagnostics for the status endpoint. */
export function providerUsage(provider: string) {
    const b = bucketFor(provider);
    return {
        minuteCount: b.minuteCount,
        dayCount: b.dayCount,
        circuitOpen: Date.now() < b.openUntil,
        openUntil: b.openUntil || null,
    };
}

export interface FetchOptions {
    provider: string;
    key: string;
    ttlMs: number;
    limit: RateLimit;
}

/**
 * Cached, single-flighted, rate-limited, circuit-broken fetch.
 * Returns null when the call is not permitted or the fetcher fails — callers are
 * expected to fall through to the next provider rather than surface an error.
 */
export async function cachedFetch<T>(opts: FetchOptions, fetcher: () => Promise<T | null>): Promise<T | null> {
    const { provider, key, ttlMs, limit } = opts;
    const full = `${provider}:${key}`;

    const hit = cache.get(full);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

    const pending = inflight.get(full);
    if (pending) return (await pending) as T | null;

    if (!canCall(provider, limit)) {
        // Serve stale rather than nothing — a slightly old price beats a gap.
        return hit ? (hit.value as T) : null;
    }

    const p = (async () => {
        noteCall(provider);
        try {
            const value = await fetcher();
            if (value == null) {
                noteFailure(provider);
                return null;
            }
            noteSuccess(provider);
            if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
            cache.set(full, { at: Date.now(), value });
            return value;
        } catch (e) {
            noteFailure(provider);
            console.warn(`[marketdata] ${provider} failed:`, e instanceof Error ? e.message : e);
            return null;
        } finally {
            inflight.delete(full);
        }
    })();

    inflight.set(full, p as Promise<unknown>);
    return (await p) as T | null;
}
