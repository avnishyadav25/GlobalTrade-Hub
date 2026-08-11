// Technical indicators — the one place they live.
//
// Before this there were exactly two: `ema` and `rsi` in backtestEngine, plus a THIRD
// copy of RSI in seriesStore with a different shape (latest-value instead of series).
// Two implementations of the same maths is one too many, so both now delegate here.
//
// THE WARM-UP CONTRACT, which every function below honours:
//   an indicator that does not have enough data returns `null`, never a neutral
//   placeholder. A default of 50 for RSI or 0 for a z-score reads as a real reading
//   and silently produces trades from nothing. Callers must treat null as "unknown"
//   and skip, exactly as the scanner and the alert engine already do.

/** Minimal bar shape. `Candle` from mockData satisfies this structurally. */
export interface OHLC {
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

const nulls = (n: number): (number | null)[] => new Array(n).fill(null);
const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Last non-null value of a series, or null. Convenience for live/latest-value callers. */
export function latest(series: (number | null)[]): number | null {
    for (let i = series.length - 1; i >= 0; i--) {
        if (series[i] != null) return series[i];
    }
    return null;
}

/* ------------------------------------------------------------------ averages */

export function sma(values: number[], period: number): (number | null)[] {
    const out = nulls(values.length);
    if (period < 1 || values.length < period) return out;
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
        sum += values[i];
        if (i >= period) sum -= values[i - period];
        if (i >= period - 1) out[i] = sum / period;
    }
    return out;
}

/** EMA seeded from the SMA of the first `period` values; null until then. */
export function ema(values: number[], period: number): (number | null)[] {
    const out = nulls(values.length);
    if (values.length < period || period < 1) return out;
    const k = 2 / (period + 1);
    let seed = 0;
    for (let i = 0; i < period; i++) seed += values[i];
    let prev = seed / period;
    out[period - 1] = prev;
    for (let i = period; i < values.length; i++) {
        prev = values[i] * k + prev * (1 - k);
        out[i] = prev;
    }
    return out;
}

/** Linearly weighted moving average — most recent value carries the most weight. */
export function wma(values: number[], period: number): (number | null)[] {
    const out = nulls(values.length);
    if (period < 1 || values.length < period) return out;
    const denom = (period * (period + 1)) / 2;
    for (let i = period - 1; i < values.length; i++) {
        let acc = 0;
        for (let j = 0; j < period; j++) acc += values[i - period + 1 + j] * (j + 1);
        out[i] = acc / denom;
    }
    return out;
}

/* ---------------------------------------------------------------- dispersion */

/**
 * Rolling standard deviation.
 * Population by default — that is what Bollinger bands use. Pass `sample: true`
 * for statistical work such as a pairs z-score.
 */
export function stddev(values: number[], period: number, opts: { sample?: boolean } = {}): (number | null)[] {
    const out = nulls(values.length);
    if (period < 2 || values.length < period) return out;
    const divisor = opts.sample ? period - 1 : period;
    for (let i = period - 1; i < values.length; i++) {
        let mean = 0;
        for (let j = i - period + 1; j <= i; j++) mean += values[j];
        mean /= period;
        let acc = 0;
        for (let j = i - period + 1; j <= i; j++) acc += (values[j] - mean) ** 2;
        out[i] = Math.sqrt(acc / divisor);
    }
    return out;
}

export interface Band {
    upper: number;
    mid: number;
    lower: number;
}

export function bollinger(values: number[], period = 20, mult = 2): (Band | null)[] {
    const mid = sma(values, period);
    const sd = stddev(values, period);
    return values.map((_, i) => {
        const m = mid[i];
        const s = sd[i];
        return ok(m) && ok(s) ? { upper: m + mult * s, mid: m, lower: m - mult * s } : null;
    });
}

/** How far the last value sits from its rolling mean, in standard deviations. */
export function zscore(values: number[], period: number, opts: { sample?: boolean } = { sample: true }): (number | null)[] {
    const mid = sma(values, period);
    const sd = stddev(values, period, opts);
    return values.map((v, i) => {
        const m = mid[i];
        const s = sd[i];
        // A zero standard deviation means a flat window: the z-score is undefined, not 0.
        return ok(m) && ok(s) && s > 0 ? (v - m) / s : null;
    });
}

/* ----------------------------------------------------------------- momentum */

/** Wilder RSI; null until `period` deltas exist. Never a neutral placeholder. */
export function rsi(values: number[], period: number): (number | null)[] {
    const out = nulls(values.length);
    if (values.length <= period || period < 1) return out;
    let gain = 0;
    let loss = 0;
    for (let i = 1; i <= period; i++) {
        const d = values[i] - values[i - 1];
        gain += Math.max(0, d);
        loss += Math.max(0, -d);
    }
    gain /= period;
    loss /= period;
    out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    for (let i = period + 1; i < values.length; i++) {
        const d = values[i] - values[i - 1];
        gain = (gain * (period - 1) + Math.max(0, d)) / period;
        loss = (loss * (period - 1) + Math.max(0, -d)) / period;
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
    return out;
}

export interface Macd {
    macd: number;
    signal: number;
    hist: number;
}

/**
 * MACD. The signal line is an EMA of the MACD line, which is itself null during
 * warm-up — so the signal EMA is computed over the DEFINED portion only and mapped
 * back. Running an EMA across nulls would silently treat them as zeros.
 */
export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): (Macd | null)[] {
    const out: (Macd | null)[] = new Array(values.length).fill(null);
    const f = ema(values, fast);
    const s = ema(values, slow);

    const line: number[] = [];
    const index: number[] = [];
    for (let i = 0; i < values.length; i++) {
        if (ok(f[i]) && ok(s[i])) {
            line.push(f[i]! - s[i]!);
            index.push(i);
        }
    }
    if (!line.length) return out;

    const sig = ema(line, signalPeriod);
    for (let k = 0; k < line.length; k++) {
        if (!ok(sig[k])) continue;
        out[index[k]] = { macd: line[k], signal: sig[k]!, hist: line[k] - sig[k]! };
    }
    return out;
}

/** Percentage rate of change over `period` bars. */
export function roc(values: number[], period: number): (number | null)[] {
    const out = nulls(values.length);
    for (let i = period; i < values.length; i++) {
        const base = values[i - period];
        if (base !== 0) out[i] = ((values[i] - base) / base) * 100;
    }
    return out;
}

/* --------------------------------------------------------------- volatility */

/** True range per bar. Null on the first bar — it has no previous close. */
export function trueRange(bars: OHLC[]): (number | null)[] {
    const out = nulls(bars.length);
    for (let i = 1; i < bars.length; i++) {
        const prev = bars[i - 1].close;
        out[i] = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - prev), Math.abs(bars[i].low - prev));
    }
    return out;
}

/** Average true range, Wilder-smoothed and seeded from the mean of the first `period`. */
export function atr(bars: OHLC[], period = 14): (number | null)[] {
    const out = nulls(bars.length);
    const tr = trueRange(bars);
    if (bars.length <= period || period < 1) return out;

    let sum = 0;
    for (let i = 1; i <= period; i++) sum += tr[i] ?? 0;
    let prev = sum / period;
    out[period] = prev;
    for (let i = period + 1; i < bars.length; i++) {
        prev = (prev * (period - 1) + (tr[i] ?? 0)) / period;
        out[i] = prev;
    }
    return out;
}

/* ------------------------------------------------------ channels and extremes */

export function rollingMax(values: number[], period: number): (number | null)[] {
    const out = nulls(values.length);
    if (period < 1) return out;
    for (let i = period - 1; i < values.length; i++) {
        let m = -Infinity;
        for (let j = i - period + 1; j <= i; j++) if (values[j] > m) m = values[j];
        out[i] = m;
    }
    return out;
}

export function rollingMin(values: number[], period: number): (number | null)[] {
    const out = nulls(values.length);
    if (period < 1) return out;
    for (let i = period - 1; i < values.length; i++) {
        let m = Infinity;
        for (let j = i - period + 1; j <= i; j++) if (values[j] < m) m = values[j];
        out[i] = m;
    }
    return out;
}

export interface Channel {
    upper: number;
    lower: number;
    mid: number;
}

/**
 * Donchian channel over the `period` bars BEFORE the current one.
 *
 * Excluding the current bar is deliberate and load-bearing: if the channel included
 * bar `i`, then bar `i`'s own high would set the upper band and "price breaks the
 * 20-bar high" would be true on almost every new high — a strategy that trades
 * constantly and backtests beautifully for entirely circular reasons.
 */
export function donchian(bars: OHLC[], period = 20): (Channel | null)[] {
    const out: (Channel | null)[] = new Array(bars.length).fill(null);
    if (period < 1) return out;
    for (let i = period; i < bars.length; i++) {
        let hi = -Infinity;
        let lo = Infinity;
        for (let j = i - period; j < i; j++) {
            if (bars[j].high > hi) hi = bars[j].high;
            if (bars[j].low < lo) lo = bars[j].low;
        }
        out[i] = { upper: hi, lower: lo, mid: (hi + lo) / 2 };
    }
    return out;
}

export interface Stochastic {
    k: number;
    d: number;
}

export function stochastic(bars: OHLC[], kPeriod = 14, dPeriod = 3): (Stochastic | null)[] {
    const out: (Stochastic | null)[] = new Array(bars.length).fill(null);
    const raw = nulls(bars.length);

    for (let i = kPeriod - 1; i < bars.length; i++) {
        let hi = -Infinity;
        let lo = Infinity;
        for (let j = i - kPeriod + 1; j <= i; j++) {
            if (bars[j].high > hi) hi = bars[j].high;
            if (bars[j].low < lo) lo = bars[j].low;
        }
        // A flat window has no range to normalise against; undefined, not 50.
        if (hi > lo) raw[i] = ((bars[i].close - lo) / (hi - lo)) * 100;
    }

    const defined: number[] = [];
    const index: number[] = [];
    for (let i = 0; i < raw.length; i++) {
        if (ok(raw[i])) {
            defined.push(raw[i]!);
            index.push(i);
        }
    }
    const smoothed = sma(defined, dPeriod);
    for (let k = 0; k < defined.length; k++) {
        if (ok(smoothed[k])) out[index[k]] = { k: defined[k], d: smoothed[k]! };
    }
    return out;
}

/* -------------------------------------------------------------------- volume */

/**
 * Volume-weighted average price, anchored at index 0 or at each `resetAt` index.
 * Real VWAP resets every session — pass the session-open indices for intraday use.
 * Returns null for any bar with no volume data rather than falling back to price.
 */
export function vwap(bars: OHLC[], resetAt: number[] = []): (number | null)[] {
    const out = nulls(bars.length);
    const resets = new Set(resetAt);
    let pv = 0;
    let vol = 0;
    for (let i = 0; i < bars.length; i++) {
        if (resets.has(i)) {
            pv = 0;
            vol = 0;
        }
        const v = bars[i].volume;
        if (!ok(v) || v <= 0) continue;
        const typical = (bars[i].high + bars[i].low + bars[i].close) / 3;
        pv += typical * v;
        vol += v;
        if (vol > 0) out[i] = pv / vol;
    }
    return out;
}

/* --------------------------------------------------------- cross-series maths */

/** Rolling Pearson correlation of two equal-length series. */
export function correlation(a: number[], b: number[], period: number): (number | null)[] {
    const n = Math.min(a.length, b.length);
    const out = nulls(n);
    if (period < 2 || n < period) return out;

    for (let i = period - 1; i < n; i++) {
        let ma = 0;
        let mb = 0;
        for (let j = i - period + 1; j <= i; j++) {
            ma += a[j];
            mb += b[j];
        }
        ma /= period;
        mb /= period;

        let cov = 0;
        let va = 0;
        let vb = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const da = a[j] - ma;
            const db = b[j] - mb;
            cov += da * db;
            va += da * da;
            vb += db * db;
        }
        const denom = Math.sqrt(va * vb);
        if (denom > 0) out[i] = cov / denom;
    }
    return out;
}

export interface LinReg {
    slope: number;
    intercept: number;
    r2: number;
}

/** Rolling least-squares fit against the bar index — trend slope and fit quality. */
export function linreg(values: number[], period: number): (LinReg | null)[] {
    const out: (LinReg | null)[] = new Array(values.length).fill(null);
    if (period < 2 || values.length < period) return out;

    for (let i = period - 1; i < values.length; i++) {
        let sx = 0;
        let sy = 0;
        for (let j = 0; j < period; j++) {
            sx += j;
            sy += values[i - period + 1 + j];
        }
        const mx = sx / period;
        const my = sy / period;

        let num = 0;
        let den = 0;
        for (let j = 0; j < period; j++) {
            const dx = j - mx;
            num += dx * (values[i - period + 1 + j] - my);
            den += dx * dx;
        }
        if (den === 0) continue;

        const slope = num / den;
        const intercept = my - slope * mx;

        let ssRes = 0;
        let ssTot = 0;
        for (let j = 0; j < period; j++) {
            const y = values[i - period + 1 + j];
            const fit = slope * j + intercept;
            ssRes += (y - fit) ** 2;
            ssTot += (y - my) ** 2;
        }
        out[i] = { slope, intercept, r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot };
    }
    return out;
}
