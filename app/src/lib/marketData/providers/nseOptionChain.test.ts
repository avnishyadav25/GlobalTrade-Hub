import { describe, it, expect } from 'vitest';
import { expiryMonthKey, lotSizeFor, isOptionRoot, OPTION_ROOTS, type LotSizes } from './nseOptionChain';

// The network paths are not tested here — they hit an unofficial NSE endpoint and a test
// that fails when NSE is having a bad morning is a test people learn to ignore. What IS
// tested is every pure decision that sits between the response and an order: which
// symbols are covered, and which lot size applies to which expiry. Those are the parts
// that would silently mis-size a trade.

describe('covered symbols', () => {
    it('accepts only the two index roots', () => {
        expect(isOptionRoot('NIFTY')).toBe(true);
        expect(isOptionRoot('BANKNIFTY')).toBe(true);
        // Stock options settle PHYSICALLY and are American — a completely different
        // engine. Accepting one here would promise something that is not built.
        expect(isOptionRoot('RELIANCE')).toBe(false);
        expect(isOptionRoot('FINNIFTY')).toBe(false);
        expect(isOptionRoot('')).toBe(false);
        expect(OPTION_ROOTS).toHaveLength(2);
    });
});

describe('expiry to contract-master column', () => {
    it('maps NSE expiry strings onto the CSV header format', () => {
        expect(expiryMonthKey('11-Aug-2026')).toBe('AUG-26');
        expect(expiryMonthKey('1-Sep-2026')).toBe('SEP-26');
        expect(expiryMonthKey('29-Dec-2026')).toBe('DEC-26');
        expect(expiryMonthKey('30-Mar-2027')).toBe('MAR-27');
    });

    it('returns null rather than guessing at an unexpected format', () => {
        expect(expiryMonthKey('2026-08-11')).toBeNull();
        expect(expiryMonthKey('Aug 2026')).toBeNull();
        expect(expiryMonthKey('')).toBeNull();
    });
});

describe('lot size selection', () => {
    // Shaped like the real file: per-expiry columns, because SEBI revisions take effect
    // from a future expiry rather than all at once.
    const sizes: LotSizes = {
        byExpiryMonth: { 'AUG-26': 65, 'SEP-26': 65, 'DEC-26': 50 },
        nearest: 65,
    };

    it('picks the size for the expiry actually being traded', () => {
        expect(lotSizeFor(sizes, '11-Aug-2026')).toBe(65);
        // A revision that takes effect in December must not be applied to an August
        // contract, and vice versa. This is the whole reason the file is parsed rather
        // than a constant being hardcoded.
        expect(lotSizeFor(sizes, '29-Dec-2026')).toBe(50);
    });

    it('falls back to the nearest column for an expiry the master does not list', () => {
        expect(lotSizeFor(sizes, '30-Mar-2027')).toBe(65);
    });

    it('returns null when the master could not be read, rather than a plausible guess', () => {
        // A wrong lot size mis-sizes every order by a whole multiple. Refusing to size
        // is recoverable; guessing 75 when it is 65 is not.
        expect(lotSizeFor(null, '11-Aug-2026')).toBeNull();
        expect(lotSizeFor({ byExpiryMonth: {}, nearest: null }, '11-Aug-2026')).toBeNull();
    });
});
