import 'server-only';
import type { BrokerConnector, Credentials, BrokerMode, PlaceOrderRequest, PlaceOrderResult, VerifyResult } from './types';
import { getAsset } from '@/lib/mockData';

const BASE = {
    paper: 'https://paper-api.alpaca.markets',
    live: 'https://api.alpaca.markets',
};

function headers(creds: Credentials) {
    return {
        'APCA-API-KEY-ID': creds.keyId ?? '',
        'APCA-API-SECRET-KEY': creds.secretKey ?? '',
        'content-type': 'application/json',
    };
}

export const alpaca: BrokerConnector = {
    id: 'alpaca',
    supports: () => true,

    async verify(creds, mode): Promise<VerifyResult> {
        if (!creds.keyId || !creds.secretKey) return { ok: false, reason: 'API key id and secret are required.' };
        try {
            const res = await fetch(`${BASE[mode]}/v2/account`, { headers: headers(creds), cache: 'no-store' });
            if (res.status === 401 || res.status === 403) {
                return { ok: false, reason: `Alpaca rejected these ${mode} credentials (${res.status}). Paper and live keys are different.` };
            }
            if (!res.ok) return { ok: false, reason: `Alpaca returned ${res.status}.` };
            const data = await res.json();
            return { ok: true, accountRef: data.account_number ?? data.id };
        } catch (e) {
            return { ok: false, reason: `Could not reach Alpaca: ${e instanceof Error ? e.message : 'network error'}` };
        }
    },

    toBrokerSymbol(symbol) {
        // Alpaca trades plain US equity tickers only.
        return getAsset(symbol)?.market === 'us' ? symbol : null;
    },

    async placeOrder(creds, mode, req): Promise<PlaceOrderResult> {
        const brokerSymbol = alpaca.toBrokerSymbol(req.symbol);
        if (!brokerSymbol) return { ok: false, reason: `${req.symbol} is not tradeable on Alpaca.` };
        try {
            const res = await fetch(`${BASE[mode]}/v2/orders`, {
                method: 'POST',
                headers: headers(creds),
                body: JSON.stringify({
                    symbol: brokerSymbol,
                    qty: String(req.qty),
                    side: req.side,
                    type: req.type,
                    time_in_force: 'day',
                    ...(req.type === 'limit' ? { limit_price: String(req.limitPrice) } : {}),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return { ok: false, reason: data.message ?? `Alpaca returned ${res.status}.` };
            return { ok: true, brokerOrderId: data.id, status: data.status };
        } catch (e) {
            return { ok: false, reason: e instanceof Error ? e.message : 'network error' };
        }
    },
};
