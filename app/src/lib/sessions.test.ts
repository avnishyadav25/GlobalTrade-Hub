import { describe, it, expect } from 'vitest';
import {
    isOpen, sessionInfo, minutesToClose, barsSinceOpen,
    sessionStartIndices, shouldSquareOff, deriveHolidays, isFixedHoliday,
} from './sessions';

/** UTC instant helper. All fixtures are expressed in UTC and converted by the module. */
const utc = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi);

// Reference weekdays used below, asserted rather than assumed:
//   2026-08-11 Tue · 2026-08-12 Wed · 2026-08-14 Fri · 2026-08-15 Sat · 2026-08-17 Mon
describe('fixture sanity', () => {
    it.each([
        [utc(2026, 8, 11), 2],
        [utc(2026, 8, 12), 3],
        [utc(2026, 8, 14), 5],
        [utc(2026, 8, 15), 6],
        [utc(2026, 8, 17), 1],
        [utc(2026, 1, 26), 1], // Republic Day 2026 is a Monday
    ])('weekday of %i is %i', (at, weekday) => {
        expect(new Date(at).getUTCDay()).toBe(weekday);
    });
});

describe('NSE (Asia/Kolkata, 09:15–15:30, no DST)', () => {
    it('is open mid-session on a weekday', () => {
        expect(isOpen('india', utc(2026, 8, 12, 4, 30))).toBe(true); // 10:00 IST
    });

    it('is shut before the open and after the close', () => {
        expect(sessionInfo('india', utc(2026, 8, 12, 3, 30))).toMatchObject({ open: false, reason: 'before-open' }); // 09:00
        expect(sessionInfo('india', utc(2026, 8, 12, 10, 30))).toMatchObject({ open: false, reason: 'after-close' }); // 16:00
    });

    it('opens exactly at 09:15 and closes exactly at 15:30 IST', () => {
        expect(isOpen('india', utc(2026, 8, 12, 3, 45))).toBe(true);  // 09:15:00
        expect(isOpen('india', utc(2026, 8, 12, 3, 44))).toBe(false); // 09:14
        expect(isOpen('india', utc(2026, 8, 12, 9, 59))).toBe(true);  // 15:29
        expect(isOpen('india', utc(2026, 8, 12, 10, 0))).toBe(false); // 15:30 — closed
    });

    it('is shut at the weekend', () => {
        expect(sessionInfo('india', utc(2026, 8, 15, 5, 0))).toMatchObject({ open: false, reason: 'weekend' });
    });

    it('is shut on a fixed-date holiday', () => {
        // Republic Day, a Monday in 2026 — so the weekend rule cannot mask this.
        expect(isFixedHoliday('india', utc(2026, 1, 26, 5, 0))).toBe(true);
        expect(sessionInfo('india', utc(2026, 1, 26, 5, 0))).toMatchObject({ open: false, reason: 'holiday' });
    });

    it('is unaffected by the US DST switch, because India has no DST', () => {
        // Same IST wall-clock time either side of the US change — both must be open.
        expect(isOpen('india', utc(2026, 1, 14, 4, 30))).toBe(true); // 10:00 IST in Jan
        expect(isOpen('india', utc(2026, 7, 15, 4, 30))).toBe(true); // 10:00 IST in Jul
    });

    it('counts down to the close', () => {
        expect(minutesToClose('india', utc(2026, 8, 12, 9, 30))).toBe(30); // 15:00 IST
    });
});

describe('NYSE (America/New_York, 09:30–16:00, observes DST)', () => {
    it('handles DST: 14:00 UTC is inside the session in July but not in January', () => {
        // July = EDT (UTC-4) → 10:00 ET, open.
        expect(isOpen('us', utc(2026, 7, 15, 14, 0))).toBe(true);
        // January = EST (UTC-5) → 09:00 ET, before the open.
        expect(sessionInfo('us', utc(2026, 1, 15, 14, 0))).toMatchObject({ open: false, reason: 'before-open' });
        // And 14:30 UTC in January IS 09:30 ET, the open.
        expect(isOpen('us', utc(2026, 1, 15, 14, 30))).toBe(true);
    });

    it('is shut at the weekend', () => {
        expect(sessionInfo('us', utc(2026, 8, 15, 15, 0))).toMatchObject({ open: false, reason: 'weekend' });
    });
});

describe('continuous markets', () => {
    it('crypto is always open', () => {
        for (const at of [utc(2026, 8, 15, 3, 0), utc(2026, 8, 12, 22, 0), utc(2026, 1, 1)]) {
            expect(isOpen('crypto', at)).toBe(true);
        }
        expect(minutesToClose('crypto', utc(2026, 8, 12))).toBeNull();
    });

    it('forex runs Sunday 17:00 ET to Friday 17:00 ET', () => {
        expect(isOpen('forex', utc(2026, 8, 15, 12, 0))).toBe(false);      // Saturday
        expect(isOpen('forex', utc(2026, 8, 14, 22, 0))).toBe(false);      // Fri 18:00 ET
        expect(isOpen('forex', utc(2026, 8, 14, 20, 0))).toBe(true);       // Fri 16:00 ET
        expect(isOpen('forex', utc(2026, 8, 17, 12, 0))).toBe(true);       // Mon 08:00 ET
    });

    it('commodities shut for the daily Globex maintenance break', () => {
        expect(sessionInfo('commodity', utc(2026, 8, 12, 21, 30))).toMatchObject({ open: false, reason: 'maintenance' }); // 17:30 ET
        expect(isOpen('commodity', utc(2026, 8, 12, 22, 30))).toBe(true);  // 18:30 ET
        expect(isOpen('commodity', utc(2026, 8, 12, 20, 30))).toBe(true);  // 16:30 ET
    });
});

describe('barsSinceOpen', () => {
    it('numbers the opening bar zero', () => {
        expect(barsSinceOpen('india', utc(2026, 8, 12, 3, 45), 900)).toBe(0);  // 09:15 IST
        expect(barsSinceOpen('india', utc(2026, 8, 12, 3, 59), 900)).toBe(0);  // 09:29 — still bar 0
        expect(barsSinceOpen('india', utc(2026, 8, 12, 4, 0), 900)).toBe(1);   // 09:30 — bar 1
    });

    it('is null when the market is shut', () => {
        expect(barsSinceOpen('india', utc(2026, 8, 15, 5, 0), 900)).toBeNull();
        expect(barsSinceOpen('crypto', utc(2026, 8, 12, 5, 0), 900)).toBeNull();
    });
});

describe('shouldSquareOff', () => {
    it('fires inside the buffer before the close and not before it', () => {
        // Indian brokers auto-square-off MIS positions near the close and charge for it.
        expect(shouldSquareOff('india', utc(2026, 8, 12, 9, 46))).toBe(true);  // 15:16 IST, 14 min left
        expect(shouldSquareOff('india', utc(2026, 8, 12, 9, 30))).toBe(false); // 15:00 IST, 30 min left
    });

    it('never fires for a continuous market', () => {
        expect(shouldSquareOff('crypto', utc(2026, 8, 12, 5, 0))).toBe(false);
    });
});

describe('sessionStartIndices', () => {
    it('marks the first bar of each local trading day', () => {
        const s = (y: number, mo: number, d: number, h: number, mi: number) => utc(y, mo, d, h, mi) / 1000;
        const times = [
            s(2026, 8, 12, 3, 45),  // day 1, 09:15 IST
            s(2026, 8, 12, 4, 0),
            s(2026, 8, 12, 9, 45),
            s(2026, 8, 13, 3, 45),  // day 2
            s(2026, 8, 13, 4, 0),
        ];
        expect(sessionStartIndices('india', times)).toEqual([0, 3]);
    });

    it('returns nothing for a continuous market', () => {
        expect(sessionStartIndices('crypto', [1, 2, 3])).toEqual([]);
    });
});

describe('deriveHolidays', () => {
    it('finds a weekday with no bar, whatever the reason for the closure', () => {
        // This is the authoritative path: lunar holidays like Diwali move every year and
        // a guessed static list would silently drop a real trading day from a backtest.
        const day = (d: number) => utc(2026, 8, d, 5, 0) / 1000;   // 10:30 IST each day
        const times = [day(10), day(11), /* 12 missing */ day(13), day(14), day(17)];
        expect(deriveHolidays(times, 'india')).toEqual(['2026-08-12']);
    });

    it('does not report weekends as holidays', () => {
        const day = (d: number) => utc(2026, 8, d, 5, 0) / 1000;
        const times = [day(13), day(14), day(17)];  // Thu, Fri, Mon — 15/16 are the weekend
        expect(deriveHolidays(times, 'india')).toEqual([]);
    });

    it('returns nothing for a continuous market or too little data', () => {
        expect(deriveHolidays([1, 2, 3], 'crypto')).toEqual([]);
        expect(deriveHolidays([1], 'india')).toEqual([]);
    });
});
