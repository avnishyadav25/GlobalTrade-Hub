import { register } from '../registry';
import { BENCHMARK_STRATEGIES } from './benchmark';
import { TREND_STRATEGIES } from './trend';
import { MEAN_REVERSION_STRATEGIES } from './meanReversion';
import { SESSION_STRATEGIES } from './session';
import { SPREAD_STRATEGIES } from './spread';
import { VOLATILITY_STRATEGIES } from './volatility';
import { RANGE_STRATEGIES } from './range';
import { EVENT_STRATEGIES } from './event';

// The one place strategies are registered.
//
// Importing this module is what populates the catalogue — the backtester, the live
// runtime, the /strategies UI and the Learn cards all read from `registry`, and none of
// them see anything until this barrel has been imported. Anything that lists strategies
// must import from here rather than from `../registry` directly.

let done = false;

/** Idempotent: hot reload and repeated imports must not throw on duplicate ids. */
export function registerAllStrategies(): void {
    if (done) return;
    done = true;
    register(
        ...BENCHMARK_STRATEGIES,
        ...TREND_STRATEGIES,
        ...MEAN_REVERSION_STRATEGIES,
        ...SESSION_STRATEGIES,
        ...SPREAD_STRATEGIES,
        ...VOLATILITY_STRATEGIES,
        ...RANGE_STRATEGIES,
        ...EVENT_STRATEGIES,
    );
}

registerAllStrategies();

export * from '../registry';
