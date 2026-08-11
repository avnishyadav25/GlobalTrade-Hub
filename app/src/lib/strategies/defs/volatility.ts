import { HOLD, num, type Action, type Strategy } from '../types';
import { SIZE_PCT, equityPct } from './common';

// Volatility strategies.
//
// Both of these say something the other families do not: how much you hold matters more
// than when you buy. One reacts to fear in the options market, the other adjusts size so
// that a calm instrument and a violent one contribute the same risk.

export const vixContrarian: Strategy = {
    id: 'vix-contrarian',
    name: 'Volatility spike reversal',
    family: 'volatility',
    markets: ['india', 'us'],
    shape: 'single',
    requires: [{ role: 'vix', hint: 'A volatility index series — ^INDIAVIX for NSE, ^VIX for US markets.' }],
    params: [
        { key: 'lookback', label: 'Percentile window', help: 'Bars used to judge whether the volatility reading is historically high.', type: 'int', min: 20, max: 500, default: 120 },
        { key: 'percentile', label: 'Fear threshold', help: 'Volatility must be above this percentile of its own recent range to count as panic.', type: 'float', min: 50, max: 99, default: 90 },
        { key: 'holdBars', label: 'Holding period', help: 'Bars to hold before closing. Fear exhaustion is a short-horizon effect.', type: 'int', min: 1, max: 100, default: 10 },
        { key: 'stopPct', label: 'Stop distance', help: 'Percent below entry at which to accept that the panic was justified.', type: 'pct', min: 1, max: 40, step: 0.5, default: 8 },
        SIZE_PCT,
    ],
    warmup: (params) => num(params, 'lookback', 120) + 2,

    onBar(ctx): Action {
        const vix = ctx.other('vix');
        if (!vix) return HOLD;

        const holdBars = num(ctx.params, 'holdBars', 10);
        if (ctx.position) {
            if (ctx.i - ctx.position.entryIndex >= holdBars) return { kind: 'exit', reason: `held ${holdBars} bars` };
            return HOLD;
        }

        const lookback = num(ctx.params, 'lookback', 120);
        const current = vix.close(0);
        const previous = vix.close(1);
        if (current == null || previous == null) return HOLD;

        // Where does today's reading sit within its own recent range?
        const history: number[] = [];
        for (let back = 0; back < lookback; back++) {
            const v = vix.close(back);
            if (v == null) return HOLD;
            history.push(v);
        }
        const below = history.filter((v) => v < current).length;
        const percentile = (below / history.length) * 100;

        // Two conditions, and the second is what stops this catching a falling knife:
        // volatility must be extreme AND already turning down. A spike that is still
        // rising is a market in the middle of repricing, not one that has finished.
        const isExtreme = percentile >= num(ctx.params, 'percentile', 90);
        const isFalling = current < previous;
        if (!isExtreme || !isFalling) return HOLD;

        const price = ctx.close(0);
        if (price == null) return HOLD;
        const stopPct = num(ctx.params, 'stopPct', 8) / 100;

        return {
            kind: 'enter',
            side: 'buy',
            sizing: equityPct(num(ctx.params, 'sizePct', 20)),
            stop: price * (1 - stopPct),
            reason: `volatility at the ${percentile.toFixed(0)}th percentile and rolling over`,
        };
    },

    explain: {
        idea: 'A volatility index measures what the options market is paying for protection, which is a fairly direct reading of how frightened participants are. Fear is mean-reverting in a way prices are not: it spikes hard and decays. Buying the underlying market once that spike has peaked and started to fall is a bet on the exhaustion of the panic rather than on any view about value.',
        entry: 'The volatility index is in the top decile of its recent range AND has turned down from the previous bar.',
        exit: 'A fixed holding period, with a stop for the case where the fear was well founded.',
        whenItFails: 'When the spike is the beginning rather than the end. In a genuine crisis volatility puts in several lower peaks on the way down while the market keeps falling, and each one looks like exhaustion. This strategy will buy every one of them.',
    },
    caveats: [
        'Long only. Buying fear has a rationale; shorting calm does not have the mirror-image one.',
        'India VIX is available with roughly 595 days of daily history, which is a small sample containing few genuine panics.',
    ],
};

export const volTargeted: Strategy = {
    id: 'vol-targeted',
    name: 'Volatility-targeted trend',
    family: 'volatility',
    markets: ['crypto', 'india', 'us', 'forex', 'commodity'],
    shape: 'single',
    params: [
        { key: 'trendPeriod', label: 'Trend filter', help: 'Hold only while price is above this moving average. The entry rule is deliberately trivial — sizing is the point.', type: 'int', min: 10, max: 400, default: 100 },
        { key: 'atrPeriod', label: 'Volatility window', help: 'Bars used to measure how much this instrument moves.', type: 'int', min: 5, max: 100, default: 20 },
        { key: 'targetVol', label: 'Target volatility', help: 'Percent of equity you want a typical bar to move. Lower means smaller positions in violent instruments.', type: 'pct', min: 0.1, max: 10, step: 0.1, default: 1 },
        { key: 'maxSize', label: 'Maximum size', help: 'Cap on position size as a percent of equity, since a very calm instrument would otherwise demand leverage.', type: 'pct', min: 5, max: 100, default: 60 },
    ],
    warmup: (params) => Math.max(num(params, 'trendPeriod', 100), num(params, 'atrPeriod', 20)) + 2,

    onBar(ctx): Action {
        const trend = ctx.ind.sma(num(ctx.params, 'trendPeriod', 100));
        const atr = ctx.ind.atr(num(ctx.params, 'atrPeriod', 20));
        const price = ctx.close(0);
        if (trend == null || atr == null || price == null || atr <= 0 || price <= 0) return HOLD;

        if (ctx.position) {
            if (price < trend) return { kind: 'exit', reason: 'fell below the trend filter' };
            return HOLD;
        }
        // Strictly above, not at. On a flat market price EQUALS its own average, and
        // `>=` would treat that as an uptrend and buy on no information at all.
        if (price > trend) {
            // Size so that a one-ATR move is worth `targetVol` percent of equity. A
            // violent instrument therefore gets a small position and a calm one a large
            // position, for the same contribution to portfolio risk.
            const atrPct = (atr / price) * 100;
            const target = num(ctx.params, 'targetVol', 1);
            const sizePct = Math.min(num(ctx.params, 'maxSize', 60), (target / atrPct) * 100);
            if (!(sizePct > 0) || !Number.isFinite(sizePct)) return HOLD;
            return {
                kind: 'enter',
                side: 'buy',
                sizing: equityPct(sizePct),
                reason: `above trend; sized to ${sizePct.toFixed(0)}% for ${atrPct.toFixed(2)}% volatility`,
            };
        }
        return HOLD;
    },

    explain: {
        idea: 'The entry rule here is intentionally the simplest possible — hold while above a moving average — so that everything interesting is in the sizing. Position size is set inversely to recent volatility, so that a typical bar moves the account by roughly the same amount whatever you are trading. This is what "risk" means to a professional: not the amount invested, but the amount that moves.',
        entry: 'Price above the trend filter, sized so one average true range is worth the target percentage of equity.',
        exit: 'Price closes back below the trend filter.',
        whenItFails: 'Volatility measured on the past underestimates the future at exactly the wrong moments. Markets are calm right up until they are not, so this sizes UP into the quiet period before a shock and is largest when the shock arrives. Every volatility-targeting approach shares that flaw.',
        lesson: 'position-sizing',
    },
    caveats: ['Capped at the maximum size parameter, because an unleveraged account cannot express the small position a very calm instrument implies.'],
};

export const VOLATILITY_STRATEGIES = [vixContrarian, volTargeted];
