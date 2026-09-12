'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileBarChart, Share2, Printer, Calendar, ChevronDown, Check } from 'lucide-react';
import {
  getDayRecordsForRange, getSalesForDateRange, getCategories, getAllSupplierPurchasesForDateRange, getAllInventory,
  getSupplier, useI18n,
  formatCurrency, formatNumber, formatDateLong, formatDate, formatMonth,
  todayStr, addDays,
  type DayRecord, type Sale, type EggCategory, type SupplierPurchase, type Expense, type CreditRecord, type DamageRecord,
} from '@/lib/data-hooks-adapter';
import { useAppToast } from './toast-provider';
import { SINHALA_MONTHS, ENGLISH_MONTHS } from '@/lib/sinhala';

type Props = {
  onBack: () => void;
  settings: { shopName: string; ownerName: string; currency: string };
};

type Range = { start: string; end: string; label: string; key: string };

export function PdfReportScreen({ onBack, settings }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useAppToast();
  const today = todayStr();
  const [ranges, setRanges] = useState<Range[]>([]);
  const [selectedRange, setSelectedRange] = useState<Range | null>(null);
  const [days, setDays] = useState<DayRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [supplierPurchases, setSupplierPurchases] = useState<SupplierPurchase[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [products, setCategories] = useState<EggCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [credits, setCredits] = useState<CreditRecord[]>([]);
  const [damages, setDamages] = useState<DamageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // PDF section selection (NEW v3)
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [sections, setSections] = useState<{
    sales: boolean;
    supplierPurchases: boolean;
    inventory: boolean;
    expenses: boolean;
    credit: boolean;
    damage: boolean;
  }>({
    sales: true,
    supplierPurchases: true,
    inventory: true,
    expenses: true,
    credit: true,
    damage: true,
  });

  // Build range presets (no "last month" — replaced by month picker)
  useEffect(() => {
    const now = new Date();
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const thisYearStart = `${now.getFullYear()}-01-01`;

    const presets: Range[] = [
      { key: 'thisMonth', start: thisMonthStart, end: today, label: t('pdf.range.thisMonth', { month: formatMonth(today.slice(0, 7), lang) }) },
      { key: 'last7', start: addDays(today, -6), end: today, label: t('pdf.range.last7') },
      { key: 'last30', start: addDays(today, -29), end: today, label: t('pdf.range.last30') },
      { key: 'thisYear', start: thisYearStart, end: today, label: t('pdf.range.thisYear', { year: String(now.getFullYear()) }) },
    ];
    setRanges(presets);
    setSelectedRange(presets[0]);
  }, [lang, t]);

  useEffect(() => {
    if (!selectedRange) return;
    (async () => {
      setLoading(true);
      const { getAllSuppliers, getExpensesForDateRange, getActiveCredits, getDamagesForDateRange } = await import('@/lib/db');
      const [d, s, sp, inv, c, allSuppliers, exp, cred, dmg] = await Promise.all([
        getDayRecordsForRange(selectedRange.start, selectedRange.end),
        getSalesForDateRange(selectedRange.start, selectedRange.end),
        getAllSupplierPurchasesForDateRange(selectedRange.start, selectedRange.end),
        getAllInventory(),
        getCategories(),
        getAllSuppliers(),
        getExpensesForDateRange(selectedRange.start, selectedRange.end),
        getActiveCredits(),
        getDamagesForDateRange(selectedRange.start, selectedRange.end),
      ]);
      // Build a supplier-name lookup used by the HTML generator.
      const supplierMap: Record<string, string> = {};
      for (const sup of allSuppliers) supplierMap[sup.id] = sup.name;
      (window as any).__supplierMap = supplierMap;
      setDays(d.sort((a, b) => (a.date < b.date ? 1 : -1)));
      setSales(s);
      setSupplierPurchases(sp);
      setInventory(inv);
      setCategories(c);
      setExpenses(exp);
      setCredits(cred);
      setDamages(dmg);
      setLoading(false);
    })();
    // NOTE: `sections` is intentionally excluded from the dependency array —
    // toggling a section checkbox must NOT reload data from IndexedDB. The
    // generateHTML closure reads the current `sections` value directly.
  }, [selectedRange]);

  // Aggregate stats — compute from BOTH dayRecords AND sales for accuracy.
  // DayRecords may be stale if recalcDay didn't run, so we use sales as
  // the source of truth for profit/eggs/buy/sell, and dayRecords for
  // open/closed day counts. Expenses + damages are computed from their
  // own stores so Net Profit = Gross - Expenses - Damage is consistent
  // with the dashboard and monthly report formulas.
  const totals = useMemo(() => {
    // From sales (source of truth for profit calculations)
    const fromSales = sales.reduce(
      (acc, s) => {
        acc.eggs += s.quantity;
        acc.buy += s.buyPrice * s.quantity;
        acc.sell += s.sellPrice * s.quantity;
        acc.profit += s.profit;
        return acc;
      },
      { eggs: 0, buy: 0, sell: 0, profit: 0 }
    );
    // From dayRecords (for day status counts)
    const dayCounts = days.reduce(
      (acc, d) => {
        acc.closed += d.status === 'closed' ? 1 : 0;
        acc.open += d.status !== 'closed' ? 1 : 0;
        return acc;
      },
      { open: 0, closed: 0 }
    );
    // Expenses + damages (for net profit calculation)
    const totalExpenses = expenses.reduce((a, e) => a + e.amount, 0);
    const totalDamageCost = damages.reduce((a, d) => a + d.totalCost, 0);
    const netProfit = fromSales.profit - totalExpenses - totalDamageCost;
    return { ...fromSales, ...dayCounts, totalExpenses, totalDamageCost, netProfit };
  }, [days, sales, expenses, damages]);

  // Supplier purchase totals
  const supplierTotals = useMemo(() => {
    const totalCost = supplierPurchases.reduce((a, p) => a + p.totalCost, 0);
    const totalPaid = supplierPurchases.reduce((a, p) => a + p.paidAmount, 0);
    const totalEggs = supplierPurchases.reduce((a, p) => a + p.quantity, 0);
    return { totalCost, totalPaid, totalEggs };
  }, [supplierPurchases]);

  // Month picker options (last 12 months)
  const monthOptions = useMemo(() => {
    const monthsArr = ENGLISH_MONTHS;
    const opts: { value: string; label: string }[] = [];
    const tDate = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(tDate.getFullYear(), tDate.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      opts.push({ value, label: `${monthsArr[d.getMonth()]} ${d.getFullYear()}` });
    }
    return opts;
  }, [lang]);

  const handleSelectMonth = (monthValue: string) => {
    const [y, m] = monthValue.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = `${y}-${String(m).padStart(2, '0')}-31`; // safe — no month has >31 days
    const monthsArr = ENGLISH_MONTHS;
    const label = `${monthsArr[m - 1]} ${y}`;
    const range: Range = { key: 'selectMonth', start, end, label };
    setSelectedRange(range);
    setShowMonthPicker(false);
    setSelectedMonth(monthValue);
  };

  const generateHTML = (): string => {
    const sec = sections;
    const rangeLabel = selectedRange?.label || '';
    const startDate = selectedRange ? formatDateLong(selectedRange.start, lang) : '';
    const endDate = selectedRange ? formatDateLong(selectedRange.end, lang) : '';

    const catName = (id: string) => {
      const cat = products.find((c) => c.id === id);
      if (!cat) return escapeHtml(id);
      return escapeHtml(cat.name);
    };

    // Daily summary rows — compute from sales grouped by date for accuracy
    const salesByDate = new Map<string, { eggs: number; buy: number; sell: number; profit: number }>();
    for (const s of sales) {
      const existing = salesByDate.get(s.date) || { eggs: 0, buy: 0, sell: 0, profit: 0 };
      existing.eggs += s.quantity;
      existing.buy += s.buyPrice * s.quantity;
      existing.sell += s.sellPrice * s.quantity;
      existing.profit += s.profit;
      salesByDate.set(s.date, existing);
    }
    // Merge dayRecords (for status) with sales data
    const allDates = new Set<string>([...days.map(d => d.date), ...salesByDate.keys()]);
    const sortedDates = Array.from(allDates).sort((a, b) => (a < b ? 1 : -1));
    const dailyRows = sortedDates.map((dateStr) => {
      const dayRec = days.find(d => d.date === dateStr);
      const salesData = salesByDate.get(dateStr) || { eggs: 0, buy: 0, sell: 0, profit: 0 };
      const statusLabel = dayRec?.status === 'closed' ? t('reports.closed') : t('reports.open');
      const isClosed = dayRec?.status === 'closed';
      return `<tr>
        <td>${formatDate(dateStr, lang)}</td>
        <td>${statusLabel}</td>
        <td style="text-align:right">${formatNumber(salesData.eggs)}</td>
        <td style="text-align:right">${formatCurrency(salesData.buy, settings.currency)}</td>
        <td style="text-align:right">${formatCurrency(salesData.sell, settings.currency)}</td>
        <td style="text-align:right; color:${salesData.profit < 0 ? '#dc2626' : '#16a34a'}; font-weight:600">${isClosed && salesData.eggs === 0 ? '—' : formatCurrency(salesData.profit, settings.currency)}</td>
      </tr>`;
    }).join('');

    // Supplier purchase rows — include supplier name
    const supplierMap: Record<string, string> = (typeof window !== 'undefined' ? (window as any).__supplierMap : {}) || {};
    const supplierRows = supplierPurchases.map((p) => {
      const supplierName = escapeHtml(supplierMap[p.supplierId] || '—');
      const statusLabel = p.status === 'paid' ? t('supplier.fullyPaid') : (p.paidAmount > 0 ? t('supplier.partiallyPaid') : t('supplier.unpaid'));
      return `<tr>
        <td>${formatDate(p.purchaseDate, lang)}</td>
        <td>${supplierName}</td>
        <td>${catName(p.productId)}</td>
        <td style="text-align:right">${formatNumber(p.quantity)}</td>
        <td style="text-align:right">${formatCurrency(p.pricePerEgg, settings.currency)}</td>
        <td style="text-align:right">${formatCurrency(p.totalCost, settings.currency)}</td>
        <td style="text-align:center">${statusLabel}</td>
      </tr>`;
    }).join('');

    // Inventory summary rows — include stock value + purchase/selling prices
    const inventoryRows = products.map((c) => {
      const qty = inventory[c.id] || 0;
      const status = qty === 0 ? ('Out of Stock') : '';
      const stockValue = qty * c.purchasePrice;
      return `<tr>
        <td>${catName(c.id)}</td>
        <td style="text-align:right">${formatNumber(qty)}</td>
        <td style="text-align:right">${formatCurrency(c.purchasePrice, settings.currency)}</td>
        <td style="text-align:right">${formatCurrency(c.sellingPrice, settings.currency)}</td>
        <td style="text-align:right">${formatCurrency(stockValue, settings.currency)}</td>
        <td style="text-align:center; color:${qty === 0 ? '#dc2626' : '#16a34a'}">${status || ('In Stock')}</td>
      </tr>`;
    }).join('');
    const inventoryTotalValue = products.reduce((a, c) => a + (inventory[c.id] || 0) * c.purchasePrice, 0);

    // Expense rows
    const expenseRows = expenses.map((e) => {
      return `<tr>
        <td>${formatDate(e.date, lang)}</td>
        <td>${t('expense.' + e.category) || e.category}</td>
        <td style="text-align:right">${formatCurrency(e.amount, settings.currency)}</td>
        <td>${e.note ? escapeHtml(e.note) : ''}</td>
      </tr>`;
    }).join('');
    const expenseTotal = expenses.reduce((a, e) => a + e.amount, 0);

    // Credit rows (active outstanding credits)
    const creditRows = credits.map((cr) => {
      return `<tr>
        <td>${escapeHtml(cr.customerName)}</td>
        <td>${formatDate(cr.purchaseDate, lang)}</td>
        <td style="text-align:right">${formatCurrency(cr.totalAmount, settings.currency)}</td>
        <td style="text-align:right">${formatCurrency(cr.paidAmount, settings.currency)}</td>
        <td style="text-align:right; color:#dc2626; font-weight:600">${formatCurrency(cr.remaining, settings.currency)}</td>
      </tr>`;
    }).join('');
    const creditTotalRemaining = credits.reduce((a, c) => a + c.remaining, 0);

    // Damage rows
    const damageRows = damages.map((d) => {
      return `<tr>
        <td>${formatDate(d.date, lang)}</td>
        <td>${catName(d.productId)}</td>
        <td style="text-align:right">${formatNumber(d.quantity)}</td>
        <td style="text-align:right">${formatCurrency(d.pricePerEgg, settings.currency)}</td>
        <td style="text-align:right; color:#dc2626; font-weight:600">${formatCurrency(d.totalCost, settings.currency)}</td>
      </tr>`;
    }).join('');
    const damageTotalCost = damages.reduce((a, d) => a + d.totalCost, 0);

    const shopName = escapeHtml(settings.shopName || ('EggShop'));

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${shopName} — ${t('pdf.title')}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: 'Noto Sans Sinhala', 'Iskoola Pota', system-ui, sans-serif; color: #1c1917; margin: 0; background: #ffffff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #f59e0b; padding-bottom: 12px; margin-bottom: 18px; }
  .shop { font-size: 24px; font-weight: 800; color: #92400e; }
  .sub { font-size: 12px; color: #57534e; margin-top: 2px; }
  .range-box { text-align: right; font-size: 12px; color: #57534e; }
  .range-label { font-weight: 700; color: #1c1917; font-size: 14px; margin-bottom: 2px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  .stat { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 10px; }
  .stat-label { font-size: 10px; color: #78716c; }
  .stat-value { font-size: 14px; font-weight: 700; color: #1c1917; margin-top: 2px; }
  .stat.profit .stat-value { color: ${totals.profit < 0 ? '#dc2626' : '#16a34a'}; }
  .stat.net .stat-value { color: ${totals.netProfit < 0 ? '#dc2626' : '#92400e'}; }
  .formula { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 12px; font-size: 11px; color: #166534; margin-bottom: 18px; text-align: center; }
  .formula strong { color: #92400e; }
  h2 { font-size: 15px; color: #92400e; margin: 22px 0 10px; border-left: 4px solid #f59e0b; padding-left: 10px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
  th { background: #f59e0b; color: white; padding: 8px; text-align: left; font-weight: 600; font-size: 11px; }
  th:not(:first-child) { text-align: right; }
  th.center { text-align: center; }
  td { padding: 7px 8px; border-bottom: 1px solid #f3e8d0; }
  td:first-child { text-align: left; }
  td.center { text-align: center; }
  tr:nth-child(even) td { background: #fffbeb; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px dashed #d6d3d1; font-size: 10px; color: #78716c; text-align: center; }
  .totals-row td { background: #fef3c7 !important; font-weight: 700; border-top: 2px solid #f59e0b; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .page-num { font-size: 9px; color: #78716c; text-align: right; margin-top: 6px; }
  .section-summary { font-size: 10px; color: #57534e; margin-bottom: 6px; font-style: italic; }
  @media print {
    .no-print { display: none; }
    .page-break { page-break-before: always; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="shop">${shopName}</div>
      ${settings.ownerName ? `<div class="sub">${t('pdf.report.owner')}: ${escapeHtml(settings.ownerName)}</div>` : ''}
      <div class="sub">${t('pdf.reportSubtitle')}</div>
    </div>
    <div class="range-box">
      <div class="range-label">${rangeLabel}</div>
      <div>${startDate}</div>
      <div>${t('pdf.report.to')} ${endDate}</div>
    </div>
  </div>

  <div class="summary">
    <div class="stat profit"><div class="stat-label">${t('dashboard.grossProfit')}</div><div class="stat-value">${formatCurrency(totals.profit, settings.currency)}</div></div>
    <div class="stat net"><div class="stat-label">${t('dashboard.netProfit')}</div><div class="stat-value">${formatCurrency(totals.netProfit, settings.currency)}</div></div>
    <div class="stat"><div class="stat-label">${t('monthly.totalEggs')}</div><div class="stat-value">${formatNumber(totals.eggs)}</div></div>
    <div class="stat"><div class="stat-label">${t('pdf.totalSalesAmount')}</div><div class="stat-value">${formatCurrency(totals.sell, settings.currency)}</div></div>
    <div class="stat"><div class="stat-label">${t('reports.totalBuy')}</div><div class="stat-value">${formatCurrency(totals.buy, settings.currency)}</div></div>
    <div class="stat"><div class="stat-label">${t('monthly.expenses')}</div><div class="stat-value">${formatCurrency(totals.totalExpenses, settings.currency)}</div></div>
    <div class="stat"><div class="stat-label">${t('monthly.damageImpact')}</div><div class="stat-value">${formatCurrency(totals.totalDamageCost, settings.currency)}</div></div>
    <div class="stat"><div class="stat-label">${t('pdf.report.days')}</div><div class="stat-value">${formatNumber(totals.open + totals.closed)}</div></div>
  </div>

  <div class="formula">
    ${t('dashboard.grossProfit')} (${formatCurrency(totals.profit, settings.currency)})
    &minus; ${t('monthly.expenses')} (${formatCurrency(totals.totalExpenses, settings.currency)})
    &minus; ${t('monthly.damageImpact')} (${formatCurrency(totals.totalDamageCost, settings.currency)})
    = <strong>${t('dashboard.netProfit')}: ${formatCurrency(totals.netProfit, settings.currency)}</strong>
  </div>

  ${sec.sales ? `<h2>${t('pdf.section.sales')}</h2>
  <table>
    <thead>
      <tr>
        <th>${t('common.date')}</th><th>${t('reports.status')}</th><th>${t('reports.totalSold')}</th><th>${t('reports.totalBuy')}</th><th>${t('reports.totalSell')}</th><th>${t('reports.totalProfit')}</th>
      </tr>
    </thead>
    <tbody>
      ${dailyRows || `<tr><td colspan="6" style="text-align:center; padding:20px; color:#78716c">${t('pdf.noSales')}</td></tr>`}
      ${(days.length > 0 || sales.length > 0) ? `<tr class="totals-row">
        <td>${t('pdf.report.total')}</td>
        <td>${t('pdf.report.daysTotal', { total: String(totals.open + totals.closed), open: String(totals.open), closed: String(totals.closed) })}</td>
        <td style="text-align:right">${formatNumber(totals.eggs)}</td>
        <td style="text-align:right">${formatCurrency(totals.buy, settings.currency)}</td>
        <td style="text-align:right">${formatCurrency(totals.sell, settings.currency)}</td>
        <td style="text-align:right">${formatCurrency(totals.profit, settings.currency)}</td>
      </tr>` : ''}
    </tbody>
  </table>

  ` : ''}${sec.supplierPurchases ? `<h2>${t('pdf.section.supplierPurchases')}</h2>
  <table>
    <thead>
      <tr>
        <th>${t('common.date')}</th><th>${t('pdf.supplierName')}</th><th>${t('pdf.report.eggType')}</th><th>${t('supplier.quantity')}</th><th>${t('supplier.pricePerEgg')}</th><th>${t('supplier.totalCost')}</th><th class="center">${t('pdf.paymentStatus')}</th>
      </tr>
    </thead>
    <tbody>
      ${supplierRows || `<tr><td colspan="7" style="text-align:center; padding:20px; color:#78716c">${t('pdf.noSupplierPurchases')}</td></tr>`}
      ${supplierPurchases.length > 0 ? `<tr class="totals-row">
        <td>${t('pdf.report.total')}</td>
        <td></td>
        <td></td>
        <td style="text-align:right">${formatNumber(supplierTotals.totalEggs)}</td>
        <td></td>
        <td style="text-align:right">${formatCurrency(supplierTotals.totalCost, settings.currency)}</td>
        <td class="center"></td>
      </tr>` : ''}
    </tbody>
  </table>

  ` : ''}${sec.inventory ? `<h2>${t('pdf.section.inventory')}</h2>
  <p class="section-summary">${t('dashboard.stockValue')}: ${formatCurrency(inventoryTotalValue, settings.currency)} · ${products.length} ${t('dashboard.totalProducts').toLowerCase()}</p>
  <table>
    <thead>
      <tr>
        <th>${t('pdf.report.eggType')}</th><th>${t('pdf.currentStock')}</th><th>${t('inventory.purchasePrice')}</th><th>${t('inventory.sellingPrice')}</th><th>${t('dashboard.stockValue')}</th><th class="center">${t('common.status')}</th>
      </tr>
    </thead>
    <tbody>
      ${inventoryRows || `<tr><td colspan="6" style="text-align:center; padding:20px; color:#78716c">${t('inventory.empty')}</td></tr>`}
      ${products.length > 0 ? `<tr class="totals-row">
        <td>${t('pdf.report.total')}</td>
        <td></td>
        <td></td>
        <td></td>
        <td style="text-align:right">${formatCurrency(inventoryTotalValue, settings.currency)}</td>
        <td class="center"></td>
      </tr>` : ''}
    </tbody>
  </table>

  ` : ''}${sec.expenses ? `<h2>${t('pdf.section.expenses')}</h2>
  <table>
    <thead>
      <tr>
        <th>${t('common.date')}</th><th>${t('expense.category')}</th><th>${t('expense.amount')}</th><th>${t('common.note')}</th>
      </tr>
    </thead>
    <tbody>
      ${expenseRows || `<tr><td colspan="4" style="text-align:center; padding:20px; color:#78716c">${t('expense.noExpenses')}</td></tr>`}
      ${expenses.length > 0 ? `<tr class="totals-row">
        <td>${t('pdf.report.total')}</td>
        <td></td>
        <td style="text-align:right">${formatCurrency(expenseTotal, settings.currency)}</td>
        <td></td>
      </tr>` : ''}
    </tbody>
  </table>

  ` : ''}${sec.credit ? `<h2>${t('pdf.section.credit')}</h2>
  <table>
    <thead>
      <tr>
        <th>${t('credit.customerName')}</th><th>${t('credit.purchaseDate')}</th><th>${t('credit.totalAmount')}</th><th>${t('credit.confirmPaid.paid')}</th><th>${t('credit.remaining')}</th>
      </tr>
    </thead>
    <tbody>
      ${creditRows || `<tr><td colspan="5" style="text-align:center; padding:20px; color:#78716c">${t('credit.noActive')}</td></tr>`}
      ${credits.length > 0 ? `<tr class="totals-row">
        <td>${t('pdf.report.total')}</td>
        <td></td>
        <td></td>
        <td></td>
        <td style="text-align:right">${formatCurrency(creditTotalRemaining, settings.currency)}</td>
      </tr>` : ''}
    </tbody>
  </table>

  ` : ''}${sec.damage ? `<h2>${t('pdf.section.damage')}</h2>
  <table>
    <thead>
      <tr>
        <th>${t('common.date')}</th><th>${t('pdf.report.eggType')}</th><th>${t('damage.quantity')}</th><th>${t('damage.eggPriceLabel')}</th><th>${t('damage.totalCost')}</th>
      </tr>
    </thead>
    <tbody>
      ${damageRows || `<tr><td colspan="5" style="text-align:center; padding:20px; color:#78716c">${t('damage.noDamages')}</td></tr>`}
      ${damages.length > 0 ? `<tr class="totals-row">
        <td>${t('pdf.report.total')}</td>
        <td></td>
        <td style="text-align:right">${formatNumber(damages.reduce((a, d) => a + d.quantity, 0))}</td>
        <td></td>
        <td style="text-align:right">${formatCurrency(damageTotalCost, settings.currency)}</td>
      </tr>` : ''}
    </tbody>
  </table>

  ` : ''}
  <div class="footer">
    ${shopName} · ${t('pdf.report.generatedAt', { at: new Date().toLocaleString('en-US') })} · ShopSuite v3.3
  </div>
  <div class="page-num">${t('pdf.report.page')} <span class="pagenum"></span></div>
</body>
</html>`;
  };

  const handlePrint = () => {
    const html = generateHTML();
    const win = window.open('', '_blank');
    if (!win) {
      toast({ title: t('pdf.popupBlocked'), description: t('pdf.popupBlockedDesc'), variant: 'error' });
      return;
    }
    win.document.write(html);
    win.document.close();
    // Inject page numbers via CSS counter after the document is ready
    setTimeout(() => {
      try {
        const style = win.document.createElement('style');
        style.textContent = `@page { counter-increment: page; } body { counter-reset: page; }`;
        win.document.head.appendChild(style);
        const pageNumEls = win.document.querySelectorAll('.pagenum');
        pageNumEls.forEach((el) => {
          (el as HTMLElement).textContent = String(win.document.querySelectorAll('.page-break, h2').length > 0 ? '' : '');
        });
      } catch { /* page numbers are best-effort — browser print dialog handles actual page counting */ }
      win.focus();
      win.print();
    }, 500);
  };

  const handleShare = async () => {
    // For sharing, we generate a plain-text summary since browsers can't
    // natively share PDF files without a library. The user can use "Print PDF"
    // to save as PDF, then share that file. We share a text summary instead.
    const shopName = settings.shopName || ('EggShop');
    const rangeLabel = selectedRange?.label || '';
    const summary = `${shopName} — ${t('pdf.title')}\n${rangeLabel}\n\n` +
      `${t('pdf.totalProfit')}: ${formatCurrency(totals.profit, settings.currency)}\n` +
      `${t('monthly.totalEggs')}: ${formatNumber(totals.eggs)}\n` +
      `${t('pdf.totalSalesAmount')}: ${formatCurrency(totals.sell, settings.currency)}\n` +
      `${t('reports.totalBuy')}: ${formatCurrency(totals.buy, settings.currency)}\n` +
      (supplierPurchases.length > 0 ? `${t('pdf.section.supplierPurchases')}: ${formatCurrency(supplierTotals.totalCost, settings.currency)}\n` : '');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${shopName} — ${t('pdf.title')}`,
          text: summary,
        });
        return;
      } catch { /* cancelled */ }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(summary);
      toast({ title: t('toast.saved'), description: 'Report copied to clipboard.', variant: 'success' });
    } catch {
      toast({ title: t('toast.error'), description: 'Cannot share.', variant: 'error' });
    }
  };

  return (
    <div className="app-shell pb-28">
      <header className="glass-strong sticky top-0 z-30 safe-top">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50 active:scale-90 transition-transform"
            aria-label={t('common.back')}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-stone-800 dark:text-amber-50">{t('pdf.title')}</h1>
            <p className="text-xs text-stone-600 dark:text-amber-100/70">{t('pdf.sub')}</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Range picker */}
        <div className="glass-strong rounded-2xl p-3">
          <p className="text-xs text-stone-600 dark:text-amber-100/70 mb-2 flex items-center gap-1">
            <Calendar size={12} /> {t('pdf.selectRange')}
          </p>
          <div className="flex gap-2 overflow-x-auto scroll-area">
            {ranges.map((r) => (
              <button
                key={r.key}
                onClick={() => { setSelectedRange(r); setSelectedMonth(''); }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 ${
                  selectedRange?.key === r.key && !selectedMonth ? 'glass-primary text-white' : 'glass text-stone-700 dark:text-amber-100'
                }`}
              >
                {r.label}
              </button>
            ))}
            {/* Select month */}
            <button
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 flex items-center gap-1 ${
                selectedMonth ? 'glass-primary text-white' : 'glass text-stone-700 dark:text-amber-100'
              }`}
            >
              {t('pdf.selectMonth')} <ChevronDown size={12} />
            </button>
          </div>
          {showMonthPicker && (
            <div className="mt-2 glass rounded-xl p-2 max-h-48 overflow-y-auto scroll-area">
              {monthOptions.map((m) => (
                <button
                  key={m.value}
                  onClick={() => handleSelectMonth(m.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${
                    selectedMonth === m.value ? 'glass-primary text-white' : 'text-stone-700 dark:text-amber-100 hover:bg-white/40 dark:hover:bg-white/5'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="glass rounded-2xl p-8 text-center text-stone-500 dark:text-amber-100/60 text-sm">{t('common.loading')}</div>
        ) : (
          <>
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-strong rounded-3xl p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <FileBarChart size={18} className="text-amber-600 dark:text-amber-400" />
                <h2 className="font-bold text-stone-800 dark:text-amber-50">{t('pdf.preview')}</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                <PreviewStat label={t('dashboard.grossProfit')} value={formatCurrency(totals.profit, settings.currency)} color={totals.profit < 0 ? 'danger' : 'success'} />
                <PreviewStat label={t('dashboard.netProfit')} value={formatCurrency(totals.netProfit, settings.currency)} color={totals.netProfit < 0 ? 'danger' : 'primary'} />
                <PreviewStat label={t('monthly.totalEggs')} value={`${formatNumber(totals.eggs)}`} color="primary" />
                <PreviewStat label={t('pdf.totalSalesAmount')} value={formatCurrency(totals.sell, settings.currency)} color="info" />
                <PreviewStat label={t('reports.totalBuy')} value={formatCurrency(totals.buy, settings.currency)} color="muted" />
                <PreviewStat label={t('monthly.expenses')} value={formatCurrency(totals.totalExpenses, settings.currency)} color="muted" />
                <PreviewStat label={t('monthly.damageImpact')} value={formatCurrency(totals.totalDamageCost, settings.currency)} color={totals.totalDamageCost > 0 ? 'danger' : 'muted'} />
                <PreviewStat label={t('pdf.report.days')} value={formatNumber(totals.open + totals.closed)} color="info" />
              </div>

              {/* Net profit formula */}
              <div className="glass rounded-xl p-2.5 mb-3 text-[11px] text-center text-stone-600 dark:text-amber-100/70">
                {t('dashboard.grossProfit')} ({formatCurrency(totals.profit, settings.currency)})
                {' − '}{t('monthly.expenses')} ({formatCurrency(totals.totalExpenses, settings.currency)})
                {' − '}{t('monthly.damageImpact')} ({formatCurrency(totals.totalDamageCost, settings.currency)})
                {' = '}<strong className="text-amber-700 dark:text-amber-300">{t('dashboard.netProfit')}: {formatCurrency(totals.netProfit, settings.currency)}</strong>
              </div>

              {/* Supplier purchase summary */}
              {supplierPurchases.length > 0 && (
                <div className="glass rounded-xl p-3 mb-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-stone-600 dark:text-amber-100/70">{t('pdf.section.supplierPurchases')}</p>
                    <p className="font-bold text-stone-800 dark:text-amber-50">{formatCurrency(supplierTotals.totalCost, settings.currency)}</p>
                  </div>
                  <div>
                    <p className="text-stone-600 dark:text-amber-100/70">{t('supplier.totalEggsPurchased')}</p>
                    <p className="font-bold text-stone-800 dark:text-amber-50">{formatNumber(supplierTotals.totalEggs)}</p>
                  </div>
                </div>
              )}

              {/* Mini table preview — computed from sales for accuracy */}
              <div className="glass rounded-2xl p-3 max-h-64 overflow-y-auto scroll-area">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-stone-600 dark:text-amber-100/70 border-b border-white/30 dark:border-white/10">
                      <th className="text-left py-1.5">{t('common.date')}</th>
                      <th className="text-right py-1.5">{t('reports.totalSold')}</th>
                      <th className="text-right py-1.5">{t('reports.totalProfit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Group sales by date for accurate display
                      const salesByDate = new Map<string, { eggs: number; profit: number }>();
                      for (const s of sales) {
                        const existing = salesByDate.get(s.date) || { eggs: 0, profit: 0 };
                        existing.eggs += s.quantity;
                        existing.profit += s.profit;
                        salesByDate.set(s.date, existing);
                      }
                      const sortedDates = Array.from(salesByDate.keys()).sort((a, b) => (a < b ? 1 : -1));
                      if (sortedDates.length === 0) {
                        return <tr><td colSpan={3} className="py-6 text-center text-stone-500 dark:text-amber-100/60 text-xs">{t('pdf.report.noData')}</td></tr>;
                      }
                      return sortedDates.slice(0, 10).map((dateStr) => {
                        const data = salesByDate.get(dateStr)!;
                        return (
                          <tr key={dateStr} className="border-b border-white/20 dark:border-white/5">
                            <td className="py-1.5 text-stone-700 dark:text-amber-100">{formatDate(dateStr, lang)}</td>
                            <td className="text-right py-1.5 text-stone-700 dark:text-amber-100">{formatNumber(data.eggs)}</td>
                            <td className={`text-right py-1.5 font-semibold ${data.profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                              {formatCurrency(data.profit, settings.currency)}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                    {sales.length > 10 && (
                      <tr>
                        <td colSpan={3} className="py-2 text-center text-stone-500 dark:text-amber-100/50 text-[10px]">
                          {sales.length - 10} more...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.section>

            {/* Section picker */}
            <div className="glass rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-stone-700 dark:text-amber-100">
                  {t('pdf.section.selectTitle')}
                </p>
                <button
                  onClick={() => setSections({
                    sales: true, supplierPurchases: true, inventory: true,
                    expenses: true, credit: true, damage: true,
                  })}
                  className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold"
                >
                  {t('pdf.section.selectAll')}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { key: 'sales', label: t('pdf.section.sales') },
                  { key: 'supplierPurchases', label: t('pdf.section.supplierPurchases') },
                  { key: 'inventory', label: t('pdf.section.inventory') },
                  { key: 'expenses', label: t('pdf.section.expenses') },
                  { key: 'credit', label: t('pdf.section.credit') },
                  { key: 'damage', label: t('pdf.section.damage') },
                ] as const).map((sec) => (
                  <button
                    key={sec.key}
                    onClick={() => setSections((prev) => ({ ...prev, [sec.key]: !prev[sec.key] }))}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      sections[sec.key]
                        ? 'glass-primary text-white'
                        : 'glass text-stone-700 dark:text-amber-100'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded border-2 flex items-center justify-center ${
                      sections[sec.key] ? 'bg-white border-white' : 'border-stone-400'
                    }`}>
                      {sections[sec.key] && <Check size={8} className="text-amber-600" />}
                    </span>
                    {sec.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleShare}
                className="glass-info rounded-2xl py-4 font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Share2 size={18} /> {t('pdf.share')}
              </button>
              <button
                onClick={handlePrint}
                className="glass-primary rounded-2xl py-4 font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Printer size={18} /> {t('pdf.print')}
              </button>
            </div>

            <div className="glass rounded-2xl p-3 text-xs text-stone-600 dark:text-amber-100/70">
              <p className="font-semibold text-stone-700 dark:text-amber-100 mb-1">{t('pdf.instructions.title')}</p>
              <p>• {t('pdf.instructions.1')}</p>
              <p>• {t('pdf.instructions.2')}</p>
              <p>• {t('pdf.instructions.3')}</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function PreviewStat({ label, value, color }: { label: string; value: string; color: 'primary' | 'success' | 'info' | 'muted' | 'danger' }) {
  const colorMap = {
    primary: 'glass-primary',
    success: 'glass-success',
    info: 'glass-info',
    muted: 'glass text-stone-800 dark:text-amber-50',
    danger: 'glass-danger',
  };
  return (
    <div className={`${colorMap[color]} rounded-2xl p-3`}>
      <p className="text-xs opacity-90 mb-0.5">{label}</p>
      <p className="text-base font-bold leading-tight">{value}</p>
    </div>
  );
}

/** Escape user-provided text so it is safe to interpolate into generated HTML
 *  (prevents broken markup / injection from customer names, notes, etc.). */
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
