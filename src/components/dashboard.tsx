'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Wallet, Coins, Truck, Users, Package,
  AlertTriangle, Settings as SettingsIcon, ChevronRight, ChevronUp, ChevronDown, Crown,
  ArrowUpRight, ArrowDownRight, ShoppingBag,
  Plus, Tag, Receipt, FileText, Boxes, Pencil, Check,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import {
  useI18n, getDashboardStats, getMonthSummary, todayStr, addDays,
  formatCurrency, formatNumber, type DashboardStats, type MonthSummary,
} from '@/lib/data-hooks-adapter';
import { formatDateShort, formatMonth } from '@/lib/sinhala';

type Props = {
  date: string;
  currency: string;
  onSeeAllReports: () => void;
  onSeeMonthlyReports: () => void;
  onRecentClick: (date: string) => void;
  // Quick Actions
  onNewSale: () => void;
  onAddStock: () => void;
  onSupplierPurchase: () => void;
  onCollectCredit: () => void;
  onAddExpense: () => void;
  onGenerateReport: () => void;
  shopName: string;
  ownerName: string;
  shopType: string;
  onOpenSettings: () => void;
  onOpenInventory: () => void;
  onOpenSuppliers: () => void;
  onOpenCredit: () => void;
  onOpenExpenses: () => void;
};

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return 'greeting.morning';
  if (h < 17) return 'greeting.afternoon';
  if (h < 21) return 'greeting.evening';
  return 'greeting.night';
}

// Section IDs that can be reordered by the user.
type SectionId = 'financials' | 'quickActions' | 'health' | 'todaySales' | 'inventory' | 'dues';
const DEFAULT_ORDER: SectionId[] = ['financials', 'quickActions', 'health', 'todaySales', 'inventory', 'dues'];
const ORDER_STORAGE_KEY = 'shopsuite-dashboard-order';

function loadOrder(): SectionId[] {
  if (typeof window === 'undefined') return DEFAULT_ORDER;
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ORDER;
    // Validate: must contain exactly the default IDs (no missing, no extra)
    const set = new Set(parsed);
    if (set.size !== DEFAULT_ORDER.length) return DEFAULT_ORDER;
    for (const id of DEFAULT_ORDER) {
      if (!set.has(id)) return DEFAULT_ORDER;
    }
    return parsed as SectionId[];
  } catch {
    return DEFAULT_ORDER;
  }
}

function saveOrder(order: SectionId[]) {
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch { /* ignore */ }
}

export function Dashboard({
  date, currency, onSeeAllReports, onSeeMonthlyReports,
  onNewSale, onAddStock, onSupplierPurchase, onCollectCredit, onAddExpense, onGenerateReport,
  shopName, ownerName, shopType,
  onOpenSettings, onOpenInventory, onOpenSuppliers, onOpenCredit, onOpenExpenses,
}: Props) {
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [last7, setLast7] = useState<{ date: string; profit: number; label: string }[]>([]);
  const [view, setView] = useState<'today' | 'month'>('today');
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<SectionId[]>(loadOrder);

  useEffect(() => {
    (async () => {
      const s = await getDashboardStats();
      setStats(s);

      const today = todayStr();
      const { getSalesForDateRange } = await import('@/lib/db');
      const salesByDate = new Map<string, number>();
      for (let i = 1; i <= 7; i++) {
        const d = addDays(today, -i);
        const sales = await getSalesForDateRange(d, d);
        const profit = sales.reduce((a, s) => a + s.profit, 0);
        if (profit !== 0 || sales.length > 0) salesByDate.set(d, profit);
      }
      const chartData: { date: string; profit: number; label: string }[] = [];
      for (let i = 7; i >= 1; i--) {
        const d = addDays(today, -i);
        const dayNum = new Date(d + 'T00:00:00').getDate();
        chartData.push({ date: d, profit: salesByDate.get(d) || 0, label: String(dayNum) });
      }
      setLast7(chartData);
    })();
  }, [date]);

  const monthLabel = formatMonth(todayStr().slice(0, 7));

  // ─── Business Health: uses NET profit (real business profit) ───
  // Today vs yesterday (net profit)
  const todayVsYesterday = useMemo(() => {
    if (!stats) return null;
    const todayNet = stats.todayNetProfit;
    const yesterdayNet = stats.yesterdayNetProfit;
    // If yesterday had no business activity at all (no sales), there's no meaningful baseline.
    if (yesterdayNet === 0 && stats.yesterdayProfit === 0) {
      return { todayNet, yesterdayNet, diff: todayNet, pct: null, up: todayNet > 0, noBaseline: true };
    }
    const diff = todayNet - yesterdayNet;
    const pct = yesterdayNet !== 0 ? (diff / Math.abs(yesterdayNet)) * 100 : null;
    return { todayNet, yesterdayNet, diff, pct, up: diff > 0, noBaseline: false };
  }, [stats]);

  // Month vs last month (net profit)
  const monthVsLastMonth = useMemo(() => {
    if (!stats) return null;
    const monthNet = stats.monthNetProfit;
    const lastNet = stats.lastMonthNetProfit;
    if (lastNet === 0 && stats.lastMonthProfit === 0) {
      return { monthNet, lastNet, diff: monthNet, pct: null, up: monthNet > 0, noBaseline: true };
    }
    const diff = monthNet - lastNet;
    const pct = lastNet !== 0 ? (diff / Math.abs(lastNet)) * 100 : null;
    return { monthNet, lastNet, diff, pct, up: diff > 0, noBaseline: false };
  }, [stats]);

  // Values for the financial cards based on the Today/Month toggle
  const financialValues = useMemo(() => {
    if (!stats) return { cash: '—', gross: '—', net: '—', netNegative: false, grossNegative: false, cashNegative: false };
    if (view === 'today') {
      return {
        cash: formatCurrency(stats.todaySales - (stats.monthExpenses > 0 ? 0 : 0), currency), // today cash = today sales (no today-expense split shown to keep it simple)
        gross: formatCurrency(stats.todayProfit, currency),
        net: formatCurrency(stats.todayNetProfit, currency),
        netNegative: stats.todayNetProfit < 0,
        grossNegative: stats.todayProfit < 0,
        cashNegative: false,
      };
    }
    return {
      cash: formatCurrency(stats.cashAvailable, currency),
      gross: formatCurrency(stats.grossProfit, currency),
      net: formatCurrency(stats.netProfit, currency),
      netNegative: stats.netProfit < 0,
      grossNegative: stats.grossProfit < 0,
      cashNegative: stats.cashAvailable < 0,
    };
  }, [stats, view, currency]);

  // ─── Card reorder handlers ───
  const moveSection = useCallback((id: SectionId, dir: 'up' | 'down') => {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const newIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      saveOrder(next);
      return next;
    });
  }, []);

  const resetOrder = useCallback(() => {
    setOrder(DEFAULT_ORDER);
    saveOrder(DEFAULT_ORDER);
  }, []);

  // Render a section wrapper with optional edit-mode controls
  const renderSection = (id: SectionId, content: React.ReactNode, delay = 0) => (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`relative ${editing ? 'ring-2 ring-amber-400/60 rounded-3xl' : ''}`}
    >
      {editing && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 glass-strong rounded-full px-2 py-1 shadow-lg">
          <button
            onClick={() => moveSection(id, 'up')}
            className="w-6 h-6 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50 active:scale-90"
            aria-label={t('dashboard.moveUp')}
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={() => moveSection(id, 'down')}
            className="w-6 h-6 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50 active:scale-90"
            aria-label={t('dashboard.moveDown')}
          >
            <ChevronDown size={12} />
          </button>
        </div>
      )}
      {content}
    </motion.div>
  );

  // ─── Section renderers ───

  const financialSection = (
    <section className="space-y-3">
      {/* Today / Month toggle */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-600 dark:text-amber-100/70">
          {view === 'today' ? t('dashboard.today') : t('dashboard.thisMonth')}
        </p>
        <div className="glass rounded-full p-0.5 flex">
          <button
            onClick={() => setView('today')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
              view === 'today' ? 'glass-primary text-white' : 'text-stone-600 dark:text-amber-100/70'
            }`}
          >
            {t('dashboard.viewToday')}
          </button>
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
              view === 'month' ? 'glass-primary text-white' : 'text-stone-600 dark:text-amber-100/70'
            }`}
          >
            {t('dashboard.viewMonth')}
          </button>
        </div>
      </div>

      {/* Financial cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <FinCard
          icon={<Wallet size={15} />}
          label={t('dashboard.cashAvailable')}
          value={financialValues.cash}
          variant="success"
          sub={view === 'month' ? t('dashboard.cashAvailableDesc') : undefined}
        />
        <FinCard
          icon={<TrendingUp size={15} />}
          label={t('dashboard.grossProfit')}
          value={financialValues.gross}
          variant={financialValues.grossNegative ? 'danger' : 'info'}
        />
        <FinCard
          icon={<Coins size={15} />}
          label={t('dashboard.netProfit')}
          value={financialValues.net}
          variant={financialValues.netNegative ? 'danger' : 'primary'}
          sub={view === 'month' && stats ? `${t('expense.totalThisMonth')}: ${formatCurrency(stats.monthExpenses, currency)}` : undefined}
        />
      </div>
    </section>
  );

  const quickActionsSection = (
    <section className="glass rounded-2xl p-3">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <QuickAction icon={<Plus size={16} />} label="New Sale" onClick={onNewSale} variant="primary" />
        <QuickAction icon={<Package size={16} />} label="Add Stock" onClick={onAddStock} variant="info" />
        <QuickAction icon={<Truck size={16} />} label="Supplier" onClick={onSupplierPurchase} variant="info" />
        <QuickAction icon={<Receipt size={16} />} label="Collect" onClick={onCollectCredit} variant="success" />
        <QuickAction icon={<Tag size={16} />} label="Expense" onClick={onAddExpense} variant="danger" />
        <QuickAction icon={<FileText size={16} />} label="Report" onClick={onGenerateReport} variant="primary" />
      </div>
    </section>
  );

  const healthSection = stats && todayVsYesterday ? (
    <section className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-stone-800 dark:text-amber-50">{t('dashboard.netProfitHealth')}</h3>
        <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
          stats.todayNetProfit < 0 ? 'glass-danger text-white' :
          todayVsYesterday.up ? 'glass-success text-white' : 'glass text-stone-700 dark:text-amber-100'
        }`}>
          {stats.todayNetProfit < 0 ? t('dashboard.worstDay') :
           todayVsYesterday.up ? t('dashboard.goodDay') : t('dashboard.slowDay')}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {/* Today vs Yesterday */}
        <div className="glass rounded-xl p-2.5">
          <p className="text-[10px] text-stone-500 dark:text-amber-100/60">{t('dashboard.vsYesterday')}</p>
          {todayVsYesterday.noBaseline ? (
            <>
              <p className="text-sm font-bold text-stone-700 dark:text-amber-100">{formatCurrency(stats.todayNetProfit, currency)}</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400">{t('dashboard.newBaseline')}</p>
            </>
          ) : (
            <>
              <p className={`text-sm font-bold ${todayVsYesterday.up ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {todayVsYesterday.up ? '↑' : '↓'} {formatCurrency(Math.abs(todayVsYesterday.diff), currency)}
              </p>
              <p className="text-[10px] text-stone-500 dark:text-amber-100/50">
                {todayVsYesterday.pct !== null ? `${todayVsYesterday.up ? '+' : ''}${todayVsYesterday.pct.toFixed(1)}%` : t('dashboard.noComparison')}
              </p>
            </>
          )}
        </div>
        {/* Month vs Last Month */}
        <div className="glass rounded-xl p-2.5">
          <p className="text-[10px] text-stone-500 dark:text-amber-100/60">{t('dashboard.vsLastMonth')}</p>
          {monthVsLastMonth && monthVsLastMonth.noBaseline ? (
            <>
              <p className="text-sm font-bold text-stone-700 dark:text-amber-100">{formatCurrency(stats.monthNetProfit, currency)}</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400">{t('dashboard.newBaseline')}</p>
            </>
          ) : monthVsLastMonth ? (
            <>
              <p className={`text-sm font-bold ${monthVsLastMonth.up ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {monthVsLastMonth.up ? '↑' : '↓'} {formatCurrency(Math.abs(monthVsLastMonth.diff), currency)}
              </p>
              <p className="text-[10px] text-stone-500 dark:text-amber-100/50">
                {monthVsLastMonth.pct !== null ? `${monthVsLastMonth.up ? '+' : ''}${monthVsLastMonth.pct.toFixed(1)}%` : t('dashboard.noComparison')}
              </p>
            </>
          ) : (
            <p className="text-sm font-bold text-stone-500 dark:text-amber-100/60">—</p>
          )}
        </div>
      </div>
    </section>
  ) : null;

  const todaySalesSection = (
    <section className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-sm text-stone-800 dark:text-amber-50">{t('dashboard.todaySales')}</h3>
          <p className="text-[10px] text-stone-500 dark:text-amber-100/60">{formatDateShort(date)}</p>
        </div>
        {todayVsYesterday && !todayVsYesterday.noBaseline && (
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5 ${
            todayVsYesterday.up ? 'glass-success text-white' : todayVsYesterday.diff < 0 ? 'glass-danger text-white' : 'glass text-stone-700 dark:text-amber-100'
          }`}>
            {todayVsYesterday.up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {Math.abs(todayVsYesterday.diff) < 1 ? '—' : formatCurrency(Math.abs(todayVsYesterday.diff), currency)}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label={t('dashboard.todaySell')} value={stats ? formatCurrency(stats.todaySales, currency) : '—'} />
        <MiniStat
          label={t('dashboard.todayProfit')}
          value={stats ? formatCurrency(stats.todayProfit, currency) : '—'}
          negative={stats ? stats.todayProfit < 0 : false}
        />
        <MiniStat label={t('dashboard.todayEggs')} value={stats ? formatNumber(stats.todayItems) : '—'} />
      </div>
    </section>
  );

  const inventorySection = stats ? (
    <section className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${stats.outOfStockCount > 0 ? 'bg-amber-500' : 'glass-info'}`}>
            <Package size={14} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-stone-800 dark:text-amber-50">{t('inventory.title')}</h3>
            <p className="text-[10px] text-stone-500 dark:text-amber-100/60">
              {stats.totalProducts} {t('dashboard.totalProducts').toLowerCase()} · {t('dashboard.stockValue')}: {formatCurrency(stats.stockValue, currency)}
            </p>
          </div>
        </div>
        <button onClick={onOpenInventory} className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-0.5">
          {t('dashboard.seeAll')} <ChevronRight size={10} />
        </button>
      </div>
      {stats.outOfStockCount > 0 || stats.lowStockCount > 0 ? (
        <div className="glass rounded-xl p-2.5 flex items-center gap-2">
          <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
          <p className="text-[11px] text-stone-700 dark:text-amber-100">
            {stats.outOfStockCount} {t('inventory.outOfStockCount')} · {stats.lowStockCount} {t('inventory.lowStockCount')}
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-stone-500 dark:text-amber-100/60 text-center py-1.5">{t('dashboard.noStockAlerts')}</p>
      )}
    </section>
  ) : null;

  const duesSection = stats ? (
    <section className="grid grid-cols-2 gap-2.5">
      <button onClick={onOpenSuppliers} className="text-left active:scale-[0.98] transition-transform">
        <div className="glass rounded-2xl p-3 h-full">
          <div className="flex items-center gap-1.5 mb-1 opacity-80">
            <Truck size={13} className="text-stone-600 dark:text-amber-100/70" />
            <span className="text-[10px] text-stone-600 dark:text-amber-100/70">{t('dashboard.supplierPayments')}</span>
          </div>
          <p className={`text-base font-bold ${stats.supplierDue > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-stone-800 dark:text-amber-50'}`}>
            {formatCurrency(stats.supplierDue, currency)}
          </p>
          <p className="text-[9px] text-stone-500 dark:text-amber-100/50">{t('dashboard.outstandingAcross')}</p>
        </div>
      </button>
      <button onClick={onOpenCredit} className="text-left active:scale-[0.98] transition-transform">
        <div className="glass rounded-2xl p-3 h-full">
          <div className="flex items-center gap-1.5 mb-1 opacity-80">
            <Users size={13} className="text-stone-600 dark:text-amber-100/70" />
            <span className="text-[10px] text-stone-600 dark:text-amber-100/70">{t('dashboard.customerDue')}</span>
          </div>
          <p className={`text-base font-bold ${stats.customerDue > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-stone-800 dark:text-amber-50'}`}>
            {formatCurrency(stats.customerDue, currency)}
          </p>
          <p className="text-[9px] text-stone-500 dark:text-amber-100/50">{t('dashboard.outstandingCredit')}</p>
        </div>
      </button>
    </section>
  ) : null;

  // Map section IDs to rendered content
  const sectionMap: Record<SectionId, React.ReactNode> = {
    financials: financialSection,
    quickActions: quickActionsSection,
    health: healthSection,
    todaySales: todaySalesSection,
    inventory: inventorySection,
    dues: duesSection,
  };

  let delayIdx = 0;

  return (
    <div className="app-shell pb-28">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-30 safe-top">
        <div className="px-4 py-3 flex items-center gap-3 max-w-5xl mx-auto w-full">
          <div className="w-10 h-10 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg">
            <img src="/icons/icon-1024.png" alt="ShopSuite" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-stone-800 dark:text-amber-50 truncate">
              {shopName || t('app.name')}
            </h1>
            <p className="text-[11px] text-stone-600 dark:text-amber-100/70 truncate">
              {t(greetingKey())}{ownerName ? `, ${ownerName}` : ''}
            </p>
          </div>
          <button
            onClick={() => setEditing((e) => !e)}
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform ${
              editing ? 'glass-primary text-white' : 'glass text-stone-700 dark:text-amber-50'
            }`}
            aria-label={t('dashboard.customize')}
          >
            {editing ? <Check size={16} /> : <Pencil size={14} />}
          </button>
          <button
            onClick={onOpenSettings}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50 active:scale-90 transition-transform"
            aria-label={t('settings.title')}
          >
            <SettingsIcon size={16} />
          </button>
        </div>
        {editing && (
          <div className="px-4 pb-2 max-w-5xl mx-auto w-full flex items-center justify-between">
            <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">{t('dashboard.editLayout')}</p>
            <button onClick={resetOrder} className="text-[11px] text-stone-500 dark:text-amber-100/60 font-semibold">
              Reset
            </button>
          </div>
        )}
      </header>

      <main className="px-4 py-4 space-y-3 max-w-5xl mx-auto w-full">
        {/* Reorderable sections */}
        {order.map((id) => {
          const content = sectionMap[id];
          if (!content) return null;
          const el = renderSection(id, content, Math.min(delayIdx * 0.03, 0.3));
          delayIdx++;
          return el;
        })}

        {/* 7-day profit chart (always after reorderable sections) */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-sm text-stone-800 dark:text-amber-50">{t('trend.monthlyProfit')}</h3>
              <p className="text-[10px] text-stone-500 dark:text-amber-100/60">{t('dashboard.last5ProfitSub')}</p>
            </div>
            <button
              onClick={onSeeAllReports}
              className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-0.5"
            >
              {t('dashboard.seeAll')} <ChevronRight size={10} />
            </button>
          </div>
          {last7.length > 0 ? (
            <div className="h-40 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,113,108,0.15)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'currentColor' }} axisLine={false} tickLine={false} className="text-stone-500" />
                  <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} axisLine={false} tickLine={false} className="text-stone-500" />
                  <Tooltip
                    cursor={{ fill: 'rgba(245,158,11,0.1)' }}
                    contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(value: any) => [formatCurrency(Number(value), currency), t('dashboard.todayProfit')]}
                  />
                  <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
                    {last7.map((entry, i) => (
                      <Cell key={i} fill={entry.profit < 0 ? '#ef4444' : '#f59e0b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-stone-500 dark:text-amber-100/60 text-sm">
              {t('dashboard.noData')}
            </div>
          )}
        </motion.section>

        {/* Top selling product */}
        {stats && stats.topProduct && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="glass rounded-2xl p-3 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl glass-success flex items-center justify-center text-white flex-shrink-0">
              <Crown size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-stone-500 dark:text-amber-100/60">{t('dashboard.topSellingProduct')}</p>
              <p className="font-bold text-sm text-stone-800 dark:text-amber-50 truncate">{stats.topProduct.name}</p>
              <p className="text-[10px] text-stone-600 dark:text-amber-100/70">
                {formatNumber(stats.topProduct.qty)} {t('dashboard.units')} · {formatCurrency(stats.topProduct.profit, currency)}
              </p>
            </div>
          </motion.section>
        )}

        {/* Quick links */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="grid grid-cols-2 gap-2.5"
        >
          <button
            onClick={onOpenInventory}
            className="glass rounded-2xl p-3 flex items-center gap-2.5 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl glass-primary flex items-center justify-center text-white flex-shrink-0">
              <Package size={15} />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="font-bold text-xs text-stone-800 dark:text-amber-50">{t('inventory.title')}</p>
              <p className="text-[10px] text-stone-600 dark:text-amber-100/70 truncate">{t('inventory.sub')}</p>
            </div>
            <ChevronRight size={14} className="text-stone-400 dark:text-amber-100/40" />
          </button>
          <button
            onClick={onOpenExpenses}
            className="glass rounded-2xl p-3 flex items-center gap-2.5 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl glass-info flex items-center justify-center text-white flex-shrink-0">
              <ShoppingBag size={15} />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="font-bold text-xs text-stone-800 dark:text-amber-50">{t('expense.title')}</p>
              <p className="text-[10px] text-stone-600 dark:text-amber-100/70 truncate">{t('expense.sub')}</p>
            </div>
            <ChevronRight size={14} className="text-stone-400 dark:text-amber-100/40" />
          </button>
        </motion.section>
      </main>
    </div>
  );
}

// ─── Compact financial card ──────────────────────────────────────────────────

function FinCard({ icon, label, value, variant, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  variant: 'primary' | 'success' | 'info' | 'muted' | 'danger';
  sub?: string;
}) {
  const colorMap = {
    primary: 'glass-primary',
    success: 'glass-success',
    info: 'glass-info',
    muted: 'glass text-stone-800 dark:text-amber-50',
    danger: 'glass-danger',
  };
  return (
    <div className={`${colorMap[variant]} rounded-2xl p-3`}>
      <div className="flex items-center gap-1.5 mb-1 opacity-90">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="text-lg font-bold leading-tight">{value}</p>
      {sub && <p className="text-[9px] opacity-80 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

// ─── Mini stat for Today's Sales ──────────────────────────────────────────────

function MiniStat({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="glass rounded-xl p-2.5">
      <p className="text-[10px] text-stone-500 dark:text-amber-100/60">{label}</p>
      <p className={`text-sm font-bold ${negative ? 'text-red-600 dark:text-red-400' : 'text-stone-800 dark:text-amber-50'}`}>
        {value}
      </p>
    </div>
  );
}

// ─── Quick action button ─────────────────────────────────────────────────────

function QuickAction({ icon, label, onClick, variant }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant: 'primary' | 'success' | 'info' | 'danger';
}) {
  const colorMap = {
    primary: 'glass-primary',
    success: 'glass-success',
    info: 'glass-info',
    danger: 'glass-danger',
  };
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-2 rounded-xl glass active:scale-95 transition-transform"
    >
      <div className={`w-9 h-9 rounded-lg ${colorMap[variant]} flex items-center justify-center text-white`}>
        {icon}
      </div>
      <span className="text-[9px] font-semibold text-stone-700 dark:text-amber-100 text-center leading-tight">{label}</span>
    </button>
  );
}
