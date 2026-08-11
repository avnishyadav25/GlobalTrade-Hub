import { describe, it, expect } from 'vitest';
import { chargesFor, roundTripBps, chargeTotal, INDIA_RATES, BPS_FALLBACK } from './charges';

const near = (a: number, b: number, places = 4) => expect(a).toBeCloseTo(b, places);

describe('India equity — intraday', () => {
    // ₹1,00,000 buy, intraday. Worked by hand from the published rates:
    //   brokerage      min(100000 * 0.0003, 20)      = 20
    //   STT            buy side, intraday            = 0
    //   exchange txn   100000 * 0.0000297            = 2.97
    //   SEBI           100000 * 0.000001             = 0.10
    //   stamp duty     100000 * 0.00003              = 3.00
    //   GST            (20 + 2.97 + 0.10) * 0.18     = 4.1526
    //   total                                        = 30.2226
    const buy = chargesFor({ market: 'india', side: 'buy', product: 'intraday', notionalBase: 100_000 });

    it('itemises a ₹1,00,000 intraday buy', () => {
        near(buy.brokerage, 20);
        near(buy.stt, 0);
        near(buy.exchangeTxn, 2.97);
        near(buy.sebiTurnover, 0.1);
        near(buy.stampDuty, 3);
        near(buy.gst, 4.1526);
        near(buy.total, 30.2226);
    });

    it('charges STT on the SELL leg only', () => {
        // The asymmetry that decides whether an intraday strategy is viable.
        const sell = chargesFor({ market: 'india', side: 'sell', product: 'intraday', notionalBase: 100_000 });
        near(sell.stt, 25);          // 100000 * 0.00025
        near(sell.stampDuty, 0);     // stamp duty is buy-side
        expect(sell.total).toBeGreaterThan(buy.total);
    });

    it('applies GST to services but never to the taxes', () => {
        const sell = chargesFor({ market: 'india', side: 'sell', product: 'intraday', notionalBase: 100_000 });
        near(sell.gst, (sell.brokerage + sell.exchangeTxn + sell.sebiTurnover) * INDIA_RATES.gst);
        // If GST were applied to STT this would be much larger.
        expect(sell.gst).toBeLessThan(sell.stt);
    });
});

describe('India equity — delivery', () => {
    it('pays STT on BOTH legs, at four times the intraday rate', () => {
        const buy = chargesFor({ market: 'india', side: 'buy', product: 'delivery', notionalBase: 100_000 });
        const sell = chargesFor({ market: 'india', side: 'sell', product: 'delivery', notionalBase: 100_000 });
        near(buy.stt, 100);   // 0.1% both sides
        near(sell.stt, 100);
        const intradaySell = chargesFor({ market: 'india', side: 'sell', product: 'intraday', notionalBase: 100_000 });
        expect(sell.stt).toBeCloseTo(intradaySell.stt * 4, 6);
    });

    it('charges no brokerage but a flat DP fee on the sell', () => {
        const sell = chargesFor({ market: 'india', side: 'sell', product: 'delivery', notionalBase: 100_000 });
        near(sell.brokerage, 0);
        near(sell.dpCharge, INDIA_RATES.dpCharge);
        const buy = chargesFor({ market: 'india', side: 'buy', product: 'delivery', notionalBase: 100_000 });
        near(buy.dpCharge, 0);
    });

    it('costs roughly three times intraday over a round trip', () => {
        // At ₹1,00,000: intraday ≈ 8.2 bps (₹82), delivery ≈ 23.6 bps (₹236).
        // Delivery's 0.1% STT on both legs is what drives it.
        const d = roundTripBps({ market: 'india', product: 'delivery', notionalBase: 100_000 });
        const i = roundTripBps({ market: 'india', product: 'intraday', notionalBase: 100_000 });
        expect(i).toBeCloseTo(8.24, 1);
        expect(d).toBeCloseTo(23.57, 1);
        expect(d / i).toBeGreaterThan(2.5);
    });
});

describe('the cost structure a beginner gets wrong', () => {
    it('brokerage is capped, so cost as a percentage FALLS with size', () => {
        // ₹20 cap: a ₹5,000 trade pays 0.03%; a ₹5,00,000 trade pays 0.004%.
        const small = chargesFor({ market: 'india', side: 'buy', notionalBase: 5_000 });
        const large = chargesFor({ market: 'india', side: 'buy', notionalBase: 500_000 });
        near(small.brokerage, 1.5);   // uncapped: 5000 * 0.0003
        near(large.brokerage, 20);    // capped
        expect(small.effectiveBps).toBeGreaterThan(large.effectiveBps);
    });

    it('a flat DP charge dominates a small delivery sell', () => {
        // ₹13.5 on ₹5,000 is 27 bps — more than every percentage charge put together.
        const sell = chargesFor({ market: 'india', side: 'sell', product: 'delivery', notionalBase: 5_000 });
        expect(sell.dpCharge).toBeGreaterThan(sell.total - sell.dpCharge);
        expect(sell.effectiveBps).toBeGreaterThan(35);   // ~37 bps at this size
    });

    it('round-trip cost is a meaningful fraction of a small edge', () => {
        const bps = roundTripBps({ market: 'india', product: 'intraday', notionalBase: 100_000 });
        // Roughly 6 bps round trip at this size — a 20 bps signal keeps about 70%.
        expect(bps).toBeGreaterThan(3);
        expect(bps).toBeLessThan(12);
    });
});

describe('US equity', () => {
    it('is free to buy — the regulatory fees are sell-side', () => {
        expect(chargesFor({ market: 'us', side: 'buy', notionalBase: 100_000 }).total).toBe(0);
    });

    it('charges the SEC fee and per-share TAF on a sell', () => {
        const sell = chargesFor({ market: 'us', side: 'sell', notionalBase: 100_000, qty: 500 });
        near(sell.stt, 100_000 * 0.0000278 + 500 * 0.000166);
    });

    it('caps the per-share fee', () => {
        const huge = chargesFor({ market: 'us', side: 'sell', notionalBase: 1_000_000, qty: 10_000_000 });
        expect(huge.stt).toBeLessThan(1_000_000 * 0.0000278 + 8.31);
    });

    it('omits the per-share fee when quantity is unknown rather than guessing', () => {
        const sell = chargesFor({ market: 'us', side: 'sell', notionalBase: 100_000 });
        near(sell.stt, 100_000 * 0.0000278);
    });
});

describe('venues without a statutory stack', () => {
    it.each([['crypto'], ['forex'], ['commodity']] as const)('%s keeps the basis-point model', (market) => {
        const taker = chargesFor({ market, side: 'buy', notionalBase: 100_000 });
        const maker = chargesFor({ market, side: 'buy', notionalBase: 100_000, maker: true });
        near(taker.brokerage, (100_000 * BPS_FALLBACK[market].taker) / 10_000);
        expect(maker.total).toBeLessThan(taker.total);
        near(taker.stt, 0);
        near(taker.gst, 0);
    });
});

describe('robustness', () => {
    it('returns zero for a zero or non-finite notional', () => {
        // A negative notional is NOT invalid — it is a short, handled by magnitude below.
        for (const n of [0, Number.NaN, Number.POSITIVE_INFINITY]) {
            const c = chargesFor({ market: 'india', side: 'buy', notionalBase: n });
            expect(c.total).toBe(0);
            expect(c.effectiveBps).toBe(0);
        }
    });

    it('treats a negative notional as its magnitude, so a short does not get a credit', () => {
        const short = chargesFor({ market: 'india', side: 'sell', notionalBase: -100_000 });
        const long = chargesFor({ market: 'india', side: 'sell', notionalBase: 100_000 });
        expect(short.total).toBeCloseTo(long.total, 10);
        expect(short.total).toBeGreaterThan(0);
    });

    it('defaults to intraday when no product is given', () => {
        const a = chargesFor({ market: 'india', side: 'sell', notionalBase: 100_000 });
        const b = chargesFor({ market: 'india', side: 'sell', product: 'intraday', notionalBase: 100_000 });
        expect(a.total).toBeCloseTo(b.total, 10);
    });

    it('chargeTotal matches the breakdown', () => {
        const input = { market: 'india' as const, side: 'sell' as const, notionalBase: 250_000 };
        expect(chargeTotal(input)).toBeCloseTo(chargesFor(input).total, 10);
    });

    it('effectiveBps is consistent with the total', () => {
        const c = chargesFor({ market: 'india', side: 'sell', notionalBase: 100_000 });
        expect(c.effectiveBps).toBeCloseTo((c.total / 100_000) * 10_000, 10);
    });
});
