import type { Candle } from '@/lib/mockData';
import { chargesFor } from '@/lib/charges';
import { sanitiseParams } from '@/lib/strategies/types';
import type { Params } from '@/lib/strategies/types';
import { buildChainView, type ChainView } from './chainView';
import { realisedVol, syntheticChainAt, SYNTHETIC_WARNING, type SyntheticOptions } from './syntheticChain';
import { markStructure, netCreditOf, type OptionsStrategy, type OpenStructure, type LegSpec } from './strategy';
import { intrinsic } from './greeks';

// Running an options strategy over a series of chains.
//
// A separate engine from `strategies/backtest.ts` on purpose. That one holds one signed
// quantity of one symbol; a condor is one position made of four strikes that open and
// close together, and whose P&L is a property of the set. Bolting legs onto the
// single-instrument position model would have produced something that looked like it
// worked and mispriced every multi-leg result.
//
// EXECUTION SEMANTICS, matching the equity backtester so results are comparable:
//   - the strategy sees the chain at bar i and acts on bar i
//   - structures are marked at chain prices each bar
//   - at expiry every leg settles at INTRINSIC value, which is what a European
//     cash-settled option does
//   - charges are the real options schedule: flat ₹20 per order per leg, STT on the
//     sell side on premium, and settlement STT on intrinsic

export interface ChainBar {
    /** Index into the underlying series this chain belongs to. */
    barIndex: number;
    chain: ChainView;
    /** Bars remaining until this chain's expiry. */
    barsToExpiry: number;
}

export interface OptionsTrade {
    openedAt: number;
    closedAt: number;
    legs: LegSpec[];
    /** Per lot, at open. Positive is a credit received. */
    netCredit: number;
    /** Per lot, at close. */
    netClose: number;
    /** Base currency, after charges. */
    pnl: number;
    charges: number;
    reason: string;
    /** True when the structure ran to expiry rather than being closed. */
    settled: boolean;
}

export interface OptionsBacktestResult {
    trades: OptionsTrade[];
    equity: number[];
    finalValue: number;
    netPct: number;
    maxDD: number;
    wins: number;
    losses: number;
    charges: number;
    /** Present when any chain used was modelled rather than historical. */
    synthetic: boolean;
    warnings: string[];
    /** Statistics withheld because the sample cannot support them. */
    suppressed: string[];
}

export interface OptionsBacktestConfig {
    strategy: OptionsStrategy;
    params?: Params;
    /** Underlying bars. Chains are aligned to these by index. */
    bars: Candle[];
    chains: ChainBar[];
    lotSize: number;
    startingCapital: number;
    barsPerYear?: number;
}

/** Below this, ratio statistics are noise. Same threshold the equity engine uses. */
const MIN_TRADES_FOR_STATS = 30;

function chargeFor(legs: LegSpec[], prices: number[], lotSize: number, settling: boolean): number {
    let total = 0;
    for (let i = 0; i < legs.length; i++) {
        const notional = Math.abs(prices[i]) * legs[i].lots * lotSize;
        if (notional <= 0) continue;
        total += chargesFor({
            market: 'india',
            side: legs[i].side,
            product: settling ? 'options-settlement' : 'options',
            notionalBase: notional,
            // Each leg is its own order, so each pays the flat brokerage. That is what a
            // four-leg condor actually costs, and it is why the costs matter so much.
            chargeBrokerage: !settling,
            qty: legs[i].lots * lotSize,
        }).total;
    }
    return total;
}

/** Leg prices from a chain, or null when any leg has no quote. */
function priceLegs(legs: LegSpec[], chain: ChainView): number[] | null {
    const out: number[] = [];
    for (const leg of legs) {
        const side = leg.optionType === 'CE' ? chain.at(leg.strike)?.call : chain.at(leg.strike)?.put;
        if (!side) return null;
        out.push(side.price);
    }
    return out;
}

export function runOptionsBacktest(config: OptionsBacktestConfig): OptionsBacktestResult {
    const { strategy, bars, chains, lotSize, startingCapital } = config;
    const params = sanitiseParams(strategy, config.params);
    const barsPerYear = config.barsPerYear ?? 252;

    const trades: OptionsTrade[] = [];
    const equity: number[] = [];
    const warnings: string[] = [];

    let cash = startingCapital;
    let position: OpenStructure | null = null;
    let totalCharges = 0;
    let sawSynthetic = false;

    const byIndex = new Map(chains.map((c) => [c.barIndex, c]));
    const warmup = Math.max(0, Math.floor(strategy.warmup(params)));

    const closeStructure = (pos: OpenStructure, chain: ChainView, at: number, reason: string, settling: boolean) => {
        const prices = settling
            ? pos.legs.map((l) => intrinsic(chain.spot, l.strike, l.optionType))
            : priceLegs(pos.legs, chain);
        if (!prices) return false;

        const netClose = pos.legs.reduce((n, l, i) => n + (l.side === 'sell' ? 1 : -1) * prices[i] * l.lots, 0);
        const charges = chargeFor(pos.legs, prices, lotSize, settling);

        // Credit structures profit when the net shrinks; debit structures when it grows.
        // One expression covers both because netCredit carries the sign.
        const gross = (pos.netCredit - netClose) * lotSize;
        cash += gross - charges;
        totalCharges += charges;

        trades.push({
            openedAt: pos.openedAt, closedAt: at, legs: pos.legs,
            netCredit: pos.netCredit, netClose, pnl: gross - charges, charges, reason, settled: settling,
        });
        return true;
    };

    for (let i = 0; i < bars.length; i++) {
        const cb = byIndex.get(i);

        if (cb) {
            if (cb.chain.synthetic) sawSynthetic = true;

            // Settle first: a structure at expiry cannot be traded, only settled.
            if (position && cb.barsToExpiry <= 0) {
                closeStructure(position, cb.chain, i, 'Expired — settled at intrinsic value.', true);
                position = null;
            }

            if (i >= warmup) {
                const action = strategy.onChain({
                    chain: cb.chain,
                    i,
                    time: bars[i].time,
                    bar: (back = 0) => bars[i - back],
                    close: (back = 0) => bars[i - back]?.close,
                    realisedVol: realisedVol(bars, i, 20, barsPerYear),
                    position,
                    equity: cash,
                    params,
                    barsToExpiry: cb.barsToExpiry,
                });

                if (action.kind === 'open' && !position) {
                    const prices = priceLegs(action.legs, cb.chain);
                    const credit = netCreditOf(action.legs, cb.chain);
                    if (prices && credit !== null) {
                        const charges = chargeFor(action.legs, prices, lotSize, false);
                        cash -= charges;
                        totalCharges += charges;
                        position = {
                            legs: action.legs.map((l, k) => ({ ...l, entryPrice: prices[k] })),
                            openedAt: i,
                            netCredit: credit,
                            spotAtOpen: cb.chain.spot,
                        };
                    }
                } else if (action.kind === 'close' && position) {
                    if (closeStructure(position, cb.chain, i, action.reason, false)) position = null;
                }
                // `adjust` is deliberately inert here — see the gamma-scalp caveat: the
                // hedging leg needs a spot instrument this engine does not have, and
                // pretending to rebalance would report a profit nobody could capture.
            }
        }

        // Mark to market. An open structure is worth its credit less what it now costs
        // to close, so equity moves every bar rather than only on exit.
        let marked = cash;
        if (position && cb) {
            const now = markStructure(position, cb.chain);
            if (now !== null) marked = cash + (position.netCredit - now) * lotSize;
        }
        equity.push(marked);
    }

    if (position) {
        warnings.push('A structure was still open at the end of the series and is excluded from the trade list. Its unrealised value is in the final equity.');
    }

    const finalValue = equity.length ? equity[equity.length - 1] : startingCapital;
    let peak = equity[0] ?? startingCapital;
    let maxDD = 0;
    for (const v of equity) {
        if (v > peak) peak = v;
        if (peak > 0) maxDD = Math.min(maxDD, (v / peak - 1) * 100);
    }

    const suppressed: string[] = [];
    if (trades.length < MIN_TRADES_FOR_STATS) {
        suppressed.push('win rate', 'expectancy');
        warnings.push(
            `${trades.length} trade${trades.length === 1 ? '' : 's'} is below the ${MIN_TRADES_FOR_STATS} needed for a rate to mean anything. A short-volatility structure wins most of the time by construction, so a high win rate from a small sample says nothing at all.`
        );
    }
    if (sawSynthetic) {
        warnings.push(SYNTHETIC_WARNING);

        // A silent zero is the worst possible output here. A synthetic chain prices every
        // strike at the underlying's OWN realised volatility and applies no skew, so
        // implied equals realised and the skew is flat BY CONSTRUCTION. Any strategy whose
        // entry condition is a gap between the two therefore cannot fire — not because the
        // idea is wrong, but because this data has no such gap to find. Reporting "0
        // trades" without saying so reads as "the strategy never triggered", which is a
        // different and much more damning claim.
        if (trades.length === 0) {
            warnings.push(
                'This strategy took NO trades, and on a synthetic chain that is expected rather than informative: implied volatility equals realised and the skew is flat by construction, so any entry condition based on the gap between them can never be met. Testing this idea needs real chain history.'
            );
        }
    }

    return {
        trades,
        equity,
        finalValue,
        netPct: startingCapital > 0 ? (finalValue / startingCapital - 1) * 100 : 0,
        maxDD,
        wins: trades.filter((t) => t.pnl > 0).length,
        losses: trades.filter((t) => t.pnl <= 0).length,
        charges: totalCharges,
        synthetic: sawSynthetic,
        warnings,
        suppressed,
    };
}

/**
 * Build a synthetic chain series over a bar range, expiring every `cycle` bars.
 *
 * Every chain is marked `synthetic: true`, which propagates into the result's warnings.
 * There is no way to produce an unlabelled synthetic run through this path.
 */
export function syntheticChainSeries(bars: Candle[], cycle: number, opts: SyntheticOptions): ChainBar[] {
    const out: ChainBar[] = [];
    for (let expiry = cycle; expiry < bars.length; expiry += cycle) {
        for (let i = expiry - cycle + 1; i <= expiry; i++) {
            const built = syntheticChainAt(bars, i, expiry, opts);
            if (!built) continue;
            out.push({
                barIndex: i,
                barsToExpiry: expiry - i,
                chain: buildChainView({
                    spot: built.spot,
                    years: built.years,
                    synthetic: true,
                    strikes: built.strikes.map((s) => ({ strike: s.strike, call: { price: s.call }, put: { price: s.put } })),
                }),
            });
        }
    }
    return out;
}
