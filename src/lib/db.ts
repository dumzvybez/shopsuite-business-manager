/**
 * Local offline-first data layer for Shop Manager.
 *
 * All data is stored in IndexedDB via the `idb` wrapper. Survives app close,
 * phone restart and app updates. No network calls anywhere.
 *
 * v3.0 — generalized product/item model (no longer egg-specific).
 *
 * Entities
 * --------
 *  - settings        : key/value (shopName, ownerName, currency, theme, tutorialDone, installDate, lastBackupAt, ...)
 *  - products        : the catalog of sellable items (replaces legacy 'categories')
 *  - priceSessions   : one per (date, productId, sessionIndex) — buy price, sell price, createdAt
 *  - sales           : one per sale line event (date, productId, sessionIndex, quantity, buyPrice, sellPrice, profit, createdAt)
 *  - dayRecords      : one per date — aggregated day summary, status (open|closed), lastEditedAt
 *  - credits         : customer credit records (active or paid)
 *  - creditPayments  : one per partial payment against a credit
 *  - suppliers       : supplier records (name, phone, notes)
 *  - supplierPurchases: purchases from suppliers (multi-line via purchaseGroupId)
 *  - supplierPayments : payments made to suppliers for purchases
 *  - inventory       : per-product current stock
 *  - expenses        : operating expenses (transport, electricity, bags, rent, other)
 *  - damages         : damaged / lost stock records (reduces inventory, affects profit)
 *  - stockMovements  : audit trail of every inventory change
 *  - editHistory     : audit log of all edits
 *  - backups         : auto-backup snapshots (latest 5 kept)
 *  - meta            : single-row table for app-level metadata
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { getCurrency, currencyDecimals } from './currencies';

// ---------- Types ----------

export type Product = {
  id: string;
  name: string;
  category: string;        // free-form category label, e.g. "Eggs", "Beverages", "Snacks"
  unit: string;            // e.g. "pcs", "kg", "dozen", "L"
  color: string;           // accent color (CSS)
  order: number;
  openingStock: number;
  purchasePrice: number;   // default per-unit buy price (used as fallback)
  sellingPrice: number;    // default per-unit sell price (used as fallback)
  reorderThreshold: number;// low-stock threshold
  createdAt: number;
};

/** Legacy alias for backward compatibility with old code paths. */
export type EggCategory = Product;

export type PriceSession = {
  id: string;
  date: string;            // YYYY-MM-DD
  productId: string;       // (was categoryId in v2 — same field name on legacy records)
  sessionIndex: number;
  buyPrice: number | null; // null = "Not available today"
  sellPrice: number | null;
  note?: string;
  createdAt: number;
};

export type Sale = {
  id: string;
  date: string;            // YYYY-MM-DD
  productId: string;
  sessionIndex: number;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  createdAt: number;
  note?: string;
};

export type DayStatus = 'open' | 'closed' | 'missing';

export type DayRecord = {
  date: string;
  status: DayStatus;
  totalItems: number;      // was totalEggs in v2
  totalBuy: number;
  totalSell: number;
  totalProfit: number;
  sessionCount: number;
  saleCount: number;
  totalDamageCost: number; // NEW v3 — sum of damage.totalCost for this date
  lastEditedAt: number;
  notes?: string;
};

export type EditHistoryEntry = {
  id: string;
  entity: 'sale' | 'priceSession' | 'dayRecord' | 'product' | 'settings' | 'credit' | 'supplier' | 'supplierPurchase' | 'supplierPayment' | 'inventory' | 'expense' | 'damage';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'mark-paid';
  summary: string;
  at: number;
};

/** Customer credit record. */
export type CreditRecord = {
  id: string;
  customerName: string;
  customerPhone?: string;
  // Multi-line items (NEW v3). Each item references a productId, quantity, unit sell price.
  items: { productId: string; name: string; quantity: number; unitPrice: number }[];
  // Legacy single-line fields (kept for backward-compat with v2 data and screens
  // that haven't been migrated to multi-line yet). When items[] is non-empty,
  // these are derived: totalQuantity = sum(items.quantity), unitPrice = items[0].unitPrice.
  productId?: string;       // legacy: first item's productId
  quantity?: number;        // legacy: total quantity across items
  sellPrice?: number;       // legacy: first item's unitPrice
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  status: 'active' | 'paid';
  purchaseDate: string;
  purchaseAt: number;
  paidAt?: number;
  note?: string;
};

export type CreditPayment = {
  id: string;
  creditId: string;
  customerName: string;
  amount: number;
  paymentDate: string;
  paidAt: number;
  note?: string;
};

export type Supplier = {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: number;
};

export type SupplierPurchase = {
  id: string;
  supplierId: string;
  productId: string;
  quantity: number;
  pricePerEgg: number;    // per-unit supplier price (legacy field name kept for migration)
  totalCost: number;
  paidAmount: number;
  remaining: number;
  status: 'active' | 'paid';
  purchaseDate: string;
  purchaseAt: number;
  paidAt?: number;
  purchaseGroupId?: string;
  note?: string;
};

export type SupplierPayment = {
  id: string;
  supplierId: string;
  purchaseId: string;
  amount: number;
  paymentDate: string;
  paidAt: number;
  note?: string;
};

export type Inventory = {
  productId: string;
  quantity: number;
  lastUpdated: number;
};

export type Expense = {
  id: string;
  category: 'transport' | 'electricity' | 'bags' | 'rent' | 'other';
  amount: number;
  date: string;
  note?: string;
  createdAt: number;
};

export type DamageRecord = {
  id: string;
  date: string;
  productId: string;
  quantity: number;
  pricePerEgg: number;   // per-unit cost at time of damage (legacy field name kept)
  totalCost: number;
  createdAt: number;
  note?: string;
};

export type StockMovement = {
  id: string;
  productId: string;
  changeType: 'added' | 'sold' | 'damaged' | 'returned';
  quantity: number;
  date: string;
  at: number;
  sourceType: 'supplier' | 'sale' | 'damage' | 'manual';
  sourceId?: string;
  supplierName?: string;
  remainingAfter: number;
};

export type Settings = {
  shopName: string;
  ownerName: string;
  shopPhone: string;
  shopAddress: string;
  shopType: string;          // e.g. "grocery", "convenience", "snack", "retail", "egg", "other"
  currency: string;          // default 'LKR' (ISO 4217 code)
  theme: 'light' | 'dark';   // legacy — superseded by themeId
  themeId: string;           // NEW v3.1 — theme preset id (see themes.ts)
  backgroundId: string;      // NEW v3.1 — background preset id (see themes.ts)
  tutorialDone: boolean;
  onboardingCompleted: boolean; // NEW v3.1 — true after first onboarding
  dailyPriceDoneDate: string | null;
  lastBackupAt: number | null;
  autoBackupEnabled: boolean;
  autoBackupFrequency: 'daily' | 'weekly' | 'manual'; // NEW v3.1
  lastAutoBackupAt: number | null; // NEW v3.1
  installDate: string | null;
  lastMonthEndPrompted: string | null;
  hintsDismissed: string[];
  // App Lock (NEW v3.1)
  appLockEnabled: boolean;
  appLockPin: string | null;       // 4-8 digit numeric PIN (stored locally only)
  appLockBiometric: boolean;       // use WebAuthn / device auth where available
  webauthnCredentialId: string | null; // base64-encoded WebAuthn credential ID for biometric unlock
  schemaVersion: number;
};

// ---------- DB Schema ----------

interface ShopDB extends DBSchema {
  settings: { key: string; value: any; };
  products: { key: string; value: Product; };
  priceSessions: {
    key: string;
    value: PriceSession;
    indexes: { 'by-date': string; 'by-date-product': [string, string] };
  };
  sales: {
    key: string;
    value: Sale;
    indexes: { 'by-date': string; 'by-date-product': [string, string] };
  };
  dayRecords: {
    key: string;
    value: DayRecord;
    indexes: { 'by-status': string };
  };
  credits: { key: string; value: CreditRecord; indexes: { 'by-status': string }; };
  creditPayments: {
    key: string;
    value: CreditPayment;
    indexes: { 'by-credit': string; 'by-paidAt': number };
  };
  suppliers: { key: string; value: Supplier; };
  supplierPurchases: {
    key: string;
    value: SupplierPurchase;
    indexes: { 'by-supplier': string; 'by-status': string; 'by-supplier-status': [string, string] };
  };
  supplierPayments: {
    key: string;
    value: SupplierPayment;
    indexes: { 'by-supplier': string; 'by-purchase': string };
  };
  inventory: { key: string; value: Inventory; };
  expenses: {
    key: string;
    value: Expense;
    indexes: { 'by-date': string; 'by-category': string };
  };
  damages: {
    key: string;
    value: DamageRecord;
    indexes: { 'by-date': string; 'by-product': string };
  };
  stockMovements: {
    key: string;
    value: StockMovement;
    indexes: { 'by-date': string; 'by-product': string };
  };
  editHistory: {
    key: string;
    value: EditHistoryEntry;
    indexes: { 'by-at': number };
  };
  backups: { key: string; value: { id: string; at: number; json: string }; };
  meta: { key: string; value: any; };
}

// ---------- Default data ----------

export const DEFAULT_SETTINGS: Settings = {
  shopName: '',
  ownerName: '',
  shopPhone: '',
  shopAddress: '',
  shopType: '',
  currency: 'LKR',
  theme: 'dark',
  themeId: 'modern-dark',
  backgroundId: 'default',
  tutorialDone: false,
  onboardingCompleted: false,
  dailyPriceDoneDate: null,
  lastBackupAt: null,
  autoBackupEnabled: false,
  autoBackupFrequency: 'daily',
  lastAutoBackupAt: null,
  installDate: null,
  lastMonthEndPrompted: null,
  hintsDismissed: [],
  appLockEnabled: false,
  appLockPin: null,
  appLockBiometric: false,
  webauthnCredentialId: null,
  schemaVersion: 8,
};

// Distinct colors for new products (cycled when user adds new ones)
export const PRODUCT_COLOR_PALETTE = [
  '#2563eb', '#16a34a', '#dc2626', '#ea580c', '#9333ea',
  '#0891b2', '#65a30d', '#db2777', '#0d9488', '#7c3aed',
  '#ca8a04', '#475569', '#059669', '#9f1239', '#1d4ed8',
];

// ---------- DB singleton ----------

let _db: Promise<IDBPDatabase<ShopDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<ShopDB>> {
  if (_db) return _db;
  _db = openDB<ShopDB>('shop-manager', 8, {
    upgrade(db, oldVersion) {
      // v1–6: legacy 'biththara-kade' schema. For a brand-new install we just
      // create the v7 shape directly. For an existing v1–6 install we MIGRATE
      // the data: rename 'categories' store into 'products', add missing
      // stores/indexes, and re-shape records.
      //
      // Migration strategy: open the existing db, copy 'categories' rows into
      // 'products' (adapting fields), keep all other stores as-is. Some legacy
      // fields (nameKey, name) are preserved; new fields (category, unit,
      // openingStock, purchasePrice, sellingPrice, reorderThreshold) get
      // sensible defaults.

      // v7: migrate from 'biththara-kade' v6 → 'shop-manager' v7
      if (oldVersion < 7) {
        // Create all stores with the v7 shape (idempotent — only creates if missing).
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('priceSessions')) {
          const s = db.createObjectStore('priceSessions', { keyPath: 'id' });
          s.createIndex('by-date', 'date');
          s.createIndex('by-date-product', ['date', 'productId']);
        }
        if (!db.objectStoreNames.contains('sales')) {
          const s = db.createObjectStore('sales', { keyPath: 'id' });
          s.createIndex('by-date', 'date');
          s.createIndex('by-date-product', ['date', 'productId']);
        }
        if (!db.objectStoreNames.contains('dayRecords')) {
          const s = db.createObjectStore('dayRecords', { keyPath: 'date' });
          s.createIndex('by-status', 'status');
        }
        if (!db.objectStoreNames.contains('credits')) {
          const s = db.createObjectStore('credits', { keyPath: 'id' });
          s.createIndex('by-status', 'status');
        }
        if (!db.objectStoreNames.contains('creditPayments')) {
          const s = db.createObjectStore('creditPayments', { keyPath: 'id' });
          s.createIndex('by-credit', 'creditId');
          s.createIndex('by-paidAt', 'paidAt');
        }
        if (!db.objectStoreNames.contains('suppliers')) {
          db.createObjectStore('suppliers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('supplierPurchases')) {
          const s = db.createObjectStore('supplierPurchases', { keyPath: 'id' });
          s.createIndex('by-supplier', 'supplierId');
          s.createIndex('by-status', 'status');
          s.createIndex('by-supplier-status', ['supplierId', 'status']);
        }
        if (!db.objectStoreNames.contains('supplierPayments')) {
          const s = db.createObjectStore('supplierPayments', { keyPath: 'id' });
          s.createIndex('by-supplier', 'supplierId');
          s.createIndex('by-purchase', 'purchaseId');
        }
        if (!db.objectStoreNames.contains('inventory')) {
          db.createObjectStore('inventory', { keyPath: 'productId' });
        }
        if (!db.objectStoreNames.contains('expenses')) {
          const s = db.createObjectStore('expenses', { keyPath: 'id' });
          s.createIndex('by-date', 'date');
          s.createIndex('by-category', 'category');
        }
        if (!db.objectStoreNames.contains('damages')) {
          const s = db.createObjectStore('damages', { keyPath: 'id' });
          s.createIndex('by-date', 'date');
          s.createIndex('by-product', 'productId');
        }
        if (!db.objectStoreNames.contains('stockMovements')) {
          const s = db.createObjectStore('stockMovements', { keyPath: 'id' });
          s.createIndex('by-date', 'date');
          s.createIndex('by-product', 'productId');
        }
        if (!db.objectStoreNames.contains('editHistory')) {
          const s = db.createObjectStore('editHistory', { keyPath: 'id' });
          s.createIndex('by-at', 'at');
        }
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');

        // NOTE: legacy v6 databases had stores named 'categories' instead of
        // 'products', and 'priceSessions'/'sales'/'damages'/'stockMovements'
        // indexes were keyed on 'categoryId' instead of 'productId'. Because
        // we are opening under a NEW db name ('shop-manager' vs 'biththara-kade'),
        // old data does NOT automatically carry over. Users who want to
        // preserve legacy data should use the Backup → Restore flow with a
        // JSON exported from the previous app version. For new installs,
        // the catalog simply starts empty.
      }
    },
  });
  return _db;
}

// ---------- Settings ----------

export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const stored = await db.get('settings', 'app');
  const merged = { ...DEFAULT_SETTINGS, ...(stored || {}) };
  if (!merged.installDate) {
    merged.installDate = todayStr();
    await db.put('settings', merged, 'app');
  }
  return merged;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const db = await getDB();
  const current = await getSettings();
  const next = { ...current, ...patch };
  await db.put('settings', next, 'app');
  // Mirror to localStorage for the pre-hydration theme bootstrap script.
  try {
    const mirror = {
      theme: next.theme,
      themeId: next.themeId,
      backgroundId: next.backgroundId,
      shopName: next.shopName,
      ownerName: next.ownerName,
      currency: next.currency,
      appLockEnabled: next.appLockEnabled,
    };
    localStorage.setItem('shop-manager-settings', JSON.stringify(mirror));
  } catch { /* ignore */ }
  return next;
}

/**
 * Format a monetary value using the user's configured currency.
 * Used internally for audit-log summaries and error messages so that
 * stored edit history reflects the actual currency symbol + decimals
 * (e.g. JPY shows 0 decimals, LKR shows 2). Falls back to a plain
 * number if settings cannot be read.
 */
async function fmtMoney(n: number): Promise<string> {
  try {
    const s = await getSettings();
    const c = getCurrency(s.currency);
    const formatted = Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: c.decimals,
      maximumFractionDigits: c.decimals,
    });
    const sign = n < 0 ? '-' : '';
    return c.position === 'before'
      ? `${sign}${c.symbol} ${formatted}`
      : `${sign}${formatted} ${c.symbol}`;
  } catch {
    return String(n);
  }
}

// ---------- Products ----------

export async function getProducts(): Promise<Product[]> {
  const db = await getDB();
  const all = await db.getAll('products');
  return all.sort((a, b) => a.order - b.order);
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const db = await getDB();
  return db.get('products', id);
}

export async function saveProduct(product: Product): Promise<void> {
  const db = await getDB();
  await db.put('products', product);
  // Ensure an inventory row exists
  const inv = await db.get('inventory', product.id);
  if (!inv) {
    await db.put('inventory', {
      productId: product.id,
      quantity: product.openingStock,
      lastUpdated: Date.now(),
    });
    if (product.openingStock > 0) {
      await recordStockMovement({
        id: genId(),
        productId: product.id,
        changeType: 'added',
        quantity: product.openingStock,
        date: todayStr(),
        at: Date.now(),
        sourceType: 'manual',
        remainingAfter: product.openingStock,
      });
    }
  }
  await addEditHistory({
    id: genId(),
    entity: 'product',
    entityId: product.id,
    action: 'create',
    summary: `Product saved: ${product.name}`,
    at: Date.now(),
  });
}

export async function updateProduct(product: Product): Promise<void> {
  const db = await getDB();
  await db.put('products', product);
  await addEditHistory({
    id: genId(),
    entity: 'product',
    entityId: product.id,
    action: 'update',
    summary: `Product updated: ${product.name}`,
    at: Date.now(),
  });
}

export async function deleteProduct(productId: string): Promise<void> {
  const db = await getDB();
  const p = await db.get('products', productId);
  await db.delete('products', productId);
  await db.delete('inventory', productId);
  await addEditHistory({
    id: genId(),
    entity: 'product',
    entityId: productId,
    action: 'delete',
    summary: `Product deleted: ${p?.name || productId}`,
    at: Date.now(),
  });
}

/** Legacy alias — old code called getCategories(). */
export async function getCategories(): Promise<Product[]> {
  return getProducts();
}

// ---------- Price sessions ----------

export async function getPriceSessionsForDate(date: string): Promise<PriceSession[]> {
  const db = await getDB();
  return db.getAllFromIndex('priceSessions', 'by-date', date);
}

export async function getPriceSessionsForDateRange(start: string, end: string): Promise<PriceSession[]> {
  const db = await getDB();
  const all = await db.getAll('priceSessions');
  return all.filter(s => s.date >= start && s.date <= end);
}

export async function getLatestPriceSessionForProduct(date: string, productId: string): Promise<PriceSession | null> {
  const sessions = await getPriceSessionsForDate(date);
  const filtered = sessions
    .filter(s => s.productId === productId || (s as any).categoryId === productId)
    .sort((a, b) => b.sessionIndex - a.sessionIndex);
  return filtered[0] || null;
}

/** Legacy alias. */
export async function getLatestPriceSessionForCategory(date: string, categoryId: string): Promise<PriceSession | null> {
  return getLatestPriceSessionForProduct(date, categoryId);
}

export async function isProductUnavailable(date: string, productId: string): Promise<boolean> {
  const latest = await getLatestPriceSessionForProduct(date, productId);
  if (!latest) return false;
  return latest.buyPrice == null && latest.sellPrice == null;
}

/** Legacy alias. */
export async function isCategoryUnavailable(date: string, categoryId: string): Promise<boolean> {
  return isProductUnavailable(date, categoryId);
}

export async function savePriceSession(session: PriceSession): Promise<void> {
  const db = await getDB();
  await db.put('priceSessions', session);
  await addEditHistory({
    id: genId(),
    entity: 'priceSession',
    entityId: session.id,
    action: 'create',
    summary: `Price session added for ${session.date}`,
    at: Date.now(),
  });
}

// ---------- Sales ----------

export async function getSalesForDate(date: string): Promise<Sale[]> {
  const db = await getDB();
  return db.getAllFromIndex('sales', 'by-date', date);
}

export async function getSalesForDateRange(start: string, end: string): Promise<Sale[]> {
  const db = await getDB();
  const all = await db.getAll('sales');
  return all.filter(s => s.date >= start && s.date <= end);
}

export async function saveSale(sale: Sale): Promise<void> {
  const db = await getDB();
  await db.put('sales', sale);
  await adjustInventory(sale.productId, -sale.quantity);
  await addEditHistory({
    id: genId(),
    entity: 'sale',
    entityId: sale.id,
    action: 'create',
    summary: `Sold ${sale.quantity} on ${sale.date} (profit ${await fmtMoney(sale.profit)})`,
    at: Date.now(),
  });
  await recalcDay(sale.date);
}

export async function updateSale(sale: Sale, summary: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get('sales', sale.id);
  if (existing && existing.quantity !== sale.quantity) {
    await adjustInventory(sale.productId, existing.quantity - sale.quantity);
  } else if (existing && existing.productId !== sale.productId) {
    await adjustInventory(existing.productId, existing.quantity);
    await adjustInventory(sale.productId, -sale.quantity);
  }
  await db.put('sales', sale);
  await addEditHistory({
    id: genId(),
    entity: 'sale',
    entityId: sale.id,
    action: 'update',
    summary,
    at: Date.now(),
  });
  await recalcDay(sale.date);
}

export async function deleteSale(saleId: string, summary: string): Promise<void> {
  const db = await getDB();
  const sale = await db.get('sales', saleId);
  if (!sale) return;
  await adjustInventory(sale.productId, sale.quantity);
  await db.delete('sales', saleId);
  await addEditHistory({
    id: genId(),
    entity: 'sale',
    entityId: saleId,
    action: 'delete',
    summary,
    at: Date.now(),
  });
  await recalcDay(sale.date);
}

// ---------- Day records ----------

export async function getDayRecord(date: string): Promise<DayRecord | undefined> {
  const db = await getDB();
  const rec = await db.get('dayRecords', date);
  // Backfill totalItems from totalEggs for legacy records
  if (rec && (rec as any).totalEggs != null && rec.totalItems == null) {
    rec.totalItems = (rec as any).totalEggs;
  }
  return rec;
}

export async function getAllDayRecords(): Promise<DayRecord[]> {
  const db = await getDB();
  const all = await db.getAll('dayRecords');
  return all.map(r => {
    if ((r as any).totalEggs != null && r.totalItems == null) {
      r.totalItems = (r as any).totalEggs;
    }
    return r;
  }).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getDayRecordsForRange(start: string, end: string): Promise<DayRecord[]> {
  const db = await getDB();
  const all = await db.getAll('dayRecords');
  return all.map(r => {
    if ((r as any).totalEggs != null && r.totalItems == null) {
      r.totalItems = (r as any).totalEggs;
    }
    return r;
  }).filter(r => r.date >= start && r.date <= end).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function setDayClosed(date: string, closed: boolean): Promise<void> {
  const db = await getDB();
  const existing = await db.get('dayRecords', date);
  const next: DayRecord = existing || {
    date,
    status: 'open',
    totalItems: 0,
    totalBuy: 0,
    totalSell: 0,
    totalProfit: 0,
    sessionCount: 0,
    saleCount: 0,
    totalDamageCost: 0,
    lastEditedAt: Date.now(),
  };
  next.status = closed ? 'closed' : 'open';
  next.lastEditedAt = Date.now();
  await db.put('dayRecords', next);
  await addEditHistory({
    id: genId(),
    entity: 'dayRecord',
    entityId: date,
    action: 'update',
    summary: `${date} marked ${closed ? 'closed' : 'open'}`,
    at: Date.now(),
  });
}

/**
 * Recalculate a day's aggregated summary from its sales, price sessions and damages.
 */
export async function recalcDay(date: string): Promise<DayRecord> {
  const db = await getDB();
  const sales = await getSalesForDate(date);
  const sessions = await getPriceSessionsForDate(date);
  const damages = await getDamagesForDate(date);
  const totalItems = sales.reduce((a, s) => a + s.quantity, 0);
  const totalBuy = sales.reduce((a, s) => a + s.buyPrice * s.quantity, 0);
  const totalSell = sales.reduce((a, s) => a + s.sellPrice * s.quantity, 0);
  const totalProfit = sales.reduce((a, s) => a + s.profit, 0);
  const totalDamageCost = damages.reduce((a, d) => a + d.totalCost, 0);

  const existing = await db.get('dayRecords', date);
  const next: DayRecord = {
    date,
    status: existing?.status === 'closed' ? 'closed' : 'open',
    totalItems,
    totalBuy,
    totalSell,
    totalProfit,
    sessionCount: sessions.length,
    saleCount: sales.length,
    totalDamageCost,
    lastEditedAt: Date.now(),
    notes: existing?.notes,
  };
  await db.put('dayRecords', next);
  return next;
}

// ---------- Credits ----------

export async function getAllCredits(): Promise<CreditRecord[]> {
  const db = await getDB();
  const all = await db.getAll('credits');
  return all.sort((a, b) => b.purchaseAt - a.purchaseAt);
}

export async function getActiveCredits(): Promise<CreditRecord[]> {
  const db = await getDB();
  return (await db.getAllFromIndex('credits', 'by-status', 'active'))
    .sort((a, b) => b.purchaseAt - a.purchaseAt);
}

export async function getPaidCredits(): Promise<CreditRecord[]> {
  const db = await getDB();
  return (await db.getAllFromIndex('credits', 'by-status', 'paid'))
    .sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));
}

export async function saveCredit(credit: CreditRecord): Promise<void> {
  const db = await getDB();
  await db.put('credits', credit);
  if (credit.paidAmount > 0) {
    const payment: CreditPayment = {
      id: genId(),
      creditId: credit.id,
      customerName: credit.customerName,
      amount: credit.paidAmount,
      paymentDate: credit.purchaseDate,
      paidAt: credit.purchaseAt,
    };
    await db.put('creditPayments', payment);
  }
  await addEditHistory({
    id: genId(),
    entity: 'credit',
    entityId: credit.id,
    action: 'create',
    summary: `Credit added: ${credit.customerName} — remaining ${await fmtMoney(credit.remaining)}`,
    at: Date.now(),
  });
}

export async function recordCreditPayment(
  creditId: string,
  amount: number,
): Promise<{ credit: CreditRecord; payment: CreditPayment; movedToPaid: boolean }> {
  const db = await getDB();
  const c = await db.get('credits', creditId);
  if (!c) throw new Error('Credit record not found');
  if (amount <= 0) throw new Error('Payment amount must be positive');
  if (amount > c.remaining + 0.01) {
    throw new Error(`Payment exceeds remaining balance (${await fmtMoney(c.remaining)})`);
  }
  const movedToPaid = c.remaining - amount <= 0.01;
  c.paidAmount += amount;
  c.remaining = Math.max(0, c.totalAmount - c.paidAmount);
  if (movedToPaid) {
    c.status = 'paid';
    c.paidAt = Date.now();
  }
  await db.put('credits', c);

  const payment: CreditPayment = {
    id: genId(),
    creditId,
    customerName: c.customerName,
    amount,
    paymentDate: todayStr(),
    paidAt: Date.now(),
  };
  await db.put('creditPayments', payment);

  await addEditHistory({
    id: genId(),
    entity: 'credit',
    entityId: creditId,
    action: 'mark-paid',
    summary: `Credit payment: ${c.customerName} — ${await fmtMoney(amount)}${movedToPaid ? ' (fully paid)' : ''}`,
    at: Date.now(),
  });

  return { credit: c, payment, movedToPaid };
}

export async function markCreditPaid(creditId: string): Promise<void> {
  const db = await getDB();
  const c = await db.get('credits', creditId);
  if (!c) return;
  if (c.remaining > 0) {
    await recordCreditPayment(creditId, c.remaining);
    return;
  }
  c.status = 'paid';
  c.paidAt = Date.now();
  await db.put('credits', c);
  await addEditHistory({
    id: genId(),
    entity: 'credit',
    entityId: creditId,
    action: 'mark-paid',
    summary: `Credit marked paid: ${c.customerName}`,
    at: Date.now(),
  });
}

export async function getCreditPayments(creditId: string): Promise<CreditPayment[]> {
  const db = await getDB();
  return (await db.getAllFromIndex('creditPayments', 'by-credit', creditId))
    .sort((a, b) => b.paidAt - a.paidAt);
}

export async function getAllCreditPayments(): Promise<CreditPayment[]> {
  const db = await getDB();
  return (await db.getAll('creditPayments')).sort((a, b) => b.paidAt - a.paidAt);
}

// ---------- Edit history ----------

export async function addEditHistory(entry: EditHistoryEntry): Promise<void> {
  const db = await getDB();
  await db.put('editHistory', entry);
}

export async function getEditHistory(limit = 100): Promise<EditHistoryEntry[]> {
  const db = await getDB();
  const all = await db.getAll('editHistory');
  return all.sort((a, b) => b.at - a.at).slice(0, limit);
}

// ---------- Inventory ----------

export async function getInventoryForProduct(productId: string): Promise<number> {
  const db = await getDB();
  const inv = await db.get('inventory', productId);
  return inv?.quantity ?? 0;
}

/** Legacy alias. */
export async function getInventoryForCategory(categoryId: string): Promise<number> {
  return getInventoryForProduct(categoryId);
}

export async function getAllInventory(): Promise<Record<string, number>> {
  const db = await getDB();
  const all = await db.getAll('inventory');
  const map: Record<string, number> = {};
  for (const inv of all) map[inv.productId] = inv.quantity;
  return map;
}

export async function adjustInventory(productId: string, delta: number, sourceType: 'supplier' | 'sale' | 'damage' | 'manual' = 'sale'): Promise<number> {
  const db = await getDB();
  const existing = await db.get('inventory', productId);
  const current = existing?.quantity ?? 0;
  const next = Math.max(0, current + delta);
  const updated: Inventory = {
    productId,
    quantity: next,
    lastUpdated: Date.now(),
  };
  await db.put('inventory', updated);
  if (delta !== 0) {
    const changeType: StockMovement['changeType'] =
      delta > 0 ? (sourceType === 'damage' ? 'returned' : 'added') :
      sourceType === 'damage' ? 'damaged' :
      sourceType === 'supplier' ? 'returned' : 'sold';
    const movement: StockMovement = {
      id: genId(),
      productId,
      changeType,
      quantity: Math.abs(delta),
      date: todayStr(),
      at: Date.now(),
      sourceType,
      remainingAfter: next,
    };
    await recordStockMovement(movement);
  }
  return next;
}

export async function setInventory(productId: string, quantity: number): Promise<void> {
  const db = await getDB();
  await db.put('inventory', {
    productId,
    quantity: Math.max(0, quantity),
    lastUpdated: Date.now(),
  });
}

// ---------- Expenses ----------

export async function getAllExpenses(): Promise<Expense[]> {
  const db = await getDB();
  const all = await db.getAll('expenses');
  return all.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getExpensesForDateRange(start: string, end: string): Promise<Expense[]> {
  const db = await getDB();
  const all = await db.getAll('expenses');
  return all.filter(e => e.date >= start && e.date <= end).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function saveExpense(expense: Expense): Promise<void> {
  const db = await getDB();
  await db.put('expenses', expense);
  await addEditHistory({
    id: genId(),
    entity: 'expense',
    entityId: expense.id,
    action: 'create',
    summary: `Expense added: ${expense.category} — ${await fmtMoney(expense.amount)}`,
    at: Date.now(),
  });
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const db = await getDB();
  await db.delete('expenses', expenseId);
  await addEditHistory({
    id: genId(),
    entity: 'expense',
    entityId: expenseId,
    action: 'delete',
    summary: `Expense deleted`,
    at: Date.now(),
  });
}

// ---------- Damage Records ----------

export async function getDamagesForDate(date: string): Promise<DamageRecord[]> {
  const db = await getDB();
  // try by-date index, fall back to scanning for legacy 'categoryId' index
  const fromIndex = await db.getAllFromIndex('damages', 'by-date', date);
  return fromIndex.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getDamagesForDateRange(start: string, end: string): Promise<DamageRecord[]> {
  const db = await getDB();
  const all = await db.getAll('damages');
  return all.filter(d => d.date >= start && d.date <= end).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllDamages(): Promise<DamageRecord[]> {
  const db = await getDB();
  const all = await db.getAll('damages');
  return all.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function saveDamage(damage: DamageRecord): Promise<void> {
  const db = await getDB();
  await db.put('damages', damage);
  await adjustInventory(damage.productId, -damage.quantity, 'damage');
  await addEditHistory({
    id: genId(),
    entity: 'damage',
    entityId: damage.id,
    action: 'create',
    summary: `Damaged stock: ${damage.quantity} — ${await fmtMoney(damage.totalCost)}`,
    at: Date.now(),
  });
  await recalcDay(damage.date);
}

export async function deleteDamage(damageId: string): Promise<void> {
  const db = await getDB();
  const d = await db.get('damages', damageId);
  if (!d) return;
  await adjustInventory(d.productId, d.quantity, 'manual');
  await db.delete('damages', damageId);
  await addEditHistory({
    id: genId(),
    entity: 'damage',
    entityId: damageId,
    action: 'delete',
    summary: `Damage record deleted`,
    at: Date.now(),
  });
  await recalcDay(d.date);
}

// ---------- Stock Movements ----------

export async function getAllStockMovements(): Promise<StockMovement[]> {
  const db = await getDB();
  const all = await db.getAll('stockMovements');
  return all.sort((a, b) => b.at - a.at);
}

export async function getStockMovementsForProduct(productId: string): Promise<StockMovement[]> {
  const db = await getDB();
  return (await db.getAllFromIndex('stockMovements', 'by-product', productId))
    .sort((a, b) => b.at - a.at);
}

/** Legacy alias. */
export async function getStockMovementsForCategory(categoryId: string): Promise<StockMovement[]> {
  return getStockMovementsForProduct(categoryId);
}

async function recordStockMovement(movement: StockMovement): Promise<void> {
  const db = await getDB();
  await db.put('stockMovements', movement);
}

// ---------- Suppliers ----------

export async function getAllSuppliers(): Promise<Supplier[]> {
  const db = await getDB();
  const all = await db.getAll('suppliers');
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSupplier(id: string): Promise<Supplier | undefined> {
  const db = await getDB();
  return db.get('suppliers', id);
}

export async function saveSupplier(supplier: Supplier): Promise<void> {
  const db = await getDB();
  await db.put('suppliers', supplier);
  await addEditHistory({
    id: genId(),
    entity: 'supplier',
    entityId: supplier.id,
    action: 'create',
    summary: `Supplier ${supplier.name} saved`,
    at: Date.now(),
  });
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  const db = await getDB();
  const purchases = await db.getAllFromIndex('supplierPurchases', 'by-supplier', supplierId);
  const payments = await db.getAllFromIndex('supplierPayments', 'by-supplier', supplierId);
  const tx = db.transaction(['suppliers', 'supplierPurchases', 'supplierPayments', 'inventory'], 'readwrite');
  for (const p of purchases) {
    const inv = await tx.objectStore('inventory').get(p.productId);
    const current = inv?.quantity ?? 0;
    await tx.objectStore('inventory').put({
      productId: p.productId,
      quantity: Math.max(0, current - p.quantity),
      lastUpdated: Date.now(),
    });
  }
  await tx.objectStore('suppliers').delete(supplierId);
  for (const p of purchases) await tx.objectStore('supplierPurchases').delete(p.id);
  for (const pm of payments) await tx.objectStore('supplierPayments').delete(pm.id);
  await tx.done;
  await addEditHistory({
    id: genId(),
    entity: 'supplier',
    entityId: supplierId,
    action: 'delete',
    summary: `Supplier ${supplierId} deleted (${purchases.length} purchases, ${payments.length} payments)`,
    at: Date.now(),
  });
}

// ---------- Supplier purchases ----------

export async function getPurchasesForSupplier(supplierId: string): Promise<SupplierPurchase[]> {
  const db = await getDB();
  return (await db.getAllFromIndex('supplierPurchases', 'by-supplier', supplierId))
    .sort((a, b) => b.purchaseAt - a.purchaseAt);
}

export async function getActivePurchasesForSupplier(supplierId: string): Promise<SupplierPurchase[]> {
  const db = await getDB();
  return (await db.getAllFromIndex('supplierPurchases', 'by-supplier-status', [supplierId, 'active']))
    .sort((a, b) => b.purchaseAt - a.purchaseAt);
}

export async function getPaidPurchasesForSupplier(supplierId: string): Promise<SupplierPurchase[]> {
  const db = await getDB();
  return (await db.getAllFromIndex('supplierPurchases', 'by-supplier-status', [supplierId, 'paid']))
    .sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));
}

export async function getPurchase(id: string): Promise<SupplierPurchase | undefined> {
  const db = await getDB();
  return db.get('supplierPurchases', id);
}

export async function getAllSupplierPurchasesForDateRange(start: string, end: string): Promise<SupplierPurchase[]> {
  const db = await getDB();
  const all = await db.getAll('supplierPurchases');
  return all
    .filter(p => p.purchaseDate >= start && p.purchaseDate <= end)
    .sort((a, b) => b.purchaseAt - a.purchaseAt);
}

export async function getPurchasesGroupedByGroup(supplierId: string): Promise<{ groupId: string; date: string; at: number; items: SupplierPurchase[]; totalCost: number; totalEggs: number; totalPaid: number; totalRemaining: number; allPaid: boolean }[]> {
  const all = await getPurchasesForSupplier(supplierId);
  const groupMap = new Map<string, SupplierPurchase[]>();
  for (const p of all) {
    const key = p.purchaseGroupId || p.id;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(p);
  }
  const groups: { groupId: string; date: string; at: number; items: SupplierPurchase[]; totalCost: number; totalEggs: number; totalPaid: number; totalRemaining: number; allPaid: boolean }[] = [];
  for (const [groupId, items] of groupMap.entries()) {
    items.sort((a, b) => a.purchaseAt - b.purchaseAt);
    const first = items[0];
    const totalCost = items.reduce((a, p) => a + p.totalCost, 0);
    const totalEggs = items.reduce((a, p) => a + p.quantity, 0);
    const totalPaid = items.reduce((a, p) => a + p.paidAmount, 0);
    const totalRemaining = items.reduce((a, p) => a + p.remaining, 0);
    const allPaid = items.every(p => p.status === 'paid');
    groups.push({ groupId, date: first.purchaseDate, at: first.purchaseAt, items, totalCost, totalEggs, totalPaid, totalRemaining, allPaid });
  }
  groups.sort((a, b) => b.at - a.at);
  return groups;
}

export async function saveSupplierPurchase(
  purchase: SupplierPurchase,
  paidNow: number = 0,
): Promise<SupplierPurchase> {
  const db = await getDB();
  const paid = Math.min(paidNow, purchase.totalCost);
  const remaining = Math.max(0, purchase.totalCost - paid);
  const status: 'active' | 'paid' = remaining === 0 && purchase.totalCost > 0 ? 'paid' : 'active';
  const finalPurchase: SupplierPurchase = {
    ...purchase,
    paidAmount: paid,
    remaining,
    status,
    paidAt: status === 'paid' ? Date.now() : undefined,
  };
  await db.put('supplierPurchases', finalPurchase);
  await adjustInventory(purchase.productId, purchase.quantity, 'supplier');
  if (paid > 0) {
    const payment: SupplierPayment = {
      id: genId(),
      supplierId: purchase.supplierId,
      purchaseId: purchase.id,
      amount: paid,
      paymentDate: purchase.purchaseDate,
      paidAt: Date.now(),
    };
    await db.put('supplierPayments', payment);
  }
  await addEditHistory({
    id: genId(),
    entity: 'supplierPurchase',
    entityId: purchase.id,
    action: 'create',
    summary: `Supplier purchase: ${purchase.quantity} units, ${await fmtMoney(purchase.totalCost)} (paid ${await fmtMoney(paid)})`,
    at: Date.now(),
  });
  return finalPurchase;
}

export async function deleteSupplierPurchase(purchaseId: string): Promise<void> {
  const db = await getDB();
  const p = await db.get('supplierPurchases', purchaseId);
  if (!p) return;
  await adjustInventory(p.productId, -p.quantity, 'manual');
  const payments = await db.getAllFromIndex('supplierPayments', 'by-purchase', purchaseId);
  const tx = db.transaction(['supplierPurchases', 'supplierPayments'], 'readwrite');
  await tx.objectStore('supplierPurchases').delete(purchaseId);
  for (const pm of payments) await tx.objectStore('supplierPayments').delete(pm.id);
  await tx.done;
  await addEditHistory({
    id: genId(),
    entity: 'supplierPurchase',
    entityId: purchaseId,
    action: 'delete',
    summary: `Supplier purchase deleted: ${p.quantity} units`,
    at: Date.now(),
  });
}

// ---------- Supplier payments ----------

export async function getPaymentsForSupplier(supplierId: string): Promise<SupplierPayment[]> {
  const db = await getDB();
  return (await db.getAllFromIndex('supplierPayments', 'by-supplier', supplierId))
    .sort((a, b) => b.paidAt - a.paidAt);
}

export async function getPaymentsForPurchase(purchaseId: string): Promise<SupplierPayment[]> {
  const db = await getDB();
  return (await db.getAllFromIndex('supplierPayments', 'by-purchase', purchaseId))
    .sort((a, b) => b.paidAt - a.paidAt);
}

export async function saveSupplierPayment(
  payment: SupplierPayment,
): Promise<{ payment: SupplierPayment; purchase: SupplierPurchase }> {
  const db = await getDB();
  const purchase = await db.get('supplierPurchases', payment.purchaseId);
  if (!purchase) throw new Error('Purchase not found');
  if (payment.amount <= 0) throw new Error('Payment amount must be positive');
  if (payment.amount > purchase.remaining + 0.01) {
    throw new Error(`Payment exceeds remaining balance (${await fmtMoney(purchase.remaining)})`);
  }
  purchase.paidAmount += payment.amount;
  purchase.remaining = Math.max(0, purchase.totalCost - purchase.paidAmount);
  if (purchase.remaining === 0) {
    purchase.status = 'paid';
    purchase.paidAt = Date.now();
  }
  await db.put('supplierPurchases', purchase);
  await db.put('supplierPayments', payment);
  await addEditHistory({
    id: genId(),
    entity: 'supplierPayment',
    entityId: payment.id,
    action: 'create',
    summary: `Payment ${await fmtMoney(payment.amount)} for purchase ${payment.purchaseId}`,
    at: Date.now(),
  });
  return { payment, purchase };
}

export type SupplierSummary = {
  supplierId: string;
  totalUnitsPurchased: number;
  totalEggsPurchased: number; // legacy alias kept
  totalPurchaseAmount: number;
  totalPaid: number;
  remaining: number;
  purchaseCount: number;
  activeCount: number;
  paidCount: number;
};

export async function getSupplierSummary(supplierId: string): Promise<SupplierSummary> {
  const purchases = await getPurchasesForSupplier(supplierId);
  const totalUnitsPurchased = purchases.reduce((a, p) => a + p.quantity, 0);
  const totalPurchaseAmount = purchases.reduce((a, p) => a + p.totalCost, 0);
  const totalPaid = purchases.reduce((a, p) => a + p.paidAmount, 0);
  const remaining = purchases.reduce((a, p) => a + p.remaining, 0);
  const activeCount = purchases.filter(p => p.status === 'active').length;
  const paidCount = purchases.filter(p => p.status === 'paid').length;
  return {
    supplierId,
    totalUnitsPurchased,
    totalEggsPurchased: totalUnitsPurchased,
    totalPurchaseAmount,
    totalPaid,
    remaining,
    purchaseCount: purchases.length,
    activeCount,
    paidCount,
  };
}

// ---------- Meta ----------

export async function getMeta(key: string): Promise<any> {
  const db = await getDB();
  return db.get('meta', key);
}

export async function setMeta(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('meta', value, key);
}

// ---------- Helpers ----------

export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}

export async function detectMissedDays(): Promise<string[]> {
  const settings = await getSettings();
  const installDate = settings.installDate || todayStr();
  const today = todayStr();
  if (today <= installDate) return [];

  const db = await getDB();
  const all = await db.getAll('dayRecords');
  const seen = new Set(all.map(r => r.date));
  const missing: string[] = [];

  let cursor = addDays(today, -1);
  while (cursor > installDate) {
    if (!seen.has(cursor)) missing.push(cursor);
    cursor = addDays(cursor, -1);
  }
  return missing;
}

// ---------- Backup / Restore ----------

export async function exportBackup(): Promise<string> {
  const db = await getDB();
  const [settings, products, priceSessions, sales, dayRecords, credits, creditPayments, suppliers, supplierPurchases, supplierPayments, inventory, expenses, damages, stockMovements, editHistory, metaKeys] = await Promise.all([
    db.get('settings', 'app'),
    db.getAll('products'),
    db.getAll('priceSessions'),
    db.getAll('sales'),
    db.getAll('dayRecords'),
    db.getAll('credits'),
    db.getAll('creditPayments'),
    db.getAll('suppliers'),
    db.getAll('supplierPurchases'),
    db.getAll('supplierPayments'),
    db.getAll('inventory'),
    db.getAll('expenses'),
    db.getAll('damages'),
    db.getAll('stockMovements'),
    db.getAll('editHistory'),
    db.getAllKeys('meta'),
  ]);
  const meta: Record<string, any> = {};
  for (const k of metaKeys) {
    meta[k as string] = await db.get('meta', k);
  }
  // SECURITY: Strip secrets from the exported backup. The PIN and WebAuthn
  // credential ID must NEVER leave the device in a backup file — they are
  // device-specific security credentials. Restoring a backup on another
  // device should require re-setting up App Lock.
  const safeSettings = settings ? { ...settings } : settings;
  if (safeSettings) {
    delete safeSettings.appLockPin;
    delete safeSettings.webauthnCredentialId;
    // Keep appLockEnabled + appLockBiometric flags so the user knows they had
    // lock enabled, but the actual PIN/credential must be re-created on restore.
    // We set appLockEnabled to false on restore to avoid a lockout with no PIN.
    safeSettings.appLockEnabled = false;
    safeSettings.appLockBiometric = false;
  }
  const payload = {
    app: 'shop-manager',
    version: 7,
    exportedAt: new Date().toISOString(),
    settings: safeSettings, products, priceSessions, sales, dayRecords, credits, creditPayments,
    suppliers, supplierPurchases, supplierPayments, inventory,
    expenses, damages, stockMovements,
    editHistory, meta,
  };
  await saveSettings({ lastBackupAt: Date.now() });
  return JSON.stringify(payload, null, 2);
}

export async function importBackup(jsonStr: string): Promise<void> {
  const db = await getDB();
  let payload: any;
  try {
    payload = JSON.parse(jsonStr);
  } catch {
    throw new Error('The selected file is not valid JSON. Please choose a ShopSuite backup file.');
  }
  // Validate backup structure
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid backup file: not a valid JSON object.');
  }
  const validApps = ['shop-manager', 'eggshop', 'biththara-kade'];
  if (!validApps.includes(payload.app)) {
    throw new Error('This file is not a ShopSuite backup. The file identifier is missing or incorrect.');
  }
  // Ensure data arrays exist (defensive — missing arrays become empty)
  const dataKeys = ['products', 'priceSessions', 'sales', 'dayRecords', 'credits', 'creditPayments', 'suppliers', 'supplierPurchases', 'supplierPayments', 'inventory', 'expenses', 'damages', 'stockMovements', 'editHistory'];
  for (const k of dataKeys) {
    if (payload[k] != null && !Array.isArray(payload[k])) {
      throw new Error(`Invalid backup file: field "${k}" is not an array.`);
    }
    if (payload[k] == null) payload[k] = [];
  }
  if (payload.settings != null && typeof payload.settings !== 'object') {
    throw new Error('Invalid backup file: settings is not an object.');
  }
  // SECURITY: Ensure no PIN/credential leaks into the restored settings.
  // Even if a maliciously-crafted backup contains them, we strip them.
  if (payload.settings) {
    delete payload.settings.appLockPin;
    delete payload.settings.webauthnCredentialId;
    // Force App Lock off on restore — the PIN was stripped, so enabling
    // lock without a PIN would cause a lockout.
    payload.settings.appLockEnabled = false;
    payload.settings.appLockBiometric = false;
  }
  const tx = db.transaction(
    ['settings', 'products', 'priceSessions', 'sales', 'dayRecords', 'credits', 'creditPayments', 'suppliers', 'supplierPurchases', 'supplierPayments', 'inventory', 'expenses', 'damages', 'stockMovements', 'editHistory', 'meta'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('settings').clear(),
    tx.objectStore('products').clear(),
    tx.objectStore('priceSessions').clear(),
    tx.objectStore('sales').clear(),
    tx.objectStore('dayRecords').clear(),
    tx.objectStore('credits').clear(),
    tx.objectStore('creditPayments').clear(),
    tx.objectStore('suppliers').clear(),
    tx.objectStore('supplierPurchases').clear(),
    tx.objectStore('supplierPayments').clear(),
    tx.objectStore('inventory').clear(),
    tx.objectStore('expenses').clear(),
    tx.objectStore('damages').clear(),
    tx.objectStore('stockMovements').clear(),
    tx.objectStore('editHistory').clear(),
    tx.objectStore('meta').clear(),
  ]);
  // Migrate legacy 'categories' field to 'products' if present
  const products = payload.products || payload.categories || [];
  if (payload.settings) await tx.objectStore('settings').put(payload.settings, 'app');
  for (const c of products) {
    // Backfill new fields if missing
    if (c.category == null) c.category = 'General';
    if (c.unit == null) c.unit = 'pcs';
    if (c.openingStock == null) c.openingStock = 0;
    if (c.purchasePrice == null) c.purchasePrice = 0;
    if (c.sellingPrice == null) c.sellingPrice = 0;
    if (c.reorderThreshold == null) c.reorderThreshold = 10;
    if (c.createdAt == null) c.createdAt = Date.now();
    await tx.objectStore('products').put(c);
  }
  for (const p of payload.priceSessions || []) {
    // Migrate categoryId → productId
    if (p.productId == null && p.categoryId != null) p.productId = p.categoryId;
    await tx.objectStore('priceSessions').put(p);
  }
  for (const s of payload.sales || []) {
    if (s.productId == null && s.categoryId != null) s.productId = s.categoryId;
    await tx.objectStore('sales').put(s);
  }
  for (const d of payload.dayRecords || []) {
    if (d.totalItems == null && d.totalEggs != null) d.totalItems = d.totalEggs;
    if (d.totalDamageCost == null) d.totalDamageCost = 0;
    await tx.objectStore('dayRecords').put(d);
  }
  for (const c of payload.credits || []) {
    // Backfill items array for legacy single-line credits
    if (!c.items || c.items.length === 0) {
      c.items = [{
        productId: c.categoryId || c.productId || '',
        name: '',
        quantity: c.quantity || 0,
        unitPrice: c.sellPrice || 0,
      }];
    }
    await tx.objectStore('credits').put(c);
  }
  for (const c of payload.creditPayments || []) await tx.objectStore('creditPayments').put(c);
  for (const s of payload.suppliers || []) await tx.objectStore('suppliers').put(s);
  for (const p of payload.supplierPurchases || []) {
    if (p.productId == null && p.categoryId != null) p.productId = p.categoryId;
    await tx.objectStore('supplierPurchases').put(p);
  }
  for (const pm of payload.supplierPayments || []) await tx.objectStore('supplierPayments').put(pm);
  for (const i of payload.inventory || []) {
    if (i.productId == null && i.categoryId != null) i.productId = i.categoryId;
    await tx.objectStore('inventory').put(i);
  }
  for (const e of payload.expenses || []) await tx.objectStore('expenses').put(e);
  for (const d of payload.damages || []) {
    if (d.productId == null && d.categoryId != null) d.productId = d.categoryId;
    await tx.objectStore('damages').put(d);
  }
  for (const sm of payload.stockMovements || []) {
    if (sm.productId == null && sm.categoryId != null) sm.productId = sm.categoryId;
    await tx.objectStore('stockMovements').put(sm);
  }
  for (const e of payload.editHistory || []) await tx.objectStore('editHistory').put(e);
  for (const [k, v] of Object.entries(payload.meta || {})) await tx.objectStore('meta').put(v, k);
  await tx.done;
}

/**
 * Auto-backup: store a snapshot in the 'backups' store. Keep only the latest 5.
 * Returns the id of the new backup.
 */
export async function saveAutoBackup(): Promise<string> {
  const db = await getDB();
  const json = await exportBackup();
  const id = genId();
  const at = Date.now();
  await db.put('backups', { id, at, json });
  // Prune to latest 5
  const all = await db.getAll('backups');
  if (all.length > 5) {
    const sorted = all.sort((a, b) => a.at - b.at);
    const toDelete = sorted.slice(0, all.length - 5);
    const tx = db.transaction('backups', 'readwrite');
    for (const b of toDelete) await tx.store.delete(b.id);
    await tx.done;
  }
  return id;
}

export async function listAutoBackups(): Promise<{ id: string; at: number }[]> {
  const db = await getDB();
  const all = await db.getAll('backups');
  return all.sort((a, b) => b.at - a.at).map(b => ({ id: b.id, at: b.at }));
}

export async function restoreAutoBackup(id: string): Promise<void> {
  const db = await getDB();
  const b = await db.get('backups', id);
  if (!b) throw new Error('Backup not found');
  await importBackup(b.json);
}

export async function deleteAutoBackup(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('backups', id);
}

/** Get the size (in bytes) of a stored auto-backup. */
export async function getAutoBackupSize(id: string): Promise<number> {
  const db = await getDB();
  const b = await db.get('backups', id);
  return b ? new Blob([b.json]).size : 0;
}

// ---------- CSV / Excel export helpers (NEW v3.1) ----------

/** Convert an array of objects to a CSV string (Excel-compatible). */
export function toCSV(rows: Record<string, any>[], columns?: { key: string; label: string }[]): string {
  if (rows.length === 0 && !columns) return '';
  const cols = columns || Object.keys(rows[0] || {}).map((k) => ({ key: k, label: k }));
  const escape = (v: any) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const header = cols.map((c) => escape(c.label)).join(',');
  const body = rows.map((r) => cols.map((c) => escape(r[c.key])).join(',')).join('\n');
  // Prepend BOM for Excel UTF-8 compatibility
  return '\uFEFF' + header + '\n' + body;
}

/** Trigger a browser download of a text file. */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/csv'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export sales as CSV. */
export async function exportSalesCSV(start: string, end: string): Promise<string> {
  const sales = await getSalesForDateRange(start, end);
  const products = await getProducts();
  const prodName = (id: string) => products.find((p) => p.id === id)?.name || id;
  const dec = currencyDecimals((await getSettings()).currency);
  const rows = sales.map((s) => ({
    date: s.date,
    product: prodName(s.productId),
    quantity: s.quantity,
    buyPrice: s.buyPrice.toFixed(dec),
    sellPrice: s.sellPrice.toFixed(dec),
    profit: s.profit.toFixed(dec),
    session: s.sessionIndex + 1,
  }));
  return toCSV(rows, [
    { key: 'date', label: 'Date' },
    { key: 'product', label: 'Product' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'buyPrice', label: 'Buy Price' },
    { key: 'sellPrice', label: 'Sell Price' },
    { key: 'profit', label: 'Profit' },
    { key: 'session', label: 'Session' },
  ]);
}

/** Export inventory as CSV. */
export async function exportInventoryCSV(): Promise<string> {
  const products = await getProducts();
  const inv = await getAllInventory();
  const dec = currencyDecimals((await getSettings()).currency);
  const rows = products.map((p) => ({
    name: p.name,
    category: p.category,
    unit: p.unit,
    stock: inv[p.id] || 0,
    purchasePrice: p.purchasePrice.toFixed(dec),
    sellingPrice: p.sellingPrice.toFixed(dec),
    reorderThreshold: p.reorderThreshold,
  }));
  return toCSV(rows, [
    { key: 'name', label: 'Product' },
    { key: 'category', label: 'Category' },
    { key: 'unit', label: 'Unit' },
    { key: 'stock', label: 'Current Stock' },
    { key: 'purchasePrice', label: 'Purchase Price' },
    { key: 'sellingPrice', label: 'Selling Price' },
    { key: 'reorderThreshold', label: 'Reorder Threshold' },
  ]);
}

/** Export expenses as CSV. */
export async function exportExpensesCSV(start: string, end: string): Promise<string> {
  const expenses = await getExpensesForDateRange(start, end);
  const dec = currencyDecimals((await getSettings()).currency);
  const rows = expenses.map((e) => ({
    date: e.date,
    category: e.category,
    amount: e.amount.toFixed(dec),
    note: e.note || '',
  }));
  return toCSV(rows, [
    { key: 'date', label: 'Date' },
    { key: 'category', label: 'Category' },
    { key: 'amount', label: 'Amount' },
    { key: 'note', label: 'Note' },
  ]);
}

/** Export customer credits as CSV. */
export async function exportCreditsCSV(): Promise<string> {
  const credits = await getAllCredits();
  const dec = currencyDecimals((await getSettings()).currency);
  const rows = credits.map((c) => ({
    customer: c.customerName,
    date: c.purchaseDate,
    total: c.totalAmount.toFixed(dec),
    paid: c.paidAmount.toFixed(dec),
    remaining: c.remaining.toFixed(dec),
    status: c.status,
  }));
  return toCSV(rows, [
    { key: 'customer', label: 'Customer' },
    { key: 'date', label: 'Purchase Date' },
    { key: 'total', label: 'Total Amount' },
    { key: 'paid', label: 'Paid Amount' },
    { key: 'remaining', label: 'Remaining' },
    { key: 'status', label: 'Status' },
  ]);
}

/** Export supplier purchases as CSV. */
export async function exportSupplierPurchasesCSV(start: string, end: string): Promise<string> {
  const purchases = await getAllSupplierPurchasesForDateRange(start, end);
  const suppliers = await getAllSuppliers();
  const products = await getProducts();
  const supName = (id: string) => suppliers.find((s) => s.id === id)?.name || id;
  const prodName = (id: string) => products.find((p) => p.id === id)?.name || id;
  const dec = currencyDecimals((await getSettings()).currency);
  const rows = purchases.map((p) => ({
    date: p.purchaseDate,
    supplier: supName(p.supplierId),
    product: prodName(p.productId),
    quantity: p.quantity,
    pricePerUnit: p.pricePerEgg.toFixed(dec),
    totalCost: p.totalCost.toFixed(dec),
    paidAmount: p.paidAmount.toFixed(dec),
    remaining: p.remaining.toFixed(dec),
    status: p.status,
  }));
  return toCSV(rows, [
    { key: 'date', label: 'Date' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'product', label: 'Product' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'pricePerUnit', label: 'Price/Unit' },
    { key: 'totalCost', label: 'Total Cost' },
    { key: 'paidAmount', label: 'Paid' },
    { key: 'remaining', label: 'Remaining' },
    { key: 'status', label: 'Status' },
  ]);
}

// ---------- Aggregations ----------

export type MonthSummary = {
  month: string;
  totalItems: number;
  totalEggs: number; // legacy alias
  totalBuy: number;
  totalSell: number;
  totalProfit: number;
  totalDamageCost: number;
  netProfit: number;
  totalExpenses: number;
  openDays: number;
  closedDays: number;
  averageDailyProfit: number;
  bestDay: { date: string; profit: number } | null;
  worstDay: { date: string; profit: number } | null;
  perProduct: { productId: string; totalItems: number; totalSell: number; totalBuy: number; totalProfit: number }[];
  perCategory: { productId: string; totalItems: number; totalSell: number; totalBuy: number; totalProfit: number }[]; // legacy alias kept
};

export async function getMonthSummary(month: string): Promise<MonthSummary> {
  const start = `${month}-01`;
  const end = `${month}-31`;
  const days = await getDayRecordsForRange(start, end);
  const sales = await getSalesForDateRange(start, end);
  const expenses = await getExpensesForDateRange(start, end);
  const products = await getProducts();
  const damages = await getDamagesForDateRange(start, end);

  let totalItems = 0, totalBuy = 0, totalSell = 0, totalProfit = 0, totalDamageCost = 0;
  let openDays = 0, closedDays = 0;
  let bestDay: { date: string; profit: number } | null = null;
  let worstDay: { date: string; profit: number } | null = null;

  for (const d of days) {
    totalItems += d.totalItems;
    totalBuy += d.totalBuy;
    totalSell += d.totalSell;
    totalProfit += d.totalProfit;
    totalDamageCost += d.totalDamageCost || 0;
    if (d.status === 'closed') closedDays++;
    else openDays++;
    if (d.status !== 'closed' && d.saleCount > 0) {
      if (!bestDay || d.totalProfit > bestDay.profit) bestDay = { date: d.date, profit: d.totalProfit };
      if (!worstDay || d.totalProfit < worstDay.profit) worstDay = { date: d.date, profit: d.totalProfit };
    }
  }

  const totalExpenses = expenses.reduce((a, e) => a + e.amount, 0);
  const netProfit = totalProfit - totalExpenses - totalDamageCost;

  const perProduct = products.map(p => {
    const ps = sales.filter(s => s.productId === p.id);
    return {
      productId: p.id,
      totalItems: ps.reduce((a, s) => a + s.quantity, 0),
      totalSell: ps.reduce((a, s) => a + s.sellPrice * s.quantity, 0),
      totalBuy: ps.reduce((a, s) => a + s.buyPrice * s.quantity, 0),
      totalProfit: ps.reduce((a, s) => a + s.profit, 0),
    };
  });

  const profitDays = days.filter(d => d.status !== 'closed' && d.saleCount > 0);
  const averageDailyProfit = profitDays.length ? totalProfit / profitDays.length : 0;

  return {
    month,
    totalItems,
    totalEggs: totalItems,
    totalBuy,
    totalSell,
    totalProfit,
    totalDamageCost,
    netProfit,
    totalExpenses,
    openDays,
    closedDays,
    averageDailyProfit,
    bestDay,
    worstDay,
    perProduct,
    perCategory: perProduct,
  };
}

// ---------- Dashboard aggregations (NEW v3) ----------

export type DashboardStats = {
  // Cash & profit
  cashAvailable: number;       // total sell - total expenses (NOT minus supplier dues)
  grossProfit: number;         // total sell - total buy (= total profit across all sales)
  netProfit: number;           // grossProfit - expenses - damage cost
  // Dues
  supplierDue: number;
  customerDue: number;
  // Today
  todaySales: number;          // total sell today
  todayProfit: number;          // gross profit today (Σ sale.profit)
  todayNetProfit: number;       // today gross profit - today expenses - today damage
  todayItems: number;
  // Month
  monthSales: number;
  monthProfit: number;         // gross profit this month
  monthExpenses: number;
  monthDamageCost: number;
  monthNetProfit: number;
  // Yesterday & last month for comparison (NET profit for business health)
  yesterdayProfit: number;       // gross profit yesterday (kept for compat)
  yesterdayNetProfit: number;    // net profit yesterday
  lastMonthProfit: number;       // gross profit last month (kept for compat)
  lastMonthNetProfit: number;    // net profit last month
  // Stock alerts
  lowStockCount: number;
  outOfStockCount: number;
  lowStockProducts: { id: string; name: string; qty: number; threshold: number }[];
  // Top selling product (this month)
  topProduct: { id: string; name: string; qty: number; profit: number } | null;
  // Inventory
  totalProducts: number;
  stockValue: number;            // sum of (inventory qty × product.purchasePrice)
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = todayStr();
  const thisMonth = today.slice(0, 7);
  const thisMonthStart = `${thisMonth}-01`;
  const thisMonthEnd = `${thisMonth}-31`;
  const yesterday = addDays(today, -1);

  // Last month range
  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthStart = `${lastMonth}-01`;
  const lastMonthEnd = `${lastMonth}-31`;

  const [
    todaySalesArr, monthSalesArr, lastMonthSalesArr, yesterdaySalesArr,
    monthExpensesArr, monthDamagesArr,
    todayExpensesArr, todayDamagesArr,
    lastMonthExpensesArr, lastMonthDamagesArr,
    allCredits, allSuppliers, allInventory, allProducts,
  ] = await Promise.all([
    getSalesForDate(today),
    getSalesForDateRange(thisMonthStart, thisMonthEnd),
    getSalesForDateRange(lastMonthStart, lastMonthEnd),
    getSalesForDate(yesterday),
    getExpensesForDateRange(thisMonthStart, thisMonthEnd),
    getDamagesForDateRange(thisMonthStart, thisMonthEnd),
    getExpensesForDateRange(today, today),
    getDamagesForDate(today),
    getExpensesForDateRange(lastMonthStart, lastMonthEnd),
    getDamagesForDateRange(lastMonthStart, lastMonthEnd),
    getActiveCredits(),
    getAllSuppliers(),
    getAllInventory(),
    getProducts(),
  ]);

  const totalSellAll = monthSalesArr.reduce((a, s) => a + s.sellPrice * s.quantity, 0);
  const totalBuyAll = monthSalesArr.reduce((a, s) => a + s.buyPrice * s.quantity, 0);
  const grossProfit = monthSalesArr.reduce((a, s) => a + s.profit, 0);
  const monthExpenses = monthExpensesArr.reduce((a, e) => a + e.amount, 0);
  const monthDamageCost = monthDamagesArr.reduce((a, d) => a + d.totalCost, 0);
  const netProfit = grossProfit - monthExpenses - monthDamageCost;

  // Today net profit (today gross - today expenses - today damage)
  const todayExpenses = todayExpensesArr.reduce((a, e) => a + e.amount, 0);
  const todayDamageCost = todayDamagesArr.reduce((a, d) => a + d.totalCost, 0);

  // Yesterday net profit (yesterday gross - yesterday expenses - yesterday damage)
  const yesterdayExpenses = yesterdaySalesArr.length > 0
    ? (await getExpensesForDateRange(yesterday, yesterday)).reduce((a, e) => a + e.amount, 0)
    : 0;
  const yesterdayDamageCost = yesterdaySalesArr.length > 0
    ? (await getDamagesForDate(yesterday)).reduce((a, d) => a + d.totalCost, 0)
    : 0;

  // Last month net profit
  const lastMonthExpenses = lastMonthExpensesArr.reduce((a, e) => a + e.amount, 0);
  const lastMonthDamageCost = lastMonthDamagesArr.reduce((a, d) => a + d.totalCost, 0);

  // Cash available: total money received from sales this month minus expenses paid out.
  // (Sales revenue is treated as cash received at point of sale.)
  const cashAvailable = totalSellAll - monthExpenses;

  // Dues
  const customerDue = allCredits.reduce((a, c) => a + c.remaining, 0);
  const supplierDueArr = await Promise.all(allSuppliers.map(s => getSupplierSummary(s.id)));
  const supplierDue = supplierDueArr.reduce((a, s) => a + s.remaining, 0);

  // Today
  const todaySales = todaySalesArr.reduce((a, s) => a + s.sellPrice * s.quantity, 0);
  const todayProfit = todaySalesArr.reduce((a, s) => a + s.profit, 0);
  const todayItems = todaySalesArr.reduce((a, s) => a + s.quantity, 0);

  // Month
  const monthSales = totalSellAll;
  const monthProfit = grossProfit;

  // Yesterday & last month profit
  const yesterdayProfit = yesterdaySalesArr.reduce((a, s) => a + s.profit, 0);
  const lastMonthProfit = lastMonthSalesArr.reduce((a, s) => a + s.profit, 0);

  // Stock alerts
  const lowStockProducts: DashboardStats['lowStockProducts'] = [];
  let lowStockCount = 0;
  let outOfStockCount = 0;
  for (const p of allProducts) {
    const qty = allInventory[p.id] || 0;
    if (qty === 0) {
      outOfStockCount++;
      lowStockProducts.push({ id: p.id, name: p.name, qty: 0, threshold: p.reorderThreshold });
    } else if (qty < p.reorderThreshold) {
      lowStockCount++;
      lowStockProducts.push({ id: p.id, name: p.name, qty, threshold: p.reorderThreshold });
    }
  }

  // Top selling product (this month)
  const qtyByProduct = new Map<string, { qty: number; profit: number }>();
  for (const s of monthSalesArr) {
    const cur = qtyByProduct.get(s.productId) || { qty: 0, profit: 0 };
    cur.qty += s.quantity;
    cur.profit += s.profit;
    qtyByProduct.set(s.productId, cur);
  }
  let topProduct: DashboardStats['topProduct'] = null;
  for (const [id, v] of qtyByProduct.entries()) {
    const p = allProducts.find(x => x.id === id);
    if (!topProduct || v.qty > topProduct.qty) {
      topProduct = { id, name: p?.name || id, qty: v.qty, profit: v.profit };
    }
  }

  // Stock value (sum of inventory qty × purchase price)
  const stockValue = allProducts.reduce((a, p) => a + (allInventory[p.id] || 0) * p.purchasePrice, 0);

  return {
    cashAvailable,
    grossProfit,
    netProfit,
    supplierDue,
    customerDue,
    todaySales,
    todayProfit,
    todayNetProfit: todayProfit - todayExpenses - todayDamageCost,
    todayItems,
    monthSales,
    monthProfit,
    monthExpenses,
    monthDamageCost,
    monthNetProfit: netProfit,
    yesterdayProfit,
    yesterdayNetProfit: yesterdayProfit - yesterdayExpenses - yesterdayDamageCost,
    lastMonthProfit,
    lastMonthNetProfit: lastMonthProfit - lastMonthExpenses - lastMonthDamageCost,
    lowStockCount,
    outOfStockCount,
    lowStockProducts,
    topProduct,
    totalProducts: allProducts.length,
    stockValue,
  };
}
