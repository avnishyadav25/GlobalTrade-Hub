'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageShell, Panel, Badge, Button, Callout, EmptyState, ConfirmDialog } from '@/components/ui';
import { useStrategyStore } from '@/stores/strategyStore';
import { usePaperStore } from '@/stores/paperStore';
import { useAgentStore } from '@/stores/agentStore';
import { strategyById } from '@/lib/strategies/defs';
import { fmtNum } from '@/lib/format';

// What is actually running, and where.
//
// This screen exists because there was no way to answer either question. Instances were
// listed only on their own strategy's page, so two automatic instances on different
// strategies could be trading with nothing showing both; and nothing anywhere reported
// whether automation was live at all.
//
// EVERY status here is derived from evidence — a heartbeat that arrived, a run that
// happened — never from a setting being on. A scheduler on a sleeping laptop is not
// running, and this app has a history of screens that said otherwise.

interface Status {
    now: number;
    holder: 'browser' | 'server' | 'idle';
    ttlMs: number;
    browserHeartbeatAt: number | null;
    serverRanAt: number | null;
    lastRun: { at: number; placed: number; refused: number; reason?: string } | null;
    configured: boolean;
}

function ago(ms: number | null, now: number): string {
    if (!ms) return 'never';
    const s = Math.max(0, Math.round((now - ms) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    return `${Math.round(s / 3600)}h ago`;
}

export default function AutomationPage() {
    const instances = useStrategyStore((s) => s.instances);
    const setMode = useStrategyStore((s) => s.setMode);
    const setEnabled = useStrategyStore((s) => s.setEnabled);
    const remove = useStrategyStore((s) => s.remove);
    const killSwitch = useAgentStore((s) => s.killSwitch);
    const orders = usePaperStore((s) => s.state.orders);

    const [status, setStatus] = useState<Status | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirmId, setConfirmId] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        const load = async () => {
            try {
                const r = await fetch('/api/automation/status');
                if (alive && r.ok) setStatus(await r.json());
            } catch {
                // Leave the previous reading rather than flashing "not running" on a
                // transient network error — that would be its own kind of lie.
            } finally {
                if (alive) setLoading(false);
            }
        };
        load();
        const t = setInterval(load, 15_000);
        return () => { alive = false; clearInterval(t); };
    }, []);

    const auto = instances.filter((i) => i.enabled && i.mode === 'auto');
    const paused = instances.filter((i) => !i.enabled);

    /** Orders the ledger attributes to a strategy, newest first. */
    const strategyOrders = useMemo(
        () => orders.filter((o) => o.source?.kind === 'strategy').slice(0, 8),
        [orders]
    );

    const holder = status?.holder ?? 'idle';
    const toRemove = instances.find((i) => i.id === confirmId);

    return (
        <PageShell
            title="Automation"
            subtitle="Everything that is running, and whether anything is actually running it. Status here comes from a real check-in, never from a switch being on."
        >
            {killSwitch && (
                <Callout tone="down">
                    <strong>Kill-switch is on.</strong> Nothing will be placed by anything — automatic or manual — until you turn it off on{' '}
                    <Link href="/agents" className="underline underline-offset-2">the agents screen</Link>.
                </Callout>
            )}

            <Panel className="mb-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span
                                aria-hidden
                                className="inline-block h-2 w-2 shrink-0 rounded-full"
                                style={{ background: holder === 'idle' ? 'var(--faint)' : 'var(--up)' }}
                            />
                            <h2 className="text-sm font-semibold">
                                {loading
                                    ? 'Checking…'
                                    : holder === 'browser'
                                      ? 'Running in a browser tab'
                                      : holder === 'server'
                                        ? 'Running on the server'
                                        : 'Not running'}
                            </h2>
                        </div>
                        <p className="mt-1 max-w-[70ch] text-xs text-foreground-muted">
                            {holder === 'browser' &&
                                'A tab has this app open and is evaluating your strategies every 60 seconds. Close every tab and the server runner can take over — it stands down while a tab is live, because two writers cannot share one ledger.'}
                            {holder === 'server' &&
                                'A scheduler is calling the runner with no browser involved. It will stand down the moment you open a tab.'}
                            {holder === 'idle' &&
                                'No browser tab is evaluating strategies and no server run has checked in recently. Nothing is being traded automatically right now — regardless of what any instance below is set to.'}
                        </p>
                    </div>
                    <dl className="grid shrink-0 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                        <dt className="text-faint">Browser check-in</dt>
                        <dd className="mono">{status ? ago(status.browserHeartbeatAt, status.now) : '—'}</dd>
                        <dt className="text-faint">Last server run</dt>
                        <dd className="mono">{status ? ago(status.serverRanAt, status.now) : '—'}</dd>
                    </dl>
                </div>

                {status?.lastRun && (
                    <p className="mt-3 border-t border-border2 pt-3 text-xs">
                        <span className="text-faint">Last server run: </span>
                        {status.lastRun.placed > 0 ? (
                            <span style={{ color: 'var(--up)' }}>placed {status.lastRun.placed}</span>
                        ) : (
                            <span className="text-foreground-muted">placed nothing</span>
                        )}
                        {status.lastRun.refused > 0 && (
                            <span style={{ color: 'var(--warn)' }}> · {status.lastRun.refused} refused</span>
                        )}
                        {status.lastRun.reason && <span className="text-foreground-muted"> — {status.lastRun.reason}</span>}
                    </p>
                )}

                {!loading && holder === 'idle' && auto.length > 0 && (
                    <Callout tone="warn">
                        {auto.length} instance{auto.length === 1 ? ' is' : 's are'} set to automatic, but nothing is running them.
                        Open this app in a tab, or start the scheduler — see <code className="mono">docs/AUTOMATION.md</code>.
                    </Callout>
                )}
            </Panel>

            <Panel title={`Running instances (${instances.length})`} className="mb-5">
                {instances.length === 0 ? (
                    <EmptyState
                        title="Nothing is running"
                        body="Enable a strategy on an instrument from the strategy library. It starts in review mode, which posts signals and places nothing."
                        action={<Link href="/strategies"><Button variant="primary">Browse strategies</Button></Link>}
                    />
                ) : (
                    <ul className="flex flex-col gap-2">
                        {instances.map((i) => {
                            const strat = strategyById(i.strategyId);
                            const live = i.enabled && i.mode === 'auto';
                            return (
                                <li
                                    key={i.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-sm border p-3"
                                    style={{ borderColor: live ? 'var(--up)' : 'var(--border2)' }}
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Link href={`/strategies/${i.strategyId}`} className="text-sm font-semibold underline-offset-2 hover:underline">
                                                {strat?.name ?? i.strategyId}
                                            </Link>
                                            <Badge>{i.symbol}</Badge>
                                            <Badge>{i.timeframe}</Badge>
                                            {!i.enabled ? (
                                                <Badge tone="neutral">paused</Badge>
                                            ) : i.mode === 'auto' ? (
                                                <Badge tone="up">places automatically</Badge>
                                            ) : (
                                                <Badge tone="accent">asks first</Badge>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-foreground-muted">
                                            {!i.enabled
                                                ? 'Paused. It keeps its instrument, timeframe and parameters, and evaluates nothing until you resume it.'
                                                : i.mode === 'auto'
                                                  ? 'Places orders without asking, subject to your guardrails.'
                                                  : 'Posts what it wants to do to Signals and waits for you.'}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                        <Button size="sm" variant="ghost" onClick={() => { setMode(i.id, i.mode === 'auto' ? 'review' : 'auto'); toast.success(i.mode === 'auto' ? 'Now asks before placing' : 'Now places automatically'); }}>
                                            {i.mode === 'auto' ? 'Ask first' : 'Let it place'}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => { setEnabled(i.id, !i.enabled); toast.success(i.enabled ? 'Paused' : 'Resumed'); }}>
                                            {i.enabled ? 'Pause' : 'Resume'}
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => setConfirmId(i.id)}>Delete</Button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
                {paused.length > 0 && (
                    <p className="mt-3 text-xs text-faint">
                        {paused.length} paused instance{paused.length === 1 ? '' : 's'} kept with {paused.length === 1 ? 'its' : 'their'} parameters. Pausing is not deleting.
                    </p>
                )}
            </Panel>

            <Panel title="Recent orders placed by a strategy">
                {strategyOrders.length === 0 ? (
                    <p className="text-xs text-foreground-muted">
                        Nothing yet. When a strategy places an order it is recorded here and on{' '}
                        <Link href="/orders" className="text-accent underline underline-offset-2">Orders</Link>, stamped with which strategy placed it.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-1.5">
                        {strategyOrders.map((o) => (
                            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span className="flex items-center gap-2">
                                    <Badge tone={o.status === 'rejected' ? 'down' : 'up'}>{o.status}</Badge>
                                    <span className="font-semibold">{o.side.toUpperCase()} {fmtNum(o.qty, o.qty < 1 ? 6 : 2)} {o.symbol}</span>
                                    <span className="mono text-faint">{o.source?.strategyId}</span>
                                </span>
                                <span className="mono text-faint">
                                    {o.rejectReason ? o.rejectReason : new Date(o.updatedAt).toLocaleTimeString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>

            <ConfirmDialog
                open={confirmId !== null}
                title="Delete this instance?"
                body={`${toRemove ? `${strategyById(toRemove.strategyId)?.name ?? toRemove.strategyId} on ${toRemove.symbol}` : 'This instance'} will be removed along with its parameters. Pause instead if you only want it to stop trading for now.`}
                confirmLabel="Delete"
                danger
                onConfirm={() => { if (confirmId) { remove(confirmId); toast.success('Instance deleted'); } setConfirmId(null); }}
                onCancel={() => setConfirmId(null)}
            />
        </PageShell>
    );
}
