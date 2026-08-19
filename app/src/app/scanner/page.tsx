'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { scan, SCAN_PRESETS, presetByKey, warmupStatus, RSI_PERIOD, type ScanCriteria, type SortDir } from '@/lib/scanner';
import { useMarketStore } from '@/stores/marketStore';
import { useSeriesStore } from '@/stores/seriesStore';
import { useUIStore } from '@/stores/uiStore';
import { MARKET_TABS } from '@/lib/constants';
import { fmtPrice, fmtPct } from '@/lib/format';
import { PageShell } from '@/components/ui/PageShell';

/** Criteria handed over from the Agents screen's natural-language scanner. */
function readAgentCriteria(): { criteria: ScanCriteria; query: string } | null {
    try {
        const raw = sessionStorage.getItem('gth-scan-criteria');
        if (!raw) return null;
        sessionStorage.removeItem('gth-scan-criteria');
        const parsed = JSON.parse(raw);
        if (!parsed?.criteria || typeof parsed.criteria !== 'object') return null;
        return { criteria: { markets: 'all', ...parsed.criteria }, query: String(parsed.query ?? '') };
    } catch {
        return null;
    }
}

export default function ScannerPage() {
    const router = useRouter();
    const quotes = useMarketStore((s) => s.quotes);
    // Subscribing to bars (which change once a minute) instead of quotes (~16x/sec)
    // keeps the table from recomputing constantly for values that only move per bar.
    const bars = useSeriesStore((s) => s.bars);
    const setSymbol = useUIStore((s) => s.setSymbol);
    const [preset, setPreset] = useState('gainers');
    const [market, setMarket] = useState<string>('all');
    // Read once during initialisation rather than setState-ing inside an effect,
    // which triggers a cascading render.
    const [agentScan, setAgentScan] = useState<{ criteria: ScanCriteria; query: string } | null>(
        () => (typeof window === 'undefined' ? null : readAgentCriteria())
    );

    const rows = useMemo(() => {
        const active = presetByKey(preset);
        const criteria: ScanCriteria = agentScan
            ? { ...agentScan.criteria }
            : { ...(active?.criteria ?? { markets: 'all' }) };
        criteria.markets = market === 'all' ? 'all' : ([market] as ScanCriteria['markets']);
        const sort = agentScan
            ? { key: 'changePercent' as const, dir: 'desc' as SortDir }
            : (active?.sort ?? { key: 'changePercent' as const, dir: 'desc' as SortDir });
        return scan(criteria, quotes, sort);
        // `bars` is a dependency because the indicators derive from it.
    }, [preset, market, quotes, bars, agentScan]);

    const warm = warmupStatus();
    const warming = warm.ready < warm.total;

    const sendToTicket = (symbol: string) => {
        setSymbol(symbol);
        router.push('/terminal');
    };

    return (
        <PageShell
            title="Market Scanner"
            coachTopic="scanner"
            subtitle="Screen every market at once — breakouts, momentum, RSI extremes — then send a hit straight to the order ticket."
        >

            {agentScan && (
                <div className="panel mb-4 flex items-center justify-between gap-3 px-4 py-3">
                    <div className="text-sm">
                        <span className="font-bold text-accent">AI scan</span>
                        <span className="text-foreground-muted"> · “{agentScan.query}”</span>
                        <div className="mono mt-1 text-xs text-faint">{JSON.stringify(agentScan.criteria)}</div>
                    </div>
                    <button
                        onClick={() => setAgentScan(null)}
                        className="rounded-md bg-chip px-2.5 py-1 text-xs font-bold text-foreground-muted"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* preset filters */}
            <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Scan preset">
                {SCAN_PRESETS.map((p) => (
                    <button
                        key={p.key}
                        role="radio"
                        aria-checked={!agentScan && preset === p.key}
                        onClick={() => { setAgentScan(null); setPreset(p.key); }}
                        className={`rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors ${!agentScan && preset === p.key ? 'border-transparent bg-accent text-[color:var(--cp-text)]' : 'border-border bg-panel text-foreground-muted hover:text-foreground'}`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* market filter */}
            <div className="mb-5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Market">
                {MARKET_TABS.map((t) => (
                    <button
                        key={t.key}
                        role="radio"
                        aria-checked={market === t.key}
                        onClick={() => setMarket(t.key)}
                        className={`rounded-xs px-2.5 py-1 text-xs font-medium transition-colors ${market === t.key ? 'bg-foreground text-background' : 'bg-chip text-foreground-muted hover:text-foreground'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {warming && (
                <div className="mb-4 rounded-lg px-3.5 py-2.5 text-sm" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    Indicators are warming up — {warm.ready}/{warm.total} instruments have the {RSI_PERIOD + 1} minutes of
                    observed prices RSI needs. Rows without RSI are excluded from RSI filters rather than assumed neutral.
                </div>
            )}

            <div className="panel overflow-hidden">
                <div className="overflow-x-auto">
                    <div style={{ minWidth: 860 }}>
                        <div className="grid gap-x-4 border-b border-border2 px-4 py-2.5 text-2xs font-semibold uppercase tracking-wide text-faint" style={{ gridTemplateColumns: '1.4fr .9fr 1fr .9fr .8fr 1.4fr .8fr' }}>
                            <span>INSTRUMENT</span><span>MARKET</span><span className="text-right">PRICE</span><span className="text-right">CHG</span><span className="text-right">RSI</span><span>SIGNALS</span><span className="text-right">ACTION</span>
                        </div>
                        {rows.length === 0 && (
                            <div className="py-10 text-center text-base text-faint">
                                {warming ? 'No matches yet — indicators are still warming up.' : 'No matches — adjust the filters'}
                            </div>
                        )}
                        {rows.map((r) => (
                            <div key={r.symbol} className="grid items-center gap-x-4 border-b border-border2 px-4 py-2.5 text-sm hover:bg-panel2" style={{ gridTemplateColumns: '1.4fr .9fr 1fr .9fr .8fr 1.4fr .8fr' }}>
                                <div className="flex flex-col">
                                    <span className="font-bold">{r.symbol}</span>
                                    <span className="text-2xs text-faint">{r.name}</span>
                                </div>
                                <span className="text-xs capitalize text-foreground-muted">{r.market}</span>
                                <span className="mono text-right">{fmtPrice(r.price)}</span>
                                <span className="mono text-right font-bold" style={{ color: r.changePercent >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtPct(r.changePercent)}</span>
                                <span
                                    className="mono text-right"
                                    title={r.rsi == null ? 'Not enough observed price history yet' : undefined}
                                    style={{ color: r.rsi == null ? 'var(--faint)' : r.rsi < 35 ? 'var(--up)' : r.rsi > 65 ? 'var(--down)' : 'var(--foreground-muted)' }}
                                >
                                    {r.rsi == null ? '—' : r.rsi.toFixed(0)}
                                </span>
                                <div className="flex flex-wrap gap-1">
                                    {r.signals.map((s) => (
                                        <span key={s} className="rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-semibold text-accent">{s}</span>
                                    ))}
                                    {r.signals.length === 0 && <span className="text-faint">—</span>}
                                </div>
                                <div className="text-right">
                                    <button onClick={() => sendToTicket(r.symbol)} className="rounded-sm border border-border bg-panel px-2.5 py-1 text-xs font-medium transition-colors hover:border-accent hover:bg-accent hover:text-[color:var(--cp-text)]">Trade →</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mono border-t border-border2 px-4 py-2 text-xs text-faint">
                    {rows.length} matches · prices live · RSI and 24h range from observed history
                </div>
            </div>
        </PageShell>
    );
}
