'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useMarketStore } from '@/stores/marketStore';
import { usePaperStore } from '@/stores/paperStore';
import { useAgentStore, type TradeMode } from '@/stores/agentStore';
import { WATCHLIST_ASSETS } from '@/lib/mockData';
import { fxRate } from '@/lib/paperEngine';
import { fmtPrice, fmtMoney } from '@/lib/format';
import type { TradeSignal } from '@/lib/ai/types';

const PROVIDERS = [
    { id: '', label: 'Default (DeepSeek)' },
    { id: 'deepseek', label: 'DeepSeek' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'gemini', label: 'Gemini' },
    { id: 'anthropic', label: 'Anthropic' },
];

function snapshot() {
    const quotes = useMarketStore.getState().quotes;
    const market = WATCHLIST_ASSETS.map((a) => ({ symbol: a.symbol, price: quotes[a.symbol]?.price ?? a.price, changePercent: quotes[a.symbol]?.changePercent ?? a.changePercent }));
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
            toast.success('Scanner criteria generated', { description: JSON.stringify(data.criteria).slice(0, 80) });
            router.push('/scanner');
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

    const applySignal = (sig: TradeSignal) => {
        const price = useMarketStore.getState().quotes[sig.symbol]?.price ?? sig.entry;
        const rawQty = store.guardrails.maxOrderValueINR / (price * fxRate(sig.symbol));
        const qty = sig.symbol.includes('/') ? +rawQty.toFixed(4) : Math.max(1, Math.floor(rawQty));
        place({ symbol: sig.symbol, side: sig.side, type: 'market', qty });
        toast.success(`Paper: ${sig.side} ${qty} ${sig.symbol}`);
    };

    return (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 30px 60px' }}>
            <div className="mb-5">
                <div className="text-[22px] font-extrabold">AI Agents</div>
                <div className="text-[13px] text-foreground-muted">Multi-provider agents (DeepSeek default). Run on demand, or let the trading agent act automatically under your guardrails.</div>
            </div>

            {/* control bar */}
            <div className="panel mb-5 flex flex-wrap items-center gap-4" style={{ padding: 16 }}>
                <div>
                    <div className="mb-1 text-[10.5px] font-bold tracking-wide text-faint">LLM PROVIDER</div>
                    <select value={store.provider} onChange={(e) => store.setProvider(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none">
                        {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                </div>
                <div>
                    <div className="mb-1 text-[10.5px] font-bold tracking-wide text-faint">TRADING MODE</div>
                    <div className="flex gap-1 rounded-lg bg-chip p-1 text-[12px] font-semibold">
                        {(['manual', 'auto-paper', 'auto-live'] as TradeMode[]).map((m) => (
                            <button key={m} onClick={() => store.setMode(m)} className={`rounded-md px-3 py-1.5 ${store.mode === m ? 'bg-panel text-foreground' : 'text-foreground-muted'}`}>{m}</button>
                        ))}
                    </div>
                </div>
                {store.mode === 'auto-live' && (
                    <label className="flex items-center gap-2 text-[12.5px] font-semibold text-down">
                        <input type="checkbox" checked={store.liveArmed} onChange={(e) => store.setLiveArmed(e.target.checked)} />
                        Arm LIVE (real money)
                    </label>
                )}
                <button onClick={() => store.setKillSwitch(!store.killSwitch)} className="rounded-lg px-3 py-2 text-[12.5px] font-bold" style={{ background: store.killSwitch ? 'var(--down)' : 'transparent', color: store.killSwitch ? '#fff' : 'var(--down)', border: '1px solid var(--down)' }}>
                    {store.killSwitch ? '● KILL-SWITCH ON' : 'Kill-switch'}
                </button>
                <div className="ml-auto text-[11.5px] text-faint">
                    {store.mode === 'manual' ? 'Manual — agents run only when you click.' : store.killSwitch ? 'Halted by kill-switch.' : `Auto every 60s (${store.mode}).`}
                </div>
            </div>

            {/* guardrails */}
            <div className="panel mb-6 grid gap-4" style={{ padding: 16, gridTemplateColumns: 'repeat(4,1fr)' }}>
                <Guard label="MAX ORDER VALUE ₹" value={store.guardrails.maxOrderValueINR} onChange={(v) => store.setGuardrails({ maxOrderValueINR: v })} />
                <Guard label="MAX DAILY LOSS ₹" value={store.guardrails.maxDailyLossINR} onChange={(v) => store.setGuardrails({ maxDailyLossINR: v })} />
                <Guard label="MAX OPEN POSITIONS" value={store.guardrails.maxOpenPositions} onChange={(v) => store.setGuardrails({ maxOpenPositions: v })} />
                <Guard label="MIN CONFIDENCE" value={store.guardrails.minConfidence} onChange={(v) => store.setGuardrails({ minConfidence: v })} />
            </div>

            <div className="grid gap-5" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
                {/* signals */}
                <div className="panel" style={{ padding: 18 }}>
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-base font-extrabold">Trading signals</div>
                        <button onClick={runSignals} disabled={busy === 'signals'} className="rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-bold text-[color:var(--cp-text)] disabled:opacity-60">{busy === 'signals' ? 'Analysing…' : 'Run'}</button>
                    </div>
                    {store.lastSignals.length === 0 && <div className="py-6 text-center text-[12.5px] text-faint">No signals yet — click Run.</div>}
                    <div className="flex flex-col gap-2.5">
                        {store.lastSignals.map((s, i) => (
                            <div key={i} className="rounded-lg border border-border bg-background p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">{s.symbol}</span>
                                        <span className="text-[10px] font-bold" style={{ color: s.side === 'buy' ? 'var(--up)' : 'var(--down)' }}>{s.side.toUpperCase()}</span>
                                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">{s.confidence}%</span>
                                    </div>
                                    <button onClick={() => applySignal(s)} className="rounded-md bg-chip px-2.5 py-1 text-[11px] font-bold hover:bg-accent hover:text-[color:var(--cp-text)]">Trade →</button>
                                </div>
                                <div className="mono mt-1.5 flex gap-4 text-[11px] text-foreground-muted">
                                    <span>entry {fmtPrice(s.entry)}</span><span>SL {fmtPrice(s.stop)}</span><span>TP {fmtPrice(s.target)}</span>
                                </div>
                                <div className="mt-1.5 text-[12px] text-foreground-muted">{s.rationale}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* right column: briefing / journal / scanner */}
                <div className="flex flex-col gap-5">
                    <div className="panel" style={{ padding: 18 }}>
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-base font-extrabold">Daily briefing</div>
                            <button onClick={runBriefing} disabled={busy === 'briefing'} className="rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-bold text-[color:var(--cp-text)] disabled:opacity-60">{busy === 'briefing' ? '…' : 'Run'}</button>
                        </div>
                        <pre className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground-muted" style={{ fontFamily: 'inherit' }}>{briefing || 'Generate a morning brief across all 5 markets.'}</pre>
                    </div>

                    <div className="panel" style={{ padding: 18 }}>
                        <div className="mb-2 text-base font-extrabold">Scanner agent</div>
                        <input value={nlQuery} onChange={(e) => setNlQuery(e.target.value)} className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none" placeholder="e.g. oversold large-cap crypto" />
                        <button onClick={runScanner} disabled={busy === 'scanner'} className="w-full rounded-lg bg-accent py-2 text-[12.5px] font-bold text-[color:var(--cp-text)] disabled:opacity-60">{busy === 'scanner' ? '…' : 'Generate scan → Scanner'}</button>
                    </div>

                    <div className="panel" style={{ padding: 18 }}>
                        <div className="mb-2 flex items-center justify-between">
                            <div className="text-base font-extrabold">Journal writer</div>
                            <button onClick={runJournal} disabled={busy === 'journal'} className="rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-bold text-[color:var(--cp-text)] disabled:opacity-60">{busy === 'journal' ? '…' : 'Latest trade'}</button>
                        </div>
                        <div className="text-[12.5px] text-foreground-muted">{journalNote || 'Writes a coach note + mood tag for your most recent closed trade.'}</div>
                    </div>
                </div>
            </div>

            <div className="mt-4 text-[11.5px] text-faint">Guardrails apply to auto modes. Current cap ≈ {fmtMoney(store.guardrails.maxOrderValueINR, 'INR', 0)} per order · coach rules from Insights are also enforced.</div>
        </div>
    );
}

function Guard({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <div>
            <div className="mb-1 text-[10.5px] font-bold tracking-wide text-faint">{label}</div>
            <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="mono w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none" />
        </div>
    );
}
