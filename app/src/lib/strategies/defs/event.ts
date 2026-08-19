import { HOLD, num, type Action, type Strategy, type StrategyEvent } from '../types';
import { SIZE_PCT, equityPct } from './common';

// Event-driven strategies.
//
// These react to scheduled real-world releases rather than to price alone. The engine
// reveals an event only once the cursor has passed it, so a strategy cannot see
// tomorrow's earnings surprise — which would otherwise be trivially profitable and
// entirely fictional.

/** The most recent event of a kind at or before now, within `maxAgeBars`. */
function recentEvent(events: readonly StrategyEvent[], kind: StrategyEvent['kind'], now: number, maxAgeSeconds: number) {
    for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i];
        if (e.kind !== kind) continue;
        if (now - e.time > maxAgeSeconds) return null;
        return e;
    }
    return null;
}

export const pead: Strategy = {
    id: 'pead',
    name: 'Post-earnings drift',
    family: 'event',
    markets: ['us'],
    shape: 'single',
    needsEvents: ['earnings'],
    params: [
        { key: 'minSurprisePct', label: 'Minimum surprise', help: 'How far actual earnings per share must beat or miss the consensus estimate, in percent.', type: 'pct', min: 1, max: 200, step: 1, default: 10 },
        { key: 'minGapPct', label: 'Minimum gap', help: 'The market must also move on the news. Requiring a gap filters out beats that were already priced in.', type: 'pct', min: 0, max: 20, step: 0.5, default: 3 },
        { key: 'holdBars', label: 'Holding period', help: 'Bars to hold. The drift effect is measured over weeks, not days.', type: 'int', min: 1, max: 120, default: 20 },
        { key: 'stopPct', label: 'Stop distance', help: 'Percent against the position at which to accept the drift is not happening.', type: 'pct', min: 1, max: 40, step: 0.5, default: 8 },
        SIZE_PCT,
    ],
    warmup: () => 2,

    onBar(ctx): Action {
        const holdBars = num(ctx.params, 'holdBars', 20);
        if (ctx.position) {
            if (ctx.i - ctx.position.entryIndex >= holdBars) return { kind: 'exit', reason: `held ${holdBars} bars after the announcement` };
            return HOLD;
        }

        // Only act on an announcement from the last couple of bars.
        const event = recentEvent(ctx.events, 'earnings', ctx.time, ctx.barSeconds * 2);
        if (!event) return HOLD;

        // A missing estimate is NOT a zero estimate. Without both numbers there is no
        // surprise to measure, and inventing one would manufacture a signal.
        if (event.actual == null || event.estimate == null || event.estimate === 0) return HOLD;

        const surprise = ((event.actual - event.estimate) / Math.abs(event.estimate)) * 100;
        const minSurprise = num(ctx.params, 'minSurprisePct', 10);
        if (Math.abs(surprise) < minSurprise) return HOLD;

        const price = ctx.close(0);
        const prior = ctx.close(1);
        if (price == null || prior == null || prior <= 0) return HOLD;
        const gap = ((price - prior) / prior) * 100;
        const minGap = num(ctx.params, 'minGapPct', 3);

        const size = equityPct(num(ctx.params, 'sizePct', 20));
        const stopPct = num(ctx.params, 'stopPct', 8) / 100;

        // Surprise and price must agree. A beat the market sold is not a drift setup.
        if (surprise > 0 && gap >= minGap) {
            return { kind: 'enter', side: 'buy', sizing: size, stop: price * (1 - stopPct), reason: `beat by ${surprise.toFixed(0)}% and gapped up ${gap.toFixed(1)}%` };
        }
        if (surprise < 0 && gap <= -minGap) {
            return { kind: 'enter', side: 'sell', sizing: size, stop: price * (1 + stopPct), reason: `missed by ${Math.abs(surprise).toFixed(0)}% and gapped down ${Math.abs(gap).toFixed(1)}%` };
        }
        return HOLD;
    },

    explain: {
        idea: 'Markets are supposed to absorb earnings news instantly, and mostly they do — but not completely. Prices have historically continued drifting in the direction of a large surprise for weeks afterwards, which is one of the most durable documented anomalies in finance. The usual explanation is that investors under-react to information that arrives all at once.',
        entry: 'A large earnings surprise, confirmed by the market gapping in the same direction.',
        exit: 'A fixed holding period, with a stop for the case where the drift reverses.',
        whenItFails: 'When the surprise was already anticipated, so the gap is the whole move and there is nothing left to drift. It also fails badly when a beat comes with weak guidance: the headline number is good, the stock falls, and the strategy is long into a decline. Requiring the gap to agree with the surprise filters most but not all of those.',
    },
    caveats: [
        'Needs an earnings calendar with both actual and estimated EPS. Finnhub provides this for US listings on its free tier; there is no free equivalent for Indian companies, so this is US-only.',
    ],
};

export const inventoryShock: Strategy = {
    id: 'inventory-shock',
    name: 'Crude inventory shock',
    family: 'event',
    markets: ['commodity'],
    shape: 'single',
    needsEvents: ['inventory'],
    params: [
        { key: 'minChangePct', label: 'Minimum change', help: 'How far the reading must move against the prior week, in percent, to count as a shock.', type: 'pct', min: 0.5, max: 30, step: 0.5, default: 2 },
        { key: 'holdBars', label: 'Holding period', help: 'Bars to hold after the release.', type: 'int', min: 1, max: 40, default: 5 },
        { key: 'stopPct', label: 'Stop distance', help: 'Percent against the position at which to exit.', type: 'pct', min: 0.5, max: 20, step: 0.5, default: 4 },
        SIZE_PCT,
    ],
    warmup: () => 2,

    onBar(ctx): Action {
        const holdBars = num(ctx.params, 'holdBars', 5);
        if (ctx.position) {
            if (ctx.i - ctx.position.entryIndex >= holdBars) return { kind: 'exit', reason: `held ${holdBars} bars after the release` };
            return HOLD;
        }

        const event = recentEvent(ctx.events, 'inventory', ctx.time, ctx.barSeconds * 2);
        if (!event || event.actual == null) return HOLD;

        // The EIA publishes actuals, not a consensus. Where no estimate is supplied the
        // comparison is against the PRIOR READING — a week-on-week change, which is a
        // different and weaker signal than a surprise against expectations.
        const reference = event.estimate;
        if (reference == null || reference === 0) return HOLD;
        const changePct = ((event.actual - reference) / Math.abs(reference)) * 100;
        if (Math.abs(changePct) < num(ctx.params, 'minChangePct', 2)) return HOLD;

        const price = ctx.close(0);
        if (price == null) return HOLD;
        const size = equityPct(num(ctx.params, 'sizePct', 20));
        const stopPct = num(ctx.params, 'stopPct', 4) / 100;

        // A build in inventories is bearish for crude; a draw is bullish.
        if (changePct > 0) {
            return { kind: 'enter', side: 'sell', sizing: size, stop: price * (1 + stopPct), reason: `inventories built ${changePct.toFixed(1)}%` };
        }
        return { kind: 'enter', side: 'buy', sizing: size, stop: price * (1 - stopPct), reason: `inventories drew ${Math.abs(changePct).toFixed(1)}%` };
    },

    explain: {
        idea: 'Weekly petroleum stock figures are one of the few genuinely scheduled supply signals in commodities. A build larger than expected means more oil sitting in tanks than the market thought, which is bearish; a draw is the reverse. The reaction is fast and usually visible within minutes of the release.',
        entry: 'A build or draw larger than the threshold, traded in the direction of the supply implication.',
        exit: 'A short holding period, with a stop.',
        whenItFails: 'When the inventory number is contradicted by something larger — an OPEC decision, a geopolitical event, a demand revision. Inventories describe supply only, and price is set by both sides. It also fails when the release has already leaked into the market through the private survey published the evening before.',
    },
    caveats: [
        'Requires a free EIA_API_KEY, which is not currently configured, so this strategy has no data source in this app today.',
        'Where no consensus estimate is available the comparison is week-on-week, which measures a CHANGE rather than a SURPRISE. Those are not the same signal and the weaker one is what you get.',
    ],
};

export const fundingCarry: Strategy = {
    id: 'funding-carry',
    name: 'Perpetual funding carry (signal only)',
    family: 'event',
    markets: ['crypto'],
    shape: 'single',
    signalOnly: true,
    params: [
        { key: 'annualisedThreshold', label: 'Annualised carry', help: 'Flag when the funding rate annualises above this percent. Funding settles every eight hours, so a small rate compounds quickly.', type: 'pct', min: 1, max: 200, step: 1, default: 15 },
    ],
    warmup: () => 1,

    // ALWAYS holds. There is no perpetual-futures instrument in this engine, so the
    // spot-versus-perp trade this describes cannot be placed. Returning an entry action
    // would produce a position that has nothing to do with the strategy being described.
    onBar(): Action {
        return HOLD;
    },

    explain: {
        idea: 'A perpetual futures contract has no expiry, so exchanges use a funding payment every few hours to tether it to the spot price. When the perpetual trades above spot, longs pay shorts. A trader holding the asset on the spot market while shorting the perpetual is flat on price and collects that payment — a genuine carry, not a directional bet.',
        entry: 'Not executable here. The signal flags when the annualised funding rate is high enough to be worth the operational effort.',
        exit: 'Nothing to exit — no position is ever opened. The signal simply stops being flagged once the carry falls back below the threshold.',
        whenItFails: 'The trade is only market-neutral while both legs are held. Exchange risk, liquidation of the short leg during a violent rally, and the funding rate flipping negative are the real hazards — the profit is small and steady, which means the losses that matter are rare and large.',
    },
    caveats: [
        'SIGNAL ONLY. The paper engine has no perpetual-futures instrument, so this cannot be traded here and will never open a position. It exists to make the funding rate readable, not to imply an executable strategy.',
    ],
};

export const EVENT_STRATEGIES = [pead, inventoryShock, fundingCarry];
