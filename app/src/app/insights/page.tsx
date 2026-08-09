'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Ring, BarTrend } from '@/components/charts';
import { usePaperStore } from '@/stores/paperStore';
import { useCoachStore } from '@/stores/coachStore';
import { computeCoachReport, summariseForAI, COACH_RULES, type FillLite, type CoachReport } from '@/lib/coach';

const sevStyle: Record<string, { bg: string; color: string }> = {
    High: { bg: 'rgba(255,84,112,.14)', color: 'var(--down)' },
    Medium: { bg: 'rgba(224,160,32,.16)', color: 'var(--warn)' },
    Low: { bg: 'var(--accent-soft)', color: 'var(--accent)' },
};
const moodStyle: Record<string, { bg: string; color: string }> = {
    Calm: { bg: 'rgba(47,212,126,.14)', color: 'var(--up)' },
    Patient: { bg: 'var(--accent-soft)', color: 'var(--accent)' },
    FOMO: { bg: 'rgba(255,84,112,.14)', color: 'var(--down)' },
    Tilt: { bg: 'rgba(255,84,112,.14)', color: 'var(--down)' },
};

export default function InsightsPage() {
    const fills = usePaperStore((s) => s.state.fills);
    const applied = useCoachStore((s) => s.appliedRules);
    const toggleRule = useCoachStore((s) => s.toggleRule);
    const [aiPatterns, setAiPatterns] = useState<CoachReport['patterns'] | null>(null);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const fillLite: FillLite[] = useMemo(
        () => fills.map((f) => ({ symbol: f.symbol, side: f.side, pnl: f.pnl, ts: f.ts })),
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
                setAiPatterns(data.patterns);
                setAiSummary(data.summary);
                toast.success('Coach refreshed with AI');
            } else {
                toast.message('AI coach not configured', { description: 'Set ANTHROPIC_API_KEY on the server to enable AI analysis. Showing heuristic report.' });
            }
        } catch {
            toast.error('Could not reach the coach service');
        } finally {
            setLoading(false);
        }
    };

    const stat = (label: string, value: string, sub: string, subCol?: string) => (
        <div className="panel p-4.5" style={{ padding: 18 }}>
            <div className="text-[12px] font-bold tracking-wide text-faint">{label}</div>
            <div className="mono my-2 text-[30px] font-extrabold">{value}</div>
            <div className="text-[12px] font-semibold" style={{ color: subCol }}>{sub}</div>
        </div>
    );

    return (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 32px 56px' }}>
            {/* header */}
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <div className="mb-1.5 flex items-center gap-2.5">
                        <span className="text-2xl font-extrabold tracking-tight">Trading Coach</span>
                        <span className="rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide text-accent" style={{ background: 'var(--accent-soft)' }}>
                            {report.source === 'ai' || aiPatterns ? 'AI · LEARNS FROM YOU' : 'LEARNS FROM YOU'}
                        </span>
                    </div>
                    <div className="text-[13.5px] text-foreground-muted">
                        {aiSummary || report.summary}
                    </div>
                </div>
                <button onClick={refreshAI} disabled={loading} className="rounded-lg bg-accent px-4 py-2 text-[12.5px] font-bold text-[color:var(--cp-text)] disabled:opacity-60">
                    {loading ? 'Analysing…' : '✨ Refresh with AI'}
                </button>
            </div>

            {/* stat row */}
            <div className="mb-6 grid gap-3.5" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr' }}>
                <div className="panel flex items-center gap-4.5" style={{ padding: 18, gap: 18 }}>
                    <div className="relative" style={{ width: 92, height: 92, flexShrink: 0 }}>
                        <Ring score={report.disciplineScore} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="mono text-[26px] font-extrabold leading-none">{report.disciplineScore}</span>
                            <span className="text-[9px] font-bold tracking-wide text-faint">/ 100</span>
                        </div>
                    </div>
                    <div>
                        <div className="mb-1 text-[12px] font-bold tracking-wide text-faint">DISCIPLINE SCORE</div>
                        <div className="text-[13.5px] leading-snug text-foreground-muted">Based on {report.tradesAnalyzed} closed paper trades. Keep logging to sharpen it.</div>
                        <div className="mt-2.5" style={{ width: 160, height: 34 }}><BarTrend vals={report.trend} /></div>
                    </div>
                </div>
                {stat('WIN RATE', `${report.winRate.toFixed(0)}%`, `${report.tradesAnalyzed} trades`, 'var(--up)')}
                {stat('AVG R : R', report.avgRR.toFixed(1), report.avgRR >= 2 ? 'on target' : 'target 2.0', report.avgRR >= 2 ? 'var(--up)' : 'var(--down)')}
                {stat('RULE ADHERENCE', `${report.ruleAdherence}%`, `${Object.values(applied).filter(Boolean).length} rules active`, 'var(--up)')}
            </div>

            {/* patterns */}
            <div className="mb-3.5 flex items-center gap-2.5">
                <span className="text-base font-extrabold">Patterns we&apos;ve spotted</span>
                <span className="text-[12px] text-faint">Recurring mistakes, ranked by what they cost you</span>
            </div>
            <div className="mb-7 grid gap-3.5" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                {patterns.map((p, i) => (
                    <div key={i} className="panel flex flex-col" style={{ padding: 18 }}>
                        <div className="mb-2.5 flex items-center justify-between">
                            <span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide" style={sevStyle[p.sev]}>{p.sev}</span>
                            <span className="text-[11px] font-semibold text-faint">{p.freq}</span>
                        </div>
                        <div className="mb-1.5 text-[15px] font-bold">{p.title}</div>
                        <div className="flex-1 text-[12.5px] leading-relaxed text-foreground-muted">{p.desc}</div>
                        <div className="mt-3.5 flex items-center justify-between border-t border-border2 pt-3">
                            <span className="text-[11px] text-faint">Est. cost</span>
                            <span className="mono text-sm font-extrabold text-down">{p.cost}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* rules + breakdown */}
            <div className="mb-7 grid gap-6" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
                <div>
                    <div className="text-base font-extrabold">Suggested rule changes</div>
                    <div className="mb-3.5 text-[12px] text-faint">Apply a rule and it&apos;s enforced on your paper &amp; live order tickets.</div>
                    <div className="flex flex-col gap-3">
                        {COACH_RULES.map((r) => {
                            const on = !!applied[r.id];
                            return (
                                <div key={r.id} className="panel flex items-start gap-3.5" style={{ padding: 16 }}>
                                    <div className="flex-1">
                                        <div className="mb-1.5 text-sm font-bold">{r.title}</div>
                                        <div className="mb-2 text-[12.5px] leading-relaxed text-foreground-muted">{r.desc}</div>
                                        <div className="text-[11.5px] font-semibold text-up">{r.saves}</div>
                                    </div>
                                    <button
                                        onClick={() => toggleRule(r.id)}
                                        className="flex-shrink-0 rounded-[9px] border px-4 py-2 text-[12.5px] font-bold"
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
                    <div className="text-base font-extrabold">Discipline breakdown</div>
                    <div className="mb-3.5 text-[12px] text-faint">Where the score comes from.</div>
                    <div className="panel flex flex-col gap-4.5" style={{ padding: 20, gap: 18 }}>
                        {report.bars.map((b) => (
                            <div key={b.label}>
                                <div className="mb-1.5 flex justify-between text-[12.5px]">
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
            <div className="text-base font-extrabold">Trade journal</div>
            <div className="mb-3.5 text-[12px] text-faint">Auto-tagged by emotion &amp; outcome, with a note from your coach.</div>
            <div className="panel overflow-hidden">
                <div className="grid border-b border-border2 py-2.5 text-[10px] font-bold tracking-wide text-faint" style={{ gridTemplateColumns: '1.1fr .7fr .9fr .6fr 1fr 2.2fr', paddingLeft: 18, paddingRight: 18 }}>
                    <span>INSTRUMENT</span><span>SIDE</span><span className="text-right">P&amp;L</span><span className="text-right">R</span><span className="text-center">MOOD</span><span>COACH NOTE</span>
                </div>
                {report.journal.length === 0 && <div className="py-8 text-center text-[12px] text-faint">No trades yet — your journal fills as you trade.</div>}
                {report.journal.map((j, i) => (
                    <div key={i} className="grid items-center border-b border-border2 py-3 text-[12.5px]" style={{ gridTemplateColumns: '1.1fr .7fr .9fr .6fr 1fr 2.2fr', paddingLeft: 18, paddingRight: 18 }}>
                        <span className="font-bold">{j.sym}</span>
                        <span className="text-[10.5px] font-bold" style={{ color: j.side === 'LONG' ? 'var(--up)' : 'var(--down)' }}>{j.side}</span>
                        <span className="mono text-right font-bold" style={{ color: j.gain ? 'var(--up)' : 'var(--down)' }}>{j.pnl}</span>
                        <span className="mono text-right" style={{ color: j.gain ? 'var(--up)' : 'var(--down)' }}>{j.r}</span>
                        <span className="text-center"><span className="rounded-full px-2.5 py-1 text-[10.5px] font-bold" style={moodStyle[j.mood]}>{j.mood}</span></span>
                        <span className="leading-snug text-foreground-muted">{j.note}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
