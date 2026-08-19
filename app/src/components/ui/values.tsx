'use client';

import { fmtSigned, fmtPrice } from '@/lib/format';
import { MARKET_LABELS, type Market } from '@/lib/constants';
import { Badge } from './primitives';

/** Signed, coloured P&L. Replaces ~20 inline colour ternaries. */
export function PnlText({ value, decimals = 0, currency = 'INR' as const }: { value: number; decimals?: number; currency?: 'INR' | 'USD' }) {
    const up = value >= 0;
    return (
        <span className="mono font-semibold" style={{ color: up ? 'var(--up)' : 'var(--down)' }}>
            {fmtSigned(value, currency, decimals)}
        </span>
    );
}

export function PriceText({ value, className = '' }: { value: number; className?: string }) {
    return <span className={`mono tabular-nums ${className}`}>{fmtPrice(value)}</span>;
}

const MARKET_TONE: Record<string, 'accent' | 'up' | 'down' | 'warn' | 'neutral'> = {
    crypto: 'accent', india: 'up', us: 'warn', forex: 'down', commodity: 'neutral',
};

export function MarketBadge({ market }: { market: Market }) {
    return <Badge tone={MARKET_TONE[market] ?? 'neutral'}>{MARKET_LABELS[market] ?? market}</Badge>;
}

export function SideBadge({ side }: { side: 'buy' | 'sell' | 'long' | 'short' }) {
    const down = side === 'sell' || side === 'short';
    return <Badge tone={down ? 'down' : 'up'}>{side.toUpperCase()}</Badge>;
}
