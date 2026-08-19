'use client';

import type { ReactNode } from 'react';

// One table implementation, replacing six independent CSS-grid reimplementations that
// each duplicated `gridTemplateColumns` in both the header and every row — and three
// of which forgot the horizontal-scroll wrapper.

export interface Column<T> {
    key: string;
    header: ReactNode;
    /** CSS grid track, e.g. '1.4fr' or '90px'. */
    width: string;
    align?: 'left' | 'right' | 'center';
    render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
    columns: Column<T>[];
    rows: T[];
    getRowKey: (row: T) => string;
    empty?: ReactNode;
    onRowClick?: (row: T) => void;
    /** Horizontal scroll kicks in below this width. */
    minWidth?: number;
    footer?: ReactNode;
}

const ALIGN = { left: 'text-left', right: 'text-right justify-self-end', center: 'text-center justify-self-center' };

export function DataTable<T>({
    columns, rows, getRowKey, empty, onRowClick, minWidth = 720, footer,
}: DataTableProps<T>) {
    const template = columns.map((c) => c.width).join(' ');

    return (
        <div className="overflow-x-auto">
            <div style={{ minWidth }}>
                <div
                    role="row"
                    className="grid gap-x-3 border-b border-border2 px-4 py-2 text-2xs font-semibold uppercase tracking-wide text-faint"
                    style={{ gridTemplateColumns: template }}
                >
                    {columns.map((c) => (
                        <span key={c.key} className={ALIGN[c.align ?? 'left']}>{c.header}</span>
                    ))}
                </div>

                {rows.length === 0 && empty}

                {rows.map((row) => (
                    <div
                        key={getRowKey(row)}
                        role="row"
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        className={`grid items-center gap-x-3 border-b border-border2 px-4 py-2 text-sm transition-colors
                            hover:bg-panel2 ${onRowClick ? 'cursor-pointer' : ''}`}
                        style={{ gridTemplateColumns: template }}
                    >
                        {columns.map((c) => (
                            <span key={c.key} className={`min-w-0 truncate ${ALIGN[c.align ?? 'left']}`}>{c.render(row)}</span>
                        ))}
                    </div>
                ))}

                {footer && <div className="mono px-4 py-2 text-xs text-faint">{footer}</div>}
            </div>
        </div>
    );
}
