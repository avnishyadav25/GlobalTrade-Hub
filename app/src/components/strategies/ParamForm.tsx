'use client';

import { Field, Input, Select } from '@/components/ui';
import type { ParamSpec, Params } from '@/lib/strategies/types';

/**
 * One form, every strategy.
 *
 * The inputs, their bounds and their help text all come from the same `ParamSpec` array
 * the engine clamps against — so a parameter cannot exist in the form and be missing
 * from the sanitiser, which is exactly how a cleared field used to produce NaN equity.
 */
export function ParamForm({
    specs,
    values,
    onChange,
    disabled,
}: {
    specs: ParamSpec[];
    values: Params;
    onChange: (next: Params) => void;
    disabled?: boolean;
}) {
    if (!specs.length) {
        return <p className="text-sm text-faint">This strategy has no parameters to tune.</p>;
    }

    const set = (key: string, raw: string, spec: ParamSpec) => {
        // Deliberately NOT clamped here. Clamping mid-typing makes "20" impossible to
        // reach when the minimum is 5 — you would be fighting the field on every
        // keystroke. The engine sanitises on run, which is the moment it matters.
        onChange({ ...values, [key]: spec.type === 'choice' ? raw : raw === '' ? Number.NaN : Number(raw) });
    };

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {specs.map((spec) => {
                const value = values[spec.key];
                const shown = typeof value === 'number' && !Number.isFinite(value) ? '' : String(value ?? spec.default);

                return (
                    <Field key={spec.key} label={spec.label} hint={spec.help}>
                        {spec.type === 'choice' ? (
                            <Select value={shown} onChange={(e) => set(spec.key, e.target.value, spec)} disabled={disabled}>
                                {spec.choices?.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </Select>
                        ) : (
                            <Input
                                type="number"
                                inputMode="decimal"
                                value={shown}
                                min={spec.min}
                                max={spec.max}
                                step={spec.step ?? (spec.type === 'int' ? 1 : 0.1)}
                                onChange={(e) => set(spec.key, e.target.value, spec)}
                                disabled={disabled}
                            />
                        )}
                    </Field>
                );
            })}
        </div>
    );
}
