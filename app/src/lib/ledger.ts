// A running account statement reconstructed from fills.
//
// The engine records fills, not ledger lines, so this derives the movements that
// produced the cash balance: notional, fee, realized P&L and margin. It is pure and
// unit-tested to assert the closing balance equals `account.cash` — which is what
// makes the Funds screen trustworthy rather than decorative.

import { toBase, type PaperState, type PaperFill, type FxRates, DEFAULT_FX, SHORT_MARGIN_FACTOR } from './paperEngine';

export type LedgerKind = 'open' | 'close' | 'fee' | 'realized' | 'margin' | 'opening';

export interface LedgerRow {
    id: string;
    ts: number;
    symbol: string;
    kind: LedgerKind;
    description: string;
    /** Signed change to cash, base currency. */
    amount: number;
    balance: number;
}

export function buildLedger(state: PaperState, fx: FxRates = DEFAULT_FX): LedgerRow[] {
    // Fills are newest-first in the store; a statement reads oldest-first.
    //
    // Sorting on `ts` alone is not enough: two fills can land in the same millisecond,
    // and a stable sort then preserves the store's reverse order — which made the
    // ledger read a close before its own open and book it as a short.
    // Fill ids are `fill-<seq>` from the engine's monotonic counter, so that is the
    // authoritative tiebreak.
    const seqOf = (id: string) => Number(id.split('-')[1] ?? 0);
    const chrono = [...state.fills].sort((a, b) => a.ts - b.ts || seqOf(a.id) - seqOf(b.id));
    const rows: LedgerRow[] = [];
    let balance = state.account.startingCash;

    // Position state is reconstructed as we walk, mirroring the engine. This is
    // load-bearing: margin is released at the ENTRY basis, not the exit notional, so
    // a ledger that used the covering fill's value drifts by the price move.
    const pos = new Map<string, { qty: number; basisBase: number; marginBase: number }>();

    rows.push({
        id: 'opening',
        ts: state.createdAt,
        symbol: '—',
        kind: 'opening',
        description: 'Opening balance',
        amount: 0,
        balance,
    });

    const push = (f: PaperFill, kind: LedgerKind, description: string, amount: number, n: number) => {
        balance += amount;
        rows.push({ id: `${f.id}-${n}`, ts: f.ts, symbol: f.symbol, kind, description, amount, balance });
    };

    for (const f of chrono) {
        const notional = toBase(f.symbol, f.qty * f.price, fx);
        const dir = f.side === 'buy' ? 1 : -1;
        const cur = pos.get(f.symbol) ?? { qty: 0, basisBase: 0, marginBase: 0 };
        const sameDirection = cur.qty === 0 || Math.sign(cur.qty) === dir;

        if (sameDirection) {
            const isShort = dir < 0;
            const margin = isShort ? notional * SHORT_MARGIN_FACTOR : 0;
            if (isShort) {
                push(f, 'margin', `Margin held — short ${f.qty} ${f.symbol}`, -margin, 1);
            } else {
                push(f, 'open', `Bought ${f.qty} ${f.symbol} @ ${f.price}`, -notional, 1);
            }
            pos.set(f.symbol, {
                qty: cur.qty + dir * f.qty,
                basisBase: cur.basisBase + notional,
                marginBase: cur.marginBase + margin,
            });
        } else {
            const openQty = Math.abs(cur.qty);
            const closeQty = Math.min(f.qty, openQty);
            const frac = openQty > 0 ? closeQty / openQty : 0;
            const closedBasis = cur.basisBase * frac;
            const releasedMargin = cur.marginBase * frac;
            const proceeds = toBase(f.symbol, closeQty * f.price, fx);
            const wasShort = cur.qty < 0;

            if (wasShort) {
                push(f, 'margin', `Margin released — cover ${closeQty} ${f.symbol}`, releasedMargin, 1);
                push(f, 'realized', `Realized P&L on ${f.symbol}`, f.pnl, 2);
            } else {
                push(f, 'close', `Sold ${closeQty} ${f.symbol} @ ${f.price}`, proceeds, 1);
            }

            let next = {
                qty: cur.qty + dir * closeQty,
                basisBase: cur.basisBase - closedBasis,
                marginBase: cur.marginBase - releasedMargin,
            };

            // A flip closes the old side and opens the remainder on the new one.
            const flipQty = f.qty - closeQty;
            if (flipQty > 1e-8) {
                const flipNotional = toBase(f.symbol, flipQty * f.price, fx);
                const flipIsShort = dir < 0;
                const flipMargin = flipIsShort ? flipNotional * SHORT_MARGIN_FACTOR : 0;
                if (flipIsShort) {
                    push(f, 'margin', `Margin held — flip short ${flipQty} ${f.symbol}`, -flipMargin, 4);
                } else {
                    push(f, 'open', `Bought ${flipQty} ${f.symbol} @ ${f.price}`, -flipNotional, 4);
                }
                next = { qty: dir * flipQty, basisBase: flipNotional, marginBase: flipMargin };
            }
            if (Math.abs(next.qty) < 1e-8) pos.delete(f.symbol);
            else pos.set(f.symbol, next);
        }

        if (f.fee) push(f, 'fee', `Charges on ${f.symbol}`, -f.fee, 3);
    }

    return rows;
}

/** Closing balance of the statement. Should equal `state.account.cash`. */
export function ledgerBalance(rows: LedgerRow[]): number {
    return rows.length ? rows[rows.length - 1].balance : 0;
}
