import 'server-only';
import type { BrokerConnector, Credentials, PlaceOrderRequest, PlaceOrderResult, VerifyResult } from './types';
import { getAsset } from '@/lib/mockData';

const BASE = 'https://api.dhan.co/v2';

export const dhan: BrokerConnector = {
    id: 'dhan',
    // Dhan has no sandbox: "paper" here would be a live account, so it is refused.
    supports: (mode) => mode === 'live',

    async verify(creds): Promise<VerifyResult> {
        if (!creds.clientId || !creds.accessToken) {
            return { ok: false, reason: 'Client ID and access token are required. Note DHANHQ_API_KEY/_SECRET are partner credentials, not these.' };
        }
        try {
            const res = await fetch(`${BASE}/fundlimit`, {
                headers: { 'access-token': creds.accessToken, 'client-id': creds.clientId, accept: 'application/json' },
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return { ok: false, reason: data.errorMessage ?? `Dhan returned ${res.status}.` };
            return { ok: true, accountRef: creds.clientId };
        } catch (e) {
            return { ok: false, reason: `Could not reach Dhan: ${e instanceof Error ? e.message : 'network error'}` };
        }
    },

    toBrokerSymbol(symbol) {
        // Dhan orders key off a numeric securityId, which needs its instrument master.
        // Returning null keeps this honest instead of sending a symbol that will 400.
        return getAsset(symbol)?.market === 'india' ? symbol : null;
    },

    async placeOrder(): Promise<PlaceOrderResult> {
        return {
            ok: false,
            reason: 'Dhan order routing needs the instrument master to map symbols to securityId. Not implemented.',
        };
    },
};
