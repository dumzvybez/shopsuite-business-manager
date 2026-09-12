/**
 * Locale-formatting helpers for ShopSuite.
 *
 * v3.1 — English only. Multi-currency support via currencies.ts.
 */

import { type Lang } from './i18n';
import { getCurrency } from './currencies';

export const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const SINHALA_MONTHS = ENGLISH_MONTHS;

export const ENGLISH_DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
];

export const SINHALA_DAYS = ENGLISH_DAYS;

function months(): string[] {
  return ENGLISH_MONTHS;
}

function days(): string[] {
  return ENGLISH_DAYS;
}

export function formatDate(dateStr: string, _lang: Lang = 'en'): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const m = months();
  const dy = days();
  return `${m[d.getMonth()]} ${d.getDate()}, ${dy[d.getDay()]}`;
}

export function formatDateShort(dateStr: string, _lang: Lang = 'en'): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const m = months();
  return `${m[d.getMonth()]} ${d.getDate()}`;
}

export function formatDateLong(dateStr: string, _lang: Lang = 'en'): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const m = months();
  return `${d.getFullYear()} ${m[d.getMonth()]} ${d.getDate()}`;
}

export function formatMonth(monthStr: string, _lang: Lang = 'en'): string {
  if (!monthStr) return '';
  const parts = monthStr.split('-').map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return monthStr;
  const [y, m] = parts;
  return `${months()[m - 1]} ${y}`;
}

export function formatNumber(n: number, decimals = 0): string {
  if (!isFinite(n)) return '0';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a bare quantity (stock, units sold, etc.) — a number with thousands
 * separators and NO unit suffix. Use this in table columns and stat cards
 * where the column header / label already conveys what is being counted.
 *
 * For "number + unit" contexts (e.g. inline prose), use formatQuantityWithUnit.
 */
export function formatQuantity(n: number): string {
  return formatNumber(n, 0);
}

/**
 * Format a quantity together with its unit label, e.g. "260 pcs", "12 dozen".
 * Use this only in inline prose / summaries where the unit adds clarity.
 * In tabular contexts prefer formatQuantity() alone.
 */
export function formatQuantityWithUnit(n: number, unit: string): string {
  const u = (unit || '').trim();
  return u ? `${formatQuantity(n)} ${u}` : formatQuantity(n);
}

/**
 * Format a monetary value using the user's selected currency.
 *
 * This is the SINGLE canonical currency formatter for the whole app.
 * It looks up the symbol, decimal count and symbol position from
 * currencies.ts. Changing Settings.currency instantly updates every call.
 *
 * Always pass the active currency code (from Settings.currency / useSettings).
 * Never hardcode a currency symbol ("LKR", "$", "Rs") in component code.
 */
export function formatCurrency(n: number, currencyCode = 'LKR'): string {
  const c = getCurrency(currencyCode);
  const formatted = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  });
  const sign = n < 0 ? '-' : '';
  return c.position === 'before'
    ? `${sign}${c.symbol} ${formatted}`
    : `${sign}${formatted} ${c.symbol}`;
}

export function relativeDayLabel(dateStr: string, today: string, lang: Lang = 'en'): string {
  if (dateStr === today) return 'Today';
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(today + 'T00:00:00');
  const delta = Math.round((t.getTime() - d.getTime()) / 86400000);
  if (delta === 1) return 'Yesterday';
  if (delta === 2) return 'Day before';
  return formatDate(dateStr, lang);
}
