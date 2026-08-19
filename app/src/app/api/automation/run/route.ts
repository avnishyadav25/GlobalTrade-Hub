import { NextResponse } from 'next/server';
import { fetchQuotes, fetchCandles } from '@/lib/marketData/router';
import { resolveOne, resolveUniverse } from '@/lib/marketData/universe';
import { registerInstruments } from '@/lib/instruments';
import { strategyById } from '@/lib/strategies/defs';
import { evaluateStrategy } from '@/lib/strategies/runtime';
import { assessSignal } from '@/lib/automation/decide';
import { serverMayAct, recordActed, type AutomationLease } from '@/lib/automation/lease';
import { readState, readLease, mergeLease, writePaperIfUnchanged } from '@/lib/automation/store';
import { deriveFxRates, placeOrder, marketOf, type PaperState } from '@/lib/paperEngine';
import type { LiveQuote } from '@/stores/marketStore';
import type { Guardrails } from '@/stores/agentStore';

// Run enabled strategies with no browser open.
//
// Driven by a self-hosted scheduler (scripts/scheduler.sh), not Vercel Cron — see
// docs/AUTOMATION.md. Everything risk-bearing is shared with the browser loop through
// lib/automation/decide.ts; what is different here is only where the book comes from and
// how it is written back.

export const runtime = 'nodejs';

const BAR_LIMIT = 400;
const TIMEFRAME_SECONDS: Record<string, number> = {
    '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400,
};
/** Needed by deriveFxRates to price the ₹ book. Fetched whether or not you trade them. */
const FX_SYMBOLS = ['USD/INR', 'USD/JPY'];

function authorized(req: Request): boolean {
    const secret = process.env.CRON_SECRET;
    // Fail closed in production. This endpoint places orders.
    if (!secret) return process.env.NODE_ENV !== 'production';
    const url = new URL(req.url);
    const bearer = req.headers.get('authorization');
    return (
        url.searchParams.get('secret') === secret ||
        req.headers.get('x-cron-secret') === secret ||
        bearer === `Bearer ${secret}`
    );
}

interface StrategyInstanceRow {
    id: string; strategyId: string; symbol: string; timeframe: string;
    params?: Record<string, number>; enabled?: boolean; mode?: string;
}

export async function GET(req: Request) {
    if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const now = Date.now();
    const skipped: string[] = [];
    const placed: Array<{ symbol: string; side: string; qty: number; strategyId: string }> = [];
    const refused: Array<{ symbol: string; strategyId: string; reason: string }> = [];

    // 1. Never act alongside a live tab. Two writers cannot share this ledger.
    const lease = (await readLease()) ?? ({} as AutomationLease);
    if (!serverMayAct(lease, now)) {
        return NextResponse.json({ ok: true, ran: false, reason: 'a browser tab holds the lease' });
    }

    // 2. What is running. Only `auto` instances: a `review` instance is waiting for a
    //    human to approve its signal, and the server cannot obtain that approval.
    const strategies = await readState<{ instances?: StrategyInstanceRow[]; riskPct?: number; maxActive?: number }>('strategies');
    const all = Array.isArray(strategies?.instances) ? strategies!.instances : [];
    const instances = all.filter((i) => i.enabled && i.mode === 'auto').slice(0, strategies?.maxActive ?? 10);
    if (!instances.length) {
        await mergeLease({ serverRanAt: now });
        return NextResponse.json({ ok: true, ran: true, placed: [], reason: 'no enabled automatic instances', enabledTotal: all.length });
    }

    // 3. The book, and the seq we must still own when we write back.
    const paperRow = await readState<{ state?: PaperState; equityHistory?: number[] }>('paper');
    const book = paperRow?.state;
    if (!book) return NextResponse.json({ ok: false, reason: 'no paper book in cloud state' }, { status: 409 });
    const seqAtRead = book.seq;

    // 4. User-added instruments live in the watchlists blob; without registering them the
    //    server cannot resolve a symbol the browser knows perfectly well.
    const watch = await readState<{ customInstruments?: unknown[] }>('watchlists');
    if (Array.isArray(watch?.customInstruments)) registerInstruments(watch!.customInstruments);

    // 5. Quotes, including the FX pairs the whole ₹ book is priced from.
    const symbols = [...new Set([...instances.map((i) => i.symbol), ...FX_SYMBOLS])];
    const { universe } = resolveUniverse(symbols, watch?.customInstruments);
    const batch = await fetchQuotes(universe);
    const quotes: Record<string, LiveQuote> = {};
    for (const q of batch.quotes) {
        quotes[q.symbol] = {
            symbol: q.symbol, price: q.price, prevClose: q.prevClose ?? q.price,
            change: q.prevClose ? q.price - q.prevClose : 0,
            changePercent: q.prevClose ? ((q.price - q.prevClose) / q.prevClose) * 100 : 0,
            high: q.high ?? q.price, low: q.low ?? q.price, volume: q.volume ?? 0,
            ts: now, dir: null, real: true,
        };
    }

    // 6. Refuse to trade on guessed FX. deriveFxRates falls back to constants and flags
    //    itself stale; that fallback was once 14.5% wrong, which would misprice every
    //    non-INR position in the book. A run that does nothing is recoverable.
    const fx = deriveFxRates(quotes);
    if (fx.stale) {
        await mergeLease({ serverRanAt: now });
        return NextResponse.json({ ok: false, ran: true, reason: 'FX rates are stale — refusing to price the book on a fallback constant', placed: [] });
    }

    const guardrails = (await readState<{ guardrails?: Guardrails; killSwitch?: boolean }>('agents')) ?? {};
    if (guardrails.killSwitch) {
        await mergeLease({ serverRanAt: now });
        return NextResponse.json({ ok: true, ran: true, reason: 'kill-switch is on', placed: [] });
    }

    let working: PaperState = book;
    let acted = Array.isArray(lease.actedSignalIds) ? lease.actedSignalIds : [];

    for (const inst of instances) {
        const strategy = strategyById(inst.strategyId);
        if (!strategy || strategy.signalOnly) { skipped.push(`${inst.symbol}: not a placeable strategy`); continue; }

        const resolved = resolveOne(inst.symbol);
        if (!resolved) { skipped.push(`${inst.symbol}: unresolvable`); continue; }

        // A generated series is not a basis for a live order — the same rule the browser
        // loop follows. fetchCandles returns null when no provider covers the instrument,
        // which is exactly the case the API route papers over with a synthetic series.
        const result = await fetchCandles(resolved, inst.timeframe, BAR_LIMIT);
        const bars = result?.candles ?? [];
        if (bars.length < 10) { skipped.push(`${inst.symbol}: no real candles`); continue; }

        const held = working.positions[inst.symbol];
        const { signal } = evaluateStrategy({
            strategy,
            params: inst.params,
            symbol: inst.symbol,
            market: marketOf(inst.symbol),
            timeframe: inst.timeframe,
            barSeconds: TIMEFRAME_SECONDS[inst.timeframe] ?? 86_400,
            bars,
            position: held ? { qty: held.qty, avgPrice: held.avgPrice, entryIndex: bars.length - 1 } : null,
            equity: working.account.cash,
            // No persisted memory server-side by design; `acted` is what stops a repeat.
            memory: {},
        });
        if (!signal) { skipped.push(`${inst.symbol}: no signal`); continue; }

        const assessment = assessSignal({
            signal, instanceId: inst.id, book: working, quotes,
            guardrails: guardrails.guardrails as Guardrails,
            riskPct: strategies?.riskPct ?? 1,
            actedSignalIds: acted, now, fx,
        });
        if (!assessment.ok) { refused.push({ symbol: inst.symbol, strategyId: inst.strategyId, reason: assessment.reason }); continue; }

        const { state, result: placeResult } = placeOrder(
            working,
            { symbol: signal.symbol, side: signal.side, type: 'market', qty: assessment.qty, source: assessment.source },
            quotes[signal.symbol], fx, now
        );
        working = state;
        acted = recordActed(acted, signal.id);
        if (placeResult.status === 'rejected') {
            refused.push({ symbol: inst.symbol, strategyId: inst.strategyId, reason: placeResult.reason ?? 'rejected by the engine' });
        } else {
            placed.push({ symbol: signal.symbol, side: signal.side, qty: assessment.qty, strategyId: inst.strategyId });
        }
    }

    // 7. Write back only if nobody moved the book underneath us.
    if (working !== book) {
        const write = await writePaperIfUnchanged(
            { ...(paperRow ?? {}), state: working },
            seqAtRead
        );
        if (!write.written) {
            return NextResponse.json({ ok: false, ran: true, reason: `abandoned: ${write.reason}`, placed: [], refused });
        }
    }

    await mergeLease({ serverRanAt: now, actedSignalIds: acted });
    return NextResponse.json({ ok: true, ran: true, placed, refused, skipped, evaluated: instances.length });
}
