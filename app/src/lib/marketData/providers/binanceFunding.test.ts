import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    fundingHistory,
    currentFunding,
    annualisedCarry,
    fundingAvailability,
    BINANCE_PERP_SYMBOLS,
} from './binanceFunding';

// Shapes copied from live probes of fapi.binance.com — every field is a decimal string,
// and both timestamps are milliseconds.
const FUNDING_RATE_PAYLOAD = [
    { symbol: 'BTCUSDT', fundingTime: 1786204800000, fundingRate: '0.00005057' },
    { symbol: 'BTCUSDT', fundingTime: 1786233600000, fundingRate: '0.00010000' },
    { symbol: 'BTCUSDT', fundingTime: 1786262400000, fundingRate: '-0.00002314' },
    { symbol: 'BTCUSDT', fundingTime: 1786291200000, fundingRate: '0.00000000' },
];

const PREMIUM_INDEX_PAYLOAD = {
    symbol: 'BTCUSDT',
    markPrice: '118432.10000000',
    indexPrice: '118401.55274510',
    estimatedSettlePrice: '118395.02138261',
    lastFundingRate: '0.00005057',
    interestRate: '0.00010000',
    nextFundingTime: 1786320000000,
    time: 1786328123000,
};

let fetchMock: ReturnType<typeof vi.fn>;

/** The token bucket, response cache and circuit breaker in ../cache are module-global
 *  and there is no reset hook, so each test starts 20 minutes after the last one: past
 *  the longest TTL here (15 min), past the 5 min circuit cool-off, and past the minute
 *  window. Without this, a test asserting a failure path would open the circuit and the
 *  next test would get a null it never asked for. */
const START = 1_786_328_123_000;
let clock = START;

function ok(body: unknown) {
    return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
    clock += 20 * 60_000;
    vi.useFakeTimers();
    vi.setSystemTime(clock);
    // The cache logs a warning whenever it records a failure; several tests provoke one.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock = vi.fn(async () => ok(FUNDING_RATE_PAYLOAD));
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('fundingHistory', () => {
    it('parses a realistic fundingRate payload into unix-second points', async () => {
        const points = await fundingHistory('BTC/USDT', 4);

        expect(points).toEqual([
            { time: 1786204800, rate: 0.00005057 },
            { time: 1786233600, rate: 0.0001 },
            { time: 1786262400, rate: -0.00002314 },
            { time: 1786291200, rate: 0 },
        ]);

        const url = String(fetchMock.mock.calls[0][0]);
        expect(url).toBe('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=4');
    });

    it('drops rows it cannot parse instead of coercing them to a zero rate', async () => {
        // A zero rate means "carry is flat", which is a real reading — so a row with a
        // blank or absent rate has to disappear, not become 0.0.
        fetchMock.mockResolvedValue(
            ok([
                { symbol: 'BTCUSDT', fundingTime: 1786204800000, fundingRate: '0.00005057' },
                { symbol: 'BTCUSDT', fundingTime: 1786233600000, fundingRate: '' },
                { symbol: 'BTCUSDT', fundingTime: 1786262400000 },
                { symbol: 'BTCUSDT', fundingTime: null, fundingRate: '0.00003000' },
                { symbol: 'BTCUSDT', fundingTime: 1786291200000, fundingRate: 'n/a' },
                { symbol: 'BTCUSDT', fundingTime: 1786320000000, fundingRate: '-0.00001200' },
            ])
        );

        const points = await fundingHistory('BTC/USDT', 6);

        expect(points).toEqual([
            { time: 1786204800, rate: 0.00005057 },
            { time: 1786320000, rate: -0.000012 },
        ]);
    });

    it('sorts oldest first even if the payload arrives out of order', async () => {
        fetchMock.mockResolvedValue(ok([...FUNDING_RATE_PAYLOAD].reverse()));

        const points = await fundingHistory('BTC/USDT', 41);

        expect(points?.map((p) => p.time)).toEqual([1786204800, 1786233600, 1786262400, 1786291200]);
    });

    it('clamps the limit into the range Binance accepts', async () => {
        await fundingHistory('BTC/USDT', 5000);
        expect(String(fetchMock.mock.calls[0][0])).toContain('limit=1000');

        clock += 20 * 60_000;
        vi.setSystemTime(clock);
        await fundingHistory('BTC/USDT', 0);
        expect(String(fetchMock.mock.calls[1][0])).toContain('limit=1');
    });

    it('returns null on an error body rather than treating it as data', async () => {
        // fapi answers 451 in restricted regions and 400 for a bad symbol; both arrive
        // as an object, not the array a success returns.
        fetchMock.mockResolvedValue({
            ok: false,
            status: 451,
            json: async () => ({ code: 0, msg: 'Service unavailable from a restricted location.' }),
        });

        expect(await fundingHistory('BTC/USDT', 10)).toBeNull();
    });

    it('returns null when a 200 body is not the expected array', async () => {
        fetchMock.mockResolvedValue(ok({ code: -1121, msg: 'Invalid symbol.' }));

        expect(await fundingHistory('BTC/USDT', 11)).toBeNull();
    });

    it('returns null rather than an empty array when every row is unusable', async () => {
        fetchMock.mockResolvedValue(ok([{ symbol: 'BTCUSDT', fundingTime: 1786204800000, fundingRate: '' }]));

        // An empty array would be drawn as a flat line by a chart; null is refusable.
        expect(await fundingHistory('BTC/USDT', 12)).toBeNull();
    });

    it('serves a second identical request from the cache without calling upstream', async () => {
        await fundingHistory('BTC/USDT', 13);
        await fundingHistory('BTC/USDT', 13);

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe('currentFunding', () => {
    it('parses a realistic premiumIndex payload', async () => {
        fetchMock.mockResolvedValue(ok(PREMIUM_INDEX_PAYLOAD));

        expect(await currentFunding('ETH/USDT')).toEqual({
            rate: 0.00005057,
            nextFundingTime: 1786320000, // seconds, matching FundingPoint.time
            markPrice: 118432.1,
            indexPrice: 118401.5527451,
        });
        expect(String(fetchMock.mock.calls[0][0])).toBe(
            'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=ETHUSDT'
        );
    });

    it('returns null when any of the four fields is missing', async () => {
        const partial: Record<string, unknown> = { ...PREMIUM_INDEX_PAYLOAD };
        delete partial.lastFundingRate;
        fetchMock.mockResolvedValue(ok(partial));

        // Better no reading than a mark price paired with an invented rate.
        expect(await currentFunding('SOL/USDT')).toBeNull();
    });
});

describe('not configured', () => {
    it('reports the Binance feed being switched off and makes no upstream call', async () => {
        vi.stubEnv('NEXT_PUBLIC_ENABLE_BINANCE_FEED', 'false');

        expect(fundingAvailability('BTC/USDT')).toEqual({
            available: false,
            reason: 'feed-disabled',
            detail: expect.stringContaining('NEXT_PUBLIC_ENABLE_BINANCE_FEED=false'),
        });
        expect(await fundingHistory('BTC/USDT', 20)).toBeNull();
        expect(await currentFunding('BTC/USDT')).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports a symbol with no perpetual contract and makes no upstream call', async () => {
        expect(fundingAvailability('RELIANCE')).toEqual({
            available: false,
            reason: 'unsupported-symbol',
            detail: expect.stringContaining('no Binance perpetual contract'),
        });
        expect(await fundingHistory('RELIANCE', 21)).toBeNull();
        expect(await currentFunding('XAU/USD')).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('names a missing perpetual before a disabled feed, so the reason does not move', async () => {
        vi.stubEnv('NEXT_PUBLIC_ENABLE_BINANCE_FEED', 'false');

        expect(fundingAvailability('AAPL').available).toBe(false);
        expect(fundingAvailability('AAPL')).toMatchObject({ reason: 'unsupported-symbol' });
    });

    it('maps every supported symbol to a USDT perpetual', () => {
        expect(fundingAvailability('BTC/USDT')).toEqual({ available: true, perpSymbol: 'BTCUSDT' });
        for (const perp of Object.values(BINANCE_PERP_SYMBOLS)) {
            expect(perp).toMatch(/^[A-Z]+USDT$/);
        }
    });
});

describe('annualisedCarry', () => {
    it('annualises across three settlements a day, not one', () => {
        // 1bp per 8h interval -> 1095 intervals a year -> 10.95%.
        expect(annualisedCarry(0.0001)).toBeCloseTo(0.1095, 10);
        // The naive x365 would give 0.0365; this must be exactly 3x that.
        expect(annualisedCarry(0.0001)).toBeCloseTo(0.0001 * 365 * 3, 12);
    });

    it('keeps the sign, so a negative rate reads as shorts paying longs', () => {
        expect(annualisedCarry(-0.0002)).toBeCloseTo(-0.219, 10);
    });

    it('propagates NaN rather than substituting a neutral carry', () => {
        expect(Number.isNaN(annualisedCarry(NaN))).toBe(true);
    });
});
