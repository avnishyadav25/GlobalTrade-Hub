// Market scanner: evaluates filters across the instrument universe using live
// quotes plus indicators computed from OBSERVED price history (see stores/seriesStore).
//
// Previously RSI came from `generateCandleData`, whose PRNG is seeded only by the
// symbol string — so every symbol's RSI was a constant that never moved, and the
// oversold/overbought presets returned a fixed set forever. Breakouts compared the
// live price against a hardcoded `high24h`, which the random walk drifted past within
// minutes, making every instrument permanently a "breakout".

import { allInstruments } from './instruments';
import { rsi as seriesRsi, rolling24h, barCount } from '@/stores/seriesStore';
import type { LiveQuote } from '@/stores/marketStore';
import type { Market } from './constants';

export const RSI_PERIOD = 14;

export interface ScanCriteria {
    markets: Market[] | 'all';
    changeMin?: number;   // % change >=
    changeMax?: number;   // % change <=
    rsiBelow?: number;
    rsiAbove?: number;
    minVolume?: number;
    nearHighPct?: number; // within X% of the rolling 24h high (breakout)
}

export interface ScanRow {
    symbol: string;
    name: string;
    market: Market;
    price: number;
    changePercent: number;
    /** null while the rolling series is still warming up. */
    rsi: number | null;
    volume: number;
    signals: string[];
}

export type SortDir = 'asc' | 'desc';

export const SCAN_PRESETS: {
    key: string;
    label: string;
    criteria: ScanCriteria;
    sort: { key: 'changePercent' | 'rsi'; dir: SortDir };
}[] = [
    { key: 'gainers', label: 'Top gainers', criteria: { markets: 'all', changeMin: 0.5 }, sort: { key: 'changePercent', dir: 'desc' } },
    // Ascending: "Top losers" used to list the LEAST negative mover first because the
    // sort was hardcoded descending for every preset.
    { key: 'losers', label: 'Top losers', criteria: { markets: 'all', changeMax: -0.5 }, sort: { key: 'changePercent', dir: 'asc' } },
    { key: 'oversold', label: 'Oversold (RSI<35)', criteria: { markets: 'all', rsiBelow: 35 }, sort: { key: 'rsi', dir: 'asc' } },
    { key: 'overbought', label: 'Overbought (RSI>65)', criteria: { markets: 'all', rsiAbove: 65 }, sort: { key: 'rsi', dir: 'desc' } },
    { key: 'breakout', label: 'Breakouts', criteria: { markets: 'all', nearHighPct: 0.5 }, sort: { key: 'changePercent', dir: 'desc' } },
];

export function presetByKey(key: string) {
    return SCAN_PRESETS.find((p) => p.key === key);
}

/** How many symbols have enough history for RSI yet. Used to explain an empty table. */
export function warmupStatus(): { ready: number; total: number } {
    const universe = allInstruments();
    let ready = 0;
    for (const a of universe) if (barCount(a.symbol) >= RSI_PERIOD + 1) ready++;
    return { ready, total: universe.length };
}

const finite = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

export function scan(
    criteria: ScanCriteria,
    quotes: Record<string, LiveQuote>,
    sort: { key: 'changePercent' | 'rsi'; dir: SortDir } = { key: 'changePercent', dir: 'desc' }
): ScanRow[] {
    const rows: ScanRow[] = [];

    for (const a of allInstruments()) {
        if (criteria.markets !== 'all' && !criteria.markets.includes(a.market)) continue;
        const q = quotes[a.symbol];
        // No quote means no row. The catalog's `a.price` is stale mock data, and a scan
        // result built from it is a signal about a number that was never real.
        if (!q) continue;
        const price = q.price;
        const changePercent = q.changePercent;
        const volume = q?.volume ?? a.volume;
        const rsi = seriesRsi(a.symbol, RSI_PERIOD);
        const range = rolling24h(a.symbol);
        const high = range?.high;

        // Every comparison fails CLOSED: a row whose metric is unknown is excluded
        // rather than admitted. The old `(high-price)/high > x` test let NaN through,
        // because `NaN > x` is false.
        if (finite(criteria.changeMin) && !(finite(changePercent) && changePercent >= criteria.changeMin)) continue;
        if (finite(criteria.changeMax) && !(finite(changePercent) && changePercent <= criteria.changeMax)) continue;
        if (finite(criteria.rsiBelow) && !(finite(rsi) && rsi < criteria.rsiBelow)) continue;
        if (finite(criteria.rsiAbove) && !(finite(rsi) && rsi > criteria.rsiAbove)) continue;
        if (finite(criteria.minVolume) && !(finite(volume) && volume >= criteria.minVolume)) continue;
        if (finite(criteria.nearHighPct)) {
            if (!finite(high) || high <= 0 || !finite(price)) continue;
            const distancePct = ((high - price) / high) * 100;
            if (!(distancePct >= 0 && distancePct <= criteria.nearHighPct)) continue;
        }

        const signals: string[] = [];
        if (finite(rsi) && rsi < 35) signals.push('Oversold');
        if (finite(rsi) && rsi > 65) signals.push('Overbought');
        if (finite(high) && high > 0) {
            const d = ((high - price) / high) * 100;
            if (d >= 0 && d <= 0.5) signals.push('Near high');
        }
        if (finite(changePercent) && changePercent >= 2) signals.push('Momentum');

        rows.push({ symbol: a.symbol, name: a.name, market: a.market, price, changePercent, rsi, volume, signals });
    }

    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((x, y) => {
        const ax = sort.key === 'rsi' ? x.rsi : x.changePercent;
        const by = sort.key === 'rsi' ? y.rsi : y.changePercent;
        // Unknown values sort last regardless of direction.
        if (!finite(ax) && !finite(by)) return 0;
        if (!finite(ax)) return 1;
        if (!finite(by)) return -1;
        return (ax - by) * dir;
    });
}
