// Number / currency formatting helpers (AxisOne style)

import { MARKET_CURRENCY, type Market } from './constants';

export function fmtNum(n: number, decimals = 2): string {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Price formatted with a sensible number of decimals for its magnitude. */
export function fmtPrice(n: number): string {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const decimals = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function currencySymbol(currency: 'USD' | 'INR'): string {
  return currency === 'INR' ? '₹' : '$';
}

export function marketCurrency(market: Market): 'USD' | 'INR' {
  return MARKET_CURRENCY[market] ?? 'USD';
}

/** Money with currency symbol; INR uses the en-IN grouping. */
export function fmtMoney(n: number, currency: 'USD' | 'INR' = 'USD', decimals = 2): string {
  if (!isFinite(n)) return '—';
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return (
    currencySymbol(currency) +
    n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  );
}

/** Signed money, e.g. +$1,240.00 / −₹640 */
export function fmtSigned(n: number, currency: 'USD' | 'INR' = 'USD', decimals = 2): string {
  const sign = n >= 0 ? '+' : '−';
  return sign + fmtMoney(Math.abs(n), currency, decimals);
}

export function fmtPct(n: number, decimals = 2): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}%`;
}

/** Compact large numbers: 1.2B, 847M, 28K */
export function fmtCompact(n: number): string {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

/** Indian compact (lakh/crore): 18.4L, 3.2Cr */
export function fmtCompactINR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (n / 1e7).toFixed(1) + 'Cr';
  if (abs >= 1e5) return '₹' + (n / 1e5).toFixed(1) + 'L';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
