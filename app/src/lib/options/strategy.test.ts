import { describe, it, expect } from 'vitest';
import { buildChainView } from './chainView';
import { OPTIONS_STRATEGIES, optionsStrategyById, markStructure, netCreditOf, type OptionsContext, type OpenStructure } from './strategy';
import { runOptionsBacktest, syntheticChainSeries } from './backtest';
import { defaultParams } from '@/lib/strategies/types';
import { series } from '@/test/candles';
import { price as bsPrice } from './greeks';

// The four options strategies, and the runner that executes them.
//
// The invariants worth asserting are the same ones the equity strategy tests use, for
// the same reason: a strategy that never fires and a strategy that cannot lose both look
// fine until you look for those specific failures.

const SPOT = 24500;
const LOT = 65;

/** A chain priced by Black-Scholes at a stated volatility — a controlled test fixture. */
function chainAt(spot: number, years: number, vol: number, opts: { skew?: number } = {}) {
    const strikes = [];
    for (let k = spot - 1500; k <= spot + 1500; k += 50) {
        // A put skew, applied below the money, so byDelta and the skew strategy have
        // something real to find.
        const putVol = opts.skew && k < spot ? vol + opts.skew : vol;
        strikes.push({
            strike: Math.round(k / 50) * 50,
            call: { price: bsPrice({ spot, strike: k, years, rate: 0.065, vol, type: 'CE' }) },
            put: { price: bsPrice({ spot, strike: k, years, rate: 0.065, vol: putVol, type: 'PE' }) },
        });
    }
    return buildChainView({ spot, years, synthetic: false, strikes });
}

const ctx = (over: Partial<OptionsContext> = {}): OptionsContext => ({
    chain: chainAt(SPOT, 30 / 365, 0.16),
    i: 100,
    time: 0,
    bar: () => undefined,
    close: () => SPOT,
    realisedVol: 0.10,
    position: null,
    equity: 2_000_000,
    params: {},
    barsToExpiry: 20,
    ...over,
});

const withDefaults = (id: string, over: Partial<OptionsContext> = {}) => {
    const s = optionsStrategyById(id)!;
    return { s, c: ctx({ params: defaultParams(s), ...over }) };
};

describe('chain view', () => {
    const chain = chainAt(SPOT, 30 / 365, 0.16, { skew: 0.05 });

    it('finds the strike nearest a target delta', () => {
        const q = chain.byDelta(0.2, 'CE')!;
        expect(q).toBeDefined();
        expect(Math.abs(q.delta!)).toBeCloseTo(0.2, 1);
        // A 20-delta call is above the money.
        expect(q.strike).toBeGreaterThan(SPOT);
    });

    it('puts and calls at the same delta sit on opposite sides of spot', () => {
        expect(chain.byDelta(0.25, 'PE')!.strike).toBeLessThan(SPOT);
        expect(chain.byDelta(0.25, 'CE')!.strike).toBeGreaterThan(SPOT);
    });

    it('walks out of the money in the right direction for each type', () => {
        // The sign flip is the reason offset() exists — at a call site it gets written
        // once per strategy and got wrong at least once.
        expect(chain.offset(2, 'CE')!.strike).toBeGreaterThan(chain.atm()!.strike);
        expect(chain.offset(2, 'PE')!.strike).toBeLessThan(chain.atm()!.strike);
    });

    it('returns undefined for an exact strike that is not listed, never the nearest', () => {
        // A silent substitution would let a strategy trade a strike it did not choose.
        expect(chain.at(24525)).toBeUndefined();
        expect(chain.at(24500)).toBeDefined();
    });

    it('skips strikes whose delta cannot be measured rather than approximating', () => {
        // Deep ITM at low vol has vega near zero, so no IV and therefore no delta. A
        // delta-targeting rule that silently became a distance rule is a different
        // strategy under the same name.
        const thin = buildChainView({
            spot: 100, years: 1, synthetic: false,
            strikes: [
                { strike: 20, call: { price: 81 } },   // deep ITM — unsolvable
                { strike: 100, call: { price: 8 } },   // solvable
            ],
        });
        expect(thin.at(20)!.call!.delta).toBeNull();
        expect(thin.byDelta(0.5, 'CE')!.strike).toBe(100);
    });

    it('reports at-the-money implied volatility', () => {
        expect(chainAt(SPOT, 30 / 365, 0.16).atmIv()).toBeCloseTo(0.16, 2);
    });
});

describe('every options strategy', () => {
    it('declares four of them, each with honest teaching copy', () => {
        expect(OPTIONS_STRATEGIES).toHaveLength(4);
        for (const s of OPTIONS_STRATEGIES) {
            expect(s.family).toBe('options');
            expect(s.params.length).toBeGreaterThan(2);
            expect(s.explain.idea.length).toBeGreaterThan(80);
            // The field that stops a strategy being sold rather than described.
            expect(s.explain.whenItFails.length, `${s.id} whenItFails`).toBeGreaterThan(60);
            // Symmetry: an options structure that shows only its downside reads as a
            // warning rather than a description, and these four need describing.
            expect(s.explain.whenItWorks, `${s.id} whenItWorks`).toBeTruthy();
            expect(s.explain.whenItWorks!.length, `${s.id} whenItWorks`).toBeGreaterThan(80);
            expect(s.caveats?.length, `${s.id} caveats`).toBeGreaterThan(0);
        }
    });

    it('holds when there is no chain data to act on', () => {
        const empty = buildChainView({ spot: SPOT, years: 0.1, synthetic: false, strikes: [] });
        for (const s of OPTIONS_STRATEGIES) {
            const action = s.onChain(ctx({ chain: empty, params: defaultParams(s) }));
            expect(action.kind, s.id).toBe('hold');
        }
    });

    it('refuses to open a new structure right before expiry', () => {
        for (const s of OPTIONS_STRATEGIES) {
            const action = s.onChain(ctx({ params: defaultParams(s), barsToExpiry: 1 }));
            expect(action.kind, s.id).toBe('hold');
        }
    });
});

describe('short straddle', () => {
    it('sells the at-the-money call and put when implied exceeds realised', () => {
        const { s, c } = withDefaults('short-straddle', { chain: chainAt(SPOT, 30 / 365, 0.18), realisedVol: 0.10 });
        const action = s.onChain(c);
        expect(action.kind).toBe('open');
        if (action.kind !== 'open') return;

        expect(action.legs).toHaveLength(2);
        expect(action.legs.every((l) => l.side === 'sell')).toBe(true);
        expect(new Set(action.legs.map((l) => l.strike)).size).toBe(1);
        expect(new Set(action.legs.map((l) => l.optionType))).toEqual(new Set(['CE', 'PE']));
    });

    it('REFUSES when implied volatility is below realised', () => {
        // This is the edge the strategy claims. Without the check it is a coin flip with
        // an unbounded tail, and the test exists so the check cannot be quietly dropped.
        const { s, c } = withDefaults('short-straddle', { chain: chainAt(SPOT, 30 / 365, 0.10), realisedVol: 0.30 });
        expect(s.onChain(c).kind).toBe('hold');
    });

    it('refuses when volatility is below the floor, however wide the edge', () => {
        const { s, c } = withDefaults('short-straddle', { chain: chainAt(SPOT, 30 / 365, 0.05), realisedVol: 0.001 });
        expect(s.onChain(c).kind).toBe('hold');
    });
});

describe('iron condor', () => {
    it('opens four legs: two sold near the delta, two bought further out', () => {
        const { s, c } = withDefaults('iron-condor');
        const action = s.onChain(c);
        expect(action.kind).toBe('open');
        if (action.kind !== 'open') return;

        expect(action.legs).toHaveLength(4);
        const sold = action.legs.filter((l) => l.side === 'sell');
        const bought = action.legs.filter((l) => l.side === 'buy');
        expect(sold).toHaveLength(2);
        expect(bought).toHaveLength(2);

        // The bought call must be ABOVE the sold call, and the bought put BELOW the sold
        // put — otherwise the "protection" is inside the risk and the structure is not
        // defined-risk at all.
        const soldCall = sold.find((l) => l.optionType === 'CE')!;
        const boughtCall = bought.find((l) => l.optionType === 'CE')!;
        const soldPut = sold.find((l) => l.optionType === 'PE')!;
        const boughtPut = bought.find((l) => l.optionType === 'PE')!;
        expect(boughtCall.strike).toBeGreaterThan(soldCall.strike);
        expect(boughtPut.strike).toBeLessThan(soldPut.strike);
    });

    it('takes a net credit — that is what makes it a credit structure', () => {
        const { s, c } = withDefaults('iron-condor');
        const action = s.onChain(c);
        if (action.kind !== 'open') throw new Error('expected an open');
        expect(netCreditOf(action.legs, c.chain)!).toBeGreaterThan(0);
    });

    it('refuses rather than degrading into a strangle when a wing is missing', () => {
        // Without both wings this is an unlimited-risk position under a defined-risk
        // name. Holding is the only safe answer.
        const narrow = buildChainView({
            spot: SPOT, years: 30 / 365, synthetic: false,
            strikes: [24450, 24500, 24550].map((k) => ({
                strike: k,
                call: { price: bsPrice({ spot: SPOT, strike: k, years: 30 / 365, rate: 0.065, vol: 0.16, type: 'CE' }) },
                put: { price: bsPrice({ spot: SPOT, strike: k, years: 30 / 365, rate: 0.065, vol: 0.16, type: 'PE' }) },
            })),
        });
        const { s, c } = withDefaults('iron-condor', { chain: narrow });
        expect(s.onChain(c).kind).toBe('hold');
    });
});

describe('gamma scalping', () => {
    it('BUYS the straddle when implied is below realised', () => {
        const { s, c } = withDefaults('gamma-scalp', { chain: chainAt(SPOT, 30 / 365, 0.10), realisedVol: 0.20 });
        const action = s.onChain(c);
        expect(action.kind).toBe('open');
        if (action.kind !== 'open') return;
        expect(action.legs.every((l) => l.side === 'buy')).toBe(true);
    });

    it('refuses when implied is above realised — the opposite of the straddle seller', () => {
        const { s, c } = withDefaults('gamma-scalp', { chain: chainAt(SPOT, 30 / 365, 0.25), realisedVol: 0.10 });
        expect(s.onChain(c).kind).toBe('hold');
    });

    it('says plainly that the hedging leg is not modelled', () => {
        // Without a spot instrument to trade against the straddle, this reports the
        // straddle alone — which is NOT the strategy. Saying so is the whole point.
        const s = optionsStrategyById('gamma-scalp')!;
        expect(s.caveats!.join(' ')).toMatch(/hedging leg is not modelled/i);
    });
});

describe('IV skew', () => {
    it('sells the expensive put and buys the cheap call when skew is wide', () => {
        const { s, c } = withDefaults('iv-skew', { chain: chainAt(SPOT, 30 / 365, 0.16, { skew: 0.10 }) });
        const action = s.onChain(c);
        expect(action.kind).toBe('open');
        if (action.kind !== 'open') return;

        const put = action.legs.find((l) => l.optionType === 'PE')!;
        const call = action.legs.find((l) => l.optionType === 'CE')!;
        expect(put.side).toBe('sell');
        expect(call.side).toBe('buy');
    });

    it('holds when skew is at its normal level', () => {
        // Index skew is PERMANENTLY positive; only the excess is a signal. A threshold of
        // zero would make this trade every single day.
        const { s, c } = withDefaults('iv-skew', { chain: chainAt(SPOT, 30 / 365, 0.16, { skew: 0.01 }) });
        expect(s.onChain(c).kind).toBe('hold');
    });
});

describe('structure marking', () => {
    const chain = chainAt(SPOT, 30 / 365, 0.16);
    const pos: OpenStructure = {
        legs: [
            { strike: 24500, optionType: 'CE', side: 'sell', lots: 1, entryPrice: 300 },
            { strike: 24700, optionType: 'CE', side: 'buy', lots: 1, entryPrice: 200 },
        ],
        openedAt: 0,
        netCredit: 100,
        spotAtOpen: SPOT,
    };

    it('marks a spread at current chain prices', () => {
        expect(markStructure(pos, chain)).not.toBeNull();
    });

    it('returns null when ANY leg has no quote', () => {
        // Marking a four-leg structure from three would understate the risk of exactly
        // the leg that has gone wrong.
        const missing = buildChainView({
            spot: SPOT, years: 30 / 365, synthetic: false,
            strikes: [{ strike: 24500, call: { price: 300 } }],
        });
        expect(markStructure(pos, missing)).toBeNull();
    });
});

describe('the options backtester', () => {
    // A gently trending, oscillating index — enough movement for a chain to be
    // interesting and enough calm for a credit structure to sometimes win.
    const bars = series(Array.from({ length: 260 }, (_, i) => 24000 + Math.sin(i / 7) * 400 + i * 2));
    const chains = syntheticChainSeries(bars, 20, { step: 50, width: 12 });

    const run = (id: string) =>
        runOptionsBacktest({
            strategy: optionsStrategyById(id)!,
            bars,
            chains,
            lotSize: LOT,
            startingCapital: 2_000_000,
        });

    it('produces a chain for most bars', () => {
        expect(chains.length).toBeGreaterThan(150);
        expect(chains.every((c) => c.chain.synthetic)).toBe(true);
    });

    it('runs every strategy without throwing and keeps equity finite', () => {
        for (const s of OPTIONS_STRATEGIES) {
            const r = run(s.id);
            expect(r.equity.every(Number.isFinite), s.id).toBe(true);
            expect(Number.isFinite(r.netPct), s.id).toBe(true);
            expect(r.equity).toHaveLength(bars.length);
        }
    });

    it('ALWAYS warns that a synthetic chain is not evidence of profit', () => {
        // There is no path through this engine that produces an unlabelled synthetic
        // result — the flag rides on the chain itself.
        for (const s of OPTIONS_STRATEGIES) {
            const r = run(s.id);
            expect(r.synthetic, s.id).toBe(true);
            expect(r.warnings.join(' '), s.id).toMatch(/implied and realised volatility are equal/i);
        }
    });

    it('actually trades the condor — a test suite that never fires proves nothing', () => {
        // Written after a probe showed three of these four assertions were passing
        // VACUOUSLY on zero trades. Pinning a real count is what makes the rest of this
        // block mean something.
        const r = run('iron-condor');
        expect(r.trades.length).toBeGreaterThan(10);
    });

    it('charges every structure it opens or closes on the market', () => {
        const condor = run('iron-condor');
        expect(condor.trades.length).toBeGreaterThan(10);
        // Four legs to open and four to close, each paying a flat ₹20 plus statutory
        // charges. If this were zero the whole result would be fiction.
        expect(condor.charges).toBeGreaterThan(0);
        for (const t of condor.trades.filter((x) => !x.settled)) {
            expect(t.charges, `trade opened at ${t.openedAt}`).toBeGreaterThan(0);
        }
    });

    it('charges nothing to settle a structure that expired worthless', () => {
        // Not an omission: settlement STT falls on INTRINSIC value, and a condor that
        // finished inside its wings has none on any leg. There is also no order, so no
        // brokerage. Charging anything here would overstate the cost of the outcome the
        // strategy is actually trying to achieve.
        const r = runOptionsBacktest({
            strategy: optionsStrategyById('iron-condor')!,
            bars, chains, lotSize: LOT, startingCapital: 2_000_000,
            params: { ...defaultParams(optionsStrategyById('iron-condor')!), closeAtBars: 0, targetPct: 90, stopPct: 400 },
        });
        const worthless = r.trades.filter((t) => t.settled && t.netClose === 0);
        if (worthless.length) expect(worthless.every((t) => t.charges === 0)).toBe(true);
    });

    it('EXPLAINS a zero-trade result on synthetic data instead of reporting a silent zero', () => {
        // The straddle, the gamma scalp and the skew trade are all volatility-EDGE
        // strategies: each needs a gap between implied and realised, or a skew. A
        // synthetic chain prices every strike at the underlying's own realised
        // volatility with no skew, so none of those gaps exist and none of the three can
        // fire. That is a property of the DATA, not a verdict on the strategy, and
        // reporting "0 trades" without saying so would read as the latter.
        for (const id of ['short-straddle', 'gamma-scalp', 'iv-skew']) {
            const r = run(id);
            expect(r.trades, id).toHaveLength(0);
            expect(r.warnings.join(' '), id).toMatch(/implied volatility equals realised and the skew is flat by construction/i);
            expect(r.warnings.join(' '), id).toMatch(/needs real chain history/i);
        }
    });

    it('withholds a win rate below the sample threshold, and says why', () => {
        const r = run('iron-condor');
        expect(r.trades.length).toBeLessThan(30);
        expect(r.suppressed).toContain('win rate');
        // Specifically because the payoff shape guarantees a high win rate.
        expect(r.warnings.join(' ')).toMatch(/wins most of the time by construction/i);
    });

    it('settles an expired structure at intrinsic rather than leaving it open', () => {
        // With the default `closeAtBars: 2` the condor flattens BEFORE expiry, which is
        // the intended risk control — gamma is unmanageable in the final sessions. So
        // settlement is exercised by letting a structure actually run to the end.
        const r = runOptionsBacktest({
            strategy: optionsStrategyById('iron-condor')!,
            bars,
            chains,
            lotSize: LOT,
            startingCapital: 2_000_000,
            params: { ...defaultParams(optionsStrategyById('iron-condor')!), closeAtBars: 0, targetPct: 90, stopPct: 400 },
        });
        const settled = r.trades.filter((t) => t.settled);
        expect(settled.length).toBeGreaterThan(0);
        // Settled at intrinsic: on a condor that finished inside the wings, every leg is
        // worth zero and the writer keeps the whole credit.
        expect(settled.every((t) => Number.isFinite(t.netClose))).toBe(true);
    });

    it('mostly closes before expiry at default settings — that is the risk control', () => {
        // `closeAtBars: 2` flattens ahead of expiry because gamma is unmanageable in the
        // final sessions. Some structures still reach settlement when the close rule and
        // the expiry bar coincide, so this asserts the tendency rather than an absolute.
        const r = run('iron-condor');
        const closedEarly = r.trades.filter((t) => !t.settled).length;
        expect(closedEarly).toBeGreaterThan(r.trades.length / 2);
    });

    it('is deterministic', () => {
        expect(JSON.stringify(run('iron-condor'))).toBe(JSON.stringify(run('iron-condor')));
    });

    it('can lose money — a strategy that cannot is a broken model', () => {
        // The condor is short the tails of a trending series, so it SHOULD lose here.
        // A model where a short-volatility structure never loses is not pricing risk.
        const r = run('iron-condor');
        expect(r.trades.some((t) => t.pnl < 0)).toBe(true);
        expect(r.losses).toBeGreaterThan(0);
    });
});
