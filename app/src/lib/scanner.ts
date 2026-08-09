// Market scanner: evaluates filters across the instrument universe using live
// quotes plus indicators computed from candle history.

import { WATCHLIST_ASSETS, generateCandleData, getAsset } from './mockData';
import type { LiveQuote } from '@/stores/marketStore';
import type { Market } from './constants';

export interface ScanCriteria {
    markets: Market[] | 'all';
    changeMin?: number;   // % change >=
    changeMax?: number;   // % change <=
    rsiBelow?: number;
    rsiAbove?: number;
    minVolume?: number;
    nearHighPct?: number; // within X% of 24h high (breakout)
}

export interface ScanRow {
    symbol: string;
    name: string;
    market: Market;
    price: number;
    changePercent: number;
    rsi: number;
    volume: number;
    signals: string[];
}

export const SCAN_PRESETS: { key: string; label: string; criteria: ScanCriteria }[] = [
    { key: 'gainers', label: 'Top gainers', criteria: { markets: 'all', changeMin: 0.5 } },
    { key: 'losers', label: 'Top losers', criteria: { markets: 'all', changeMax: -0.5 } },
    { key: 'oversold', label: 'Oversold (RSI<35)', criteria: { markets: 'all', rsiBelow: 35 } },
    { key: 'overbought', label: 'Overbought (RSI>65)', criteria: { markets: 'all', rsiAbove: 65 } },
    { key: 'breakout', label: 'Breakouts', criteria: { markets: 'all', nearHighPct: 0.5 } },
];

function rsi14(symbol: string): number {
    const closes = generateCandleData(symbol, 40, 900).map((c) => c.close);
    const period = 14;
    let gain = 0, loss = 0;
    for (let i = 1; i <= period; i++) {
        const d = closes[i] - closes[i - 1];
        if (d >= 0) gain += d; else loss -= d;
    }
    gain /= period; loss /= period;
    for (let i = period + 1; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        gain = (gain * (period - 1) + Math.max(0, d)) / period;
        loss = (loss * (period - 1) + Math.max(0, -d)) / period;
    }
    return 100 - 100 / (1 + gain / (loss || 1e-9));
}

export function scan(criteria: ScanCriteria, quotes: Record<string, LiveQuote>): ScanRow[] {
    const rows: ScanRow[] = [];
    for (const a of WATCHLIST_ASSETS) {
        if (criteria.markets !== 'all' && !criteria.markets.includes(a.market)) continue;
        const q = quotes[a.symbol];
        const price = q?.price ?? a.price;
        const changePercent = q?.changePercent ?? a.changePercent;
        const volume = q?.volume ?? a.volume;
        const rsi = rsi14(a.symbol);
        const high = getAsset(a.symbol)?.high24h ?? price;

        if (criteria.changeMin != null && changePercent < criteria.changeMin) continue;
        if (criteria.changeMax != null && changePercent > criteria.changeMax) continue;
        if (criteria.rsiBelow != null && rsi >= criteria.rsiBelow) continue;
        if (criteria.rsiAbove != null && rsi <= criteria.rsiAbove) continue;
        if (criteria.minVolume != null && volume < criteria.minVolume) continue;
        if (criteria.nearHighPct != null && (high - price) / high * 100 > criteria.nearHighPct) continue;

        const signals: string[] = [];
        if (rsi < 35) signals.push('Oversold');
        if (rsi > 65) signals.push('Overbought');
        if ((high - price) / high * 100 <= 0.5) signals.push('Near high');
        if (changePercent >= 2) signals.push('Momentum');

        rows.push({ symbol: a.symbol, name: a.name, market: a.market, price, changePercent, rsi, volume, signals });
    }
    return rows.sort((a, b) => b.changePercent - a.changePercent);
}
