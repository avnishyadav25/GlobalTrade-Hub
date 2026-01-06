// Mock data for the trading platform

import { MARKETS, type Market } from './constants';

export interface Asset {
    symbol: string;
    name: string;
    market: Market;
    exchange: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    high24h: number;
    low24h: number;
    marketCap?: number;
}

export interface Position {
    id: string;
    symbol: string;
    name: string;
    market: Market;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
}

export interface Order {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop_loss' | 'stop_limit';
    quantity: number;
    price?: number;
    status: 'pending' | 'filled' | 'cancelled' | 'rejected';
    filledAt?: string;
    createdAt: string;
}

export const WATCHLIST_ASSETS: Asset[] = [
    // Indian Equities
    {
        symbol: 'TATASTEEL',
        name: 'Tata Steel Ltd',
        market: MARKETS.INDIA,
        exchange: 'NSE',
        price: 142.35,
        change: 2.45,
        changePercent: 1.75,
        volume: 12500000,
        high24h: 144.50,
        low24h: 139.80,
        marketCap: 175000000000,
    },
    {
        symbol: 'RELIANCE',
        name: 'Reliance Industries',
        market: MARKETS.INDIA,
        exchange: 'NSE',
        price: 2456.80,
        change: -15.20,
        changePercent: -0.62,
        volume: 8900000,
        high24h: 2480.00,
        low24h: 2445.00,
        marketCap: 1660000000000,
    },
    {
        symbol: 'INFY',
        name: 'Infosys Ltd',
        market: MARKETS.INDIA,
        exchange: 'NSE',
        price: 1845.25,
        change: 28.50,
        changePercent: 1.57,
        volume: 5600000,
        high24h: 1860.00,
        low24h: 1810.00,
        marketCap: 768000000000,
    },
    // US Stocks
    {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        market: MARKETS.US,
        exchange: 'NASDAQ',
        price: 185.92,
        change: 3.45,
        changePercent: 1.89,
        volume: 45000000,
        high24h: 187.50,
        low24h: 183.20,
        marketCap: 2900000000000,
    },
    {
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        market: MARKETS.US,
        exchange: 'NASDAQ',
        price: 248.50,
        change: -8.75,
        changePercent: -3.40,
        volume: 78000000,
        high24h: 258.00,
        low24h: 245.00,
        marketCap: 790000000000,
    },
    {
        symbol: 'NVDA',
        name: 'NVIDIA Corp',
        market: MARKETS.US,
        exchange: 'NASDAQ',
        price: 495.22,
        change: 12.88,
        changePercent: 2.67,
        volume: 35000000,
        high24h: 498.50,
        low24h: 480.00,
        marketCap: 1220000000000,
    },
    // Crypto
    {
        symbol: 'BTCUSDT',
        name: 'Bitcoin',
        market: MARKETS.CRYPTO,
        exchange: 'Binance',
        price: 43250.00,
        change: 850.00,
        changePercent: 2.00,
        volume: 28000000000,
        high24h: 43800.00,
        low24h: 42100.00,
        marketCap: 847000000000,
    },
    {
        symbol: 'ETHUSDT',
        name: 'Ethereum',
        market: MARKETS.CRYPTO,
        exchange: 'Binance',
        price: 2285.50,
        change: -45.30,
        changePercent: -1.94,
        volume: 12000000000,
        high24h: 2350.00,
        low24h: 2260.00,
        marketCap: 275000000000,
    },
    {
        symbol: 'SOLUSDT',
        name: 'Solana',
        market: MARKETS.CRYPTO,
        exchange: 'Binance',
        price: 98.45,
        change: 5.20,
        changePercent: 5.58,
        volume: 2800000000,
        high24h: 102.00,
        low24h: 92.50,
        marketCap: 42500000000,
    },
];

export const MOCK_POSITIONS: Position[] = [
    {
        id: '1',
        symbol: 'BTCUSDT',
        name: 'Bitcoin',
        market: MARKETS.CRYPTO,
        quantity: 0.5,
        avgPrice: 41000.00,
        currentPrice: 43250.00,
        pnl: 1125.00,
        pnlPercent: 5.49,
    },
    {
        id: '2',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        market: MARKETS.US,
        quantity: 50,
        avgPrice: 175.00,
        currentPrice: 185.92,
        pnl: 546.00,
        pnlPercent: 6.24,
    },
    {
        id: '3',
        symbol: 'RELIANCE',
        name: 'Reliance Industries',
        market: MARKETS.INDIA,
        quantity: 100,
        avgPrice: 2500.00,
        currentPrice: 2456.80,
        pnl: -4320.00,
        pnlPercent: -1.73,
    },
];

export const MOCK_ORDERS: Order[] = [
    {
        id: 'ord-001',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.1,
        price: 42000.00,
        status: 'pending',
        createdAt: '2026-01-06T10:30:00Z',
    },
    {
        id: 'ord-002',
        symbol: 'TSLA',
        side: 'sell',
        type: 'market',
        quantity: 10,
        status: 'filled',
        filledAt: '2026-01-06T09:15:00Z',
        createdAt: '2026-01-06T09:15:00Z',
    },
    {
        id: 'ord-003',
        symbol: 'TATASTEEL',
        side: 'buy',
        type: 'stop_loss',
        quantity: 200,
        price: 140.00,
        status: 'pending',
        createdAt: '2026-01-06T08:45:00Z',
    },
];

// Generate OHLCV candle data for charts
export function generateCandleData(symbol: string, count: number = 100) {
    const now = Date.now();
    const basePrice = WATCHLIST_ASSETS.find(a => a.symbol === symbol)?.price || 100;
    const candles = [];

    let currentPrice = basePrice * 0.95; // Start 5% lower

    for (let i = count; i >= 0; i--) {
        const time = Math.floor((now - i * 60000) / 1000); // 1-minute candles
        const volatility = 0.002 + Math.random() * 0.008; // 0.2% - 1% volatility

        const open = currentPrice;
        const changePercent = (Math.random() - 0.48) * volatility * 2;
        const close = open * (1 + changePercent);
        const high = Math.max(open, close) * (1 + Math.random() * volatility);
        const low = Math.min(open, close) * (1 - Math.random() * volatility);

        candles.push({
            time,
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
        });

        currentPrice = close;
    }

    return candles;
}

// Generate order book data
export function generateOrderBook(currentPrice: number, depth: number = 10) {
    const bids = [];
    const asks = [];

    for (let i = 0; i < depth; i++) {
        const bidPrice = currentPrice * (1 - (i + 1) * 0.001);
        const askPrice = currentPrice * (1 + (i + 1) * 0.001);
        const bidQty = Math.random() * 10 + 1;
        const askQty = Math.random() * 10 + 1;

        bids.push({
            price: parseFloat(bidPrice.toFixed(2)),
            quantity: parseFloat(bidQty.toFixed(4)),
            total: parseFloat((bidPrice * bidQty).toFixed(2)),
        });

        asks.push({
            price: parseFloat(askPrice.toFixed(2)),
            quantity: parseFloat(askQty.toFixed(4)),
            total: parseFloat((askPrice * askQty).toFixed(2)),
        });
    }

    return { bids, asks };
}
