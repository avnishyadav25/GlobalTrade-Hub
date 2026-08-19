import { describe, it, expect } from 'vitest';
import {
    sma, ema, wma, stddev, bollinger, zscore, rsi, macd, roc,
    trueRange, atr, rollingMax, rollingMin, donchian, stochastic,
    vwap, correlation, linreg, latest, type OHLC,
} from './indicators';

const seq = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));
const flat = (n: number, v = 100) => seq(n, () => v);
const rising = (n: number, step = 1, start = 100) => seq(n, (i) => start + i * step);
const falling = (n: number, step = 1, start = 200) => seq(n, (i) => start - i * step);

/** Bars with a constant 2-wide range and close at the midpoint. */
const bars = (closes: number[], spread = 1): OHLC[] =>
    closes.map((c) => ({ open: c, high: c + spread, low: c - spread, close: c }));

describe('the warm-up contract', () => {
    // The rule the whole library rests on: not enough data means null, never a
    // neutral placeholder. A default of 50 for RSI reads as a real reading.
    const v = rising(30);
    const b = bars(v);

    it.each([
        ['sma', sma(v, 10), 9],
        ['ema', ema(v, 10), 9],
        ['wma', wma(v, 10), 9],
        ['stddev', stddev(v, 10), 9],
        ['rsi', rsi(v, 14), 14],
        ['roc', roc(v, 5), 5],
        ['rollingMax', rollingMax(v, 10), 9],
        ['atr', atr(b, 14), 14],
    ])('%s is null until its first defined index', (_name, series, firstDefined) => {
        for (let i = 0; i < firstDefined; i++) expect(series[i]).toBeNull();
        expect(series[firstDefined]).not.toBeNull();
    });

    it('returns all nulls when the series is shorter than the period', () => {
        expect(sma([1, 2], 10).every((x) => x === null)).toBe(true);
        expect(rsi([1, 2, 3], 14).every((x) => x === null)).toBe(true);
        expect(atr(bars([1, 2, 3]), 14).every((x) => x === null)).toBe(true);
        expect(donchian(bars([1, 2, 3]), 20).every((x) => x === null)).toBe(true);
    });

    it('latest() finds the last defined value, or null', () => {
        expect(latest([null, 1, 2])).toBe(2);
        expect(latest([1, 2, null])).toBe(2);
        expect(latest([null, null])).toBeNull();
        expect(latest([])).toBeNull();
    });
});

describe('moving averages', () => {
    it('sma averages the trailing window', () => {
        expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
    });

    it('ema seeds from the SMA of the first period', () => {
        const out = ema([1, 2, 3, 4, 5], 3);
        expect(out[2]).toBe(2);                       // SMA(1,2,3)
        expect(out[3]).toBeCloseTo(4 * 0.5 + 2 * 0.5, 10); // k = 2/(3+1)
    });

    it('wma weights the most recent value most heavily', () => {
        // (1*1 + 2*2 + 3*3) / 6
        expect(wma([1, 2, 3], 3)![2]).toBeCloseTo(14 / 6, 10);
    });

    it('all three sit on a flat series', () => {
        for (const f of [sma, ema, wma]) expect(latest(f(flat(30), 10))).toBe(100);
    });
});

describe('dispersion', () => {
    it('reports zero deviation on a flat window', () => {
        expect(latest(stddev(flat(20), 10))).toBe(0);
    });

    it('distinguishes population from sample', () => {
        const v = [2, 4, 4, 4, 5, 5, 7, 9];
        expect(stddev(v, 8)![7]).toBeCloseTo(2, 10);                       // population
        expect(stddev(v, 8, { sample: true })![7]).toBeCloseTo(2.13809, 4); // sample
    });

    it('bollinger centres on the SMA and is symmetric', () => {
        const v = rising(30);
        const b = latest2(bollinger(v, 20, 2));
        expect(b.mid).toBeCloseTo(latest(sma(v, 20))!, 10);
        expect(b.upper - b.mid).toBeCloseTo(b.mid - b.lower, 10);
    });

    it('zscore is NULL on a flat window, not zero', () => {
        // Zero deviation makes the z-score undefined. Returning 0 would read as
        // "exactly at the mean", which a mean-reversion strategy would act on.
        expect(latest(zscore(flat(30), 20))).toBeNull();
    });

    it('zscore is positive above the mean and negative below', () => {
        const v = [...flat(20, 100), 130];
        expect(zscore(v, 20)![20]!).toBeGreaterThan(0);
        const w = [...flat(20, 100), 70];
        expect(zscore(w, 20)![20]!).toBeLessThan(0);
    });
});

describe('momentum', () => {
    it('rsi is 100 on an unbroken rise and 0 on an unbroken fall', () => {
        expect(latest(rsi(rising(40), 1))).toBe(100);
        expect(latest(rsi(falling(40), 1))).toBe(0);
    });

    it('rsi sits near 50 on an alternating series', () => {
        const v = seq(60, (i) => 100 + (i % 2 === 0 ? 1 : -1));
        expect(latest(rsi(v, 14))!).toBeGreaterThan(40);
        expect(latest(rsi(v, 14))!).toBeLessThan(60);
    });

    it('roc measures percentage change over the lookback', () => {
        expect(roc([100, 100, 100, 110], 3)![3]).toBeCloseTo(10, 10);
    });

    it('macd histogram is the gap between the line and its signal', () => {
        const m = latest2(macd(rising(120)));
        expect(m.hist).toBeCloseTo(m.macd - m.signal, 10);
    });

    it('macd signal warms up strictly after the macd line', () => {
        // The signal is an EMA of the line, computed over the DEFINED portion only.
        // Running an EMA across nulls would silently treat them as zeros.
        const out = macd(rising(60), 12, 26, 9);
        const first = out.findIndex((x) => x !== null);
        expect(first).toBeGreaterThanOrEqual(26 - 1 + 9 - 1);
    });

    it('macd is all null when there is not enough data', () => {
        expect(macd(rising(10)).every((x) => x === null)).toBe(true);
    });
});

describe('volatility', () => {
    it('true range has no value on the first bar', () => {
        expect(trueRange(bars([1, 2, 3]))[0]).toBeNull();
    });

    it('atr converges on a constant range', () => {
        expect(latest(atr(bars(flat(60), 1), 14))).toBeCloseTo(2, 6);
    });

    it('true range accounts for gaps beyond the bar itself', () => {
        const gapped: OHLC[] = [
            { open: 100, high: 101, low: 99, close: 100 },
            { open: 120, high: 121, low: 119, close: 120 },  // gaps up 20
        ];
        expect(trueRange(gapped)[1]).toBe(21); // |121 - 100|, not the 2-wide bar
    });
});

describe('channels', () => {
    it('rollingMax and rollingMin bound the window', () => {
        expect(rollingMax([1, 5, 3, 2], 3)![3]).toBe(5);
        expect(rollingMin([1, 5, 3, 2], 3)![3]).toBe(2);
    });

    it('donchian EXCLUDES the current bar', () => {
        // This is load-bearing. If the channel included bar i, then bar i's own high
        // would set the upper band and "price breaks the N-bar high" would be true on
        // every new high — a strategy that trades constantly for circular reasons.
        const b = bars([100, 101, 102, 103, 500]);
        const ch = donchian(b, 4)![4]!;
        expect(ch.upper).toBe(104);            // max high of bars 0..3 (103 + 1 spread)
        expect(ch.upper).toBeLessThan(b[4].high);
        expect(b[4].close).toBeGreaterThan(ch.upper); // so a breakout is detectable
    });

    it('donchian mid is the midpoint of the channel', () => {
        const ch = latest2(donchian(bars(rising(40)), 20));
        expect(ch.mid).toBeCloseTo((ch.upper + ch.lower) / 2, 10);
    });

    it('stochastic reads 100 at the top of its window and 0 at the bottom', () => {
        const top = bars([...flat(20, 100), 200]).map((b, i, a) =>
            i === a.length - 1 ? { ...b, high: 200, low: 200, close: 200 } : b
        );
        expect(latest2(stochastic(top, 14, 1)).k).toBeCloseTo(100, 6);
    });

    it('stochastic is null on a flat window rather than 50', () => {
        expect(latest2Maybe(stochastic(bars(flat(40), 0), 14, 3))).toBeNull();
    });
});

describe('vwap', () => {
    const withVol = (closes: number[], vols: number[]): OHLC[] =>
        closes.map((c, i) => ({ open: c, high: c, low: c, close: c, volume: vols[i] }));

    it('weights by volume, not by time', () => {
        // 100 at volume 1, then 200 at volume 3 → (100 + 600) / 4 = 175
        expect(latest(vwap(withVol([100, 200], [1, 3])))).toBeCloseTo(175, 10);
    });

    it('is null when no bar carries volume', () => {
        // Live bars have no volume — the crypto feed reports a rolling 24h cumulative
        // figure, and differencing it does not give per-minute volume.
        expect(latest(vwap(bars([100, 101, 102])))).toBeNull();
    });

    it('resets at each anchor, so intraday sessions do not bleed together', () => {
        const v = vwap(withVol([100, 100, 500], [1, 1, 1]), [2]);
        expect(v[1]).toBeCloseTo(100, 10);
        expect(v[2]).toBeCloseTo(500, 10); // reset — not the 233 average of all three
    });
});

describe('cross-series maths', () => {
    it('correlation is 1 for an identical series and -1 for an inverted one', () => {
        const a = rising(40);
        expect(latest(correlation(a, a, 20))!).toBeCloseTo(1, 10);
        expect(latest(correlation(a, falling(40), 20))!).toBeCloseTo(-1, 10);
    });

    it('correlation is null when one series is flat', () => {
        expect(latest(correlation(rising(40), flat(40), 20))).toBeNull();
    });

    it('linreg recovers the slope of a straight line with r2 of 1', () => {
        const r = latest2(linreg(rising(40, 3), 20));
        expect(r.slope).toBeCloseTo(3, 10);
        expect(r.r2).toBeCloseTo(1, 10);
    });

    it('linreg reports a low r2 on noise', () => {
        const noisy = seq(60, (i) => 100 + (i % 3) * 7 - (i % 5) * 4);
        expect(latest2(linreg(noisy, 20)).r2).toBeLessThan(0.6);
    });
});

/* helpers for object-valued series */
function latest2<T>(series: (T | null)[]): T {
    const v = latest2Maybe(series);
    if (v == null) throw new Error('expected a defined value');
    return v;
}
function latest2Maybe<T>(series: (T | null)[]): T | null {
    for (let i = series.length - 1; i >= 0; i--) if (series[i] != null) return series[i];
    return null;
}
