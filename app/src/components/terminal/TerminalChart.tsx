'use client';

import { useEffect, useMemo, useReducer } from 'react';
import { CandleSvg } from '@/components/charts';
import { generateCandleData } from '@/lib/mockData';
import { useMarketStore } from '@/stores/marketStore';
import { TIMEFRAMES } from '@/lib/constants';

export function TerminalChart({ symbol, timeframe }: { symbol: string; timeframe: string }) {
    // base series is derived from symbol/timeframe (no state → no effect setState)
    const base = useMemo(() => {
        const secs = TIMEFRAMES.find((t) => t.value === timeframe)?.seconds ?? 900;
        return generateCandleData(symbol, 64, secs);
    }, [symbol, timeframe]);

    // re-render once a second so the last candle tracks the live quote
    const [, force] = useReducer((x: number) => x + 1, 0);
    useEffect(() => {
        const timer = setInterval(() => force(), 1000);
        return () => clearInterval(timer);
    }, []);

    const q = useMarketStore.getState().quotes[symbol];
    const series = base.map((c, i) => {
        if (i !== base.length - 1 || !q) return { o: c.open, h: c.high, l: c.low, c: c.close };
        return { o: c.open, h: Math.max(c.high, q.price), l: Math.min(c.low, q.price), c: q.price };
    });

    return (
        <div className="h-full min-h-0 flex-1" style={{ background: 'var(--bg)', padding: '6px 8px' }}>
            <CandleSvg series={series} />
        </div>
    );
}
