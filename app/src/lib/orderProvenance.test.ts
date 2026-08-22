import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { placeOrder, newPaperState, DEFAULT_FX } from './paperEngine';
import type { LiveQuote } from '@/stores/marketStore';

// Provenance has to hold at two levels: the engine must carry what it is told, and every
// caller must actually tell it. The second is the one that rots — a new screen gets added,
// nobody remembers the field, and the Orders screen quietly starts showing unattributed
// trades again.

const SRC = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
    }
    return out;
}

/** Extract each `place({ ... })` call, brace-balanced so multi-line calls are handled. */
function placeCalls(text: string): string[] {
    const calls: string[] = [];
    const re = /\bplace\(\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        let depth = 0;
        let i = m.index + m[0].length - 1; // at the '{'
        for (; i < text.length; i++) {
            if (text[i] === '{') depth++;
            else if (text[i] === '}') { depth--; if (depth === 0) break; }
        }
        calls.push(text.slice(m.index, i + 1));
    }
    return calls;
}

describe('every order records what placed it', () => {
    it('has at least one call site to check, so this test cannot pass vacuously', () => {
        const all = walk(SRC).flatMap((f) => placeCalls(readFileSync(f, 'utf8')));
        expect(all.length).toBeGreaterThan(3);
    });

    it('passes a source at every place() call site in the app', () => {
        const offenders: string[] = [];
        for (const file of walk(SRC)) {
            for (const call of placeCalls(readFileSync(file, 'utf8'))) {
                // Accepts shorthand (`source`) as well as `source:`; both genuinely
                // pass provenance, and only matching the colon form rejected a correct
                // call site the first time this ran.
                if (!/\bsource\s*[,:}]/.test(call)) {
                    offenders.push(`${file.replace(SRC, 'src')} :: ${call.slice(0, 90).replace(/\s+/g, ' ')}`);
                }
            }
        }
        expect(offenders, `place() without a source:\n${offenders.join('\n')}`).toEqual([]);
    });
});

describe('the engine carries provenance through', () => {
    const quote = (price: number): LiveQuote => ({
        symbol: 'RELIANCE', price, prevClose: price, change: 0, changePercent: 0,
        high: price, low: price, volume: 0, ts: 0, dir: null, real: true,
    });

    it('stamps a filled order with its source', () => {
        const { state } = placeOrder(
            newPaperState(500_000, 0),
            { symbol: 'RELIANCE', side: 'buy', type: 'market', qty: 10, source: { kind: 'strategy', strategyId: 'ma-crossover', instanceId: 'i1' } },
            quote(1327), DEFAULT_FX, 0
        );
        expect(state.orders[0].source).toEqual({ kind: 'strategy', strategyId: 'ma-crossover', instanceId: 'i1' });
    });

    it('stamps a REFUSED order too, which is the diagnostic that matters', () => {
        // "Which strategy keeps getting blocked, and by what" is the question /orders
        // exists to answer.
        const { state, result } = placeOrder(
            newPaperState(500_000, 0),
            { symbol: 'RELIANCE', side: 'buy', type: 'market', qty: 1e9, source: { kind: 'strategy', strategyId: 'rsi-2' } },
            quote(1327), DEFAULT_FX, 0
        );
        expect(result.status).toBe('rejected');
        expect(state.orders[0].source?.strategyId).toBe('rsi-2');
    });

    it('leaves an unattributed order unattributed rather than guessing', () => {
        const { state } = placeOrder(
            newPaperState(500_000, 0),
            { symbol: 'RELIANCE', side: 'buy', type: 'market', qty: 10 },
            quote(1327), DEFAULT_FX, 0
        );
        expect(state.orders[0].source).toBeUndefined();
    });
});
