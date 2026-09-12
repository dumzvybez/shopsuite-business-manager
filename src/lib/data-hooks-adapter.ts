'use client';

/**
 * Adapter that re-exports data hooks AND the i18n hook in one import.
 * Keeps component code clean.
 */

export {
  getSettings, saveSettings,
  getProducts, getCategories, saveProduct, updateProduct, deleteProduct, getProduct,
  getPriceSessionsForDate, getPriceSessionsForDateRange, savePriceSession,
  getLatestPriceSessionForCategory, getLatestPriceSessionForProduct, isCategoryUnavailable,
  getSalesForDate, getSalesForDateRange, saveSale, updateSale, deleteSale,
  getDayRecord, getAllDayRecords, getDayRecordsForRange, setDayClosed, recalcDay,
  getEditHistory, addEditHistory,
  exportBackup, importBackup, saveAutoBackup, listAutoBackups, restoreAutoBackup, deleteAutoBackup, getAutoBackupSize,
  toCSV, downloadTextFile,
  exportSalesCSV, exportInventoryCSV, exportExpensesCSV, exportCreditsCSV, exportSupplierPurchasesCSV,
  detectMissedDays, getMonthSummary, getDashboardStats,
  getAllCredits, getActiveCredits, getPaidCredits, saveCredit, markCreditPaid, recordCreditPayment, getCreditPayments, getAllCreditPayments,
  getAllSuppliers, getSupplier, saveSupplier, deleteSupplier,
  getPurchasesForSupplier, getActivePurchasesForSupplier, getPaidPurchasesForSupplier, getPurchase, getAllSupplierPurchasesForDateRange, getPurchasesGroupedByGroup,
  saveSupplierPurchase, deleteSupplierPurchase,
  getPaymentsForSupplier, getPaymentsForPurchase, saveSupplierPayment,
  getSupplierSummary,
  getAllInventory, getInventoryForCategory, getInventoryForProduct, adjustInventory, setInventory,
  getAllExpenses, getExpensesForDateRange, saveExpense, deleteExpense,
  getDamagesForDate, getDamagesForDateRange, getAllDamages, saveDamage, deleteDamage,
  getAllStockMovements, getStockMovementsForCategory, getStockMovementsForProduct,
  todayStr, toDateStr, addDays, genId, PRODUCT_COLOR_PALETTE,
  formatDate, formatDateShort, formatDateLong, formatMonth,
  formatNumber, formatQuantity, formatQuantityWithUnit, formatCurrency, relativeDayLabel,
} from './data-hooks';

export type {
  Settings, Product, EggCategory, PriceSession, Sale, DayRecord, EditHistoryEntry, MonthSummary, DashboardStats, CreditRecord, CreditPayment,
  Supplier, SupplierPurchase, SupplierPayment, SupplierSummary, Inventory, Expense, DamageRecord, StockMovement,
} from './data-hooks';

export {
  useSettings, useProducts, useCategories, useDayData, useAllDays, useEditHistory, useCredits,
  useSuppliers, useSupplierData, useInventory,
} from './use-data';
export { useI18n } from './i18n-context';
export { useThemeSync, applyThemeAndLang, applyThemeAndBackground } from './use-theme';
