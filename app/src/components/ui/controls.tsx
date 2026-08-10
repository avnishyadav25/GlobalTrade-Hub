'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/* ---------- SegmentedControl ----------
   Selection reads via BORDER + ELEVATION against a darker track. Fill contrast alone
   was 1.12:1 in light — invisible. */

export interface SegmentOption<T extends string> {
    value: T;
    label: ReactNode;
    /** Semantic fill for buy/sell style segments. */
    tone?: 'up' | 'down' | 'accent';
}

export function SegmentedControl<T extends string>({
    options, value, onChange, size = 'md', fullWidth, label,
}: {
    options: SegmentOption<T>[]; value: T; onChange: (v: T) => void;
    size?: 'sm' | 'md'; fullWidth?: boolean; label: string;
}) {
    const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';
    const refs = useRef<(HTMLButtonElement | null)[]>([]);

    const onKey = (e: React.KeyboardEvent, i: number) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
        onChange(options[next].value);
        refs.current[next]?.focus();
    };

    return (
        <div role="radiogroup" aria-label={label} className={`flex gap-1 rounded-sm border border-border bg-chip p-0.5 ${fullWidth ? 'w-full' : ''}`}>
            {options.map((o, i) => {
                const on = o.value === value;
                const toneFill = o.tone === 'up' ? 'bg-up text-[color:var(--cp-text)]'
                    : o.tone === 'down' ? 'bg-down text-[color:var(--cp-text)]'
                    : o.tone === 'accent' ? 'bg-accent text-[color:var(--cp-text)]' : '';
                return (
                    <button
                        key={o.value}
                        ref={(el) => { refs.current[i] = el; }}
                        role="radio"
                        aria-checked={on}
                        tabIndex={on ? 0 : -1}
                        onKeyDown={(e) => onKey(e, i)}
                        onClick={() => onChange(o.value)}
                        className={`rounded-xs font-semibold transition-colors ${pad} ${fullWidth ? 'flex-1' : ''} ${
                            on
                                ? o.tone
                                    ? `border border-transparent ${toneFill}`
                                    : 'border border-border bg-panel text-foreground shadow-elev-1'
                                : 'border border-transparent text-foreground-muted hover:text-foreground'
                        }`}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

/* ---------- Tabs (underline, for in-panel content switching) ---------- */

export function Tabs<T extends string>({
    tabs, value, onChange, label,
}: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
    return (
        <div role="tablist" aria-label={label} className="flex gap-5 border-b border-border2 px-4">
            {tabs.map((t) => {
                const on = t.value === value;
                return (
                    <button
                        key={t.value}
                        role="tab"
                        aria-selected={on}
                        onClick={() => onChange(t.value)}
                        className={`-mb-px border-b-2 pb-2 pt-2.5 text-sm font-semibold transition-colors ${
                            on ? 'border-accent text-foreground' : 'border-transparent text-faint hover:text-foreground'
                        }`}
                    >
                        {t.label}
                        {t.count != null && <span className="ml-1.5 font-medium text-faint">{t.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}

/* ---------- Sheet (right slide-over) ---------- */

export function Sheet({ open, onClose, title, children, width = 460 }: {
    open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        ref.current?.focus();
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
            <div
                ref={ref}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={typeof title === 'string' ? title : 'Panel'}
                className="relative flex h-full w-full flex-col overflow-y-auto border-l border-border bg-panel shadow-elev-3"
                style={{ maxWidth: width }}
            >
                <header className="sticky top-0 flex items-center justify-between border-b border-border bg-panel px-4 py-3">
                    <h2 className="text-md font-semibold">{title}</h2>
                    <button onClick={onClose} aria-label="Close" className="rounded-sm px-2 py-1 text-foreground-muted hover:text-foreground">✕</button>
                </header>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
}

/* ---------- ConfirmDialog (replaces raw window.confirm, which can't be themed) ---------- */

export function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: {
    open: boolean; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean;
    onConfirm: () => void; onCancel: () => void;
}) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onCancel]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden />
            <div role="dialog" aria-modal="true" className="panel relative w-full max-w-[420px] p-5 shadow-elev-3">
                <h2 className="mb-2 text-md font-semibold">{title}</h2>
                <div className="mb-5 text-sm text-foreground-muted">{body}</div>
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="rounded-sm border border-border bg-panel px-3 py-2 text-sm font-semibold hover:bg-panel2">Cancel</button>
                    <button
                        onClick={onConfirm}
                        className={`rounded-sm border px-3 py-2 text-sm font-semibold ${
                            danger ? 'border-transparent bg-down text-[color:var(--cp-text)]' : 'border-transparent bg-accent text-[color:var(--cp-text)]'
                        } hover:opacity-90`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
