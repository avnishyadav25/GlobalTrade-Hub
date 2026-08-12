import type { OptionContract } from './contract';

// Margin for a written (short) index option.
//
// Real SPAN needs NSE's daily risk-parameter files, scenario arrays, inter-month spread
// credits and a short-option minimum charge. This ships an APPROXIMATION, and the whole
// design of this module is about making it impossible for that approximation to be
// presented as SPAN.
//
// Three rules enforce that:
//
//   1. A `span-*` model id is returned ONLY from a code path that actually consumed a
//      SpanParams object covering this contract. There is no default and no fallback —
//      a missing file returns 'approx-v1', never a silent upgrade.
//   2. The model id is PERSISTED on the position, so a position always shows the model
//      that priced it rather than whatever is loaded today.
//   3. The UI binds to `label`, never to an `isSpan` boolean. A boolean is the thing
//      that decays into a lie the first time someone changes a default.

/** Which model produced a margin number. Never inferred. */
export type MarginModelId = 'approx-v1' | `span-${string}`;

export interface MarginQuote {
    marginBase: number;
    model: MarginModelId;
    /** Rendered VERBATIM. Never assembled from a boolean at the call site. */
    label: string;
    /** The working, so a screen can show it rather than assert it. */
    inputs: {
        spot: number;
        strike: number;
        premium: number;
        qty: number;
        scanPct: number;
        exposurePct: number;
        notional: number;
    };
}

/** Parsed NSE risk parameters. Not built yet — the type exists so the seam is real. */
export interface SpanParams {
    /** Version stamp of the risk file, e.g. '2026-08-11'. Becomes part of the model id. */
    version: string;
    /** Scan range by underlying root. */
    scanPct: Record<string, number>;
    exposurePct: Record<string, number>;
    shortOptionMinPct: Record<string, number>;
}

/**
 * Approximation parameters, by underlying.
 *
 * These are in the neighbourhood of real NIFTY and BANKNIFTY requirements — a short
 * NIFTY option lands around ₹1.1–1.4 lakh per lot against roughly ₹18 lakh of notional.
 * They are not SPAN and are not claimed to be.
 */
const APPROX = {
    NIFTY: { scanPct: 0.035, exposurePct: 0.02, shortOptionMinPct: 0.0175 },
    BANKNIFTY: { scanPct: 0.035, exposurePct: 0.03, shortOptionMinPct: 0.0175 },
} as const;

export const APPROX_LABEL = 'Approximation (not SPAN)';

/**
 * Margin required to write `qty` units of an option.
 *
 * The shape follows SPAN's logic without claiming its precision: a scan charge that
 * falls as the option moves further out of the money, floored at a short-option minimum,
 * plus an exposure charge on notional, plus the premium.
 *
 * The premium term is there because this engine CREDITS premium to cash when you write
 * an option. Net buying-power impact is therefore `margin − premium`, which is the
 * scan-plus-exposure figure — the number a broker would actually block.
 */
export function shortOptionMargin(
    contract: Pick<OptionContract, 'root' | 'strike' | 'optionType'>,
    spot: number,
    premium: number,
    qty: number,
    span?: SpanParams
): MarginQuote {
    const notional = spot * qty;

    // A span-* id is only reachable when a risk file actually covers this root. Anything
    // else — no file, or a file that does not mention this underlying — stays approx.
    const covered =
        span &&
        Number.isFinite(span.scanPct?.[contract.root]) &&
        Number.isFinite(span.exposurePct?.[contract.root]) &&
        Number.isFinite(span.shortOptionMinPct?.[contract.root]);

    const p = covered
        ? {
              scanPct: span!.scanPct[contract.root],
              exposurePct: span!.exposurePct[contract.root],
              shortOptionMinPct: span!.shortOptionMinPct[contract.root],
          }
        : APPROX[contract.root];

    // How far out of the money the option is. Being further out reduces the scan charge,
    // because the underlying has further to travel before the writer is exposed.
    const outOfMoney = contract.optionType === 'CE' ? Math.max(0, contract.strike - spot) : Math.max(0, spot - contract.strike);

    const scan = Math.max(p.scanPct * notional - outOfMoney * qty, p.shortOptionMinPct * notional);
    const exposure = p.exposurePct * notional;
    const marginBase = scan + exposure + premium * qty;

    return {
        marginBase: Math.max(0, marginBase),
        model: covered ? (`span-${span!.version}` as MarginModelId) : 'approx-v1',
        label: covered ? `SPAN ${span!.version}` : APPROX_LABEL,
        inputs: {
            spot,
            strike: contract.strike,
            premium,
            qty,
            scanPct: p.scanPct,
            exposurePct: p.exposurePct,
            notional,
        },
    };
}

/**
 * What this model deliberately does NOT do, stated so a screen can say it.
 *
 * Positions are keyed by symbol, so the engine cannot see that two legs form a
 * defined-risk spread. A real broker charges roughly max-loss on a bull call spread; we
 * charge each leg. That makes the requirement CONSERVATIVE, and claiming a benefit we do
 * not compute would be worse than being conservative about it.
 */
export const MARGIN_CAVEATS = [
    'Margin is computed per leg. A real broker gives a spread benefit for defined-risk structures that this simulator does not model, so the requirement here is conservative.',
    'Margin is set when the position opens and is not marked to market daily. A real broker re-computes it every day and can call for more.',
] as const;
