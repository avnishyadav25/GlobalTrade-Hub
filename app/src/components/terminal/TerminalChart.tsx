'use client';

import { useEffect, useMemo, useState } from 'react';
import { CandleSvg } from '@/components/charts';
import { generateCandleData } from '@/lib/mockData';
import { useMarketStore } from '@/stores/marketStore';
import { TIMEFRAMES } from '@/lib/constants';

interface Candle { open: number; high: number; low: number; close: number }

export function TerminalChart({ symbol, timeframe }: { symbol: string; timeframe: string }) {
    const secs = useMemo(() => TIMEFRAMES.find((t) => t.value === timeframe)?.seconds ?? 900, [timeframe]);

    // Real history where a provider covers the instrument. The seeded generator is a
    // placeholder derived from props (not state), so switching symbol shows the
    // placeholder immediately without a synchronous setState inside the effect.
    const placeholder = useMemo(() => generateCandleData(symbol, 64, secs), [symbol, secs]);
    const [fetched, setFetched] = useState<{ key: string; candles: Candle[]; synthetic: boolean } | null>(null);

    const key = `${symbol}|${timeframe}`;
    useEffect(() => {
        let cancelled = false;
        fetch(`/api/marketdata/candles?symbol=${encodeURIComponent(symbol)}&interval=${timeframe}&limit=64`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (cancelled || !d?.candles?.length) return;
                setFetched({ key: `${symbol}|${timeframe}`, candles: d.candles.slice(-64), synthetic: !!d.synthetic });
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [symbol, timeframe]);

    // Ignore a response that arrived for a previous symbol/timeframe.
    const live = fetched?.key === key ? fetched : null;
    const base = live?.candles ?? placeholder;
    const isReal = live ? !live.synthetic : false;

    // Subscribe to the quote instead of reading getState() behind a 1s forced
    // re-render, which dropped ticks and re-rendered forever on background tabs.
    const q = useMarketStore((s) => s.quotes[symbol]);
    const series = base.map((c, i) => {
        if (i !== base.length - 1 || !q) return { o: c.open, h: c.high, l: c.low, c: c.close };
        return { o: c.open, h: Math.max(c.high, q.price), l: Math.min(c.low, q.price), c: q.price };
    });

    return (
        <div className="relative h-full min-h-0 flex-1 bg-background px-2 py-1.5">
            {!isReal && (
                <span className="absolute right-3 top-2 z-10 rounded-md px-2 py-0.5 text-2xs font-bold" style={{ background: 'var(--chip)', color: 'var(--faint)' }}>
                    SIMULATED HISTORY
                </span>
            )}
            <CandleSvg series={series} />
        </div>
    );
}
