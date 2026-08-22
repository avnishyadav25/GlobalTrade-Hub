'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageShell, Panel, DataTable, EmptyState, Button, StatTile, PnlText, PriceText, MarketBadge, ConfirmDialog, type Column } from '@/components/ui';
import { usePaperStore } from '@/stores/paperStore';
import { useMarketStore } from '@/stores/marketStore';
import { useUIStore } from '@/stores/uiStore';
import { deriveFxRates, positionMarketValueBase, unrealizedPnlBase, toBase, type PaperPosition } from '@/lib/paperEngine';
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format';

interface Row extends PaperPosition {
    ltp: number;
    value: number;
    pnl: number;
    pnlPct: number;
    dayPnl: number;
    realized: number;
}

export default function HoldingsPage() {
    const router = useRouter();
    const state = usePaperStore((s) => s.state);
    const place = usePaperStore((s) => s.place);
    const quotes = useMarketStore((s) => s.quotes);
    const setSymbol = useUIStore((s) => s.setSymbol);
    const [exiting, setExiting] = useState<Row | null>(null);

    const fx = deriveFxRates(quotes);

    const rows: Row[] = useMemo(
        () =>
            Object.values(state.positions).map((p) => {
                const ltp = quotes[p.symbol]?.price ?? p.avgPrice;
                const prev = quotes[p.symbol]?.prevClose ?? ltp;
                const value = positionMarketValueBase(p, quotes, fx);
                const pnl = unrealizedPnlBase(p, quotes, fx);
                return {
                    ...p,
                    ltp,
                    value,
                    pnl,
                    pnlPct: p.basisBase > 0 ? (pnl / p.basisBase) * 100 : 0,
                    dayPnl: toBase(p.symbol, (ltp - prev) * p.qty, fx),
                    realized: state.realizedBySymbol[p.symbol] ?? 0,
                };
            }),
        [state, quotes, fx]
    );

    const longs = rows.filter((r) => r.qty > 0);
    // Shorts are separated because they carry margin — a materially different position.
    const shorts = rows.filter((r) => r.qty < 0);

    const invested = rows.reduce((a, r) => a + r.basisBase, 0);
    const current = rows.reduce((a, r) => a + Math.abs(r.value), 0);
    const totalPnl = rows.reduce((a, r) => a + r.pnl, 0);
    const dayPnl = rows.reduce((a, r) => a + r.dayPnl, 0);

    const exit = (r: Row) => {
        const result = place({ symbol: r.symbol, side: r.qty > 0 ? 'sell' : 'buy', type: 'market', qty: Math.abs(r.qty), source: { kind: 'manual' } });
        if (result.status === 'rejected') toast.error('Could not exit', { description: result.reason });
        else toast.success(`Exited ${r.symbol}`);
        setExiting(null);
    };

    const cols = (withMargin: boolean): Column<Row>[] => [
        { key: 'symbol', header: 'Instrument', width: '1.3fr', render: (r) => <span className="font-semibold">{r.symbol}</span> },
        { key: 'market', header: 'Market', width: '.9fr', render: (r) => <MarketBadge market={r.market} /> },
        { key: 'qty', header: 'Qty', width: '.7fr', align: 'right', render: (r) => <span className="mono">{fmtNum(Math.abs(r.qty), Math.abs(r.qty) < 1 ? 4 : 2)}</span> },
        { key: 'avg', header: 'Avg', width: '.9fr', align: 'right', render: (r) => <PriceText value={r.avgPrice} /> },
        { key: 'ltp', header: 'LTP', width: '.9fr', align: 'right', render: (r) => <PriceText value={r.ltp} /> },
        { key: 'value', header: 'Value', width: '1fr', align: 'right', render: (r) => <span className="mono">{fmtMoney(Math.abs(r.value), 'INR', 0)}</span> },
        ...(withMargin
            ? [{ key: 'margin', header: 'Margin', width: '1fr', align: 'right' as const, render: (r: Row) => <span className="mono text-foreground-muted">{fmtMoney(r.marginHeldBase, 'INR', 0)}</span> }]
            : []),
        { key: 'pnl', header: 'P&L', width: '1.1fr', align: 'right', render: (r) => <span><PnlText value={r.pnl} /> <span className="text-xs text-faint">{fmtPct(r.pnlPct)}</span></span> },
        {
            key: 'act', header: '', width: '1.2fr', align: 'right',
            render: (r) => (
                <span className="flex justify-end gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => { setSymbol(r.symbol); router.push('/terminal'); }}>Chart</Button>
                    <Button size="sm" variant="secondary" onClick={() => setExiting(r)}>Exit</Button>
                </span>
            ),
        },
    ];

    return (
        <PageShell
            title="Holdings"
            coachTopic="holdings"
            subtitle="Everything you currently own, and anything you are short. Values update with the live feed."
        >
            <div className="mb-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Current value" value={fmtMoney(current, 'INR', 0)} sub={`${rows.length} position${rows.length === 1 ? '' : 's'}`} />
                <StatTile label="Invested" value={fmtMoney(invested, 'INR', 0)} sub="at entry cost" />
                <StatTile label="Day P&L" value={fmtMoney(dayPnl, 'INR', 0)} sub="since previous close" tone={dayPnl >= 0 ? 'up' : 'down'} />
                <StatTile label="Unrealised P&L" value={fmtMoney(totalPnl, 'INR', 0)} sub={invested > 0 ? fmtPct((totalPnl / invested) * 100) : '—'} tone={totalPnl >= 0 ? 'up' : 'down'} />
            </div>

            <Panel padding="none" title="Holdings" className="mb-5">
                <DataTable
                    columns={cols(false)}
                    rows={longs}
                    getRowKey={(r) => r.symbol}
                    minWidth={900}
                    empty={<EmptyState title="No holdings" body="Buy something on the Terminal and it will appear here." />}
                />
            </Panel>

            {shorts.length > 0 && (
                <Panel padding="none" title="Short positions" footer="Shorts hold margin against your cash until they are covered.">
                    <DataTable columns={cols(true)} rows={shorts} getRowKey={(r) => r.symbol} minWidth={1000} />
                </Panel>
            )}

            <ConfirmDialog
                open={!!exiting}
                title={`Exit ${exiting?.symbol ?? ''}?`}
                danger
                confirmLabel="Exit position"
                body={
                    exiting
                        ? `This places a market ${exiting.qty > 0 ? 'sell' : 'buy'} for ${fmtNum(Math.abs(exiting.qty), 4)} ${exiting.symbol}, closing the position at the current price.`
                        : ''
                }
                onConfirm={() => exiting && exit(exiting)}
                onCancel={() => setExiting(null)}
            />
        </PageShell>
    );
}
