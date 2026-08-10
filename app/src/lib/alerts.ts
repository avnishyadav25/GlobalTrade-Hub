// Pure alert evaluation.
//
// Pure because alert misfires are the classic edge-triggered bug and this is the only
// way to test them. Three rules are load-bearing:
//
//  1. EDGE-triggered, not level-triggered. A `price > X` alert must fire when the
//     price CROSSES X, not once per tick forever after.
//  2. Unknown indicators never fire. `rsi()` returns null while warming up; treating
//     that as a neutral 50 would fire "RSI < 35" alerts on cold data.
//  3. Cooldown per alert, because triggering can push to real Telegram/email.

import type { LiveQuote } from '@/stores/marketStore';

export type AlertKind = 'price' | 'changePct' | 'rsi' | 'high24h' | 'low24h';
export type AlertOp = 'above' | 'below';

export interface Alert {
    id: string;
    symbol: string;
    kind: AlertKind;
    op: AlertOp;
    value: number;
    /** false = fire once then disarm; true = re-arm after each trigger. */
    repeat: boolean;
    enabled: boolean;
    notify: boolean;
    createdAt: number;
    lastTriggeredAt?: number;
    triggerCount: number;
    /** Previous reading — this is what makes evaluation edge-triggered. */
    lastValue?: number;
}

export interface AlertContext {
    quotes: Record<string, LiveQuote>;
    /** null while warming up — callers must not substitute a neutral value. */
    rsi: (symbol: string) => number | null;
    range24h: (symbol: string) => { high: number; low: number } | null;
}

export interface TriggeredAlert {
    alert: Alert;
    value: number;
    message: string;
}

export interface EvaluateResult {
    triggered: TriggeredAlert[];
    /** id -> the reading to store as `lastValue` for the next pass. */
    readings: Record<string, number>;
}

export const ALERT_COOLDOWN_MS = 60_000;

/** Current reading for an alert, or null when it cannot be known yet. */
export function readingFor(alert: Alert, ctx: AlertContext): number | null {
    const q = ctx.quotes[alert.symbol];
    switch (alert.kind) {
        case 'price':
            return q && Number.isFinite(q.price) ? q.price : null;
        case 'changePct':
            return q && Number.isFinite(q.changePercent) ? q.changePercent : null;
        case 'rsi':
            return ctx.rsi(alert.symbol);
        case 'high24h': {
            const r = ctx.range24h(alert.symbol);
            return r && Number.isFinite(r.high) ? r.high : null;
        }
        case 'low24h': {
            const r = ctx.range24h(alert.symbol);
            return r && Number.isFinite(r.low) ? r.low : null;
        }
        default:
            return null;
    }
}

const LABEL: Record<AlertKind, string> = {
    price: 'Price',
    changePct: 'Change',
    rsi: 'RSI',
    high24h: '24h high',
    low24h: '24h low',
};

export function describeAlert(a: Alert): string {
    const unit = a.kind === 'changePct' ? '%' : '';
    return `${LABEL[a.kind]} ${a.op} ${a.value}${unit}`;
}

export function evaluateAlerts(alerts: Alert[], ctx: AlertContext, now = Date.now()): EvaluateResult {
    const triggered: TriggeredAlert[] = [];
    const readings: Record<string, number> = {};

    for (const a of alerts) {
        if (!a.enabled) continue;
        const value = readingFor(a, ctx);
        // Rule 2: an unknown reading is not a reason to fire, and not a reason to
        // record a baseline either.
        if (value == null || !Number.isFinite(value)) continue;
        readings[a.id] = value;

        const meets = a.op === 'above' ? value > a.value : value < a.value;
        if (!meets) continue;

        // Rule 1: only fire on the crossing. With no previous reading we arm silently,
        // so creating an alert that is already true doesn't fire immediately.
        const prev = a.lastValue;
        if (prev == null) continue;
        const previouslyMet = a.op === 'above' ? prev > a.value : prev < a.value;
        if (previouslyMet) continue;

        // Rule 3.
        if (a.lastTriggeredAt && now - a.lastTriggeredAt < ALERT_COOLDOWN_MS) continue;

        triggered.push({
            alert: a,
            value,
            message: `${a.symbol}: ${describeAlert(a)} (now ${round(value)})`,
        });
    }

    return { triggered, readings };
}

function round(n: number): number {
    return Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100;
}
