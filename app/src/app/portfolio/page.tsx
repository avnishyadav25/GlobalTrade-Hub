'use client';

import { AreaChart, Donut } from '@/components/charts';
import { PageShell } from '@/components/ui/PageShell';
import { useMarketStore } from '@/stores/marketStore';
import { usePaperStore } from '@/stores/paperStore';
import { MARKET_LABELS, type Market } from '@/lib/constants';
import {
    deriveFxRates,
    positionMarketValueBase,
    unrealizedPnlBase,
    toBase,
    equity as engineEquity,
} from '@/lib/paperEngine';
import { fmtMoney, fmtSigned, fmtPct, fmtPrice, fmtNum, fmtCompactINR } from '@/lib/format';

// Theme-aware: --chart-* is redefined for light, the old hex literals were not.
const MARKET_COLORS: Record<string, string> = {
    crypto: 'var(--chart-1)',
    india: 'var(--chart-2)',
    us: 'var(--chart-4)',
    forex: 'var(--chart-3)',
    commodity: 'var(--chart-5)',
};

export default function PortfolioPage() {
    const quotes = useMarketStore((s) => s.quotes);
    // Real positions from the paper engine. This page used to render a hardcoded
    // MOCK_POSITIONS list, so Portfolio and Paper could never agree.
    const state = usePaperStore((s) => s.state);
    const equityHistory = usePaperStore((s) => s.equityHistory);

    const fx = deriveFxRates(quotes);
    const positions = Object.values(state.positions);

    const holdings = positions.map((p) => {
        const price = quotes[p.symbol]?.price ?? p.avgPrice;
        const prevClose = quotes[p.symbol]?.prevClose ?? price;
        const value = positionMarketValueBase(p, quotes, fx);
        const pnl = unrealizedPnlBase(p, quotes, fx);
        const today = toBase(p.symbol, (price - prevClose) * p.qty, fx);
        return { ...p, price, value, invested: p.basisBase, pnl, today };
    });

    const holdingsValue = holdings.reduce((a, h) => a + h.value, 0);
    const invested = holdings.reduce((a, h) => a + h.invested, 0);
    const todayChange = holdings.reduce((a, h) => a + h.today, 0);
    const marginHeld = positions.reduce((a, p) => a + p.marginHeldBase, 0);
    const { cash, reservedCash, startingCash } = state.account;

    // Same figure /paper shows as EQUITY, computed the same way, so the two agree.
    const totalValue = engineEquity(state, quotes, fx);
    const allTimePnl = totalValue - startingCash;

    const allocMap = new Map<string, number>();
    for (const h of holdings) allocMap.set(h.market, (allocMap.get(h.market) ?? 0) + Math.abs(h.value));
    if (cash > 0) allocMap.set('cash', cash);
    const allocTotal = [...allocMap.values()].reduce((a, b) => a + b, 0);
    const alloc = [...allocMap.entries()]
        .map(([market, val]) => ({
            market,
            val,
            pct: allocTotal > 0 ? (val / allocTotal) * 100 : 0,
            color: market === 'cash' ? 'var(--faint)' : MARKET_COLORS[market],
        }))
        .sort((a, b) => b.val - a.val);

    const marketCount = new Set(holdings.map((h) => h.market)).size;

    const stats = [
        {
            label: 'TOTAL VALUE',
            value: fmtMoney(totalValue, 'INR', 0),
            sub: marketCount ? `across ${marketCount} market${marketCount === 1 ? '' : 's'}` : 'cash only',
        },
        {
            label: "TODAY'S CHANGE",
            value: fmtSigned(todayChange, 'INR', 0),
            sub: totalValue > 0 ? `${fmtPct((todayChange / totalValue) * 100)} today` : '—',
            col: todayChange >= 0 ? 'var(--up)' : 'var(--down)',
        },
        {
            label: 'ALL-TIME P&L',
            value: fmtSigned(allTimePnl, 'INR', 0),
            sub: `${fmtPct((allTimePnl / startingCash) * 100)} vs start`,
            col: allTimePnl >= 0 ? 'var(--up)' : 'var(--down)',
        },
        {
            label: 'CASH',
            value: fmtMoney(cash, 'INR', 0),
            sub: reservedCash > 0 ? `${fmtMoney(reservedCash, 'INR', 0)} reserved` : `${holdings.length} holdings`,
        },
    ];

    const hasPositions = holdings.length > 0;

    return (
        <PageShell
            title="Portfolio"
            coachTopic="portfolio"
            subtitle={
                <>
                    One balance sheet across crypto, Indian &amp; US equities, forex and commodities. Each instrument is
                    converted from its own quote currency at <span className="mono">₹{fx.USD.toFixed(2)}/$</span>
                    {fx.stale && <span className="text-faint"> (fallback rate — no live USD/INR quote)</span>}.
                </>
            }
        >

            <div className="mb-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((s) => (
                    <div key={s.label} className="panel p-4">
                        <div className="text-2xs font-semibold uppercase tracking-wide text-faint">{s.label}</div>
                        <div className="mono my-2 text-2xl font-bold" style={{ color: s.col }}>{s.value}</div>
                        <div className="text-xs font-medium" style={{ color: s.col ?? 'var(--faint)' }}>{s.sub}</div>
                    </div>
                ))}
            </div>

            <div className="mb-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
                <div className="panel p-4">
                    <div className="mb-3.5 text-md font-semibold">Allocation by market</div>
                    <div className="flex items-center gap-5">
                        <div className="relative" style={{ width: 140, height: 140, flexShrink: 0 }}>
                            <Donut segments={alloc.map((a) => ({ value: a.pct, color: a.color }))} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xs font-semibold uppercase tracking-wide text-faint">TOTAL</span>
                                <span className="mono text-md font-semibold">{fmtCompactINR(totalValue)}</span>
                            </div>
                        </div>
                        <div className="flex flex-1 flex-col gap-2.5">
                            {alloc.map((a) => (
                                <div key={a.market} className="flex items-center gap-2.5 text-sm">
                                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-xs" style={{ background: a.color }} />
                                    <span className="flex-1 font-semibold">
                                        {a.market === 'cash' ? 'Cash' : (MARKET_LABELS[a.market as Market] ?? a.market)}
                                    </span>
                                    <span className="mono text-foreground-muted">{fmtCompactINR(a.val)}</span>
                                    <span className="mono w-10 text-right font-bold">{a.pct.toFixed(0)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="panel p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-md font-semibold">Portfolio value</span>
                        <span
                            className="mono text-sm font-bold"
                            style={{ color: allTimePnl >= 0 ? 'var(--up)' : 'var(--down)' }}
                        >
                            {fmtPct((allTimePnl / startingCash) * 100)} all-time
                        </span>
                    </div>
                    <div className="mt-3" style={{ height: 170 }}>
                        {/* The real sampled equity curve — the same series /paper plots. */}
                        {equityHistory.length > 1 ? (
                            <AreaChart points={equityHistory} id="pf" />
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-faint">
                                Equity history builds as the session runs.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="panel overflow-hidden">
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pb-2.5 pt-3.5">
                    <span className="text-md font-semibold">Holdings</span>
                    {hasPositions && (
                        <span className="mono text-xs text-faint">
                            {fmtCompactINR(holdingsValue)} market value · {fmtCompactINR(invested)} invested
                            {marginHeld > 0 && ` · ${fmtCompactINR(marginHeld)} margin`}
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <div style={{ minWidth: 720 }}>
                        <div className="grid border-b border-t border-border2 px-4 py-2 text-2xs font-semibold uppercase tracking-wide text-faint" style={{ gridTemplateColumns: '1.3fr .9fr .7fr .9fr .9fr 1fr 1fr' }}>
                            <span>INSTRUMENT</span><span>MARKET</span><span className="text-right">QTY</span><span className="text-right">AVG</span><span className="text-right">LTP</span><span className="text-right">VALUE</span><span className="text-right">P&amp;L</span>
                        </div>
                        {!hasPositions && (
                            <div className="px-4 py-8 text-center text-sm text-faint">
                                No open positions. Place a paper order on the Terminal and it will appear here.
                            </div>
                        )}
                        {holdings.map((h) => (
                            <div key={h.symbol} className="grid items-center border-b border-border2 px-4 py-2.5 text-sm hover:bg-panel2" style={{ gridTemplateColumns: '1.3fr .9fr .7fr .9fr .9fr 1fr 1fr' }}>
                                <span className="font-bold">
                                    {h.symbol}
                                    {h.qty < 0 && <span className="ml-1.5 text-2xs font-bold text-down">SHORT</span>}
                                </span>
                                <span className="text-xs capitalize text-foreground-muted">{h.market}</span>
                                <span className="mono text-right">{fmtNum(Math.abs(h.qty), Math.abs(h.qty) < 1 ? 4 : 2)}</span>
                                <span className="mono text-right text-foreground-muted">{fmtPrice(h.avgPrice)}</span>
                                <span className="mono text-right">{fmtPrice(h.price)}</span>
                                <span className="mono text-right">{fmtCompactINR(Math.abs(h.value))}</span>
                                <span className="mono text-right font-bold" style={{ color: h.pnl >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtSigned(h.pnl, 'INR', 0)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
