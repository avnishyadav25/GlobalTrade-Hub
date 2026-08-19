import 'server-only';
import { cachedFetch } from '../cache';
import { yahooQuote } from './yahoo';

// USD/INR is load-bearing: paperEngine.deriveFxRates() prices the ENTIRE ₹ book
// from it, and without a live value it falls back to a constant.
//
// Verified live 2026-08-10: the real rate is ~95.3, while the hardcoded fallback in
// the engine was 83.2 — a 14.5% mispricing of every USD-quoted position.
//
// Two keyless sources, checked in order. exchangerate.host is NOT used: it moved to
// a paid model and now returns `missing_access_key`.
const LIMIT = { perMinute: 20 };

async function fromFrankfurter(): Promise<number | null> {
    return cachedFetch<number>(
        { provider: 'frankfurter', key: 'usdinr', ttlMs: 15 * 60_000, limit: LIMIT },
        async () => {
            const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=INR', { cache: 'no-store' });
            if (!res.ok) return null;
            const d = await res.json();
            const rate = d?.rates?.INR;
            return Number.isFinite(rate) && rate > 0 ? rate : null;
        }
    );
}

export interface UsdInr {
    rate: number;
    source: 'yahoo' | 'frankfurter' | 'fallback';
    at: number;
}

/** Last-known-good, so a provider outage doesn't snap the book back to the constant. */
let lastGood: UsdInr | null = null;

export const USDINR_FALLBACK = 95.3;

export async function usdInr(): Promise<UsdInr> {
    const y = await yahooQuote('USD/INR');
    if (y?.price) {
        lastGood = { rate: y.price, source: 'yahoo', at: Date.now() };
        return lastGood;
    }
    const f = await fromFrankfurter();
    if (f) {
        lastGood = { rate: f, source: 'frankfurter', at: Date.now() };
        return lastGood;
    }
    if (lastGood) return lastGood;
    return { rate: USDINR_FALLBACK, source: 'fallback', at: Date.now() };
}
