'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageShell, Panel, Button, Select, NumberInput, Field, DataTable, EmptyState, Badge, SegmentedControl, type Column } from '@/components/ui';
import { useAlertStore } from '@/stores/alertStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { describeAlert, type Alert, type AlertKind, type AlertOp } from '@/lib/alerts';

const KINDS: { value: AlertKind; label: string; hint: string }[] = [
    { value: 'price', label: 'Price', hint: 'Last traded price' },
    { value: 'changePct', label: '% change', hint: 'Move since previous close' },
    { value: 'rsi', label: 'RSI', hint: 'Needs ~15 min of observed prices first' },
    { value: 'high24h', label: '24h high', hint: 'Rolling high' },
    { value: 'low24h', label: '24h low', hint: 'Rolling low' },
];

export default function AlertsPage() {
    const { alerts, add, remove, toggle } = useAlertStore();
    // Select the raw lists and derive here. Selecting `s.allSymbols()` returned a
    // fresh array each render, which useSyncExternalStore treats as a changed
    // snapshot — an infinite render loop.
    const lists = useWatchlistStore((s) => s.lists);
    const symbols = useMemo(() => [...new Set(lists.flatMap((l) => l.symbols))], [lists]);

    const [symbol, setSymbol] = useState(symbols[0] ?? 'BTC/USDT');
    const [kind, setKind] = useState<AlertKind>('price');
    const [op, setOp] = useState<AlertOp>('above');
    const [value, setValue] = useState(0);
    const [repeat, setRepeat] = useState(false);
    const [notify, setNotify] = useState(false);

    const create = () => {
        if (!Number.isFinite(value)) return toast.error('Enter a value');
        add({ symbol, kind, op, value, repeat, enabled: true, notify });
        toast.success('Alert armed', { description: `${symbol}: ${describeAlert({ kind, op, value } as Alert)}` });
    };

    const cols: Column<Alert>[] = [
        { key: 'sym', header: 'Instrument', width: '1.2fr', render: (a) => <span className="font-semibold">{a.symbol}</span> },
        { key: 'cond', header: 'Condition', width: '1.6fr', render: (a) => <span className="text-foreground-muted">{describeAlert(a)}</span> },
        { key: 'last', header: 'Last reading', width: '1fr', align: 'right', render: (a) => <span className="mono text-faint">{a.lastValue != null ? Math.round(a.lastValue * 100) / 100 : '—'}</span> },
        {
            key: 'status', header: 'Status', width: '1fr',
            render: (a) => (
                <Badge tone={!a.enabled ? 'neutral' : a.triggerCount > 0 ? 'accent' : 'up'}>
                    {!a.enabled ? 'off' : a.triggerCount > 0 ? `fired ${a.triggerCount}×` : 'armed'}
                </Badge>
            ),
        },
        { key: 'repeat', header: 'Repeat', width: '.7fr', render: (a) => <span className="text-xs text-faint">{a.repeat ? 'yes' : 'once'}</span> },
        {
            key: 'act', header: '', width: '1.2fr', align: 'right',
            render: (a) => (
                <span className="flex justify-end gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => toggle(a.id)}>{a.enabled ? 'Pause' : 'Arm'}</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(a.id)} aria-label="Delete">✕</Button>
                </span>
            ),
        },
    ];

    return (
        <PageShell
            title="Alerts"
            coachTopic="alerts"
            subtitle="Watch a condition and get told when it happens — rather than staring at the screen."
        >
            <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
                <Panel title="New alert">
                    <div className="flex flex-col gap-3">
                        <Field label="Instrument">
                            <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                                {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </Field>
                        <Field label="When" hint={KINDS.find((k) => k.value === kind)?.hint}>
                            <Select value={kind} onChange={(e) => setKind(e.target.value as AlertKind)}>
                                {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                            </Select>
                        </Field>
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Direction">
                                <SegmentedControl
                                    label="Direction" fullWidth size="sm" value={op} onChange={setOp}
                                    options={[{ value: 'above', label: 'Above' }, { value: 'below', label: 'Below' }]}
                                />
                            </Field>
                            <Field label="Value">
                                <NumberInput value={value} onChangeValue={setValue} min={-1e9} step={0.01} />
                            </Field>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-foreground-muted">
                            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
                            Keep firing each time it crosses
                        </label>
                        <label className="flex items-center gap-2 text-sm text-foreground-muted">
                            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                            Also send to my notification channels
                        </label>
                        <Button variant="primary" fullWidth onClick={create}>Arm alert</Button>
                        <p className="text-xs text-faint">
                            Alerts fire on the <strong>crossing</strong>, not continuously — so one set below the current
                            price waits until the price comes back up through it. A triggered alert offers to place the
                            order; it never places one for you.
                        </p>
                    </div>
                </Panel>

                <Panel padding="none" title={`Your alerts (${alerts.length})`}>
                    <DataTable
                        columns={cols}
                        rows={alerts}
                        getRowKey={(a) => a.id}
                        minWidth={820}
                        empty={<EmptyState title="No alerts yet" body="Set one on the left — for example, RELIANCE below 1,300." />}
                    />
                </Panel>
            </div>
        </PageShell>
    );
}
