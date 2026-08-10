// Catalog of supported broker/exchange connectors. Drives the Settings → Connections
// UI. Actual API calls are proxied server-side (app/api/brokers/*); credentials are
// posted to the server and never persisted in the browser.

import { MARKETS, type Market } from '@/lib/constants';

export interface CredentialField {
    key: string;
    label: string;
    type?: 'text' | 'password';
    placeholder?: string;
}

export interface BrokerDef {
    id: string;
    name: string;
    markets: Market[];
    modes: ('paper' | 'live')[];
    docsUrl: string;
    credentials: CredentialField[];
    note?: string;
}

export const BROKERS: BrokerDef[] = [
    {
        id: 'zerodha',
        name: 'Zerodha Kite',
        markets: [MARKETS.INDIA],
        modes: ['live'],
        docsUrl: 'https://kite.trade/docs/connect/v3/',
        credentials: [
            { key: 'apiKey', label: 'API Key' },
            { key: 'apiSecret', label: 'API Secret', type: 'password' },
            { key: 'accessToken', label: 'Access Token', type: 'password' },
        ],
        note: 'Kite Connect has no sandbox; use with a funded account carefully.',
    },
    {
        id: 'dhan',
        name: 'Dhan',
        markets: [MARKETS.INDIA],
        modes: ['paper', 'live'],
        docsUrl: 'https://dhanhq.co/docs/v2/',
        credentials: [
            { key: 'clientId', label: 'Client ID' },
            { key: 'accessToken', label: 'Access Token', type: 'password' },
        ],
    },
    {
        id: 'alpaca',
        name: 'Alpaca',
        markets: [MARKETS.US],
        modes: ['paper', 'live'],
        docsUrl: 'https://docs.alpaca.markets/',
        credentials: [
            { key: 'keyId', label: 'API Key ID' },
            { key: 'secretKey', label: 'Secret Key', type: 'password' },
        ],
        note: 'Alpaca offers a first-class paper endpoint with separate keys.',
    },
    {
        id: 'binance',
        name: 'Binance',
        markets: [MARKETS.CRYPTO],
        modes: ['paper', 'live'],
        docsUrl: 'https://binance-docs.github.io/apidocs/spot/en/',
        credentials: [
            { key: 'apiKey', label: 'API Key' },
            { key: 'apiSecret', label: 'API Secret', type: 'password' },
        ],
        note: 'Paper mode routes to the Binance Spot Testnet.',
    },
    {
        id: 'coinbase',
        name: 'Coinbase',
        markets: [MARKETS.CRYPTO],
        modes: ['paper', 'live'],
        docsUrl: 'https://docs.cdp.coinbase.com/',
        credentials: [
            { key: 'apiKey', label: 'API Key' },
            { key: 'apiSecret', label: 'API Secret', type: 'password' },
        ],
    },
    {
        id: 'ibkr',
        name: 'Interactive Brokers',
        markets: [MARKETS.US, MARKETS.FOREX, MARKETS.COMMODITY],
        modes: ['paper', 'live'],
        docsUrl: 'https://www.interactivebrokers.com/campus/ibkr-api-page/web-api/',
        credentials: [
            { key: 'gatewayUrl', label: 'Client Portal Gateway URL', placeholder: 'https://localhost:5000' },
        ],
        note: 'Requires a running IBKR Client Portal Gateway. Paper = IBKR paper account.',
    },
    {
        id: 'marketdata',
        name: 'Market-data provider (FX / Commodities)',
        markets: [MARKETS.FOREX, MARKETS.COMMODITY],
        modes: ['paper'],
        docsUrl: 'https://twelvedata.com/docs',
        credentials: [{ key: 'apiKey', label: 'Provider API Key', type: 'password' }],
        note: 'Supplies real FX & commodity quotes for the paper engine.',
    },
];

export function brokerById(id: string): BrokerDef | undefined {
    return BROKERS.find((b) => b.id === id);
}
