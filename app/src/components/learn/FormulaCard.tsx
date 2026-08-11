'use client';

import type { Formula, VerifyContext } from '@/lib/learn/types';

/**
 * A formula, then the same formula with the reader's own numbers in it.
 *
 * The `worked` line is what makes this worth a component. "Order value is quantity
 * times price" is forgettable; "0.5 × 213.40 AAPL = ₹10,168" is not.
 */
export function FormulaCard({ formula, ctx }: { formula: Formula; ctx: VerifyContext }) {
    const worked = formula.worked?.(ctx) ?? null;

    return (
        <div className="rounded-sm border border-border2 bg-panel2 p-3">
            <div className="text-2xs font-bold tracking-wide text-faint">{formula.label.toUpperCase()}</div>
            <p className="mono mt-1.5 text-sm leading-relaxed">{formula.expr}</p>

            <dl className="mt-2 space-y-1 text-xs text-faint">
                {formula.terms.map((t) => (
                    <div key={t.sym}>
                        <dt className="mono inline font-semibold text-foreground-muted">{t.sym}</dt>
                        <dd className="inline"> — {t.meaning}</dd>
                    </div>
                ))}
            </dl>

            {worked && (
                <p className="mono mt-2.5 border-t border-border2 pt-2 text-xs text-accent">
                    <span className="not-italic text-faint">your account: </span>
                    {worked}
                </p>
            )}
        </div>
    );
}
