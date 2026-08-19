import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cachedFetch, cachedFetchWithMeta, canCall, noteFailure, noteSuccess, providerUsage } from './cache';

// The rate buckets and the response cache are module-global by design (they must be
// shared across requests in one process). Rather than exporting a test-only reset,
// every test uses its own provider id so nothing leaks between them.
let n = 0;
const uniq = (label: string) => `${label}-${++n}`;

const LIMIT = { perMinute: 3 };
const START = 1_800_000_000_000;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('token bucket', () => {
    it('refuses calls once the per-minute allowance is spent, and refills after a minute', async () => {
        const provider = uniq('bucket');
        const fetcher = vi.fn(async () => 'ok');

        for (let i = 0; i < 3; i++) {
            await cachedFetch({ provider, key: `k${i}`, ttlMs: 0, limit: LIMIT }, fetcher);
        }
        expect(canCall(provider, LIMIT)).toBe(false);
        expect(providerUsage(provider).minuteCount).toBe(3);

        vi.setSystemTime(START + 60_001);
        expect(canCall(provider, LIMIT)).toBe(true);
        expect(providerUsage(provider).minuteCount).toBe(0);
    });

    it('enforces a daily allowance independently of the minute window', async () => {
        const provider = uniq('daily');
        const limit = { perMinute: 100, perDay: 2 };
        const fetcher = vi.fn(async () => 'ok');

        await cachedFetch({ provider, key: 'a', ttlMs: 0, limit }, fetcher);
        await cachedFetch({ provider, key: 'b', ttlMs: 0, limit }, fetcher);
        expect(canCall(provider, limit)).toBe(false);

        vi.setSystemTime(START + 60_001);
        expect(canCall(provider, limit)).toBe(false); // minute rolled, day did not

        vi.setSystemTime(START + 86_400_001);
        expect(canCall(provider, limit)).toBe(true);
    });
});

describe('circuit breaker', () => {
    it('opens after three consecutive failures and closes after the cool-off', () => {
        const provider = uniq('circuit');
        noteFailure(provider);
        noteFailure(provider);
        expect(canCall(provider, LIMIT)).toBe(true);

        noteFailure(provider);
        expect(canCall(provider, LIMIT)).toBe(false);
        expect(providerUsage(provider).circuitOpen).toBe(true);

        vi.setSystemTime(START + 5 * 60_000 + 1);
        expect(canCall(provider, LIMIT)).toBe(true);
        expect(providerUsage(provider).circuitOpen).toBe(false);
    });

    it('resets the failure count on a success, so intermittent errors never trip it', () => {
        const provider = uniq('intermittent');
        noteFailure(provider);
        noteFailure(provider);
        noteSuccess(provider);
        noteFailure(provider);
        noteFailure(provider);
        expect(canCall(provider, LIMIT)).toBe(true);
    });
});

describe('cachedFetch', () => {
    it('serves a cached value inside the TTL without calling upstream', async () => {
        const provider = uniq('ttl');
        const fetcher = vi.fn(async () => 'first');

        expect(await cachedFetch({ provider, key: 'k', ttlMs: 60_000, limit: LIMIT }, fetcher)).toBe('first');
        vi.setSystemTime(START + 30_000);
        expect(await cachedFetch({ provider, key: 'k', ttlMs: 60_000, limit: LIMIT }, fetcher)).toBe('first');
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('single-flights concurrent requests for the same key', async () => {
        const provider = uniq('inflight');
        let resolve!: (v: string) => void;
        const fetcher = vi.fn(() => new Promise<string>((r) => (resolve = r)));

        const a = cachedFetch({ provider, key: 'k', ttlMs: 60_000, limit: LIMIT }, fetcher);
        const b = cachedFetch({ provider, key: 'k', ttlMs: 60_000, limit: LIMIT }, fetcher);
        resolve('shared');

        expect(await a).toBe('shared');
        expect(await b).toBe('shared');
        expect(fetcher).toHaveBeenCalledTimes(1);
        // Three tabs asking at once must cost one upstream call, not three.
        expect(providerUsage(provider).minuteCount).toBe(1);
    });

    it('serves stale rather than nothing when the bucket is empty, WITHOUT calling the fetcher', async () => {
        const provider = uniq('stale');
        const limit = { perMinute: 1 };
        const fetcher = vi.fn(async () => 'cached');

        expect(await cachedFetch({ provider, key: 'k', ttlMs: 1_000, limit }, fetcher)).toBe('cached');
        expect(canCall(provider, limit)).toBe(false);

        // Past the TTL, so this is not a cache hit — it is a deliberate stale serve.
        vi.setSystemTime(START + 10_000);
        expect(await cachedFetch({ provider, key: 'k', ttlMs: 1_000, limit }, fetcher)).toBe('cached');
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('returns null when the bucket is empty and nothing was ever cached', async () => {
        const provider = uniq('empty');
        const limit = { perMinute: 1 };
        await cachedFetch({ provider, key: 'a', ttlMs: 0, limit }, async () => 'x');

        const fetcher = vi.fn(async () => 'y');
        expect(await cachedFetch({ provider, key: 'b', ttlMs: 0, limit }, fetcher)).toBeNull();
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('counts a null result as a failure and does not cache it', async () => {
        const provider = uniq('nullres');
        const fetcher = vi.fn(async () => null);

        expect(await cachedFetch({ provider, key: 'k', ttlMs: 60_000, limit: LIMIT }, fetcher)).toBeNull();
        expect(await cachedFetch({ provider, key: 'k', ttlMs: 60_000, limit: LIMIT }, fetcher)).toBeNull();
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('swallows a throwing fetcher and reports it as a failure', async () => {
        const provider = uniq('throws');
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const fetcher = vi.fn(async () => {
            throw new Error('upstream exploded');
        });

        expect(await cachedFetch({ provider, key: 'k', ttlMs: 0, limit: LIMIT }, fetcher)).toBeNull();
        // A second attempt proves the in-flight entry was cleared in `finally`.
        expect(await cachedFetch({ provider, key: 'k', ttlMs: 0, limit: LIMIT }, fetcher)).toBeNull();
        expect(fetcher).toHaveBeenCalledTimes(2);
    });
});

describe('cachedFetchWithMeta', () => {
    it('reports the upstream fetch time, not the serve time', async () => {
        const provider = uniq('meta');
        // A daily cap, so the bucket stays empty across the minute boundary and the
        // stale-serve path is still the one under test ten minutes later.
        const limit = { perMinute: 5, perDay: 1 };

        const fresh = await cachedFetchWithMeta({ provider, key: 'k', ttlMs: 1_000, limit }, async () => 'v');
        expect(fresh).toEqual({ value: 'v', at: START, fromCache: false });

        // Served stale 10 minutes later: `at` must still say when it was really fetched,
        // otherwise the UI stamps a ten-minute-old price as current.
        vi.setSystemTime(START + 600_000);
        const stale = await cachedFetchWithMeta({ provider, key: 'k', ttlMs: 1_000, limit }, async () => 'v2');
        expect(stale).toEqual({ value: 'v', at: START, fromCache: true });
    });

    it('marks a within-TTL hit as fromCache', async () => {
        const provider = uniq('metahit');
        await cachedFetchWithMeta({ provider, key: 'k', ttlMs: 60_000, limit: LIMIT }, async () => 'v');
        vi.setSystemTime(START + 1_000);
        const hit = await cachedFetchWithMeta({ provider, key: 'k', ttlMs: 60_000, limit: LIMIT }, async () => 'v2');
        expect(hit).toEqual({ value: 'v', at: START, fromCache: true });
    });

    it('returns null rather than a meta wrapper when the fetch fails', async () => {
        const provider = uniq('metanull');
        expect(await cachedFetchWithMeta({ provider, key: 'k', ttlMs: 0, limit: LIMIT }, async () => null)).toBeNull();
    });
});
