'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Phone, Egg, Wallet, Coins, TrendingUp, ShoppingBag,
  Check, X, Clock, ChevronRight, ChevronDown, Trash2, Package, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import {
  useSupplierData, useProducts, useI18n,
  saveSupplierPurchase, saveSupplierPayment, deleteSupplierPurchase,
  genId, todayStr, formatCurrency, formatNumber,
  type SupplierPurchase, type SupplierPayment,
} from '@/lib/data-hooks-adapter';
import { getSupplier } from '@/lib/db';
import { useAppToast } from './toast-provider';
import { formatDate } from '@/lib/sinhala';
import type { Supplier } from '@/lib/db';

type Props = {
  supplierId: string;
  onBack: () => void;
  currency: string;
};

type LineItem = {
  productId: string;
  quantity: string;
  pricePerEgg: string;
};

export function SupplierProfileScreen({ supplierId, onBack, currency }: Props) {
  const { t, lang } = useI18n();
  const { products } = useProducts();
  const { summary, purchaseGroups, payments, loading, refresh } = useSupplierData(supplierId);
  const { toast } = useAppToast();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showLifetimeStats, setShowLifetimeStats] = useState(false);

  useEffect(() => {
    getSupplier(supplierId).then(s => setSupplier(s || null));
  }, [supplierId, purchaseGroups]);

  // Active vs paid purchase groups
  const activeGroups = useMemo(() => purchaseGroups.filter(g => !g.allPaid), [purchaseGroups]);
  const paidGroups = useMemo(() => purchaseGroups.filter(g => g.allPaid), [purchaseGroups]);

  // Chart data: egg type breakdown
  const eggTypeData = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of purchaseGroups) {
      for (const item of g.items) {
        map.set(item.productId, (map.get(item.productId) || 0) + item.quantity);
      }
    }
    return Array.from(map.entries()).map(([catId, qty]) => {
      const cat = products.find(c => c.id === catId);
      return {
        name: cat?.name || catId,
        value: qty,
        color: cat?.color || '#f59e0b',
      };
    });
  }, [purchaseGroups, products, t]);

  // Chart data: payment status
  const paymentStatusData = useMemo(() => {
    const totalCost = summary?.totalPurchaseAmount || 0;
    const totalPaid = summary?.totalPaid || 0;
    const remaining = summary?.remaining || 0;
    return [
      { name: t('supplier.totalPaid'), value: totalPaid, color: '#15803d' },
      { name: t('supplier.remaining'), value: remaining, color: '#dc2626' },
    ].filter(d => d.value > 0);
  }, [summary, t]);

  const handleDeletePurchase = async (p: SupplierPurchase) => {
    if (!confirm(`${t('common.delete')}? ${p.quantity} ${t('inventory.eggs')} — ${formatCurrency(p.totalCost, currency)}`)) return;
    await deleteSupplierPurchase(p.id);
    await refresh();
    toast({ title: t('toast.saved'), variant: 'success' });
  };

  if (loading || !supplier) {
    return (
      <div className="app-shell pb-28">
        <header className="glass-strong sticky top-0 z-30 safe-top">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={onBack} className="w-10 h-10 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50 active:scale-90 transition-transform" aria-label={t('common.back')}>
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-stone-800 dark:text-amber-50">{t('supplier.profile')}</h1>
            </div>
          </div>
        </header>
        <main className="px-4 py-8 max-w-2xl mx-auto w-full">
          <div className="glass rounded-2xl p-8 text-center text-stone-500 dark:text-amber-100/60 text-sm">{t('common.loading')}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell pb-28">
      <header className="glass-strong sticky top-0 z-30 safe-top">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50 active:scale-90 transition-transform" aria-label={t('common.back')}>
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-stone-800 dark:text-amber-50 truncate">{supplier.name}</h1>
            <p className="text-xs text-stone-600 dark:text-amber-100/70">{t('supplier.profile')}</p>
          </div>
          {supplier.phone && (
            <a href={`tel:${supplier.phone}`} className="w-10 h-10 rounded-full glass-success flex items-center justify-center text-white active:scale-90 transition-transform" aria-label={t('supplier.callSupplier')}>
              <Phone size={16} />
            </a>
          )}
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Supplier info card */}
        {supplier.phone && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-3 flex items-center gap-3"
          >
            <Phone size={16} className="text-stone-700 dark:text-amber-100/70" />
            <span className="text-sm text-stone-700 dark:text-amber-100/80">{supplier.phone}</span>
          </motion.section>
        )}
        {supplier.notes && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-3"
          >
            <p className="text-xs text-stone-600 dark:text-amber-100/70 mb-1">{t('supplier.notes')}</p>
            <p className="text-sm text-stone-800 dark:text-amber-50">{supplier.notes}</p>
          </motion.section>
        )}

        {/* Current Outstanding Balance — PRIMARY FOCUS */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-strong rounded-3xl p-5"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-stone-500 dark:text-amber-100/60">{t('supplier.currentDue')}</p>
              <p className="text-[10px] text-stone-400 dark:text-amber-100/40">{t('supplier.currentDueDesc')}</p>
            </div>
            <div className="w-10 h-10 rounded-xl glass-danger flex items-center justify-center text-white">
              <Wallet size={18} />
            </div>
          </div>
          <p className={`text-3xl font-bold ${(summary?.remaining || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
            {formatCurrency(summary?.remaining || 0, currency)}
          </p>
          {(summary?.remaining || 0) === 0 && (
            <p className="text-xs text-green-700 dark:text-green-400 mt-1 flex items-center gap-1">
              <Check size={12} /> {t('supplier.fullyPaid')}
            </p>
          )}
        </motion.section>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowPurchaseForm(true)}
            className="glass-primary rounded-2xl py-3.5 font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Plus size={18} /> {t('supplier.addPurchase')}
          </button>
          {activeGroups.length > 0 && (
            <button
              onClick={() => setShowPaymentForm(true)}
              className="glass-success rounded-2xl py-3.5 font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Wallet size={18} /> {t('supplier.addPayment')}
            </button>
          )}
        </div>

        {/* Charts */}
        {purchaseGroups.length > 0 && (
          <>
            {eggTypeData.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-strong rounded-3xl p-5"
              >
                <h3 className="font-bold text-stone-800 dark:text-amber-50 mb-3">{t('supplier.eggTypeBreakdown')}</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={eggTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={2}>
                        {eggTypeData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', fontSize: '12px' }}
                        formatter={(v: any, n: any) => [`${formatNumber(Number(v))} ${t('inventory.eggs')}`, n]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.section>
            )}

            {paymentStatusData.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass-strong rounded-3xl p-5"
              >
                <h3 className="font-bold text-stone-800 dark:text-amber-50 mb-3">{t('supplier.paymentStatus')}</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={2}>
                        {paymentStatusData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', fontSize: '12px' }}
                        formatter={(v: any, n: any) => [formatCurrency(Number(v), currency), n]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.section>
            )}
          </>
        )}

        {/* Purchase History (grouped) */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-strong rounded-3xl p-5"
        >
          <h3 className="font-bold text-stone-800 dark:text-amber-50 mb-3">
            {t('supplier.purchases')} ({purchaseGroups.length})
          </h3>
          {purchaseGroups.length === 0 ? (
            <div className="text-center text-stone-500 dark:text-amber-100/60 text-sm py-4">{t('supplier.purchasesEmpty')}</div>
          ) : (
            <div className="space-y-3">
              {purchaseGroups.map((g) => (
                <PurchaseGroupCard
                  key={g.groupId}
                  group={g}
                  products={products}
                  currency={currency}
                  t={t}
                  lang={lang}
                  onAddPayment={() => setShowPaymentForm(true)}
                  onDelete={async () => {
                    // Delete all items in the group
                    if (!confirm(`${t('common.delete')}?`)) return;
                    for (const item of g.items) {
                      await deleteSupplierPurchase(item.id);
                    }
                    await refresh();
                    toast({ title: t('toast.saved'), variant: 'success' });
                  }}
                />
              ))}
            </div>
          )}
        </motion.section>

        {/* Payment History */}
        {payments.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-strong rounded-3xl p-5"
          >
            <h3 className="font-bold text-stone-800 dark:text-amber-50 mb-3">{t('supplier.payments')} ({payments.length})</h3>
            <div className="space-y-1.5">
              {payments.map((pm) => (
                <div key={pm.id} className="glass rounded-xl p-2.5 flex items-center gap-2 text-xs">
                  <div className="w-7 h-7 rounded-lg glass-success flex items-center justify-center text-white flex-shrink-0">
                    <Check size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-800 dark:text-amber-50">{formatCurrency(pm.amount, currency)}</p>
                    <p className="text-stone-500 dark:text-amber-100/50 flex items-center gap-1">
                      <Clock size={10} /> {formatDate(pm.paymentDate, lang as any)} · {new Date(pm.paidAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Lifetime statistics (collapsible) */}
        {summary && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-strong rounded-3xl p-5"
          >
            <button
              onClick={() => setShowLifetimeStats(!showLifetimeStats)}
              className="w-full flex items-center justify-between"
            >
              <div>
                <h3 className="font-bold text-stone-800 dark:text-amber-50">{t('supplier.lifetimeStats')}</h3>
                <p className="text-xs text-stone-500 dark:text-amber-100/60">{t('supplier.lifetimeStatsDesc')}</p>
              </div>
              <ChevronDown size={18} className={`text-stone-400 dark:text-amber-100/40 transition-transform ${showLifetimeStats ? 'rotate-180' : ''}`} />
            </button>
            {showLifetimeStats && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <SummaryCard icon={<Egg size={16} />} label={t('supplier.totalEggsPurchased')} value={`${formatNumber(summary.totalEggsPurchased)}`} variant="primary" />
                <SummaryCard icon={<ShoppingBag size={16} />} label={t('supplier.purchaseCount')} value={`${summary.purchaseCount}`} variant="info" />
                <SummaryCard icon={<Coins size={16} />} label={t('supplier.totalPurchaseAmount')} value={formatCurrency(summary.totalPurchaseAmount, currency)} variant="muted" />
                <SummaryCard icon={<TrendingUp size={16} />} label={t('supplier.totalPaid')} value={formatCurrency(summary.totalPaid, currency)} variant="success" />
              </div>
            )}
          </motion.section>
        )}
      </main>

      {/* Add purchase modal — multi-egg */}
      <PurchaseForm
        open={showPurchaseForm}
        onClose={() => setShowPurchaseForm(false)}
        onSaved={() => { setShowPurchaseForm(false); refresh(); }}
        supplierId={supplierId}
        currency={currency}
      />

      {/* Add payment modal — accepts supplier-level total remaining */}
      <PaymentForm
        supplierId={supplierId}
        totalRemaining={summary?.remaining || 0}
        totalPaid={summary?.totalPaid || 0}
        totalCost={summary?.totalPurchaseAmount || 0}
        open={!!showPaymentForm}
        onClose={() => setShowPaymentForm(false)}
        onSaved={() => { setShowPaymentForm(false); refresh(); }}
        currency={currency}
        activePurchases={activeGroups.flatMap(g => g.items)}
      />
    </div>
  );
}

// ---------- Purchase group card (shows multiple egg types per delivery) ----------

function PurchaseGroupCard({ group, products, currency, t, lang, onAddPayment, onDelete }: {
  group: { groupId: string; date: string; at: number; items: SupplierPurchase[]; totalCost: number; totalEggs: number; totalPaid: number; totalRemaining: number; allPaid: boolean };
  products: any[];
  currency: string;
  t: (key: string, vars?: any) => string;
  lang: string;
  onAddPayment: () => void;
  onDelete: () => void;
}) {
  const paid = group.allPaid;
  return (
    <div className="glass rounded-2xl p-3.5">
      {/* Header: date + status */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl glass-primary flex items-center justify-center text-white flex-shrink-0">
            <Package size={16} />
          </div>
          <div>
            <p className="font-semibold text-sm text-stone-800 dark:text-amber-50">{formatDate(group.date, lang as any)}</p>
            <p className="text-[10px] text-stone-500 dark:text-amber-100/50">
              {formatNumber(group.totalEggs)} {t('inventory.eggs')} · {group.items.length} {t('supplier.lineItems')}
            </p>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${paid ? 'bg-green-500/20 text-green-700 dark:text-green-400' : group.totalPaid > 0 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-red-500/20 text-red-700 dark:text-red-400'}`}>
          {paid ? t('supplier.fullyPaid') : (group.totalPaid > 0 ? t('supplier.partiallyPaid') : t('supplier.unpaid'))}
        </span>
      </div>

      {/* Line items — one per egg type */}
      <div className="space-y-1.5 mb-2.5">
        {group.items.map((item) => {
          const cat = products.find(c => c.id === item.productId);
          return (
            <div key={item.id} className="flex items-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat?.color }} />
              <span className="font-semibold text-stone-800 dark:text-amber-50 flex-1">
                {cat?.name}
              </span>
              <span className="text-stone-600 dark:text-amber-100/70">
                {formatNumber(item.quantity)} {t('supplier.eggsAt')} {formatCurrency(item.pricePerEgg, currency)}
              </span>
              <span className="font-semibold text-stone-800 dark:text-amber-50 w-20 text-right">
                {formatCurrency(item.totalCost, currency)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="border-t border-white/30 dark:border-white/10 pt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-stone-500 dark:text-amber-100/50">{t('supplier.totalCost')}</p>
          <p className="font-bold text-stone-800 dark:text-amber-50">{formatCurrency(group.totalCost, currency)}</p>
        </div>
        <div>
          <p className="text-stone-500 dark:text-amber-100/50">{t('supplier.paidSoFar')}</p>
          <p className="font-bold text-green-700 dark:text-green-400">{formatCurrency(group.totalPaid, currency)}</p>
        </div>
        <div>
          <p className="text-stone-500 dark:text-amber-100/50">{t('supplier.remainingToPay')}</p>
          <p className={`font-bold ${group.totalRemaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{formatCurrency(group.totalRemaining, currency)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-2">
        {group.totalRemaining > 0 && (
          <button
            onClick={onAddPayment}
            className="text-xs text-green-700 dark:text-green-400 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg glass active:scale-95 transition-transform"
          >
            <Wallet size={12} /> {t('supplier.addPayment')}
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50/50 dark:hover:bg-red-900/20"
        >
          <Trash2 size={12} /> {t('common.delete')}
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, variant }: {
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

// ---------- Multi-egg purchase form ----------

function PurchaseForm({ open, onClose, onSaved, supplierId, currency }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  supplierId: string;
  currency: string;
}) {
  const { t } = useI18n();
  const { products } = useProducts();
  const { toast } = useAppToast();
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [paidNow, setPaidNow] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // Start with one empty line item
      setLineItems([{ productId: products[0]?.id || '', quantity: '', pricePerEgg: '' }]);
      setPaidNow('');
    }
  }, [open, products]);

  const parseNum = (s: string) => { const n = parseFloat(s); return isFinite(n) ? n : 0; };

  // Compute totals
  const validItems = lineItems.filter(li => li.productId && parseNum(li.quantity) > 0 && parseNum(li.pricePerEgg) > 0);
  const totalEggs = validItems.reduce((a, li) => a + parseNum(li.quantity), 0);
  const totalCost = validItems.reduce((a, li) => a + parseNum(li.quantity) * parseNum(li.pricePerEgg), 0);
  const paidN = parseNum(paidNow);
  const remaining = Math.max(0, totalCost - paidN);

  const addLineItem = () => {
    if (lineItems.length >= 6) return;
    // Find a category not yet used
    const usedIds = new Set(lineItems.map(li => li.productId));
    const nextCat = products.find(c => !usedIds.has(c.id));
    if (!nextCat) return;
    setLineItems([...lineItems, { productId: nextCat.id, quantity: '', pricePerEgg: '' }]);
  };

  const removeLineItem = (idx: number) => {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const updateLineItem = (idx: number, patch: Partial<LineItem>) => {
    setLineItems(lineItems.map((li, i) => (i === idx ? { ...li, ...patch } : li)));
  };

  const handleSave = async () => {
    if (validItems.length === 0) {
      toast({ title: t('supplier.err.qty'), variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const groupId = genId();
      const today = todayStr();
      const now = Date.now();
      // Distribute paidNow proportionally across items
      const perItemPaid = totalCost > 0 ? (paidN / totalCost) : 0;
      for (const li of validItems) {
        const qty = parseNum(li.quantity);
        const price = parseNum(li.pricePerEgg);
        const itemTotal = qty * price;
        const itemPaid = Math.min(itemTotal, itemTotal * perItemPaid);
        const purchase: SupplierPurchase = {
          id: genId(),
          supplierId,
          productId: li.productId,
          quantity: qty,
          pricePerEgg: price,
          totalCost: itemTotal,
          paidAmount: 0,
          remaining: itemTotal,
          status: 'active',
          purchaseDate: today,
          purchaseAt: now,
          purchaseGroupId: groupId,
        };
        await saveSupplierPurchase(purchase, itemPaid);
      }
      toast({
        title: t('supplier.purchaseSaved'),
        description: t('supplier.purchaseSavedDesc', { qty: formatNumber(totalEggs), amount: formatCurrency(totalCost, currency) }),
        variant: 'success',
      });
      onSaved();
    } catch (e: any) {
      toast({ title: t('toast.error'), description: e?.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full sm:max-w-lg glass-strong rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
            initial={{ scale: 0.95, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-white/30">
              <h2 className="text-lg font-bold text-stone-800 dark:text-amber-50">{t('supplier.addPurchase')}</h2>
              <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scroll-area px-5 py-4 space-y-3">
              <p className="text-xs text-stone-500 dark:text-amber-100/60">{t('supplier.multiEggHint')}</p>

              {/* Line items */}
              {lineItems.map((li, idx) => {
                const cat = products.find(c => c.id === li.productId);
                const usedIds = new Set(lineItems.map((l, i) => i !== idx ? l.productId : '').filter(Boolean));
                const availableCats = products.filter(c => !usedIds.has(c.id) || c.id === li.productId);
                const itemTotal = parseNum(li.quantity) * parseNum(li.pricePerEgg);
                return (
                  <div key={idx} className="glass rounded-2xl p-3 space-y-2 relative">
                    {lineItems.length > 1 && (
                      <button
                        onClick={() => removeLineItem(idx)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-lg glass-danger flex items-center justify-center text-white active:scale-90 transition-transform"
                        aria-label={t('common.delete')}
                      >
                        <X size={12} />
                      </button>
                    )}
                    {/* Category selector */}
                    <div className="flex gap-1.5 overflow-x-auto scroll-area pb-1">
                      {availableCats.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => updateLineItem(idx, { productId: c.id })}
                          className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                            li.productId === c.id ? 'glass-primary text-white' : 'glass text-stone-700 dark:text-amber-100'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                          {c.name}
                        </button>
                      ))}
                    </div>
                    {/* Qty + price */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-stone-600 dark:text-amber-100/70 mb-0.5 block">{t('supplier.quantity')}</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={li.quantity}
                          onChange={(e) => updateLineItem(idx, { quantity: e.target.value })}
                          placeholder="0"
                          className="w-full px-2.5 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-600 dark:text-amber-100/70 mb-0.5 block">{t('supplier.pricePerEgg')}</label>
                        <div className="relative">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={li.pricePerEgg}
                            onChange={(e) => updateLineItem(idx, { pricePerEgg: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-2.5 py-2 rounded-lg bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 text-[10px]">{currency}</span>
                        </div>
                      </div>
                    </div>
                    {/* Item total */}
                    {itemTotal > 0 && (
                      <p className="text-xs text-stone-600 dark:text-amber-100/70 text-right">
                        = <span className="font-bold text-stone-800 dark:text-amber-50">{formatCurrency(itemTotal, currency)}</span>
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Add line item button */}
              {lineItems.length < 6 && (
                <button
                  onClick={addLineItem}
                  className="w-full glass rounded-xl py-2 text-xs text-amber-700 dark:text-amber-300 font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                >
                  <Plus size={12} /> {t('supplier.addEggType')}
                </button>
              )}

              {/* Purchase summary */}
              {totalCost > 0 && (
                <div className="glass rounded-2xl p-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-600 dark:text-amber-100/70">{t('supplier.totalEggsInPurchase')}</span>
                    <span className="font-bold text-stone-800 dark:text-amber-50">{formatNumber(totalEggs)} {t('inventory.eggs')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-600 dark:text-amber-100/70">{t('supplier.totalCost')}</span>
                    <span className="font-bold text-stone-800 dark:text-amber-50">{formatCurrency(totalCost, currency)}</span>
                  </div>
                </div>
              )}

              {/* Paid now */}
              <div>
                <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('supplier.paidNow')} ({t('common.optional')})</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={paidNow}
                    onChange={(e) => setPaidNow(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-3 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">{currency}</span>
                </div>
              </div>

              {/* Remaining preview */}
              {totalCost > 0 && (
                <div className="glass-danger rounded-2xl p-3 flex items-center justify-between">
                  <span className="text-sm text-white">{t('supplier.remainingPayment')}</span>
                  <span className="text-lg font-bold text-white">{formatCurrency(remaining, currency)}</span>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-white/30 glass-tint grid grid-cols-2 gap-3">
              <button onClick={onClose} className="glass rounded-2xl py-3 font-semibold text-stone-700 dark:text-amber-100 active:scale-95 transition-transform">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || validItems.length === 0}
                className="glass-primary rounded-2xl py-3 font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
              >
                {saving ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={16} /> {t('common.save')}</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Add payment modal (supplier-level total remaining) ----------

function PaymentForm({ supplierId, totalRemaining, totalPaid, totalCost, open, onClose, onSaved, currency, activePurchases }: {
  supplierId: string;
  totalRemaining: number;
  totalPaid: number;
  totalCost: number;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  currency: string;
  activePurchases: SupplierPurchase[];
}) {
  const { t } = useI18n();
  const { toast } = useAppToast();
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setAmount('');
  }, [open]);

  const parseNum = (s: string) => { const n = parseFloat(s); return isFinite(n) ? n : 0; };
  const amountN = parseNum(amount);
  const newRemaining = Math.max(0, totalRemaining - amountN);
  const exceedsRemaining = amountN > totalRemaining + 0.01;

  const handleSave = async () => {
    if (amountN <= 0) {
      toast({ title: t('supplier.err.paymentAmount'), variant: 'warning' });
      return;
    }
    if (exceedsRemaining) {
      toast({ title: t('supplier.err.paymentExceeds'), variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      // Distribute the payment across active purchases (oldest first)
      let remainingToPay = amountN;
      // Sort active purchases by purchaseAt ascending (oldest first)
      const sorted = [...activePurchases].sort((a, b) => a.purchaseAt - b.purchaseAt);
      for (const p of sorted) {
        if (remainingToPay <= 0) break;
        if (p.remaining <= 0) continue;
        const payForThis = Math.min(p.remaining, remainingToPay);
        const payment: SupplierPayment = {
          id: genId(),
          supplierId,
          purchaseId: p.id,
          amount: payForThis,
          paymentDate: todayStr(),
          paidAt: Date.now(),
        };
        await saveSupplierPayment(payment);
        remainingToPay -= payForThis;
      }
      toast({
        title: t('supplier.paymentSaved'),
        description: t('supplier.paymentSavedDesc', { amount: formatCurrency(amountN, currency) }),
        variant: 'success',
      });
      onSaved();
    } catch (e: any) {
      toast({ title: t('toast.error'), description: e?.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full sm:max-w-md glass-strong rounded-3xl overflow-hidden"
            initial={{ scale: 0.95, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-white/30">
              <h2 className="text-lg font-bold text-stone-800 dark:text-amber-50">{t('supplier.addPayment')}</h2>
              <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {/* Supplier-level totals (not single purchase) */}
              <div className="glass rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-stone-600 dark:text-amber-100/70">{t('supplier.totalCost')}</span><span className="font-semibold text-stone-800 dark:text-amber-50">{formatCurrency(totalCost, currency)}</span></div>
                <div className="flex justify-between"><span className="text-stone-600 dark:text-amber-100/70">{t('supplier.paidSoFar')}</span><span className="font-semibold text-stone-800 dark:text-amber-50">{formatCurrency(totalPaid, currency)}</span></div>
                <div className="flex justify-between border-t border-white/30 dark:border-white/10 pt-1"><span className="text-stone-600 dark:text-amber-100/70">{t('supplier.remaining')}</span><span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(totalRemaining, currency)}</span></div>
              </div>
              <div>
                <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('supplier.paymentAmount')}</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    className={`w-full px-3 py-3 rounded-xl bg-white/70 dark:bg-white/5 border font-semibold text-lg focus:outline-none focus:ring-2 ${
                      exceedsRemaining ? 'border-red-300 focus:ring-red-400' : 'border-white/80 dark:border-white/10 focus:ring-amber-400'
                    } text-stone-800 dark:text-amber-50`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">{currency}</span>
                </div>
              </div>
              {/* Quick-fill button */}
              <button
                onClick={() => setAmount(String(totalRemaining))}
                className="w-full glass rounded-xl py-2 text-xs text-amber-700 dark:text-amber-300 font-semibold active:scale-95 transition-transform"
              >
                {t('supplier.markPurchasePaid')} ({formatCurrency(totalRemaining, currency)})
              </button>
              {amountN > 0 && !exceedsRemaining && (
                <div className="glass rounded-2xl p-3 flex items-center justify-between">
                  <span className="text-xs text-stone-600 dark:text-amber-100/70">{t('supplier.remainingToPay')}</span>
                  <span className={`font-bold text-sm ${newRemaining === 0 ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-300'}`}>
                    {newRemaining === 0 ? '✓ ' : ''}{formatCurrency(newRemaining, currency)}
                  </span>
                </div>
              )}
              {exceedsRemaining && (
                <div className="glass rounded-2xl p-3 border-red-300 bg-red-50/60 dark:bg-red-900/20 flex items-start gap-2">
                  <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={14} />
                  <p className="text-xs text-red-700 dark:text-red-300">{t('supplier.err.paymentExceeds')}</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-white/30 glass-tint grid grid-cols-2 gap-3">
              <button onClick={onClose} className="glass rounded-2xl py-3 font-semibold text-stone-700 dark:text-amber-100 active:scale-95 transition-transform">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || amountN <= 0 || exceedsRemaining}
                className="glass-success rounded-2xl py-3 font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
              >
                {saving ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={16} /> {t('common.save')}</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
