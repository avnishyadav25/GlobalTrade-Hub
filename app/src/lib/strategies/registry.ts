import type { Family, Params, Strategy } from './types';
import { defaultParams, sanitiseParams } from './types';

// The strategy catalogue.
//
// Strategies register here and nowhere else: the backtester, the live runtime, the
// /strategies UI and the Learn cards all read from this one list, so a strategy cannot
// exist in one surface and be missing from another.

const registry = new Map<string, Strategy>();

export function register(...strategies: Strategy[]): void {
    for (const s of strategies) {
        if (registry.has(s.id)) {
            throw new Error(`Duplicate strategy id "${s.id}" — ids are used as stable keys in saved runs and signals.`);
        }
        registry.set(s.id, s);
    }
}

export function allStrategies(): Strategy[] {
    return [...registry.values()];
}

export function strategyById(id: string): Strategy | undefined {
    return registry.get(id);
}

export function strategiesForMarket(market: string): Strategy[] {
    return allStrategies().filter((s) => s.markets.includes(market as never));
}

export function strategiesByFamily(): Map<Family, Strategy[]> {
    const out = new Map<Family, Strategy[]>();
    for (const s of allStrategies()) out.set(s.family, [...(out.get(s.family) ?? []), s]);
    return out;
}

/** Strategies that can actually place an order here. */
export function executableStrategies(): Strategy[] {
    return allStrategies().filter((s) => !s.signalOnly);
}

export { defaultParams, sanitiseParams };
export type { Strategy, Params };

/** Test seam. Never call this from application code. */
export function __resetRegistry(): void {
    registry.clear();
}
