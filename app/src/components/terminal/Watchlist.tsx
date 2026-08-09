'use client';

import { useState } from 'react';
import { WATCHLIST_ASSETS } from '@/lib/mockData';
import { MARKET_TABS } from '@/lib/constants';
import { useMarketStore } from '@/stores/marketStore';
import { useUIStore } from '@/stores/uiStore';
import { fmtPrice, fmtPct } from '@/lib/format';

export function Watchlist() {
    const [tab, setTab] = useState<string>('all');
    const quotes = useMarketStore((s) => s.quotes);
    const selected = useUIStore((s) => s.selectedSymbol);
    const setSymbol = useUIStore((s) => s.setSymbol);

    const rows = WATCHLIST_ASSETS.filter((a) => tab === 'all' || a.market === tab);

    return (
        <div className="flex h-full flex-col overflow-hidden border-r border-border bg-panel">
            <div className="flex flex-shrink-0 flex-wrap gap-1.5 px-3.5 pb-2 pt-3">
                {MARKET_TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
                            tab === t.key ? 'bg-accent text-[color:var(--cp-text)]' : 'bg-chip text-foreground-muted'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <div className="flex-1 overflow-auto">
                {rows.map((a) => {
                    const q = quotes[a.symbol];
                    const price = q?.price ?? a.price;
                    const pct = q?.changePercent ?? a.changePercent;
                    const up = pct >= 0;
                    const active = selected === a.symbol;
                    return (
                        <button
                            key={a.symbol}
                            onClick={() => setSymbol(a.symbol)}
                            className={`flex w-full items-center justify-between border-b border-border2 px-3.5 py-2.5 text-left transition-colors hover:bg-chip/60 ${
                                active ? 'bg-chip' : ''
                            }`}
                        >
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[12.5px] font-bold">{a.symbol}</span>
                                <span className="text-[10px] font-semibold tracking-wide text-faint">{a.exchange.toUpperCase()}</span>
                            </div>
                            <div className="flex flex-col items-end gap-0.5">
                                <span className="mono text-[12.5px] font-semibold">{fmtPrice(price)}</span>
                                <span className="mono text-[10.5px] font-semibold" style={{ color: up ? 'var(--up)' : 'var(--down)' }}>
                                    {fmtPct(pct)}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
