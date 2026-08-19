import { HOLD, num, type Action, type Strategy } from '../types';
import { DIRECTION, SIZE_PCT, allows, equityPct } from './common';

// Mean reversion.
//
// The premise is the opposite of trend following: extreme moves overshoot and snap back.
// The signature is also the mirror image — a HIGH win rate with a small payoff ratio.
// Many small wins, occasionally one very large loss when the move that looked extreme
// turns out to be the start of something. That single trade can erase months, which is
// why every strategy here needs a stop and why "it has won 80% of the time" is not
// reassurance.

export const bollingerRsi: Strategy = {
    id: 'bollinger-rsi',
    name: 'Bollinger band + RSI reversion',
    family: 'meanReversion',
    markets: ['crypto', 'india', 'us', 'forex', 'commodity'],
    shape: 'single',
    params: [
        { key: 'period', label: 'Band period', help: 'Bars in the moving average the bands are drawn around.', type: 'int', min: 5, max: 200, default: 20 },
        { key: 'mult', label: 'Band width', help: 'Standard deviations from the average. Wider bands trade less often but the signal is more extreme.', type: 'float', min: 0.5, max: 5, step: 0.5, default: 2 },
        { key: 'rsiPeriod', label: 'RSI period', help: 'Bars used for the RSI confirmation.', type: 'int', min: 2, max: 50, default: 14 },
        { key: 'oversold', label: 'Oversold level', help: 'RSI must be below this to buy. Lower is stricter.', type: 'float', min: 5, max: 50, default: 30 },
        { key: 'overbought', label: 'Overbought level', help: 'RSI must be above this to sell short.', type: 'float', min: 50, max: 95, default: 70 },
        { key: 'stopPct', label: 'Stop distance', help: 'Percent beyond the entry at which to admit the move was not an overshoot.', type: 'pct', min: 0.2, max: 30, step: 0.1, default: 4 },
        DIRECTION,
        SIZE_PCT,
    ],
    warmup: (params) => Math.max(num(params, 'period', 20), num(params, 'rsiPeriod', 14)) + 2,

    onBar(ctx): Action {
        const band = ctx.ind.bollinger(num(ctx.params, 'period', 20), num(ctx.params, 'mult', 2));
        const rsi = ctx.ind.rsi(num(ctx.params, 'rsiPeriod', 14));
        const price = ctx.close(0);
        // A null RSI means "not enough history", not "neutral". Substituting 50 here
        // would disable the confirmation filter during exactly the warm-up window.
        if (!band || rsi == null || price == null) return HOLD;

        if (ctx.position) {
            const isLong = ctx.position.qty > 0;
            // The target is the middle band — the mean it is reverting to.
            if (isLong && price >= band.mid) return { kind: 'exit', reason: 'reverted to the average' };
            if (!isLong && price <= band.mid) return { kind: 'exit', reason: 'reverted to the average' };
            return HOLD;
        }

        const dir = String(ctx.params.direction ?? 'long');
        const size = equityPct(num(ctx.params, 'sizePct', 20));
        const stopPct = num(ctx.params, 'stopPct', 4) / 100;

        if (price < band.lower && rsi < num(ctx.params, 'oversold', 30) && allows(dir, 'buy')) {
            return { kind: 'enter', side: 'buy', sizing: size, stop: price * (1 - stopPct), target: band.mid, reason: `below the lower band with RSI ${rsi.toFixed(0)}` };
        }
        if (price > band.upper && rsi > num(ctx.params, 'overbought', 70) && allows(dir, 'sell')) {
            return { kind: 'enter', side: 'sell', sizing: size, stop: price * (1 + stopPct), target: band.mid, reason: `above the upper band with RSI ${rsi.toFixed(0)}` };
        }
        return HOLD;
    },

    explain: {
        idea: 'Bollinger bands sit a couple of standard deviations either side of a moving average, so price outside them is unusual relative to its own recent volatility. On its own that is weak — price rides the upper band throughout a strong trend. Requiring RSI to agree that the move is stretched filters out the cases where "unusual" simply means "trending".',
        entry: 'Buy when the close is below the lower band AND RSI is oversold. Short the mirror image.',
        exit: 'Take profit when price returns to the middle band. A percentage stop closes the trade when the overshoot turns out to be a trend.',
        whenItFails: 'A genuine breakout. Price leaves the band and keeps going, RSI stays pinned below 30 for weeks, and every entry is against a move that does not stop. This is the strategy that most reliably produces a long string of small wins followed by one loss larger than all of them.',
        lesson: 'scanner-and-rsi',
    },
};

export const rsi2: Strategy = {
    id: 'rsi-2',
    name: 'RSI(2) pullback in a trend',
    family: 'meanReversion',
    markets: ['india', 'us', 'crypto'],
    shape: 'single',
    params: [
        { key: 'trendPeriod', label: 'Trend filter', help: 'Only buy dips while price is above this long moving average. Without it, this buys every crash.', type: 'int', min: 20, max: 400, default: 200 },
        { key: 'rsiPeriod', label: 'RSI period', help: 'Deliberately very short — 2 makes RSI react to a single bad day.', type: 'int', min: 2, max: 10, default: 2 },
        { key: 'entryLevel', label: 'Entry RSI', help: 'Buy when the short RSI drops below this.', type: 'float', min: 1, max: 30, default: 10 },
        { key: 'exitPeriod', label: 'Exit average', help: 'Sell when price closes back above this short average.', type: 'int', min: 2, max: 50, default: 5 },
        { key: 'stopPct', label: 'Stop distance', help: 'Percent below entry at which the dip is treated as a decline.', type: 'pct', min: 0.5, max: 30, step: 0.5, default: 6 },
        SIZE_PCT,
    ],
    warmup: (params) => num(params, 'trendPeriod', 200) + 2,

    onBar(ctx): Action {
        const trend = ctx.ind.sma(num(ctx.params, 'trendPeriod', 200));
        const rsi = ctx.ind.rsi(num(ctx.params, 'rsiPeriod', 2));
        const exitMa = ctx.ind.sma(num(ctx.params, 'exitPeriod', 5));
        const price = ctx.close(0);
        if (trend == null || rsi == null || exitMa == null || price == null) return HOLD;

        if (ctx.position) {
            if (price > exitMa) return { kind: 'exit', reason: 'closed back above the short average' };
            return HOLD;
        }

        // The trend filter is the whole strategy. Buying oversold readings without it is
        // buying every decline on the way down.
        if (price > trend && rsi < num(ctx.params, 'entryLevel', 10)) {
            const stopPct = num(ctx.params, 'stopPct', 6) / 100;
            return {
                kind: 'enter',
                side: 'buy',
                sizing: equityPct(num(ctx.params, 'sizePct', 20)),
                stop: price * (1 - stopPct),
                reason: `RSI(2) at ${rsi.toFixed(0)} while above the long average`,
            };
        }
        return HOLD;
    },

    explain: {
        idea: 'A very short RSI — two bars rather than fourteen — reacts to a single sharp down day. Combined with a long-term filter that only permits buying while the instrument is above its 200-bar average, this buys short pullbacks inside an established uptrend. The two components do different jobs: the long average decides whether to participate at all, the short RSI decides when.',
        entry: 'Price above the long moving average, and RSI(2) below the entry level.',
        exit: 'Price closes back above a short moving average, usually within a few bars. A stop handles the case where the pullback keeps going.',
        whenItFails: 'When the long-term trend breaks while you are still trading it. The 200-bar average turns slowly, so there is a window where the filter still says "uptrend" and the market has already rolled over. That window is where this strategy takes its worst losses.',
    },
    caveats: ['Long only. The asymmetry it exploits — sharp dips inside uptrends — does not mirror cleanly on the short side.'],
};

export const vwapReversion: Strategy = {
    id: 'vwap-reversion',
    name: 'VWAP reversion',
    family: 'meanReversion',
    markets: ['india', 'us', 'crypto'],
    shape: 'single',
    params: [
        { key: 'stretchPct', label: 'Stretch', help: 'How far from VWAP, in percent, before the move counts as stretched.', type: 'pct', min: 0.1, max: 10, step: 0.1, default: 1 },
        { key: 'stopPct', label: 'Stop distance', help: 'Percent beyond entry at which to give up on the reversion.', type: 'pct', min: 0.2, max: 20, step: 0.1, default: 2 },
        DIRECTION,
        SIZE_PCT,
    ],
    warmup: () => 5,

    onBar(ctx): Action {
        const vwap = ctx.ind.vwap();
        const price = ctx.close(0);
        // VWAP needs volume. Live bars are built from quote ticks and carry none, so this
        // returns null there — and a price average dressed up as VWAP would be a different
        // indicator wearing the wrong name.
        if (vwap == null || vwap <= 0 || price == null) return HOLD;

        const stretch = (price - vwap) / vwap;
        const threshold = num(ctx.params, 'stretchPct', 1) / 100;

        if (ctx.position) {
            const isLong = ctx.position.qty > 0;
            if (isLong && price >= vwap) return { kind: 'exit', reason: 'returned to VWAP' };
            if (!isLong && price <= vwap) return { kind: 'exit', reason: 'returned to VWAP' };
            return HOLD;
        }

        const dir = String(ctx.params.direction ?? 'long');
        const size = equityPct(num(ctx.params, 'sizePct', 20));
        const stopPct = num(ctx.params, 'stopPct', 2) / 100;

        if (stretch < -threshold && allows(dir, 'buy')) {
            return { kind: 'enter', side: 'buy', sizing: size, stop: price * (1 - stopPct), target: vwap, reason: `${(stretch * 100).toFixed(2)}% below VWAP` };
        }
        if (stretch > threshold && allows(dir, 'sell')) {
            return { kind: 'enter', side: 'sell', sizing: size, stop: price * (1 + stopPct), target: vwap, reason: `${(stretch * 100).toFixed(2)}% above VWAP` };
        }
        return HOLD;
    },

    explain: {
        idea: 'VWAP is the average price weighted by how much actually traded there, which makes it a rough proxy for where the day\'s real business was done. Institutions measure their own execution against it, so it acts as a magnet during a session: price that has run well away from VWAP often comes back to it.',
        entry: 'Price stretched a configurable percentage away from session VWAP.',
        exit: 'Price returns to VWAP, or the stop admits the move was not a stretch.',
        whenItFails: 'Trend days, when VWAP simply rises all session and price never comes back to it. Fading a trend day with this is how an intraday account loses a week of gains in an afternoon.',
    },
    caveats: [
        'Needs real per-bar volume. Historical candles have it; live bars built from quote ticks do not, so this produces no live signal on instruments without a volume feed.',
        'VWAP anchors at each session open, so it is only meaningful on intraday bars.',
    ],
};

export const zscoreReversion: Strategy = {
    id: 'zscore-reversion',
    name: 'Z-score reversion',
    family: 'meanReversion',
    markets: ['crypto', 'india', 'us', 'forex', 'commodity'],
    shape: 'single',
    params: [
        { key: 'period', label: 'Lookback', help: 'Bars used for the mean and standard deviation.', type: 'int', min: 5, max: 300, default: 40 },
        { key: 'entryZ', label: 'Entry z-score', help: 'Standard deviations from the mean before entering. 2 is roughly the most extreme 5% of readings.', type: 'float', min: 0.5, max: 5, step: 0.1, default: 2 },
        { key: 'exitZ', label: 'Exit z-score', help: 'Close once the z-score has come back inside this.', type: 'float', min: 0, max: 3, step: 0.1, default: 0.3 },
        { key: 'stopZ', label: 'Stop z-score', help: 'Give up if it stretches this far instead of reverting.', type: 'float', min: 1, max: 10, step: 0.5, default: 4 },
        DIRECTION,
        SIZE_PCT,
    ],
    warmup: (params) => num(params, 'period', 40) + 2,

    onBar(ctx): Action {
        const period = num(ctx.params, 'period', 40);
        const z = ctx.ind.zscore(period);
        const price = ctx.close(0);
        const sd = ctx.ind.stddev(period);
        const mean = ctx.ind.sma(period);
        // zscore returns null on a flat window, where the score is undefined rather than
        // zero. Treating that as "exactly at the mean" would fire an exit every bar.
        if (z == null || price == null || sd == null || mean == null || sd <= 0) return HOLD;

        const exitZ = num(ctx.params, 'exitZ', 0.3);
        if (ctx.position) {
            if (Math.abs(z) <= exitZ) return { kind: 'exit', reason: `z-score back to ${z.toFixed(2)}` };
            return HOLD;
        }

        const entryZ = num(ctx.params, 'entryZ', 2);
        const stopZ = num(ctx.params, 'stopZ', 4);
        const dir = String(ctx.params.direction ?? 'long');
        const size = equityPct(num(ctx.params, 'sizePct', 20));

        if (z <= -entryZ && allows(dir, 'buy')) {
            return { kind: 'enter', side: 'buy', sizing: size, stop: mean - stopZ * sd, target: mean, reason: `z-score ${z.toFixed(2)}` };
        }
        if (z >= entryZ && allows(dir, 'sell')) {
            return { kind: 'enter', side: 'sell', sizing: size, stop: mean + stopZ * sd, target: mean, reason: `z-score ${z.toFixed(2)}` };
        }
        return HOLD;
    },

    explain: {
        idea: 'A z-score expresses how far price sits from its own recent mean in units of its own recent volatility. That normalisation is what makes it comparable across instruments: two standard deviations means the same thing on a quiet currency pair and a violent altcoin, even though the percentage moves differ by an order of magnitude.',
        entry: 'Buy at a z-score below minus the entry threshold; short above it.',
        exit: 'Close once the score returns near zero. The stop is placed at a further z-score, so it scales with volatility rather than being a fixed percentage.',
        whenItFails: 'When the mean itself is moving. A z-score measures distance from a rolling average, and in a steady trend that average chases price, so the score keeps resetting toward zero while the instrument marches away from where you bought it.',
    },
};

export const MEAN_REVERSION_STRATEGIES = [bollingerRsi, rsi2, vwapReversion, zscoreReversion];
