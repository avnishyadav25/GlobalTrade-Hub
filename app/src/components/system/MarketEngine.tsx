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

        // Prefer a real crypto feed when explicitly enabled; else simulate.
        if (process.env.NEXT_PUBLIC_ENABLE_BINANCE_FEED === 'true') {
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

        return () => {
            clearInterval(timer);
            useMarketStore.getState().stop();
            useMarketStore.getState().detachFeed();
        };
    }, []);

    return null;
}
