'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageShell, Panel, Button, Input, EmptyState, Sheet, Badge, PriceText, ConfirmDialog } from '@/components/ui';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useMarketStore } from '@/stores/marketStore';
import { useUIStore } from '@/stores/uiStore';
import { getAsset } from '@/lib/mockData';
import { makeAsset } from '@/lib/instruments';
import { fmtPct } from '@/lib/format';
import { freshness, ageLabel } from '@/lib/marketData/staleness';
import type { Market } from '@/lib/constants';
import type { Currency } from '@/lib/mockData';

interface Hit { symbol: string; name: string; exchange: string; market: Market; quoteCcy: Currency; type?: string; price?: number }

export default function WatchlistsPage() {
    const router = useRouter();
    const { lists, activeListId, setActive, createList, renameList, deleteList, addSymbol, removeSymbol, moveSymbol, addInstrument } =
        useWatchlistStore();
    const quotes = useMarketStore((s) => s.quotes);
    const feedStatus = useMarketStore((s) => s.feedStatus);
    const deferredSymbols = useMarketStore((s) => s.deferredSymbols);
    const setSymbol = useUIStore((s) => s.setSymbol);
    const deferred = useMemo(() => new Set(deferredSymbols), [deferredSymbols]);

    const [adding, setAdding] = useState(false);
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<Hit[]>([]);
    const [searching, setSearching] = useState(false);
    const [newName, setNewName] = useState('');
    const [deleting, setDeleting] = useState<string | null>(null);
    const [dragIdx, setDragIdx] = useState<number | null>(null);

    const active = lists.find((l) => l.id === activeListId) ?? lists[0];

    const search = async () => {
        if (query.trim().length < 2) return;
        setSearching(true);
        try {
            const res = await fetch(`/api/instruments/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setHits(data.results ?? []);
            if (!data.results?.length) {
                toast.message(data.error ? 'Search unavailable' : 'No instruments found', {
                    description: data.error ?? 'Try the exact ticker — e.g. TATAMOTORS.NS, TSLA, BTC-USD.',
                });
            } else if (data.source === 'exact') {
                toast.success('Resolved by ticker', { description: 'Search was throttled, so the symbol was looked up directly.' });
            }
        } catch {
            toast.error('Search failed');
        } finally {
            setSearching(false);
        }
    };

    const add = async (h: Hit) => {
        // Registered before it can be quoted or traded — otherwise the engine rejects
        // it as unknown and would mis-price it as a USD crypto.
        const asset = makeAsset({
            symbol: h.symbol, name: h.name, market: h.market,
            exchange: h.exchange, quoteCcy: h.quoteCcy,
            // Carry the price through when search resolved one. It used to be dropped,
            // so makeAsset defaulted to 0 and paperEngine.validate() then refused any
            // order with "No price available for this instrument".
            price: h.price,
        });
        addInstrument(asset);

        // Fetch a quote immediately rather than leaving the row blank until the next
        // 60s poll. The old toast promised "prices arrive on the next refresh" while
        // the poll did not even request user-added symbols.
        const t = toast.loading(`Adding ${h.symbol}…`);
        try {
            const res = await fetch('/api/marketdata', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    symbols: [asset.symbol],
                    instruments: [{ symbol: asset.symbol, market: asset.market, quoteCcy: asset.quoteCcy, price: asset.price }],
                }),
            });
            const data = res.ok ? await res.json() : null;
            const q = data?.quotes?.[0];
            if (q) {
                useMarketStore.getState().applyQuote({ ...q, ts: q.at, real: true });
                toast.success(`${h.symbol} added`, { id: t, description: h.name });
            } else {
                toast.warning(`${h.symbol} added, but no price yet`, {
                    id: t,
                    description: 'No provider returned a quote. It will retry on the next refresh.',
                });
            }
        } catch {
            toast.success(`${h.symbol} added`, { id: t, description: `${h.name} · price will arrive on the next refresh.` });
        }
    };

    return (
        <PageShell
            title="Watchlists"
            coachTopic="watchlist"
            subtitle="Build your own lists. Anything you add here becomes tradeable on the Terminal."
            actions={<Button variant="primary" onClick={() => setAdding(true)}>+ Add instrument</Button>}
        >
            <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
                <Panel title="Lists" padding="dense">
                    <div className="flex flex-col gap-1">
                        {lists.map((l) => (
                            <button
                                key={l.id}
                                onClick={() => setActive(l.id)}
                                className={`flex items-center justify-between rounded-sm px-2.5 py-2 text-sm transition-colors ${
                                    l.id === active?.id ? 'bg-chip font-semibold text-foreground' : 'text-foreground-muted hover:text-foreground'
                                }`}
                            >
                                <span className="truncate">{l.name}</span>
                                <span className="text-xs text-faint">{l.symbols.length}</span>
                            </button>
                        ))}
                    </div>
                    <div className="mt-3 flex gap-1.5 border-t border-border2 pt-3">
                        <Input placeholder="New list" value={newName} onChange={(e) => setNewName(e.target.value)}
                               onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) { createList(newName.trim()); setNewName(''); } }} />
                        <Button size="sm" onClick={() => { if (newName.trim()) { createList(newName.trim()); setNewName(''); } }}>Add</Button>
                    </div>
                </Panel>

                <Panel
                    padding="none"
                    title={active?.name ?? 'Watchlist'}
                    actions={
                        lists.length > 1 && (
                            <Button size="sm" variant="danger" onClick={() => setDeleting(active.id)}>Delete list</Button>
                        )
                    }
                >
                    {!active?.symbols.length && (
                        <EmptyState title="This list is empty" body="Use “Add instrument” to search across India, US, crypto, FX and commodities." />
                    )}
                    {active?.symbols.map((sym, i) => {
                        const a = getAsset(sym);
                        const q = quotes[sym];
                        // `a.price` is catalog mock data, not a price — it has RELIANCE at
                        // ₹2,945 against a live ~₹1,327. Only a real quote counts.
                        const state = freshness({
                            ts: q?.real ? q.ts : null,
                            market: a?.market ?? 'us',
                            feedState: a ? feedStatus[a.market]?.state : undefined,
                            deferred: deferred.has(sym),
                        });
                        const hasPrice = state !== 'none';
                        const chg = hasPrice ? (q?.changePercent ?? 0) : 0;
                        const note =
                            state === 'none' ? 'no price yet'
                            : state === 'queued' ? 'queued for refresh'
                            : state === 'closed' ? 'market closed'
                            : state === 'stale' ? ageLabel(q?.ts)
                            : null;
                        return (
                            <div
                                key={sym}
                                draggable
                                onDragStart={() => setDragIdx(i)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => { if (dragIdx != null && dragIdx !== i) moveSymbol(active.id, dragIdx, i); setDragIdx(null); }}
                                className="flex cursor-grab items-center gap-3 border-b border-border2 px-4 py-2.5 transition-colors hover:bg-panel2"
                            >
                                <span className="text-faint" aria-hidden>⠿</span>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold">{sym}</div>
                                    <div className="truncate text-xs text-faint">
                                        {a?.name ?? 'Custom instrument'} · {note ?? a?.exchange ?? '—'}
                                    </div>
                                </div>
                                {hasPrice ? (
                                    <PriceText value={q!.price} />
                                ) : (
                                    <span className="mono text-sm text-faint">—</span>
                                )}
                                <span className="mono w-16 text-right text-sm font-semibold"
                                      style={{ color: !hasPrice ? 'var(--faint)' : chg >= 0 ? 'var(--up)' : 'var(--down)' }}>
                                    {hasPrice ? fmtPct(chg) : '—'}
                                </span>
                                <Button size="sm" variant="ghost" onClick={() => { setSymbol(sym); router.push('/terminal'); }}>Trade</Button>
                                <Button size="sm" variant="ghost" onClick={() => removeSymbol(active.id, sym)} aria-label={`Remove ${sym}`}>✕</Button>
                            </div>
                        );
                    })}
                </Panel>
            </div>

            <Sheet open={adding} onClose={() => setAdding(false)} title="Add an instrument">
                <div className="mb-3 flex gap-2">
                    <Input autoFocus placeholder="Search e.g. RELIANCE, TSLA, gold" value={query}
                           onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
                    <Button variant="primary" onClick={search} loading={searching}>Search</Button>
                </div>
                <p className="mb-4 text-xs text-faint">
                    Searches Yahoo Finance across NSE/BSE, US exchanges, crypto, FX and futures. If search is
                    throttled, the exact ticker still resolves — try <span className="mono">TATAMOTORS.NS</span>,{' '}
                    <span className="mono">TSLA</span> or <span className="mono">BTC-USD</span>. Indian prices are
                    delayed ~15 minutes.
                </p>
                {hits.map((h) => (
                    <div key={h.symbol} className="flex items-center gap-3 border-b border-border2 py-2.5">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">{h.symbol}</span>
                                <Badge>{h.exchange}</Badge>
                            </div>
                            <div className="truncate text-xs text-faint">{h.name}</div>
                        </div>
                        <Button size="sm" variant="secondary"
                                disabled={active?.symbols.includes(h.symbol)}
                                onClick={() => add(h)}>
                            {active?.symbols.includes(h.symbol) ? 'Added' : 'Add'}
                        </Button>
                    </div>
                ))}
            </Sheet>

            <ConfirmDialog
                open={!!deleting}
                danger
                title="Delete this list?"
                confirmLabel="Delete"
                body="The instruments stay available — only the list is removed."
                onConfirm={() => { if (deleting) deleteList(deleting); setDeleting(null); }}
                onCancel={() => setDeleting(null)}
            />
        </PageShell>
    );
}
