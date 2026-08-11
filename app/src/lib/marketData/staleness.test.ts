import { describe, it, expect } from 'vitest';
import { freshness, ageLabel, staleAfterMs, shouldShowPrice, POLL_INTERVAL_MS } from './staleness';

const utc = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi);

// Freshness now depends on whether the exchange is open, so every fixture has to sit
// inside a real session. India and the US never overlap: NSE is 03:45–10:00 UTC,
// NYSE is 13:30–20:00 UTC in summer.
const OPEN_INDIA = utc(2026, 8, 12, 5, 0);   // Wed 10:30 IST
const OPEN_US = utc(2026, 8, 12, 15, 0);     // Wed 11:00 EDT
const SATURDAY = utc(2026, 8, 15, 5, 0);
const ANY = utc(2026, 8, 12, 5, 0);          // crypto is always open

describe('freshness — no price', () => {
    it('reports none when no price has ever arrived', () => {
        expect(freshness({ ts: null, market: 'crypto', now: ANY })).toBe('none');
        expect(freshness({ ts: undefined, market: 'crypto', now: ANY })).toBe('none');
        expect(freshness({ ts: 0, market: 'crypto', now: ANY })).toBe('none');
    });

    it('reports queued for a deferred symbol rather than stale', () => {
        // A symbol the rotation planner chose not to poll is not broken — the user
        // needs to see the difference between "we skipped it" and "the feed died".
        expect(freshness({ ts: ANY - 10 * 60_000, market: 'crypto', deferred: true, now: ANY })).toBe('queued');
        expect(freshness({ ts: null, market: 'crypto', deferred: true, now: ANY })).toBe('queued');
    });
});

describe('freshness — market closed', () => {
    it('reports closed rather than stale when the exchange is shut', () => {
        // An NSE quote from Friday afternoon is exactly right at 3am on Sunday.
        // Calling it "stale" told the user something was broken when nothing was.
        expect(freshness({ ts: SATURDAY - 40 * 3600_000, market: 'india', now: SATURDAY })).toBe('closed');
    });

    it('reports closed even for a fresh quote outside hours', () => {
        expect(freshness({ ts: SATURDAY, market: 'india', feedState: 'delayed', now: SATURDAY })).toBe('closed');
    });

    it('never reports closed for crypto', () => {
        expect(freshness({ ts: SATURDAY, market: 'crypto', feedState: 'live', now: SATURDAY })).toBe('live');
    });
});

describe('freshness — market open', () => {
    it('reports live for a fresh real-time quote', () => {
        expect(freshness({ ts: ANY - 5_000, market: 'crypto', feedState: 'live', now: ANY })).toBe('live');
    });

    it('reports delayed when the provider is delayed by design', () => {
        expect(freshness({ ts: OPEN_INDIA - 5_000, market: 'india', feedState: 'delayed', now: OPEN_INDIA })).toBe('delayed');
    });

    it('reports stale for a simulated feed however recent the stamp', () => {
        expect(freshness({ ts: OPEN_INDIA, market: 'india', feedState: 'sim', now: OPEN_INDIA })).toBe('stale');
    });

    it('uses a 30s threshold for crypto and three poll cycles elsewhere', () => {
        expect(staleAfterMs('crypto')).toBe(30_000);
        expect(staleAfterMs('india')).toBe(POLL_INTERVAL_MS * 3);

        expect(freshness({ ts: ANY - 29_000, market: 'crypto', feedState: 'live', now: ANY })).toBe('live');
        expect(freshness({ ts: ANY - 31_000, market: 'crypto', feedState: 'live', now: ANY })).toBe('stale');

        expect(freshness({ ts: OPEN_US - 179_000, market: 'us', feedState: 'delayed', now: OPEN_US })).toBe('delayed');
        expect(freshness({ ts: OPEN_US - 181_000, market: 'us', feedState: 'delayed', now: OPEN_US })).toBe('stale');
    });

    it('marks a deferred symbol queued rather than stale while open', () => {
        expect(freshness({ ts: OPEN_US - 600_000, market: 'us', deferred: true, now: OPEN_US })).toBe('queued');
    });

    it('does not treat clock skew as a future price', () => {
        expect(freshness({ ts: ANY + 60_000, market: 'crypto', feedState: 'live', now: ANY })).toBe('live');
    });
});

describe('ageLabel', () => {
    it.each([
        [0, 'just now'],
        [9_000, 'just now'],
        [40_000, '40s ago'],
        [4 * 60_000, '4m ago'],
        [2 * 3_600_000, '2h ago'],
        [3 * 86_400_000, '3d ago'],
    ])('renders an age of %ims as %s', (ageMs, expected) => {
        expect(ageLabel(ANY - ageMs, ANY)).toBe(expected);
    });

    it('renders never for a missing timestamp', () => {
        expect(ageLabel(null, ANY)).toBe('never');
        expect(ageLabel(0, ANY)).toBe('never');
    });
});

describe('shouldShowPrice', () => {
    it('suppresses the price only when nothing has ever arrived', () => {
        expect(shouldShowPrice('none')).toBe(false);
        for (const f of ['live', 'delayed', 'closed', 'stale', 'queued'] as const) {
            expect(shouldShowPrice(f)).toBe(true);
        }
    });
});
