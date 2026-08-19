import { HOLD, num, type Action, type Strategy, type StrategyContext } from '../types';
import { SIZE_PCT, equityPct } from './common';

// Spread and relative-value strategies.
//
// These trade the RELATIONSHIP between two instruments rather than the direction of
// either. That is genuinely different: a pair can pay while both legs fall, and it can
// lose while both rise.
//
// ONE HONEST LIMITATION APPLIES TO ALL OF THEM. The engine holds a single position in a
// single instrument, so it cannot short one leg while buying the other. What these
// strategies actually do is trade the PRIMARY instrument using the spread as the signal.
// That captures the timing idea and NOT the market-neutrality — a real pairs trade is
// hedged, and this is not. Every one of them says so in its caveats, because a
// half-implemented hedge that looks like a hedge is worse than no hedge.

/** Rolling mean and sample standard deviation of the last `period` spread readings. */
function spreadStats(ctx: StrategyContext, role: string, period: number, useLog: boolean) {
    const other = ctx.other(role);
    if (!other) return null;

    const values: number[] = [];
    for (let back = 0; back < period; back++) {
        const a = ctx.close(back);
        const b = other.close(back);
        if (a == null || b == null || a <= 0 || b <= 0) return null;
        values.push(useLog ? Math.log(a / b) : a / b);
    }
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
    const sd = Math.sqrt(variance);
    // A zero-variance spread has an undefined z-score, not a zero one.
    if (!(sd > 0)) return null;
    return { current: values[0], mean, sd, z: (values[0] - mean) / sd };
}

export const pairsZScore: Strategy = {
    id: 'pairs-zscore',
    name: 'Pairs spread reversion',
    family: 'spread',
    markets: ['us', 'india', 'crypto'],
    shape: 'pair',
    requires: [{ role: 'hedge', hint: 'The second leg of the pair — a closely related instrument, e.g. an ETF against one of its components.' }],
    params: [
        { key: 'period', label: 'Lookback', help: 'Bars used for the spread mean and deviation.', type: 'int', min: 10, max: 300, default: 60 },
        { key: 'entryZ', label: 'Entry z-score', help: 'Standard deviations of spread divergence before acting.', type: 'float', min: 0.5, max: 5, step: 0.1, default: 2 },
        { key: 'exitZ', label: 'Exit z-score', help: 'Close once the spread has come back inside this.', type: 'float', min: 0, max: 3, step: 0.1, default: 0.5 },
        { key: 'stopZ', label: 'Abandon at z-score', help: 'If the spread stretches this far, the relationship has probably broken. Leave.', type: 'float', min: 1, max: 10, step: 0.5, default: 4 },
        { key: 'minCorr', label: 'Minimum correlation', help: 'Refuse to trade when the two legs have stopped moving together. A pair that has decoupled is not a pair.', type: 'float', min: 0, max: 1, step: 0.05, default: 0.6 },
        { key: 'spreadType', label: 'Spread', help: 'Log ratio is scale-free and usually better behaved; plain ratio is easier to read.', type: 'choice', choices: [{ value: 'log', label: 'Log ratio' }, { value: 'ratio', label: 'Price ratio' }], default: 'log' },
        SIZE_PCT,
    ],
    warmup: (params) => num(params, 'period', 60) + 2,

    onBar(ctx): Action {
        const period = num(ctx.params, 'period', 60);
        const stats = spreadStats(ctx, 'hedge', period, String(ctx.params.spreadType ?? 'log') === 'log');
        if (!stats) return HOLD;

        const exitZ = num(ctx.params, 'exitZ', 0.5);
        const stopZ = num(ctx.params, 'stopZ', 4);

        if (ctx.position) {
            if (Math.abs(stats.z) <= exitZ) return { kind: 'exit', reason: `spread reverted to ${stats.z.toFixed(2)} sigma` };
            if (Math.abs(stats.z) >= stopZ) return { kind: 'exit', reason: `spread stretched to ${stats.z.toFixed(2)} sigma — the relationship has broken` };
            return HOLD;
        }

        // The correlation gate is the difference between a pairs trade and a bet that
        // two unrelated things will converge.
        const corr = ctx.ind.correlationWith('hedge', period);
        if (corr == null || corr < num(ctx.params, 'minCorr', 0.6)) return HOLD;

        const entryZ = num(ctx.params, 'entryZ', 2);
        const size = equityPct(num(ctx.params, 'sizePct', 20));

        // Spread high means THIS leg is expensive relative to the hedge, so sell it.
        if (stats.z >= entryZ) return { kind: 'enter', side: 'sell', sizing: size, reason: `rich to the hedge by ${stats.z.toFixed(2)} sigma` };
        if (stats.z <= -entryZ) return { kind: 'enter', side: 'buy', sizing: size, reason: `cheap to the hedge by ${stats.z.toFixed(2)} sigma` };
        return HOLD;
    },

    explain: {
        idea: 'Two instruments that normally move together occasionally drift apart for reasons that are temporary — an index rebalance, a large order, a piece of news that affects one but should affect both. Measuring that gap in standard deviations of its own history gives a scale-free way to say "this is unusually wide", and the bet is that it narrows.',
        entry: 'Sell this instrument when the spread is unusually rich against the hedge, buy it when unusually cheap, provided the two are still correlated.',
        exit: 'When the spread returns to near its mean, or when it stretches so far that the relationship has evidently changed.',
        whenItFails: 'When the divergence is information rather than noise. If one company has genuinely deteriorated, the spread does not revert — it keeps widening, and the position that was sized for a two-sigma move keeps losing through four, five and six. Correlation measured on the past is exactly the thing that breaks first.',
    },
    caveats: [
        'NOT market-neutral here. The engine holds one position, so this trades the primary leg using the spread as a signal; a real pairs trade is simultaneously short the other leg and is hedged against the market. Do not read these results as a hedged strategy.',
        'Both series must be time-aligned bar for bar. Mismatched trading calendars between the legs will silently distort the spread.',
    ],
};

export const crackSpread: Strategy = {
    id: 'crack-spread',
    name: 'Refining margin reversion',
    family: 'spread',
    markets: ['commodity'],
    shape: 'pair',
    requires: [{ role: 'product', hint: 'The refined product leg — RBOB gasoline (RBOB/USD) or heating oil (HO/USD) against crude.' }],
    params: [
        { key: 'period', label: 'Lookback', help: 'Bars used to establish the normal refining margin.', type: 'int', min: 20, max: 400, default: 90 },
        { key: 'entryZ', label: 'Entry z-score', help: 'How far the margin must stretch from normal before trading it.', type: 'float', min: 0.5, max: 5, step: 0.1, default: 2 },
        { key: 'exitZ', label: 'Exit z-score', help: 'Close when the margin comes back inside this.', type: 'float', min: 0, max: 3, step: 0.1, default: 0.5 },
        SIZE_PCT,
    ],
    warmup: (params) => num(params, 'period', 90) + 2,

    onBar(ctx): Action {
        const period = num(ctx.params, 'period', 90);
        const stats = spreadStats(ctx, 'product', period, true);
        if (!stats) return HOLD;

        if (ctx.position) {
            if (Math.abs(stats.z) <= num(ctx.params, 'exitZ', 0.5)) return { kind: 'exit', reason: 'refining margin back to normal' };
            return HOLD;
        }

        const entryZ = num(ctx.params, 'entryZ', 2);
        const size = equityPct(num(ctx.params, 'sizePct', 20));
        // Crude rich against the product means the margin is compressed, and refiners
        // respond by cutting runs — which historically pushes crude back down.
        if (stats.z >= entryZ) return { kind: 'enter', side: 'sell', sizing: size, reason: `crude rich against the product by ${stats.z.toFixed(2)} sigma` };
        if (stats.z <= -entryZ) return { kind: 'enter', side: 'buy', sizing: size, reason: `crude cheap against the product by ${stats.z.toFixed(2)} sigma` };
        return HOLD;
    },

    explain: {
        idea: 'A refinery buys crude and sells petrol and heating oil, so the gap between them is its gross margin — the crack spread. That margin is bounded by physical economics: too thin and refiners cut runs, reducing product supply and widening it again; too fat and they run flat out, which compresses it. The bet is on that physical feedback loop, not on a statistical accident.',
        entry: 'When the crude-to-product ratio stretches beyond its recent norm.',
        exit: 'When it returns toward that norm.',
        whenItFails: 'Genuine supply shocks. A refinery fire, a hurricane or a sanctions decision moves the margin to a new level and keeps it there, and the reversion never comes. Seasonal transitions also shift the normal range, so a lookback that spans a season change measures against a mean that no longer applies.',
    },
    caveats: [
        'The data here is Yahoo CONTINUOUS front-month futures, not a real calendar-aligned spread. Continuous series splice contracts together at each roll, which puts artificial jumps into the ratio. This approximates the crack spread; it does not reproduce a tradeable one.',
        'A real crack spread is a multi-leg futures position (commonly 3:2:1). This trades the crude leg alone.',
    ],
};

export const crossSectionalMomentum: Strategy = {
    id: 'cross-sectional-momentum',
    name: 'Relative strength ranking',
    family: 'spread',
    markets: ['us', 'india', 'crypto'],
    shape: 'universe',
    requires: [{ role: 'peer', hint: 'A comparison instrument. This instrument is held only while it is outperforming the peer.' }],
    params: [
        { key: 'lookback', label: 'Momentum window', help: 'Bars over which to measure relative performance.', type: 'int', min: 10, max: 400, default: 90 },
        { key: 'skip', label: 'Skip recent bars', help: 'Ignore the most recent bars when ranking. Short-term moves tend to reverse, and skipping them is the standard fix.', type: 'int', min: 0, max: 30, default: 5 },
        { key: 'minEdge', label: 'Minimum outperformance', help: 'Percentage points by which this instrument must beat the peer before holding it.', type: 'pct', min: 0, max: 50, step: 0.5, default: 2 },
        SIZE_PCT,
    ],
    warmup: (params) => num(params, 'lookback', 90) + num(params, 'skip', 5) + 2,

    onBar(ctx): Action {
        const lookback = num(ctx.params, 'lookback', 90);
        const skip = num(ctx.params, 'skip', 5);
        const peer = ctx.other('peer');
        if (!peer) return HOLD;

        const nowSelf = ctx.close(skip);
        const thenSelf = ctx.close(skip + lookback);
        const nowPeer = peer.close(skip);
        const thenPeer = peer.close(skip + lookback);
        if (nowSelf == null || thenSelf == null || nowPeer == null || thenPeer == null) return HOLD;
        if (thenSelf <= 0 || thenPeer <= 0) return HOLD;

        const edge = ((nowSelf / thenSelf) - (nowPeer / thenPeer)) * 100;
        const minEdge = num(ctx.params, 'minEdge', 2);

        if (ctx.position) {
            if (edge <= 0) return { kind: 'exit', reason: 'no longer outperforming the peer' };
            return HOLD;
        }
        if (edge >= minEdge) {
            return { kind: 'enter', side: 'buy', sizing: equityPct(num(ctx.params, 'sizePct', 20)), reason: `outperforming the peer by ${edge.toFixed(1)} points` };
        }
        return HOLD;
    },

    explain: {
        idea: 'Cross-sectional momentum is the observation that, over medium horizons, instruments which have outperformed their peers tend to keep doing so. It is a RELATIVE statement, not a directional one: in a falling market the winner is the one falling least. The recent window is usually skipped because very short-term moves tend to reverse rather than persist.',
        entry: 'Hold while this instrument is beating the peer over the momentum window by more than the minimum edge.',
        exit: 'When the outperformance disappears.',
        whenItFails: 'Sharp reversals, where yesterday\'s leaders become the worst performers within days. Momentum strategies characteristically produce steady gains punctuated by severe, fast drawdowns — the pattern is well documented and it is why sizing matters more here than entry timing.',
        lesson: 'position-sizing',
    },
    caveats: [
        'A real cross-sectional strategy ranks a whole universe and holds the top decile. The engine trades one instrument, so this is reduced to a two-way comparison against a single peer, which is a much weaker version of the idea.',
    ],
};

export const SPREAD_STRATEGIES = [pairsZScore, crackSpread, crossSectionalMomentum];
