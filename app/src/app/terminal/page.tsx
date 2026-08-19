'use client';

import { useEffect } from 'react';

import { Watchlist } from '@/components/terminal/Watchlist';
import { OrderTicket } from '@/components/terminal/OrderTicket';
import { PositionsPanel } from '@/components/terminal/PositionsPanel';
import { TerminalChart } from '@/components/terminal/TerminalChart';
import { CoachMark } from '@/components/learn/CoachMark';
import { useUIStore } from '@/stores/uiStore';
import { useMarketStore } from '@/stores/marketStore';
import { getAsset } from '@/lib/mockData';
import { useLearnStore } from '@/stores/learnStore';
import { rolling24h } from '@/stores/seriesStore';
import { TIMEFRAMES } from '@/lib/constants';
import { fmtPrice, fmtPct, fmtCompact } from '@/lib/format';

export default function TerminalPage() {
    const symbol = useUIStore((s) => s.selectedSymbol);
    const timeframe = useUIStore((s) => s.timeframe);
    const setTimeframe = useUIStore((s) => s.setTimeframe);
    const tradeMode = useUIStore((s) => s.tradeMode);
    const setTradeMode = useUIStore((s) => s.setTradeMode);
    const quote = useMarketStore((s) => s.quotes[symbol]);
    // Rolling 24h range from observed bars (or the venue's own figures for crypto);
    // marketStore's high/low only ever ratchet outward for the life of the tab.
    const observe = useLearnStore((s) => s.observe);
    // Records what you've actually looked at, which is what the first two Learn
    // exercises verify against.
    useEffect(() => {
        const a = getAsset(symbol);
        if (a) observe(a.symbol, a.market);
    }, [symbol, observe]);

    const range = rolling24h(symbol);
    const asset = getAsset(symbol);
    const price = quote?.price ?? asset?.price ?? 0;
    const pct = quote?.changePercent ?? asset?.changePercent ?? 0;
    const up = pct >= 0;

    return (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto lg:grid lg:grid-cols-[248px_1fr_300px] lg:overflow-hidden">
            {/* Below lg the three panes stack and the page scrolls, instead of the
                chart disappearing and the ticket being clipped off-screen. */}
            <div className="order-2 lg:order-none lg:min-h-0 lg:overflow-hidden">
                <Watchlist />
            </div>

            {/* center */}
            <div className="order-1 flex min-w-0 flex-col lg:order-none lg:overflow-hidden">
                <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3">
                    <div className="flex items-baseline gap-3.5">
                        <span className="text-lg font-bold">{symbol}</span>
                        <span className="mono text-xl font-bold">{fmtPrice(price)}</span>
                        <span className="mono text-base font-bold" style={{ color: up ? 'var(--up)' : 'var(--down)' }}>{fmtPct(pct)}</span>
                    </div>
                    <div className="mono hidden gap-4 text-xs md:flex">
                        {/* Was labelled "O" (open) while rendering prevClose. H/L come from
                            the rolling 24h window; volume is only meaningful where the feed
                            supplies it, so it is omitted rather than shown as a fake 0. */}
                        <span className="text-faint">PREV <span className="text-foreground">{fmtPrice(quote?.prevClose ?? price)}</span></span>
                        <span className="text-faint">24H H <span className="text-foreground">{fmtPrice(range?.high ?? quote?.high ?? price)}</span></span>
                        <span className="text-faint">24H L <span className="text-foreground">{fmtPrice(range?.low ?? quote?.low ?? price)}</span></span>
                        {(quote?.volume ?? 0) > 0 && (
                            <span className="text-faint">Vol <span className="text-foreground">{fmtCompact(quote!.volume)}</span></span>
                        )}
                    </div>
                </div>

                <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-panel px-4 py-2">
                    <div className="flex gap-0.5 text-xs font-semibold">
                        {TIMEFRAMES.map((t) => (
                            <button
                                key={t.value}
                                onClick={() => setTimeframe(t.value)}
                                className={`rounded-md px-2.5 py-1 ${timeframe === t.value ? 'bg-chip text-foreground' : 'text-foreground-muted'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    {/* "＋ Indicators" and "⬚ Candles" used to sit here as plain spans
                        that looked like controls but had no handler. Removed rather
                        than left as decoys. */}
                    <CoachMark topic="terminal.chart" />
                </div>

                <TerminalChart symbol={symbol} timeframe={timeframe} />
                <PositionsPanel />
            </div>

            {/* order ticket */}
            <div className="order-3 border-t border-border bg-panel p-4 lg:order-none lg:overflow-auto lg:border-l lg:border-t-0">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-2xs font-bold tracking-wide text-faint">ORDER TICKET</span>
                    <CoachMark topic="terminal.ticket" />
                </div>
                <div className="mb-4 flex gap-1 rounded-sm border border-border bg-chip p-0.5 text-sm" role="radiogroup" aria-label="Trade mode">
                    {(['paper', 'live'] as const).map((m) => (
                        <button
                            key={m}
                            role="radio"
                            aria-checked={tradeMode === m}
                            onClick={() => setTradeMode(m)}
                            className={`flex-1 rounded-xs py-1.5 capitalize transition-colors ${tradeMode === m ? 'bg-panel border border-border shadow-elev-1 text-foreground font-semibold' : 'border border-transparent text-foreground-muted hover:text-foreground'}`}
                        >
                            {m}
                        </button>
                    ))}
                </div>
                <OrderTicket symbol={symbol} />
            </div>
        </div>
    );
}
