import { describe, it, expect, vi } from 'vitest';
import { scan, presetByKey, RSI_PERIOD, type ScanSeries, type ScanCriteria } from './scanner';
import { allInstruments } from './instruments';
import type { LiveQuote } from '@/stores/marketStore';

// The scanner's three fixed defects, pinned.
//
// AUDIT S8.1-S8.3 were all corrected with nothing to stop them coming back, which is why
// docs/PENDING.md calls this the highest-value missing test in the repo. Each test below
// is written to FAIL against the old behaviour rather than merely pass against the new —
// a regression test that only asserts the current answer does not defend anything.
//
// `scan()` takes its history through an injectable `ScanSeries`, defaulting to the real
// store. These tests inject fakes; the last describe block proves the default still
// reaches seriesStore, because injection alone would pass even if the default were wired
// to nothing at all.

const SYM = allInstruments()[0].symbol;
const OTHER = allInstruments()[1].symbol;

const quote = (symbol: string, over: Partial<LiveQuote> = {}): LiveQuote => ({
    symbol, price: 100, prevClose: 100, change: 0, changePercent: 0,
    high: 100, low: 100, volume: 1_000_000, ts: 0, dir: null, real: true, ...over,
});

/** A series source with nothing in it. */
const EMPTY: ScanSeries = { rsi: () => null, rolling24h: () => null };

const seriesWith = (over: Partial<ScanSeries>): ScanSeries => ({ ...EMPTY, ...over });

const ALL: ScanCriteria = { markets: 'all' } as ScanCriteria;

describe('S8.1 — RSI comes from real bars, not from the symbol name', () => {
    it('reflects the series it is given, rather than being fixed per symbol', () => {
        const quotes = { [SYM]: quote(SYM) };
        const low = scan(ALL, quotes, undefined, seriesWith({ rsi: () => 12 }));
        const high = scan(ALL, quotes, undefined, seriesWith({ rsi: () => 88 }));

        // The defect: RSI was seeded from the symbol string, so the SAME symbol always
        // produced the SAME number and these two would be identical.
        expect(low.find((r) => r.symbol === SYM)?.rsi).toBe(12);
        expect(high.find((r) => r.symbol === SYM)?.rsi).toBe(88);
    });

    it('asks for the declared period', () => {
        const seen: number[] = [];
        scan(ALL, { [SYM]: quote(SYM) }, undefined, seriesWith({ rsi: (_s, p) => { seen.push(p); return 50; } }));
        expect(seen[0]).toBe(RSI_PERIOD);
    });

    it('reports null while the series is still warming up, rather than guessing', () => {
        const rows = scan(ALL, { [SYM]: quote(SYM) }, undefined, EMPTY);
        expect(rows.find((r) => r.symbol === SYM)?.rsi).toBe(null);
    });

    it('the oversold preset selects on that RSI, so its result can change', () => {
        const preset = presetByKey('oversold');
        expect(preset, 'the oversold preset must exist').toBeTruthy();
        const quotes = { [SYM]: quote(SYM) };
        const crit = { ...preset!.criteria, markets: 'all' } as ScanCriteria;
        const oversold = scan(crit, quotes, undefined, seriesWith({ rsi: () => 5 }));
        const not = scan(crit, quotes, undefined, seriesWith({ rsi: () => 95 }));
        // A constant RSI made this preset return a fixed, immutable set.
        expect(oversold.length).toBeGreaterThan(0);
        expect(not.length).toBe(0);
    });
});

describe('S8.2 — breakout is judged against a real rolling range', () => {
    it('uses the supplied 24h high rather than a hardcoded one', () => {
        const quotes = { [SYM]: quote(SYM, { price: 100 }) };
        const near = scan({ ...ALL, nearHighPct: 1 } as ScanCriteria, quotes, undefined,
            seriesWith({ rolling24h: () => ({ high: 100.2, low: 90 }) }));
        const far = scan({ ...ALL, nearHighPct: 1 } as ScanCriteria, quotes, undefined,
            seriesWith({ rolling24h: () => ({ high: 200, low: 90 }) }));

        // The defect: comparing to a stale hardcoded high meant everything was
        // permanently "near its high" within minutes.
        expect(near.some((r) => r.symbol === SYM)).toBe(true);
        expect(far.some((r) => r.symbol === SYM)).toBe(false);
    });

    it('excludes a symbol with no range at all when the filter needs one', () => {
        const rows = scan({ ...ALL, nearHighPct: 1 } as ScanCriteria, { [SYM]: quote(SYM) }, undefined, EMPTY);
        expect(rows.some((r) => r.symbol === SYM)).toBe(false);
    });

    it('never reports a price above its own high as "near high"', () => {
        const rows = scan(ALL, { [SYM]: quote(SYM, { price: 150 }) }, undefined,
            seriesWith({ rolling24h: () => ({ high: 100, low: 90 }) }));
        expect(rows.find((r) => r.symbol === SYM)?.signals ?? []).not.toContain('Near high');
    });
});

describe('S8.3 — unknown metrics fail CLOSED', () => {
    it('excludes a row whose RSI is unknown when the filter is on RSI', () => {
        // The defect: `NaN < x` is false, so the old code admitted the row instead of
        // excluding it — a scan result about a number nobody had.
        const rows = scan({ ...ALL, rsiBelow: 30 } as ScanCriteria, { [SYM]: quote(SYM) }, undefined, EMPTY);
        expect(rows.some((r) => r.symbol === SYM)).toBe(false);
    });

    it.each([
        ['changeMin', { changeMin: 5 }],
        ['changeMax', { changeMax: -5 }],
        ['rsiAbove', { rsiAbove: 70 }],
        ['minVolume', { minVolume: 1e12 }],
    ])('excludes rather than admits when %s cannot be evaluated', (_label, crit) => {
        const broken = quote(SYM, { changePercent: Number.NaN, volume: Number.NaN });
        const rows = scan({ ...ALL, ...crit } as ScanCriteria, { [SYM]: broken }, undefined, EMPTY);
        expect(rows.some((r) => r.symbol === SYM)).toBe(false);
    });

    it('sorts unknown values last in BOTH directions', () => {
        const quotes = { [SYM]: quote(SYM), [OTHER]: quote(OTHER) };
        const series = seriesWith({ rsi: (s) => (s === SYM ? 50 : null) });
        for (const dir of ['asc', 'desc'] as const) {
            const rows = scan(ALL, quotes, { key: 'rsi', dir }, series)
                .filter((r) => r.symbol === SYM || r.symbol === OTHER);
            expect(rows.at(-1)?.symbol, `unknown must sort last when ${dir}`).toBe(OTHER);
        }
    });

    it('drops a symbol with no quote rather than using the catalog price', () => {
        // The catalog carries stale mock prices; a row built from one is a signal about a
        // number that was never real.
        const rows = scan(ALL, {}, undefined, seriesWith({ rsi: () => 50 }));
        expect(rows).toEqual([]);
    });
});

describe('the default series is really wired to the store', () => {
    // Injection alone would pass even if the default accessors pointed at nothing, so
    // this asserts the wiring rather than the logic.
    it('calls seriesStore when no series is supplied', async () => {
        vi.resetModules();
        const rsi = vi.fn(() => 42);
        const rolling24h = vi.fn(() => ({ high: 120, low: 80, coverageMs: 86_400_000 }));
        vi.doMock('@/stores/seriesStore', () => ({ rsi, rolling24h, barCount: () => 500 }));

        const { scan: freshScan } = await import('./scanner');
        const rows = freshScan(ALL, { [SYM]: quote(SYM) });

        expect(rsi, 'the default RSI accessor must reach seriesStore').toHaveBeenCalled();
        expect(rows.find((r) => r.symbol === SYM)?.rsi).toBe(42);
        vi.doUnmock('@/stores/seriesStore');
    });
});
