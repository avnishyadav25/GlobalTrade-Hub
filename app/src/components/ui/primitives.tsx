'use client';

import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

/* ---------- Panel ---------- */

export function Panel({
    title, actions, footer, padding = 'default', className = '', children,
}: {
    title?: ReactNode; actions?: ReactNode; footer?: ReactNode;
    padding?: 'none' | 'dense' | 'default' | 'lg'; className?: string; children: ReactNode;
}) {
    const pad = { none: '', dense: 'p-3', default: 'p-4', lg: 'p-5' }[padding];
    return (
        <section className={`panel ${padding === 'none' ? 'overflow-hidden' : pad} ${className}`}>
            {(title || actions) && (
                <header className={`flex flex-wrap items-center justify-between gap-2 ${padding === 'none' ? 'px-4 pb-3 pt-4' : 'mb-3'}`}>
                    {title && <h2 className="text-md font-semibold">{title}</h2>}
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </header>
            )}
            {children}
            {footer && <footer className={`border-t border-border2 text-sm text-faint ${padding === 'none' ? 'px-4 py-2' : 'mt-3 pt-3'}`}>{footer}</footer>}
        </section>
    );
}

/* ---------- Badge ---------- */

type Tone = 'neutral' | 'accent' | 'up' | 'down' | 'warn';
const TONE: Record<Tone, string> = {
    neutral: 'bg-chip text-foreground-muted',
    accent: 'bg-accent-soft text-accent',
    up: 'bg-up-dim text-up',
    down: 'bg-down-dim text-down',
    warn: 'bg-warn-dim text-warn',
};

export function Badge({ tone = 'neutral', className = '', children }: { tone?: Tone; className?: string; children: ReactNode }) {
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold ${TONE[tone]} ${className}`}>{children}</span>;
}

export function Callout({ tone = 'warn', children }: { tone?: Tone; children: ReactNode }) {
    return <div className={`rounded-sm px-3.5 py-2.5 text-sm ${TONE[tone]}`}>{children}</div>;
}

/* ---------- StatTile ---------- */

export function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'up' | 'down' }) {
    const col = tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : undefined;
    return (
        <div className="panel p-4">
            <div className="text-2xs font-semibold uppercase tracking-wide text-faint">{label}</div>
            <div className="mono my-1.5 text-2xl font-bold" style={{ color: col }}>{value}</div>
            {sub != null && <div className="text-xs text-faint">{sub}</div>}
        </div>
    );
}

/* ---------- EmptyState ---------- */

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <div className="text-md font-semibold text-foreground-muted">{title}</div>
            {body && <div className="max-w-[46ch] text-sm text-faint">{body}</div>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

/* ---------- Field wrappers ----------
   The ring lives on the wrapper via .field:focus-within (globals.css), so
   `outline-none` on the inner control is correct rather than an a11y hole. */

export function Field({ label, hint, children }: { label?: string; hint?: ReactNode; children: ReactNode }) {
    return (
        <label className="block">
            {label && <span className="mb-1.5 block text-2xs font-semibold uppercase tracking-wide text-faint">{label}</span>}
            {children}
            {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
        </label>
    );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...rest}
            className={`field w-full rounded-sm border border-border bg-background px-3 py-2 text-base
                transition-colors placeholder:text-faint hover:border-border-hover ${className}`}
        />
    );
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            {...rest}
            className={`field w-full rounded-sm border border-border bg-background px-3 py-2 text-base
                transition-colors hover:border-border-hover ${className}`}
        >
            {children}
        </select>
    );
}

/** Number input that clamps rather than admitting NaN or a silent 0. */
export function NumberInput({
    value, onChangeValue, min = 0, max, step, className = '', ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
    value: number; onChangeValue: (n: number) => void; min?: number; max?: number; step?: number;
}) {
    return (
        <Input
            {...rest}
            type="number"
            inputMode="decimal"
            value={Number.isFinite(value) ? value : ''}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                onChangeValue(Math.max(min, max != null ? Math.min(max, n) : n));
            }}
            className={`mono ${className}`}
        />
    );
}
