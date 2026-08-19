// Instrument catalog + seed data for the trading platform.
//
// CURRENCY MODEL — read before adding an instrument.
// For a pair BASE/QUOTE the price is QUOTE units per 1 BASE and quantity is in BASE
// units, so notional in the quote currency is always `qty * price`. `quoteCcy` is that
// quote currency and it is NOT implied by the market: USD/JPY sits in the forex market
// but is quoted in JPY. Getting this wrong is what made USD/JPY value ~159x too high.

import { MARKETS, type Market } from './constants';
import { lookup } from './instruments';

/** Currencies any instrument can be quoted in. Base currency of the book is INR. */
export type Currency = 'INR' | 'USD' | 'JPY';

export interface Asset {
    symbol: string;      // display symbol, e.g. BTC/USDT, RELIANCE, EUR/USD
    name: string;
    market: Market;
    exchange: string;
    /** Currency this instrument's price is expressed in. See the note above. */
    quoteCcy: Currency;
    /** Whether fractional quantities are tradeable (crypto/FX yes, shares no). */
    fractional: boolean;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    high24h: number;
    low24h: number;
    marketCap?: number;
}

export const WATCHLIST_ASSETS: Asset[] = [
    // ---- Crypto ----
    { symbol: 'BTC/USDT', name: 'Bitcoin', market: MARKETS.CRYPTO, exchange: 'Binance', quoteCcy: 'USD', fractional: true, price: 67841.2, change: 831.4, changePercent: 1.24, volume: 1.2e9, high24h: 68090, low24h: 66840, marketCap: 1.33e12 },
    { symbol: 'ETH/USDT', name: 'Ethereum', market: MARKETS.CRYPTO, exchange: 'Binance', quoteCcy: 'USD', fractional: true, price: 3512.8, change: 71.6, changePercent: 2.08, volume: 6.4e8, high24h: 3560, low24h: 3410, marketCap: 4.2e11 },
    { symbol: 'SOL/USDT', name: 'Solana', market: MARKETS.CRYPTO, exchange: 'Binance', quoteCcy: 'USD', fractional: true, price: 172.35, change: 9.1, changePercent: 5.58, volume: 2.8e8, high24h: 178, low24h: 160, marketCap: 7.6e10 },
    // ---- India (NSE) ----
    { symbol: 'NIFTY 50', name: 'Nifty 50 Index', market: MARKETS.INDIA, exchange: 'NSE', quoteCcy: 'INR', fractional: false, price: 24318, change: 75.2, changePercent: 0.31, volume: 0, high24h: 24380, low24h: 24210 },
    { symbol: 'RELIANCE', name: 'Reliance Industries', market: MARKETS.INDIA, exchange: 'NSE', quoteCcy: 'INR', fractional: false, price: 2945.6, change: -13.6, changePercent: -0.46, volume: 8.9e6, high24h: 2980, low24h: 2932, marketCap: 1.99e13 },
    { symbol: 'TATASTEEL', name: 'Tata Steel Ltd', market: MARKETS.INDIA, exchange: 'NSE', quoteCcy: 'INR', fractional: false, price: 142.35, change: 2.45, changePercent: 1.75, volume: 1.25e7, high24h: 144.5, low24h: 139.8, marketCap: 1.75e12 },
    { symbol: 'INFY', name: 'Infosys Ltd', market: MARKETS.INDIA, exchange: 'NSE', quoteCcy: 'INR', fractional: false, price: 1845.25, change: 28.5, changePercent: 1.57, volume: 5.6e6, high24h: 1860, low24h: 1810, marketCap: 7.68e12 },
    // ---- US ----
    { symbol: 'AAPL', name: 'Apple Inc.', market: MARKETS.US, exchange: 'NASDAQ', quoteCcy: 'USD', fractional: false, price: 213.4, change: 1.31, changePercent: 0.62, volume: 4.5e7, high24h: 215.2, low24h: 211.5, marketCap: 3.3e12 },
    { symbol: 'TSLA', name: 'Tesla Inc.', market: MARKETS.US, exchange: 'NASDAQ', quoteCcy: 'USD', fractional: false, price: 248.5, change: -4.68, changePercent: -1.85, volume: 7.8e7, high24h: 258, low24h: 245, marketCap: 7.9e11 },
    { symbol: 'NVDA', name: 'NVIDIA Corp', market: MARKETS.US, exchange: 'NASDAQ', quoteCcy: 'USD', fractional: false, price: 124.72, change: 3.24, changePercent: 2.67, volume: 3.5e8, high24h: 126.5, low24h: 120.1, marketCap: 3.05e12 },
    // ---- Forex ----
    { symbol: 'EUR/USD', name: 'Euro / US Dollar', market: MARKETS.FOREX, exchange: 'FX', quoteCcy: 'USD', fractional: true, price: 1.0842, change: -0.0013, changePercent: -0.12, volume: 0, high24h: 1.0871, low24h: 1.0828 },
    { symbol: 'GBP/USD', name: 'Pound / US Dollar', market: MARKETS.FOREX, exchange: 'FX', quoteCcy: 'USD', fractional: true, price: 1.2712, change: 0.0021, changePercent: 0.17, volume: 0, high24h: 1.2744, low24h: 1.2689 },
    { symbol: 'USD/JPY', name: 'US Dollar / Yen', market: MARKETS.FOREX, exchange: 'FX', quoteCcy: 'JPY', fractional: true, price: 156.82, change: 0.44, changePercent: 0.28, volume: 0, high24h: 157.1, low24h: 156.2 },
    // ---- Commodities ----
    { symbol: 'XAU/USD', name: 'Gold Spot', market: MARKETS.COMMODITY, exchange: 'COMEX', quoteCcy: 'USD', fractional: true, price: 2331.5, change: 17.1, changePercent: 0.74, volume: 0, high24h: 2342, low24h: 2312 },
    { symbol: 'XAG/USD', name: 'Silver Spot', market: MARKETS.COMMODITY, exchange: 'COMEX', quoteCcy: 'USD', fractional: true, price: 29.44, change: -0.21, changePercent: -0.71, volume: 0, high24h: 29.9, low24h: 29.1 },
    { symbol: 'WTI/USD', name: 'Crude Oil WTI', market: MARKETS.COMMODITY, exchange: 'NYMEX', quoteCcy: 'USD', fractional: true, price: 78.62, change: 0.63, changePercent: 0.81, volume: 0, high24h: 79.2, low24h: 77.5 },
];

/**
 * Reference instruments: data sources, not things you trade.
 *
 * These are seeded into the registry so they can be fetched, charted and fed to a
 * strategy — but they are deliberately NOT in WATCHLIST_ASSETS, because that array
 * also builds every new user's default watchlist. India VIX is an index you cannot
 * buy, and the crack-spread legs are inputs to a spread rather than positions anyone
 * takes on their own.
 *
 * The `price` values here are placeholders that the live feed replaces; nothing renders
 * them, because the UI only shows a price once a real quote has arrived.
 */
export const REFERENCE_ASSETS: Asset[] = [
    { symbol: '^INDIAVIX', name: 'India VIX', market: MARKETS.INDIA, exchange: 'NSE', quoteCcy: 'INR', fractional: false, price: 0, change: 0, changePercent: 0, volume: 0, high24h: 0, low24h: 0 },
    { symbol: 'RBOB/USD', name: 'RBOB Gasoline', market: MARKETS.COMMODITY, exchange: 'NYMEX', quoteCcy: 'USD', fractional: true, price: 0, change: 0, changePercent: 0, volume: 0, high24h: 0, low24h: 0 },
    { symbol: 'HO/USD', name: 'Heating Oil', market: MARKETS.COMMODITY, exchange: 'NYMEX', quoteCcy: 'USD', fractional: true, price: 0, change: 0, changePercent: 0, volume: 0, high24h: 0, low24h: 0 },
];

/**
 * Resolve an instrument. Backed by the registry in ./instruments so user-added
 * symbols are tradeable; the seed set is identical, so behaviour is unchanged for
 * everything that shipped in WATCHLIST_ASSETS.
 */
export function getAsset(symbol: string): Asset | undefined {
    return lookup(symbol);
}

export interface Candle {
    time: number; // unix seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

// Deterministic-ish OHLC generator for charts (seeded by symbol for stable initial render)
export function generateCandleData(symbol: string, count = 120, seconds = 900): Candle[] {
    const base = getAsset(symbol)?.price ?? 100;
    const now = Math.floor(Date.now() / 1000);
    let seed = 0;
    for (let i = 0; i < symbol.length; i++) seed = (seed * 31 + symbol.charCodeAt(i)) % 233280;
    const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
    const candles: Candle[] = [];
    let price = base * (0.94 + rnd() * 0.04);
    const vol = base * 0.012;
    for (let i = count; i >= 0; i--) {
        const time = now - i * seconds;
        const open = price;
        price = Math.max(base * 0.5, price + (rnd() - 0.47) * vol);
        const close = price;
        const high = Math.max(open, close) + rnd() * vol * 0.6;
        const low = Math.min(open, close) - rnd() * vol * 0.6;
        candles.push({
            time,
            open: +open.toFixed(4),
            high: +high.toFixed(4),
            low: +low.toFixed(4),
            close: +close.toFixed(4),
            volume: Math.round(rnd() * 1e6),
        });
    }
    return candles;
}

export function generateOrderBook(currentPrice: number, depth = 12) {
    const bids = [];
    const asks = [];
    for (let i = 0; i < depth; i++) {
        const bidPrice = currentPrice * (1 - (i + 1) * 0.0006);
        const askPrice = currentPrice * (1 + (i + 1) * 0.0006);
        const bidQty = Math.random() * 10 + 0.5;
        const askQty = Math.random() * 10 + 0.5;
        bids.push({ price: +bidPrice.toFixed(2), quantity: +bidQty.toFixed(4), total: +(bidPrice * bidQty).toFixed(2) });
        asks.push({ price: +askPrice.toFixed(2), quantity: +askQty.toFixed(4), total: +(askPrice * askQty).toFixed(2) });
    }
    return { bids, asks };
}
