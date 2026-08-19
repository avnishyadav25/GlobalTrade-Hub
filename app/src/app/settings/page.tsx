'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { BROKERS, brokerById } from '@/lib/brokers/registry';
import { useUIStore } from '@/stores/uiStore';
import { usePaperStore } from '@/stores/paperStore';
import { fmtMoney } from '@/lib/format';
import { STARTING_CASH } from '@/lib/paperEngine';
import { PageShell } from '@/components/ui/PageShell';

interface ServerConnection {
    broker_id: string;
    label: string;
    mode: 'paper' | 'live';
    status: string;
    account_ref: string | null;
    last_verified_at: string | null;
    last_error: string | null;
}

export default function SettingsPage() {
    const { resolvedTheme, setTheme } = useTheme();
    // next-themes resolves only after mount; rendering against `undefined` before then
    // is what produced the hydration mismatch on this screen.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const tradeMode = useUIStore((s) => s.tradeMode);
    const setTradeMode = useUIStore((s) => s.setTradeMode);
    const resetPaper = usePaperStore((s) => s.reset);

    const [brokerId, setBrokerId] = useState(BROKERS[0].id);
    const [mode, setMode] = useState<'paper' | 'live'>('paper');
    const [creds, setCreds] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [channels, setChannels] = useState<string[]>([]);
    const [testing, setTesting] = useState(false);
    const [serverConns, setServerConns] = useState<ServerConnection[]>([]);
    const [vaultConfigured, setVaultConfigured] = useState(true);

    // brokerById can return undefined if a stale id is ever restored; fall back
    // rather than crashing the page on a non-null assertion.
    const broker = brokerById(brokerId) ?? BROKERS[0];

    useEffect(() => {
        fetch('/api/notify').then((r) => r.json()).then((d) => setChannels(d.channels ?? [])).catch(() => {});
        fetch('/api/brokers/connect')
            .then((r) => r.json())
            .then((d) => {
                setServerConns(Array.isArray(d.connections) ? d.connections : []);
                setVaultConfigured(d.configured !== false);
            })
            .catch(() => {});
    }, []);

    // The MODE toggle defaulted to 'paper' while the first broker (Zerodha) is
    // live-only, so the initial state was invalid and Connect posted a paper request
    // for a live-only venue.
    useEffect(() => {
        if (!broker.modes.includes(mode)) setMode(broker.modes[0]);
    }, [broker, mode]);

    const sendTest = async () => {
        setTesting(true);
        try {
            const res = await fetch('/api/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: '✅ GlobalTrade Hub test notification', subject: 'GlobalTrade Hub' }) });
            const data = await res.json();
            if (!data.channels?.length) toast.message('No channels configured', { description: data.message });
            else toast.success('Test sent', { description: data.channels.join(', ') });
        } catch {
            toast.error('Test failed');
        } finally {
            setTesting(false);
        }
    };

    const logout = async () => {
        await fetch('/api/auth/login', { method: 'DELETE' }).catch(() => {});
        // Drop broker-connection metadata, which asserts which venues this account is
        // linked to. Paper history and preferences are deliberately kept: this is a
        // single-admin app, and clearing them would destroy trade history that may not
        // be mirrored to Supabase.
        try {
            window.localStorage.removeItem('gth-connections');
        } catch {
            /* storage unavailable — nothing to clear */
        }
        window.location.href = '/auth/login';
    };

    // Connections come from the server (which knows what was actually verified),
    // not from a local list the client appends to optimistically.
    const loadConnections = async () => {
        try {
            const res = await fetch('/api/brokers/connect');
            if (!res.ok) return;
            const data = await res.json();
            setServerConns(Array.isArray(data.connections) ? data.connections : []);
        } catch {
            /* keep whatever we had */
        }
    };

    const disconnect = async (brokerId: string, m: string) => {
        await fetch(`/api/brokers/connect?brokerId=${encodeURIComponent(brokerId)}&mode=${m}`, { method: 'DELETE' }).catch(() => {});
        await loadConnections();
        toast.success('Disconnected');
    };

    const connect = async () => {
        setBusy(true);
        try {
            const res = await fetch('/api/brokers/connect', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ brokerId, mode, credentials: creds }),
            });
            const data = await res.json();
            // The badge now follows a REAL authentication result. Previously the client
            // added a green "connected" row on the strength of a response that had
            // verified nothing and stored nothing.
            if (data.status === 'connected' || data.status === 'verified_not_persisted') {
                setCreds({});
                await loadConnections();
                toast.success(`${broker.name} verified (${mode})`, {
                    description: data.accountRef ? `${data.message} · ${data.accountRef}` : data.message,
                });
            } else if (data.missing) {
                toast.error('Missing credentials', { description: data.missing.join(', ') });
            } else {
                toast.error('Could not connect', { description: data.reason ?? data.message ?? 'Unknown error' });
                await loadConnections();
            }
        } catch {
            toast.error('Connection request failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <PageShell width="narrow" title="Settings" coachTopic="settings">

            {/* Connections */}
            <Section title="Broker connections" subtitle="Keys are POSTed to the server, verified against the broker, and stored in Supabase Vault — never in your browser. Paper mode uses broker sandboxes / testnets where available.">
                {!vaultConfigured && (
                    <div className="mb-3 rounded-sm bg-warn-dim px-3.5 py-2.5 text-sm text-warn">
                        Supabase is not configured, so verified credentials cannot be stored. Connections will be checked
                        but not persisted.
                    </div>
                )}
                {serverConns.length === 0 && (
                    <div className="mb-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-base text-faint">
                        No connections yet. Add one below to route live orders; paper trading works without any connection.
                    </div>
                )}
                {serverConns.map((c) => (
                    <div key={`${c.broker_id}:${c.mode}`} className="mb-2 flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: c.status === 'connected' ? 'var(--up)' : 'var(--down)' }} />
                            <span className="text-base font-bold">{c.label}</span>
                            <span className="rounded-full bg-chip px-2 py-0.5 text-2xs font-bold uppercase text-foreground-muted">{c.mode}</span>
                            <span className="truncate text-xs text-faint">
                                {c.status === 'connected'
                                    ? `${c.account_ref ?? 'verified'}${c.last_verified_at ? ` · ${new Date(c.last_verified_at).toLocaleString()}` : ''}`
                                    : (c.last_error ?? 'not verified')}
                            </span>
                        </div>
                        <button onClick={() => disconnect(c.broker_id, c.mode)} className="ml-3 flex-shrink-0 text-sm font-semibold text-down">Disconnect</button>
                    </div>
                ))}

                {/* add form */}
                <div className="mt-4 rounded-xl border border-border bg-background p-4">
                    <div className="mb-3 grid grid-cols-2 gap-3">
                        <div>
                            <FieldLabel>BROKER / EXCHANGE</FieldLabel>
                            <select value={brokerId} onChange={(e) => { setBrokerId(e.target.value); setCreds({}); const b = brokerById(e.target.value)!; setMode(b.modes[0]); }} className="mt-1.5 w-full rounded-lg border border-border bg-panel px-3 py-2.5 text-base outline-none">
                                {BROKERS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <FieldLabel>MODE</FieldLabel>
                            <div className="mt-1.5 flex gap-1 rounded-sm border border-border bg-chip p-0.5 text-sm" role="radiogroup">
                                {broker.modes.map((m) => (
                                    <button key={m} onClick={() => setMode(m)} role="radio" aria-checked={mode === m} className={`flex-1 rounded-xs py-1.5 capitalize transition-colors ${mode === m ? 'bg-panel border border-border shadow-elev-1 text-foreground font-semibold' : 'border border-transparent text-foreground-muted hover:text-foreground'}`}>{m}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                    {broker.credentials.map((f) => (
                        <div key={f.key} className="mb-3">
                            <FieldLabel>{f.label.toUpperCase()}</FieldLabel>
                            <input
                                type={f.type === 'password' ? 'password' : 'text'}
                                value={creds[f.key] ?? ''}
                                placeholder={f.placeholder}
                                onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                                className="mt-1.5 w-full rounded-lg border border-border bg-panel px-3 py-2.5 text-base outline-none"
                            />
                        </div>
                    ))}
                    {broker.note && <div className="mb-3 text-sm text-faint">ℹ {broker.note}</div>}
                    <div className="flex items-center justify-between">
                        <a href={broker.docsUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent">API docs ↗</a>
                        <button onClick={connect} disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-base font-bold text-[color:var(--cp-text)] disabled:opacity-60">
                            {busy ? 'Connecting…' : 'Connect'}
                        </button>
                    </div>
                </div>
            </Section>

            {/* Appearance */}
            <Section title="Appearance & trading">
                <Toggle label="Theme" value={mounted ? (resolvedTheme === 'dark' ? 'Dark' : 'Light') : ''} options={['Dark', 'Light']} onSelect={(v) => setTheme(v === 'Dark' ? 'dark' : 'light')} />
                <Toggle label="Default order mode" value={tradeMode === 'paper' ? 'Paper' : 'Live'} options={['Paper', 'Live']} onSelect={(v) => setTradeMode(v === 'Paper' ? 'paper' : 'live')} />
            </Section>

            {/* Notifications */}
            <Section title="Notifications" subtitle="Alerts, filled orders, auto-trades and the daily briefing are sent to your enabled channels. Configure tokens via env (see docs/PROVIDERS.md).">
                <div className="mb-3 flex flex-wrap gap-2">
                    {['telegram', 'email', 'whatsapp'].map((c) => {
                        const on = channels.includes(c);
                        return (
                            <span key={c} className="flex items-center gap-1.5 rounded-full bg-chip px-3 py-1 text-sm font-semibold capitalize" style={{ color: on ? 'var(--up)' : 'var(--foreground-muted)' }}>
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? 'var(--up)' : 'var(--faint)' }} />
                                {c} {on ? '' : '· off'}
                            </span>
                        );
                    })}
                </div>
                <button onClick={sendTest} disabled={testing} className="rounded-lg bg-accent px-4 py-2 text-base font-bold text-[color:var(--cp-text)] disabled:opacity-60">
                    {testing ? 'Sending…' : 'Send test notification'}
                </button>
            </Section>

            {/* Paper */}
            <Section title="Paper account" subtitle={`Virtual balance for simulated trading. Starting capital ${fmtMoney(STARTING_CASH, 'INR', 0)}.`}>
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            // Destroys all persisted positions, orders and fills, and sits
                            // next to Sign out — confirm before doing it.
                            if (!window.confirm('Reset the paper account? This permanently deletes every position, order and trade in your history.')) return;
                            resetPaper();
                            toast.success('Paper account reset');
                        }}
                        className="rounded-lg border border-down/40 px-4 py-2 text-base font-bold text-down"
                    >
                        Reset paper account
                    </button>
                    <button onClick={logout} className="rounded-lg border border-border px-4 py-2 text-base font-bold text-foreground-muted">
                        Sign out
                    </button>
                </div>
            </Section>
        </PageShell>
    );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="panel mb-5 p-5">
            <div className="text-base font-bold">{title}</div>
            {subtitle && <div className="mb-4 mt-1 text-sm text-foreground-muted">{subtitle}</div>}
            {!subtitle && <div className="mb-4" />}
            {children}
        </div>
    );
}
function FieldLabel({ children }: { children: React.ReactNode }) {
    return <label className="text-2xs font-bold tracking-wide text-faint">{children}</label>;
}
function Toggle({ label, value, options, onSelect }: { label: string; value: string; options: string[]; onSelect: (v: string) => void }) {
    return (
        <div className="mb-3 flex items-center justify-between">
            <span className="text-base font-semibold">{label}</span>
            <div className="flex gap-1 rounded-lg bg-chip p-1 text-sm font-semibold">
                {options.map((o) => (
                    <button key={o} onClick={() => onSelect(o)} className={`rounded-md px-3 py-1.5 ${value === o ? 'bg-panel text-foreground' : 'text-foreground-muted'}`}>{o}</button>
                ))}
            </div>
        </div>
    );
}
