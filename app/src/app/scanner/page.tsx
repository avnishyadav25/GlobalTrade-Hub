'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { scan, SCAN_PRESETS, type ScanCriteria } from '@/lib/scanner';
import { useMarketStore } from '@/stores/marketStore';
import { useUIStore } from '@/stores/uiStore';
import { MARKET_TABS } from '@/lib/constants';
import { fmtPrice, fmtPct, fmtCompact } from '@/lib/format';

export default function ScannerPage() {
    const router = useRouter();
    const quotes = useMarketStore((s) => s.quotes);
    const setSymbol = useUIStore((s) => s.setSymbol);
    const [preset, setPreset] = useState('gainers');
    const [market, setMarket] = useState<string>('all');

    const rows = useMemo(() => {
        const c: ScanCriteria = { ...SCAN_PRESETS.find((p) => p.key === preset)!.criteria };
        c.markets = market === 'all' ? 'all' : ([market] as ScanCriteria['markets']);
        return scan(c, quotes);
    }, [preset, market, quotes]);

    const sendToTicket = (symbol: string) => {
        setSymbol(symbol);
        router.push('/terminal');
    };

    return (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 30px 50px' }}>
            <div className="mb-5">
                <div className="text-[22px] font-extrabold">Market Scanner</div>
                <div className="text-[13px] text-foreground-muted">Screen every market at once — breakouts, momentum, RSI extremes — then send a hit straight to the order ticket.</div>
            </div>

            {/* preset filters */}
            <div className="mb-3 flex flex-wrap gap-2">
                {SCAN_PRESETS.map((p) => (
                    <button
                        key={p.key}
                        onClick={() => setPreset(p.key)}
                        className={`rounded-lg px-3.5 py-2 text-[12.5px] font-semibold ${preset === p.key ? 'bg-accent text-[color:var(--cp-text)]' : 'bg-chip text-foreground-muted'}`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* market filter */}
            <div className="mb-5 flex flex-wrap gap-1.5">
                {MARKET_TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setMarket(t.key)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${market === t.key ? 'bg-foreground text-background' : 'bg-chip text-foreground-muted'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="panel overflow-hidden">
                <div className="grid gap-x-4 border-b border-border2 py-2.5 text-[10px] font-bold tracking-wide text-faint" style={{ gridTemplateColumns: '1.4fr .9fr 1fr .9fr .8fr 1.4fr .8fr', paddingLeft: 18, paddingRight: 18 }}>
                    <span>INSTRUMENT</span><span>MARKET</span><span className="text-right">PRICE</span><span className="text-right">CHG</span><span className="text-right">RSI</span><span>SIGNALS</span><span className="text-right">ACTION</span>
                </div>
                {rows.length === 0 && <div className="py-10 text-center text-[13px] text-faint">No matches — adjust the filters</div>}
                {rows.map((r) => (
                    <div key={r.symbol} className="grid items-center gap-x-4 border-b border-border2 py-3 text-[12.5px]" style={{ gridTemplateColumns: '1.4fr .9fr 1fr .9fr .8fr 1.4fr .8fr', paddingLeft: 18, paddingRight: 18 }}>
                        <div className="flex flex-col">
                            <span className="font-bold">{r.symbol}</span>
                            <span className="text-[10px] text-faint">{r.name}</span>
                        </div>
                        <span className="text-[11px] capitalize text-foreground-muted">{r.market}</span>
                        <span className="mono text-right">{fmtPrice(r.price)}</span>
                        <span className="mono text-right font-bold" style={{ color: r.changePercent >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtPct(r.changePercent)}</span>
                        <span className="mono text-right" style={{ color: r.rsi < 35 ? 'var(--up)' : r.rsi > 65 ? 'var(--down)' : 'var(--foreground-muted)' }}>{r.rsi.toFixed(0)}</span>
                        <div className="flex flex-wrap gap-1">
                            {r.signals.map((s) => (
                                <span key={s} className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">{s}</span>
                            ))}
                            {r.signals.length === 0 && <span className="text-faint">—</span>}
                        </div>
                        <div className="text-right">
                            <button onClick={() => sendToTicket(r.symbol)} className="rounded-md bg-chip px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-accent hover:text-[color:var(--cp-text)]">Trade →</button>
                        </div>
                    </div>
                ))}
                <div className="mono px-4 py-2 text-[11px] text-faint" style={{ paddingLeft: 18 }}>{rows.length} matches · live</div>
            </div>
        </div>
    );
}
