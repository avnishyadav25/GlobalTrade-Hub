'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useMarketStore } from '@/stores/marketStore';
import { usePaperStore } from '@/stores/paperStore';
import { useAgentStore, type TradeMode } from '@/stores/agentStore';
import { allInstruments } from '@/lib/instruments';
import { deriveFxRates } from '@/lib/paperEngine';
import { checkGuardrails, sizeFromGuardrails, signalKey, priceForSignal } from '@/lib/agentGuardrails';
import { fmtPrice, fmtMoney } from '@/lib/format';
import type { TradeSignal } from '@/lib/ai/types';
import { PageShell } from '@/components/ui/PageShell';

const PROVIDERS = [
    { id: '', label: 'Default (DeepSeek)' },
    { id: 'deepseek', label: 'DeepSeek' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'gemini', label: 'Gemini' },
    { id: 'anthropic', label: 'Anthropic' },
];

function snapshot() {
    const quotes = useMarketStore.getState().quotes;
    const market = allInstruments()
        .filter((a) => quotes[a.symbol] != null)
        .map((a) => ({ symbol: a.symbol, price: quotes[a.symbol].price, changePercent: quotes[a.symbol].changePercent }));
    const positions = Object.values(usePaperStore.getState().state.positions).map((p) => ({ symbol: p.symbol, qty: p.qty, avgPrice: p.avgPrice }));
    return { market, positions };
}

export default function AgentsPage() {
    const router = useRouter();
    const store = useAgentStore();
    const place = usePaperStore((s) => s.place);
    const [busy, setBusy] = useState('');
    const [briefing, setBriefing] = useState(store.lastBriefing);
    const [nlQuery, setNlQuery] = useState('oversold crypto with momentum');
    const [journalNote, setJournalNote] = useState<string>('');

    const post = async (agent: string, body: object) => {
        const res = await fetch(`/api/agents/${agent}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, provider: store.provider || undefined }) });
        return res.json();
    };

    const runSignals = async () => {
        setBusy('signals');
        try {
            const { market, positions } = snapshot();
            const data = await post('signals', { market, positions });
            store.setSignals(data.signals ?? []);
            toast.success(`Signals ready (${data.source})`, { description: data.provider ? `via ${data.provider}` : undefined });
        } catch { toast.error('Signals failed'); } finally { setBusy(''); }
    };

    const runBriefing = async () => {
        setBusy('briefing');
        try {
            const { market, positions } = snapshot();
            const data = await post('briefing', { market, positions });
            setBriefing(data.text ?? '');
            store.setBriefing(data.text ?? '');
            toast.success(`Briefing ready (${data.source})`);
        } catch { toast.error('Briefing failed'); } finally { setBusy(''); }
    };

    const runScanner = async () => {
        setBusy('scanner');
        try {
            const data = await post('scanner', { query: nlQuery });
            if (!data.criteria) { toast.error('Could not turn that into scan criteria'); return; }
            // Hand the criteria to the scanner instead of dropping them on the floor —
            // the previous version pushed to /scanner, which then showed its defaults.
            sessionStorage.setItem('gth-scan-criteria', JSON.stringify({ criteria: data.criteria, query: nlQuery }));
            toast.success('Scanner criteria generated', { description: nlQuery });
            router.push('/scanner?from=agent');
        } catch { toast.error('Scanner failed'); } finally { setBusy(''); }
    };

    const runJournal = async () => {
        setBusy('journal');
        try {
            const fills = usePaperStore.getState().state.fills.filter((f) => f.pnl !== 0);
            if (!fills.length) { toast.message('No closed trades yet'); return; }
            const f = fills[0];
            const data = await post('journal', { trade: { symbol: f.symbol, side: f.side, pnl: f.pnl } });
            setJournalNote(`${data.note?.mood ?? ''} — ${data.note?.note ?? ''}`);
            toast.success(`Journal note (${data.source})`);
        } catch { toast.error('Journal failed'); } finally { setBusy(''); }
    };

    // Manual "Trade →" runs the SAME guardrails as the automatic loop. It used to
    // honour only maxOrderValueINR, so this button could place orders the auto path
    // would have refused.
    const applySignal = (sig: TradeSignal) => {
        const quotes = useMarketStore.getState().quotes;
        const book = usePaperStore.getState().state;
        const verdict = checkGuardrails({
            guardrails: store.guardrails,
            book,
            sig,
            actedIds: store.autoActedIds,
            killSwitch: store.killSwitch,
        });
        if (!verdict.allowed) {
            toast.error('Blocked by your guardrails', { description: verdict.reason });
            return;
        }
        const fx = deriveFxRates(quotes);
        const qty = sizeFromGuardrails(sig.symbol, priceForSignal(sig, quotes), store.guardrails, fx);
        if (qty <= 0) {
            toast.error('Cannot size this order', { description: 'One unit already exceeds your max order value.' });
            return;
        }
        const result = place({ symbol: sig.symbol, side: sig.side, type: 'market', qty, source: { kind: 'agent' } });
        if (result.status === 'rejected') {
            toast.error('Order rejected', { description: result.reason });
            return;
        }
        store.markActed(signalKey(sig));
        toast.success(`Paper: ${sig.side} ${qty} ${sig.symbol}`, {
            description: result.status === 'filled' ? 'Filled' : 'Working',
        });
    };

    return (
        <PageShell
            title="AI Agents"
            coachTopic="agents"
            subtitle="Multi-provider agents (DeepSeek default). Run on demand, or let the trading agent act automatically under your guardrails."
        >

            {/* control bar */}
            <div className="panel mb-5 flex flex-wrap items-end gap-4 p-4">
                <div>
                    <div className="mb-1 text-2xs font-bold tracking-wide text-faint">LLM PROVIDER</div>
                    <select value={store.provider} onChange={(e) => store.setProvider(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-base outline-none">
                        {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                </div>
                <div>
                    <div className="mb-1 text-2xs font-bold tracking-wide text-faint">TRADING MODE</div>
                    <div className="flex gap-1 rounded-sm border border-border bg-chip p-0.5 text-sm" role="radiogroup" aria-label="Trading mode">
                        {(['manual', 'auto-paper', 'auto-live'] as TradeMode[]).map((m) => (
                            <button key={m} onClick={() => store.setMode(m)} role="radio" aria-checked={store.mode === m} className={`rounded-xs px-3 py-1.5 transition-colors ${store.mode === m ? 'bg-panel border border-border shadow-elev-1 text-foreground font-semibold' : 'border border-transparent text-foreground-muted hover:text-foreground'}`}>{m}</button>
                        ))}
                    </div>
                </div>
                {store.mode === 'auto-live' && (
                    <label className="flex items-center gap-2 text-sm font-semibold text-down">
                        <input type="checkbox" checked={store.liveArmed} onChange={(e) => store.setLiveArmed(e.target.checked)} />
                        Arm LIVE (real money)
                    </label>
                )}
                <button onClick={() => store.setKillSwitch(!store.killSwitch)} className="rounded-lg px-3 py-2 text-sm font-bold" style={{ background: store.killSwitch ? 'var(--down)' : 'transparent', color: store.killSwitch ? '#fff' : 'var(--down)', border: '1px solid var(--down)' }}>
                    {store.killSwitch ? '● KILL-SWITCH ON' : 'Kill-switch'}
                </button>
                <div className="ml-auto text-xs text-faint">
                    {store.mode === 'manual' ? 'Manual — agents run only when you click.' : store.killSwitch ? 'Halted by kill-switch.' : `Auto every 60s (${store.mode}).`}
                </div>
            </div>

            {/* guardrails */}
            <div className="panel mb-6 p-4">
                <div className="mb-3 border-b border-border2 pb-3">
                    <div className="text-sm font-bold">Guardrails</div>
                    <p className="mt-1 max-w-[80ch] text-xs text-foreground-muted">
                        These bind <strong>every automated path</strong> — the agents on this page and the
                        deterministic strategies on <a href="/signals" className="text-accent underline underline-offset-2">/signals</a> alike.
                        Caps on exposure apply when opening a position; none of them can stop you closing one.
                        A value of <span className="mono">0</span> disables that cap.
                    </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Guard label="MAX ORDER VALUE ₹" value={store.guardrails.maxOrderValueINR} onChange={(v) => store.setGuardrails({ maxOrderValueINR: v })} />
                    <Guard label="MAX DAILY LOSS ₹" value={store.guardrails.maxDailyLossINR} onChange={(v) => store.setGuardrails({ maxDailyLossINR: v })} />
                    <Guard label="MAX OPEN POSITIONS" value={store.guardrails.maxOpenPositions} onChange={(v) => store.setGuardrails({ maxOpenPositions: v })} />
                    <Guard label="MAX ORDERS / DAY" value={store.guardrails.maxOrdersPerDay} onChange={(v) => store.setGuardrails({ maxOrdersPerDay: v })} />
                    <Guard label="MAX PER SYMBOL %" value={store.guardrails.maxPerSymbolPct} onChange={(v) => store.setGuardrails({ maxPerSymbolPct: v })} max={100} />
                    <Guard label="SQUARE-OFF BUFFER MIN" value={store.guardrails.squareOffBufferMin} onChange={(v) => store.setGuardrails({ squareOffBufferMin: v })} />
                    <Guard
                        label="MIN CONFIDENCE (AI ONLY)"
                        value={store.guardrails.minConfidence}
                        onChange={(v) => store.setGuardrails({ minConfidence: v })}
                        max={100}
                        hint="Rule-based strategies carry no confidence score, so this does not apply to them."
                    />
                    <Toggle
                        label="TRADE ONLY WHEN OPEN"
                        checked={store.guardrails.tradeOnlyWhenOpen}
                        onChange={(v) => store.setGuardrails({ tradeOnlyWhenOpen: v })}
                        hint="Crypto is always open; NSE and forex are not."
                    />
                </div>
            </div>

            <div className="grid gap-5" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
                {/* signals */}
                <div className="panel p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-base font-bold">Trading signals</div>
                        <button onClick={runSignals} disabled={busy === 'signals'} className="rounded-lg bg-accent px-3.5 py-2 text-sm font-bold text-[color:var(--cp-text)] disabled:opacity-60">{busy === 'signals' ? 'Analysing…' : 'Run'}</button>
                    </div>
                    {store.lastSignals.length === 0 && <div className="py-6 text-center text-sm text-faint">No signals yet — click Run.</div>}
                    <div className="flex flex-col gap-2.5">
                        {store.lastSignals.map((s, i) => (
                            <div key={i} className="rounded-lg border border-border bg-background p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">{s.symbol}</span>
                                        <span className="text-2xs font-bold" style={{ color: s.side === 'buy' ? 'var(--up)' : 'var(--down)' }}>{s.side.toUpperCase()}</span>
                                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-bold text-accent">{s.confidence}%</span>
                                    </div>
                                    <button onClick={() => applySignal(s)} className="rounded-md bg-chip px-2.5 py-1 text-xs font-bold hover:bg-accent hover:text-[color:var(--cp-text)]">Trade →</button>
                                </div>
                                <div className="mono mt-1.5 flex gap-4 text-xs text-foreground-muted">
                                    <span>entry {fmtPrice(s.entry)}</span><span>SL {fmtPrice(s.stop)}</span><span>TP {fmtPrice(s.target)}</span>
                                </div>
                                <div className="mt-1.5 text-sm text-foreground-muted">{s.rationale}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* right column: briefing / journal / scanner */}
                <div className="flex flex-col gap-5">
                    <div className="panel p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-base font-bold">Daily briefing</div>
                            <button onClick={runBriefing} disabled={busy === 'briefing'} className="rounded-lg bg-accent px-3.5 py-2 text-sm font-bold text-[color:var(--cp-text)] disabled:opacity-60">{busy === 'briefing' ? '…' : 'Run'}</button>
                        </div>
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted" style={{ fontFamily: 'inherit' }}>{briefing || 'Generate a morning brief across all 5 markets.'}</pre>
                    </div>

                    <div className="panel p-4">
                        <div className="mb-2 text-base font-bold">Scanner agent</div>
                        <input value={nlQuery} onChange={(e) => setNlQuery(e.target.value)} className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-base outline-none" placeholder="e.g. oversold large-cap crypto" />
                        <button onClick={runScanner} disabled={busy === 'scanner'} className="w-full rounded-lg bg-accent py-2 text-sm font-bold text-[color:var(--cp-text)] disabled:opacity-60">{busy === 'scanner' ? '…' : 'Generate scan → Scanner'}</button>
                    </div>

                    <div className="panel p-4">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="text-base font-bold">Journal writer</div>
                            <button onClick={runJournal} disabled={busy === 'journal'} className="rounded-lg bg-accent px-3.5 py-2 text-sm font-bold text-[color:var(--cp-text)] disabled:opacity-60">{busy === 'journal' ? '…' : 'Latest trade'}</button>
                        </div>
                        <div className="text-sm text-foreground-muted">{journalNote || 'Writes a coach note + mood tag for your most recent closed trade.'}</div>
                    </div>
                </div>
            </div>

            <div className="mt-4 text-xs text-faint">Guardrails apply to auto modes. Current cap ≈ {fmtMoney(store.guardrails.maxOrderValueINR, 'INR', 0)} per order · coach rules from Insights are also enforced.</div>
        </PageShell>
    );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
    return (
        <div>
            <div className="mb-1 text-2xs font-bold tracking-wide text-faint">{label}</div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="accent-[color:var(--accent)]"
                />
                <span className="text-sm">{checked ? 'On' : 'Off'}</span>
            </label>
            {hint && <div className="mt-1 text-2xs text-faint">{hint}</div>}
        </div>
    );
}

function Guard({ label, value, onChange, max, hint }: { label: string; value: number; onChange: (v: number) => void; max?: number; hint?: string }) {
    return (
        <div>
            <div className="mb-1 text-2xs font-bold tracking-wide text-faint">{label}</div>
            <input
                type="number"
                min={0}
                max={max}
                value={value}
                // Clamp here: a cleared field yields 0, which used to size orders down
                // to a single unit instead of blocking them.
                onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    onChange(Math.max(0, max != null ? Math.min(max, n) : n));
                }}
                className="mono w-full rounded-lg border border-border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            />
            {hint && <div className="mt-1 text-2xs text-faint">{hint}</div>}
        </div>
    );
}
