'use client';

import { AreaChart, Donut } from '@/components/charts';
import { useMarketStore } from '@/stores/marketStore';
import { MOCK_POSITIONS } from '@/lib/mockData';
import { MARKET_LABELS, type Market } from '@/lib/constants';
import { USDINR } from '@/lib/paperEngine';
import { fmtMoney, fmtSigned, fmtPct, fmtPrice, fmtNum, fmtCompactINR } from '@/lib/format';

const MARKET_COLORS: Record<string, string> = {
    crypto: '#7c8cff',
    india: '#2fd47e',
    us: '#e0a020',
    forex: '#ff5470',
    commodity: '#5ec8d8',
};

function fx(market: Market) {
    return market === 'india' ? 1 : USDINR;
}

// deterministic rising value curve for the portfolio card
function valueCurve(seed: number): number[] {
    let s = seed;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    let v = 1500000;
    const pts: number[] = [];
    for (let i = 0; i < 120; i++) {
        v = Math.max(1200000, v * (1 + (rnd() - 0.43) * 0.02));
        pts.push(v);
    }
    return pts;
}

export default function PortfolioPage() {
    const quotes = useMarketStore((s) => s.quotes);

    const holdings = MOCK_POSITIONS.map((h) => {
        const price = quotes[h.symbol]?.price ?? h.currentPrice;
        const prevClose = quotes[h.symbol]?.prevClose ?? price;
        const rate = fx(h.market);
        const value = h.quantity * price * rate;
        const invested = h.quantity * h.avgPrice * rate;
        const pnl = value - invested;
        const today = (price - prevClose) * h.quantity * rate;
        return { ...h, price, value, invested, pnl, today };
    });

    const totalValue = holdings.reduce((a, h) => a + h.value, 0);
    const totalInvested = holdings.reduce((a, h) => a + h.invested, 0);
    const totalPnl = totalValue - totalInvested;
    const todayChange = holdings.reduce((a, h) => a + h.today, 0);

    const allocMap = new Map<string, number>();
    for (const h of holdings) allocMap.set(h.market, (allocMap.get(h.market) ?? 0) + h.value);
    const alloc = [...allocMap.entries()]
        .map(([market, val]) => ({ market, val, pct: (val / (totalValue || 1)) * 100, color: MARKET_COLORS[market] }))
        .sort((a, b) => b.val - a.val);

    const stats = [
        { label: 'TOTAL VALUE', value: fmtMoney(totalValue, 'INR', 0), sub: `across ${alloc.length} markets` },
        { label: "TODAY'S CHANGE", value: fmtSigned(todayChange, 'INR', 0), sub: fmtPct((todayChange / (totalValue || 1)) * 100) + ' today', col: todayChange >= 0 ? 'var(--up)' : 'var(--down)' },
        { label: 'TOTAL P&L', value: fmtSigned(totalPnl, 'INR', 0), sub: fmtPct((totalPnl / (totalInvested || 1)) * 100) + ' all-time', col: totalPnl >= 0 ? 'var(--up)' : 'var(--down)' },
        { label: 'INVESTED', value: fmtMoney(totalInvested, 'INR', 0), sub: `${holdings.length} holdings` },
    ];

    return (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 30px 50px' }}>
            <div className="mb-5">
                <div className="text-[22px] font-extrabold">Portfolio</div>
                <div className="text-[13px] text-foreground-muted">
                    One balance sheet across crypto, Indian &amp; US equities, forex and commodities. Non-INR holdings converted at ₹{USDINR}/$.
                </div>
            </div>

            <div className="mb-5 grid gap-3.5" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                {stats.map((s) => (
                    <div key={s.label} className="panel p-4">
                        <div className="text-[10px] font-bold tracking-wide text-faint">{s.label}</div>
                        <div className="mono my-2 text-[24px] font-extrabold" style={{ color: s.col }}>{s.value}</div>
                        <div className="text-[11.5px] font-semibold" style={{ color: s.col ?? 'var(--faint)' }}>{s.sub}</div>
                    </div>
                ))}
            </div>

            <div className="mb-5 grid gap-5" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
                <div className="panel" style={{ padding: 18 }}>
                    <div className="mb-3.5 text-sm font-extrabold">Allocation by market</div>
                    <div className="flex items-center gap-5">
                        <div className="relative" style={{ width: 140, height: 140, flexShrink: 0 }}>
                            <Donut segments={alloc.map((a) => ({ value: a.pct, color: a.color }))} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-[9px] font-bold tracking-wide text-faint">TOTAL</span>
                                <span className="mono text-[15px] font-extrabold">{fmtCompactINR(totalValue)}</span>
                            </div>
                        </div>
                        <div className="flex flex-1 flex-col gap-2.5">
                            {alloc.map((a) => (
                                <div key={a.market} className="flex items-center gap-2.5 text-[12.5px]">
                                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: a.color }} />
                                    <span className="flex-1 font-semibold">{MARKET_LABELS[a.market as Market] ?? a.market}</span>
                                    <span className="mono text-foreground-muted">{fmtCompactINR(a.val)}</span>
                                    <span className="mono w-10 text-right font-bold">{a.pct.toFixed(0)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="panel" style={{ padding: 18 }}>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold">Portfolio value</span>
                        <span className="mono text-[12px] font-bold text-up">{fmtPct((totalPnl / (totalInvested || 1)) * 100)} all-time</span>
                    </div>
                    <div style={{ height: 170, marginTop: 12 }}>
                        <AreaChart points={valueCurve(9)} id="pf" />
                    </div>
                </div>
            </div>

            <div className="panel overflow-hidden">
                <div className="pb-2.5 pt-3.5 text-sm font-extrabold" style={{ paddingLeft: 18 }}>Holdings</div>
                <div className="grid border-b border-t border-border2 py-2 text-[10px] font-bold tracking-wide text-faint" style={{ gridTemplateColumns: '1.3fr .9fr .7fr .9fr .9fr 1fr 1fr', paddingLeft: 18, paddingRight: 18 }}>
                    <span>INSTRUMENT</span><span>MARKET</span><span className="text-right">QTY</span><span className="text-right">AVG</span><span className="text-right">LTP</span><span className="text-right">VALUE</span><span className="text-right">P&amp;L</span>
                </div>
                {holdings.map((h) => (
                    <div key={h.id} className="grid items-center border-b border-border2 py-2.5 text-[12.5px]" style={{ gridTemplateColumns: '1.3fr .9fr .7fr .9fr .9fr 1fr 1fr', paddingLeft: 18, paddingRight: 18 }}>
                        <span className="font-bold">{h.symbol}</span>
                        <span className="text-[11px] capitalize text-foreground-muted">{h.market}</span>
                        <span className="mono text-right">{fmtNum(h.quantity, h.quantity < 1 ? 4 : 2)}</span>
                        <span className="mono text-right text-foreground-muted">{fmtPrice(h.avgPrice)}</span>
                        <span className="mono text-right">{fmtPrice(h.price)}</span>
                        <span className="mono text-right">{fmtCompactINR(h.value)}</span>
                        <span className="mono text-right font-bold" style={{ color: h.pnl >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtSigned(h.pnl, 'INR', 0)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
