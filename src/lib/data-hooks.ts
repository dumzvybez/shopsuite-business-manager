'use client';

/**
 * Convenience re-exports so dashboard/components can import everything
 * from one place. Thin adapter over @/lib/db and @/lib/sinhala.
 */

import {
  getSettings, saveSettings,
  getProducts, getCategories, saveProduct, updateProduct, deleteProduct, getProduct,
  getPriceSessionsForDate, getPriceSessionsForDateRange, savePriceSession, getLatestPriceSessionForCategory, getLatestPriceSessionForProduct, isCategoryUnavailable,
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
  type Settings, type Product, type EggCategory, type PriceSession, type Sale, type DayRecord, type EditHistoryEntry, type MonthSummary, type DashboardStats, type CreditRecord, type CreditPayment,
  type Supplier, type SupplierPurchase, type SupplierPayment, type SupplierSummary, type Inventory, type Expense, type DamageRecord, type StockMovement,
} from './db';

import {
  formatDate, formatDateShort, formatDateLong, formatMonth,
  formatNumber, formatQuantity, formatQuantityWithUnit, formatCurrency, relativeDayLabel,
  SINHALA_MONTHS, SINHALA_DAYS, ENGLISH_MONTHS, ENGLISH_DAYS,
} from './sinhala';

export {
  getSettings, saveSettings,
  getProducts, getCategories, saveProduct, updateProduct, deleteProduct, getProduct,
  getPriceSessionsForDate, getPriceSessionsForDateRange, savePriceSession, getLatestPriceSessionForCategory, getLatestPriceSessionForProduct, isCategoryUnavailable,
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
  SINHALA_MONTHS, SINHALA_DAYS, ENGLISH_MONTHS, ENGLISH_DAYS,
};

export type {
  Settings, Product, EggCategory, PriceSession, Sale, DayRecord, EditHistoryEntry, MonthSummary, DashboardStats, CreditRecord, CreditPayment,
  Supplier, SupplierPurchase, SupplierPayment, SupplierSummary, Inventory, Expense, DamageRecord, StockMovement,
};

export {
  useSettings, useProducts, useCategories, useDayData, useAllDays, useEditHistory, useCredits,
  useSuppliers, useSupplierData, useInventory,
} from './use-data';
