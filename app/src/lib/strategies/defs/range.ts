import { HOLD, num, type Action, type Strategy } from '../types';
import { SIZE_PCT, equityPct } from './common';

// Range trading.
//
// The premise is that price is bounded, so buying the bottom of the band and selling the
// top harvests the oscillation without any view on direction. It works until the range
// breaks, and then it works very badly, because the mechanism that makes money in a
// range is the same mechanism that averages down into a trend.

export const gridTrading: Strategy = {
    id: 'grid-trading',
    name: 'Grid trading',
    family: 'range',
    markets: ['forex', 'crypto'],
    shape: 'single',
    params: [
        { key: 'anchorPeriod', label: 'Anchor window', help: 'Bars used to place the centre of the grid. The grid is rebuilt around this average.', type: 'int', min: 10, max: 300, default: 50 },
        { key: 'stepPct', label: 'Grid spacing', help: 'Distance between levels, as a percent. Tighter fills more often and pays more in costs.', type: 'pct', min: 0.05, max: 5, step: 0.05, default: 0.5 },
        { key: 'levels', label: 'Levels per side', help: 'How many rungs above and below the anchor. Only the nearest unfilled rung is ever resting here.', type: 'int', min: 1, max: 10, default: 3 },
        { key: 'breakoutPct', label: 'Grid boundary', help: 'If price escapes the grid by this much, stop trading it. A grid in a trend is a machine for accumulating losses.', type: 'pct', min: 0.5, max: 30, step: 0.5, default: 4 },
        SIZE_PCT,
    ],
    warmup: (params) => num(params, 'anchorPeriod', 50) + 2,

    onBar(ctx): Action {
        const anchor = ctx.ind.sma(num(ctx.params, 'anchorPeriod', 50));
        const price = ctx.close(0);
        if (anchor == null || price == null || anchor <= 0) return HOLD;

        const step = num(ctx.params, 'stepPct', 0.5) / 100;
        const levels = num(ctx.params, 'levels', 3);
        const breakout = num(ctx.params, 'breakoutPct', 4) / 100;
        const distance = (price - anchor) / anchor;

        // The hard boundary. Without it a grid holds a losing position forever and adds
        // to it — which is how grid accounts are actually lost.
        if (Math.abs(distance) > breakout) {
            return ctx.position
                ? { kind: 'exit', reason: 'price escaped the grid — trend, not range' }
                : HOLD;
        }

        // Take profit one rung back toward the anchor.
        if (ctx.position) {
            const isLong = ctx.position.qty > 0;
            const target = ctx.position.avgPrice * (isLong ? 1 + step : 1 - step);
            if ((isLong && price >= target) || (!isLong && price <= target)) {
                return { kind: 'exit', reason: 'reached the next rung up' };
            }
            return HOLD;
        }

        // Rest at the nearest unfilled rung on the correct side of the anchor.
        const rung = Math.min(levels, Math.max(1, Math.ceil(Math.abs(distance) / step)));
        const size = equityPct(num(ctx.params, 'sizePct', 20));
        if (distance < 0) {
            return { kind: 'rest', side: 'buy', price: anchor * (1 - rung * step), sizing: size, reason: `buy rung ${rung} below the anchor` };
        }
        if (distance > 0) {
            return { kind: 'rest', side: 'sell', price: anchor * (1 + rung * step), sizing: size, reason: `sell rung ${rung} above the anchor` };
        }
        return HOLD;
    },

    explain: {
        idea: 'Place a ladder of buy orders below the current price and sell orders above it, then let the market oscillate through them. Each round trip harvests one rung of movement, and no view about direction is required — only that price keeps crossing the same region. Roughly three-quarters of the time, currency pairs do exactly that.',
        entry: 'A resting limit order at the nearest unfilled rung on the appropriate side of the anchor.',
        exit: 'Take profit one rung back toward the anchor, or exit entirely if price escapes the grid boundary.',
        whenItWorks: 'Range-bound markets that keep crossing the same region — which currency pairs do a large fraction of the time. It needs no view about direction at all, only that price oscillates, and each round trip harvests one rung regardless of which way the market went first.',
        whenItFails: 'A trend. The grid keeps buying as price falls through every rung, each position underwater, and the account carries a growing loss with no mechanism to stop — unless the boundary rule fires. The boundary is not a refinement; it is the only thing standing between this strategy and a margin call.',
    },
    caveats: [
        'The engine holds ONE position at a time, so this rests a single rung rather than a full ladder. A real grid holds many simultaneous positions, and its risk profile is correspondingly different — considerably worse in a trend.',
    ],
};

export const RANGE_STRATEGIES = [gridTrading];
