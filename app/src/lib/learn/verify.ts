import type { VerifyContext, VerifyResult } from './types';
import { equity, toBase, deriveFxRates, quoteCcyOf, marketOf } from '@/lib/paperEngine';

// Every exercise is checked against PERSISTED ENGINE STATE — never a "mark as done"
// button. That is what stops the curriculum and your actual ledger drifting apart.

const ok = (hint: string): VerifyResult => ({ done: true, hint });

export const viewedInstruments = (n: number, markets: number) => (c: VerifyContext): VerifyResult => {
    const s = c.observed.symbols.length;
    const m = c.observed.markets.length;
    if (s >= n && m >= markets) return ok(`Seen ${s} instruments across ${m} markets.`);
    return {
        done: false,
        progress: Math.min(1, (s / n + m / markets) / 2),
        hint: `Open ${Math.max(0, n - s)} more instrument${n - s === 1 ? '' : 's'} and ${Math.max(0, markets - m)} more market${markets - m === 1 ? '' : 's'} on the Terminal.`,
    };
};

export const sawUpAndDown = (c: VerifyContext): VerifyResult => {
    const seen = c.observed.symbols.map((s) => c.quotes[s]?.changePercent).filter((x): x is number => Number.isFinite(x));
    const up = seen.some((x) => x > 0);
    const down = seen.some((x) => x < 0);
    if (up && down) return ok('You have seen both a riser and a faller.');
    return { done: false, hint: up ? 'Now find one that is DOWN today.' : down ? 'Now find one that is UP today.' : 'Open a few instruments and compare their % change.' };
};

export const placedFirstBuy = (c: VerifyContext): VerifyResult => {
    const f = c.state.fills.find((x) => x.side === 'buy' && x.kind === 'open');
    return f ? ok(`Done — you bought ${f.qty} ${f.symbol}.`) : { done: false, hint: 'Place a market BUY on the Terminal. Any instrument, any size.' };
};

export const sizedBetween = (lo: number, hi: number) => (c: VerifyContext): VerifyResult => {
    const fx = deriveFxRates(c.quotes);
    const eq = equity(c.state, c.quotes, fx);
    if (eq <= 0) return { done: false, hint: 'Reset your paper account first.' };
    for (const f of c.state.fills) {
        if (f.kind !== 'open' && f.kind !== 'add') continue;
        const pct = toBase(f.symbol, f.qty * f.price, fx) / eq;
        if (pct >= lo && pct <= hi) return ok(`One of your trades was ${(pct * 100).toFixed(1)}% of equity.`);
    }
    return { done: false, hint: `Place a trade worth between ${lo * 100}% and ${hi * 100}% of your equity — check "Order value" against "Buying power" on the ticket.` };
};

/**
 * An order the LEDGER attributes to this strategy.
 *
 * Reads provenance recorded on the order rather than the strategy store or the signal
 * queue. That matters for two reasons: the book is what cloud-syncs, so this progress
 * follows you between devices; and enabling a strategy is an intention, whereas an order
 * carrying its source is something that actually happened. A lesson gated on intention
 * would be completable by clicking, which is the one thing the curriculum refuses to be.
 *
 * Counts refused orders too, deliberately: a strategy that fired and was blocked by a
 * guardrail DID run, and watching it be refused is the more valuable lesson.
 */
export const placedByStrategy = (strategyId: string) => (c: VerifyContext): VerifyResult => {
    const mine = c.state.orders.filter((o) => o.source?.kind === 'strategy' && o.source.strategyId === strategyId);
    if (!mine.length) {
        return {
            done: false,
            hint: `No order from this strategy yet. Enable it on an instrument, then approve its signal on **/signals** — or switch that instance to automatic and let it place on its own.`,
        };
    }
    const filled = mine.filter((o) => o.status === 'filled').length;
    const refused = mine.filter((o) => o.status === 'rejected').length;
    return ok(
        filled
            ? `${filled} order${filled === 1 ? '' : 's'} placed by this strategy.`
            : `This strategy fired ${refused} time${refused === 1 ? '' : 's'} and was refused — it ran, which is what this step asked for.`
    );
};

/** Any strategy at all placed an order — the automation loop demonstrably ran. */
export const placedByAnyStrategy = (c: VerifyContext): VerifyResult => {
    const mine = c.state.orders.filter((o) => o.source?.kind === 'strategy');
    const names = [...new Set(mine.map((o) => o.source?.strategyId).filter(Boolean))];
    return mine.length
        ? ok(`${mine.length} order${mine.length === 1 ? '' : 's'} placed by ${names.join(', ')}.`)
        : {
              done: false,
              hint: 'Enable any strategy on an instrument, then approve its signal on **/signals** — or switch that instance to automatic and let it place unattended.',
          };
};

/**
 * A guardrail actually refused something.
 *
 * The point of the exercise is to be BLOCKED. A limit that has never refused you has
 * never been tested, and finding out which one bites — and how it reads — is worth more
 * than reading the list of them.
 */
export const refusedByAGuardrail = (c: VerifyContext): VerifyResult => {
    const refused = c.state.orders.filter((o) => o.status === 'rejected' && o.rejectReason);
    if (!refused.length) {
        return {
            done: false,
            hint: 'No refused order yet. Set a guardrail deliberately low on **/agents** — MAX ORDERS / DAY of 1 is the quickest — then let a strategy try to trade again.',
        };
    }
    return ok(`Refused ${refused.length} time${refused.length === 1 ? '' : 's'}. Most recent: "${refused[0].rejectReason}"`);
};

export const closedARoundTrip = (c: VerifyContext): VerifyResult =>
    c.state.account.roundTrips >= 1
        ? ok(`${c.state.account.roundTrips} round trip${c.state.account.roundTrips === 1 ? '' : 's'} completed.`)
        : { done: false, hint: 'Sell what you bought, to close the position completely.' };

export const restedALimitOrder = (c: VerifyContext): VerifyResult => {
    const hit = c.state.orders.find((o) => o.type === 'limit' && (o.status === 'open' || o.status === 'partial' || o.status === 'filled'));
    return hit
        ? ok('You placed a limit order and it went on the book.')
        : { done: false, hint: 'On the ticket choose LIMIT, set a price below the market, and submit. It should sit in Orders → Open.' };
};

export const hasStopProtection = (c: VerifyContext): VerifyResult => {
    for (const p of Object.values(c.state.positions)) {
        const opposite = p.qty > 0 ? 'sell' : 'buy';
        const stop = c.state.orders.find(
            (o) => o.symbol === p.symbol && o.side === opposite && o.type === 'stop' && (o.status === 'open' || o.status === 'partial')
        );
        if (stop) return ok(`${p.symbol} is protected by a resting stop.`);
    }
    return { done: false, hint: 'Open a position, then place an SL order on the OTHER side of it — sell-stop under a long.' };
};

export const paidFees = (c: VerifyContext): VerifyResult =>
    c.state.account.feesPaid > 0
        ? ok(`You have paid ₹${c.state.account.feesPaid.toFixed(2)} in charges so far.`)
        : { done: false, hint: 'Place any trade — the charges appear on Funds → Balance.' };

export const openedAShort = (c: VerifyContext): VerifyResult => {
    const short = Object.values(c.state.positions).find((p) => p.qty < 0);
    const everShorted = c.state.fills.some((f) => f.side === 'sell' && f.kind === 'open');
    if (short) return ok(`Short ${short.symbol}, with ₹${Math.round(short.marginHeldBase).toLocaleString('en-IN')} margin held.`);
    if (everShorted) return ok('You have opened a short before.');
    return { done: false, hint: 'Sell an instrument you do not own — that opens a short and holds margin.' };
};

export const wasBlockedByARule = (c: VerifyContext): VerifyResult => {
    const blocked = c.state.orders.find((o) => o.status === 'rejected' && /rule|cooldown|kill-switch|daily|equity/i.test(o.rejectReason ?? ''));
    return blocked
        ? ok(`Blocked as intended: "${blocked.rejectReason}"`)
        : { done: false, hint: 'Apply a rule on Insights, then try to place an order that breaks it. Check Orders → Rejected.' };
};

/* ---------------------------------------------------------------- new lessons */

/** Held something quoted in a currency other than rupees, so FX actually applied. */
export const tradedForeignCurrency = (c: VerifyContext): VerifyResult => {
    const f = c.state.fills.find((x) => quoteCcyOf(x.symbol) !== 'INR');
    if (!f) {
        return {
            done: false,
            hint: 'Trade something priced in dollars or yen — `AAPL`, `BTC/USDT` or `USD/JPY`. Watch the order value convert into rupees on the ticket.',
        };
    }
    return ok(`${f.symbol} is quoted in ${quoteCcyOf(f.symbol)}, and your book converted it to rupees at the fill-time rate.`);
};

/** A position whose stop caps the loss at no more than `maxPct` of equity. */
export const riskedAtMost = (maxPct: number) => (c: VerifyContext): VerifyResult => {
    const fx = deriveFxRates(c.quotes);
    const eq = equity(c.state, c.quotes, fx);
    if (eq <= 0) return { done: false, hint: 'Reset your paper account first.' };

    for (const p of Object.values(c.state.positions)) {
        const opposite = p.qty > 0 ? 'sell' : 'buy';
        const stop = c.state.orders.find(
            (o) => o.symbol === p.symbol && o.side === opposite && o.type === 'stop' && (o.status === 'open' || o.status === 'partial')
        );
        if (!stop?.stopPrice) continue;
        const perUnit = Math.abs(p.avgPrice - stop.stopPrice);
        const riskBase = toBase(p.symbol, perUnit * Math.abs(p.qty), fx);
        const pct = riskBase / eq;
        if (pct <= maxPct) {
            return ok(`${p.symbol}: your stop caps the loss at ${(pct * 100).toFixed(2)}% of equity.`);
        }
    }
    return {
        done: false,
        hint: `Open a position, place a stop, and size it so that (entry − stop) × quantity is at most ${(maxPct * 100).toFixed(0)}% of your equity.`,
    };
};

/** Looked at enough charts to have seen candles behave. */
export const studiedCharts = (n: number) => (c: VerifyContext): VerifyResult => {
    const seen = c.observed.symbols.length;
    if (seen >= n) return ok(`You have opened ${seen} instruments' charts.`);
    return { done: false, progress: Math.min(1, seen / n), hint: `Open ${n - seen} more instrument${n - seen === 1 ? '' : 's'} on the Terminal and look at the candles.` };
};

/** RSI has warmed up on enough instruments for the scanner to be meaningful. */
export const rsiWarmedUp = (n: number) => (c: VerifyContext): VerifyResult => {
    const ready = Object.keys(c.quotes).filter((s) => c.rsi(s) != null);
    if (ready.length >= n) {
        const sample = ready.slice(0, 3).map((s) => `${s} ${c.rsi(s)!.toFixed(0)}`).join(', ');
        return ok(`RSI is live on ${ready.length} instruments — ${sample}.`);
    }
    return {
        done: false,
        progress: Math.min(1, ready.length / n),
        hint: `RSI needs price history before it means anything. Leave the app open on the Terminal or Scanner for a few minutes — ${ready.length} of ${n} instruments are ready.`,
    };
};

/** Enough completed trades for the discipline read to say something real. */
export const builtATrackRecord = (n: number) => (c: VerifyContext): VerifyResult => {
    const done = c.state.account.roundTrips;
    if (done >= n) return ok(`${done} completed round trips — enough for the coach to see patterns.`);
    return {
        done: false,
        progress: Math.min(1, done / n),
        hint: `${done} of ${n} round trips. A discipline score built on fewer trades than this is noise, not a signal.`,
    };
};

/* --------------------------------------------------------------------- drills */
// Counted from state, never incremented — so there is nothing to double-count and
// no way to tick one off without doing it.

export const countCancelledLimits = (c: VerifyContext): number =>
    c.state.orders.filter((o) => o.type === 'limit' && o.status === 'cancelled').length;

export const countRoundTrips = (c: VerifyContext): number => c.state.account.roundTrips;

export const countShortsOpened = (c: VerifyContext): number =>
    c.state.fills.filter((f) => f.side === 'sell' && f.kind === 'open').length;

export const countRuleRejections = (c: VerifyContext): number =>
    c.state.orders.filter((o) => o.status === 'rejected' && /rule|cooldown|daily/i.test(o.rejectReason ?? '')).length;

export const countStopsPlaced = (c: VerifyContext): number =>
    c.state.orders.filter((o) => o.type === 'stop').length;

export const countMarketsTraded = (c: VerifyContext): number =>
    new Set(c.state.fills.map((f) => marketOf(f.symbol))).size;

export const countLosingTradesClosed = (c: VerifyContext): number =>
    c.state.fills.filter((f) => (f.kind === 'close' || f.kind === 'reduce') && f.pnl < 0).length;

export const countInstrumentsObserved = (c: VerifyContext): number => c.observed.symbols.length;
