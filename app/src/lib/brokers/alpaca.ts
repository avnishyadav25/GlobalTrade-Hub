/**
 * Alpaca API Stub - US Stocks Broker
 * 
 * This is a placeholder for the actual Alpaca API integration.
 * Official docs: https://docs.alpaca.markets/
 * 
 * Alpaca provides:
 * - Commission-free US stock trading
 * - Paper trading environment
 * - Real-time & historical market data
 */

import { BrokerAPI, Quote, OrderRequest, OrderResponse, Position, AccountInfo } from '../brokerApi';

const ALPACA_API_BASE = 'https://api.alpaca.markets/v2';
const ALPACA_PAPER_BASE = 'https://paper-api.alpaca.markets/v2';
const ALPACA_DATA_BASE = 'https://data.alpaca.markets/v2';

interface AlpacaCredentials {
    apiKeyId: string;
    secretKey: string;
    paper?: boolean;
}

export class AlpacaBroker implements BrokerAPI {
    name = 'Alpaca';
    market: 'india' | 'us' | 'crypto' = 'us';

    private credentials: AlpacaCredentials | null = null;
    private baseUrl = ALPACA_PAPER_BASE;

    isAuthenticated(): boolean {
        return this.credentials !== null;
    }

    async authenticate(credentials: Record<string, string>): Promise<boolean> {
        // TODO: Verify credentials with GET /account
        console.log('[Alpaca] Authentication requested');

        this.credentials = {
            apiKeyId: credentials.apiKeyId || '',
            secretKey: credentials.secretKey || '',
            paper: credentials.paper === 'true',
        };

        this.baseUrl = this.credentials.paper ? ALPACA_PAPER_BASE : ALPACA_API_BASE;

        return true;
    }

    async disconnect(): Promise<void> {
        this.credentials = null;
    }

    private getHeaders(): Record<string, string> {
        if (!this.credentials) throw new Error('Not authenticated');

        return {
            'APCA-API-KEY-ID': this.credentials.apiKeyId,
            'APCA-API-SECRET-KEY': this.credentials.secretKey,
        };
    }

    async getQuote(symbol: string): Promise<Quote> {
        // TODO: GET /stocks/{symbol}/quotes/latest
        console.log(`[Alpaca] Getting quote for ${symbol}`);

        throw new Error('Alpaca API not implemented - use MockBroker for development');
    }

    async getQuotes(symbols: string[]): Promise<Quote[]> {
        return Promise.all(symbols.map(s => this.getQuote(s)));
    }

    async placeOrder(order: OrderRequest): Promise<OrderResponse> {
        // TODO: POST /orders
        // {
        //   symbol, qty, side, type, time_in_force,
        //   limit_price, stop_price
        // }
        console.log(`[Alpaca] Placing order:`, order);

        throw new Error('Alpaca API not implemented - use MockBroker for development');
    }

    async cancelOrder(orderId: string): Promise<boolean> {
        // TODO: DELETE /orders/{orderId}
        console.log(`[Alpaca] Cancelling order ${orderId}`);

        throw new Error('Alpaca API not implemented');
    }

    async getOrder(orderId: string): Promise<OrderResponse> {
        // TODO: GET /orders/{orderId}
        throw new Error('Alpaca API not implemented');
    }

    async getOpenOrders(): Promise<OrderResponse[]> {
        // TODO: GET /orders?status=open
        throw new Error('Alpaca API not implemented');
    }

    async getOrderHistory(): Promise<OrderResponse[]> {
        // TODO: GET /orders?status=all
        throw new Error('Alpaca API not implemented');
    }

    async getPositions(): Promise<Position[]> {
        // TODO: GET /positions
        throw new Error('Alpaca API not implemented');
    }

    async getAccountInfo(): Promise<AccountInfo> {
        // TODO: GET /account
        throw new Error('Alpaca API not implemented');
    }
}

export const alpacaBroker = new AlpacaBroker();
