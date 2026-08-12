import { greeks, impliedVol, DEFAULT_RATE, type OptionType } from './greeks';

// A read-only view of one option chain, for a strategy to reason about.
//
// The accessors here exist because of how options strategies are actually described.
// Nobody says "sell the 24800 call" — they say "sell the 20-delta call" or "sell one
// strike out of the money", because the strike that matters moves with spot. Encoding
// that as an accessor keeps the strategy readable AND keeps it from reaching for a
// strike that does not exist on this expiry.
//
// The no-lookahead guarantee from the equity contract carries over unchanged: a
// ChainView is built for ONE bar and holds nothing from later ones. A strategy cannot
// see tomorrow's chain because it is never handed one.

export interface ChainSide {
    /** Traded premium per unit. */
    price: number;
    /** Implied volatility as a decimal, solved here or supplied. Null when unmeasurable. */
    iv: number | null;
    openInterest?: number | null;
    bid?: number | null;
    ask?: number | null;
    /** Signed delta. Null when IV could not be established. */
    delta: number | null;
}

export interface ChainStrikeView {
    strike: number;
    call: ChainSide | null;
    put: ChainSide | null;
}

/** One side of one strike, resolved — what a leg is actually built from. */
export interface Quote {
    strike: number;
    optionType: OptionType;
    price: number;
    iv: number | null;
    delta: number | null;
}

export interface ChainView {
    /** Underlying level this chain was quoted against. */
    readonly spot: number;
    /** Years to expiry at this bar. Zero on the expiry bar itself. */
    readonly years: number;
    /**
     * TRUE when the premiums are modelled rather than historical.
     *
     * Carried on the view rather than passed alongside it, so a strategy that wants to
     * refuse synthetic data can, and so a result can be labelled without the caller
     * having to remember where the chain came from.
     */
    readonly synthetic: boolean;
    readonly strikes: readonly ChainStrikeView[];

    /** Nearest listed strike to spot. */
    atm(): ChainStrikeView | undefined;
    /** Exact strike, or undefined. Never the nearest — a silent substitution is a bug. */
    at(strike: number): ChainStrikeView | undefined;
    /**
     * The strike whose delta is closest to `target`, on the given side.
     *
     * `target` is an absolute value: 0.2 means the 20-delta call OR the 20-delta put.
     * Returns undefined when no strike has a measurable delta, rather than falling back
     * to a strike chosen by distance — a 20-delta rule that quietly becomes a
     * fixed-offset rule is a different strategy wearing the same name.
     */
    byDelta(target: number, type: OptionType): Quote | undefined;
    /** `steps` strikes out of the money from the money. Negative goes in the money. */
    offset(steps: number, type: OptionType): Quote | undefined;
    /** At-the-money implied volatility — the usual input to a volatility filter. */
    atmIv(): number | null;
}

const sideOf = (s: ChainStrikeView | undefined, type: OptionType) => (type === 'CE' ? s?.call : s?.put);

const toQuote = (s: ChainStrikeView | undefined, type: OptionType): Quote | undefined => {
    const side = sideOf(s, type);
    return s && side ? { strike: s.strike, optionType: type, price: side.price, iv: side.iv, delta: side.delta } : undefined;
};

export interface BuildChainInput {
    spot: number;
    years: number;
    synthetic: boolean;
    rate?: number;
    strikes: {
        strike: number;
        call?: { price: number; iv?: number | null; openInterest?: number | null; bid?: number | null; ask?: number | null };
        put?: { price: number; iv?: number | null; openInterest?: number | null; bid?: number | null; ask?: number | null };
    }[];
}

/**
 * Build a view, solving implied volatility and delta where they are not supplied.
 *
 * Where IV cannot be established the delta is null rather than guessed. That propagates:
 * `byDelta` will skip such a strike entirely, so a delta-targeting strategy silently
 * trading a strike whose delta was invented is not possible.
 */
export function buildChainView(input: BuildChainInput): ChainView {
    const rate = input.rate ?? DEFAULT_RATE;
    const { spot, years } = input;

    const strikes: ChainStrikeView[] = input.strikes
        .map((row) => {
            const side = (raw: BuildChainInput['strikes'][number]['call'], type: OptionType): ChainSide | null => {
                if (!raw || !(raw.price > 0)) return null;
                const base = { spot, strike: row.strike, years, rate, type } as const;
                const iv = raw.iv != null && raw.iv > 0 ? raw.iv : impliedVol(raw.price, base);
                return {
                    price: raw.price,
                    iv,
                    openInterest: raw.openInterest ?? null,
                    bid: raw.bid ?? null,
                    ask: raw.ask ?? null,
                    delta: iv == null ? null : greeks({ ...base, vol: iv }).delta,
                };
            };
            return { strike: row.strike, call: side(row.call, 'CE'), put: side(row.put, 'PE') };
        })
        .sort((a, b) => a.strike - b.strike);

    const atm = (): ChainStrikeView | undefined =>
        strikes.length
            ? strikes.reduce((best, s) => (Math.abs(s.strike - spot) < Math.abs(best.strike - spot) ? s : best))
            : undefined;

    return {
        spot,
        years,
        synthetic: input.synthetic,
        strikes,

        atm,
        at: (strike) => strikes.find((s) => Math.abs(s.strike - strike) < 1e-9),

        byDelta(target, type) {
            const wanted = Math.abs(target);
            let best: ChainStrikeView | undefined;
            let bestGap = Infinity;

            for (const s of strikes) {
                const side = sideOf(s, type);
                // A strike with no measurable delta is SKIPPED, not approximated.
                if (!side || side.delta == null) continue;
                const gap = Math.abs(Math.abs(side.delta) - wanted);
                if (gap < bestGap) {
                    bestGap = gap;
                    best = s;
                }
            }
            return toQuote(best, type);
        },

        offset(steps, type) {
            const centre = atm();
            if (!centre) return undefined;
            const i = strikes.indexOf(centre);
            // Out of the money is UP for a call and DOWN for a put — the sign flip is
            // the whole reason this is an accessor rather than index arithmetic at the
            // call site, where it would be got wrong once per strategy.
            const target = type === 'CE' ? i + steps : i - steps;
            return toQuote(strikes[target], type);
        },

        atmIv() {
            const centre = atm();
            const call = centre?.call?.iv;
            const put = centre?.put?.iv;
            if (call != null && put != null) return (call + put) / 2;
            return call ?? put ?? null;
        },
    };
}
