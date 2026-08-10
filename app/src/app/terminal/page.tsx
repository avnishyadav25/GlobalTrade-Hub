'use client';

import { Watchlist } from '@/components/terminal/Watchlist';
import { OrderTicket } from '@/components/terminal/OrderTicket';
import { PositionsPanel } from '@/components/terminal/PositionsPanel';
import { TerminalChart } from '@/components/terminal/TerminalChart';
import { useUIStore } from '@/stores/uiStore';
import { useMarketStore } from '@/stores/marketStore';
import { getAsset } from '@/lib/mockData';
import { TIMEFRAMES } from '@/lib/constants';
import { fmtPrice, fmtPct, fmtCompact } from '@/lib/format';

export default function TerminalPage() {
    const symbol = useUIStore((s) => s.selectedSymbol);
    const timeframe = useUIStore((s) => s.timeframe);
    const setTimeframe = useUIStore((s) => s.setTimeframe);
    const tradeMode = useUIStore((s) => s.tradeMode);
    const setTradeMode = useUIStore((s) => s.setTradeMode);
    const quote = useMarketStore((s) => s.quotes[symbol]);
    const asset = getAsset(symbol);
    const price = quote?.price ?? asset?.price ?? 0;
    const pct = quote?.changePercent ?? asset?.changePercent ?? 0;
    const up = pct >= 0;

    return (
        <div className="grid h-full min-h-0" style={{ gridTemplateColumns: '248px 1fr 300px' }}>
            <Watchlist />

            {/* center */}
            <div className="flex min-w-0 flex-col overflow-hidden">
                <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4.5 py-3" style={{ paddingLeft: 18, paddingRight: 18 }}>
                    <div className="flex items-baseline gap-3.5">
                        <span className="text-lg font-extrabold">{symbol}</span>
                        <span className="mono text-xl font-bold">{fmtPrice(price)}</span>
                        <span className="mono text-[13.5px] font-bold" style={{ color: up ? 'var(--up)' : 'var(--down)' }}>{fmtPct(pct)}</span>
                    </div>
                    <div className="mono hidden gap-4 text-[11.5px] md:flex">
                        <span className="text-faint">O <span className="text-foreground">{fmtPrice(quote?.prevClose ?? price)}</span></span>
                        <span className="text-faint">H <span className="text-foreground">{fmtPrice(quote?.high ?? price)}</span></span>
                        <span className="text-faint">L <span className="text-foreground">{fmtPrice(quote?.low ?? price)}</span></span>
                        <span className="text-faint">Vol <span className="text-foreground">{fmtCompact(quote?.volume ?? 0)}</span></span>
                    </div>
                </div>

                <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-panel px-4.5 py-1.5" style={{ paddingLeft: 18, paddingRight: 18 }}>
                    <div className="flex gap-0.5 text-[11.5px] font-semibold">
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
                    <div className="hidden gap-3.5 text-[11.5px] font-semibold text-foreground-muted sm:flex">
                        <span>＋ Indicators</span>
                        <span>⬚ Candles</span>
                    </div>
                </div>

                <TerminalChart symbol={symbol} timeframe={timeframe} />
                <PositionsPanel />
            </div>

            {/* order ticket */}
            <div className="overflow-auto border-l border-border bg-panel p-4">
                <div className="mb-4 flex gap-1 rounded-lg bg-chip p-1 text-[12px] font-semibold">
                    {(['paper', 'live'] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => setTradeMode(m)}
                            className={`flex-1 rounded-md py-1.5 capitalize ${tradeMode === m ? 'bg-panel text-foreground' : 'text-foreground-muted'}`}
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
