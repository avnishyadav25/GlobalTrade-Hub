'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageShell, Panel, Badge, Button, Callout, Field, Select, Tabs, EmptyState } from '@/components/ui';
import { allInstruments } from '@/lib/instruments';
import { fmtCompact } from '@/lib/format';
import type { Fundamentals } from '@/lib/marketData/providers/finnhubFundamentals';
import type { IpoIssue } from '@/lib/marketData/providers/nseIpo';
import type { CoinReference } from '@/lib/marketData/providers/coingecko';

// Research: the data behind the "reading a company", IPO and crypto lessons.
//
// Every panel here distinguishes three states that are easy to collapse and expensive
// to confuse: we have data · this source does not cover this thing · the source failed.
// An empty table that means all three is how a screen starts lying.

type Tab = 'company' | 'ipo' | 'crypto';

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-b border-border2 py-2 last:border-0">
            <span className="text-xs text-faint">{label}{hint && <span className="ml-1 text-2xs">· {hint}</span>}</span>
            <span className="mono text-sm">{value}</span>
        </div>
    );
}

const n = (v: number | null, digits = 2) => (v == null ? '—' : v.toFixed(digits));
const pct = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)}%`);

export default function ResearchPage() {
    const [tab, setTab] = useState<Tab>('company');

    const usSymbols = allInstruments().filter((a) => a.market === 'us').map((a) => a.symbol);
    const cryptoSymbols = allInstruments().filter((a) => a.market === 'crypto').map((a) => a.symbol);

    const [symbol, setSymbol] = useState(usSymbols[0] ?? 'AAPL');
    const [company, setCompany] = useState<{ data: Fundamentals | null; reason?: string; configured: boolean } | null>(null);
    const [companyBusy, setCompanyBusy] = useState(false);

    const [ipos, setIpos] = useState<{ available: boolean; issues: IpoIssue[] } | null>(null);
    const [coinSymbol, setCoinSymbol] = useState(cryptoSymbols[0] ?? 'BTC/USDT');
    const [coin, setCoin] = useState<{ data: CoinReference | null; reason?: string; supported: boolean } | null>(null);

    const loadCompany = useCallback(async (sym: string) => {
        setCompanyBusy(true);
        try {
            const res = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(sym)}`);
            setCompany(await res.json());
        } catch {
            setCompany({ data: null, configured: true, reason: 'The request failed.' });
        } finally {
            setCompanyBusy(false);
        }
    }, []);

    useEffect(() => { if (tab === 'company') loadCompany(symbol); }, [tab, symbol, loadCompany]);
    useEffect(() => {
        if (tab !== 'ipo' || ipos) return;
        fetch('/api/ipo').then((r) => r.json()).then(setIpos).catch(() => setIpos({ available: false, issues: [] }));
    }, [tab, ipos]);
    useEffect(() => {
        if (tab !== 'crypto') return;
        fetch(`/api/crypto/reference?symbol=${encodeURIComponent(coinSymbol)}`).then((r) => r.json()).then(setCoin).catch(() => setCoin(null));
    }, [tab, coinSymbol]);

    return (
        <PageShell
            title="Research"
            coachTopic="research"
            subtitle="Company financials, live Indian IPOs and crypto supply data — the figures the Learn track asks you to read for yourself."
        >
            <Tabs
                label="Research type"
                value={tab}
                onChange={setTab}
                tabs={[
                    { value: 'company', label: 'Company' },
                    { value: 'ipo', label: 'IPOs' },
                    { value: 'crypto', label: 'Crypto' },
                ]}
            />

            {tab === 'company' && (
                <div className="mt-4">
                    <Panel>
                        <Field label="Company" hint="US listings only — see the note below.">
                            <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                                {usSymbols.map((s) => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </Field>
                    </Panel>

                    {company?.configured === false && (
                        <Callout tone="warn">FINNHUB_API_KEY is not set, so no fundamentals can be fetched.</Callout>
                    )}
                    {company?.reason && company.configured !== false && <Callout tone="neutral">{company.reason}</Callout>}

                    {companyBusy && <p className="mt-4 text-sm text-faint">Loading…</p>}

                    {company?.data && (
                        <>
                            <Panel title={company.data.name ?? symbol} className="mt-4">
                                <p className="mb-3 text-xs text-faint">{company.data.industry ?? 'Industry not reported'}</p>
                                <Row label="Market cap" value={company.data.marketCap == null ? '—' : `$${fmtCompact(company.data.marketCap)}`} />
                                <Row label="P/E (trailing)" value={n(company.data.peTTM)} hint="price per rupee of earnings" />
                                <Row label="P/B" value={n(company.data.pbTTM)} hint="price per rupee of book value" />
                                <Row label="Return on equity" value={pct(company.data.roeTTM)} hint="profit per rupee shareholders put in" />
                                <Row label="Return on assets" value={pct(company.data.roaTTM)} />
                                <Row label="Gross margin" value={pct(company.data.grossMarginTTM)} />
                                <Row label="Net margin" value={pct(company.data.netMarginTTM)} hint="what survives to the bottom line" />
                                <Row label="Debt to equity" value={n(company.data.debtToEquity)} hint="borrowed per rupee owned" />
                                <Row label="Current ratio" value={n(company.data.currentRatio)} />
                                <Row label="Revenue growth" value={pct(company.data.revenueGrowthTTM)} />
                                <Row label="Dividend yield" value={pct(company.data.dividendYield)} />
                                <Row label="52-week range" value={`${n(company.data.week52Low)} – ${n(company.data.week52High)}`} />
                            </Panel>
                            <p className="mt-3 text-xs text-faint">
                                A dash means the figure is <strong>not reported</strong>, not zero. A company with no debt and
                                a company that did not disclose its debt look identical in a table that renders both as 0.
                            </p>
                        </>
                    )}

                    {company && !company.data && !company.reason && !companyBusy && (
                        <EmptyState title="Nothing came back" body="Finnhub returned no data for this symbol. That usually means it does not cover it." />
                    )}
                </div>
            )}

            {tab === 'ipo' && (
                <div className="mt-4">
                    {ipos && !ipos.available && (
                        <Callout tone="warn">
                            The NSE issue endpoint did not respond. It is an unofficial source and blocks
                            programmatic access intermittently — this is a fetch failure, not an empty market.
                        </Callout>
                    )}

                    {ipos?.available && ipos.issues.length === 0 && (
                        <EmptyState title="No issues open" body="NSE reports no current public issue. That is a real answer, not a failed request." />
                    )}

                    <div className="flex flex-col gap-3">
                        {(ipos?.issues ?? []).map((issue) => (
                            <Panel key={`${issue.company}-${issue.opensOn}`} padding="dense">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold">{issue.company}</span>
                                    {issue.symbol && <Badge>{issue.symbol}</Badge>}
                                    {issue.status && <Badge tone="accent">{issue.status}</Badge>}
                                </div>
                                <div className="mono mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-faint">
                                    {issue.priceBand && <span>band {issue.priceBand}</span>}
                                    {issue.lotSize && <span>lot {issue.lotSize}</span>}
                                    {issue.opensOn && <span>opens {issue.opensOn}</span>}
                                    {issue.closesOn && <span>closes {issue.closesOn}</span>}
                                </div>
                            </Panel>
                        ))}
                    </div>

                    {ipos?.available && ipos.issues.length > 0 && (
                        <p className="mt-3 text-xs text-faint">
                            Listed for study, not as a recommendation. Applying to an IPO is not covered by this
                            app — there is no broker integration for it and none is implied.
                        </p>
                    )}
                </div>
            )}

            {tab === 'crypto' && (
                <div className="mt-4">
                    <Panel>
                        <Field label="Asset" hint="Reference data covers the seeded crypto instruments.">
                            <Select value={coinSymbol} onChange={(e) => setCoinSymbol(e.target.value)}>
                                {cryptoSymbols.map((s) => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </Field>
                    </Panel>

                    {coin && !coin.supported && <Callout tone="neutral">{coin.reason}</Callout>}

                    {coin?.data && (
                        <>
                            <Panel title={`${coin.data.name} (${coin.data.symbol})`} className="mt-4">
                                <Row label="Market cap" value={coin.data.marketCapUsd == null ? '—' : `$${fmtCompact(coin.data.marketCapUsd)}`} />
                                <Row label="Circulating supply" value={coin.data.circulatingSupply == null ? '—' : fmtCompact(coin.data.circulatingSupply)} />
                                <Row
                                    label="Maximum supply"
                                    value={coin.data.maxSupply == null ? 'uncapped' : fmtCompact(coin.data.maxSupply)}
                                    hint={coin.data.maxSupply == null ? 'no hard limit exists' : 'hard limit'}
                                />
                                <Row label="Total supply" value={coin.data.totalSupply == null ? '—' : fmtCompact(coin.data.totalSupply)} />
                                <Row label="Below all-time high" value={pct(coin.data.fromAllTimeHighPct)} />
                            </Panel>

                            {coin.data.categories.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {coin.data.categories.map((c) => <Badge key={c}>{c}</Badge>)}
                                </div>
                            )}

                            <p className="mt-3 text-xs text-faint">
                                <strong>Uncapped</strong> is a property, not a missing number. A token with no maximum
                                supply can be issued indefinitely, which is a different proposition from one that cannot.
                            </p>
                        </>
                    )}
                </div>
            )}
        </PageShell>
    );
}
