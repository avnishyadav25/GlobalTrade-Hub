import 'server-only';
import type { Candle } from '@/lib/mockData';
import type { Market } from '@/lib/constants';

/** A normalized quote, whatever the upstream shape. */
export interface ProviderQuote {
    symbol: string;
    price: number;
    prevClose?: number;
    high?: number;
    low?: number;
    volume?: number;
    currency?: string;
}

export type FeedState = 'live' | 'delayed' | 'sim';

export interface ProviderResult<T> {
    data: T;
    provider: string;
    state: FeedState;
    /** How stale this data is, in minutes. 0 for real-time. */
    delayMinutes: number;
}

export interface Provider {
    id: string;
    /** Which app symbols this provider can serve. */
    supports(symbol: string, market: Market): boolean;
    state: FeedState;
    delayMinutes: number;
    quotes?(symbols: string[]): Promise<ProviderQuote[] | null>;
    candles?(symbol: string, interval: string, limit: number): Promise<Candle[] | null>;
}
