'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageShell, Panel, Badge, Button, EmptyState, Tabs } from '@/components/ui';
import { useSignalStore, type QueuedSignal, type SignalStatus } from '@/stores/signalStore';
import { useStrategyStore } from '@/stores/strategyStore';
import { useMarketStore } from '@/stores/marketStore';
import { placeSignal } from '@/lib/strategies/place';
import { strategyById } from '@/lib/strategies/defs';
import { fmtPrice, fmtPct } from '@/lib/format';
import { ageLabel } from '@/lib/marketData/staleness';

type Tab = 'pending' | 'history';

const TONE: Record<SignalStatus, 'up' | 'down' | 'warn' | 'neutral'> = {
    pending: 'neutral',
    approved: 'neutral',
    placed: 'up',
    rejected: 'down',
    skipped: 'neutral',
    expired: 'warn',
};

export default function SignalsPage() {
    const [tab, setTab] = useState<Tab>('pending');
    const signals = useSignalStore((s) => s.signals);
    const setStatus = useSignalStore((s) => s.setStatus);
    const clearDecided = useSignalStore((s) => s.clearDecided);
    const instances = useStrategyStore((s) => s.instances);
    const setMode = useStrategyStore((s) => s.setMode);
    const quotes = useMarketStore((s) => s.quotes);

    const pending = useMemo(() => signals.filter((s) => s.status === 'pending'), [signals]);
    const history = useMemo(() => signals.filter((s) => s.status !== 'pending'), [signals]);
    const rows = tab === 'pending' ? pending : history;

    const approve = (signal: QueuedSignal) => {
        const outcome = placeSignal(signal);
        if (outcome.ok) toast.success(`Placed ${signal.side} ${outcome.qty} ${signal.symbol}`);
        else toast.error('Order refused', { description: outcome.reason });
    };

    const alwaysAuto = (signal: QueuedSignal) => {
        setMode(signal.instanceId, 'auto');
        approve(signal);
        toast.message('Switched to automatic', {
            description: 'This strategy will place its own orders from now on. Change it back on the Strategies screen.',
        });
    };

    return (
        <PageShell
            title="Signals"
            coachTopic="signals"
            subtitle="What your strategies want to do, and why. Nothing is placed until you approve it — unless you have switched that strategy to automatic. Automatic orders still pass the same guardrails as the AI agents: order value, daily loss, open positions, orders per day, concentration and market hours. Those caps limit what you can open; none of them can stop you closing a position."
            actions={history.length > 0 ? <Button size="sm" variant="ghost" onClick={clearDecided}>Clear history</Button> : undefined}
        >
            <Tabs
                label="Signal state"
                value={tab}
                onChange={setTab}
                tabs={[
                    { value: 'pending', label: 'Waiting', count: pending.length },
                    { value: 'history', label: 'Decided', count: history.length },
                ]}
            />

            <div className="mt-4 flex flex-col gap-3">
                {rows.length === 0 && (
                    <EmptyState
                        title={tab === 'pending' ? 'Nothing waiting' : 'Nothing decided yet'}
                        body={
                            instances.some((i) => i.enabled)
                                ? 'Your enabled strategies are running and have not found a setup. Silence is a normal state — most strategies trade rarely, and one that fires constantly is usually reacting to noise.'
                                : 'No strategies are enabled yet.'
                        }
                        action={<Link href="/strategies"><Button variant="primary">Browse strategies</Button></Link>}
                    />
                )}

                {rows.map((signal) => {
                    const strategy = strategyById(signal.strategyId);
                    const live = quotes[signal.symbol];
                    const drift = live?.price && signal.price ? ((live.price - signal.price) / signal.price) * 100 : null;

                    return (
                        <Panel key={signal.id} padding="dense">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge tone={signal.side === 'buy' ? 'up' : 'down'}>
                                            {signal.intent === 'exit' ? 'CLOSE' : signal.side.toUpperCase()}
                                        </Badge>
                                        <span className="text-sm font-semibold">{signal.symbol}</span>
                                        <span className="text-xs text-faint">{signal.strategyName}</span>
                                        <Badge>{signal.timeframe}</Badge>
                                        {signal.auto && <Badge tone="accent">auto</Badge>}
                                        {signal.status !== 'pending' && <Badge tone={TONE[signal.status]}>{signal.status}</Badge>}
                                    </div>

                                    <p className="mt-1.5 text-sm text-foreground-muted">{signal.reason}</p>

                                    <div className="mono mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
                                        <span>signal {fmtPrice(signal.price)}</span>
                                        {live && <span>now {fmtPrice(live.price)}</span>}
                                        {drift != null && (
                                            <span style={{ color: Math.abs(drift) > 1 ? 'var(--down)' : undefined }}>
                                                moved {fmtPct(drift)} since
                                            </span>
                                        )}
                                        {signal.stop != null && <span>stop {fmtPrice(signal.stop)}</span>}
                                        {signal.target != null && <span>target {fmtPrice(signal.target)}</span>}
                                        <span>{ageLabel(signal.createdAt)}</span>
                                        {signal.qty != null && <span>qty {signal.qty}</span>}
                                    </div>

                                    {signal.rejectReason && (
                                        <p className="mt-1.5 text-xs text-down">Refused: {signal.rejectReason}</p>
                                    )}
                                </div>

                                {signal.status === 'pending' && (
                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                        <Button size="sm" variant="primary" onClick={() => approve(signal)}>Send to paper</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setStatus(signal.id, 'skipped')}>Skip</Button>
                                        <Button size="sm" variant="ghost" onClick={() => alwaysAuto(signal)}>Always auto</Button>
                                    </div>
                                )}
                            </div>

                            {strategy && signal.status === 'pending' && (
                                <p className="mt-3 border-t border-border2 pt-2.5 text-xs text-faint">
                                    <span className="font-semibold text-foreground-muted">Where this fails: </span>
                                    {strategy.explain.whenItFails}
                                </p>
                            )}
                        </Panel>
                    );
                })}
            </div>
        </PageShell>
    );
}
