'use client';

// Lightweight theme-aware SVG charts (mirrors the AxisOne design primitives).
import React from 'react';
import { fmtPrice } from '@/lib/format';

const ACCENT = 'var(--accent)';
const UP = 'var(--up)';
const DOWN = 'var(--down)';
const GRID = 'var(--grid)';
const FAINT = 'var(--faint)';

export function AreaChart({
    points,
    color = ACCENT,
    height = 200,
    id = 'area',
}: {
    points: number[];
    color?: string;
    height?: number;
    id?: string;
}) {
    if (!points.length) return null;
    const W = 720, H = height, pad = 8;
    const lo = Math.min(...points), hi = Math.max(...points), rg = hi - lo || 1;
    const X = (i: number) => pad + (i * (W - 2 * pad)) / (points.length - 1 || 1);
    const Y = (v: number) => pad + (1 - (v - lo) / rg) * (H - 2 * pad);
    const line = points.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const area = `${pad},${H - pad} ${line} ${W - pad},${H - pad}`;
    const gid = `grad-${id}`;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <polygon points={area} fill={`url(#${gid})`} />
            <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        </svg>
    );
}

export function DrawdownChart({ points, color = DOWN, height = 120 }: { points: number[]; color?: string; height?: number }) {
    if (!points.length) return null;
    const W = 720, H = height, pad = 8;
    const lo = Math.min(...points, -0.001);
    const X = (i: number) => pad + (i * (W - 2 * pad)) / (points.length - 1 || 1);
    const Y = (v: number) => pad + (v / lo) * (H - 2 * pad);
    const line = points.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const area = `${pad},${pad} ${line} ${W - pad},${pad}`;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
            <defs>
                <linearGradient id="dd-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.26} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <polygon points={area} fill="url(#dd-grad)" />
            <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        </svg>
    );
}

export function Donut({
    segments,
    size = 140,
    stroke = 20,
}: {
    segments: { value: number; color: string }[];
    size?: number;
    stroke?: number;
}) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const total = segments.reduce((a, s) => a + s.value, 0) || 1;
    // precompute dashes + cumulative offsets functionally (no mutation during render)
    const dashes = segments.map((s) => c * (s.value / total));
    const arcs = segments.map((s, i) => ({
        dash: dashes[i],
        offset: dashes.slice(0, i).reduce((a, b) => a + b, 0),
        color: s.color,
    }));
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {arcs.map((a, i) => (
                <circle
                    key={i}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={stroke}
                    strokeDasharray={`${a.dash} ${c - a.dash}`}
                    strokeDashoffset={-a.offset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            ))}
        </svg>
    );
}

export function Ring({ score, color = ACCENT, track = 'var(--border)', size = 92, stroke = 9 }: { score: number; color?: string; track?: string; size?: number; stroke?: number }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - score / 100);
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={off}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
        </svg>
    );
}

export function BarTrend({ vals, color = ACCENT, soft = 'var(--accent-soft)', height = 34 }: { vals: number[]; color?: string; soft?: string; height?: number }) {
    const W = 160, H = height, n = vals.length, gap = 5;
    // n === 0 gave bw = Infinity and Math.max(...[]) = -Infinity. The trend can now
    // legitimately be empty (a new account has no history), so this must hold.
    if (n === 0) return null;
    const bw = (W - gap * (n - 1)) / n;
    const max = Math.max(...vals, 1);
    return (
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {vals.map((v, i) => (
                <rect key={i} x={i * (bw + gap)} y={H - (v / max) * H} width={bw} height={(v / max) * H} rx={2.5} fill={i === n - 1 ? color : soft} />
            ))}
        </svg>
    );
}

export function Sparkline({ points, color, width = 96, height = 28 }: { points: number[]; color?: string; width?: number; height?: number }) {
    if (points.length < 2) return null;
    const lo = Math.min(...points), hi = Math.max(...points), rg = hi - lo || 1;
    const stroke = color ?? (points[points.length - 1] >= points[0] ? UP : DOWN);
    const X = (i: number) => (i * width) / (points.length - 1);
    const Y = (v: number) => height - 2 - ((v - lo) / rg) * (height - 4);
    const line = points.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <polyline points={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

export interface HeatCell { label: string; bg: string; col: string }
export interface HeatRow { year: string; cells: HeatCell[] }

export function Heatmap({ rows }: { rows: HeatRow[] }) {
    const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: '34px repeat(12,1fr)', gap: 4, marginBottom: 5, fontSize: 8.5, fontWeight: 700, color: FAINT, textAlign: 'center' }}>
                <span />
                {months.map((m, i) => (
                    <span key={i}>{m}</span>
                ))}
            </div>
            {rows.map((row) => (
                <div key={row.year} style={{ display: 'grid', gridTemplateColumns: '34px repeat(12,1fr)', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                    <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: FAINT }}>{row.year}</span>
                    {row.cells.map((c, i) => (
                        <div key={i} className="mono" style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, fontSize: 8.5, fontWeight: 600, background: c.bg, color: c.col }}>
                            {c.label}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

// Candlestick SVG used in Terminal / Backtest (matches design's buildChart).
export function CandleSvg({ series, height = 360 }: { series: { o: number; h: number; l: number; c: number }[]; height?: number }) {
    if (!series.length) return null;
    const W = 660, H = height, padL = 6, padR = 58, padT = 12, padB = 18;
    const lo = Math.min(...series.map((c) => c.l));
    const hi = Math.max(...series.map((c) => c.h));
    const range = hi - lo || 1;
    const y = (v: number) => padT + (1 - (v - lo) / range) * (H - padT - padB);
    const n = series.length;
    const cw = (W - padL - padR) / n;
    const bodyW = Math.max(2.5, cw * 0.62);
    const last = series[n - 1].c;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
            {[0, 1, 2, 3, 4].map((i) => {
                const gy = padT + ((H - padT - padB) * i) / 4;
                const pv = hi - (range * i) / 4;
                return (
                    <g key={i}>
                        <line x1={padL} x2={W - padR} y1={gy} y2={gy} stroke={GRID} strokeWidth={1} />
                        <text x={W - padR + 7} y={gy + 3.5} fill="var(--axis)" fontSize={10} className="mono">
                            {fmtPrice(pv)}
                        </text>
                    </g>
                );
            })}
            {series.map((c, i) => {
                const cx = padL + cw * i + cw / 2;
                const up = c.c >= c.o;
                const col = up ? UP : DOWN;
                const top = y(Math.max(c.o, c.c));
                const bot = y(Math.min(c.o, c.c));
                return (
                    <g key={i}>
                        <line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={1} />
                        <rect x={cx - bodyW / 2} y={top} width={bodyW} height={Math.max(1.2, bot - top)} fill={col} rx={0.5} />
                    </g>
                );
            })}
            <line x1={padL} x2={W - padR} y1={y(last)} y2={y(last)} stroke={ACCENT} strokeWidth={1} strokeDasharray="3 3" />
            <rect x={W - padR} y={y(last) - 8} width={padR} height={16} fill={ACCENT} rx={2} />
            <text x={W - padR + 7} y={y(last) + 3.5} fill="var(--cp-text)" fontSize={10} fontWeight={700} className="mono">
                {fmtPrice(last)}
            </text>
        </svg>
    );
}
