import type { HM, YMD } from '@/store/types';
import { hmToMin, pad } from './time';

export function formatTime(hm: HM, fmt: '12h' | '24h') {
  if (fmt === '24h') return hm;
  const m = hmToMin(hm);
  const h = Math.floor(m / 60);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${pad(m % 60)} ${suffix}`;
}

/** 7h 30m · 45m · 8h */
export function formatDuration(min: number) {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export const formatHours = (min: number) => `${(Math.round((min / 60) * 10) / 10).toLocaleString()}h`;

const fmtCache = new Map<string, Intl.NumberFormat>();
export function formatMoney(amount: number, currency: string, opts: { compact?: boolean } = {}) {
  const key = `${currency}${opts.compact}`;
  let f = fmtCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        // currency's own minor units (USD 2, VND/JPY 0) unless compact
        ...(opts.compact ? { maximumFractionDigits: 0, minimumFractionDigits: 0 } : {}),
      });
    } catch {
      f = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    }
    fmtCache.set(key, f);
  }
  return f.format(amount);
}

const ymdDate = (ymd: YMD) => new Date(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10), 12);

export const formatDate = (ymd: YMD, o: Intl.DateTimeFormatOptions) => ymdDate(ymd).toLocaleDateString(undefined, o);

export const formatRange = (a: YMD, b: YMD) =>
  `${formatDate(a, { month: 'short', day: 'numeric' })} – ${formatDate(b, { month: 'short', day: 'numeric' })}`;

/** "in 3h 12m", "in 2 days" */
export function formatCountdown(ms: number) {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return formatDuration(min);
  return `${Math.round(min / 1440)} days`;
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'MXN', 'BRL', 'VND', 'JPY', 'KRW', 'CNY', 'HKD', 'TWD', 'SGD', 'MYR', 'THB', 'PHP', 'IDR', 'INR', 'AED', 'ZAR'];
