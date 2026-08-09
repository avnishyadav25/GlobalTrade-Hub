'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { BROKERS, brokerById } from '@/lib/brokers/registry';
import { useConnectionsStore } from '@/stores/connectionsStore';
import { useUIStore } from '@/stores/uiStore';
import { usePaperStore } from '@/stores/paperStore';
import { fmtMoney } from '@/lib/format';
import { STARTING_CASH } from '@/lib/paperEngine';

export default function SettingsPage() {
    const { resolvedTheme, setTheme } = useTheme();
    const connections = useConnectionsStore((s) => s.connections);
    const addConn = useConnectionsStore((s) => s.add);
    const removeConn = useConnectionsStore((s) => s.remove);
    const tradeMode = useUIStore((s) => s.tradeMode);
    const setTradeMode = useUIStore((s) => s.setTradeMode);
    const resetPaper = usePaperStore((s) => s.reset);

    const [brokerId, setBrokerId] = useState(BROKERS[0].id);
    const [mode, setMode] = useState<'paper' | 'live'>('paper');
    const [creds, setCreds] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    const broker = brokerById(brokerId)!;

    const connect = async () => {
        setBusy(true);
        try {
            const res = await fetch('/api/brokers/connect', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ brokerId, mode, credentials: creds }),
            });
            const data = await res.json();
            if (data.status === 'connected') {
                addConn({ brokerId, label: broker.name, mode, status: 'connected' });
                setCreds({});
                toast.success(`${broker.name} connected (${mode})`, { description: data.message });
            } else if (data.missing) {
                toast.error('Missing credentials', { description: data.missing.join(', ') });
            } else {
                toast.error('Could not connect', { description: data.error ?? 'Unknown error' });
            }
        } catch {
            toast.error('Connection request failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 30px 60px' }}>
            <div className="mb-6 text-[22px] font-extrabold">Settings</div>

            {/* Connections */}
            <Section title="Broker connections" subtitle="Keys are sent to the server and never stored in your browser. Paper mode uses broker sandboxes / testnets where available.">
                {connections.length === 0 && (
                    <div className="mb-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-[13px] text-faint">
                        No connections yet. Add one below to route live orders; paper trading works without any connection.
                    </div>
                )}
                {connections.map((c) => (
                    <div key={c.id} className="mb-2 flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                        <div className="flex items-center gap-3">
                            <span className="h-2 w-2 rounded-full" style={{ background: c.status === 'connected' ? 'var(--up)' : 'var(--down)' }} />
                            <span className="text-[13.5px] font-bold">{c.label}</span>
                            <span className="rounded-full bg-chip px-2 py-0.5 text-[10px] font-bold uppercase text-foreground-muted">{c.mode}</span>
                        </div>
                        <button onClick={() => { removeConn(c.id); toast.message('Disconnected', { description: c.label }); }} className="text-[12px] font-semibold text-down">Disconnect</button>
                    </div>
                ))}

                {/* add form */}
                <div className="mt-4 rounded-xl border border-border bg-background p-4">
                    <div className="mb-3 grid grid-cols-2 gap-3">
                        <div>
                            <FieldLabel>BROKER / EXCHANGE</FieldLabel>
                            <select value={brokerId} onChange={(e) => { setBrokerId(e.target.value); setCreds({}); const b = brokerById(e.target.value)!; setMode(b.modes[0]); }} className="mt-1.5 w-full rounded-lg border border-border bg-panel px-3 py-2.5 text-[13px] outline-none">
                                {BROKERS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <FieldLabel>MODE</FieldLabel>
                            <div className="mt-1.5 flex gap-1 rounded-lg bg-chip p-1 text-[12px] font-semibold">
                                {broker.modes.map((m) => (
                                    <button key={m} onClick={() => setMode(m)} className={`flex-1 rounded-md py-2 capitalize ${mode === m ? 'bg-panel text-foreground' : 'text-foreground-muted'}`}>{m}</button>
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
                                className="mt-1.5 w-full rounded-lg border border-border bg-panel px-3 py-2.5 text-[13px] outline-none"
                            />
                        </div>
                    ))}
                    {broker.note && <div className="mb-3 text-[12px] text-faint">ℹ {broker.note}</div>}
                    <div className="flex items-center justify-between">
                        <a href={broker.docsUrl} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-accent">API docs ↗</a>
                        <button onClick={connect} disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-[13px] font-bold text-[color:var(--cp-text)] disabled:opacity-60">
                            {busy ? 'Connecting…' : 'Connect'}
                        </button>
                    </div>
                </div>
            </Section>

            {/* Appearance */}
            <Section title="Appearance & trading">
                <Toggle label="Theme" value={resolvedTheme === 'dark' ? 'Dark' : 'Light'} options={['Dark', 'Light']} onSelect={(v) => setTheme(v === 'Dark' ? 'dark' : 'light')} />
                <Toggle label="Default order mode" value={tradeMode === 'paper' ? 'Paper' : 'Live'} options={['Paper', 'Live']} onSelect={(v) => setTradeMode(v === 'Paper' ? 'paper' : 'live')} />
            </Section>

            {/* Paper */}
            <Section title="Paper account" subtitle={`Virtual balance for simulated trading. Starting capital ${fmtMoney(STARTING_CASH, 'INR', 0)}.`}>
                <button onClick={() => { resetPaper(); toast.success('Paper account reset'); }} className="rounded-lg border border-down/40 px-4 py-2 text-[13px] font-bold text-down">
                    Reset paper account
                </button>
            </Section>
        </div>
    );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="panel mb-5" style={{ padding: 20 }}>
            <div className="text-base font-extrabold">{title}</div>
            {subtitle && <div className="mb-4 mt-1 text-[12.5px] text-foreground-muted">{subtitle}</div>}
            {!subtitle && <div className="mb-4" />}
            {children}
        </div>
    );
}
function FieldLabel({ children }: { children: React.ReactNode }) {
    return <label className="text-[10.5px] font-bold tracking-wide text-faint">{children}</label>;
}
function Toggle({ label, value, options, onSelect }: { label: string; value: string; options: string[]; onSelect: (v: string) => void }) {
    return (
        <div className="mb-3 flex items-center justify-between">
            <span className="text-[13.5px] font-semibold">{label}</span>
            <div className="flex gap-1 rounded-lg bg-chip p-1 text-[12px] font-semibold">
                {options.map((o) => (
                    <button key={o} onClick={() => onSelect(o)} className={`rounded-md px-3 py-1.5 ${value === o ? 'bg-panel text-foreground' : 'text-foreground-muted'}`}>{o}</button>
                ))}
            </div>
        </div>
    );
}
