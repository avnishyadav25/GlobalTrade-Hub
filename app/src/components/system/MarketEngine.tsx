'use client';

import { useEffect } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { usePaperStore } from '@/stores/paperStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useUIStore } from '@/stores/uiStore';
import { equity, openOrders } from '@/lib/paperEngine';
import { getAsset } from '@/lib/mockData';
import { createBinanceFeed } from '@/lib/marketData/binance';
import { planPoll, type Cost } from '@/lib/marketData/priority';
import { useAlertStore } from '@/stores/alertStore';
import { evaluateAlerts } from '@/lib/alerts';
import { rsi as seriesRsi, rolling24h } from '@/stores/seriesStore';
import { toast } from 'sonner';

/**
 * Headless component: starts the live market source, matches resting paper
 * orders on every tick, and samples paper equity for the session curve.
 * Mounted once in the app shell.
 */
export function MarketEngine() {
    useEffect(() => {
        const market = useMarketStore.getState();

        // Real crypto feed on by default (Binance public WS); set the env to 'false' to
        // force pure simulation. Non-crypto instruments keep a light sim either way.
        if (process.env.NEXT_PUBLIC_ENABLE_BINANCE_FEED !== 'false') {
            try {
                market.attachFeed(createBinanceFeed);
            } catch {
                market.start();
            }
        } else {
            market.start();
        }

        let i = 0;
        const timer = setInterval(() => {
            const quotes = useMarketStore.getState().quotes;
            const paper = usePaperStore.getState();
            paper.tick(quotes);

            // Alerts. evaluateAlerts is pure and edge-triggered — see lib/alerts.ts.
            const alertStore = useAlertStore.getState();
            if (alertStore.alerts.length) {
                const { triggered, readings } = evaluateAlerts(alertStore.alerts, {
                    quotes,
                    rsi: (s) => seriesRsi(s),
                    range24h: (s) => rolling24h(s),
                });
                for (const t of triggered) {
                    alertStore.markTriggered(t.alert.id, Date.now());
                    toast.message('Alert', { description: t.message });
                    if (t.alert.notify) {
                        fetch('/api/notify', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ text: `🔔 ${t.message}`, subject: 'GlobalTrade Hub — alert' }),
                        }).catch(() => {});
                    }
                }
                // Record readings AFTER triggering so the next pass compares against this one.
                alertStore.recordReadings(readings);
            }
            if (i % 5 === 0) paper.sampleEquity(equity(usePaperStore.getState().state, quotes));
            i++;
        }, 1000);

        // Poll every market through the provider router.
        //
        // 60s, and PAUSED while the tab is hidden. The previous 15s unconditional poll
        // made 5,760 requests/day against an 800/day free tier and never backed off on
        // a 429 — only when the provider was unconfigured.
        //
        // The request now carries the user's OWN watchlist plus descriptors for
        // instruments the server cannot know about (the registry is client-only). It
        // used to send no symbols at all, so the server fell back to the 16 seeds and
        // a user-added instrument was never priced.
        let mdActive = true;
        let cursor = 0;

        const pollMarketData = async () => {
            if (document.visibilityState === 'hidden') return;

            // Read through getState(), never as selectors: allSymbols() returns a fresh
            // array on every call and as a selector it caused an infinite render loop.
            const wl = useWatchlistStore.getState();
            const paperState = usePaperStore.getState().state;
            const feedStatus = useMarketStore.getState().feedStatus;

            const costOf = (symbol: string): Cost => {
                const mkt = getAsset(symbol)?.market;
                const provider = mkt ? feedStatus[mkt]?.provider : undefined;
                // Assume the scarce provider until the server tells us otherwise.
                return provider && provider !== 'yahoo' ? 'cheap' : 'scarce';
            };

            const plan = planPoll({
                selected: useUIStore.getState().selectedSymbol,
                positions: Object.keys(paperState.positions),
                restingOrders: openOrders(paperState).map((o) => o.symbol),
                alerts: useAlertStore.getState().alerts.filter((a) => a.enabled).map((a) => a.symbol),
                activeList: wl.lists.find((l) => l.id === wl.activeListId)?.symbols ?? [],
                all: wl.allSymbols(),
                costOf,
                cursor,
            });
            cursor = plan.cursor;
            if (!plan.symbols.length) return;

            try {
                const res = await fetch('/api/marketdata', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        symbols: plan.symbols,
                        instruments: wl.customInstruments.map((a) => ({
                            symbol: a.symbol,
                            market: a.market,
                            quoteCcy: a.quoteCcy,
                            price: a.price,
                        })),
                    }),
                });
                if (!res.ok) {
                    if (res.status === 401) mdActive = false;
                    return;
                }
                const data = await res.json();
                const market = useMarketStore.getState();
                // `q.at` is the UPSTREAM fetch time. Falling back to Date.now() here is
                // what made a cache-served price look freshly fetched.
                for (const q of data.quotes ?? []) market.applyQuote({ ...q, ts: q.at, real: true });
                market.setDeferred([...plan.deferred, ...(data.deferred ?? [])]);
                // USD/INR is not a tradeable instrument here — it is injected so
                // deriveFxRates() prices the ₹ book from a live rate instead of a constant.
                if (Number.isFinite(data?.fx?.usdInr)) {
                    market.applyQuote({ symbol: 'USD/INR', price: data.fx.usdInr });
                }
                if (data.status) {
                    const now = Date.now();
                    market.setFeedStatus(
                        Object.fromEntries(
                            Object.entries(data.status as Record<string, { provider: string; state: 'live' | 'delayed' | 'sim'; delayMinutes: number }>)
                                .map(([mkt, s]) => [mkt, { ...s, at: now }])
                        )
                    );
                }
            } catch {
                /* ignore; the sim keeps the board moving */
            }
        };
        pollMarketData();
        const mdTimer = setInterval(() => { if (mdActive) pollMarketData(); }, 60000);
        // Refresh promptly when the user comes back rather than waiting out the interval.
        const onVisible = () => { if (mdActive && document.visibilityState === 'visible') pollMarketData(); };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            clearInterval(timer);
            clearInterval(mdTimer);
            document.removeEventListener('visibilitychange', onVisible);
            useMarketStore.getState().stop();
            useMarketStore.getState().detachFeed();
        };
    }, []);

    return null;
}
