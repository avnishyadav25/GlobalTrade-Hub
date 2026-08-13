import { HOLD, num, type Action, type Strategy } from '../types';
import { ATR_MULT, ATR_PERIOD, DIRECTION, RISK_PCT, SIZE_PCT, allows, atrRiskSizing, atrStop, equityPct } from './common';

// Trend-following.
//
// The shared premise: price moves persist for longer than chance would predict, so
// buying strength and selling weakness pays. It is the oldest systematic idea there is,
// and it has one universal signature — a low win rate with a large payoff ratio. Most
// trades are small losses; a few are very large wins. Any trend strategy showing a high
// win rate is usually cutting winners early, which removes the only trades that pay for
// all the others.

export const maCrossover: Strategy = {
    id: 'ma-crossover',
    name: 'Moving average crossover',
    family: 'trend',
    markets: ['crypto', 'india', 'us', 'forex', 'commodity'],
    shape: 'single',
    params: [
        { key: 'fast', label: 'Fast average', help: 'Bars in the quick average. Lower reacts sooner and whipsaws more.', type: 'int', min: 2, max: 200, default: 20 },
        { key: 'slow', label: 'Slow average', help: 'Bars in the slow average. The gap between the two IS the strategy.', type: 'int', min: 3, max: 400, default: 50 },
        { key: 'maType', label: 'Average type', help: 'EMA weights recent bars more heavily and turns sooner; SMA is steadier.', type: 'choice', choices: [{ value: 'ema', label: 'Exponential' }, { value: 'sma', label: 'Simple' }], default: 'ema' },
        DIRECTION,
        SIZE_PCT,
    ],
    // fast must be strictly faster than slow, or the two lines never cross.
    normalise: (params) => ({ ...params, fast: Math.min(num(params, 'fast'), num(params, 'slow') - 1) }),
    warmup: (params) => num(params, 'slow', 50) + 2,

    onBar(ctx): Action {
        const type = String(ctx.params.maType ?? 'ema');
        const fastN = num(ctx.params, 'fast', 20);
        const slowN = num(ctx.params, 'slow', 50);
        const ma = (n: number, back: number) => (type === 'sma' ? ctx.ind.sma(n, back) : ctx.ind.ema(n, back));

        const f1 = ma(fastN, 0);
        const s1 = ma(slowN, 0);
        const f0 = ma(fastN, 1);
        const s0 = ma(slowN, 1);
        if (f1 == null || s1 == null || f0 == null || s0 == null) return HOLD;

        const crossUp = f0 <= s0 && f1 > s1;
        const crossDown = f0 >= s0 && f1 < s1;
        const dir = String(ctx.params.direction ?? 'long');
        const size = equityPct(num(ctx.params, 'sizePct', 20));

        if (ctx.position) {
            const isLong = ctx.position.qty > 0;
            if ((isLong && crossDown) || (!isLong && crossUp)) return { kind: 'exit', reason: 'the averages crossed back' };
            return HOLD;
        }
        if (crossUp && allows(dir, 'buy')) return { kind: 'enter', side: 'buy', sizing: size, reason: `${type.toUpperCase()}${fastN} crossed above ${type.toUpperCase()}${slowN}` };
        if (crossDown && allows(dir, 'sell')) return { kind: 'enter', side: 'sell', sizing: size, reason: `${type.toUpperCase()}${fastN} crossed below ${type.toUpperCase()}${slowN}` };
        return HOLD;
    },

    explain: {
        idea: 'Two averages of the same price, one quick and one slow. When the quick one pulls above the slow one, recent prices are above the longer-run norm and the market is trending up. The crossing is not a prediction — it is a late, smoothed confirmation that a move has already begun, and that lateness is the price of filtering out noise.',
        entry: 'Go long when the fast average crosses above the slow one; short on the reverse cross if shorting is enabled.',
        exit: 'Close when the averages cross back the other way. There is no separate stop: the slow average is the stop.',
        whenItWorks: 'Sustained trends, which is the only regime it is built for. When a market moves in one direction for weeks the crossover gets in late, stays in for the bulk of the move, and exits late — capturing the middle. Its low win rate is not a flaw but the shape of the payoff: a handful of large winners funds a long string of small whipsaw losses, and the arithmetic only works if you are still there when the trend arrives.',
        whenItFails: 'Sideways markets. The averages tangle and cross repeatedly, each crossing costing a spread, a slippage and a round of charges. A crossover system can lose money for months in a range and make it all back in one trend — which is why judging it over a short sample tells you nothing.',
        lesson: 'reading-a-candle',
    },
};

export const macdTrend: Strategy = {
    id: 'macd-trend',
    name: 'MACD signal cross',
    family: 'trend',
    markets: ['crypto', 'india', 'us', 'forex', 'commodity'],
    shape: 'single',
    params: [
        { key: 'fast', label: 'Fast EMA', help: 'Shorter EMA of the MACD calculation.', type: 'int', min: 2, max: 100, default: 12 },
        { key: 'slow', label: 'Slow EMA', help: 'Longer EMA. MACD is the gap between the two.', type: 'int', min: 3, max: 200, default: 26 },
        { key: 'signal', label: 'Signal EMA', help: 'Smoothing applied to the MACD line itself.', type: 'int', min: 2, max: 100, default: 9 },
        { key: 'minHist', label: 'Minimum strength', help: 'Ignore crossings where the histogram is smaller than this fraction of price — they are usually noise.', type: 'float', min: 0, max: 5, step: 0.05, default: 0 },
        DIRECTION,
        SIZE_PCT,
    ],
    normalise: (params) => ({ ...params, fast: Math.min(num(params, 'fast'), num(params, 'slow') - 1) }),
    warmup: (params) => num(params, 'slow', 26) + num(params, 'signal', 9) + 2,

    onBar(ctx): Action {
        const f = num(ctx.params, 'fast', 12);
        const s = num(ctx.params, 'slow', 26);
        const sig = num(ctx.params, 'signal', 9);
        const now = ctx.ind.macd(f, s, sig, 0);
        const prev = ctx.ind.macd(f, s, sig, 1);
        if (!now || !prev) return HOLD;

        const price = ctx.close(0);
        if (price == null || price <= 0) return HOLD;
        const strength = Math.abs(now.hist) / price * 100;
        if (strength < num(ctx.params, 'minHist', 0)) return HOLD;

        const crossUp = prev.macd <= prev.signal && now.macd > now.signal;
        const crossDown = prev.macd >= prev.signal && now.macd < now.signal;
        const dir = String(ctx.params.direction ?? 'long');
        const size = equityPct(num(ctx.params, 'sizePct', 20));

        if (ctx.position) {
            const isLong = ctx.position.qty > 0;
            if ((isLong && crossDown) || (!isLong && crossUp)) return { kind: 'exit', reason: 'MACD crossed back through its signal' };
            return HOLD;
        }
        if (crossUp && allows(dir, 'buy')) return { kind: 'enter', side: 'buy', sizing: size, reason: 'MACD crossed above its signal line' };
        if (crossDown && allows(dir, 'sell')) return { kind: 'enter', side: 'sell', sizing: size, reason: 'MACD crossed below its signal line' };
        return HOLD;
    },

    explain: {
        idea: 'MACD is the distance between a fast and a slow exponential average, and the signal line is a smoothed version of that distance. A crossing says the rate at which the trend is strengthening has itself turned. It is a moving-average crossover with an extra layer of smoothing, so it is later still — and correspondingly less twitchy.',
        entry: 'Long when the MACD line crosses above its signal line, short on the reverse.',
        exit: 'On the opposite crossing.',
        whenItWorks: 'Trends that build gradually rather than gapping into existence. Because MACD measures whether the trend is ACCELERATING, it tends to hold through the shallow pullbacks that shake a plain crossover out, and the extra smoothing suppresses the marginal crosses that a raw average produces in a drifting market.',
        whenItFails: 'The same sideways-market problem as any crossover, plus one of its own: because MACD is a difference of averages, it can cross while price is going nowhere, purely because the averages are converging. The minimum-strength filter exists to suppress exactly those, at the cost of missing the start of some real moves.',
    },
};

export const atrTrailingTrend: Strategy = {
    id: 'atr-trailing-trend',
    name: 'Breakout with an ATR trailing stop',
    family: 'trend',
    markets: ['crypto', 'india', 'us', 'forex', 'commodity'],
    shape: 'single',
    params: [
        { key: 'breakout', label: 'Breakout lookback', help: 'Enter when price closes beyond the highest high (or lowest low) of this many prior bars.', type: 'int', min: 5, max: 200, default: 20 },
        ATR_PERIOD,
        ATR_MULT,
        RISK_PCT,
        DIRECTION,
    ],
    warmup: (params) => Math.max(num(params, 'breakout', 20), num(params, 'atrPeriod', 14)) + 2,

    onBar(ctx): Action {
        const lookback = num(ctx.params, 'breakout', 20);
        const atrPeriod = num(ctx.params, 'atrPeriod', 14);
        const mult = num(ctx.params, 'atrMult', 2);
        const channel = ctx.ind.donchian(lookback, 0);
        const price = ctx.close(0);
        if (!channel || price == null) return HOLD;

        // Trail the stop. The engine refuses any move that loosens it, so this can be
        // stated as "here is where the stop should be" without a direction check here.
        if (ctx.position) {
            const isLong = ctx.position.qty > 0;
            const trail = atrStop(ctx, isLong ? 'buy' : 'sell', price, atrPeriod, mult);
            if (trail == null) return HOLD;
            return { kind: 'setStop', stop: trail, reason: 'trailing stop follows price' };
        }

        const dir = String(ctx.params.direction ?? 'long');
        const riskPct = num(ctx.params, 'riskPct', 1);
        const sizing = atrRiskSizing(ctx, atrPeriod, mult, riskPct);
        if (!sizing) return HOLD;

        if (price > channel.upper && allows(dir, 'buy')) {
            const stop = atrStop(ctx, 'buy', price, atrPeriod, mult);
            if (stop == null) return HOLD;
            return { kind: 'enter', side: 'buy', sizing, stop, reason: `closed above the ${lookback}-bar high` };
        }
        if (price < channel.lower && allows(dir, 'sell')) {
            const stop = atrStop(ctx, 'sell', price, atrPeriod, mult);
            if (stop == null) return HOLD;
            return { kind: 'enter', side: 'sell', sizing, stop, reason: `closed below the ${lookback}-bar low` };
        }
        return HOLD;
    },

    explain: {
        idea: 'Enter when price breaks out of its recent range, then let the position run behind a stop that follows it up at a fixed multiple of recent volatility. Sizing comes from the same volatility measure, so a jumpy instrument automatically gets a smaller position than a calm one for the same rupee risk.',
        entry: 'Close beyond the highest high or lowest low of the lookback window.',
        exit: 'The ATR trailing stop only. There is no profit target, deliberately — a target caps the rare large winner that pays for every small loss.',
        whenItWorks: 'Markets that break out and keep going, where the absence of a profit target is the whole point — the trailing stop lets one trade run far enough to pay for a season of failed breakouts. Volatility-based sizing also means a violent instrument and a calm one risk the same rupees, so the strategy is comparable across a portfolio rather than accidentally concentrated in whatever moves most.',
        whenItFails: 'False breakouts in a range: price pokes out, triggers the entry, and immediately reverses through the stop. Also gaps — the stop is a level, not a guarantee, and an overnight gap fills you well beyond it.',
        lesson: 'position-sizing',
    },
    caveats: ['The trailing stop is re-expressed as a re-entry at zero additional size, because the engine holds one position with one stop.'],
};

export const donchianBreakout: Strategy = {
    id: 'donchian-breakout',
    name: 'Donchian channel breakout',
    family: 'trend',
    markets: ['crypto', 'india', 'us', 'forex', 'commodity'],
    shape: 'single',
    params: [
        { key: 'entryLookback', label: 'Entry channel', help: 'Break the high/low of this many bars to enter. The original Turtle rule used 20.', type: 'int', min: 5, max: 300, default: 20 },
        { key: 'exitLookback', label: 'Exit channel', help: 'Leave when price breaks the opposite extreme of this many bars. Shorter exits faster.', type: 'int', min: 3, max: 200, default: 10 },
        DIRECTION,
        SIZE_PCT,
    ],
    // The exit channel must be shorter than the entry channel, or the exit condition is
    // already true at the moment you enter and the position closes on the next bar.
    normalise: (params) => ({ ...params, exitLookback: Math.min(num(params, 'exitLookback'), num(params, 'entryLookback') - 1) }),
    warmup: (params) => num(params, 'entryLookback', 20) + 2,

    onBar(ctx): Action {
        const entryN = num(ctx.params, 'entryLookback', 20);
        const exitN = num(ctx.params, 'exitLookback', 10);
        const price = ctx.close(0);
        const entry = ctx.ind.donchian(entryN, 0);
        const exit = ctx.ind.donchian(exitN, 0);
        if (price == null || !entry || !exit) return HOLD;

        if (ctx.position) {
            const isLong = ctx.position.qty > 0;
            if (isLong && price < exit.lower) return { kind: 'exit', reason: `fell through the ${exitN}-bar low` };
            if (!isLong && price > exit.upper) return { kind: 'exit', reason: `rose through the ${exitN}-bar high` };
            return HOLD;
        }

        const dir = String(ctx.params.direction ?? 'long');
        const size = equityPct(num(ctx.params, 'sizePct', 20));
        if (price > entry.upper && allows(dir, 'buy')) return { kind: 'enter', side: 'buy', sizing: size, reason: `broke the ${entryN}-bar high` };
        if (price < entry.lower && allows(dir, 'sell')) return { kind: 'enter', side: 'sell', sizing: size, reason: `broke the ${entryN}-bar low` };
        return HOLD;
    },

    explain: {
        idea: 'The rule the Turtle traders were taught in 1983: buy a new N-bar high, sell a new N-bar low, and use a shorter channel to get out. It is almost embarrassingly simple, which is the point — it has no fitted parameters beyond two lookbacks, so there is very little for it to overfit to.',
        entry: 'Close above the highest high of the entry channel, or below the lowest low.',
        exit: 'Close beyond the opposite side of the shorter exit channel.',
        whenItWorks: 'Long, persistent trends in liquid instruments — the regime it was designed for in 1983 and has survived in since. Its strength is what it lacks: with only two lookbacks and no fitted thresholds there is almost nothing to overfit, so an out-of-sample result tends to resemble the in-sample one, which is more than most strategies can claim.',
        whenItFails: 'Choppy, mean-reverting markets, where every breakout is immediately retraced. It also suffers badly when many instruments break out together and then all reverse — the losses arrive at the same time rather than being spread out.',
    },
    caveats: ['The channel deliberately excludes the current bar, so "breaking the 20-bar high" means exceeding the highest of the 20 bars BEFORE this one.'],
};

export const TREND_STRATEGIES = [maCrossover, macdTrend, atrTrailingTrend, donchianBreakout];
