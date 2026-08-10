'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageShell, Panel, Tabs, DataTable, StatTile, Button, Badge, Callout, ConfirmDialog, PnlText, EmptyState, type Column } from '@/components/ui';
import { usePaperStore } from '@/stores/paperStore';
import { useMarketStore } from '@/stores/marketStore';
import { buildLedger, ledgerBalance, type LedgerRow } from '@/lib/ledger';
import { deriveFxRates, equity as engineEquity, reconciliationError, realizedNet, MAX_FILLS_RETAINED } from '@/lib/paperEngine';
import { fmtMoney } from '@/lib/format';

export default function FundsPage() {
    const state = usePaperStore((s) => s.state);
    const reset = usePaperStore((s) => s.reset);
    const quotes = useMarketStore((s) => s.quotes);
    const [tab, setTab] = useState<'balance' | 'ledger'>('balance');
    const [confirmReset, setConfirmReset] = useState(false);

    const fx = deriveFxRates(quotes);
    const rows = useMemo(() => buildLedger(state, fx), [state, fx]);
    const { account, positions } = state;
    const marginHeld = Object.values(positions).reduce((a, p) => a + p.marginHeldBase, 0);
    const holdings = Object.values(positions).filter((p) => p.qty > 0).reduce((a, p) => a + p.basisBase, 0);
    const eq = engineEquity(state, quotes, fx);
    const err = reconciliationError(state);
    const ledgerVsCash = ledgerBalance(rows) - account.cash;

    const cols: Column<LedgerRow>[] = [
        { key: 'ts', header: 'When', width: '1.1fr', render: (r) => <span className="mono text-faint">{r.ts ? new Date(r.ts).toLocaleString() : '—'}</span> },
        { key: 'sym', header: 'Instrument', width: '.9fr', render: (r) => <span className="font-medium">{r.symbol}</span> },
        { key: 'kind', header: 'Type', width: '.8fr', render: (r) => <Badge tone={r.kind === 'fee' ? 'warn' : r.kind === 'realized' ? 'accent' : 'neutral'}>{r.kind}</Badge> },
        { key: 'desc', header: 'Description', width: '2.2fr', render: (r) => <span className="text-foreground-muted">{r.description}</span> },
        { key: 'amt', header: 'Amount', width: '1fr', align: 'right', render: (r) => (r.amount === 0 ? <span className="text-faint">—</span> : <PnlText value={r.amount} decimals={2} />) },
        { key: 'bal', header: 'Balance', width: '1.1fr', align: 'right', render: (r) => <span className="mono">{fmtMoney(r.balance, 'INR', 2)}</span> },
    ];

    return (
        <PageShell title="Funds" coachTopic="funds" subtitle="Where your money is, and every movement that put it there.">
            <Panel padding="none">
                <Tabs label="Funds view" value={tab} onChange={setTab} tabs={[{ value: 'balance', label: 'Balance' }, { value: 'ledger', label: 'Ledger', count: rows.length }]} />

                {tab === 'balance' && (
                    <div className="p-4">
                        <div className="mb-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                            <StatTile label="Equity" value={fmtMoney(eq, 'INR', 0)} sub="cash + positions" />
                            <StatTile label="Available cash" value={fmtMoney(account.cash - account.reservedCash, 'INR', 0)} sub={account.reservedCash > 0 ? `${fmtMoney(account.reservedCash, 'INR', 0)} reserved` : 'nothing reserved'} />
                            <StatTile label="Margin held" value={fmtMoney(marginHeld, 'INR', 0)} sub="against short positions" />
                            <StatTile label="Realised P&L" value={fmtMoney(realizedNet(state), 'INR', 0)} sub={`after ${fmtMoney(account.feesPaid, 'INR', 0)} charges`} tone={realizedNet(state) >= 0 ? 'up' : 'down'} />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <Panel title="Account">
                                <dl className="text-sm">
                                    {[
                                        ['Opening balance', account.startingCash],
                                        ['Cash', account.cash],
                                        ['Reserved against open orders', account.reservedCash],
                                        ['Margin held', marginHeld],
                                        ['Cost of holdings', holdings],
                                        ['Realised (gross)', account.realizedGross],
                                        ['Charges paid', -account.feesPaid],
                                    ].map(([label, v]) => (
                                        <div key={label as string} className="flex justify-between border-b border-border2 py-1.5 last:border-0">
                                            <dt className="text-foreground-muted">{label}</dt>
                                            <dd className="mono">{fmtMoney(v as number, 'INR', 2)}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </Panel>

                            <Panel title="Books balance">
                                {/* Surfacing the invariant the engine guarantees, rather than asking
                                    you to take the numbers on trust. */}
                                <p className="mb-3 text-sm text-foreground-muted">
                                    Every rupee is accounted for by this identity. If it ever drifts from zero, the
                                    numbers on every other screen are suspect.
                                </p>
                                <code className="mono mb-3 block rounded-sm bg-background px-3 py-2 text-xs leading-relaxed text-foreground-muted">
                                    cash + margin + cost of holdings<br />= opening + realised − charges
                                </code>
                                <div className="flex items-center justify-between border-t border-border2 pt-3">
                                    <span className="text-sm text-foreground-muted">Difference</span>
                                    <Badge tone={Math.abs(err) < 1e-6 ? 'up' : 'down'}>
                                        {Math.abs(err) < 1e-6 ? 'balanced — ₹0.00' : `off by ${fmtMoney(err, 'INR', 2)}`}
                                    </Badge>
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-sm text-foreground-muted">Ledger vs cash</span>
                                    <Badge tone={Math.abs(ledgerVsCash) < 0.01 ? 'up' : 'down'}>
                                        {Math.abs(ledgerVsCash) < 0.01 ? 'matches' : fmtMoney(ledgerVsCash, 'INR', 2)}
                                    </Badge>
                                </div>
                            </Panel>
                        </div>

                        <div className="mt-5 flex items-center gap-3">
                            <Button variant="danger" onClick={() => setConfirmReset(true)}>Reset paper account</Button>
                            <span className="text-sm text-faint">Wipes all positions, orders and history.</span>
                        </div>
                    </div>
                )}

                {tab === 'ledger' && (
                    <>
                        {state.fillsTruncated && (
                            <div className="px-4 pt-3">
                                <Callout tone="warn">
                                    Showing the most recent {MAX_FILLS_RETAINED} movements. Older fills are trimmed for storage —
                                    the balances above are running totals and remain exact.
                                </Callout>
                            </div>
                        )}
                        <DataTable
                            columns={cols}
                            rows={[...rows].reverse()}
                            getRowKey={(r) => r.id}
                            minWidth={900}
                            empty={<EmptyState title="No movements yet" body="Your statement fills in as you trade." />}
                            footer={`${rows.length} movements · closing balance ${fmtMoney(ledgerBalance(rows), 'INR', 2)}`}
                        />
                    </>
                )}
            </Panel>

            <ConfirmDialog
                open={confirmReset}
                danger
                title="Reset the paper account?"
                confirmLabel="Reset everything"
                body="This permanently deletes every position, order and trade in your history, and returns the balance to ₹5,00,000."
                onConfirm={() => { reset(); setConfirmReset(false); toast.success('Paper account reset'); }}
                onCancel={() => setConfirmReset(false)}
            />
        </PageShell>
    );
}
