'use client';

import { useMemo } from 'react';
import { Field, Input, Badge } from '@/components/ui';
import { expandGrid, type ParamGrid } from '@/lib/strategies/walkForward';
import type { ParamSpec } from '@/lib/strategies/types';

/**
 * Builds the parameter grid a walk-forward run searches.
 *
 * Two design decisions worth stating.
 *
 * First, the combination count is shown LIVE and prominently, because `optimise`
 * truncates to the first N combinations in cartesian order. A grid that exceeds the cap
 * does not sample the space evenly — it evaluates every value of the early keys and
 * never reaches whole regions of the last one. Discovering that afterwards in a warning
 * is too late to have chosen a narrower grid.
 *
 * Second, values are free text rather than min/max/step inputs. A grid is a deliberate
 * shortlist — [5, 20, 50] says something a range never does, and a range control quietly
 * encourages the 400-combination sweep that produces the most overfitted result.
 */

/** A small, opinionated default: the strategy's own default, plus a value either side. */
export function suggestValues(spec: ParamSpec): (number | string)[] {
    if (spec.type === 'choice') return (spec.choices ?? []).map((c) => c.value);

    const d = Number(spec.default);
    if (!Number.isFinite(d)) return [];

    const lo = spec.min ?? d / 2;
    const hi = spec.max ?? d * 2;
    const raw = [Math.max(lo, d * 0.5), d, Math.min(hi, d * 2)];

    const round = (n: number) => (spec.type === 'int' ? Math.round(n) : Math.round(n * 100) / 100);
    return [...new Set(raw.map(round))].filter((n) => n >= lo && n <= hi);
}

export function defaultGrid(specs: ParamSpec[]): ParamGrid {
    const grid: ParamGrid = {};
    // Only numeric params by default. Including every choice param multiplies the search
    // without usually telling you anything about robustness.
    for (const spec of specs.filter((s) => s.type !== 'choice').slice(0, 3)) {
        const values = suggestValues(spec);
        if (values.length > 1) grid[spec.key] = values;
    }
    return grid;
}

const toText = (values: (number | string)[] | undefined) => (values ?? []).join(', ');

function parseText(text: string, spec: ParamSpec): (number | string)[] {
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
    if (spec.type === 'choice') return parts;
    return parts.map(Number).filter((n) => Number.isFinite(n));
}

export function GridBuilder({
    specs,
    grid,
    onChange,
    cap,
    disabled,
}: {
    specs: ParamSpec[];
    grid: ParamGrid;
    onChange: (next: ParamGrid) => void;
    cap: number;
    disabled?: boolean;
}) {
    const combinations = useMemo(() => expandGrid(grid).length, [grid]);
    const truncated = combinations > cap;

    const set = (key: string, text: string, spec: ParamSpec) => {
        const next = { ...grid };
        const values = parseText(text, spec);
        if (values.length) next[key] = values;
        else delete next[key];
        onChange(next);
    };

    if (!specs.length) {
        return <p className="text-sm text-faint">This strategy has no parameters, so there is nothing to search.</p>;
    }

    return (
        <div>
            <div className="grid gap-4 sm:grid-cols-2">
                {specs.map((spec) => (
                    <Field
                        key={spec.key}
                        label={spec.label}
                        hint={
                            spec.type === 'choice'
                                ? `Options: ${(spec.choices ?? []).map((c) => c.value).join(', ')}. Leave empty to hold at the default.`
                                : `${spec.help} Comma-separated; empty holds it at ${spec.default}.`
                        }
                    >
                        <Input
                            value={toText(grid[spec.key])}
                            onChange={(e) => set(spec.key, e.target.value, spec)}
                            placeholder={`held at ${spec.default}`}
                            disabled={disabled}
                        />
                    </Field>
                ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border2 pt-3">
                <Badge tone={truncated ? 'down' : 'neutral'}>{combinations} combinations</Badge>
                <span className="text-2xs text-faint">
                    ≈ {combinations * 4} backtests over 4 folds
                </span>
                {truncated && (
                    <span className="text-2xs" style={{ color: 'var(--down)' }}>
                        Over the {cap} cap. Only the first {cap} would be evaluated — and because they are taken in
                        order, whole ranges of the last parameter would never be tried. Narrow the grid instead.
                    </span>
                )}
            </div>
        </div>
    );
}
