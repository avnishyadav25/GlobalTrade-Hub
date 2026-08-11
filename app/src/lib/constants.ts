// Market and Trading Constants

export const MARKETS = {
  CRYPTO: 'crypto',
  INDIA: 'india',
  US: 'us',
  FOREX: 'forex',
  COMMODITY: 'commodity',
} as const;

export const MARKET_LABELS = {
  [MARKETS.CRYPTO]: 'Crypto',
  [MARKETS.INDIA]: 'NSE/BSE',
  [MARKETS.US]: 'NASDAQ/NYSE',
  [MARKETS.FOREX]: 'Forex',
  [MARKETS.COMMODITY]: 'Commodities',
} as const;

// Short tab labels used in the AxisOne watchlist (All / Crypto / India / US / FX / Comm)
export const MARKET_TABS = [
  { key: 'all', label: 'All' },
  { key: MARKETS.CRYPTO, label: 'Crypto' },
  { key: MARKETS.INDIA, label: 'India' },
  { key: MARKETS.US, label: 'US' },
  { key: MARKETS.FOREX, label: 'FX' },
  { key: MARKETS.COMMODITY, label: 'Comm' },
] as const;

// Currency each market quotes in (used for formatting)
export const MARKET_CURRENCY: Record<string, 'USD' | 'INR'> = {
  [MARKETS.CRYPTO]: 'USD',
  [MARKETS.INDIA]: 'INR',
  [MARKETS.US]: 'USD',
  [MARKETS.FOREX]: 'USD',
  [MARKETS.COMMODITY]: 'USD',
};

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

// AxisOne (Direction B — Terminal Dark) accent palette, mirrored in globals.css
export const COLORS = {
  profit: '#2fd47e',
  loss: '#ff5470',
  neutral: '#7a8494',
  primary: '#7c8cff',
  accent: '#7c8cff',
} as const;

// Top navigation sections
export interface NavItem {
  key: string;
  label: string;
  href: string;
  children?: { key: string; label: string; href: string }[];
}

/**
 * Six primaries with a per-section sub-nav. Thirteen flat entries would be unusable,
 * and the split mirrors how Kite separates Orders / Holdings / Funds.
 * `/paper` still resolves for deep links; it just left the primary bar.
 */
export const NAV_SECTIONS: NavItem[] = [
  {
    key: 'terminal', label: 'Terminal', href: '/terminal',
    children: [
      { key: 'chart', label: 'Chart', href: '/terminal' },
      { key: 'watchlists', label: 'Watchlists', href: '/watchlists' },
      { key: 'alerts', label: 'Alerts', href: '/alerts' },
      { key: 'scanner', label: 'Scanner', href: '/scanner' },
    ],
  },
  { key: 'orders', label: 'Orders', href: '/orders' },
  {
    key: 'portfolio', label: 'Portfolio', href: '/portfolio',
    children: [
      { key: 'overview', label: 'Overview', href: '/portfolio' },
      { key: 'holdings', label: 'Holdings', href: '/holdings' },
      { key: 'paper', label: 'Paper session', href: '/paper' },
    ],
  },
  { key: 'funds', label: 'Funds', href: '/funds' },
  {
    key: 'strategies', label: 'Strategies', href: '/strategies',
    children: [
      { key: 'library', label: 'Library', href: '/strategies' },
      { key: 'signals', label: 'Signals', href: '/signals' },
      { key: 'backtest', label: 'Backtest', href: '/backtest' },
    ],
  },
  {
    key: 'insights', label: 'Insights', href: '/insights',
    children: [
      { key: 'coach', label: 'Coach', href: '/insights' },
      { key: 'research', label: 'Research', href: '/research' },
      { key: 'agents', label: 'Agents', href: '/agents' },
    ],
  },
  { key: 'learn', label: 'Learn', href: '/learn' },
];

/** Which primary a path belongs to, for highlighting. */
export function sectionForPath(pathname: string): NavItem | undefined {
  return (
    NAV_SECTIONS.find((s) => s.children?.some((c) => c.href === pathname)) ??
    NAV_SECTIONS.find((s) => s.href === pathname) ??
    NAV_SECTIONS.find((s) => s.href !== '/' && pathname.startsWith(s.href))
  );
}

export type Market = typeof MARKETS[keyof typeof MARKETS];
export type OrderType = typeof ORDER_TYPES[keyof typeof ORDER_TYPES];
export type OrderSide = typeof ORDER_SIDES[keyof typeof ORDER_SIDES];
