import type { VerifyContext, VerifyResult } from './types';
import { equity, toBase, deriveFxRates } from '@/lib/paperEngine';

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
