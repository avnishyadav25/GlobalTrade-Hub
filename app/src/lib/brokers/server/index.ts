import 'server-only';
import type { BrokerConnector } from './types';
import { alpaca } from './alpaca';
import { binance } from './binance';
import { dhan } from './dhan';

const CONNECTORS: Record<string, BrokerConnector> = { alpaca, binance, dhan };

/**
 * Returns null for brokers with no implementation (zerodha, coinbase, ibkr,
 * marketdata). Callers must surface that as "not implemented" rather than
 * pretending the connection succeeded.
 */
export function getConnector(brokerId: string): BrokerConnector | null {
    return CONNECTORS[brokerId] ?? null;
}

export const IMPLEMENTED_BROKERS = Object.keys(CONNECTORS);
export type { BrokerConnector };
