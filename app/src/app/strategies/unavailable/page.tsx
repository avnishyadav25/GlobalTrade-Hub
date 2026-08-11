'use client';

import Link from 'next/link';
import { PageShell, Panel, Badge } from '@/components/ui';

// Strategies that were asked for and deliberately NOT built.
//
// This page exists because the alternative — quietly omitting them, or worse shipping a
// version that runs on invented inputs — is how a tool stops being trustworthy. Each
// entry says what it would take, so the decision can be revisited rather than forgotten.

interface Unavailable {
    name: string;
    why: string;
    needed: string;
    verdict: 'no-free-data' | 'cannot-backtest' | 'not-real' | 'needs-options';
}

const VERDICT: Record<Unavailable['verdict'], { label: string; tone: 'warn' | 'down' | 'neutral' }> = {
    'no-free-data': { label: 'no free data source', tone: 'warn' },
    'cannot-backtest': { label: 'can never be backtested', tone: 'down' },
    'not-real': { label: 'not a real retail opportunity', tone: 'down' },
    'needs-options': { label: 'needs an options layer', tone: 'neutral' },
};

const ITEMS: Unavailable[] = [
    {
        name: 'MVRV on-chain mean reversion',
        verdict: 'no-free-data',
        why: 'Market Value to Realised Value is computed from the full transaction history of a chain, which no free API publishes.',
        needed: 'A Glassnode or CryptoQuant subscription, around $30 a month.',
    },
    {
        name: 'Order-book imbalance scalping',
        verdict: 'cannot-backtest',
        why: 'Live depth is fetchable from Binance. Historical depth is not — essentially nobody stores full order-book snapshots, and the exchanges that do sell them at institutional prices.',
        needed: 'A historical Level 2 archive. Without one this strategy could be run but never tested, and an untested strategy is a guess with extra steps.',
    },
    {
        name: 'Triangular currency arbitrage',
        verdict: 'not-real',
        why: 'It needs tick-level bid and ask across three pairs simultaneously. This app has 15-minute delayed mid prices, so any "arbitrage" it found would be an artefact of stale data rather than a real price discrepancy.',
        needed: 'Direct exchange connectivity and colocation. This opportunity is closed by firms measuring latency in microseconds.',
    },
    {
        name: 'Dark pool block sentiment',
        verdict: 'no-free-data',
        why: 'Off-exchange block prints are distributed through paid institutional feeds.',
        needed: 'A commercial market-data subscription.',
    },
    {
        name: 'Fed statement NLP momentum',
        verdict: 'no-free-data',
        why: 'The edge is entirely in reacting within milliseconds of the release, which needs a low-latency feed of the statement text itself.',
        needed: 'A newswire feed. Reading the same text a minute later has no value — the move has happened.',
    },
    {
        name: 'FII / DII flow convergence',
        verdict: 'no-free-data',
        why: 'NSE publishes the daily figures on its website but blocks programmatic access — verified, it returns 403.',
        needed: 'A licensed data vendor, or manual entry.',
    },
    {
        name: 'Calendar spreads and roll strategies',
        verdict: 'no-free-data',
        why: 'There is no futures curve here. Commodities are Yahoo continuous front-month tickers, which splice contracts together and have no individual expiries to spread against.',
        needed: 'Per-contract futures data with expiry dates.',
    },
    {
        name: 'Short straddle, iron condor, gamma scalping, IV skew',
        verdict: 'needs-options',
        why: 'The paper engine has no options instrument, no Greeks, no implied volatility and no multi-leg orders. Every one of these is a multi-leg position whose risk is defined by the Greeks.',
        needed: 'An option chain feed, a Black-Scholes and IV solver, and multi-leg order support with options margin. Planned as its own phase.',
    },
];

export default function UnavailablePage() {
    return (
        <PageShell
            width="narrow"
            title="What is not here, and why"
            subtitle="Strategies that were asked for and deliberately left unbuilt. A version running on invented inputs would look identical to a working one, right up until you traded it."
        >
            <div className="flex flex-col gap-3">
                {ITEMS.map((item) => (
                    <Panel key={item.name} padding="dense">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{item.name}</span>
                            <Badge tone={VERDICT[item.verdict].tone}>{VERDICT[item.verdict].label}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-foreground-muted">{item.why}</p>
                        <p className="mt-1.5 text-xs text-faint">
                            <span className="font-semibold">What it would take: </span>
                            {item.needed}
                        </p>
                    </Panel>
                ))}
            </div>

            <p className="mt-6 text-xs text-faint">
                One that IS here, with a limit worth repeating: the{' '}
                <Link href="/strategies/funding-carry" className="text-accent underline underline-offset-2">funding-rate carry</Link>{' '}
                has real data and is marked signal-only, because the paper engine has no perpetual-futures
                instrument to place the other leg against.
            </p>
        </PageShell>
    );
}
