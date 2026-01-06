// Market and Trading Constants

export const MARKETS = {
  INDIA: 'india',
  US: 'us',
  CRYPTO: 'crypto',
} as const;

export const MARKET_LABELS = {
  [MARKETS.INDIA]: 'NSE/BSE',
  [MARKETS.US]: 'NASDAQ/NYSE',
  [MARKETS.CRYPTO]: 'Crypto',
} as const;

export const ORDER_TYPES = {
  MARKET: 'market',
  LIMIT: 'limit',
  STOP_LOSS: 'stop_loss',
  STOP_LIMIT: 'stop_limit',
} as const;

export const ORDER_SIDES = {
  BUY: 'buy',
  SELL: 'sell',
} as const;

export const TIMEFRAMES = [
  { label: '1m', value: '1m', seconds: 60 },
  { label: '5m', value: '5m', seconds: 300 },
  { label: '15m', value: '15m', seconds: 900 },
  { label: '1H', value: '1h', seconds: 3600 },
  { label: '4H', value: '4h', seconds: 14400 },
  { label: '1D', value: '1d', seconds: 86400 },
] as const;

export const COLORS = {
  profit: '#22c55e',
  loss: '#ef4444',
  neutral: '#6b7280',
  primary: '#6366f1',
  accent: '#8b5cf6',
} as const;

export type Market = typeof MARKETS[keyof typeof MARKETS];
export type OrderType = typeof ORDER_TYPES[keyof typeof ORDER_TYPES];
export type OrderSide = typeof ORDER_SIDES[keyof typeof ORDER_SIDES];
