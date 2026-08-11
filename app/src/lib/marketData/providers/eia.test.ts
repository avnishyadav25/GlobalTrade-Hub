import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The TTL cache and rate buckets in ../cache are module-global by design, and this
// provider uses one fixed cache key, so tests cannot use the "unique provider id"
// trick cache.test.ts relies on. Resetting the module registry per test gives each
// case a clean cache instead.
async function loadEia() {
    vi.resetModules();
    return import('./eia');
}

const KEY = 'test-eia-key';
const ORIGINAL_KEY = process.env.EIA_API_KEY;

/** Week-ending date -> unix seconds, matching the provider's UTC-midnight convention. */
const t = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1000;

/**
 * A realistic EIA v2 envelope. Rows are newest-first, as the desc sort in the
 * request produces, and carry the full facet columns the real response includes so
 * the parser is exercised against more than the two fields it reads.
 */
function envelope(rows: { period: string; value: number | string | null }[]) {
    return {
        response: {
            total: '2795',
            dateFormat: 'YYYY-MM-DD',
            frequency: 'weekly',
            description: 'Weekly Petroleum Status Report — stocks',
            data: rows.map((r) => ({
                period: r.period,
                duoarea: 'NUS',
                'area-name': 'NA',
                product: 'EPC0',
                'product-name': 'Crude Oil',
                process: 'SAE',
                'process-name': 'Ending Stocks Excluding SPR',
                series: 'WCESTUS1',
                'series-description': 'U.S. Ending Stocks excluding SPR of Crude Oil (Thousand Barrels)',
                value: r.value,
                units: 'MBBL',
            })),
        },
        request: { command: '/v2/petroleum/stoc/wstk/data/', params: {} },
        apiVersion: '2.1.8',
    };
}

const FIVE_WEEKS = [
    { period: '2026-07-31', value: 419_004 },
    { period: '2026-07-24', value: 423_178 },
    { period: '2026-07-17', value: 417_205 },
    { period: '2026-07-10', value: 421_650 },
    { period: '2026-07-03', value: 418_912 },
];

function stubFetch(body: unknown, ok = true) {
    // Typed with the url parameter so the request itself can be asserted on.
    const mock = vi.fn(async (url: string) => ({ url, ok, status: ok ? 200 : 403, json: async () => body }));
    vi.stubGlobal('fetch', mock);
    return mock;
}

beforeEach(() => {
    process.env.EIA_API_KEY = KEY;
});

afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.EIA_API_KEY;
    else process.env.EIA_API_KEY = ORIGINAL_KEY;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('not configured', () => {
    it('reports unconfigured and returns null without touching the network', async () => {
        delete process.env.EIA_API_KEY;
        const fetchMock = stubFetch(envelope(FIVE_WEEKS));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const eia = await loadEia();

        expect(eia.eiaConfigured()).toBe(false);
        // Null, never an empty-but-plausible series and never a placeholder level.
        expect(await eia.crudeInventories(4)).toBeNull();
        expect(await eia.latestInventoryShock()).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
    });

    it('treats a blank key as unconfigured', async () => {
        process.env.EIA_API_KEY = '   ';
        const fetchMock = stubFetch(envelope(FIVE_WEEKS));
        const eia = await loadEia();

        expect(eia.eiaConfigured()).toBe(false);
        expect(await eia.crudeInventories(4)).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports configured once the key is present', async () => {
        const eia = await loadEia();
        expect(eia.eiaConfigured()).toBe(true);
    });
});

describe('crudeInventories', () => {
    it('parses a realistic payload into an oldest-first series with weekly changes', async () => {
        stubFetch(envelope(FIVE_WEEKS));
        const eia = await loadEia();

        expect(await eia.crudeInventories(5)).toEqual([
            { time: t('2026-07-03'), value: 418_912, changeFromPrior: null },
            { time: t('2026-07-10'), value: 421_650, changeFromPrior: 2_738 },
            { time: t('2026-07-17'), value: 417_205, changeFromPrior: -4_445 },
            { time: t('2026-07-24'), value: 423_178, changeFromPrior: 5_973 },
            { time: t('2026-07-31'), value: 419_004, changeFromPrior: -4_174 },
        ]);
    });

    it('gives the first week of a shortened window a real change, not a hole', async () => {
        stubFetch(envelope(FIVE_WEEKS));
        const eia = await loadEia();

        const got = await eia.crudeInventories(2);
        expect(got).toEqual([
            { time: t('2026-07-24'), value: 423_178, changeFromPrior: 5_973 },
            { time: t('2026-07-31'), value: 419_004, changeFromPrior: -4_174 },
        ]);
    });

    it('accepts numeric-string values, which some EIA routes return', async () => {
        stubFetch(envelope([
            { period: '2026-07-31', value: '419004' },
            { period: '2026-07-24', value: '423178' },
        ]));
        const eia = await loadEia();

        const got = await eia.crudeInventories(2);
        expect(got?.map((p) => p.value)).toEqual([423_178, 419_004]);
    });

    it('drops unusable rows and refuses to call the resulting gap a weekly change', async () => {
        stubFetch(envelope([
            { period: '2026-07-17', value: 417_205 },
            { period: '2026-07-10', value: null }, // withheld week
            { period: '2026-13-45', value: 999_999 }, // not a date
            { period: '2026-07-03', value: 418_912 },
        ]));
        const eia = await loadEia();

        // Once the withheld week is dropped, 03 Jul and 17 Jul sit next to each other.
        // Reporting -1,707 as a week-on-week move would misstate a fortnight as a week.
        expect(await eia.crudeInventories(5)).toEqual([
            { time: t('2026-07-03'), value: 418_912, changeFromPrior: null },
            { time: t('2026-07-17'), value: 417_205, changeFromPrior: null },
        ]);
    });

    it('returns null on an upstream error rather than an empty series', async () => {
        stubFetch({ error: 'invalid or missing api_key' }, false);
        const eia = await loadEia();

        expect(await eia.crudeInventories(4)).toBeNull();
    });

    it('returns null when the payload carries no usable rows', async () => {
        stubFetch(envelope([]));
        const eia = await loadEia();

        expect(await eia.crudeInventories(4)).toBeNull();
    });

    it('serves every window size from one cached upstream call', async () => {
        const fetchMock = stubFetch(envelope(FIVE_WEEKS));
        const eia = await loadEia();

        await eia.crudeInventories(2);
        await eia.crudeInventories(5);
        await eia.latestInventoryShock();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const url = String(fetchMock.mock.calls[0][0]);
        expect(url.startsWith('https://api.eia.gov/v2/petroleum/stoc/wstk/data/?')).toBe(true);
        expect(url).toContain(`api_key=${KEY}`);
        expect(url).toContain('frequency=weekly');
        expect(url).toContain(encodeURIComponent('facets[series][]'));
        expect(url).toContain('WCESTUS1');
        // Newest-first upstream, so `length` truncates the oldest weeks.
        expect(url).toContain(`${encodeURIComponent('sort[0][direction]')}=desc`);
    });
});

describe('latestInventoryShock', () => {
    it('reports the newest print with its change and percentage', async () => {
        stubFetch(envelope(FIVE_WEEKS));
        const eia = await loadEia();

        const shock = await eia.latestInventoryShock();
        expect(shock).toMatchObject({ time: t('2026-07-31'), value: 419_004, change: -4_174 });
        expect(shock?.changePct).toBeCloseTo((-4_174 / 423_178) * 100, 10);
    });

    it('returns null when only one week is available, rather than a zero change', async () => {
        stubFetch(envelope([{ period: '2026-07-31', value: 419_004 }]));
        const eia = await loadEia();

        expect(await eia.latestInventoryShock()).toBeNull();
    });

    it('returns null when the preceding week is missing', async () => {
        stubFetch(envelope([
            { period: '2026-07-31', value: 419_004 },
            { period: '2026-07-17', value: 417_205 },
        ]));
        const eia = await loadEia();

        expect(await eia.latestInventoryShock()).toBeNull();
    });
});
