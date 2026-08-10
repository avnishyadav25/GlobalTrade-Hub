import type { ReactNode } from 'react';

/**
 * The single page wrapper.
 *
 * Replaces five disagreeing hand-rolled shells (four at maxWidth 1180, settings
 * at 900, three full-bleed; three different bottom paddings; two gutters), all of
 * which were expressed as inline styles because the `*{padding:0}` reset in
 * globals.css nullified every Tailwind padding class.
 *
 * `coachTopic` is accepted now so the Learn coach-marks work is purely additive.
 */

export type PageWidth = 'wide' | 'narrow' | 'full';

const WIDTH: Record<PageWidth, string> = {
    // Content pages: centred, gutters that tighten on mobile, generous bottom
    // padding so the last row never sits against the viewport edge.
    wide: 'mx-auto w-full max-w-[1200px] px-4 pt-6 pb-16 sm:px-6',
    narrow: 'mx-auto w-full max-w-[880px] px-4 pt-6 pb-16 sm:px-6',
    // Terminal and Backtest own their own grid and scrolling.
    full: 'h-full min-h-0',
};

export interface PageShellProps {
    width?: PageWidth;
    title?: ReactNode;
    subtitle?: ReactNode;
    /** Right-aligned controls in the page header. */
    actions?: ReactNode;
    /** Learn topic key — renders the "?" coach mark once that ships. */
    coachTopic?: string;
    children: ReactNode;
}

export function PageShell({ width = 'wide', title, subtitle, actions, children }: PageShellProps) {
    if (width === 'full') return <div className={WIDTH.full}>{children}</div>;

    return (
        <div className={WIDTH[width]}>
            {(title || actions) && (
                <header className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0">
                        {title && <h1 className="text-xl font-bold tracking-tight">{title}</h1>}
                        {subtitle && (
                            <p className="mt-1 max-w-[70ch] text-base text-foreground-muted">{subtitle}</p>
                        )}
                    </div>
                    {/* shrink-0 so a long subtitle can never squeeze the actions — the
                        bug that clipped "Refresh with AI" on Insights. */}
                    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                </header>
            )}
            {children}
        </div>
    );
}
