import { getAsset } from '@/lib/mockData';

/**
 * Build the candles request, carrying the instrument descriptor.
 *
 * The instrument registry is client-only, so the server cannot resolve a user-added
 * symbol on its own — it used to answer `400 unknown symbol` and the chart never
 * loaded. Seeded instruments ignore the hint; it can never override a seed.
 *
 * `price` seeds the synthetic fallback series when no provider covers the instrument.
 * Pass the live quote when there is one: the catalog price is stale mock data.
 */
export function candlesUrl(symbol: string, interval: string, limit: number, price?: number): string {
    const params = new URLSearchParams({ symbol, interval, limit: String(limit) });
    const asset = getAsset(symbol);
    if (asset) {
        params.set('market', asset.market);
        params.set('quoteCcy', asset.quoteCcy);
    }
    const base = price && price > 0 ? price : asset?.price;
    if (base && base > 0) params.set('price', String(base));
    return `/api/marketdata/candles?${params.toString()}`;
}
