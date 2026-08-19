import 'server-only';

// Server-side broker connectors.
//
// Stateless by design: every call takes its credentials as an argument. Serverless
// invocations don't share memory, so a stateful `isAuthenticated()` singleton (the
// shape of the deleted lib/brokerApi.ts) is meaningless here and goes stale.

export type BrokerMode = 'paper' | 'live';

export type Credentials = Record<string, string>;

export interface VerifyResult {
    ok: boolean;
    /** Broker-side account identifier, shown so the user can confirm the right account. */
    accountRef?: string;
    /** Human-readable failure reason. Never contains the credentials. */
    reason?: string;
}

export interface PlaceOrderRequest {
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit';
    qty: number;
    limitPrice?: number;
}

export interface PlaceOrderResult {
    ok: boolean;
    brokerOrderId?: string;
    status?: string;
    reason?: string;
}

export interface BrokerConnector {
    id: string;
    /** Does this connector support the requested mode at all? */
    supports(mode: BrokerMode): boolean;
    /** Authenticate against the venue. MUST make a real request. */
    verify(creds: Credentials, mode: BrokerMode): Promise<VerifyResult>;
    placeOrder(creds: Credentials, mode: BrokerMode, req: PlaceOrderRequest): Promise<PlaceOrderResult>;
    /**
     * Translate an app symbol (BTC/USDT, AAPL) into the venue's own. Returns null when
     * the instrument isn't tradeable there — without this every live order 400s.
     */
    toBrokerSymbol(symbol: string): string | null;
}

/** Read credentials from the server environment as a fallback for a given broker. */
export function envCredentials(brokerId: string): Credentials | null {
    const pick = (o: Credentials): Credentials | null =>
        Object.values(o).every((v) => v && v.length) ? o : null;

    switch (brokerId) {
        case 'alpaca':
            return pick({
                keyId: process.env.ALPACA_PAPER_TRADING_API_KEY ?? '',
                secretKey: process.env.ALPACA_PAPER_TRADING_SECRET_KEY ?? '',
            });
        case 'binance':
            return pick({
                apiKey: process.env.BINANCE_API_KEY ?? '',
                apiSecret: process.env.BINANCE_API_SECRET ?? '',
            });
        // Dhan's env pair (DHANHQ_API_KEY/_SECRET) is a PARTNER credential, not the
        // clientId + accessToken this connector needs, so there is no env fallback.
        default:
            return null;
    }
}
