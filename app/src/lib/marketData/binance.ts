// Real crypto market-data feed via Binance public WebSocket (no key required).
//
// Only covers crypto symbols; other markets keep a light simulation so the whole board
// still moves. Enabled by default; set NEXT_PUBLIC_ENABLE_BINANCE_FEED=false for pure
// simulation.
//
// The socket reports its ACTUAL state through `onStatus`. Previously the store set
// `usingRealFeed = true` the moment the feed was attached, so a failed connection left
// the header showing a green "LIVE" badge over simulated prices — and because
// `new WebSocket()` does not throw, the caller's try/catch fallback never fired and
// crypto prices froze permanently with no reconnect.

import type { LiveQuote } from '@/stores/marketStore';

type Push = (q: Partial<LiveQuote> & { symbol: string }) => void;
type Get = (symbol: string) => LiveQuote | undefined;
type Status = (connected: boolean) => void;

const CRYPTO_MAP: Record<string, string> = {
    'BTC/USDT': 'btcusdt',
    'ETH/USDT': 'ethusdt',
    'SOL/USDT': 'solusdt',
};
const REVERSE = Object.fromEntries(Object.entries(CRYPTO_MAP).map(([k, v]) => [v.toUpperCase(), k]));

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 60_000;

export function createBinanceFeed(symbols: string[], push: Push, getQuote: Get, onStatus?: Status): () => void {
    const cryptoStreams = symbols.filter((s) => CRYPTO_MAP[s]).map((s) => `${CRYPTO_MAP[s]}@miniTicker`);
    const cryptoSymbols = symbols.filter((s) => CRYPTO_MAP[s]);
    const others = symbols.filter((s) => !CRYPTO_MAP[s]);

    let ws: WebSocket | null = null;
    let closed = false;
    let connected = false;
    let attempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const setConnected = (v: boolean) => {
        if (connected === v) return;
        connected = v;
        onStatus?.(v);
    };

    const connect = () => {
        if (closed || typeof WebSocket === 'undefined' || !cryptoStreams.length) return;
        const url = `wss://stream.binance.com:9443/stream?streams=${cryptoStreams.join('/')}`;
        try {
            ws = new WebSocket(url);
        } catch {
            scheduleReconnect();
            return;
        }

        ws.onopen = () => {
            attempts = 0;
            setConnected(true);
        };

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

        ws.onerror = () => setConnected(false);

        ws.onclose = () => {
            setConnected(false);
            scheduleReconnect();
        };
    };

    const scheduleReconnect = () => {
        if (closed || reconnectTimer) return;
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempts);
        attempts++;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, delay);
    };

    connect();

    // Keep the board moving: non-crypto always simulates, and crypto simulates too
    // whenever the socket is down, rather than freezing at its last value.
    const timer = setInterval(() => {
        const simulate = connected ? others : [...others, ...cryptoSymbols];
        for (const symbol of simulate) {
            const cur = getQuote(symbol);
            if (!cur) continue;
            const isFx = symbol.includes('/') && (symbol.startsWith('EUR') || symbol.startsWith('GBP') || symbol.startsWith('USD'));
            const volPct = isFx ? 0.0004 : 0.0016;
            const price = Math.max(0.0001, cur.price * (1 + (Math.random() - 0.5) * 2 * volPct));
            push({ symbol, price });
        }
    }, 1200);

    return () => {
        closed = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (ws) {
            ws.onmessage = null;
            ws.onopen = null;
            ws.onerror = null;
            ws.onclose = null;
            ws.close();
        }
        clearInterval(timer);
    };
}
