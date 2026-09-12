/**
 * ShopSuite v3.1 — Currency definitions.
 *
 * Currency is stored separately from values everywhere. The user's chosen
 * currency is in Settings.currency. All formatCurrency calls receive the
 * currency code and look up symbol + decimals here.
 */

export type CurrencyDef = {
  code: string;        // ISO 4217 code (e.g. 'LKR')
  symbol: string;      // display symbol (e.g. 'Rs')
  name: string;        // display name (e.g. 'Sri Lankan Rupee')
  decimals: number;    // number of decimal places to show
  position: 'before' | 'after';  // symbol position relative to amount
};

export const CURRENCIES: CurrencyDef[] = [
  { code: 'LKR', symbol: 'Rs',     name: 'Sri Lankan Rupee',   decimals: 2, position: 'before' },
  { code: 'USD', symbol: '$',      name: 'US Dollar',          decimals: 2, position: 'before' },
  { code: 'EUR', symbol: '€',      name: 'Euro',               decimals: 2, position: 'before' },
  { code: 'GBP', symbol: '£',      name: 'British Pound',      decimals: 2, position: 'before' },
  { code: 'INR', symbol: '₹',      name: 'Indian Rupee',       decimals: 2, position: 'before' },
  { code: 'AUD', symbol: 'A$',     name: 'Australian Dollar',  decimals: 2, position: 'before' },
  { code: 'CAD', symbol: 'C$',     name: 'Canadian Dollar',    decimals: 2, position: 'before' },
  { code: 'JPY', symbol: '¥',      name: 'Japanese Yen',       decimals: 0, position: 'before' },
  { code: 'SGD', symbol: 'S$',     name: 'Singapore Dollar',   decimals: 2, position: 'before' },
];

export function getCurrency(code: string): CurrencyDef {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}

/**
 * Return the number of decimal places a currency should display.
 * Used by CSV/Excel exports and any code that needs raw numeric formatting
 * aligned to the active currency (e.g. JPY = 0 decimals, LKR = 2).
 */
export function currencyDecimals(code: string): number {
  return getCurrency(code).decimals;
}
