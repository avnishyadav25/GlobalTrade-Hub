'use client';

import React, { useEffect, useState } from 'react';
import { useVisible, Frame, UP, DOWN, ACCENT, FAINT, FG } from './index';
import type { ArchetypeConfig, VisualStep } from '@/lib/learn/visuals';

// Parameterised explainers.
//
// A bespoke component per lesson would mean ~95 near-duplicate SVGs, and the honest risk
// is filler — a diagram that restates the sentence above it makes a page longer without
// making it clearer. These take the lesson's own labels and numbers instead, so one
// component draws a genuinely different picture each time it is used.
//
// Same contract as the bespoke ones: `useVisible` so nothing animates off-screen or
// under `prefers-reduced-motion`, `Frame` for the border and caption, CSS variables for
// every colour so both themes work, and a sensible static final frame when `play` is
// false. Anything computed is computed from the supplied numbers, so the picture cannot
// disagree with the caption.

const toneOf = (t?: VisualStep['tone']) => (t === 'up' ? UP : t === 'down' ? DOWN : t === 'warn' ? 'var(--warn)' : ACCENT);

/** Normalise a series to 0..1 over its own range, for drawing. */
function scale(values: number[]): { lo: number; hi: number; at: (v: number) => number } {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    return { lo, hi, at: (v) => (v - lo) / span };
}

/* ---------------------------------------------------------------- two-series */

/** Two curves on ONE shared axis — the comparison a single-series chart gets wrong. */
function TwoSeries({ config }: { config: ArchetypeConfig }) {
    const { ref, play } = useVisible<HTMLDivElement>();
    const [t, setT] = useState(1);

    useEffect(() => {
        if (!play) return;
        const id = setInterval(() => setT((x) => (x >= 1 ? 0 : Math.min(1, x + 0.02))), 60);
        return () => clearInterval(id);
    }, [play]);

    const a = config.seriesA ?? [];
    const b = config.seriesB ?? [];
    if (a.length < 2 || b.length < 2) return null;

    const n = Math.min(a.length, b.length);
    // Both series share one scale, so the gap between them is readable as a gap rather
    // than as an artefact of two independent axes.
    const s = scale([...a.slice(0, n), ...b.slice(0, n)]);
    const W = 320, H = 120, PAD = 8;

    const path = (series: number[]) =>
        series
            .slice(0, Math.max(2, Math.ceil(n * t)))
            .map((v, i) => `${i === 0 ? 'M' : 'L'}${(PAD + (i / (n - 1)) * (W - PAD * 2)).toFixed(1)} ${(H - PAD - s.at(v) * (H - PAD * 2)).toFixed(1)}`)
            .join(' ');

    return (
        <Frame caption={config.caption}>
            <div ref={ref}>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={config.caption}>
                    <path d={path(b)} fill="none" stroke={FAINT} strokeWidth={1.5} strokeDasharray="4 3" />
                    <path d={path(a)} fill="none" stroke={ACCENT} strokeWidth={2} />
                </svg>
                <div className="mt-1.5 flex flex-wrap gap-4 text-2xs" style={{ color: FAINT }}>
                    <span><span className="inline-block h-0.5 w-4 align-middle" style={{ background: ACCENT }} /> {config.a}</span>
                    <span><span className="inline-block h-0.5 w-4 align-middle" style={{ background: FAINT }} /> {config.b}</span>
                </div>
            </div>
        </Frame>
    );
}

/* ------------------------------------------------------------------ waterfall */

/** Successive subtractions from a starting figure — a P&L or a charge stack. */
function Waterfall({ config }: { config: ArchetypeConfig }) {
    const { ref, play } = useVisible<HTMLDivElement>();
    const [shown, setShown] = useState(99);

    useEffect(() => {
        if (!play) return;
        // No synchronous reset: `shown` starts past the end so the static frame under
        // reduced-motion shows every row, and the first tick wraps it to 0 by itself.
        const id = setInterval(() => setShown((k) => (k > (config.steps?.length ?? 0) ? 0 : k + 1)), 900);
        return () => clearInterval(id);
    }, [play, config.steps?.length]);

    const steps = config.steps ?? [];
    const max = Math.max(...steps.map((x) => Math.abs(x.value ?? 0)), 1);

    return (
        <Frame caption={config.caption}>
            <div ref={ref} className="flex flex-col gap-1.5">
                {steps.map((step, i) => (
                    <div
                        key={step.label}
                        className="flex items-center gap-2 transition-opacity duration-500"
                        style={{ opacity: i < shown ? 1 : 0.25 }}
                    >
                        <span className="w-28 shrink-0 truncate text-2xs" style={{ color: FAINT }}>{step.label}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-xs" style={{ background: 'var(--chip)' }}>
                            <span
                                className="block h-full rounded-xs transition-[width] duration-700"
                                style={{ width: `${i < shown ? (Math.abs(step.value ?? 0) / max) * 100 : 0}%`, background: toneOf(step.tone) }}
                            />
                        </span>
                        <span className="mono w-20 shrink-0 text-right text-2xs" style={{ color: toneOf(step.tone) }}>
                            {step.note ?? (step.value ?? 0).toLocaleString('en-IN')}
                        </span>
                    </div>
                ))}
            </div>
        </Frame>
    );
}

/* ------------------------------------------------------------------- timeline */

/** An ordered sequence with a moving marker — settlement, expiry, a book build. */
function Timeline({ config }: { config: ArchetypeConfig }) {
    const { ref, play } = useVisible<HTMLDivElement>();
    const steps = config.steps ?? [];
    const [at, setAt] = useState(steps.length - 1);

    useEffect(() => {
        if (!play) return;
        const id = setInterval(() => setAt((k) => (k >= steps.length - 1 ? 0 : k + 1)), 1500);
        return () => clearInterval(id);
    }, [play, steps.length]);

    const W = 320, H = 54, PAD = 18;
    const x = (i: number) => PAD + (i / Math.max(1, steps.length - 1)) * (W - PAD * 2);

    return (
        <Frame caption={config.caption}>
            <div ref={ref}>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={config.caption}>
                    <line x1={PAD} y1={20} x2={W - PAD} y2={20} stroke={FAINT} strokeWidth={1} strokeDasharray="3 3" />
                    {steps.map((step, i) => (
                        <g key={step.label}>
                            <circle
                                cx={x(i)} cy={20} r={i === at ? 6 : 3.5}
                                fill={i <= at ? toneOf(step.tone) : 'var(--chip)'}
                                className="transition-all duration-500"
                            />
                            <text x={x(i)} y={42} fontSize={7.5} fill={i === at ? FG : FAINT} textAnchor="middle">
                                {step.label}
                            </text>
                        </g>
                    ))}
                </svg>
                {steps[at]?.note && (
                    <p className="mt-1 text-2xs" style={{ color: FAINT }}>{steps[at].note}</p>
                )}
            </div>
        </Frame>
    );
}

/* --------------------------------------------------------------------- ladder */

/** Rungs of size — a depth book, a grid, an allotment split. */
function Ladder({ config }: { config: ArchetypeConfig }) {
    const { ref } = useVisible<HTMLDivElement>();
    const steps = config.steps ?? [];
    const max = Math.max(...steps.map((s) => s.value ?? 1), 1);

    return (
        <Frame caption={config.caption}>
            <div ref={ref} className="flex flex-col gap-1">
                {steps.map((step) => (
                    <div key={step.label} className="flex items-center gap-2">
                        <span className="mono w-24 shrink-0 truncate text-2xs" style={{ color: FAINT }}>{step.label}</span>
                        <span className="h-2.5 flex-1 overflow-hidden rounded-xs" style={{ background: 'var(--chip)' }}>
                            <span className="block h-full rounded-xs" style={{ width: `${((step.value ?? 0) / max) * 100}%`, background: toneOf(step.tone) }} />
                        </span>
                        {step.note && <span className="w-24 shrink-0 text-right text-2xs" style={{ color: FAINT }}>{step.note}</span>}
                    </div>
                ))}
            </div>
        </Frame>
    );
}

/* ---------------------------------------------------------------------- gauge */

/** One reading on a scale, with the zones that give it meaning. */
function Gauge({ config }: { config: ArchetypeConfig }) {
    const { ref, play } = useVisible<HTMLDivElement>();
    const target = Math.max(0, Math.min(1, config.value ?? 0.5));
    const [v, setV] = useState(target);

    useEffect(() => {
        if (!play) return;
        let up = true;
        const id = setInterval(() => setV((x) => {
            if (x > 0.92) up = false;
            if (x < 0.08) up = true;
            return x + (up ? 0.02 : -0.02);
        }), 90);
        return () => clearInterval(id);
    }, [play]);

    const W = 320, H = 74;
    const cx = W / 2, cy = 62, r = 46;
    const angle = Math.PI * (1 - v);
    const zone = v > 0.7 ? DOWN : v < 0.3 ? UP : ACCENT;

    return (
        <Frame caption={config.caption}>
            <div ref={ref}>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={config.caption}>
                    <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx - r * 0.31} ${cy - r * 0.95}`} fill="none" stroke={UP} strokeWidth={5} opacity={0.5} />
                    <path d={`M ${cx - r * 0.31} ${cy - r * 0.95} A ${r} ${r} 0 0 1 ${cx + r * 0.31} ${cy - r * 0.95}`} fill="none" stroke={FAINT} strokeWidth={5} opacity={0.35} />
                    <path d={`M ${cx + r * 0.31} ${cy - r * 0.95} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={DOWN} strokeWidth={5} opacity={0.5} />
                    <line
                        x1={cx} y1={cy}
                        x2={cx + Math.cos(angle) * (r - 8)} y2={cy - Math.sin(angle) * (r - 8)}
                        stroke={zone} strokeWidth={2.5} strokeLinecap="round"
                    />
                    <circle cx={cx} cy={cy} r={3} fill={zone} />
                    <text x={cx} y={26} fontSize={12} fill={zone} textAnchor="middle" className="mono">
                        {Math.round(v * 100)}{config.unit ?? ''}
                    </text>
                </svg>
                <div className="flex justify-between text-2xs" style={{ color: FAINT }}>
                    <span>{config.a}</span>
                    <span>{config.b}</span>
                </div>
            </div>
        </Frame>
    );
}

/* ----------------------------------------------------------------------- flow */

/** Boxes with arrows — money or information moving through a chain of parties. */
function Flow({ config }: { config: ArchetypeConfig }) {
    const { ref, play } = useVisible<HTMLDivElement>();
    const steps = config.steps ?? [];
    const [at, setAt] = useState(steps.length);

    useEffect(() => {
        if (!play) return;
        const id = setInterval(() => setAt((k) => (k > steps.length ? 0 : k + 1)), 1100);
        return () => clearInterval(id);
    }, [play, steps.length]);

    return (
        <Frame caption={config.caption}>
            <div ref={ref} className="flex flex-wrap items-stretch gap-1.5">
                {steps.map((step, i) => (
                    <React.Fragment key={step.label}>
                        {i > 0 && (
                            <span className="self-center text-xs transition-opacity duration-500" style={{ color: FAINT, opacity: i < at ? 1 : 0.2 }}>→</span>
                        )}
                        <div
                            className="min-w-0 flex-1 rounded-xs border p-2 transition-opacity duration-500"
                            style={{ borderColor: i < at ? toneOf(step.tone) : 'var(--border2)', opacity: i < at ? 1 : 0.3 }}
                        >
                            <div className="truncate text-2xs font-semibold" style={{ color: i < at ? toneOf(step.tone) : FAINT }}>{step.label}</div>
                            {step.note && <div className="mt-0.5 text-2xs" style={{ color: FAINT }}>{step.note}</div>}
                        </div>
                    </React.Fragment>
                ))}
            </div>
        </Frame>
    );
}

/* ---------------------------------------------------------------------- decay */

/** Something falling to zero on a deadline — theta, a vesting cliff, a cooldown. */
function Decay({ config }: { config: ArchetypeConfig }) {
    const { ref, play } = useVisible<HTMLDivElement>();
    const [t, setT] = useState(1);

    useEffect(() => {
        if (!play) return;
        const id = setInterval(() => setT((x) => (x <= 0 ? 1 : x - 0.012)), 70);
        return () => clearInterval(id);
    }, [play]);

    const W = 320, H = 110, PAD = 10;
    // Accelerating decay: slow at first, then a cliff. That shape IS the teaching point,
    // so it is computed rather than drawn by hand.
    const at = (x: number) => Math.pow(x, 0.45);
    const d = Array.from({ length: 61 }, (_, i) => {
        const x = i / 60;
        return `${i === 0 ? 'M' : 'L'}${(PAD + x * (W - PAD * 2)).toFixed(1)} ${(H - PAD - at(1 - x) * (H - PAD * 2)).toFixed(1)}`;
    }).join(' ');

    const markerX = PAD + (1 - t) * (W - PAD * 2);
    const markerY = H - PAD - at(t) * (H - PAD * 2);

    return (
        <Frame caption={config.caption}>
            <div ref={ref}>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={config.caption}>
                    <path d={d} fill="none" stroke={DOWN} strokeWidth={2} />
                    <circle cx={markerX} cy={markerY} r={3.5} fill={DOWN} />
                    <text x={W - PAD} y={H - 2} fontSize={7.5} fill={FAINT} textAnchor="end">{config.b ?? 'expiry'}</text>
                    <text x={PAD} y={H - 2} fontSize={7.5} fill={FAINT}>{config.a ?? 'today'}</text>
                </svg>
                <p className="mono mt-1 text-2xs" style={{ color: DOWN }}>
                    {Math.round(at(t) * 100)}% remaining
                </p>
            </div>
        </Frame>
    );
}

/* ------------------------------------------------------------------ split-bar */

/** One quantity divided into named parts — an allocation, a cost breakdown. */
function SplitBar({ config }: { config: ArchetypeConfig }) {
    const { ref } = useVisible<HTMLDivElement>();
    const steps = config.steps ?? [];
    const total = steps.reduce((n, s) => n + (s.value ?? 0), 0) || 1;

    return (
        <Frame caption={config.caption}>
            <div ref={ref}>
                <div className="flex h-6 w-full overflow-hidden rounded-xs">
                    {steps.map((s) => (
                        <span
                            key={s.label}
                            className="h-full transition-[width] duration-700"
                            style={{ width: `${((s.value ?? 0) / total) * 100}%`, background: toneOf(s.tone), opacity: 0.85 }}
                            title={`${s.label}: ${s.note ?? s.value}`}
                        />
                    ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs">
                    {steps.map((s) => (
                        <span key={s.label} style={{ color: FAINT }}>
                            <span className="mr-1 inline-block h-2 w-2 rounded-xs align-middle" style={{ background: toneOf(s.tone) }} />
                            {s.label} {s.note && <span style={{ color: toneOf(s.tone) }}>{s.note}</span>}
                        </span>
                    ))}
                </div>
            </div>
        </Frame>
    );
}

/* ---------------------------------------------------------------------- cycle */

/** A repeating loop — a market cycle, a feedback spiral, a settlement rhythm. */
function Cycle({ config }: { config: ArchetypeConfig }) {
    const { ref, play } = useVisible<HTMLDivElement>();
    const steps = config.steps ?? [];
    const [at, setAt] = useState(0);

    useEffect(() => {
        if (!play) return;
        const id = setInterval(() => setAt((k) => (k + 1) % Math.max(1, steps.length)), 1400);
        return () => clearInterval(id);
    }, [play, steps.length]);

    const W = 320, H = 132;
    const cx = W / 2, cy = H / 2, r = 46;

    return (
        <Frame caption={config.caption}>
            <div ref={ref}>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={config.caption}>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={FAINT} strokeWidth={1} strokeDasharray="3 4" />
                    {steps.map((step, i) => {
                        const a = (i / Math.max(1, steps.length)) * Math.PI * 2 - Math.PI / 2;
                        const px = cx + Math.cos(a) * r;
                        const py = cy + Math.sin(a) * r;
                        const active = i === at;
                        return (
                            <g key={step.label}>
                                <circle cx={px} cy={py} r={active ? 6 : 3.5} fill={active ? toneOf(step.tone) : 'var(--chip)'} className="transition-all duration-500" />
                                <text
                                    x={cx + Math.cos(a) * (r + 20)}
                                    y={cy + Math.sin(a) * (r + 20) + 3}
                                    fontSize={7.5}
                                    fill={active ? FG : FAINT}
                                    textAnchor="middle"
                                >
                                    {step.label}
                                </text>
                            </g>
                        );
                    })}
                </svg>
                {steps[at]?.note && <p className="mt-1 text-center text-2xs" style={{ color: FAINT }}>{steps[at].note}</p>}
            </div>
        </Frame>
    );
}

/* -------------------------------------------------------------------- scatter */

/** Two variables plotted against each other — correlation, skew, a relationship. */
function Scatter({ config }: { config: ArchetypeConfig }) {
    const { ref } = useVisible<HTMLDivElement>();
    const a = config.seriesA ?? [];
    const b = config.seriesB ?? [];
    if (a.length < 2 || b.length < 2) return null;

    const n = Math.min(a.length, b.length);
    const sx = scale(a.slice(0, n));
    const sy = scale(b.slice(0, n));
    const W = 320, H = 130, PAD = 14;

    return (
        <Frame caption={config.caption}>
            <div ref={ref}>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={config.caption}>
                    <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={FAINT} strokeWidth={1} />
                    <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke={FAINT} strokeWidth={1} />
                    {Array.from({ length: n }, (_, i) => (
                        <circle
                            key={i}
                            cx={PAD + sx.at(a[i]) * (W - PAD * 2)}
                            cy={H - PAD - sy.at(b[i]) * (H - PAD * 2)}
                            r={2.5}
                            fill={ACCENT}
                            opacity={0.7}
                        />
                    ))}
                    <text x={W - PAD} y={H - 3} fontSize={7.5} fill={FAINT} textAnchor="end">{config.a}</text>
                    <text x={PAD + 2} y={PAD - 4} fontSize={7.5} fill={FAINT}>{config.b}</text>
                </svg>
            </div>
        </Frame>
    );
}

/* --------------------------------------------------------------------- nested */

/** Containment — what sits inside what. Ownership, custody, index membership. */
function Nested({ config }: { config: ArchetypeConfig }) {
    const { ref } = useVisible<HTMLDivElement>();
    const steps = config.steps ?? [];

    const render = (i: number): React.ReactNode => {
        if (i >= steps.length) return null;
        const step = steps[i];
        return (
            <div className="rounded-xs border p-2.5" style={{ borderColor: toneOf(step.tone) }}>
                <div className="text-2xs font-semibold" style={{ color: toneOf(step.tone) }}>{step.label}</div>
                {step.note && <div className="mb-1.5 text-2xs" style={{ color: FAINT }}>{step.note}</div>}
                {render(i + 1)}
            </div>
        );
    };

    return (
        <Frame caption={config.caption}>
            <div ref={ref}>{render(0)}</div>
        </Frame>
    );
}

/* ---------------------------------------------------------------------- stack */

/** Layers built on each other — a technology stack, a capital structure. */
function Stack({ config }: { config: ArchetypeConfig }) {
    const { ref } = useVisible<HTMLDivElement>();
    const steps = config.steps ?? [];

    return (
        <Frame caption={config.caption}>
            <div ref={ref} className="flex flex-col-reverse gap-1">
                {steps.map((step) => (
                    <div
                        key={step.label}
                        className="rounded-xs border-l-2 px-2.5 py-1.5"
                        style={{ borderColor: toneOf(step.tone), background: 'var(--panel2)' }}
                    >
                        <span className="text-2xs font-semibold" style={{ color: toneOf(step.tone) }}>{step.label}</span>
                        {step.note && <span className="ml-2 text-2xs" style={{ color: FAINT }}>{step.note}</span>}
                    </div>
                ))}
            </div>
        </Frame>
    );
}

/* -------------------------------------------------------------------- counter */

/** A single number counting toward its value — a base rate, a proportion. */
function Counter({ config }: { config: ArchetypeConfig }) {
    const { ref, play } = useVisible<HTMLDivElement>();
    const target = config.value ?? 0;
    const [v, setV] = useState(target);

    useEffect(() => {
        if (!play) return;
        // Starts AT the target so the reduced-motion frame shows the real number; the
        // first tick rolls it back to zero and it counts up from there, on a loop.
        const id = setInterval(() => setV((x) => (x >= target ? 0 : Math.min(target, x + target / 40))), 40);
        return () => clearInterval(id);
    }, [play, target]);

    return (
        <Frame caption={config.caption}>
            <div ref={ref} className="py-2 text-center">
                <div className="mono text-3xl font-bold" style={{ color: DOWN }}>
                    {v.toFixed(target < 10 ? 1 : 0)}{config.unit ?? ''}
                </div>
                {config.a && <div className="mt-1 text-xs" style={{ color: FAINT }}>{config.a}</div>}
            </div>
        </Frame>
    );
}

/* ------------------------------------------------------------------- dispatch */

const ARCHETYPES = {
    'two-series': TwoSeries,
    waterfall: Waterfall,
    timeline: Timeline,
    ladder: Ladder,
    gauge: Gauge,
    flow: Flow,
    decay: Decay,
    'split-bar': SplitBar,
    cycle: Cycle,
    scatter: Scatter,
    nested: Nested,
    stack: Stack,
    counter: Counter,
} satisfies Record<ArchetypeConfig['kind'], (p: { config: ArchetypeConfig }) => React.JSX.Element | null>;

export function Archetype({ config }: { config: ArchetypeConfig }) {
    const Component = ARCHETYPES[config.kind];
    return Component ? <Component config={config} /> : null;
}
