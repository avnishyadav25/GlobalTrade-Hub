// Who is allowed to place orders right now.
//
// Automation can run in two places: the browser loop in StrategyEngine, and a server
// runner driven by a self-hosted scheduler. Both write the same paper ledger, and the
// ledger cannot survive two writers.
//
// WHY A LEASE RATHER THAN A MERGE. The monotonicity guard in api/state/[key] rejects a
// PUT whose `state.seq` is strictly OLDER than the server's. Equal seq passes. So a tab
// at seq 100 and a runner at seq 100 can each place an order, each write seq 101, and
// one order is silently lost — with the ledger identity still balancing, because each
// book is internally consistent on its own. Merging two divergent order books is not
// solvable correctly, so the only honest fix is to make concurrency impossible.
//
// The browser heartbeats while a tab is open with automation enabled. The server acts
// only when no heartbeat has landed inside the window. Exactly one writer, always.

/** How stale a heartbeat must be before the server considers the browser gone. */
export const LEASE_TTL_MS = 3 * 60_000;

/**
 * How often the browser should heartbeat. Comfortably inside the TTL so that one missed
 * tick — a throttled background tab, a slow network — does not hand the lease over while
 * the tab is still very much alive and trading.
 */
export const HEARTBEAT_MS = 45_000;

export interface AutomationLease {
    /** Epoch ms of the last browser heartbeat. */
    browserHeartbeatAt?: number;
    /** Epoch ms of the last server run that placed or evaluated. */
    serverRanAt?: number;
    /**
     * Signal ids already acted on, shared between the two runners.
     *
     * Lives on the lease rather than in per-runner memory because it is precisely the
     * handover case it guards: whichever runner takes over starts with blank runtime
     * memory and would otherwise re-place an order the other just made on the same bar.
     */
    actedSignalIds?: string[];
    /**
     * What the last server run actually did.
     *
     * Recorded so the UI can report evidence rather than intent. "Automation is on" is a
     * setting; "the last run placed nothing because BTC/USDT gave no signal" is a fact,
     * and only the second one tells you whether anything is working.
     */
    lastRun?: {
        at: number;
        placed: number;
        refused: number;
        /** Why nothing happened, when nothing happened. */
        reason?: string;
    };
}

export type LeaseHolder = 'browser' | 'server' | 'idle';

/** Is a browser tab currently claiming the lease? */
export function browserIsLive(lease: AutomationLease | null | undefined, now: number): boolean {
    const hb = lease?.browserHeartbeatAt;
    if (typeof hb !== 'number' || !Number.isFinite(hb)) return false;
    // A heartbeat from the future is a clock-skew artefact, not a live tab. Treating it
    // as live would let a bad clock lock the server out indefinitely.
    if (hb > now + LEASE_TTL_MS) return false;
    return now - hb < LEASE_TTL_MS;
}

/**
 * May the server runner place orders?
 *
 * Deliberately conservative: anything it cannot establish means "no". A server that
 * declines to trade is a missed opportunity; a server that trades alongside a live tab
 * corrupts the book.
 */
export function serverMayAct(lease: AutomationLease | null | undefined, now: number): boolean {
    return !browserIsLive(lease, now);
}

/** Who holds it, for display. Never inferred from a setting — only from a real heartbeat. */
export function leaseHolder(lease: AutomationLease | null | undefined, now: number): LeaseHolder {
    if (browserIsLive(lease, now)) return 'browser';
    const ran = lease?.serverRanAt;
    if (typeof ran === 'number' && Number.isFinite(ran) && now - ran < LEASE_TTL_MS) return 'server';
    return 'idle';
}

/**
 * Guard against re-firing a signal the other runner already acted on.
 *
 * Signal ids are deterministic — `${strategyId}:${symbol}:${barTime}:${actionKey}` — so
 * both runners derive the same id from the same bars. Runtime `memory` suppresses repeats
 * within one process, but it is deliberately never persisted, so a runner taking over
 * starts blank and would happily re-place an order the other one just made on the current
 * bar. This is the one duplicate that a lease alone does not prevent, because it happens
 * across a handover rather than concurrently.
 */
export function alreadyActed(actedSignalIds: string[] | undefined, signalId: string): boolean {
    return Array.isArray(actedSignalIds) && actedSignalIds.includes(signalId);
}

/** Append an acted id, keeping the list bounded. Order preserved, newest last. */
export function recordActed(actedSignalIds: string[] | undefined, signalId: string, keep = 200): string[] {
    const prev = Array.isArray(actedSignalIds) ? actedSignalIds.filter((v) => typeof v === 'string') : [];
    if (prev.includes(signalId)) return prev;
    return [...prev, signalId].slice(-keep);
}
