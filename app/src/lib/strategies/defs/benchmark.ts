import { HOLD, num, type Action, type Strategy } from '../types';
import { SIZE_PCT, equityPct } from './common';

// The reference every other strategy is measured against.
//
// Without it, "+8% over the period" is unreadable: excellent if the instrument fell 20%,
// poor if it doubled. The backtester also computes a buy-and-hold benchmark internally
// on every run — this exists so buy-and-hold can be selected, charted and compared like
// any other strategy, using exactly the same execution and cost model.

export const buyAndHold: Strategy = {
    id: 'buy-and-hold',
    name: 'Buy and hold',
    family: 'benchmark',
    markets: ['crypto', 'india', 'us', 'forex', 'commodity'],
    shape: 'single',
    // 100% by default: a scaled-down benchmark is not a benchmark.
    params: [{ ...SIZE_PCT, default: 100 }],
    warmup: () => 0,

    onBar(ctx): Action {
        if (ctx.position) return HOLD;
        return {
            kind: 'enter',
            side: 'buy',
            sizing: equityPct(num(ctx.params, 'sizePct', 100)),
            reason: 'bought at the start of the period and held',
        };
    },

    explain: {
        idea: 'Buy once, never sell. It is not a trading strategy — it is the bar every trading strategy has to clear. Over long horizons it beats the large majority of active approaches, largely because it pays costs twice in total rather than twice per trade.',
        entry: 'The first bar of the period.',
        exit: 'The last bar of the period, forced by the engine so the trade list reconciles with the equity curve.',
        whenItWorks: 'Whenever the asset appreciates over your holding period, which for broad equity has been most multi-year windows in history. Its real edge is structural rather than predictive: it pays two sets of charges in total instead of two per trade, it never mistimes a re-entry, and it cannot be talked out of a position during a drawdown. Most active strategies lose to it on costs and behaviour long before they lose on ideas.',
        whenItFails: 'It takes the full drawdown, whatever that turns out to be. A strategy that returns less than buy-and-hold but suffers half the drawdown may well be the better one to actually live with — compare both numbers, not just the return.',
        lesson: 'journal-and-discipline',
    },
    caveats: ['Uses 100% of equity by default, which is what makes it a fair benchmark rather than a scaled-down version of one.'],
};

export const BENCHMARK_STRATEGIES = [buyAndHold];
