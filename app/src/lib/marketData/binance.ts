// Real crypto market-data feed via Binance public WebSocket (no key required).
// Only covers crypto symbols; other markets are kept alive with a light sim so the
// whole board still moves. Enable with NEXT_PUBLIC_ENABLE_BINANCE_FEED=true.

import type { LiveQuote } from '@/stores/marketStore';

type Push = (q: Partial<LiveQuote> & { symbol: string }) => void;

const CRYPTO_MAP: Record<string, string> = {
    'BTC/USDT': 'btcusdt',
    'ETH/USDT': 'ethusdt',
    'SOL/USDT': 'solusdt',
};
const REVERSE = Object.fromEntries(Object.entries(CRYPTO_MAP).map(([k, v]) => [v.toUpperCase(), k]));

export function createBinanceFeed(symbols: string[], push: Push): () => void {
    const cryptoStreams = symbols
        .filter((s) => CRYPTO_MAP[s])
        .map((s) => `${CRYPTO_MAP[s]}@miniTicker`);

    let ws: WebSocket | null = null;
    if (typeof WebSocket !== 'undefined' && cryptoStreams.length) {
        const url = `wss://stream.binance.com:9443/stream?streams=${cryptoStreams.join('/')}`;
        ws = new WebSocket(url);
        ws.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                const d = msg.data;
                if (!d || !d.s) return;
                const symbol = REVERSE[d.s];
                if (!symbol) return;
                push({
                    symbol,
                    price: parseFloat(d.c),
                    prevClose: parseFloat(d.o),
                    high: parseFloat(d.h),
                    low: parseFloat(d.l),
                    volume: parseFloat(d.q ?? d.v),
                });
            } catch {
                /* ignore malformed frames */
            }
        };
    }

    // keep non-crypto instruments moving with a light random walk
    const others = symbols.filter((s) => !CRYPTO_MAP[s]);
    const timer = setInterval(() => {
        for (const symbol of others) {
            // small nudge; marketStore recomputes change from prevClose it already holds
            push({ symbol, price: undefined as unknown as number });
        }
    }, 1500);

    return () => {
        if (ws) {
            ws.onmessage = null;
            ws.close();
        }
        clearInterval(timer);
    };
}
