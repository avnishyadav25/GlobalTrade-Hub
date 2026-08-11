import 'server-only';
import { cachedFetch } from '../cache';

// CoinGecko reference data for the crypto track.
//
// Free and keyless for these endpoints, with a published courtesy limit of roughly
// 10-30 calls a minute. Used for CONTEXT a price feed cannot give — circulating versus
// maximum supply, market capitalisation, category — not for prices, which come from
// Binance and are already real-time.

const PROVIDER = 'coingecko';
const LIMIT = { perMinute: 8, perDay: 2000 };

export interface CoinReference {
    id: string;
    symbol: string;
    name: string;
    marketCapUsd: number | null;
    circulatingSupply: number | null;
    /** Null when the token has no cap — an important difference, not a missing value. */
    maxSupply: number | null;
    totalSupply: number | null;
    /** How far below its all-time high it currently trades, as a negative percentage. */
    fromAllTimeHighPct: number | null;
    categories: string[];
}

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** App symbol ('BTC/USDT') to CoinGecko id. Kept small and explicit. */
const IDS: Record<string, string> = {
    'BTC/USDT': 'bitcoin',
    'ETH/USDT': 'ethereum',
    'SOL/USDT': 'solana',
};

export function coinIdFor(appSymbol: string): string | null {
    return IDS[appSymbol] ?? null;
}

export async function coinReference(appSymbol: string): Promise<CoinReference | null> {
    const id = coinIdFor(appSymbol);
    if (!id) return null;

    return cachedFetch<CoinReference>(
        // Supply and market cap move slowly; six hours is plenty and keeps the courtesy
        // limit comfortable.
        { provider: PROVIDER, key: `coin:${id}`, ttlMs: 6 * 3_600_000, limit: LIMIT },
        async () => {
            const res = await fetch(
                `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&community_data=false&developer_data=false`,
                { headers: { accept: 'application/json' }, cache: 'no-store' }
            );
            if (!res.ok) return null;

            const j = await res.json();
            const md = j?.market_data;
            if (!md) return null;

            return {
                id,
                symbol: String(j.symbol ?? '').toUpperCase(),
                name: String(j.name ?? id),
                marketCapUsd: numOrNull(md.market_cap?.usd),
                circulatingSupply: numOrNull(md.circulating_supply),
                // A null max supply means UNCAPPED, which is a meaningful property of the
                // token rather than an absent field.
                maxSupply: numOrNull(md.max_supply),
                totalSupply: numOrNull(md.total_supply),
                fromAllTimeHighPct: numOrNull(md.ath_change_percentage?.usd),
                categories: Array.isArray(j.categories) ? j.categories.filter((c: unknown) => typeof c === 'string').slice(0, 6) : [],
            };
        }
    );
}
