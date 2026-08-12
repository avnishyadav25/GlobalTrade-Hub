'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageShell, Panel, Badge, Button, Callout, Field, Select, Input, EmptyState, Sheet } from '@/components/ui';
import { usePaperStore } from '@/stores/paperStore';
import { useMarketStore } from '@/stores/marketStore';
import { registerInstruments } from '@/lib/instruments';
import { buildOptionSymbol, makeContract, formatContract, nseExpiryToIso, type OptionContract, type OptionRoot } from '@/lib/options/contract';
import { greeks, impliedVol, yearsBetween, DEFAULT_RATE } from '@/lib/options/greeks';
import { shortOptionMargin, MARGIN_CAVEATS } from '@/lib/options/margin';
import { fmtMoney } from '@/lib/format';

// The live NIFTY / BANKNIFTY option chain, with Greeks.
//
// Two things on this screen are deliberate and easy to get wrong.
//
// NSE publishes its own implied volatility and reports 0 on illiquid and deep-ITM
// strikes — around a third of a typical expiry. Zero is not a volatility, it is a
// missing figure, so the column shows OUR solved IV beside theirs and renders a dash
// where neither can produce one. A number in that cell would be an invention.
//
// And every option here is EUROPEAN and CASH-SETTLED, which is true of Indian index
// options and false of stock options. The engine models only the former, so only the
// former is offered.

interface ChainStrikeRow {
    strike: number;
    call: SideQuote | null;
    put: SideQuote | null;
}
interface SideQuote {
    lastPrice: number | null;
    impliedVolatility: number | null;
    openInterest: number | null;
    changeInOpenInterest: number | null;
    bid: number | null;
    ask: number | null;
}
interface ChainResponse {
    supported?: boolean;
    available?: boolean;
    reason?: string;
    expiries?: string[];
    lotSize?: number | null;
    lotSizeReason?: string | null;
    data?: { symbol: OptionRoot; expiry: string; underlying: number | null; quotedAt: string | null; strikes: ChainStrikeRow[] } | null;
}

const ROOTS: OptionRoot[] = ['NIFTY', 'BANKNIFTY'];

const n2 = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(2));
const oi = (v: number | null | undefined) => (v == null ? '—' : v >= 1e5 ? `${(v / 1e5).toFixed(1)}L` : v.toLocaleString('en-IN'));

interface TicketState {
    contract: OptionContract;
    side: 'buy' | 'sell';
    premium: number;
    ourIv: number | null;
}

export default function OptionsPage() {
    const [root, setRoot] = useState<OptionRoot>('NIFTY');
    const [expiry, setExpiry] = useState('');
    const [chain, setChain] = useState<ChainResponse | null>(null);
    const [busy, setBusy] = useState(false);
    const [ticket, setTicket] = useState<TicketState | null>(null);
    const [lots, setLots] = useState(1);

    const place = usePaperStore((s) => s.place);

    const load = useCallback(async (symbol: OptionRoot, exp: string) => {
        setBusy(true);
        try {
            const url = `/api/options/chain?symbol=${symbol}${exp ? `&expiry=${encodeURIComponent(exp)}` : ''}`;
            const res = await fetch(url);
            const json: ChainResponse = await res.json();
            setChain(json);
            // First load returns the expiry list and no chain — pick the nearest.
            if (!exp && json.expiries?.length) setExpiry(json.expiries[0]);
        } catch {
            setChain({ supported: true, available: false, reason: 'The chain request failed from this browser.' });
        } finally {
            setBusy(false);
        }
    }, []);

    useEffect(() => {
        setExpiry('');
        setChain(null);
        void load(root, '');
    }, [root, load]);

    useEffect(() => {
        if (expiry) void load(root, expiry);
    }, [expiry, root, load]);

    const data = chain?.data ?? null;
    const lotSize = chain?.lotSize ?? null;
    const underlying = data?.underlying ?? null;

    const expiryMs = useMemo(() => {
        const iso = data ? nseExpiryToIso(data.expiry) : null;
        return iso ? makeContract({ root, expiry: iso, strike: 1000, optionType: 'CE', lotSize: lotSize ?? 1 })?.expiryMs ?? null : null;
    }, [data, root, lotSize]);

    /** Solve our own IV and Greeks per strike, filling the gaps NSE leaves. */
    const rows = useMemo(() => {
        if (!data || underlying == null || expiryMs == null) return [];
        const years = yearsBetween(Date.now(), expiryMs);

        return data.strikes.map((row) => {
            const solve = (side: SideQuote | null, type: 'CE' | 'PE') => {
                if (!side?.lastPrice) return null;
                const base = { spot: underlying, strike: row.strike, years, rate: DEFAULT_RATE, type } as const;
                const ourIv = impliedVol(side.lastPrice, base);
                // Prefer our solve; fall back to NSE's where ours is unidentifiable.
                const vol = ourIv ?? (side.impliedVolatility != null ? side.impliedVolatility / 100 : null);
                const g = vol == null ? null : greeks({ ...base, vol });
                return { ...side, ourIv, g };
            };
            return { strike: row.strike, call: solve(row.call, 'CE'), put: solve(row.put, 'PE') };
        });
    }, [data, underlying, expiryMs]);

    /** Strikes nearest the money — the whole chain is 100+ rows and mostly untraded. */
    const visible = useMemo(() => {
        if (!rows.length || underlying == null) return rows;
        const nearest = rows.reduce((best, r, i) => (Math.abs(r.strike - underlying) < Math.abs(rows[best].strike - underlying) ? i : best), 0);
        return rows.slice(Math.max(0, nearest - 12), nearest + 13);
    }, [rows, underlying]);

    const missingIv = rows.filter((r) => r.call && r.call.ourIv == null).length;

    const openTicket = (strike: number, type: 'CE' | 'PE', side: 'buy' | 'sell', premium: number | null, ourIv: number | null) => {
        if (!data || !lotSize) return;
        const iso = nseExpiryToIso(data.expiry);
        if (!iso || !premium) return;
        const contract = makeContract({ root, expiry: iso, strike, optionType: type, lotSize });
        if (!contract) return;
        setLots(1);
        setTicket({ contract, side, premium, ourIv });
    };

    const submit = () => {
        if (!ticket) return;
        const symbol = buildOptionSymbol(ticket.contract);

        // Register the contract before placing: `validate` rejects any symbol the
        // registry cannot resolve, and the lot size lives on the contract.
        registerInstruments([
            {
                symbol,
                name: formatContract(ticket.contract),
                market: 'india',
                exchange: 'NFO',
                quoteCcy: 'INR',
                fractional: false,
                price: ticket.premium,
                change: 0,
                changePercent: 0,
                volume: 0,
                high24h: 0,
                low24h: 0,
                contract: ticket.contract,
            },
        ]);
        // Seed the quote so the engine can mark and match this contract, through the
        // same applyQuote path the live feed and the simulator both use.
        useMarketStore.getState().applyQuote({ symbol, price: ticket.premium, real: true });

        const qty = lots * ticket.contract.lotSize;
        const result = place({ symbol, side: ticket.side, type: 'market', qty });

        if (result.status === 'rejected') toast.error('Order refused', { description: result.reason });
        else toast.success(`${ticket.side === 'buy' ? 'Bought' : 'Wrote'} ${lots} lot${lots === 1 ? '' : 's'}`, { description: formatContract(ticket.contract) });
        setTicket(null);
    };

    const marginQuote =
        ticket && ticket.side === 'sell' && underlying != null
            ? shortOptionMargin(ticket.contract, underlying, ticket.premium, lots * ticket.contract.lotSize)
            : null;

    return (
        <PageShell
            width="full"
            title="Option chain"
            subtitle="Live NIFTY and BANKNIFTY chains from NSE, with Greeks solved here."
        >
            <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-16 sm:px-6">
                <Panel>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Underlying" hint="Index options only — European and cash-settled.">
                            <Select value={root} onChange={(e) => setRoot(e.target.value as OptionRoot)} disabled={busy}>
                                {ROOTS.map((r) => <option key={r} value={r}>{r}</option>)}
                            </Select>
                        </Field>
                        <Field label="Expiry">
                            <Select value={expiry} onChange={(e) => setExpiry(e.target.value)} disabled={busy || !chain?.expiries?.length}>
                                {(chain?.expiries ?? []).map((e) => <option key={e} value={e}>{e}</option>)}
                            </Select>
                        </Field>
                        <Field label="Lot size" hint="Parsed from NSE's contract master, per expiry.">
                            <Input value={lotSize ?? '—'} readOnly />
                        </Field>
                    </div>

                    {data && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border2 pt-3">
                            <Badge tone="accent">{root} {underlying?.toFixed(2) ?? '—'}</Badge>
                            <Badge>{data.strikes.length} strikes</Badge>
                            {data.quotedAt && <span className="text-2xs text-faint">NSE quoted {data.quotedAt}</span>}
                        </div>
                    )}
                </Panel>

                {chain?.supported === false && <Callout tone="neutral">{chain.reason}</Callout>}
                {chain?.available === false && <Callout tone="warn">{chain.reason}</Callout>}
                {chain?.lotSizeReason && <Callout tone="warn">{chain.lotSizeReason}</Callout>}
                {busy && !data && <p className="mt-4 text-sm text-faint">Loading the chain…</p>}

                {data && visible.length === 0 && (
                    <EmptyState title="No strikes came back" body="NSE answered but returned nothing for this expiry." />
                )}

                {visible.length > 0 && (
                    <>
                        <Panel className="mt-5" padding="none">
                            <div className="overflow-x-auto">
                                <div className="min-w-[900px]">
                                    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_110px_1fr_1fr_1fr_1fr] gap-px border-b border-border2 px-3 py-2 text-2xs font-bold tracking-wide text-faint">
                                        <span className="text-right">OI</span><span className="text-right">IV</span><span className="text-right">δ</span><span className="text-right">CALL</span>
                                        <span className="text-center">STRIKE</span>
                                        <span>PUT</span><span>δ</span><span>IV</span><span>OI</span>
                                    </div>

                                    {visible.map((row) => {
                                        const itmCall = underlying != null && row.strike < underlying;
                                        return (
                                            <div
                                                key={row.strike}
                                                className="grid grid-cols-[1fr_1fr_1fr_1fr_110px_1fr_1fr_1fr_1fr] items-center gap-px border-b border-border2 px-3 py-1.5 text-xs"
                                            >
                                                <span className="mono text-right text-faint">{oi(row.call?.openInterest)}</span>
                                                <span className="mono text-right text-faint">{row.call?.ourIv ? `${(row.call.ourIv * 100).toFixed(1)}` : '—'}</span>
                                                <span className="mono text-right text-faint">{n2(row.call?.g?.delta)}</span>
                                                <button
                                                    onClick={() => openTicket(row.strike, 'CE', 'buy', row.call?.lastPrice ?? null, row.call?.ourIv ?? null)}
                                                    disabled={!row.call?.lastPrice || !lotSize}
                                                    className={`mono rounded-xs px-1.5 py-0.5 text-right font-semibold hover:bg-chip disabled:opacity-40 ${itmCall ? 'text-foreground' : 'text-foreground-muted'}`}
                                                >
                                                    {n2(row.call?.lastPrice)}
                                                </button>

                                                <span className="mono text-center font-semibold">{row.strike}</span>

                                                <button
                                                    onClick={() => openTicket(row.strike, 'PE', 'buy', row.put?.lastPrice ?? null, row.put?.ourIv ?? null)}
                                                    disabled={!row.put?.lastPrice || !lotSize}
                                                    className={`mono rounded-xs px-1.5 py-0.5 font-semibold hover:bg-chip disabled:opacity-40 ${!itmCall ? 'text-foreground' : 'text-foreground-muted'}`}
                                                >
                                                    {n2(row.put?.lastPrice)}
                                                </button>
                                                <span className="mono text-faint">{n2(row.put?.g?.delta)}</span>
                                                <span className="mono text-faint">{row.put?.ourIv ? `${(row.put.ourIv * 100).toFixed(1)}` : '—'}</span>
                                                <span className="mono text-faint">{oi(row.put?.openInterest)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </Panel>

                        <p className="mt-3 text-xs text-faint">
                            Showing the 25 strikes nearest the money of {rows.length}. IV is solved here rather than taken
                            from NSE, which reports zero on illiquid and deep-ITM strikes — a dash means no volatility
                            reproduces that price, which is a real answer and not a gap we should fill with a number.
                            {missingIv > 0 && ` ${missingIv} call strikes are unsolvable on this expiry.`}
                        </p>
                    </>
                )}

                <Sheet open={ticket !== null} onClose={() => setTicket(null)} title={ticket ? formatContract(ticket.contract) : ''}>
                    {ticket && (
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-2">
                                <Button variant={ticket.side === 'buy' ? 'buy' : 'secondary'} onClick={() => setTicket({ ...ticket, side: 'buy' })} fullWidth>
                                    Buy
                                </Button>
                                <Button variant={ticket.side === 'sell' ? 'sell' : 'secondary'} onClick={() => setTicket({ ...ticket, side: 'sell' })} fullWidth>
                                    Write
                                </Button>
                            </div>

                            <Field label="Lots" hint={`One lot is ${ticket.contract.lotSize} units. Quantity is in units, as your broker shows it.`}>
                                <Input type="number" min={1} value={lots} onChange={(e) => setLots(Math.max(1, Number(e.target.value) || 1))} />
                            </Field>

                            <div className="rounded-sm border border-border2 bg-panel2 p-3 text-xs">
                                <Row label="Premium" value={`₹${ticket.premium.toFixed(2)}`} />
                                <Row label="Quantity" value={`${lots * ticket.contract.lotSize} units`} />
                                <Row label={ticket.side === 'buy' ? 'Cost' : 'Premium received'} value={fmtMoney(ticket.premium * lots * ticket.contract.lotSize, 'INR', 0)} />
                                {ticket.ourIv && <Row label="Implied volatility" value={`${(ticket.ourIv * 100).toFixed(1)}%`} />}
                            </div>

                            {marginQuote && (
                                <div className="rounded-sm border border-down/40 bg-down-dim p-3 text-xs">
                                    <Row label="Margin required" value={fmtMoney(marginQuote.marginBase, 'INR', 0)} />
                                    <Row label="Model" value={marginQuote.label} />
                                    <p className="mt-2 text-2xs text-faint">{MARGIN_CAVEATS[0]}</p>
                                </div>
                            )}

                            {ticket.side === 'sell' && (
                                <Callout tone="warn">
                                    Writing an option has capped profit — the premium — and, for a call, unlimited loss.
                                    The margin above is an approximation, not SPAN.
                                </Callout>
                            )}

                            <Button variant="primary" onClick={submit} fullWidth>
                                {ticket.side === 'buy' ? 'Buy' : 'Write'} {lots} lot{lots === 1 ? '' : 's'}
                            </Button>

                            <p className="text-2xs text-faint">
                                Cash-settled at expiry against the index. This simulator settles at the last available
                                index mark, which is <strong>not</strong> NSE&rsquo;s 30-minute closing average.{' '}
                                <Link href="/learn/expiry-and-assignment" className="text-accent underline underline-offset-2">
                                    How expiry works
                                </Link>
                            </p>
                        </div>
                    )}
                </Sheet>
            </div>
        </PageShell>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between py-0.5">
            <span className="text-faint">{label}</span>
            <span className="mono font-semibold">{value}</span>
        </div>
    );
}
