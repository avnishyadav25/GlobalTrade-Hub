'use client';

import { useMemo, useState } from 'react';
import { getAsset } from '@/lib/mockData';
import { MARKET_TABS, type Market } from '@/lib/constants';
import { useMarketStore } from '@/stores/marketStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useUIStore } from '@/stores/uiStore';
import { fmtPrice, fmtPct } from '@/lib/format';
import { freshness, ageLabel } from '@/lib/marketData/staleness';
import { CoachMark } from '@/components/learn/CoachMark';

/**
 * The Terminal's instrument rail.
 *
 * Reads the user's ACTIVE watchlist through the instrument registry. It used to render
 * the hardcoded 16-row catalog constant, which is why a user-added instrument never
 * appeared here even though it was registered and tradeable.
 *
 * It also no longer falls back to `asset.price` when there is no quote. Those catalog
 * numbers are stale mock data — RELIANCE sits at ₹2,945 against a live ~₹1,327 — so
 * rendering one as if it were a price is a confident wrong answer, not a gap.
 */
export function Watchlist() {
    const [tab, setTab] = useState<string>('all');
    const quotes = useMarketStore((s) => s.quotes);
    const feedStatus = useMarketStore((s) => s.feedStatus);
    const deferredSymbols = useMarketStore((s) => s.deferredSymbols);
    const lists = useWatchlistStore((s) => s.lists);
    const activeListId = useWatchlistStore((s) => s.activeListId);
    const selected = useUIStore((s) => s.selectedSymbol);
    const setSymbol = useUIStore((s) => s.setSymbol);

    // Derived with useMemo rather than a store selector that builds an array — a fresh
    // array on every render makes useSyncExternalStore loop forever (it did on /alerts).
    const rows = useMemo(() => {
        const symbols = lists.find((l) => l.id === activeListId)?.symbols ?? [];
        return symbols
            .map((symbol) => ({ symbol, asset: getAsset(symbol) }))
            .filter(({ asset }) => tab === 'all' || asset?.market === tab);
    }, [lists, activeListId, tab]);

    const deferred = useMemo(() => new Set(deferredSymbols), [deferredSymbols]);

    return (
        <div className="flex h-full flex-col overflow-hidden border-r border-border bg-panel">
            <div className="flex flex-shrink-0 items-center justify-between px-3.5 pb-1 pt-2.5">
                <span className="text-2xs font-bold tracking-wide text-faint">WATCHLIST</span>
                <CoachMark topic="terminal.watchlist" />
            </div>
            <div className="flex flex-shrink-0 flex-wrap gap-1.5 px-3.5 pb-2">
                {MARKET_TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                            tab === t.key ? 'bg-accent text-[color:var(--cp-text)]' : 'bg-chip text-foreground-muted'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <div className="flex-1 overflow-auto">
                {rows.length === 0 && (
                    <p className="px-3.5 py-6 text-xs text-faint">
                        Nothing in this list yet. Add instruments on the Watchlists screen.
                    </p>
                )}
                {rows.map(({ symbol, asset }) => {
                    const q = quotes[symbol];
                    const market = (asset?.market ?? 'us') as Market;
                    const state = freshness({
                        // A seed value is not a price. Only a quote a provider actually
                        // returned counts as one.
                        ts: q?.real ? q.ts : null,
                        market,
                        feedState: feedStatus[market]?.state,
                        deferred: deferred.has(symbol),
                    });

                    const hasPrice = state !== 'none';
                    const dim = state === 'stale' || state === 'queued';
                    const pct = q?.changePercent ?? 0;
                    const up = pct >= 0;
                    const active = selected === symbol;

                    // A closed market's last price is correct, not stale — so it is
                    // captioned but not dimmed.
                    const caption =
                        state === 'none'
                            ? 'no price yet'
                            : state === 'queued'
                              ? 'queued'
                              : state === 'closed'
                                ? 'closed'
                                : state === 'stale'
                                  ? ageLabel(q?.ts)
                                  : (asset?.exchange ?? '').toUpperCase();

                    return (
                        <button
                            key={symbol}
                            onClick={() => setSymbol(symbol)}
                            className={`flex w-full items-center justify-between border-b border-border2 px-3.5 py-2.5 text-left transition-colors hover:bg-chip/60 ${
                                active ? 'bg-chip' : ''
                            }`}
                        >
                            <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="truncate text-sm font-bold">{symbol}</span>
                                <span className="text-2xs font-semibold tracking-wide text-faint">{caption}</span>
                            </div>
                            <div className="flex flex-col items-end gap-0.5">
                                <span className={`mono text-sm font-semibold ${dim ? 'text-faint' : ''}`}>
                                    {hasPrice ? fmtPrice(q!.price) : '—'}
                                </span>
                                {hasPrice && (
                                    <span
                                        className="mono text-2xs font-semibold"
                                        style={{ color: dim ? 'var(--faint)' : up ? 'var(--up)' : 'var(--down)' }}
                                    >
                                        {fmtPct(pct)}
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
