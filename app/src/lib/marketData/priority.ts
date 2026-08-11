// Which symbols to poll this cycle, and in what order.
//
// THE CONSTRAINT
// Yahoo's token bucket is 30/min and `yahoo.quotes` makes ONE upstream call per
// symbol. That bucket is also shared with candle loads and instrument search, and
// ~11/min already goes on the seeded instruments plus USD/INR — so the real headroom
// is around 16/min, not 30. A 60-symbol watchlist polled every 60 seconds would ask
// for 60 upstream calls a minute.
//
// Raising the bucket is not an option: Yahoo is unofficial and blocks by IP, and one
// ban takes out India, FX, commodities, USD/INR *and* the US fallback simultaneously.
// `cachedFetch` already makes over-budget safe by serving stale — this module is about
// not WASTING the budget on symbols nobody is looking at.
//
// THE APPROACH
// A hot tier that is always polled (what you are looking at, what you have money in,
// what you have alerts on), then strict sequential rotation through everything else.
// Rotation is sequential rather than "skip what doesn't fit" so that every symbol is
// guaranteed to be reached within ceil(n / budget) cycles — no symbol can starve.

export type Cost = 'scarce' | 'cheap';

/** Yahoo-bound symbols per cycle. Leaves ~11/min of the bucket for candles and search. */
export const SCARCE_BUDGET = 18;
/** Binance (120/min) and Finnhub (50/min) are not the constraint. */
export const CHEAP_BUDGET = 40;

export interface PollInput {
    /** The instrument currently open on the Terminal. */
    selected?: string;
    /** Symbols with an open position — marking these wrong misprices the book. */
    positions?: string[];
    /** Symbols with a resting limit/stop order that could trigger. */
    restingOrders?: string[];
    /** Symbols with an armed alert. */
    alerts?: string[];
    /** The watchlist the user is actually looking at. */
    activeList?: string[];
    /** Every symbol across every list. */
    all?: string[];
    costOf: (symbol: string) => Cost;
    /** Rotation position carried across cycles. */
    cursor: number;
    scarceBudget?: number;
    cheapBudget?: number;
}

export interface PollPlan {
    /** Hot tier first, then this cycle's rotation slice. */
    symbols: string[];
    /** Where the next cycle resumes. */
    cursor: number;
    /** Resolved but not polled this cycle. The UI shows these as queued. */
    deferred: string[];
}

function dedup(values: (string | undefined)[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of values) {
        const s = typeof v === 'string' ? v.trim() : '';
        if (!s || seen.has(s)) continue;
        seen.add(s);
        out.push(s);
    }
    return out;
}

export function planPoll(input: PollInput): PollPlan {
    const { costOf } = input;
    const hot = dedup([input.selected, ...(input.positions ?? []), ...(input.restingOrders ?? []), ...(input.alerts ?? [])]);
    const hotSet = new Set(hot);

    // Active list before the rest, so the screen you are on refreshes first.
    const rest = dedup([...(input.activeList ?? []), ...(input.all ?? [])]).filter((s) => !hotSet.has(s));

    // The hot tier is spent first and can legitimately exhaust the budget on its own —
    // if you hold 20 Indian stocks, those matter more than refreshing an idle list.
    let scarce = input.scarceBudget ?? SCARCE_BUDGET;
    let cheap = input.cheapBudget ?? CHEAP_BUDGET;
    for (const s of hot) {
        if (costOf(s) === 'scarce') scarce--;
        else cheap--;
    }

    const n = rest.length;
    let cursor = n && Number.isFinite(input.cursor) ? ((Math.trunc(input.cursor) % n) + n) % n : 0;

    const taken: string[] = [];
    for (let steps = 0; steps < n; steps++) {
        const symbol = rest[cursor];
        const cost = costOf(symbol);
        // Stop rather than skip: skipping would advance the cursor past a symbol that
        // was never fetched, and it would never be retried.
        if (cost === 'scarce' ? scarce <= 0 : cheap <= 0) break;
        if (cost === 'scarce') scarce--;
        else cheap--;
        taken.push(symbol);
        cursor = (cursor + 1) % n;
    }

    const takenSet = new Set(taken);
    return {
        symbols: [...hot, ...taken],
        cursor,
        deferred: rest.filter((s) => !takenSet.has(s)),
    };
}

/**
 * How long a full rotation takes, in cycles. Report this to the user rather than
 * promising a refresh rate the budget cannot deliver.
 */
export function rotationCycles(scarceCount: number, scarceBudget = SCARCE_BUDGET): number {
    if (scarceCount <= 0 || scarceBudget <= 0) return 1;
    return Math.max(1, Math.ceil(scarceCount / scarceBudget));
}
