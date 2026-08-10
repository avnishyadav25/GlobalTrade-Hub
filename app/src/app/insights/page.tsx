'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Ring, BarTrend } from '@/components/charts';
import { usePaperStore } from '@/stores/paperStore';
import { useCoachStore } from '@/stores/coachStore';
import { computeCoachReport, summariseForAI, COACH_RULES, type FillLite, type CoachReport } from '@/lib/coach';
import { PageShell } from '@/components/ui/PageShell';

// Token-driven so both themes read correctly; the previous rgba() literals were
// dark-palette tints sitting under light-palette text.
const sevStyle: Record<string, string> = {
    High: 'bg-down-dim text-down',
    Medium: 'bg-warn-dim text-warn',
    Low: 'bg-accent-soft text-accent',
};
const moodStyle: Record<string, string> = {
    Calm: 'bg-up-dim text-up',
    Patient: 'bg-accent-soft text-accent',
    FOMO: 'bg-down-dim text-down',
    Tilt: 'bg-down-dim text-down',
};

/** The model's output is untrusted: coerce it into the shape the UI can render. */
function sanitisePatterns(raw: unknown): CoachReport['patterns'] {
    if (!Array.isArray(raw)) return [];
    const sevs = ['High', 'Medium', 'Low'] as const;
    return raw.slice(0, 6).map((p) => {
        const o = (p ?? {}) as Record<string, unknown>;
        const sev = sevs.includes(o.sev as never) ? (o.sev as 'High' | 'Medium' | 'Low') : 'Low';
        const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
        return {
            sev,
            freq: str(o.freq, '—'),
            title: str(o.title, 'Pattern'),
            desc: str(o.desc, ''),
            cost: str(o.cost, '—'),
        };
    }).filter((p) => p.desc);
}

export default function InsightsPage() {
    const fills = usePaperStore((s) => s.state.fills);
    const applied = useCoachStore((s) => s.appliedRules);
    const toggleRule = useCoachStore((s) => s.toggleRule);
    const [aiPatterns, setAiPatterns] = useState<CoachReport['patterns'] | null>(null);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const fillLite: FillLite[] = useMemo(
        () => fills.map((f) => ({ symbol: f.symbol, side: f.side, pnl: f.pnl, ts: f.ts, kind: f.kind })),
        [fills]
    );
    const report = useMemo(() => computeCoachReport(fillLite), [fillLite]);
    const patterns = aiPatterns && aiPatterns.length ? aiPatterns : report.patterns;

    const refreshAI = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/coach', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(summariseForAI(fillLite)),
            });
            const data = await res.json();
            if (data.source === 'ai') {
                setAiPatterns(sanitisePatterns(data.patterns));
                setAiSummary(data.summary);
                toast.success('Coach refreshed with AI');
            } else {
                toast.message('AI coach not configured', {
                    description:
                        'Set an LLM key on the server (DEEPSEEK_API_KEY by default, or OPENAI_/GEMINI_/ANTHROPIC_API_KEY) to enable AI analysis. Showing heuristic report.',
                });
            }
        } catch {
            toast.error('Could not reach the coach service');
        } finally {
            setLoading(false);
        }
    };

    const stat = (label: string, value: string, sub: string, subCol?: string) => (
        <div className="panel p-4">
            <div className="text-sm font-bold tracking-wide text-faint">{label}</div>
            <div className="mono my-2 text-3xl font-bold">{value}</div>
            <div className="text-sm font-semibold" style={{ color: subCol }}>{sub}</div>
        </div>
    );

    return (
        <PageShell
            coachTopic="insights"
            title={
                <span className="flex flex-wrap items-center gap-2.5">
                    Trading Coach
                    <span className="rounded-full bg-accent-soft px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide text-accent">
                        {report.source === 'ai' || aiPatterns ? 'AI · learns from you' : 'learns from you'}
                    </span>
                </span>
            }
            subtitle={aiSummary || report.summary}
            actions={
                <button
                    onClick={refreshAI}
                    disabled={loading}
                    className="whitespace-nowrap rounded-sm bg-accent px-3 py-2 text-sm font-semibold text-[color:var(--cp-text)] transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                    {loading ? 'Analysing…' : '✨ Refresh with AI'}
                </button>
            }
        >

            {/* stat row */}
            <div className="mb-6 grid gap-3.5" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr' }}>
                <div className="panel flex items-center gap-4 p-4">
                    <div className="relative" style={{ width: 92, height: 92, flexShrink: 0 }}>
                        <Ring score={report.disciplineScore} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="mono text-2xl font-bold leading-none">{report.disciplineScore}</span>
                            <span className="text-2xs font-bold tracking-wide text-faint">/ 100</span>
                        </div>
                    </div>
                    <div>
                        <div className="mb-1 text-sm font-bold tracking-wide text-faint">DISCIPLINE SCORE</div>
                        <div className="text-base leading-snug text-foreground-muted">Based on {report.tradesAnalyzed} closed paper trades. Keep logging to sharpen it.</div>
                        <div className="mt-2.5" style={{ width: 160, height: 34 }}>
                            {report.trend.length > 1 ? (
                                <BarTrend vals={report.trend} />
                            ) : (
                                // Six of the seven bars here used to be hardcoded literals.
                                <span className="text-xs text-faint">Trend appears after trading on more than one day.</span>
                            )}
                        </div>
                    </div>
                </div>
                {stat('WIN RATE', report.tradesAnalyzed ? `${report.winRate.toFixed(0)}%` : '—', `${report.tradesAnalyzed} trades`, report.winRate >= 50 ? 'var(--up)' : 'var(--down)')}
                {stat('AVG R : R', report.avgRR.toFixed(1), report.avgRR >= 2 ? 'on target' : 'target 2.0', report.avgRR >= 2 ? 'var(--up)' : 'var(--down)')}
                {stat('RULE ADHERENCE', `${report.ruleAdherence}%`, 'from detected revenge trades', report.ruleAdherence >= 70 ? 'var(--up)' : 'var(--warn)')}
            </div>

            {/* patterns */}
            <div className="mb-3.5 flex items-center gap-2.5">
                <span className="text-base font-bold">Patterns we&apos;ve spotted</span>
                <span className="text-sm text-faint">Recurring mistakes, ranked by what they cost you</span>
            </div>
            <div className="mb-7 grid gap-3.5" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                {patterns.map((p, i) => (
                    <div key={i} className="panel flex flex-col p-4">
                        <div className="mb-2.5 flex items-center justify-between">
                            <span className={`rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide ${sevStyle[p.sev] ?? sevStyle.Low}`}>{p.sev}</span>
                            <span className="text-xs font-semibold text-faint">{p.freq}</span>
                        </div>
                        <div className="mb-1.5 text-md font-semibold">{p.title}</div>
                        <div className="flex-1 text-sm leading-relaxed text-foreground-muted">{p.desc}</div>
                        <div className="mt-3.5 flex items-center justify-between border-t border-border2 pt-3">
                            <span className="text-xs text-faint">Est. cost</span>
                            <span className="mono text-sm font-bold text-down">{p.cost}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* rules + breakdown */}
            <div className="mb-7 grid gap-6" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
                <div>
                    <div className="text-base font-bold">Suggested rule changes</div>
                    <div className="mb-3.5 text-sm text-faint">Applied rules are enforced on every paper order — the ticket, the Agents screen and auto-trading all go through the same check. Live routing is not implemented yet.</div>
                    <div className="flex flex-col gap-3">
                        {COACH_RULES.map((r) => {
                            const on = !!applied[r.id];
                            return (
                                <div key={r.id} className="panel flex items-start gap-3.5 p-4">
                                    <div className="flex-1">
                                        <div className="mb-1.5 text-sm font-bold">{r.title}</div>
                                        <div className="mb-2 text-sm leading-relaxed text-foreground-muted">{r.desc}</div>
                                        <div className="text-xs font-semibold text-up">{r.saves}</div>
                                    </div>
                                    <button
                                        onClick={() => toggleRule(r.id)}
                                        className="flex-shrink-0 rounded-sm border px-4 py-2 text-sm font-bold"
                                        style={{
                                            background: on ? 'var(--up)' : 'transparent',
                                            color: on ? 'var(--cp-text)' : 'var(--accent)',
                                            borderColor: on ? 'var(--up)' : 'var(--accent)',
                                        }}
                                    >
                                        {on ? '✓ Applied' : 'Apply rule'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <div className="text-base font-bold">Discipline breakdown</div>
                    <div className="mb-3.5 text-sm text-faint">Where the score comes from.</div>
                    <div className="panel flex flex-col gap-4 p-5">
                        {report.bars.map((b) => (
                            <div key={b.label}>
                                <div className="mb-1.5 flex justify-between text-sm">
                                    <span className="font-semibold">{b.label}</span>
                                    <span className="mono font-bold" style={{ color: b.col }}>{b.val}</span>
                                </div>
                                <div className="h-[7px] overflow-hidden rounded-full" style={{ background: 'var(--border2)' }}>
                                    <div className="h-full rounded-full" style={{ width: `${b.val}%`, background: b.col }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* journal */}
            <div className="text-base font-bold">Trade journal</div>
            <div className="mb-3.5 text-sm text-faint">Auto-tagged by emotion &amp; outcome, with a note from your coach.</div>
            <div className="panel overflow-hidden">
                <div className="grid border-b border-border2 py-2.5 text-2xs font-bold tracking-wide text-faint" style={{ gridTemplateColumns: '1.1fr .7fr .9fr .6fr 1fr 2.2fr' }}>
                    <span>INSTRUMENT</span><span>SIDE</span><span className="text-right">P&amp;L</span><span className="text-right">R</span><span className="text-center">MOOD</span><span>COACH NOTE</span>
                </div>
                {report.journal.length === 0 && <div className="py-8 text-center text-sm text-faint">No trades yet — your journal fills as you trade.</div>}
                {report.journal.map((j, i) => (
                    <div key={i} className="grid items-center border-b border-border2 py-3 text-sm" style={{ gridTemplateColumns: '1.1fr .7fr .9fr .6fr 1fr 2.2fr' }}>
                        <span className="font-bold">{j.sym}</span>
                        <span className="text-2xs font-bold" style={{ color: j.side === 'LONG' ? 'var(--up)' : 'var(--down)' }}>{j.side}</span>
                        <span className="mono text-right font-bold" style={{ color: j.gain ? 'var(--up)' : 'var(--down)' }}>{j.pnl}</span>
                        <span className="mono text-right" style={{ color: j.gain ? 'var(--up)' : 'var(--down)' }}>{j.r}</span>
                        <span className="text-center"><span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${moodStyle[j.mood] ?? moodStyle.Calm}`}>{j.mood}</span></span>
                        <span className="leading-snug text-foreground-muted">{j.note}</span>
                    </div>
                ))}
            </div>
        </PageShell>
    );
}
