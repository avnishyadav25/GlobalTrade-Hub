import { HOLD, num, type Action, type Strategy, type StrategyContext } from '../types';
import { DIRECTION, SIZE_PCT, allows, equityPct } from './common';

// Session strategies: rules that only mean anything relative to the trading day.
//
// Both of these need the market-hours model. Before it existed the app had no concept
// of an open, a close, or which bar of the day it was looking at, so "the first fifteen
// minutes" was inexpressible.

/** UTC hour of the current bar. Used where a market has no exchange session. */
function utcHour(ctx: StrategyContext): number | null {
    const t = ctx.bar(0)?.time;
    return t == null ? null : new Date(t * 1000).getUTCHours();
}

export const openingRangeBreakout: Strategy = {
    id: 'opening-range-breakout',
    name: 'Opening range breakout',
    family: 'session',
    markets: ['india', 'us'],
    shape: 'single',
    params: [
        { key: 'rangeBars', label: 'Opening range', help: 'Bars after the open used to establish the range. On 15-minute bars, 1 bar is the first 15 minutes.', type: 'int', min: 1, max: 12, default: 1 },
        { key: 'bufferPct', label: 'Breakout buffer', help: 'Require the break to exceed the range by this percent, to filter out a one-tick poke through the level.', type: 'pct', min: 0, max: 2, step: 0.05, default: 0.1 },
        { key: 'stopMode', label: 'Stop', help: 'Opposite side of the opening range, or a fixed percentage.', type: 'choice', choices: [{ value: 'range', label: 'Other side of the range' }, { value: 'pct', label: 'Fixed percent' }], default: 'range' },
        { key: 'stopPct', label: 'Stop percent', help: 'Used only when the stop mode is a fixed percentage.', type: 'pct', min: 0.1, max: 10, step: 0.1, default: 1 },
        { key: 'exitBuffer', label: 'Square off before close', help: 'Minutes before the close to flatten. Indian brokers auto-square-off MIS positions and charge for doing it.', type: 'int', min: 1, max: 90, default: 15 },
        DIRECTION,
        SIZE_PCT,
    ],
    warmup: (params) => num(params, 'rangeBars', 1) + 1,

    onBar(ctx): Action {
        const b = ctx.barOfSession;
        const session = ctx.session;
        // A continuous market has no opening range at all. Producing a signal here would
        // mean inventing a session that does not exist.
        if (b == null || !session?.open) {
            return ctx.position ? { kind: 'exit', reason: 'market closed' } : HOLD;
        }

        // Flatten before the broker does it for you.
        if (ctx.position && session.minutesToClose != null && session.minutesToClose <= num(ctx.params, 'exitBuffer', 15)) {
            return { kind: 'exit', reason: 'squared off before the session close' };
        }

        const rangeBars = num(ctx.params, 'rangeBars', 1);
        if (b < rangeBars) return HOLD;          // still inside the opening range
        if (ctx.position) return HOLD;           // one entry per session

        // The opening range is session bars 0..rangeBars-1, which sit `b` .. `b-rangeBars+1`
        // bars behind the current one.
        let hi = -Infinity;
        let lo = Infinity;
        for (let j = 0; j < rangeBars; j++) {
            const candle = ctx.bar(b - j);
            if (!candle) return HOLD;
            hi = Math.max(hi, candle.high);
            lo = Math.min(lo, candle.low);
        }
        if (!Number.isFinite(hi) || !Number.isFinite(lo) || hi <= lo) return HOLD;

        const price = ctx.close(0);
        if (price == null) return HOLD;
        const buffer = num(ctx.params, 'bufferPct', 0.1) / 100;
        const dir = String(ctx.params.direction ?? 'long');
        const size = equityPct(num(ctx.params, 'sizePct', 20));
        const usePctStop = String(ctx.params.stopMode ?? 'range') === 'pct';
        const stopPct = num(ctx.params, 'stopPct', 1) / 100;

        if (price > hi * (1 + buffer) && allows(dir, 'buy')) {
            return { kind: 'enter', side: 'buy', sizing: size, stop: usePctStop ? price * (1 - stopPct) : lo, reason: 'broke above the opening range' };
        }
        if (price < lo * (1 - buffer) && allows(dir, 'sell')) {
            return { kind: 'enter', side: 'sell', sizing: size, stop: usePctStop ? price * (1 + stopPct) : hi, reason: 'broke below the opening range' };
        }
        return HOLD;
    },

    explain: {
        idea: 'The first minutes of a session absorb everything that happened while the market was shut — overnight news, other time zones, orders queued since yesterday. Once that initial burst settles, the high and low it produced act as reference levels, and a decisive break of one is read as the day choosing a direction.',
        entry: 'After the opening range is established, a close beyond its high or low by more than the buffer.',
        exit: 'The opposite side of the opening range as a stop, and a forced flatten before the close.',
        whenItFails: 'Range-bound days, where price breaks the opening high, reverses, breaks the low, and reverses again — paying the spread and the charges each time. It also fails on gap days, where the opening range is enormous and the stop is consequently far away, making the position size tiny or the risk large.',
        lesson: 'stops',
    },
    caveats: [
        'Intraday only. On a continuous market there is no opening range and this produces no signal.',
        'The app has roughly 28 days of NSE intraday history, which is far too short a sample to validate an intraday strategy. Treat any result as a check that the logic works, not as evidence of an edge.',
    ],
};

export const sessionMomentum: Strategy = {
    id: 'session-momentum',
    name: 'Asian range, London breakout',
    family: 'session',
    markets: ['forex', 'commodity', 'crypto'],
    shape: 'single',
    params: [
        { key: 'rangeStart', label: 'Range start (UTC)', help: 'Hour the quiet session begins. The Asian session runs roughly 00:00 to 07:00 UTC.', type: 'int', min: 0, max: 23, default: 0 },
        { key: 'rangeEnd', label: 'Range end (UTC)', help: 'Hour the quiet session ends and the breakout window opens.', type: 'int', min: 1, max: 23, default: 7 },
        { key: 'tradeUntil', label: 'Trade until (UTC)', help: 'Stop taking new entries after this hour; the move usually happens near the open.', type: 'int', min: 1, max: 23, default: 12 },
        { key: 'bufferPct', label: 'Breakout buffer', help: 'Require the break to clear the range by this percent.', type: 'pct', min: 0, max: 2, step: 0.05, default: 0.05 },
        DIRECTION,
        SIZE_PCT,
    ],
    warmup: () => 24,

    onBar(ctx): Action {
        const hour = utcHour(ctx);
        if (hour == null) return HOLD;

        const start = num(ctx.params, 'rangeStart', 0);
        const end = num(ctx.params, 'rangeEnd', 7);
        const until = num(ctx.params, 'tradeUntil', 12);

        // Inside the quiet session there is nothing to trade yet; outside the window,
        // whatever move there was has already happened.
        if (hour < end || hour > until) {
            if (ctx.position && hour > until) return { kind: 'exit', reason: 'past the breakout window' };
            return HOLD;
        }
        if (ctx.position) return HOLD;

        // Walk back over the bars that fall inside the quiet session, today.
        let hi = -Infinity;
        let lo = Infinity;
        let seen = 0;
        for (let back = 1; back < 200; back++) {
            const candle = ctx.bar(back);
            if (!candle) break;
            const h = new Date(candle.time * 1000).getUTCHours();
            if (h >= end) continue;              // later than the range, same day
            if (h < start) break;                // rolled past the start of the range
            hi = Math.max(hi, candle.high);
            lo = Math.min(lo, candle.low);
            seen++;
        }
        if (seen === 0 || !Number.isFinite(hi) || hi <= lo) return HOLD;

        const price = ctx.close(0);
        if (price == null) return HOLD;
        const buffer = num(ctx.params, 'bufferPct', 0.05) / 100;
        const dir = String(ctx.params.direction ?? 'long');
        const size = equityPct(num(ctx.params, 'sizePct', 20));

        if (price > hi * (1 + buffer) && allows(dir, 'buy')) {
            return { kind: 'enter', side: 'buy', sizing: size, stop: lo, reason: 'broke above the quiet-session range' };
        }
        if (price < lo * (1 - buffer) && allows(dir, 'sell')) {
            return { kind: 'enter', side: 'sell', sizing: size, stop: hi, reason: 'broke below the quiet-session range' };
        }
        return HOLD;
    },

    explain: {
        idea: 'Currency markets run continuously, but liquidity does not. The Asian hours are comparatively quiet and prices tend to consolidate; when London opens, an order of magnitude more volume arrives at once. A break of the quiet range as that volume hits is read as the direction the larger participants are taking.',
        entry: 'After the quiet session ends, a break of its high or low within the trading window.',
        exit: 'The opposite side of the quiet range as a stop, and a flat position once the window closes.',
        whenItFails: 'Days when London opens and immediately reverses, which is common enough to have its own trading folklore. It also fails whenever a scheduled release lands mid-window: the range break and the news are the same event, and the spread widens exactly when the order goes in.',
    },
    caveats: [
        'Session hours are in UTC and do not shift with daylight saving, so the London open drifts by an hour twice a year relative to these boundaries.',
        'Needs intraday bars. On daily bars every bar is its own session and the range is undefined.',
    ],
};

export const SESSION_STRATEGIES = [openingRangeBreakout, sessionMomentum];
