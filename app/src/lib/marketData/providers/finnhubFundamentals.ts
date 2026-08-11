import 'server-only';
import { cachedFetch } from '../cache';

// Finnhub company fundamentals: /stock/metric?metric=all plus /stock/profile2.
//
// SCOPE — US LISTINGS ONLY. Finnhub's free tier answers 403 for Indian tickers, and
// there is no free source to fall through to: Alpha Vantage's OVERVIEW endpoint
// returns `{}` for RELIANCE.BSE (verified), so an India fundamentals chain would be
// a chain of nothing. Pointing an Indian symbol at this module yields null, never
// numbers. The surface that calls it must say "not available for this market"
// rather than render an empty table, which reads as "this company has no debt and
// no earnings".
//
// Units, because getting these wrong is silent and expensive:
//   * `marketCap` is normalised to base units HERE. Finnhub reports it in millions,
//     so passing the raw value through renders a $3.8tn company as $3.8m.
//   * margins, returns and growth are PERCENTAGES exactly as Finnhub reports them
//     (`roeTTM: 137.18` means 137.18%), not fractions. Do not scale them again.
//   * `debtToEquity` and `currentRatio` are plain ratios.
//   * the free tier is US-listed, so every currency-denominated field is USD.

// One token bucket per API KEY, not per endpoint: Finnhub's free allowance is
// account-wide, so this deliberately shares the `finnhub` provider id with the live
// quote feed in providers/finnhub.ts. Giving fundamentals its own id would double
// the permitted call rate against a limit that has not moved.
const PROVIDER = 'finnhub';
const LIMIT = { perMinute: 50 };

const SYMBOL_RE = /^[A-Z0-9.-]{1,15}$/;

// Exchange suffixes this app can produce that Finnhub is known not to cover. The
// list is the India book, not a world atlas — anything else uncovered still fails
// upstream. Screening them out is not cosmetic: an uncovered symbol answers 403,
// `cachedFetch` counts that as a provider failure, and the circuit breaker is shared
// with the live US quote feed, so three India lookups in a row would pause US quotes
// for five minutes.
const UNSUPPORTED_SUFFIX = /\.(NS|BO|BSE|NSE)$/;

interface MetricResponse {
    metric?: Record<string, unknown>;
}

interface Profile2Response {
    name?: unknown;
    finnhubIndustry?: unknown;
    marketCapitalization?: unknown;
}

/**
 * Separates "upstream answered, and has nothing for this symbol" from "upstream
 * failed". `cachedFetch` counts a null fetcher result as a provider failure, and
 * the circuit breaker behind it is shared with the live quote feed — so without
 * this wrapper, three uncovered symbols in a row would pause US quotes for five
 * minutes and cache nothing.
 */
interface Answer<T> {
    data: T | null;
}

export interface Fundamentals {
    symbol: string;
    name: string | null;
    industry: string | null;
    /** Base units of the listing currency (USD on the free tier) — not millions. */
    marketCap: number | null;
    peTTM: number | null;
    /**
     * Finnhub publishes no TTM price-to-book — book value is a balance-sheet
     * quantity, not a flow — so this carries `pbQuarterly`, falling back to
     * `pbAnnual`. The name follows the rest of the shape; the source does not.
     */
    pbTTM: number | null;
    /** Return on equity, percent. */
    roeTTM: number | null;
    /** Return on assets, percent. */
    roaTTM: number | null;
    /** Gross margin, percent. */
    grossMarginTTM: number | null;
    /** Net profit margin, percent. */
    netMarginTTM: number | null;
    /** Total debt / total equity, most recent quarter, falling back to the year. */
    debtToEquity: number | null;
    currentRatio: number | null;
    /** Trailing-twelve-month revenue growth year on year, percent. */
    revenueGrowthTTM: number | null;
    /**
     * Indicated annual dividend yield, percent. Null covers both "Finnhub has no
     * figure" and "this company pays no dividend" — the response does not
     * distinguish them, so neither does this.
     */
    dividendYield: number | null;
    week52High: number | null;
    week52Low: number | null;
}

let warnedUnconfigured = false;

function apiKey(): string | null {
    const key = process.env.FINNHUB_API_KEY;
    if (key) return key;
    if (!warnedUnconfigured) {
        warnedUnconfigured = true;
        console.warn('[marketdata] finnhub fundamentals not configured — set FINNHUB_API_KEY. No data will be returned.');
    }
    return null;
}

/**
 * False when FINNHUB_API_KEY is absent. Exposed so a caller can render an explicit
 * "not configured" state instead of an empty one, which would otherwise read as
 * "we looked and this company has no fundamentals".
 */
export function finnhubFundamentalsConfigured(): boolean {
    return Boolean(process.env.FINNHUB_API_KEY);
}

function num(value: unknown): number | null {
    // A missing P/E stays null. Coercing null or '' to 0 would place a fabricated
    // zero beside real numbers, and a 0 P/E reads as a real, extraordinary value.
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
    const s = typeof value === 'string' ? value.trim() : '';
    return s.length ? s : null;
}

/** First finite number among the given keys: Finnhub omits fields freely, and
 *  publishes some ratios only quarterly or only annually. */
function pick(metric: Record<string, unknown> | null, ...keys: string[]): number | null {
    if (!metric) return null;
    for (const key of keys) {
        const value = num(metric[key]);
        if (value !== null) return value;
    }
    return null;
}

/** Rejected here rather than upstream: a request Finnhub is certain to refuse still
 *  spends a token from the bucket the live quote feed shares. Uppercasing also
 *  collapses `aapl` and `AAPL` onto one cache entry. */
function normalizeSymbol(symbol: string): string | null {
    const s = symbol.trim().toUpperCase();
    if (!SYMBOL_RE.test(s) || UNSUPPORTED_SUFFIX.test(s)) return null;
    return s;
}

async function metricsFor(symbol: string, token: string): Promise<Record<string, unknown> | null> {
    // 6h rather than a day: the ratios only move on a filing, but 52-week high/low
    // move with the tape, and a day-old extreme is wrong the moment price breaks out.
    const answer = await cachedFetch<Answer<Record<string, unknown>>>(
        { provider: PROVIDER, key: `metric:${symbol}`, ttlMs: 6 * 3_600_000, limit: LIMIT },
        async () => {
            const res = await fetch(
                `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${token}`,
                { cache: 'no-store' }
            );
            if (!res.ok) return null;
            const body: MetricResponse | null = await res.json();
            const metric = body?.metric;
            // An empty `metric` block is Finnhub saying it has nothing for this
            // symbol. Passing it on would produce a row of dashes indistinguishable
            // from a company whose every ratio really is unpublished.
            const known = metric && typeof metric === 'object' && Object.keys(metric).length > 0;
            return { data: known ? metric : null };
        }
    );
    return answer?.data ?? null;
}

async function profileFor(symbol: string, token: string): Promise<Profile2Response | null> {
    // 24h: a company's name and industry effectively never change. Market cap does,
    // which is why it is read from the metric response first and only falls back here.
    const answer = await cachedFetch<Answer<Profile2Response>>(
        { provider: PROVIDER, key: `profile:${symbol}`, ttlMs: 24 * 3_600_000, limit: LIMIT },
        async () => {
            const res = await fetch(
                `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${token}`,
                { cache: 'no-store' }
            );
            if (!res.ok) return null;
            const body: Profile2Response | null = await res.json();
            // profile2 answers 200 `{}` for a symbol it does not cover.
            const known = body && typeof body === 'object' && Object.keys(body).length > 0;
            return { data: known ? body : null };
        }
    );
    return answer?.data ?? null;
}

/**
 * Fundamentals for a US-listed symbol, or null when nothing at all could be
 * fetched — no key, an unusable symbol, or both upstream calls failing.
 *
 * A partial answer is still returned: if the profile call fails but the metrics
 * land, `name` and `industry` come back null and the ratios are real. Every field
 * is independently nullable and null always means "not available", never zero.
 */
export async function companyFundamentals(symbol: string): Promise<Fundamentals | null> {
    const token = apiKey();
    if (!token) return null;

    const sym = normalizeSymbol(symbol);
    if (!sym) return null;

    const [metric, profile] = await Promise.all([metricsFor(sym, token), profileFor(sym, token)]);
    // Knowing nothing is a different state from knowing a company has no debt.
    // Returning an all-null object here would render identically to real zeroes.
    if (!metric && !profile) return null;

    const capMillions = pick(metric, 'marketCapitalization') ?? num(profile?.marketCapitalization);

    // Note the absence of annual fallbacks below for the fields Finnhub genuinely
    // publishes on a TTM basis. Substituting an annual figure into a field labelled
    // TTM is exactly the quiet mislabelling this codebase has been burned by before;
    // `pbTTM` is the one exception and it is documented on the type.
    return {
        symbol: sym,
        name: str(profile?.name),
        industry: str(profile?.finnhubIndustry),
        marketCap: capMillions === null ? null : capMillions * 1e6,
        peTTM: pick(metric, 'peTTM', 'peBasicExclExtraTTM', 'peExclExtraTTM'),
        pbTTM: pick(metric, 'pbQuarterly', 'pbAnnual'),
        roeTTM: pick(metric, 'roeTTM'),
        roaTTM: pick(metric, 'roaTTM'),
        grossMarginTTM: pick(metric, 'grossMarginTTM'),
        netMarginTTM: pick(metric, 'netProfitMarginTTM'),
        debtToEquity: pick(metric, 'totalDebt/totalEquityQuarterly', 'totalDebt/totalEquityAnnual'),
        currentRatio: pick(metric, 'currentRatioQuarterly', 'currentRatioAnnual'),
        revenueGrowthTTM: pick(metric, 'revenueGrowthTTMYoy'),
        dividendYield: pick(metric, 'dividendYieldIndicatedAnnual', 'currentDividendYieldTTM'),
        week52High: pick(metric, '52WeekHigh'),
        week52Low: pick(metric, '52WeekLow'),
    };
}
