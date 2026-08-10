'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageShell, Panel, Tabs, DataTable, EmptyState, Button, Badge, SideBadge, PriceText, type Column } from '@/components/ui';
import { usePaperStore } from '@/stores/paperStore';
import { ordersByStatus, fillsForOrder, type PaperOrder } from '@/lib/paperEngine';
import { fmtNum, fmtMoney } from '@/lib/format';

type Tab = 'open' | 'executed' | 'rejected';

export default function OrdersPage() {
    const state = usePaperStore((s) => s.state);
    const cancel = usePaperStore((s) => s.cancel);
    const [tab, setTab] = useState<Tab>('open');
    const [expanded, setExpanded] = useState<string | null>(null);

    const open = useMemo(() => ordersByStatus(state, 'open', 'partial'), [state]);
    const executed = useMemo(() => ordersByStatus(state, 'filled'), [state]);
    const rejected = useMemo(() => ordersByStatus(state, 'rejected', 'cancelled'), [state]);

    const rows = tab === 'open' ? open : tab === 'executed' ? executed : rejected;

    const common: Column<PaperOrder>[] = [
        {
            key: 'symbol', header: 'Instrument', width: '1.4fr',
            render: (o) => (
                <span className="flex items-center gap-2">
                    <span className="font-semibold">{o.symbol}</span>
                    <SideBadge side={o.side} />
                </span>
            ),
        },
        { key: 'type', header: 'Type', width: '.7fr', render: (o) => <span className="text-xs uppercase text-foreground-muted">{o.type}</span> },
        { key: 'qty', header: 'Qty', width: '.8fr', align: 'right', render: (o) => <span className="mono">{fmtNum(o.qty, o.qty < 1 ? 4 : 2)}</span> },
    ];

    const byTab: Record<Tab, Column<PaperOrder>[]> = {
        open: [
            ...common,
            { key: 'filled', header: 'Filled', width: '.9fr', align: 'right', render: (o) => <span className="mono text-foreground-muted">{fmtNum(o.filledQty, 4)} / {fmtNum(o.qty, 4)}</span> },
            { key: 'trigger', header: 'Price', width: '.9fr', align: 'right', render: (o) => o.limitPrice ?? o.stopPrice ? <PriceText value={(o.limitPrice ?? o.stopPrice)!} /> : <span className="text-faint">mkt</span> },
            { key: 'reserved', header: 'Reserved', width: '1fr', align: 'right', render: (o) => <span className="mono text-foreground-muted">{fmtMoney(o.reservedBase, 'INR', 0)}</span> },
            { key: 'action', header: '', width: '.7fr', align: 'right', render: (o) => <Button size="sm" variant="danger" onClick={() => { cancel(o.id); toast.success('Order cancelled'); }}>Cancel</Button> },
        ],
        executed: [
            ...common,
            { key: 'avg', header: 'Avg fill', width: '1fr', align: 'right', render: (o) => <PriceText value={o.avgFillPrice} /> },
            { key: 'fees', header: 'Charges', width: '.9fr', align: 'right', render: (o) => <span className="mono text-foreground-muted">{fmtMoney(o.fees, 'INR', 2)}</span> },
            { key: 'when', header: 'Time', width: '.9fr', align: 'right', render: (o) => <span className="mono text-faint">{new Date(o.updatedAt).toLocaleTimeString()}</span> },
            {
                key: 'fills', header: 'Fills', width: '.7fr', align: 'right',
                render: (o) => {
                    const n = fillsForOrder(state, o.id).length;
                    return <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>{n} {expanded === o.id ? '▴' : '▾'}</Button>;
                },
            },
        ],
        rejected: [
            ...common,
            { key: 'status', header: 'Status', width: '.8fr', render: (o) => <Badge tone={o.status === 'rejected' ? 'down' : 'neutral'}>{o.status}</Badge> },
            { key: 'reason', header: 'Reason', width: '2.6fr', render: (o) => <span className="text-foreground-muted">{o.rejectReason ?? '—'}</span> },
        ],
    };

    return (
        <PageShell
            title="Orders"
            coachTopic="orders"
            subtitle="Every order this account has placed — including the ones that were refused, and why."
        >
            <Panel padding="none">
                <Tabs
                    label="Order status"
                    value={tab}
                    onChange={setTab}
                    tabs={[
                        { value: 'open', label: 'Open', count: open.length },
                        { value: 'executed', label: 'Executed', count: executed.length },
                        { value: 'rejected', label: 'Rejected', count: rejected.length },
                    ]}
                />
                <DataTable
                    columns={byTab[tab]}
                    rows={rows}
                    getRowKey={(o) => o.id}
                    minWidth={820}
                    empty={
                        <EmptyState
                            title={tab === 'open' ? 'No working orders' : tab === 'executed' ? 'No executed orders yet' : 'Nothing refused'}
                            body={
                                tab === 'rejected'
                                    ? 'Orders blocked by the kill-switch, a coach rule or insufficient buying power appear here with the exact reason.'
                                    : 'Place an order from the Terminal and it will show up here.'
                            }
                        />
                    }
                />
                {tab === 'executed' && expanded && (
                    <div className="border-t border-border2 bg-panel2 px-4 py-3">
                        <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-faint">
                            Fills for this order — one order can fill in several pieces
                        </div>
                        {fillsForOrder(state, expanded).map((f) => (
                            <div key={f.id} className="mono flex justify-between border-b border-border2 py-1 text-sm last:border-0">
                                <span>{fmtNum(f.qty, 4)} @ <PriceText value={f.price} /></span>
                                <span className="text-faint">{f.kind} · fee {fmtMoney(f.fee, 'INR', 2)} · {new Date(f.ts).toLocaleTimeString()}</span>
                            </div>
                        ))}
                    </div>
                )}
            </Panel>
        </PageShell>
    );
}
