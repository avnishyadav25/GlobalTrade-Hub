'use client';

import { useEffect } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { usePaperStore } from '@/stores/paperStore';
import { equity } from '@/lib/paperEngine';
import { createBinanceFeed } from '@/lib/marketData/binance';

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
            if (i % 5 === 0) paper.sampleEquity(equity(usePaperStore.getState().state, quotes));
            i++;
        }, 1000);

        // Poll the FX/commodity provider (server-side key); no-op if unconfigured.
        let mdActive = true;
        const pollMarketData = async () => {
            try {
                const res = await fetch('/api/marketdata');
                const data = await res.json();
                if (data.configured && Array.isArray(data.quotes)) {
                    for (const q of data.quotes) useMarketStore.getState().applyQuote(q);
                } else {
                    mdActive = false; // stop polling if provider not configured
                }
            } catch {
                /* ignore */
            }
        };
        pollMarketData();
        const mdTimer = setInterval(() => { if (mdActive) pollMarketData(); }, 15000);

        return () => {
            clearInterval(timer);
            clearInterval(mdTimer);
            useMarketStore.getState().stop();
            useMarketStore.getState().detachFeed();
        };
    }, []);

    return null;
}
