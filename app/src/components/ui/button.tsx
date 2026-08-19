'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Kite-style: flat, small radius, restrained colour. Blue is the only chrome accent;
// green/red appear only for buy/sell. Hover, active and disabled are defined here so
// no caller has to remember them — 40 of 59 controls previously had none.

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'buy' | 'sell';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
    primary: 'bg-accent text-[color:var(--cp-text)] border-transparent hover:opacity-90',
    secondary: 'bg-panel text-foreground border-border hover:border-border-hover hover:bg-panel2',
    ghost: 'bg-transparent text-foreground-muted border-transparent hover:text-foreground hover:bg-chip',
    danger: 'bg-transparent text-down border-down/50 hover:bg-down-dim',
    buy: 'bg-up text-[color:var(--cp-text)] border-transparent hover:opacity-90',
    sell: 'bg-down text-[color:var(--cp-text)] border-transparent hover:opacity-90',
};

const SIZE: Record<Size, string> = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-2 text-sm gap-2',
    lg: 'px-4 py-2.5 text-md gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    fullWidth?: boolean;
    iconLeft?: ReactNode;
}

export function Button({
    variant = 'secondary', size = 'md', loading, fullWidth, iconLeft, className = '', children, disabled, ...rest
}: ButtonProps) {
    return (
        <button
            {...rest}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={`inline-flex items-center justify-center rounded-sm border font-semibold transition-colors
                active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0
                ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        >
            {iconLeft}
            {loading ? 'Working…' : children}
        </button>
    );
}

export function IconButton({ label, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
    return (
        <button
            {...rest}
            aria-label={label}
            title={label}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-panel
                text-foreground-muted transition-colors hover:text-foreground hover:border-border-hover
                active:translate-y-px ${className}`}
        >
            {children}
        </button>
    );
}
