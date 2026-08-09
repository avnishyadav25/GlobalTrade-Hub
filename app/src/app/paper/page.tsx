'use client';

import { toast } from 'sonner';
import { AreaChart } from '@/components/charts';
import { OrderTicket } from '@/components/terminal/OrderTicket';
import { usePaperStore } from '@/stores/paperStore';
import { useMarketStore } from '@/stores/marketStore';
import { useUIStore } from '@/stores/uiStore';
import {
    equity,
    openUnrealized,
    realizedTotal,
    winRate,
    unrealizedPnlBase,
    STARTING_CASH,
} from '@/lib/paperEngine';
import { fmtMoney, fmtSigned, fmtPrice, fmtNum } from '@/lib/format';

export default function PaperPage() {
    const state = usePaperStore((s) => s.state);
    const equityHistory = usePaperStore((s) => s.equityHistory);
    const reset = usePaperStore((s) => s.reset);
    const quotes = useMarketStore((s) => s.quotes);
    const symbol = useUIStore((s) => s.selectedSymbol);

    const eq = equity(state, quotes);
    const realized = realizedTotal(state);
    const open = openUnrealized(state, quotes);
    const positions = Object.values(state.positions);
    const fills = state.fills.slice(0, 8);

    const stats = [
        { label: 'EQUITY', value: fmtMoney(eq, 'INR', 0) },
        { label: "TODAY'S P&L", value: fmtSigned(realized, 'INR', 0), col: realized >= 0 ? 'var(--up)' : 'var(--down)' },
        { label: 'OPEN P&L', value: fmtSigned(open, 'INR', 0), col: open >= 0 ? 'var(--up)' : 'var(--down)' },
        { label: 'TRADES', value: String(state.fills.length) },
        { label: 'WIN RATE', value: `${winRate(state).toFixed(0)}%` },
    ];

    return (
        <div className="p-6" style={{ padding: '22px 26px' }}>
            {/* banner */}
            <div className="panel mb-5 flex flex-wrap items-end justify-between gap-4 px-5 py-4">
                <div>
                    <div className="mb-1.5 flex items-center gap-2.5">
                        <span className="text-xl font-extrabold">Paper Trading</span>
                        <span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide" style={{ background: 'rgba(224,160,32,.15)', color: 'var(--warn)' }}>
                            PAPER · VIRTUAL FUNDS
                        </span>
                    </div>
                    <div className="text-[13px] text-foreground-muted">
                        Same data &amp; order types as live — zero risk. Build a track record before you go live.
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    {stats.map((s) => (
                        <div key={s.label}>
                            <div className="mb-1 text-[10px] font-bold tracking-wide text-faint">{s.label}</div>
                            <div className="mono text-[19px] font-extrabold" style={{ color: s.col }}>{s.value}</div>
                        </div>
                    ))}
                    <button
                        onClick={() => { reset(); toast.success('Paper session reset', { description: `Balance back to ${fmtMoney(STARTING_CASH, 'INR', 0)}` }); }}
                        className="rounded-[9px] border border-border bg-background px-3.5 py-2.5 text-[12.5px] font-bold text-foreground-muted"
                    >
                        ↺ Reset session
                    </button>
                </div>
            </div>

            <div className="grid items-start gap-5" style={{ gridTemplateColumns: '1fr 360px' }}>
                <div className="flex min-w-0 flex-col gap-5">
                    {/* equity curve */}
                    <div className="panel p-4.5" style={{ padding: 18 }}>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-extrabold">Account equity <span className="text-[12px] font-medium text-faint">· this session</span></span>
                            <span className="mono text-[12px] text-foreground-muted">start {fmtMoney(STARTING_CASH, 'INR', 0)} → {fmtMoney(eq, 'INR', 0)}</span>
                        </div>
                        <div style={{ height: 200, marginTop: 12 }}>
                            <AreaChart points={equityHistory} id="paper-eq" />
                        </div>
                    </div>

                    {/* open positions */}
                    <Panel title="Open positions">
                        <TableHead cols="1.4fr .8fr .8fr 1fr 1fr 1fr" head={['INSTRUMENT', 'SIDE', 'QTY', 'AVG', 'LTP', 'P&L']} />
                        {positions.length === 0 && <EmptyRow text="No open positions — place a paper order to begin" />}
                        {positions.map((p) => {
                            const ltp = quotes[p.symbol]?.price ?? p.avgPrice;
                            const pnl = unrealizedPnlBase(p, quotes);
                            const long = p.qty >= 0;
                            return (
                                <Row key={p.symbol} cols="1.4fr .8fr .8fr 1fr 1fr 1fr">
                                    <span className="font-bold">{p.symbol}</span>
                                    <span className="text-[10px] font-bold" style={{ color: long ? 'var(--up)' : 'var(--down)' }}>{long ? 'LONG' : 'SHORT'}</span>
                                    <span className="mono text-right">{fmtNum(Math.abs(p.qty), Math.abs(p.qty) < 1 ? 4 : 2)}</span>
                                    <span className="mono text-right text-foreground-muted">{fmtPrice(p.avgPrice)}</span>
                                    <span className="mono text-right">{fmtPrice(ltp)}</span>
                                    <span className="mono text-right font-bold" style={{ color: pnl >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtSigned(pnl, 'INR', 0)}</span>
                                </Row>
                            );
                        })}
                    </Panel>

                    {/* recent fills */}
                    <Panel title="Recent paper trades">
                        <TableHead cols="1.4fr .7fr .8fr 1fr 1fr .8fr" head={['INSTRUMENT', 'SIDE', 'QTY', 'PRICE', 'P&L', 'TIME']} />
                        {fills.length === 0 && <EmptyRow text="No trades yet" />}
                        {fills.map((f) => (
                            <Row key={f.id} cols="1.4fr .7fr .8fr 1fr 1fr .8fr">
                                <span className="font-bold">{f.symbol}</span>
                                <span className="text-[10px] font-bold" style={{ color: f.side === 'buy' ? 'var(--up)' : 'var(--down)' }}>{f.side.toUpperCase()}</span>
                                <span className="mono text-right">{fmtNum(f.qty, f.qty < 1 ? 4 : 2)}</span>
                                <span className="mono text-right text-foreground-muted">{fmtPrice(f.price)}</span>
                                <span className="mono text-right font-bold" style={{ color: f.pnl >= 0 ? 'var(--up)' : 'var(--down)' }}>{f.pnl ? fmtSigned(f.pnl, 'INR', 0) : '—'}</span>
                                <span className="mono text-right text-faint">{new Date(f.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            </Row>
                        ))}
                    </Panel>
                </div>

                {/* order ticket */}
                <div className="panel p-4.5" style={{ padding: 18 }}>
                    <OrderTicket symbol={symbol} forcePaper />
                </div>
            </div>
        </div>
    );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="panel overflow-hidden">
            <div className="px-4.5 pb-2.5 pt-3.5 text-sm font-extrabold" style={{ paddingLeft: 18, paddingRight: 18 }}>{title}</div>
            {children}
        </div>
    );
}
function TableHead({ cols, head }: { cols: string; head: string[] }) {
    return (
        <div className="grid border-b border-t border-border2 px-4.5 py-2 text-[10px] font-bold tracking-wide text-faint" style={{ gridTemplateColumns: cols, paddingLeft: 18, paddingRight: 18 }}>
            {head.map((h, i) => <span key={i} className={i === 0 ? '' : 'text-right'}>{h}</span>)}
        </div>
    );
}
function Row({ cols, children }: { cols: string; children: React.ReactNode }) {
    return (
        <div className="grid items-center border-b border-border2 px-4.5 py-2.5 text-[12.5px]" style={{ gridTemplateColumns: cols, paddingLeft: 18, paddingRight: 18 }}>
            {children}
        </div>
    );
}
function EmptyRow({ text }: { text: string }) {
    return <div className="px-4.5 py-6 text-center text-[12px] text-faint" style={{ paddingLeft: 18 }}>{text}</div>;
}
