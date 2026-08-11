import type { Market } from './constants';

// Market hours: when each market is actually open.
//
// There was no session model at all before this. The only per-market time constant in
// the codebase was SESSION_SECONDS in the candles route, used solely to scale synthetic
// volatility — it encodes session LENGTHS and never open/close times. That meant:
//   * a closed NSE looked "stale" rather than "closed"
//   * an opening-range strategy had no way to know which bar was the first of the day
//   * "square off intraday positions before 15:15 IST" was inexpressible
//
// Timezones come from the runtime's IANA database via Intl, so DST is handled for us
// and there is no dependency to add or keep updated.

export interface SessionSpec {
    tz: string;
    /** Minutes from local midnight. */
    openMin: number;
    closeMin: number;
    /** 0 = Sunday. */
    days: number[];
    label: string;
}

const MIN = (h: number, m = 0) => h * 60 + m;

export const SESSIONS: Record<Market, SessionSpec | null> = {
    // 09:15–15:30 IST, Monday to Friday. India does not observe DST.
    india: { tz: 'Asia/Kolkata', openMin: MIN(9, 15), closeMin: MIN(15, 30), days: [1, 2, 3, 4, 5], label: 'NSE/BSE' },
    // 09:30–16:00 ET regular session. Pre/post market are deliberately excluded —
    // the quote feed here does not cover them.
    us: { tz: 'America/New_York', openMin: MIN(9, 30), closeMin: MIN(16, 0), days: [1, 2, 3, 4, 5], label: 'NYSE/NASDAQ' },
    // Continuous. Handled specially below.
    crypto: null,
    forex: null,
    commodity: null,
};

/** Local wall-clock offset from UTC, in ms, at a given instant. */
function tzOffsetMs(tz: string, at: number): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date(at));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - Math.floor(at / 1000) * 1000;
}

interface LocalTime {
    /** Local date as YYYY-MM-DD. */
    date: string;
    /** Minutes since local midnight. */
    minutes: number;
    /** 0 = Sunday. */
    weekday: number;
    /** Epoch ms of local midnight. */
    midnight: number;
    offset: number;
}

function localTime(tz: string, at: number): LocalTime {
    const offset = tzOffsetMs(tz, at);
    const shifted = at + offset;
    const d = new Date(shifted);
    const midnight = Math.floor(shifted / 86_400_000) * 86_400_000 - offset;
    return {
        date: d.toISOString().slice(0, 10),
        minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
        weekday: d.getUTCDay(),
        midnight,
        offset,
    };
}

/* ------------------------------------------------------------------ holidays */

/**
 * FIXED-DATE holidays only, and deliberately incomplete.
 *
 * India's exchange holidays are mostly LUNAR — Diwali, Holi, Eid, Good Friday move
 * every year — and publishing a guessed list would be worse than publishing none: a
 * wrong holiday silently suppresses a whole trading day from a backtest.
 *
 * So this covers only dates that genuinely never move, and `deriveHolidays()` below is
 * the authoritative path: a weekday with no daily bar in real market data WAS a
 * holiday, whatever the reason. Callers that need certainty should use that.
 */
export const FIXED_HOLIDAYS: Record<string, string[]> = {
    india: [
        '01-26', // Republic Day
        '08-15', // Independence Day
        '10-02', // Gandhi Jayanti
    ],
    us: [
        '01-01', // New Year's Day
        '07-04', // Independence Day
        '12-25', // Christmas Day
    ],
};

/** True for the fixed-date holidays we are certain about. NOT a complete calendar. */
export function isFixedHoliday(market: Market, at: number): boolean {
    const spec = SESSIONS[market];
    if (!spec) return false;
    const list = FIXED_HOLIDAYS[market];
    if (!list) return false;
    return list.includes(localTime(spec.tz, at).date.slice(5));
}

/**
 * Infer the real holiday calendar from daily bars: any weekday between the first and
 * last bar with no bar of its own was a non-trading day. This is self-maintaining and
 * cannot be wrong about a lunar holiday, because it is derived from what actually traded.
 */
export function deriveHolidays(barTimesSec: number[], market: Market): string[] {
    const spec = SESSIONS[market];
    if (!spec || barTimesSec.length < 2) return [];

    const traded = new Set(barTimesSec.map((t) => localTime(spec.tz, t * 1000).date));
    const sorted = [...barTimesSec].sort((a, b) => a - b);
    const out: string[] = [];

    for (let t = sorted[0] * 1000; t <= sorted[sorted.length - 1] * 1000; t += 86_400_000) {
        const lt = localTime(spec.tz, t);
        if (!spec.days.includes(lt.weekday)) continue;
        if (!traded.has(lt.date)) out.push(lt.date);
    }
    return [...new Set(out)];
}

/* ------------------------------------------------------------------ sessions */

export interface SessionInfo {
    open: boolean;
    /** Epoch ms of the current or most recent session's open/close. Null when continuous. */
    openAt: number | null;
    closeAt: number | null;
    minutesSinceOpen: number | null;
    minutesToClose: number | null;
    /** Why it is shut, when it is. */
    reason?: 'weekend' | 'holiday' | 'before-open' | 'after-close' | 'maintenance';
    label: string;
}

const ET = 'America/New_York';

/** Forex: Sunday 17:00 ET through Friday 17:00 ET. */
function forexInfo(at: number): SessionInfo {
    const lt = localTime(ET, at);
    const closeMin = MIN(17);
    const shut =
        lt.weekday === 6 ||
        (lt.weekday === 5 && lt.minutes >= closeMin) ||
        (lt.weekday === 0 && lt.minutes < closeMin);
    return {
        open: !shut,
        openAt: null,
        closeAt: null,
        minutesSinceOpen: null,
        minutesToClose: null,
        reason: shut ? 'weekend' : undefined,
        label: 'FX (24/5)',
    };
}

/** CME Globex: Sunday 18:00 ET through Friday 17:00 ET, with a daily 17:00–18:00 break. */
function commodityInfo(at: number): SessionInfo {
    const lt = localTime(ET, at);
    const breakStart = MIN(17);
    const breakEnd = MIN(18);
    const weekendShut =
        lt.weekday === 6 ||
        (lt.weekday === 5 && lt.minutes >= breakStart) ||
        (lt.weekday === 0 && lt.minutes < breakEnd);
    const inBreak = lt.minutes >= breakStart && lt.minutes < breakEnd;
    const shut = weekendShut || inBreak;
    return {
        open: !shut,
        openAt: null,
        closeAt: null,
        minutesSinceOpen: null,
        minutesToClose: null,
        reason: weekendShut ? 'weekend' : inBreak ? 'maintenance' : undefined,
        label: 'CME Globex',
    };
}

export function sessionInfo(market: Market, at: number = Date.now()): SessionInfo {
    if (market === 'crypto') {
        return { open: true, openAt: null, closeAt: null, minutesSinceOpen: null, minutesToClose: null, label: '24/7' };
    }
    if (market === 'forex') return forexInfo(at);
    if (market === 'commodity') return commodityInfo(at);

    const spec = SESSIONS[market];
    if (!spec) {
        return { open: true, openAt: null, closeAt: null, minutesSinceOpen: null, minutesToClose: null, label: market };
    }

    const lt = localTime(spec.tz, at);
    const openAt = lt.midnight + spec.openMin * 60_000;
    const closeAt = lt.midnight + spec.closeMin * 60_000;
    const base = { openAt, closeAt, label: spec.label };

    if (!spec.days.includes(lt.weekday)) {
        return { ...base, open: false, minutesSinceOpen: null, minutesToClose: null, reason: 'weekend' };
    }
    if (isFixedHoliday(market, at)) {
        return { ...base, open: false, minutesSinceOpen: null, minutesToClose: null, reason: 'holiday' };
    }
    if (lt.minutes < spec.openMin) {
        return { ...base, open: false, minutesSinceOpen: null, minutesToClose: null, reason: 'before-open' };
    }
    if (lt.minutes >= spec.closeMin) {
        return { ...base, open: false, minutesSinceOpen: null, minutesToClose: null, reason: 'after-close' };
    }
    return {
        ...base,
        open: true,
        minutesSinceOpen: lt.minutes - spec.openMin,
        minutesToClose: spec.closeMin - lt.minutes,
    };
}

export function isOpen(market: Market, at: number = Date.now()): boolean {
    return sessionInfo(market, at).open;
}

/** Minutes until the close, or null when the market is shut or trades continuously. */
export function minutesToClose(market: Market, at: number = Date.now()): number | null {
    return sessionInfo(market, at).minutesToClose;
}

/**
 * Which bar of the session this instant falls in, zero-indexed.
 * Bar 0 is the opening bar — an opening-range strategy watches bars 0..n-1 and may
 * only act from bar n onward. Null when the market is shut or trades continuously.
 */
export function barsSinceOpen(market: Market, at: number, barSeconds: number): number | null {
    const info = sessionInfo(market, at);
    if (!info.open || info.minutesSinceOpen == null || barSeconds <= 0) return null;
    return Math.floor((info.minutesSinceOpen * 60) / barSeconds);
}

/** The first bar index of each session in a series — the anchors intraday VWAP resets on. */
export function sessionStartIndices(market: Market, barTimesSec: number[]): number[] {
    const spec = SESSIONS[market];
    if (!spec || !barTimesSec.length) return [];
    const out: number[] = [];
    let previous: string | null = null;
    for (let i = 0; i < barTimesSec.length; i++) {
        const date = localTime(spec.tz, barTimesSec[i] * 1000).date;
        if (date !== previous) {
            out.push(i);
            previous = date;
        }
    }
    return out;
}

/**
 * Should an intraday position be squared off by now?
 * Indian brokers auto-square-off MIS positions near the close and charge for doing it,
 * so a strategy must flatten first.
 */
export function shouldSquareOff(market: Market, at: number = Date.now(), bufferMinutes = 15): boolean {
    const info = sessionInfo(market, at);
    if (info.minutesToClose == null) return false;
    return info.minutesToClose <= bufferMinutes;
}
