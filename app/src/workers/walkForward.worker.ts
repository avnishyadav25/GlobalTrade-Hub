/// <reference lib="webworker" />

import { registerAllStrategies, strategyById } from '@/lib/strategies/defs';
import { runWalkForward, type ParamGrid, type WalkForwardProgress, type WalkForwardResult } from '@/lib/strategies/walkForward';
import type { Candle } from '@/lib/mockData';
import type { Market } from '@/lib/constants';
import type { Product } from '@/lib/charges';

// Walk-forward, off the main thread.
//
// This is the first worker in the app, and it exists for a measured reason rather than
// tidiness: a run is `folds × (combinations + 1)` full backtests — 1,600 at the defaults.
// Run inline, that freezes the tab for long enough that React never even paints the
// "working" state, because setState batches with the work that follows it in the same
// callback.
//
// THE BINDING CONSTRAINT: a `Strategy` carries functions (`onBar`, `warmup`,
// `normalise`) and structured clone cannot copy a function. So the strategy may not
// cross the boundary — only its `id` does, and this side resolves it from the registry.
// Importing `defs` self-registers the catalogue, so `strategyById` works here exactly as
// it does on the main thread.
//
// Cancellation is `worker.terminate()` from the caller. That is why there is no
// cancel-flag protocol: terminating is immediate and cannot leave a half-applied result,
// whereas a cooperative flag would be checked only between backtests anyway.

export interface WalkForwardRequest {
    strategyId: string;
    symbol: string;
    market: Market;
    bars: Candle[];
    /** Extra aligned series a pair or spread strategy declared, by role. */
    others?: Record<string, Candle[]>;
    barSeconds: number;
    startingCapital: number;
    grid: ParamGrid;
    folds?: number;
    trainFraction?: number;
    maxCombinations?: number;
    product?: Product;
    squareOff?: boolean;
}

export type WalkForwardResponse =
    | { kind: 'progress'; progress: WalkForwardProgress }
    | { kind: 'done'; result: WalkForwardResult }
    | { kind: 'error'; message: string };

registerAllStrategies();

const post = (msg: WalkForwardResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);

self.onmessage = (event: MessageEvent<WalkForwardRequest>) => {
    const req = event.data;

    try {
        const strategy = strategyById(req.strategyId);
        if (!strategy) {
            post({ kind: 'error', message: `Unknown strategy "${req.strategyId}".` });
            return;
        }

        // Progress is throttled by count, not by time: posting 1,600 messages would cost
        // more in structured clone and main-thread handling than the bar is worth.
        let lastPosted = -1;

        const result = runWalkForward({
            strategy,
            symbol: req.symbol,
            market: req.market,
            bars: req.bars,
            others: req.others,
            barSeconds: req.barSeconds,
            startingCapital: req.startingCapital,
            grid: req.grid,
            folds: req.folds,
            trainFraction: req.trainFraction,
            maxCombinations: req.maxCombinations,
            product: req.product,
            squareOff: req.squareOff,
            onProgress: (progress) => {
                const pct = Math.floor((progress.done / Math.max(1, progress.total)) * 100);
                if (pct === lastPosted && progress.phase !== 'testing') return;
                lastPosted = pct;
                post({ kind: 'progress', progress });
            },
        });

        post({ kind: 'done', result });
    } catch (e) {
        // A throw here would otherwise surface as a bare "error" event with no message,
        // which is indistinguishable from the worker failing to load at all.
        post({ kind: 'error', message: e instanceof Error ? e.message : 'The walk-forward run failed.' });
    }
};
