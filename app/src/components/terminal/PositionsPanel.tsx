'use client';

import { useState } from 'react';
import { usePaperStore } from '@/stores/paperStore';
import { useMarketStore } from '@/stores/marketStore';
import { unrealizedPnlBase, fxRate } from '@/lib/paperEngine';
import { fmtPrice, fmtSigned, fmtNum } from '@/lib/format';

type Tab = 'positions' | 'orders' | 'history';

export function PositionsPanel() {
    const [tab, setTab] = useState<Tab>('positions');
    const state = usePaperStore((s) => s.state);
    const cancel = usePaperStore((s) => s.cancel);
    const quotes = useMarketStore((s) => s.quotes);

    const positions = Object.values(state.positions);
    const openOrders = state.orders.filter((o) => o.status === 'open' || o.status === 'partial');
    const fills = state.fills;

    return (
        <div className="border-t border-border">
            <div className="flex gap-5 px-4.5 pt-2.5 text-[12px] font-bold" style={{ paddingLeft: 18, paddingRight: 18 }}>
                {(['positions', 'orders', 'history'] as Tab[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`pb-2 capitalize ${tab === t ? 'text-foreground' : 'text-faint'}`}
                        style={tab === t ? { borderBottom: '2px solid var(--accent)' } : undefined}
                    >
                        {t}{' '}
                        <span className="font-semibold text-faint">
                            {t === 'positions' ? positions.length : t === 'orders' ? openOrders.length : fills.length}
                        </span>
                    </button>
                ))}
            </div>

            <div className="max-h-[220px] overflow-auto">
                {tab === 'positions' && (
                    <Table cols="1.4fr .8fr .8fr 1fr 1fr 1fr" head={['INSTRUMENT', 'SIDE', 'QTY', 'AVG', 'LTP', 'P&L']}>
                        {positions.length === 0 && <Empty text="No open positions" />}
                        {positions.map((p) => {
                            const q = quotes[p.symbol];
                            const ltp = q?.price ?? p.avgPrice;
                            const pnl = unrealizedPnlBase(p, quotes);
                            const long = p.qty >= 0;
                            return (
                                <div key={p.symbol} className="grid items-center border-b border-border2 px-4.5 py-2.5 text-[12px]" style={{ gridTemplateColumns: '1.4fr .8fr .8fr 1fr 1fr 1fr', paddingLeft: 18, paddingRight: 18 }}>
                                    <span className="font-bold">{p.symbol}</span>
                                    <span className="text-[10px] font-bold" style={{ color: long ? 'var(--up)' : 'var(--down)' }}>{long ? 'LONG' : 'SHORT'}</span>
                                    <span className="mono text-right">{fmtNum(Math.abs(p.qty), Math.abs(p.qty) < 1 ? 4 : 2)}</span>
                                    <span className="mono text-right text-foreground-muted">{fmtPrice(p.avgPrice)}</span>
                                    <span className="mono text-right">{fmtPrice(ltp)}</span>
                                    <span className="mono text-right font-bold" style={{ color: pnl >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtSigned(pnl, 'INR', 0)}</span>
                                </div>
                            );
                        })}
                    </Table>
                )}

                {tab === 'orders' && (
                    <Table cols="1.3fr .7fr .7fr .8fr .9fr .9fr .6fr" head={['INSTRUMENT', 'SIDE', 'TYPE', 'QTY', 'PRICE', 'STATUS', '']}>
                        {openOrders.length === 0 && <Empty text="No open orders" />}
                        {openOrders.map((o) => (
                            <div key={o.id} className="grid items-center border-b border-border2 px-4.5 py-2.5 text-[12px]" style={{ gridTemplateColumns: '1.3fr .7fr .7fr .8fr .9fr .9fr .6fr', paddingLeft: 18, paddingRight: 18 }}>
                                <span className="font-bold">{o.symbol}</span>
                                <span className="text-[10px] font-bold" style={{ color: o.side === 'buy' ? 'var(--up)' : 'var(--down)' }}>{o.side.toUpperCase()}</span>
                                <span className="text-[10px] uppercase text-foreground-muted">{o.type}</span>
                                <span className="mono text-right">{fmtNum(o.qty - o.filledQty, o.qty < 1 ? 4 : 2)}</span>
                                <span className="mono text-right text-foreground-muted">{fmtPrice(o.limitPrice ?? o.stopPrice ?? 0)}</span>
                                <span className="text-[10px] uppercase" style={{ color: o.status === 'partial' ? 'var(--warn)' : 'var(--foreground-muted)' }}>{o.status}</span>
                                <button onClick={() => cancel(o.id)} className="text-right text-faint hover:text-down">✕</button>
                            </div>
                        ))}
                    </Table>
                )}

                {tab === 'history' && (
                    <Table cols="1.4fr .7fr .8fr 1fr 1fr .8fr" head={['INSTRUMENT', 'SIDE', 'QTY', 'PRICE', 'P&L', 'TIME']}>
                        {fills.length === 0 && <Empty text="No trades yet" />}
                        {fills.map((f) => (
                            <div key={f.id} className="grid items-center border-b border-border2 px-4.5 py-2.5 text-[12px]" style={{ gridTemplateColumns: '1.4fr .7fr .8fr 1fr 1fr .8fr', paddingLeft: 18, paddingRight: 18 }}>
                                <span className="font-bold">{f.symbol}</span>
                                <span className="text-[10px] font-bold" style={{ color: f.side === 'buy' ? 'var(--up)' : 'var(--down)' }}>{f.side.toUpperCase()}</span>
                                <span className="mono text-right">{fmtNum(f.qty, f.qty < 1 ? 4 : 2)}</span>
                                <span className="mono text-right text-foreground-muted">{fmtPrice(f.price)}</span>
                                <span className="mono text-right font-bold" style={{ color: f.pnl >= 0 ? 'var(--up)' : 'var(--down)' }}>{f.pnl ? fmtSigned(f.pnl, 'INR', 0) : '—'}</span>
                                <span className="mono text-right text-faint">{new Date(f.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        ))}
                    </Table>
                )}
            </div>
        </div>
    );
}

function Table({ cols, head, children }: { cols: string; head: string[]; children: React.ReactNode }) {
    return (
        <div>
            <div className="grid border-b border-t border-border2 px-4.5 py-2 text-[10px] font-bold tracking-wide text-faint" style={{ gridTemplateColumns: cols, paddingLeft: 18, paddingRight: 18 }}>
                {head.map((h, i) => (
                    <span key={i} className={i === 0 ? '' : 'text-right'}>{h}</span>
                ))}
            </div>
            {children}
        </div>
    );
}

function Empty({ text }: { text: string }) {
    return <div className="px-4.5 py-6 text-center text-[12px] text-faint" style={{ paddingLeft: 18 }}>{text}</div>;
}
