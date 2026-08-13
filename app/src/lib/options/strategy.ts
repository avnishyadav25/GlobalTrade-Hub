import type { Candle } from '@/lib/mockData';
import type { Params, ParamSpec, Explain } from '@/lib/strategies/types';
import type { ChainView, Quote } from './chainView';
import type { OptionType } from './greeks';

// The options strategy contract.
//
// WHY THIS IS NOT THE EQUITY `Strategy` INTERFACE, and why forcing it in would have been
// the wrong call: an equity strategy holds one signed quantity of one symbol. An iron
// condor is ONE position made of four strikes that must open and close together, and
// whose risk is a property of the set rather than of any leg. `PositionView` cannot hold
// that, and `Action.enter` cannot express it.
//
// So this is a sibling contract, sharing ParamSpec and Explain so the same parameter
// form and the same teaching copy work for both.

export interface LegSpec {
    strike: number;
    optionType: OptionType;
    side: 'buy' | 'sell';
    /** Lots, not units. The runner multiplies by the contract's lot size. */
    lots: number;
}

export type OptionsAction =
    | { kind: 'hold' }
    | { kind: 'open'; legs: LegSpec[]; reason: string }
    | { kind: 'close'; reason: string }
    /** Adjust an open structure — used by gamma scalping to rebalance delta. */
    | { kind: 'adjust'; legs: LegSpec[]; reason: string };

export interface OpenLeg extends LegSpec {
    /** Premium per unit at open. */
    entryPrice: number;
}

export interface OpenStructure {
    legs: OpenLeg[];
    /** Bar index the structure was opened on. */
    openedAt: number;
    /** Net premium per lot at open. Negative is a debit paid, positive a credit taken. */
    netCredit: number;
    /** Underlying level at open, for delta-rebalancing strategies. */
    spotAtOpen: number;
}

export interface OptionsContext {
    chain: ChainView;
    /** Bar index in the underlying series. */
    readonly i: number;
    readonly time: number;
    /** Underlying bar `back` bars ago, for regime filters. */
    bar(back?: number): Candle | undefined;
    close(back?: number): number | undefined;
    /** Realised volatility of the underlying, annualised. Null when unmeasurable. */
    realisedVol: number | null;
    position: OpenStructure | null;
    equity: number;
    params: Params;
    /** Bars remaining until this chain's expiry. */
    barsToExpiry: number;
}

export interface OptionsStrategy {
    id: string;
    name: string;
    family: 'options';
    params: ParamSpec[];
    explain: Explain;
    caveats?: string[];
    /** Bars of underlying history needed before the strategy can act. */
    warmup(p: Params): number;
    onChain(ctx: OptionsContext): OptionsAction;
}

const HOLD: OptionsAction = { kind: 'hold' };
const num = (p: Params, k: string, d: number) => {
    const v = Number(p[k]);
    return Number.isFinite(v) ? v : d;
};

/** Shared: close when the structure has run its course on time or on profit. */
function timeAndProfitExit(ctx: OptionsContext, targetPct: number, stopPct: number, closeAtBars: number): OptionsAction | null {
    const pos = ctx.position;
    if (!pos) return null;

    if (ctx.barsToExpiry <= closeAtBars) {
        // Gamma explodes into expiry — a short structure that was comfortable all month
        // becomes uncontrollable in the last days. Leaving is the whole risk control.
        return { kind: 'close', reason: `Within ${closeAtBars} bars of expiry — gamma risk is no longer worth the remaining premium.` };
    }

    const now = markStructure(pos, ctx.chain);
    if (now === null) return null;

    // For a credit structure, profit is the credit shrinking. For a debit, the reverse.
    const pnl = pos.netCredit - now;
    const risk = Math.abs(pos.netCredit) || 1;

    if (pnl >= risk * targetPct) return { kind: 'close', reason: `Captured ${(targetPct * 100).toFixed(0)}% of the opening credit.` };
    if (pnl <= -risk * stopPct) return { kind: 'close', reason: `Lost ${(stopPct * 100).toFixed(0)}% of the opening credit — the structure has moved against the range it assumed.` };
    return null;
}

/**
 * Current net value of a structure, per lot, at chain prices.
 *
 * Returns null when any leg has no quote. Marking a four-leg structure from three legs
 * would silently understate the risk of the one that vanished, which on a condor is
 * precisely the leg that has gone wrong.
 */
export function markStructure(pos: OpenStructure, chain: ChainView): number | null {
    let net = 0;
    for (const leg of pos.legs) {
        const side = leg.optionType === 'CE' ? chain.at(leg.strike)?.call : chain.at(leg.strike)?.put;
        if (!side) return null;
        net += (leg.side === 'sell' ? 1 : -1) * side.price * leg.lots;
    }
    return net;
}

/** Net credit (positive) or debit (negative) per lot for a proposed set of legs. */
export function netCreditOf(legs: LegSpec[], chain: ChainView): number | null {
    let net = 0;
    for (const leg of legs) {
        const side = leg.optionType === 'CE' ? chain.at(leg.strike)?.call : chain.at(leg.strike)?.put;
        if (!side) return null;
        net += (leg.side === 'sell' ? 1 : -1) * side.price * leg.lots;
    }
    return net;
}

const SIZE: ParamSpec = {
    key: 'lots', label: 'Lots', help: 'Contracts per leg. One NIFTY lot is 65 units.',
    type: 'int', min: 1, max: 20, default: 1,
};
const TARGET: ParamSpec = {
    key: 'targetPct', label: 'Take profit at', help: 'Close once this share of the opening credit has been captured.',
    type: 'pct', min: 10, max: 90, step: 5, default: 50,
};
const STOP: ParamSpec = {
    key: 'stopPct', label: 'Stop at', help: 'Close once the loss reaches this multiple of the opening credit. Short options need a stop that is a MULTIPLE, not a fraction.',
    type: 'pct', min: 50, max: 400, step: 25, default: 200,
};
const CLOSE_BY: ParamSpec = {
    key: 'closeAtBars', label: 'Close within', help: 'Bars before expiry to flatten regardless. Gamma is unmanageable in the final sessions.',
    type: 'int', min: 0, max: 10, default: 2,
};

/* ------------------------------------------------------------------ 1. straddle */

export const shortStraddle: OptionsStrategy = {
    id: 'short-straddle',
    name: 'Short straddle',
    family: 'options',
    params: [
        SIZE, TARGET, STOP, CLOSE_BY,
        { key: 'minIv', label: 'Only sell above IV', help: 'Refuse to sell when implied volatility is below this. Selling cheap volatility is taking the same unlimited risk for less money.', type: 'pct', min: 5, max: 60, step: 1, default: 12 },
        { key: 'ivPremium', label: 'IV over realised', help: 'Require implied volatility to exceed recent realised by this much. This is the actual edge being claimed — without it the trade is a coin flip with a tail.', type: 'pct', min: 0, max: 20, step: 1, default: 2 },
    ],
    warmup: () => 25,

    onChain(ctx) {
        if (ctx.position) {
            return timeAndProfitExit(ctx, num(ctx.params, 'targetPct', 50) / 100, num(ctx.params, 'stopPct', 200) / 100, num(ctx.params, 'closeAtBars', 2)) ?? HOLD;
        }
        if (ctx.barsToExpiry <= num(ctx.params, 'closeAtBars', 2) + 1) return HOLD;

        const iv = ctx.chain.atmIv();
        if (iv == null) return HOLD;
        if (iv * 100 < num(ctx.params, 'minIv', 12)) return HOLD;

        // The edge, stated as a condition rather than assumed: implied must exceed
        // realised. Selling volatility when implied is BELOW realised is selling
        // insurance for less than the claims cost.
        if (ctx.realisedVol == null) return HOLD;
        if ((iv - ctx.realisedVol) * 100 < num(ctx.params, 'ivPremium', 2)) return HOLD;

        const atm = ctx.chain.atm();
        if (!atm?.call || !atm?.put) return HOLD;

        const lots = num(ctx.params, 'lots', 1);
        return {
            kind: 'open',
            legs: [
                { strike: atm.strike, optionType: 'CE', side: 'sell', lots },
                { strike: atm.strike, optionType: 'PE', side: 'sell', lots },
            ],
            reason: `Implied ${(iv * 100).toFixed(1)}% against realised ${(ctx.realisedVol * 100).toFixed(1)}% — selling the at-the-money straddle.`,
        };
    },

    explain: {
        idea: 'Sell the at-the-money call and put together, collecting both premiums. The position profits when the underlying stays near the strike and implied volatility falls. It is a bet that the market is charging more for movement than movement will turn out to cost.',
        entry: 'Implied volatility above a floor AND above recent realised volatility, with enough time left that gamma is still manageable.',
        exit: 'A share of the credit captured, a multiple of it lost, or the approach of expiry — whichever comes first.',
        whenItWorks: 'Quiet markets that have been pricing in movement they do not deliver — the gap between implied and realised volatility, which is positive more often than not because buyers of protection systematically overpay for it. Time works for the position every single day it is open, which is the only Greek with a certain direction.',
        whenItFails: 'A large move in either direction. Losses are unbounded on the call side, and they arrive fastest exactly when volatility is rising, so the position is losing on direction and on vega at the same time. This is the structure that has ended the most retail accounts, and it wins most of the time right up until it does not.',
    },
    caveats: [
        'UNLIMITED LOSS on the call side. The margin model here is an approximation, not SPAN, and a real broker will require more.',
        'Wins frequently and loses rarely and enormously. A high win rate here is a property of the payoff shape, not evidence of skill.',
    ],
};

/* --------------------------------------------------------------- 2. iron condor */

export const ironCondor: OptionsStrategy = {
    id: 'iron-condor',
    name: 'Iron condor',
    family: 'options',
    params: [
        SIZE, TARGET, STOP, CLOSE_BY,
        { key: 'shortDelta', label: 'Short strike delta', help: 'Sell the strikes nearest this delta. Lower is further out, safer, and pays less.', type: 'float', min: 0.05, max: 0.45, step: 0.05, default: 0.2 },
        { key: 'wingSteps', label: 'Wing width', help: 'How many strikes beyond the short leg to buy protection. This is what makes the risk defined.', type: 'int', min: 1, max: 10, default: 2 },
    ],
    warmup: () => 25,

    onChain(ctx) {
        if (ctx.position) {
            return timeAndProfitExit(ctx, num(ctx.params, 'targetPct', 50) / 100, num(ctx.params, 'stopPct', 200) / 100, num(ctx.params, 'closeAtBars', 2)) ?? HOLD;
        }
        if (ctx.barsToExpiry <= num(ctx.params, 'closeAtBars', 2) + 1) return HOLD;

        const delta = num(ctx.params, 'shortDelta', 0.2);
        const shortCall = ctx.chain.byDelta(delta, 'CE');
        const shortPut = ctx.chain.byDelta(delta, 'PE');
        if (!shortCall || !shortPut) return HOLD;

        const steps = Math.max(1, Math.round(num(ctx.params, 'wingSteps', 2)));
        const longCall = strikeStepsFrom(ctx.chain, shortCall, steps, 'CE');
        const longPut = strikeStepsFrom(ctx.chain, shortPut, steps, 'PE');
        // Without both wings this is a strangle, not a condor — a completely different
        // risk profile under the same name. Refuse rather than degrade.
        if (!longCall || !longPut) return HOLD;

        const lots = num(ctx.params, 'lots', 1);
        return {
            kind: 'open',
            legs: [
                { strike: shortCall.strike, optionType: 'CE', side: 'sell', lots },
                { strike: longCall.strike, optionType: 'CE', side: 'buy', lots },
                { strike: shortPut.strike, optionType: 'PE', side: 'sell', lots },
                { strike: longPut.strike, optionType: 'PE', side: 'buy', lots },
            ],
            reason: `Selling the ${(delta * 100).toFixed(0)}-delta strangle at ${shortPut.strike}/${shortCall.strike}, protected ${steps} strikes out.`,
        };
    },

    explain: {
        idea: 'Sell an out-of-the-money call spread and an out-of-the-money put spread at once. The position profits if the underlying stays between the short strikes, and the bought wings cap the loss if it does not.',
        entry: 'Short strikes near a chosen delta, with wings a fixed number of strikes beyond.',
        exit: 'A share of the credit captured, a multiple of it lost, or the approach of expiry.',
        whenItWorks: 'Range-bound markets, with a loss that is capped rather than unbounded. The bought wings are what make the position survivable: the same view expressed as a naked strangle has no ceiling, and the difference between those two is whether one bad week ends the account or costs a known amount.',
        whenItFails: 'A move through either short strike. The maximum loss is typically several times the maximum gain, so a strategy that wins nine times in ten can still lose money over a year. Defined risk is not small risk.',
    },
    caveats: [
        'Four legs means four spreads and four sets of charges to open, and again to close. In a thin chain those costs can exceed the credit.',
        'Margin is computed PER LEG here. A real broker gives a spread benefit this simulator does not model, so the requirement shown is conservative.',
    ],
};

/** Walk `steps` strikes further out of the money from a given quote. */
function strikeStepsFrom(chain: ChainView, from: Quote, steps: number, type: OptionType): Quote | undefined {
    const i = chain.strikes.findIndex((s) => Math.abs(s.strike - from.strike) < 1e-9);
    if (i < 0) return undefined;
    const target = type === 'CE' ? i + steps : i - steps;
    const s = chain.strikes[target];
    const side = type === 'CE' ? s?.call : s?.put;
    return s && side ? { strike: s.strike, optionType: type, price: side.price, iv: side.iv, delta: side.delta } : undefined;
}

/* ------------------------------------------------------------ 3. gamma scalping */

export const gammaScalp: OptionsStrategy = {
    id: 'gamma-scalp',
    name: 'Gamma scalping',
    family: 'options',
    params: [
        SIZE, CLOSE_BY,
        { key: 'maxIv', label: 'Only buy below IV', help: 'Refuse to buy volatility above this. The whole trade is buying movement for less than it costs.', type: 'pct', min: 5, max: 60, step: 1, default: 14 },
        { key: 'ivDiscount', label: 'IV under realised', help: 'Require implied to sit this far BELOW realised before buying. This is the claimed edge.', type: 'pct', min: 0, max: 20, step: 1, default: 2 },
        { key: 'rebalanceMove', label: 'Rebalance after', help: 'Underlying move, in percent, that triggers a delta rebalance. Smaller captures more and pays more in costs.', type: 'pct', min: 0.2, max: 5, step: 0.1, default: 1 },
    ],
    warmup: () => 25,

    onChain(ctx) {
        const closeBy = num(ctx.params, 'closeAtBars', 2);

        if (ctx.position) {
            if (ctx.barsToExpiry <= closeBy) {
                return { kind: 'close', reason: 'Approaching expiry — a long straddle is nearly all time value by now and it decays fastest here.' };
            }
            // Rebalance on a move. This is the actual mechanism: a long straddle gains
            // delta as price moves, and trading it back to flat banks the movement.
            const move = Math.abs(ctx.chain.spot - ctx.position.spotAtOpen) / ctx.position.spotAtOpen;
            if (move * 100 >= num(ctx.params, 'rebalanceMove', 1)) {
                return { kind: 'adjust', legs: ctx.position.legs, reason: `Underlying moved ${(move * 100).toFixed(2)}% — rebalancing delta back to flat and banking the movement.` };
            }
            return HOLD;
        }

        if (ctx.barsToExpiry <= closeBy + 1) return HOLD;

        const iv = ctx.chain.atmIv();
        if (iv == null || ctx.realisedVol == null) return HOLD;
        if (iv * 100 > num(ctx.params, 'maxIv', 14)) return HOLD;
        // Buying volatility only makes sense when it is cheap relative to what the
        // underlying is actually doing. Without this the position just pays theta.
        if ((ctx.realisedVol - iv) * 100 < num(ctx.params, 'ivDiscount', 2)) return HOLD;

        const atm = ctx.chain.atm();
        if (!atm?.call || !atm?.put) return HOLD;

        const lots = num(ctx.params, 'lots', 1);
        return {
            kind: 'open',
            legs: [
                { strike: atm.strike, optionType: 'CE', side: 'buy', lots },
                { strike: atm.strike, optionType: 'PE', side: 'buy', lots },
            ],
            reason: `Implied ${(iv * 100).toFixed(1)}% below realised ${(ctx.realisedVol * 100).toFixed(1)}% — buying the straddle to scalp its gamma.`,
        };
    },

    explain: {
        idea: 'Buy an at-the-money straddle and trade the underlying against it as price moves. A long option gains delta in the direction of the move, so repeatedly flattening that delta banks each swing. The position is long gamma and short theta: it is paid by movement and charged by time.',
        entry: 'Implied volatility below recent realised, with enough time left that decay is not yet dominant.',
        exit: 'Approach of expiry, where theta accelerates and the remaining time value is small.',
        whenItWorks: 'Markets moving more than their options are priced for. It is the mirror of the straddle seller and the rarer opportunity, because implied volatility usually exceeds realised — when it does not, the position is paid by every swing and the rebalances bank movement the option price did not charge for.',
        whenItFails: 'A quiet market. Theta is charged every day whatever happens, so a straddle bought before a week of calm loses steadily and the scalps never cover it. It also fails when implied volatility falls after entry — the position is long vega as well as long gamma.',
    },
    caveats: [
        'THE HEDGING LEG IS NOT MODELLED. Real gamma scalping requires trading the underlying against the straddle; this simulator has no NIFTY spot instrument, so the rebalances are signalled and not executed. The result therefore shows the straddle alone, which is NOT the strategy.',
        'Rebalancing frequently is what generates the profit and what generates the costs. A backtest that ignores those costs describes a strategy nobody can run.',
    ],
};

/* ------------------------------------------------------------------- 4. IV skew */

export const ivSkew: OptionsStrategy = {
    id: 'iv-skew',
    name: 'IV skew reversion',
    family: 'options',
    params: [
        SIZE, TARGET, STOP, CLOSE_BY,
        { key: 'wingDelta', label: 'Wing delta', help: 'Which strikes to compare. 0.25 means the 25-delta put against the 25-delta call.', type: 'float', min: 0.1, max: 0.4, step: 0.05, default: 0.25 },
        { key: 'skewThreshold', label: 'Skew above', help: 'Trade when put implied volatility exceeds call implied volatility by more than this. Some skew is permanent; only the excess is a signal.', type: 'pct', min: 1, max: 20, step: 0.5, default: 5 },
    ],
    warmup: () => 25,

    onChain(ctx) {
        if (ctx.position) {
            return timeAndProfitExit(ctx, num(ctx.params, 'targetPct', 50) / 100, num(ctx.params, 'stopPct', 200) / 100, num(ctx.params, 'closeAtBars', 2)) ?? HOLD;
        }
        if (ctx.barsToExpiry <= num(ctx.params, 'closeAtBars', 2) + 1) return HOLD;

        const wing = num(ctx.params, 'wingDelta', 0.25);
        const put = ctx.chain.byDelta(wing, 'PE');
        const call = ctx.chain.byDelta(wing, 'CE');
        if (!put?.iv || !call?.iv) return HOLD;

        // Equity index skew is PERMANENTLY positive — out-of-the-money puts always cost
        // more, because the market genuinely prices crash risk. Only the excess over
        // that baseline is a signal, which is why the threshold is not zero.
        const skew = (put.iv - call.iv) * 100;
        if (skew < num(ctx.params, 'skewThreshold', 5)) return HOLD;

        const lots = num(ctx.params, 'lots', 1);
        return {
            kind: 'open',
            legs: [
                { strike: put.strike, optionType: 'PE', side: 'sell', lots },
                { strike: call.strike, optionType: 'CE', side: 'buy', lots },
            ],
            reason: `Put IV ${(put.iv * 100).toFixed(1)}% against call IV ${(call.iv * 100).toFixed(1)}% — a ${skew.toFixed(1)} point skew, selling the expensive side.`,
        };
    },

    explain: {
        idea: 'Out-of-the-money puts on an equity index almost always carry higher implied volatility than the equivalent calls, because the market pays up for crash protection. This sells the expensive wing and buys the cheap one when the gap between them widens beyond its usual level.',
        entry: 'Put implied volatility exceeding call implied volatility at the same delta by more than a threshold.',
        exit: 'A share of the credit captured, a stop, or the approach of expiry.',
        whenItWorks: 'Periods when crash protection has become unusually expensive relative to upside — after a scare rather than during one. Selling the wing the market is crowding into is a genuine liquidity provision, and index skew does mean-revert once the fear that widened it fades.',
        whenItFails: 'Precisely when the skew was right. The gap widens because the market is pricing a crash, and selling that protection immediately before one is how the trade loses many times what it collected. Skew is not usually mispriced — it is compensation for a real and asymmetric risk.',
    },
    caveats: [
        'This is short the crash. The skew exists because index crashes are real and asymmetric, so most of the time the gap is a fair price rather than an error.',
        'The short put leg carries large, though bounded, loss — the index can only fall to zero, which is not much comfort.',
    ],
};

export const OPTIONS_STRATEGIES: OptionsStrategy[] = [shortStraddle, ironCondor, gammaScalp, ivSkew];

export function optionsStrategyById(id: string): OptionsStrategy | undefined {
    return OPTIONS_STRATEGIES.find((s) => s.id === id);
}
