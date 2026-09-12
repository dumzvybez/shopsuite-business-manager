'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, Wallet, Award, AlertCircle, Receipt, PackageX, LineChart as LineChartIcon } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend,
  LineChart, Line,
} from 'recharts';
import {
  getMonthSummary, getDayRecordsForRange, getCategories, getSalesForDateRange, useI18n,
  formatCurrency, formatNumber, formatQuantity, formatDateShort,
  type MonthSummary, type DayRecord, type EggCategory, type Sale,
} from '@/lib/data-hooks-adapter';
import { formatMonth, SINHALA_MONTHS, ENGLISH_MONTHS } from '@/lib/sinhala';

type Props = {
  onBack: () => void;
  onOpenDaily?: () => void;
  onOpenPdf?: () => void;
  currency: string;
};

export function MonthlyReportsScreen({ onBack, onOpenDaily, onOpenPdf, currency }: Props) {
  const { t, lang } = useI18n();
  const today = new Date();
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [days, setDays] = useState<DayRecord[]>([]);
  const [products, setCategories] = useState<EggCategory[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, d, c, sl] = await Promise.all([
        getMonthSummary(month),
        getDayRecordsForRange(`${month}-01`, `${month}-31`),
        getCategories(),
        getSalesForDateRange(`${month}-01`, `${month}-31`),
      ]);
      setSummary(s);
      setDays(d.sort((a, b) => (a.date < b.date ? -1 : 1)));
      setCategories(c);
      setSales(sl);
      setLoading(false);
    })();
  }, [month]);

  const monthOptions = useMemo(() => {
    const monthsArr = ENGLISH_MONTHS;
    const opts: { value: string; label: string }[] = [];
    const tDate = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(tDate.getFullYear(), tDate.getMonth() - i, 1);
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${monthsArr[d.getMonth()]} ${d.getFullYear()}`,
      });
    }
    return opts;
  }, [lang]);

  const dayChartData = days
    .filter((d) => d.status !== 'closed' && d.saleCount > 0)
    .map((d) => ({
      date: parseInt(d.date.split('-')[2], 10),
      profit: d.totalProfit,
      label: `${d.date.split('-')[2]}`,
    }));

  const pieData = (summary?.perCategory || [])
    .filter((c) => c.totalItems > 0)
    .map((c) => {
      const cat = products.find((x) => x.id === c.productId);
      return {
        name: cat?.name || c.productId,
        value: c.totalItems,
        color: cat?.color || '#f59e0b',
      };
    });

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
            <h1 className="text-lg font-bold text-stone-800 dark:text-amber-50">{t('monthly.title')}</h1>
            <p className="text-xs text-stone-600 dark:text-amber-100/70">{formatMonth(month, lang)}</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Sub-nav: Daily / Monthly / PDF */}
        <div className="glass rounded-2xl p-1 grid grid-cols-3 gap-1">
          {onOpenDaily && (
            <button
              onClick={onOpenDaily}
              className="py-2 rounded-xl text-xs font-semibold text-stone-700 dark:text-amber-100"
            >
              {t('reports.dailyTitle')}
            </button>
          )}
          <button className="py-2 rounded-xl text-xs font-bold glass-primary text-white">
            {t('monthly.title')}
          </button>
          {onOpenPdf && (
            <button
              onClick={onOpenPdf}
              className="py-2 rounded-xl text-xs font-semibold text-stone-700 dark:text-amber-100"
            >
              {t('pdf.title')}
            </button>
          )}
        </div>

        {/* Month picker */}
        <div className="glass-strong rounded-2xl p-3">
          <div className="flex gap-2 overflow-x-auto scroll-area">
            {monthOptions.map((m) => (
              <button
                key={m.value}
                onClick={() => setMonth(m.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 ${
                  month === m.value ? 'glass-primary text-white' : 'glass text-stone-700 dark:text-amber-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="glass rounded-2xl p-8 text-center text-stone-500 dark:text-amber-100/60 text-sm">{t('common.loading')}</div>
        ) : !summary || (summary.openDays === 0 && summary.closedDays === 0) ? (
          <div className="glass rounded-2xl p-8 text-center text-stone-500 dark:text-amber-100/60 text-sm">
            {t('monthly.noMonthData', { month: formatMonth(month, lang) })}
          </div>
        ) : (
          <>
            {/* Top stats */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-strong rounded-3xl p-5"
            >
              <h2 className="font-bold text-stone-800 dark:text-amber-50 mb-3">{t('monthly.summary', { month: formatMonth(month, lang) })}</h2>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <BigStat icon={<TrendingUp size={16} />} label={t('monthly.totalProfit')} value={formatCurrency(summary.totalProfit, currency)} variant={summary.totalProfit < 0 ? 'danger' : 'success'} />
                <BigStat icon={<Award size={16} />} label={t('monthly.netProfit')} value={formatCurrency(summary.netProfit, currency)} variant={summary.netProfit < 0 ? 'danger' : 'success'} />
                <BigStat icon={<Wallet size={16} />} label={t('monthly.totalSell')} value={formatCurrency(summary.totalSell, currency)} variant="info" />
                <BigStat icon={<Wallet size={16} />} label={t('monthly.totalBuy')} value={formatCurrency(summary.totalBuy, currency)} variant="muted" />
                <BigStat icon={<Receipt size={16} />} label={t('monthly.expenses')} value={formatCurrency(summary.totalExpenses, currency)} variant="muted" />
                <BigStat icon={<PackageX size={16} />} label={t('monthly.damageImpact')} value={formatCurrency(summary.totalDamageCost, currency)} variant={summary.totalDamageCost > 0 ? 'danger' : 'muted'} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label={t('monthly.totalEggs')} value={formatQuantity(summary.totalItems)} />
                <MiniStat label={t('monthly.dailyAvg')} value={formatCurrency(summary.averageDailyProfit, currency)} />
                <MiniStat label={t('monthly.openDays')} value={`${summary.openDays}`} />
              </div>
            </motion.section>

            {/* Best / worst day */}
            {(summary.bestDay || summary.worstDay) && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="grid grid-cols-2 gap-3"
              >
                {summary.bestDay && (
                  <div className="glass-success rounded-2xl p-4">
                    <div className="flex items-center gap-1.5 text-xs opacity-90 mb-1">
                      <Award size={12} /> {t('monthly.bestDay')}
                    </div>
                    <p className="font-bold text-sm leading-tight">{formatDateShort(summary.bestDay.date, lang)}</p>
                    <p className="text-lg font-bold mt-1">{formatCurrency(summary.bestDay.profit, currency)}</p>
                  </div>
                )}
                {summary.worstDay && (
                  <div className="glass-danger rounded-2xl p-4">
                    <div className="flex items-center gap-1.5 text-xs opacity-90 mb-1">
                      <AlertCircle size={12} /> {t('monthly.worstDay')}
                    </div>
                    <p className="font-bold text-sm leading-tight">{formatDateShort(summary.worstDay.date, lang)}</p>
                    <p className="text-lg font-bold mt-1">{formatCurrency(summary.worstDay.profit, currency)}</p>
                  </div>
                )}
              </motion.section>
            )}

            {/* Daily profit chart */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-strong rounded-3xl p-5"
            >
              <h3 className="font-bold text-stone-800 dark:text-amber-50 mb-3">{t('monthly.dailyProfitChart')}</h3>
              {dayChartData.length > 0 ? (
                <div className="h-56 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayChartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,113,108,0.15)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'currentColor' }} axisLine={false} tickLine={false} className="text-stone-500" />
                      <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} axisLine={false} tickLine={false} className="text-stone-500" />
                      <Tooltip
                        cursor={{ fill: 'rgba(245,158,11,0.1)' }}
                        contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', fontSize: '12px' }}
                        formatter={(v: any) => [formatCurrency(Number(v), currency), t('reports.totalProfit')]}
                      />
                      <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                        {dayChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.profit < 0 ? '#ef4444' : '#f59e0b'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-stone-500 dark:text-amber-100/60 text-sm">{t('monthly.noChartData')}</div>
              )}
            </motion.section>

            {/* Per-category pie */}
            {pieData.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass-strong rounded-3xl p-5"
              >
                <h3 className="font-bold text-stone-800 dark:text-amber-50 mb-3">{t('monthly.categorySplit')}</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        innerRadius={40}
                        paddingAngle={2}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', fontSize: '12px' }}
                        formatter={(v: any, n: any) => [formatQuantity(Number(v)), n]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.section>
            )}

            {/* Product daily trend line chart */}
            {sales.length > 0 && (() => {
              // Build trend data: one entry per day of month, each with per-product qty
              const [y, m] = month.split('-').map(Number);
              const daysInMonth = new Date(y, m, 0).getDate();
              const trendData: { day: string; [productName: string]: number | string }[] = [];
              // Get products that have sales this month
              const productIds = new Set(sales.map(s => s.productId));
              const productInfos = Array.from(productIds).map(pid => {
                const p = products.find(x => x.id === pid);
                return { id: pid, name: p?.name || pid, color: p?.color || '#f59e0b' };
              });
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${month}-${String(d).padStart(2, '0')}`;
                const entry: { day: string; [k: string]: number | string } = { day: String(d) };
                for (const pi of productInfos) {
                  entry[pi.name] = 0;
                }
                const daySales = sales.filter(s => s.date === dateStr);
                for (const s of daySales) {
                  const pi = productInfos.find(p => p.id === s.productId);
                  if (pi) entry[pi.name] = (entry[pi.name] as number) + s.quantity;
                }
                // Only include days that have at least one sale
                const hasSales = daySales.length > 0;
                if (hasSales) trendData.push(entry);
              }
              if (trendData.length === 0) return null;
              return (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                  className="glass-strong rounded-3xl p-5"
                >
                  <h3 className="font-bold text-stone-800 dark:text-amber-50 mb-3 flex items-center gap-1.5">
                    <LineChartIcon size={14} className="text-amber-500" /> {t('reports.productTrendChart')}
                  </h3>
                  <p className="text-[10px] text-stone-500 dark:text-amber-100/60 mb-2">
                    {t('monthly.trendDesc', { month: formatMonth(month, lang) })}
                  </p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 5, right: 10, bottom: 0, left: -15 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,113,108,0.15)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'currentColor' }} axisLine={false} tickLine={false} className="text-stone-500" />
                        <YAxis tick={{ fontSize: 9, fill: 'currentColor' }} axisLine={false} tickLine={false} className="text-stone-500" />
                        <Tooltip
                          contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', fontSize: '11px' }}
                          formatter={(v: any, n: any) => [formatQuantity(Number(v)), n]}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
                        {productInfos.map((pi) => (
                          <Line key={pi.id} type="monotone" dataKey={pi.name} stroke={pi.color} strokeWidth={2} dot={{ r: 2, fill: pi.color }} activeDot={{ r: 4 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </motion.section>
              );
            })()}

            {/* Per-category table */}
            {summary.perCategory.filter(c => c.totalItems > 0).length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-strong rounded-3xl p-5"
              >
                <h3 className="font-bold text-stone-800 dark:text-amber-50 mb-3">{t('monthly.categoryDetail')}</h3>
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
                      {summary.perCategory.filter(c => c.totalItems > 0).map((c) => {
                        const cat = products.find((x) => x.id === c.productId);
                        return (
                          <tr key={c.productId} className="border-b border-white/10 dark:border-white/5 last:border-0">
                            <td className="py-2.5 px-3 text-stone-800 dark:text-amber-50">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-4 rounded-full flex-shrink-0" style={{ background: cat?.color }} />
                                <span className="font-semibold">{cat?.name}</span>
                              </span>
                            </td>
                            <td className="text-right py-2.5 px-3 text-stone-700 dark:text-amber-100 font-semibold">{formatQuantity(c.totalItems)}</td>
                            <td className="text-right py-2.5 px-3 text-stone-700 dark:text-amber-100">{formatCurrency(c.totalSell, currency)}</td>
                            <td className={`text-right py-2.5 px-3 font-bold ${c.totalProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{formatCurrency(c.totalProfit, currency)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function BigStat({ icon, label, value, variant }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  variant: 'primary' | 'success' | 'info' | 'muted' | 'danger';
}) {
  const colorMap = {
    primary: 'glass-primary',
    success: 'glass-success',
    info: 'glass-info',
    muted: 'glass text-stone-800 dark:text-amber-50',
    danger: 'glass-danger',
  };
  return (
    <div className={`${colorMap[variant]} rounded-2xl p-4`}>
      <div className="flex items-center gap-1.5 mb-1.5 opacity-90">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-bold leading-tight">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl py-2.5 px-2">
      <p className="text-[10px] text-stone-600 dark:text-amber-100/70 mb-0.5 leading-tight">{label}</p>
      <p className="font-bold text-sm text-stone-800 dark:text-amber-50 truncate">{value}</p>
    </div>
  );
}
