import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { companyFundamentals, finnhubFundamentalsConfigured } from './finnhubFundamentals';
import { noteSuccess } from '../cache';

// No network here: `fetch` is stubbed and every payload is a hand-written fixture
// copied from a real Finnhub response.
//
// Two pieces of module-global state leak between tests and are handled explicitly:
//   * the response cache is keyed by symbol, so every test uses its own ticker;
//   * the circuit breaker is keyed by provider id — 'finnhub', shared with the live
//     quote feed — so the failure count is cleared before each test, otherwise the
//     failure-path tests would open the circuit for whichever test ran next.

interface StubResponse {
    ok: boolean;
    json(): Promise<unknown>;
}

const ok = (body: unknown): StubResponse => ({ ok: true, json: async () => body });
const upstreamError = (): StubResponse => ({ ok: false, json: async () => ({ error: 'API limit reached' }) });

function stubFetch(handler: (url: string) => StubResponse) {
    const mock = vi.fn(async (input: unknown) => handler(String(input)));
    vi.stubGlobal('fetch', mock);
    return mock;
}

const isMetric = (url: string) => url.includes('/stock/metric');

/** Trimmed from a real `metric=all` response — the fields this module reads, plus
 *  enough of the ones it ignores to prove it ignores them. */
const AAPL_METRIC = {
    '10DayAverageTradingVolume': 54.12,
    '52WeekHigh': 268.19,
    '52WeekHighDate': '2026-02-11',
    '52WeekLow': 169.21,
    '52WeekLowDate': '2025-08-05',
    beta: 1.1993,
    currentRatioAnnual: 0.8673,
    currentRatioQuarterly: 0.9236,
    dividendYieldIndicatedAnnual: 0.4012,
    epsGrowthTTMYoy: 12.44,
    grossMarginAnnual: 46.21,
    grossMarginTTM: 46.83,
    marketCapitalization: 3841562.5,
    netProfitMarginAnnual: 24.3,
    netProfitMarginTTM: 26.44,
    pbAnnual: 51.34,
    pbQuarterly: 57.62,
    peTTM: 34.72,
    psTTM: 9.14,
    quickRatioQuarterly: 0.7841,
    revenueGrowthQuarterlyYoy: 7.81,
    revenueGrowthTTMYoy: 6.35,
    roaTTM: 28.16,
    roeTTM: 137.18,
    'totalDebt/totalEquityAnnual': 1.8723,
    'totalDebt/totalEquityQuarterly': 1.4459,
};

const metricBody = (metric: Record<string, unknown>) => ({
    metric,
    metricType: 'all',
    series: { annual: {}, quarterly: {} },
    symbol: 'AAPL',
});

const AAPL_PROFILE = {
    country: 'US',
    currency: 'USD',
    estimateCurrency: 'USD',
    exchange: 'NASDAQ NMS - GLOBAL MARKET',
    finnhubIndustry: 'Technology',
    ipo: '1980-12-12',
    logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png',
    marketCapitalization: 3841562.5,
    name: 'Apple Inc',
    phone: '14089961010',
    shareOutstanding: 14840.39,
    ticker: 'AAPL',
    weburl: 'https://www.apple.com/',
};

beforeEach(() => {
    vi.stubEnv('FINNHUB_API_KEY', 'test-token');
    noteSuccess('finnhub');
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('companyFundamentals', () => {
    it('maps a realistic metric + profile2 pair onto the typed shape', async () => {
        const mock = stubFetch((url) => ok(isMetric(url) ? metricBody(AAPL_METRIC) : AAPL_PROFILE));

        const got = await companyFundamentals('AAPL');

        expect(got).toEqual({
            symbol: 'AAPL',
            name: 'Apple Inc',
            industry: 'Technology',
            // Finnhub reports 3,841,562.5 MILLION; a pass-through would render the
            // largest company in the world as a $3.8m microcap.
            marketCap: 3_841_562_500_000,
            peTTM: 34.72,
            pbTTM: 57.62,
            roeTTM: 137.18,
            roaTTM: 28.16,
            grossMarginTTM: 46.83,
            netMarginTTM: 26.44,
            debtToEquity: 1.4459,
            currentRatio: 0.9236,
            revenueGrowthTTM: 6.35,
            dividendYield: 0.4012,
            week52High: 268.19,
            week52Low: 169.21,
        });

        const urls = mock.mock.calls.map((c) => String(c[0]));
        expect(urls.some((u) => u.includes('/stock/metric?symbol=AAPL&metric=all&token=test-token'))).toBe(true);
        expect(urls.some((u) => u.includes('/stock/profile2?symbol=AAPL&token=test-token'))).toBe(true);
    });

    it('keeps a null or omitted ratio null rather than defaulting it to zero', async () => {
        // Finnhub does both: it sends explicit nulls for some fields and omits others
        // entirely. A loss-making company with no P/E must not read as a P/E of 0.
        const mock = stubFetch((url) =>
            ok(
                isMetric(url)
                    ? metricBody({
                          '52WeekHigh': 41.02,
                          '52WeekLow': 12.87,
                          peTTM: null,
                          pbQuarterly: 3.11,
                          netProfitMarginTTM: -18.44,
                          roeTTM: -22.7,
                      })
                    : { ...AAPL_PROFILE, name: 'Rivian Automotive Inc', ticker: 'RIVN', marketCapitalization: 18422.6 }
            )
        );

        const got = await companyFundamentals('RIVN');

        expect(mock).toHaveBeenCalledTimes(2);
        expect(got).toMatchObject({
            symbol: 'RIVN',
            peTTM: null,
            roaTTM: null,
            grossMarginTTM: null,
            currentRatio: null,
            debtToEquity: null,
            revenueGrowthTTM: null,
            dividendYield: null,
            // Real negatives survive; only absence becomes null.
            netMarginTTM: -18.44,
            roeTTM: -22.7,
            pbTTM: 3.11,
        });
    });

    it('falls back to the annual figure only where Finnhub publishes no quarterly one', async () => {
        stubFetch((url) =>
            ok(
                isMetric(url)
                    ? metricBody({
                          pbAnnual: 8.4,
                          currentRatioAnnual: 1.62,
                          'totalDebt/totalEquityAnnual': 0.94,
                      })
                    : { ...AAPL_PROFILE, name: 'Oracle Corp', ticker: 'ORCL' }
            )
        );

        const got = await companyFundamentals('ORCL');

        expect(got).toMatchObject({ pbTTM: 8.4, currentRatio: 1.62, debtToEquity: 0.94 });
    });

    it('takes market cap from profile2 when the metric block omits it', async () => {
        stubFetch((url) =>
            ok(
                isMetric(url)
                    ? metricBody({ peTTM: 28.9 })
                    : { ...AAPL_PROFILE, name: 'Adobe Inc', ticker: 'ADBE', marketCapitalization: 214730.75 }
            )
        );

        const got = await companyFundamentals('ADBE');

        expect(got).toMatchObject({ name: 'Adobe Inc', marketCap: 214_730_750_000, peTTM: 28.9 });
    });

    it('returns the ratios with a null name when only the profile call fails', async () => {
        // A partial answer beats no answer: the P/E is real either way, and `name`
        // being null is the honest way to say the profile did not arrive.
        stubFetch((url) => (isMetric(url) ? ok(metricBody({ peTTM: 19.6, roeTTM: 31.2 })) : upstreamError()));

        const got = await companyFundamentals('CRM');

        expect(got).toMatchObject({ symbol: 'CRM', name: null, industry: null, marketCap: null, peTTM: 19.6 });
    });

    it('returns null when both upstream calls fail, rather than an object of nulls', async () => {
        // An all-null object renders identically to "this company has no debt and no
        // earnings". Nothing known has to be a distinguishable state.
        stubFetch(() => upstreamError());

        expect(await companyFundamentals('AMZN')).toBeNull();
    });

    it('returns null for an empty profile2 body and an empty metric block', async () => {
        // 200 with `{}` is what Finnhub answers for a symbol it does not cover.
        stubFetch((url) => ok(isMetric(url) ? { metric: {}, metricType: 'all' } : {}));

        const got = await companyFundamentals('ZZZZ');

        // The metric block is present but empty, so this is an answer, not a failure:
        // every ratio is null and the symbol echoes back.
        expect(got).toMatchObject({ symbol: 'ZZZZ', name: null, peTTM: null, marketCap: null });
    });

    it('rejects a symbol Finnhub cannot serve without spending an upstream call', async () => {
        const mock = stubFetch(() => ok(metricBody(AAPL_METRIC)));

        // Free-tier Finnhub has no Indian coverage, and no free provider does. The
        // 403 would count against a circuit breaker shared with the US quote feed.
        expect(await companyFundamentals('RELIANCE.NS')).toBeNull();
        expect(await companyFundamentals('NIFTY 50')).toBeNull();
        expect(await companyFundamentals('')).toBeNull();
        expect(mock).not.toHaveBeenCalled();
    });
});

describe('when FINNHUB_API_KEY is absent', () => {
    it('reports itself unconfigured and returns null without calling upstream', async () => {
        vi.stubEnv('FINNHUB_API_KEY', undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const mock = stubFetch(() => ok(metricBody(AAPL_METRIC)));

        expect(finnhubFundamentalsConfigured()).toBe(false);
        expect(await companyFundamentals('AAPL')).toBeNull();
        expect(mock).not.toHaveBeenCalled();
    });

    it('reports itself configured once the key is present', () => {
        expect(finnhubFundamentalsConfigured()).toBe(true);
    });
});
