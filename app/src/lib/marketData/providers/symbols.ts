import 'server-only';

/**
 * App symbol -> provider symbol.
 *
 * Verified live against each provider rather than assumed: Yahoo covers the whole
 * instrument universe keylessly (India .NS, futures =F, FX =X, crypto -USD), which
 * is why it is the universal fallback.
 */
export const YAHOO_SYMBOLS: Record<string, string> = {
    'BTC/USDT': 'BTC-USD',
    'ETH/USDT': 'ETH-USD',
    'SOL/USDT': 'SOL-USD',
    'NIFTY 50': '^NSEI',
    RELIANCE: 'RELIANCE.NS',
    TATASTEEL: 'TATASTEEL.NS',
    INFY: 'INFY.NS',
    AAPL: 'AAPL',
    TSLA: 'TSLA',
    NVDA: 'NVDA',
    'EUR/USD': 'EURUSD=X',
    'GBP/USD': 'GBPUSD=X',
    'USD/JPY': 'JPY=X',      // Yahoo expresses USD/JPY as JPY=X
    'XAU/USD': 'GC=F',       // COMEX gold future
    'XAG/USD': 'SI=F',       // COMEX silver future
    'WTI/USD': 'CL=F',       // NYMEX crude future
    'USD/INR': 'USDINR=X',   // not tradeable here — used for ₹ conversion

    // Reference series: fetched and charted, never in the default watchlist.
    '^INDIAVIX': '^INDIAVIX', // verified: 400 daily bars, 595 days of history
    'RBOB/USD': 'RB=F',       // NYMEX gasoline — the crack spread's product leg
    'HO/USD': 'HO=F',         // NYMEX heating oil
};

/** Binance spot pairs. */
export const BINANCE_SYMBOLS: Record<string, string> = {
    'BTC/USDT': 'BTCUSDT',
    'ETH/USDT': 'ETHUSDT',
    'SOL/USDT': 'SOLUSDT',
};

/** Finnhub free tier covers US equities only (forex and .NS return 403). */
export const FINNHUB_SYMBOLS: Record<string, string> = {
    AAPL: 'AAPL',
    TSLA: 'TSLA',
    NVDA: 'NVDA',
};
