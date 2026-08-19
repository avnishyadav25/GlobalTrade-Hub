import { describe, it, expect } from 'vitest';
import {
    browserIsLive, serverMayAct, leaseHolder, alreadyActed, recordActed,
    LEASE_TTL_MS, HEARTBEAT_MS,
} from './lease';

// The ledger cannot survive two writers, so these are the tests that matter most in the
// automation work: every one of them describes a way the book could be corrupted.

const NOW = Date.UTC(2026, 7, 19, 10, 0, 0);

describe('who holds the lease', () => {
    it('treats a recent heartbeat as a live tab', () => {
        expect(browserIsLive({ browserHeartbeatAt: NOW - 10_000 }, NOW)).toBe(true);
    });

    it('treats a stale heartbeat as a departed tab', () => {
        expect(browserIsLive({ browserHeartbeatAt: NOW - LEASE_TTL_MS - 1 }, NOW)).toBe(false);
    });

    it('heartbeats comfortably faster than the TTL', () => {
        // One missed tick — a throttled background tab — must not hand the lease over
        // while the tab is still trading.
        expect(HEARTBEAT_MS * 2).toBeLessThan(LEASE_TTL_MS);
    });

    it('refuses to treat a far-future heartbeat as live', () => {
        // A skewed clock would otherwise lock the server out forever.
        expect(browserIsLive({ browserHeartbeatAt: NOW + LEASE_TTL_MS * 10 }, NOW)).toBe(false);
    });

    it.each([null, undefined, {}, { browserHeartbeatAt: Number.NaN }, { browserHeartbeatAt: 'soon' as unknown as number }])(
        'treats %p as no tab rather than throwing', (lease) => {
            expect(browserIsLive(lease as never, NOW)).toBe(false);
        });
});

describe('the server only acts alone', () => {
    it('stands down while a tab is live', () => {
        expect(serverMayAct({ browserHeartbeatAt: NOW - 1000 }, NOW)).toBe(false);
    });

    it('acts once the tab is gone', () => {
        expect(serverMayAct({ browserHeartbeatAt: NOW - LEASE_TTL_MS - 1 }, NOW)).toBe(true);
    });

    it('acts when there has never been a tab', () => {
        expect(serverMayAct(null, NOW)).toBe(true);
    });

    it('is mutually exclusive with a live browser, always', () => {
        // The whole safety property in one assertion, over a range of ages.
        for (const age of [0, 1_000, 44_000, LEASE_TTL_MS - 1, LEASE_TTL_MS, LEASE_TTL_MS + 1, 10 * LEASE_TTL_MS]) {
            const lease = { browserHeartbeatAt: NOW - age };
            expect(browserIsLive(lease, NOW) && serverMayAct(lease, NOW)).toBe(false);
        }
    });
});

describe('reporting the holder', () => {
    it('reports the browser when it is beating', () => {
        expect(leaseHolder({ browserHeartbeatAt: NOW - 5_000 }, NOW)).toBe('browser');
    });

    it('reports the server only after it has actually run', () => {
        // Never inferred from a setting being switched on: a scheduler on a sleeping
        // laptop is not running, and saying otherwise is the failure mode this codebase
        // cares most about.
        expect(leaseHolder({ serverRanAt: NOW - 5_000 }, NOW)).toBe('server');
        expect(leaseHolder({}, NOW)).toBe('idle');
        expect(leaseHolder({ serverRanAt: NOW - LEASE_TTL_MS - 1 }, NOW)).toBe('idle');
    });

    it('prefers the browser when both are recent', () => {
        expect(leaseHolder({ browserHeartbeatAt: NOW - 1000, serverRanAt: NOW - 1000 }, NOW)).toBe('browser');
    });
});

describe('handover cannot duplicate an order', () => {
    // Signal ids are deterministic, so a runner taking over derives the SAME id for the
    // same bar. Runtime memory is never persisted, so without this the new runner starts
    // blank and re-places an order the previous one already made.
    const id = 'ma-crossover:BTC/USDT:1755590400:enter-buy';

    it('recognises an id the other runner already acted on', () => {
        expect(alreadyActed([id], id)).toBe(true);
        expect(alreadyActed([], id)).toBe(false);
        expect(alreadyActed(undefined, id)).toBe(false);
    });

    it('records without duplicating', () => {
        expect(recordActed([id], id)).toEqual([id]);
        expect(recordActed([], id)).toEqual([id]);
    });

    it('keeps the list bounded so it cannot grow without limit', () => {
        let acc: string[] = [];
        for (let i = 0; i < 500; i++) acc = recordActed(acc, `sig-${i}`, 200);
        expect(acc).toHaveLength(200);
        expect(acc.at(-1)).toBe('sig-499');
        // ...and the oldest are the ones dropped.
        expect(acc.includes('sig-0')).toBe(false);
    });

    it('survives a malformed list from an untrusted server row', () => {
        expect(() => recordActed([1, null] as unknown as string[], id)).not.toThrow();
        expect(recordActed([1, null] as unknown as string[], id)).toEqual([id]);
    });
});
