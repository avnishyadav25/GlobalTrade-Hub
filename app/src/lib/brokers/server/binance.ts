import 'server-only';
import { createHmac } from 'node:crypto';
import type { BrokerConnector, Credentials, PlaceOrderRequest, PlaceOrderResult, VerifyResult } from './types';

// Testnet keys are SEPARATE from mainnet keys. Paper mode targets the Spot Testnet,
// so mainnet credentials will legitimately fail there — that is reported honestly
// rather than silently falling back to mainnet with real money.
const BASE = {
    paper: 'https://testnet.binance.vision',
    live: 'https://api.binance.com',
};

const SYMBOLS: Record<string, string> = {
    'BTC/USDT': 'BTCUSDT',
    'ETH/USDT': 'ETHUSDT',
    'SOL/USDT': 'SOLUSDT',
};

function sign(query: string, secret: string): string {
    return createHmac('sha256', secret).update(query).digest('hex');
}

async function signedGet(base: string, path: string, creds: Credentials, params: Record<string, string> = {}) {
    const query = new URLSearchParams({ ...params, timestamp: String(Date.now()), recvWindow: '5000' }).toString();
    const signature = sign(query, creds.apiSecret ?? '');
    return fetch(`${base}${path}?${query}&signature=${signature}`, {
        headers: { 'X-MBX-APIKEY': creds.apiKey ?? '' },
        cache: 'no-store',
    });
}

export const binance: BrokerConnector = {
    id: 'binance',
    supports: () => true,

    async verify(creds, mode): Promise<VerifyResult> {
        if (!creds.apiKey || !creds.apiSecret) return { ok: false, reason: 'API key and secret are required.' };
        try {
            const res = await signedGet(BASE[mode], '/api/v3/account', creds);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const hint = mode === 'paper'
                    ? ' Binance Spot Testnet uses its own keys from testnet.binance.vision — mainnet keys will not work here.'
                    : '';
                return { ok: false, reason: `${data.msg ?? `Binance returned ${res.status}`}.${hint}` };
            }
            const usdt = (data.balances ?? []).find((b: { asset: string }) => b.asset === 'USDT');
            return { ok: true, accountRef: usdt ? `USDT ${Number(usdt.free).toFixed(2)}` : 'spot account' };
        } catch (e) {
            return { ok: false, reason: `Could not reach Binance: ${e instanceof Error ? e.message : 'network error'}` };
        }
    },

    toBrokerSymbol(symbol) {
        return SYMBOLS[symbol] ?? null;
    },

    async placeOrder(creds, mode, req): Promise<PlaceOrderResult> {
        const brokerSymbol = binance.toBrokerSymbol(req.symbol);
        if (!brokerSymbol) return { ok: false, reason: `${req.symbol} is not tradeable on Binance spot.` };
        try {
            const params: Record<string, string> = {
                symbol: brokerSymbol,
                side: req.side.toUpperCase(),
                type: req.type.toUpperCase(),
                quantity: String(req.qty),
            };
            if (req.type === 'limit') {
                params.price = String(req.limitPrice);
                params.timeInForce = 'GTC';
            }
            const query = new URLSearchParams({ ...params, timestamp: String(Date.now()), recvWindow: '5000' }).toString();
            const signature = sign(query, creds.apiSecret ?? '');
            const res = await fetch(`${BASE[mode]}/api/v3/order?${query}&signature=${signature}`, {
                method: 'POST',
                headers: { 'X-MBX-APIKEY': creds.apiKey ?? '' },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return { ok: false, reason: data.msg ?? `Binance returned ${res.status}.` };
            return { ok: true, brokerOrderId: String(data.orderId), status: data.status };
        } catch (e) {
            return { ok: false, reason: e instanceof Error ? e.message : 'network error' };
        }
    },
};
