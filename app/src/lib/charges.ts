import type { Market } from './constants';

// What a trade actually costs.
//
// This replaces a single blended constant — `india: 5` basis points — that stood in for
// brokerage, STT, stamp duty, GST, the exchange transaction charge, the SEBI turnover
// fee and DP charges all at once. That number was wrong in both directions depending on
// the trade, and it hid the three things that decide whether a small-target strategy
// survives contact with a real broker:
//
//   1. STT is asymmetric. Intraday equity pays it on the SELL leg only, at 0.025%.
//      Delivery pays it on BOTH legs, at 0.1% — four times the rate, twice.
//   2. Brokerage is capped. ₹20 per order means cost as a percentage FALLS as size
//      rises, so a strategy that works at ₹2,00,000 can be uneconomic at ₹5,000.
//   3. DP charges are flat per scrip. ₹13.5 on a delivery sell is 0.27% of a ₹5,000
//      trade — larger than every percentage-based charge combined.
//
// RATES CHANGE. These are the published rates for a typical Indian discount broker,
// NSE and SEBI as of the date below. Treat them as a model, verify before relying on
// them with real money, and update `RATES_VERIFIED_ON` when you do.

export const RATES_VERIFIED_ON = '2026-08';

export const RATE_SOURCES = [
    { label: 'NSE transaction charges', url: 'https://www.nseindia.com/' },
    { label: 'SEBI turnover fees', url: 'https://www.sebi.gov.in/' },
    { label: 'Zerodha brokerage calculator', url: 'https://zerodha.com/brokerage-calculator' },
];

export type Product = 'intraday' | 'delivery';
export type Side = 'buy' | 'sell';

export interface ChargeInput {
    market: Market;
    side: Side;
    /** Equity only. Ignored for crypto, forex and commodities. */
    product?: Product;
    /** Absolute order value in the base currency (INR). */
    notionalBase: number;
    /** Maker orders (resting limits) pay less on venues that price that way. */
    maker?: boolean;
    /** Share/contract count. Needed for the US per-share regulatory fee. */
    qty?: number;
}

export interface ChargeBreakdown {
    brokerage: number;
    /** Securities Transaction Tax (India) / SEC fee (US). */
    stt: number;
    exchangeTxn: number;
    sebiTurnover: number;
    stampDuty: number;
    /** Depository charge, flat per scrip on an Indian delivery sell. */
    dpCharge: number;
    /** GST at 18% on brokerage + exchange + SEBI, India only. */
    gst: number;
    total: number;
    /** Cost as basis points of the order value — the number to compare to your edge. */
    effectiveBps: number;
}

const EMPTY: Omit<ChargeBreakdown, 'total' | 'effectiveBps'> = {
    brokerage: 0, stt: 0, exchangeTxn: 0, sebiTurnover: 0, stampDuty: 0, dpCharge: 0, gst: 0,
};

/** Indian equity, as published by discount brokers and the exchanges. */
export const INDIA_RATES = {
    /** 0.03% of turnover or ₹20 per executed order, whichever is lower. */
    brokerageRate: 0.0003,
    brokerageCap: 20,
    /** Delivery brokerage is zero at most discount brokers. */
    deliveryBrokerage: 0,
    stt: {
        intradaySell: 0.00025,   // 0.025%, sell side only
        deliveryBoth: 0.001,     // 0.1%, both sides
    },
    exchangeTxn: 0.0000297,      // NSE equity, 0.00297%
    sebiTurnover: 0.000001,      // ₹10 per crore
    stampDuty: {
        intradayBuy: 0.00003,    // 0.003%, buy side only
        deliveryBuy: 0.00015,    // 0.015%, buy side only
    },
    /** Flat, per scrip, on a delivery SELL. Dominates small delivery trades. */
    dpCharge: 13.5,
    gst: 0.18,                   // on brokerage + exchange + SEBI
} as const;

/** US equity. Commission-free; what remains is regulatory and sell-side only. */
export const US_RATES = {
    /** SEC Section 31 fee on sale proceeds. Revised annually. */
    secFee: 0.0000278,
    /** FINRA Trading Activity Fee, per share sold, capped per order. */
    tafPerShare: 0.000166,
    tafCap: 8.3,
    /** Converted at the FX rate the caller already applied to notionalBase. */
} as const;

/**
 * Venues without a statutory cost stack still charge a spread-like fee, so they keep
 * the basis-point model. These match the paper engine's existing table.
 */
export const BPS_FALLBACK: Record<string, { taker: number; maker: number }> = {
    crypto: { taker: 7.5, maker: 3 },
    forex: { taker: 0.8, maker: 0.4 },
    commodity: { taker: 2, maker: 1 },
};

function finish(parts: Omit<ChargeBreakdown, 'total' | 'effectiveBps'>, notional: number): ChargeBreakdown {
    const total =
        parts.brokerage + parts.stt + parts.exchangeTxn + parts.sebiTurnover +
        parts.stampDuty + parts.dpCharge + parts.gst;
    return {
        ...parts,
        total,
        effectiveBps: notional > 0 ? (total / notional) * 10_000 : 0,
    };
}

function indiaEquity(input: ChargeInput, notional: number): ChargeBreakdown {
    const product = input.product ?? 'intraday';
    const R = INDIA_RATES;
    const isSell = input.side === 'sell';

    const brokerage =
        product === 'delivery' ? R.deliveryBrokerage : Math.min(notional * R.brokerageRate, R.brokerageCap);

    // The asymmetry that decides whether a strategy is viable.
    const stt =
        product === 'delivery'
            ? notional * R.stt.deliveryBoth
            : isSell
              ? notional * R.stt.intradaySell
              : 0;

    const exchangeTxn = notional * R.exchangeTxn;
    const sebiTurnover = notional * R.sebiTurnover;

    // Stamp duty is a buy-side charge in both products, at different rates.
    const stampDuty = isSell
        ? 0
        : notional * (product === 'delivery' ? R.stampDuty.deliveryBuy : R.stampDuty.intradayBuy);

    const dpCharge = product === 'delivery' && isSell ? R.dpCharge : 0;

    // GST applies to the service charges, NOT to the taxes or stamp duty.
    const gst = (brokerage + exchangeTxn + sebiTurnover) * R.gst;

    return finish({ ...EMPTY, brokerage, stt, exchangeTxn, sebiTurnover, stampDuty, dpCharge, gst }, notional);
}

function usEquity(input: ChargeInput, notional: number): ChargeBreakdown {
    if (input.side !== 'sell') return finish(EMPTY, notional);
    const secFee = notional * US_RATES.secFee;
    const taf = input.qty && input.qty > 0 ? Math.min(input.qty * US_RATES.tafPerShare, US_RATES.tafCap) : 0;
    // Both are regulatory, so they sit under `stt` — the statutory-charge slot.
    return finish({ ...EMPTY, stt: secFee + taf }, notional);
}

/**
 * Itemised cost of one order. Pure — no I/O, no clock.
 *
 * `notionalBase` is already in the account's base currency; convert with `toBase`
 * before calling so this never has to know about FX.
 */
export function chargesFor(input: ChargeInput): ChargeBreakdown {
    const notional = Math.abs(input.notionalBase);
    if (!Number.isFinite(notional) || notional <= 0) return finish(EMPTY, 0);

    if (input.market === 'india') return indiaEquity(input, notional);
    if (input.market === 'us') return usEquity(input, notional);

    const rate = BPS_FALLBACK[input.market];
    if (!rate) return finish(EMPTY, notional);
    const bps = input.maker ? rate.maker : rate.taker;
    return finish({ ...EMPTY, brokerage: (notional * bps) / 10_000 }, notional);
}

/** Total cost only — the shape the matching engine and backtester need per fill. */
export function chargeTotal(input: ChargeInput): number {
    return chargesFor(input).total;
}

/**
 * Round-trip cost of a position, in basis points of the entry notional.
 *
 * This is the number to hold a strategy's edge against: a signal worth 30 bps against
 * a 20 bps round trip keeps a third of what the backtest appears to show.
 */
export function roundTripBps(input: Omit<ChargeInput, 'side'>): number {
    const buy = chargesFor({ ...input, side: 'buy' });
    const sell = chargesFor({ ...input, side: 'sell' });
    const notional = Math.abs(input.notionalBase);
    return notional > 0 ? ((buy.total + sell.total) / notional) * 10_000 : 0;
}
