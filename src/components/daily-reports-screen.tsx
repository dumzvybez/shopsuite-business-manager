'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, ChevronRight, X, Pencil, Trash2, FileBarChart, Download, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import {
  getDayRecordsForRange, getDayRecord, getSalesForDate, getPriceSessionsForDate,
  getExpensesForDateRange, getDamagesForDate,
  setDayClosed, recalcDay, deleteSale, getCategories, useI18n,
  todayStr, addDays, formatCurrency, formatNumber, formatQuantity,
  type DayRecord, type Sale, type PriceSession, type EggCategory, type Expense, type DamageRecord,
} from '@/lib/data-hooks-adapter';
import { formatDate, formatDateShort, formatMonth } from '@/lib/sinhala';
import { useAppToast } from './toast-provider';

type Props = {
  onBack: () => void;
  onEditDay?: (date: string) => void;
  onOpenPdf?: () => void;
  onOpenMonthly?: () => void;
  currency: string;
};

export function DailyReportsScreen({ onBack, onEditDay, onOpenPdf, onOpenMonthly, currency }: Props) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { toast } = useAppToast();

  const refresh = async () => {
    setLoading(true);
    const today = todayStr();
    const start = addDays(today, -90);
    const recs = await getDayRecordsForRange(start, today);
    setRecords(recs);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    let r = records;
    if (filterMonth) {
      r = r.filter((x) => x.date.startsWith(filterMonth));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      r = r.filter((x) => x.date.includes(q) || formatDate(x.date, lang).toLowerCase().includes(q));
    }
    return r;
  }, [records, query, filterMonth, lang]);

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
            <h1 className="text-lg font-bold text-stone-800 dark:text-amber-50">{t('reports.dailyTitle')}</h1>
            <p className="text-xs text-stone-600 dark:text-amber-100/70">{t('reports.dailySub')}</p>
          </div>
          {onOpenPdf && (
            <>
              <button
                onClick={async () => {
                  try {
                    const { exportSalesCSV, downloadTextFile } = await import('@/lib/db');
                    const csv = await exportSalesCSV(addDays(todayStr(), -90), todayStr());
                    downloadTextFile(`shopsuite-sales-${todayStr()}.csv`, csv);
                  } catch (e: any) { /* ignore */ }
                }}
                className="w-10 h-10 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50 active:scale-90 transition-transform"
                aria-label="Export CSV"
              >
                <Download size={18} />
              </button>
              <button
                onClick={onOpenPdf}
                className="w-10 h-10 rounded-full glass-primary flex items-center justify-center text-white active:scale-90 transition-transform"
                aria-label={t('pdf.title')}
              >
                <FileBarChart size={18} />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Sub-nav: Daily / Monthly / PDF */}
        <div className="glass rounded-2xl p-1 grid grid-cols-3 gap-1">
          <button className="py-2 rounded-xl text-xs font-bold glass-primary text-white">
            {t('reports.dailyTitle')}
          </button>
          {onOpenMonthly && (
            <button
              onClick={onOpenMonthly}
              className="py-2 rounded-xl text-xs font-semibold text-stone-700 dark:text-amber-100"
            >
              {t('monthly.title')}
            </button>
          )}
          {onOpenPdf && (
            <button
              onClick={onOpenPdf}
              className="py-2 rounded-xl text-xs font-semibold text-stone-700 dark:text-amber-100"
            >
              {t('pdf.title')}
            </button>
          )}
        </div>

        {/* Search & filter */}
        <div className="glass-strong rounded-2xl p-3 space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('reports.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-sm text-stone-800 dark:text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scroll-area">
            <button
              onClick={() => setFilterMonth('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 ${!filterMonth ? 'glass-primary text-white' : 'glass text-stone-700 dark:text-amber-100'}`}
            >
              {t('common.all')}
            </button>
            {getLast6Months(lang).map((m) => (
              <button
                key={m.value}
                onClick={() => setFilterMonth(m.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 ${filterMonth === m.value ? 'glass-primary text-white' : 'glass text-stone-700 dark:text-amber-100'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Records list */}
        {loading ? (
          <div className="glass rounded-2xl p-8 text-center text-stone-500 dark:text-amber-100/60 text-sm">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-stone-500 dark:text-amber-100/60 text-sm">
            {t('reports.noRecords')}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r, i) => (
              <motion.div
                key={r.date}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
                onClick={() => setSelectedDate(r.date)}
                className="glass rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                  r.status === 'closed' ? 'glass text-stone-600 dark:text-amber-100/60' : 'glass-primary text-white'
                }`}>
                  <span className="text-[10px] leading-none opacity-90">{formatDateShort(r.date, lang).split(' ')[0]}</span>
                  <span className="text-base font-bold leading-tight">{r.date.split('-')[2]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-stone-800 dark:text-amber-50">{formatDate(r.date, lang)}</p>
                  <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-amber-100/70 mt-0.5">
                    {r.status === 'closed' ? (
                      <span className="px-2 py-0.5 rounded-full bg-stone-200/60 dark:bg-white/10 text-stone-600 dark:text-amber-100/70">{t('reports.closed')}</span>
                    ) : (
                      <>
                        <span>{formatQuantity(r.totalItems != null ? r.totalItems : (r as any).totalEggs)} {t('common.units')}</span>
                        <span>·</span>
                        <span>{r.saleCount} {t('reports.salesCount')}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-bold text-sm ${r.totalProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                    {r.status === 'closed' ? '—' : formatCurrency(r.totalProfit, currency)}
                  </p>
                  <ChevronRight size={14} className="text-stone-400 ml-auto mt-1" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Day detail drawer */}
      <DayDetailDrawer
        date={selectedDate}
        onClose={() => setSelectedDate(null)}
        onEditDay={(d) => { setSelectedDate(null); onEditDay?.(d); }}
        onChanged={refresh}
        currency={currency}
      />
    </div>
  );
}

function DayDetailDrawer({ date, onClose, onEditDay, onChanged, currency }: {
  date: string | null;
  onClose: () => void;
  onEditDay: (date: string) => void;
  onChanged: () => void;
  currency: string;
}) {
  const { t, lang } = useI18n();
  const { toast } = useAppToast();
  const [day, setDay] = useState<DayRecord | undefined>(undefined);
  const [sales, setSales] = useState<Sale[]>([]);
  const [sessions, setSessions] = useState<PriceSession[]>([]);
  const [products, setCategories] = useState<EggCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [damages, setDamages] = useState<DamageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!date) return;
    (async () => {
      setLoading(true);
      const [d, s, p, c, exp, dmg] = await Promise.all([
        getDayRecord(date),
        getSalesForDate(date),
        getPriceSessionsForDate(date),
        getCategories(),
        getExpensesForDateRange(date, date),
        getDamagesForDate(date),
      ]);
      setDay(d);
      setSales(s);
      setSessions(p);
      setCategories(c);
      setExpenses(exp);
      setDamages(dmg);
      setLoading(false);
    })();
  }, [date]);

  if (!date) return null;

  const handleToggleClosed = async () => {
    if (!day) return;
    await setDayClosed(date, day.status !== 'closed');
    await recalcDay(date);
    toast({ title: day.status === 'closed' ? t('reports.openToast') : t('reports.closedToast'), variant: 'success' });
    onChanged();
    onClose();
  };

  const handleDeleteSale = async (sale: Sale) => {
    if (!confirm(t('reports.deleteSaleConfirm'))) return;
    await deleteSale(sale.id, `Sale deleted for ${date}`);
    await recalcDay(date);
    toast({ title: t('calc.deleted.title'), variant: 'success' });
    const [d, s] = await Promise.all([getDayRecord(date), getSalesForDate(date)]);
    setDay(d); setSales(s);
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full sm:max-w-lg max-h-[92vh] glass-strong rounded-3xl overflow-hidden flex flex-col"
      >
        <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-white/30">
          <div>
            <h2 className="text-xl font-bold text-stone-800 dark:text-amber-50">{formatDate(date, lang)}</h2>
            <p className="text-xs text-stone-600 dark:text-amber-100/70">{t('reports.dayDetail')}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50 active:scale-90 transition-transform">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto scroll-area px-5 py-4 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-2">
                <SummaryBox label={t('reports.totalSell')} value={day ? formatCurrency(day.totalSell, currency) : '—'} color="info" />
                <SummaryBox label={t('reports.totalBuy')} value={day ? formatCurrency(day.totalBuy, currency) : '—'} color="muted" />
                <SummaryBox label={t('reports.totalProfit')} value={day ? formatCurrency(day.totalProfit, currency) : '—'} color={day && day.totalProfit < 0 ? 'danger' : 'success'} />
                <SummaryBox label={t('monthly.netProfit')} value={day ? formatCurrency(day.totalProfit - expenses.reduce((a, e) => a + e.amount, 0) - (day.totalDamageCost || 0), currency) : '—'} color={day && (day.totalProfit - expenses.reduce((a, e) => a + e.amount, 0) - (day.totalDamageCost || 0)) < 0 ? 'danger' : 'success'} />
                <SummaryBox label={t('monthly.expenses')} value={formatCurrency(expenses.reduce((a, e) => a + e.amount, 0), currency)} color="muted" />
                <SummaryBox label={t('monthly.damageImpact')} value={day ? formatCurrency(day.totalDamageCost || 0, currency) : '—'} color={day && (day.totalDamageCost || 0) > 0 ? 'danger' : 'muted'} />
                <SummaryBox label={t('dashboard.cashAvailable')} value={day ? formatCurrency(day.totalSell - expenses.reduce((a, e) => a + e.amount, 0), currency) : '—'} color="primary" />
                <SummaryBox label={t('reports.totalSold')} value={day ? formatQuantity(day.totalItems != null ? day.totalItems : (day as any).totalEggs) : '0'} color="primary" />
              </div>

              {/* Status */}
              <div className="glass rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-600 dark:text-amber-100/70">{t('reports.status')}</p>
                  <p className="font-semibold text-stone-800 dark:text-amber-50">
                    {day?.status === 'closed' ? t('reports.closed') : t('reports.open')}
                  </p>
                </div>
                <button
                  onClick={handleToggleClosed}
                  className="px-3 py-1.5 rounded-lg glass-primary text-white text-xs font-semibold active:scale-95 transition-transform"
                >
                  {day?.status === 'closed' ? t('reports.markOpen') : t('reports.markClosed')}
                </button>
              </div>

              {/* Items Sold — per-product summary */}
              {sales.length > 0 && (
                <div>
                  <h3 className="font-bold text-stone-800 dark:text-amber-50 mb-2">{t('reports.itemsSold')}</h3>
                  <div className="glass rounded-2xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-stone-600 dark:text-amber-100/70 border-b border-white/20 dark:border-white/10">
                          <th className="text-left py-2 px-3 font-semibold">{t('pdf.report.eggType')}</th>
                          <th className="text-right py-2 px-3 font-semibold">{t('common.quantity')}</th>
                          <th className="text-right py-2 px-3 font-semibold">{t('common.revenue')}</th>
                          <th className="text-right py-2 px-3 font-semibold">{t('common.profit')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const byProduct = new Map<string, { qty: number; revenue: number; profit: number }>();
                          for (const s of sales) {
                            const cur = byProduct.get(s.productId) || { qty: 0, revenue: 0, profit: 0 };
                            cur.qty += s.quantity;
                            cur.revenue += s.sellPrice * s.quantity;
                            cur.profit += s.profit;
                            byProduct.set(s.productId, cur);
                          }
                          return Array.from(byProduct.entries()).map(([pid, v]) => {
                            const cat = products.find((c) => c.id === pid);
                            return (
                              <tr key={pid} className="border-b border-white/10 dark:border-white/5 last:border-0">
                                <td className="py-2 px-3 text-stone-800 dark:text-amber-50">
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-3 rounded-full flex-shrink-0" style={{ background: cat?.color }} />
                                    <span className="font-semibold">{cat?.name || pid}</span>
                                  </span>
                                </td>
                                <td className="text-right py-2 px-3 text-stone-700 dark:text-amber-100 font-semibold">{formatQuantity(v.qty)}</td>
                                <td className="text-right py-2 px-3 text-stone-700 dark:text-amber-100">{formatCurrency(v.revenue, currency)}</td>
                                <td className={`text-right py-2 px-3 font-bold ${v.profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{formatCurrency(v.profit, currency)}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Product sales chart */}
              {sales.length > 0 && (() => {
                const byProduct = new Map<string, { name: string; revenue: number; qty: number; color: string }>();
                for (const s of sales) {
                  const cat = products.find((c) => c.id === s.productId);
                  const cur = byProduct.get(s.productId) || { name: cat?.name || s.productId, revenue: 0, qty: 0, color: cat?.color || '#f59e0b' };
                  cur.revenue += s.sellPrice * s.quantity;
                  cur.qty += s.quantity;
                  byProduct.set(s.productId, cur);
                }
                const chartData = Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue);
                return (
                  <div>
                    <h3 className="font-bold text-stone-800 dark:text-amber-50 mb-2 flex items-center gap-1.5">
                      <BarChart3 size={14} className="text-amber-500" /> {t('reports.productSalesChart')}
                    </h3>
                    <div className="glass rounded-2xl p-3 h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,113,108,0.15)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'currentColor' }} axisLine={false} tickLine={false} className="text-stone-500" interval={0} angle={-15} textAnchor="end" height={40} />
                          <YAxis tick={{ fontSize: 9, fill: 'currentColor' }} axisLine={false} tickLine={false} className="text-stone-500" />
                          <Tooltip
                            cursor={{ fill: 'rgba(245,158,11,0.1)' }}
                            contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', fontSize: '11px' }}
                            formatter={(v: any, n: any) => [n === 'revenue' ? formatCurrency(Number(v), currency) : formatQuantity(Number(v)), n === 'revenue' ? t('common.revenue') : t('common.quantity')]}
                          />
                          <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}

              {/* Sales list */}
              <div>
                <h3 className="font-bold text-stone-800 dark:text-amber-50 mb-2">{t('reports.salesCount')} ({sales.length})</h3>
                {sales.length === 0 ? (
                  <div className="glass rounded-2xl p-4 text-center text-stone-500 dark:text-amber-100/60 text-sm">{t('reports.noSales')}</div>
                ) : (
                  <div className="space-y-2">
                    {sales.slice().sort((a, b) => a.createdAt - b.createdAt).map((sale) => {
                      const cat = products.find((c) => c.id === sale.productId);
                      return (
                        <div key={sale.id} className="glass rounded-2xl p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-6 rounded-full" style={{ background: cat?.color }} />
                              <p className="font-semibold text-sm text-stone-800 dark:text-amber-50">{cat?.name}</p>
                            </div>
                            <span className="text-[10px] text-stone-500 dark:text-amber-100/50">{t('calc.sessionN', { n: sale.sessionIndex + 1 })}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-xs text-stone-600 dark:text-amber-100/70">
                            <div>
                              <p className="opacity-70">{t('common.quantity')}</p>
                              <p className="font-semibold text-stone-800 dark:text-amber-50">{formatNumber(sale.quantity)}</p>
                            </div>
                            <div>
                              <p className="opacity-70">{t('price.buyPrice')}</p>
                              <p className="font-semibold text-stone-800 dark:text-amber-50">{formatCurrency(sale.buyPrice, currency)}</p>
                            </div>
                            <div>
                              <p className="opacity-70">{t('price.sellPrice')}</p>
                              <p className="font-semibold text-stone-800 dark:text-amber-50">{formatCurrency(sale.sellPrice, currency)}</p>
                            </div>
                            <div>
                              <p className="opacity-70">{t('reports.totalProfit')}</p>
                              <p className={`font-bold ${sale.profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{formatCurrency(sale.profit, currency)}</p>
                            </div>
                          </div>
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => handleDeleteSale(sale)}
                              className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50/50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 size={12} /> {t('common.delete')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Price sessions */}
              {sessions.length > 0 && (
                <div>
                  <h3 className="font-bold text-stone-800 dark:text-amber-50 mb-2">{t('reports.priceSessions')} ({sessions.length})</h3>
                  <div className="space-y-1.5">
                    {sessions.map((s) => {
                      const cat = products.find((c) => c.id === s.productId);
                      const unavailable = s.buyPrice == null && s.sellPrice == null;
                      return (
                        <div key={s.id} className={`glass rounded-xl p-2.5 flex items-center gap-2 text-xs ${unavailable ? 'opacity-60' : ''}`}>
                          <div className="w-2 h-4 rounded-full" style={{ background: cat?.color }} />
                          <span className="font-semibold text-stone-800 dark:text-amber-50">
                            {cat?.name}
                            {unavailable && <span className="ml-1 text-stone-500">· {t('price.notAvailable')}</span>}
                          </span>
                          <span className="text-stone-500 dark:text-amber-100/50">· {t('calc.sessionN', { n: s.sessionIndex + 1 })}</span>
                          <span className="ml-auto text-stone-600 dark:text-amber-100/70">
                            {unavailable ? '' : `${t('price.buyPrice')} ${formatCurrency(s.buyPrice!, currency)} · ${t('price.sellPrice')} ${formatCurrency(s.sellPrice!, currency)}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {day?.lastEditedAt && (
                <p className="text-xs text-stone-500 dark:text-amber-100/50 text-center pt-2">
                  {t('reports.lastEdited')}: {new Date(day.lastEditedAt).toLocaleString('en-US')}
                </p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-white/30 glass-tint">
              <button
                onClick={() => onEditDay(date)}
                className="w-full glass-primary rounded-2xl py-3 font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Pencil size={16} /> {t('reports.editDay')}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

function SummaryBox({ label, value, color }: { label: string; value: string; color: 'primary' | 'success' | 'info' | 'muted' | 'danger' }) {
  const colorMap = {
    primary: 'glass-primary',
    success: 'glass-success',
    info: 'glass-info',
    muted: 'glass text-stone-800 dark:text-amber-50',
    danger: 'glass-danger',
  };
  return (
    <div className={`${colorMap[color]} rounded-xl p-2.5`}>
      <p className="text-[10px] opacity-90">{label}</p>
      <p className="font-bold text-sm mt-0.5">{value}</p>
    </div>
  );
}

function getLast6Months(lang: string): { value: string; label: string }[] {
  const today = new Date();
  const months: { value: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = formatMonth(value, lang as any);
    months.push({ value, label });
  }
  return months;
}
