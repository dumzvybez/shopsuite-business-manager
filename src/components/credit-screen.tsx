'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Check, X, User, Egg, Coins, Wallet, History, Phone, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import {
  useProducts, useCredits, useI18n,
  getLatestPriceSessionForProduct,
  saveCredit, recordCreditPayment, getCreditPayments, genId, todayStr,
  type CreditRecord, type CreditPayment,
} from '@/lib/data-hooks-adapter';
import { useAppToast } from './toast-provider';
import { formatDate, formatNumber, formatCurrency } from '@/lib/sinhala';

type Props = {
  onBack: () => void;
  currency: string;
};

export function CreditScreen({ onBack, currency }: Props) {
  const { t, lang } = useI18n();
  const { products } = useProducts();
  const { active, paid, loading, refresh } = useCredits();
  const { toast } = useAppToast();

  const [tab, setTab] = useState<'active' | 'paid'>('active');
  const [showForm, setShowForm] = useState(false);
  const [paymentRecord, setPaymentRecord] = useState<CreditRecord | null>(null);
  const [historyRecord, setHistoryRecord] = useState<CreditRecord | null>(null);

  const totalRemaining = useMemo(
    () => active.reduce((a, c) => a + c.remaining, 0),
    [active]
  );

  return (
    <div className="app-shell pb-32">
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
            <h1 className="text-lg font-bold text-stone-800 dark:text-amber-50">{t('credit.title')}</h1>
            <p className="text-xs text-stone-600 dark:text-amber-100/70">{t('credit.sub')}</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-10 h-10 rounded-full glass-primary flex items-center justify-center text-white active:scale-90 transition-transform"
            aria-label={t('credit.add')}
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Summary */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-3xl p-5"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-danger rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-1.5 opacity-90">
                <Wallet size={14} />
                <span className="text-xs">{t('credit.totalCredit')}</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(totalRemaining, currency)}</p>
            </div>
            <div className="glass-primary rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-1.5 opacity-90">
                <User size={14} />
                <span className="text-xs">{t('credit.activeCount')}</span>
              </div>
              <p className="text-xl font-bold">{active.length}</p>
            </div>
          </div>
        </motion.section>

        {/* Tab switch */}
        <div className="glass rounded-2xl p-1 grid grid-cols-2 gap-1">
          <button
            onClick={() => setTab('active')}
            className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'active' ? 'glass-primary text-white' : 'text-stone-700 dark:text-amber-100/80'
            }`}
          >
            {t('credit.tabActive')} ({active.length})
          </button>
          <button
            onClick={() => setTab('paid')}
            className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'paid' ? 'glass-success text-white' : 'text-stone-700 dark:text-amber-100/80'
            }`}
          >
            {t('credit.tabPaid')} ({paid.length})
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="glass rounded-2xl p-8 text-center text-stone-500 text-sm">{t('common.loading')}</div>
        ) : tab === 'active' ? (
          active.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-stone-500 dark:text-amber-100/60 text-sm">
              {t('credit.noActive')}
            </div>
          ) : (
            <div className="space-y-2">
              {active.map((c, i) => {
                const cat = products.find(x => x.id === c.productId);
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    onClick={() => setPaymentRecord(c)}
                    className="glass rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <div className="w-12 h-12 rounded-xl glass-danger flex items-center justify-center text-white flex-shrink-0">
                      <User size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-stone-800 dark:text-amber-50 truncate">{c.customerName}</p>
                      <p className="text-xs text-stone-600 dark:text-amber-100/70 mt-0.5">
                        {cat?.name} · {formatNumber(c.quantity || 0)} · {formatDate(c.purchaseDate, lang)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm text-red-600 dark:text-red-400">{formatCurrency(c.remaining, currency)}</p>
                      <p className="text-[10px] text-stone-500">{t('credit.remaining')}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )
        ) : (
          paid.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-stone-500 dark:text-amber-100/60 text-sm">
              {t('credit.noPaid')}
            </div>
          ) : (
            <div className="space-y-2">
              {paid.map((c, i) => {
                const cat = products.find(x => x.id === c.productId);
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    onClick={() => setHistoryRecord(c)}
                    className="glass rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform opacity-80"
                  >
                    <div className="w-12 h-12 rounded-xl glass-success flex items-center justify-center text-white flex-shrink-0">
                      <Check size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-stone-800 dark:text-amber-50 truncate">{c.customerName}</p>
                      <p className="text-xs text-stone-600 dark:text-amber-100/70 mt-0.5">
                        {cat?.name} · {formatNumber(c.quantity || 0)} · {t('credit.purchaseDate')}: {formatDate(c.purchaseDate, lang)}
                      </p>
                      {c.paidAt && (
                        <p className="text-[10px] text-stone-500 mt-0.5">
                          {t('credit.paymentDate')}: {new Date(c.paidAt).toLocaleString('en-US')}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm text-green-700 dark:text-green-400">{formatCurrency(c.totalAmount, currency)}</p>
                      <p className="text-[10px] text-stone-500">{t('common.amount')}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )
        )}
      </main>

      {/* Add credit form */}
      <CreditForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); refresh(); }}
        currency={currency}
      />

      {/* Payment entry dialog (replaces old yes/no confirm) */}
      <PaymentDialog
        record={paymentRecord}
        onClose={() => setPaymentRecord(null)}
        onSaved={async () => { setPaymentRecord(null); await refresh(); }}
        currency={currency}
      />

      {/* Payment history dialog (for paid records) */}
      <HistoryDialog
        record={historyRecord}
        onClose={() => setHistoryRecord(null)}
        currency={currency}
      />
    </div>
  );
}

function CreditForm({ open, onClose, onSaved, currency }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  currency: string;
}) {
  const { t, lang } = useI18n();
  const { products } = useProducts();
  const { refresh } = useCredits();
  const { toast } = useAppToast();

  const [customerName, setCustomerName] = useState('');
  const [productId, setCategoryId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [paidNow, setPaidNow] = useState('');
  const [saving, setSaving] = useState(false);
  const [availableCats, setAvailableCats] = useState<typeof products>([]);

  // Default category = first available today
  useEffect(() => {
    if (!open) return;
    (async () => {
      // Reset
      setCustomerName(''); setQuantity(''); setSellPrice(''); setPaidNow('');
      // Build available-products list (only those with today's sell price set)
      const available: typeof products = [];
      for (const c of products) {
        const latest = await getLatestPriceSessionForProduct(todayStr(), c.id);
        if (latest && latest.sellPrice != null) {
          available.push(c);
        }
      }
      setAvailableCats(available);
      if (available.length > 0) {
        setCategoryId(available[0].id);
        const latest = await getLatestPriceSessionForProduct(todayStr(), available[0].id);
        if (latest && latest.sellPrice != null) setSellPrice(String(latest.sellPrice));
      } else {
        setCategoryId('');
        setSellPrice('');
      }
    })();
  }, [open, products]);

  // Auto-update sellPrice when category changes (pull today's price)
  useEffect(() => {
    if (!open || !productId) return;
    (async () => {
      const latest = await getLatestPriceSessionForProduct(todayStr(), productId);
      if (latest && latest.sellPrice != null) {
        setSellPrice(String(latest.sellPrice));
      }
    })();
  }, [productId, open]);

  const parseNum = (s: string) => { const n = parseFloat(s); return isFinite(n) ? n : 0; };
  const qtyN = parseNum(quantity);
  const priceN = parseNum(sellPrice);
  const total = qtyN * priceN;
  const paidN = parseNum(paidNow);
  const remaining = Math.max(0, total - paidN);

  const handleSave = async () => {
    if (!customerName.trim()) {
      toast({ title: t('credit.err.name'), variant: 'warning' });
      return;
    }
    if (qtyN <= 0) {
      toast({ title: t('credit.err.qty'), variant: 'warning' });
      return;
    }
    if (priceN <= 0) {
      toast({ title: t('credit.err.price'), variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const record: CreditRecord = {
        id: genId(),
        customerName: customerName.trim(),
        productId,
        quantity: qtyN,
        sellPrice: priceN,
        items: [{ productId, name: '', quantity: qtyN, unitPrice: priceN }],
        totalAmount: total,
        paidAmount: paidN,
        remaining,
        status: 'active',
        purchaseDate: todayStr(),
        purchaseAt: Date.now(),
      };
      await saveCredit(record);
      await refresh();
      toast({
        title: t('credit.saved.title'),
        description: t('credit.saved.desc', { name: customerName.trim(), amount: formatCurrency(remaining, currency) }),
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
            className="relative w-full sm:max-w-lg max-h-[92vh] glass-strong rounded-3xl overflow-hidden flex flex-col"
            initial={{ scale: 0.95, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-white/30">
              <div>
                <h2 className="text-xl font-bold text-stone-800 dark:text-amber-50">{t('credit.add')}</h2>
                <p className="text-xs text-stone-600 dark:text-amber-100/70 mt-0.5">{formatDate(todayStr(), lang)}</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50 active:scale-90 transition-transform">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scroll-area px-5 py-4 space-y-4">
              {/* Customer name */}
              <div>
                <label className="text-sm font-medium text-stone-700 dark:text-amber-100 mb-2 flex items-center gap-1.5">
                  <User size={14} /> {t('credit.customerName')}
                </label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t('credit.customerName.placeholder')}
                  className="w-full px-4 py-3 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Egg type */}
              <div>
                <label className="text-sm font-medium text-stone-700 dark:text-amber-100 mb-2 flex items-center gap-1.5">
                  <Egg size={14} /> {t('credit.eggType')}
                </label>
                {availableCats.length === 0 ? (
                  <div className="glass rounded-xl p-3 text-xs text-stone-600 dark:text-amber-100/70 text-center">
                    {false
                      ? 'No products have today\'s prices set. Use "Change Prices" first.'
                      : 'No egg products have today\'s prices set. Use "Change Prices" first.'}
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto scroll-area pb-1">
                    {availableCats.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCategoryId(c.id)}
                        className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${
                          productId === c.id ? 'glass-primary text-white' : 'glass text-stone-700 dark:text-amber-100/80'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity + sell price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('credit.quantity')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-3 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('credit.sellPrice')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-3 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">{currency}</span>
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="glass rounded-2xl p-3 flex items-center justify-between">
                <span className="text-sm text-stone-700 dark:text-amber-100">{t('credit.totalAmount')}</span>
                <span className="text-lg font-bold text-stone-800 dark:text-amber-50">{formatCurrency(total, currency)}</span>
              </div>

              {/* Paid now */}
              <div>
                <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('credit.paidNow')} ({t('common.optional')})</label>
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
              {total > 0 && (
                <div className="glass-danger rounded-2xl p-3 flex items-center justify-between">
                  <span className="text-sm text-white">{t('credit.remaining')}</span>
                  <span className="text-lg font-bold text-white">{formatCurrency(remaining, currency)}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-white/30 glass-tint grid grid-cols-2 gap-3">
              <button
                onClick={onClose}
                className="glass rounded-2xl py-3 font-semibold text-stone-700 dark:text-amber-100 active:scale-95 transition-transform"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="glass-primary rounded-2xl py-3 font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
              >
                {saving ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check size={18} /> {t('credit.saveCredit')}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PaymentDialog({ record, onClose, onSaved, currency }: {
  record: CreditRecord | null;
  onClose: () => void;
  onSaved: () => void;
  currency: string;
}) {
  const { t, lang } = useI18n();
  const { products } = useProducts();
  const { toast } = useAppToast();
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState<CreditPayment[]>([]);

  useEffect(() => {
    if (record) {
      setAmount('');
      getCreditPayments(record.id).then(setPayments);
    }
  }, [record]);

  if (!record) return null;
  const cat = products.find(c => c.id === record.productId);
  const purchaseTime = new Date(record.purchaseAt).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  const parseNum = (s: string) => { const n = parseFloat(s); return isFinite(n) ? n : 0; };
  const amountN = parseNum(amount);
  const newRemaining = Math.max(0, record.remaining - amountN);
  const exceedsRemaining = amountN > record.remaining;
  const willComplete = amountN > 0 && newRemaining === 0;

  const handleSave = async () => {
    if (amountN <= 0) {
      toast({ title: t('credit.err.price'), variant: 'warning' });
      return;
    }
    if (exceedsRemaining) {
      toast({ title: t('credit.paymentExceedsRemaining'), variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const { movedToPaid } = await recordCreditPayment(record.id, amountN);
      if (movedToPaid) {
        toast({
          title: t('credit.paymentRecorded'),
          description: t('credit.fullyPaidMovedToHistory'),
          variant: 'success',
        });
      } else {
        toast({
          title: t('credit.paymentRecorded'),
          description: t('credit.paymentRecordedDesc', { amount: formatCurrency(amountN, currency), remaining: formatCurrency(newRemaining, currency) }),
          variant: 'success',
        });
      }
      onSaved();
    } catch (e: any) {
      toast({ title: t('toast.error'), description: e?.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {record && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full sm:max-w-md glass-strong rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
            initial={{ scale: 0.95, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-white/30">
              <h2 className="text-lg font-bold text-stone-800 dark:text-amber-50">{t('credit.enterPaymentTitle')}</h2>
              <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scroll-area px-5 py-4 space-y-3">
              {/* Summary */}
              <div className="glass rounded-2xl p-3 space-y-1.5">
                <DetailRow label={t('credit.confirmPaid.customer')} value={record.customerName} icon={<User size={14} />} />
                <DetailRow label={t('credit.confirmPaid.eggType')} value={(cat?.name || record.productId || '')} icon={<Egg size={14} />} />
                <DetailRow label={t('credit.confirmPaid.qty')} value={`${formatNumber(record.quantity || 0)}`} icon={<Egg size={14} />} />
                <DetailRow label={t('credit.confirmPaid.purchaseDate')} value={`${formatDate(record.purchaseDate, lang)} · ${purchaseTime}`} icon={<History size={14} />} />
                <div className="border-t border-white/30 dark:border-white/10 my-1.5" />
                <DetailRow label={t('credit.confirmPaid.total')} value={formatCurrency(record.totalAmount, currency)} icon={<Coins size={14} />} strong />
                <DetailRow label={t('credit.totalPaidLifetime')} value={formatCurrency(record.paidAmount, currency)} icon={<Wallet size={14} />} />
                <div className="glass-danger rounded-xl p-2.5 flex items-center justify-between mt-1">
                  <span className="text-xs text-white flex items-center gap-1.5"><Wallet size={12} /> {t('credit.remainingBalance')}</span>
                  <span className="text-base font-bold text-white">{formatCurrency(record.remaining, currency)}</span>
                </div>
              </div>

              {/* Payment history (if any) */}
              {payments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-600 dark:text-amber-100/70 mb-1.5">{t('credit.paymentHistory')}</p>
                  <div className="space-y-1">
                    {payments.map((pm) => (
                      <div key={pm.id} className="glass rounded-xl p-2 flex items-center gap-2 text-xs">
                        <div className="w-6 h-6 rounded-lg glass-success flex items-center justify-center text-white flex-shrink-0">
                          <Check size={10} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-stone-800 dark:text-amber-50">{formatCurrency(pm.amount, currency)}</p>
                          <p className="text-stone-500 dark:text-amber-100/50">{formatDate(pm.paymentDate, lang)} · {new Date(pm.paidAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment amount input */}
              <div>
                <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('credit.paymentAmount')}</label>
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
                <p className="text-[10px] text-stone-500 dark:text-amber-100/50 mt-1">{t('credit.recordPaymentDesc')}</p>
              </div>

              {/* Quick-fill button */}
              <button
                onClick={() => setAmount(String(record.remaining))}
                className="w-full glass rounded-xl py-2 text-xs text-amber-700 dark:text-amber-300 font-semibold active:scale-95 transition-transform"
              >
                {t('credit.markFullyPaid')} ({formatCurrency(record.remaining, currency)})
              </button>

              {/* New remaining preview */}
              {amountN > 0 && !exceedsRemaining && (
                <div className="glass rounded-2xl p-3 flex items-center justify-between">
                  <span className="text-xs text-stone-600 dark:text-amber-100/70">{t('credit.remainingBalance')}</span>
                  <span className={`font-bold text-sm ${willComplete ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-300'}`}>
                    {willComplete ? '✓ ' : ''}{formatCurrency(newRemaining, currency)}
                  </span>
                </div>
              )}

              {exceedsRemaining && (
                <div className="glass rounded-2xl p-3 border-red-300 bg-red-50/60 dark:bg-red-900/20 flex items-start gap-2">
                  <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={14} />
                  <p className="text-xs text-red-700 dark:text-red-300">{t('credit.paymentExceedsRemaining')}</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-white/30 glass-tint grid grid-cols-2 gap-3">
              <button
                onClick={onClose}
                className="glass rounded-2xl py-3 font-semibold text-stone-700 dark:text-amber-100 active:scale-95 transition-transform"
              >
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

function HistoryDialog({ record, onClose, currency }: {
  record: CreditRecord | null;
  onClose: () => void;
  currency: string;
}) {
  const { t, lang } = useI18n();
  const { products } = useProducts();
  const [payments, setPayments] = useState<CreditPayment[]>([]);

  useEffect(() => {
    if (record) {
      getCreditPayments(record.id).then(setPayments);
    }
  }, [record]);

  if (!record) return null;
  const cat = products.find(c => c.id === record.productId);

  return (
    <AnimatePresence>
      {record && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full sm:max-w-md glass-strong rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
            initial={{ scale: 0.95, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-white/30">
              <h2 className="text-lg font-bold text-stone-800 dark:text-amber-50">{t('credit.paymentHistory')}</h2>
              <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scroll-area px-5 py-4 space-y-3">
              <div className="glass rounded-2xl p-3 space-y-1.5">
                <DetailRow label={t('credit.confirmPaid.customer')} value={record.customerName} icon={<User size={14} />} />
                <DetailRow label={t('credit.confirmPaid.eggType')} value={(cat?.name || record.productId || '')} icon={<Egg size={14} />} />
                <DetailRow label={t('credit.confirmPaid.qty')} value={`${formatNumber(record.quantity || 0)}`} icon={<Egg size={14} />} />
                <DetailRow label={t('credit.confirmPaid.purchaseDate')} value={formatDate(record.purchaseDate, lang)} icon={<History size={14} />} />
                <div className="border-t border-white/30 dark:border-white/10 my-1.5" />
                <DetailRow label={t('credit.confirmPaid.total')} value={formatCurrency(record.totalAmount, currency)} icon={<Coins size={14} />} strong />
                <DetailRow label={t('credit.totalPaidLifetime')} value={formatCurrency(record.paidAmount, currency)} icon={<Wallet size={14} />} />
                <div className="glass-success rounded-xl p-2.5 flex items-center justify-between mt-1">
                  <span className="text-xs text-white flex items-center gap-1.5"><Check size={12} /> {t('credit.fullyPaid')}</span>
                  <span className="text-base font-bold text-white">{formatCurrency(record.totalAmount, currency)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-stone-600 dark:text-amber-100/70 mb-1.5">{t('credit.paymentHistory')}</p>
                {payments.length === 0 ? (
                  <div className="glass rounded-xl p-3 text-center text-stone-500 dark:text-amber-100/60 text-xs">{t('credit.noPayments')}</div>
                ) : (
                  <div className="space-y-1.5">
                    {payments.map((pm) => (
                      <div key={pm.id} className="glass rounded-xl p-2.5 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg glass-success flex items-center justify-center text-white flex-shrink-0">
                          <Check size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-stone-800 dark:text-amber-50">{formatCurrency(pm.amount, currency)}</p>
                          <p className="text-[10px] text-stone-500 dark:text-amber-100/50">
                            {formatDate(pm.paymentDate, lang)} · {new Date(pm.paidAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-white/30 glass-tint">
              <button
                onClick={onClose}
                className="w-full glass rounded-2xl py-3 font-semibold text-stone-700 dark:text-amber-100 active:scale-95 transition-transform"
              >
                {t('common.close')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DetailRow({ label, value, icon, strong }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-stone-600 dark:text-amber-100/70 flex items-center gap-1.5">{icon} {label}</span>
      <span className={`text-sm ${strong ? 'font-bold text-stone-800 dark:text-amber-50' : 'text-stone-700 dark:text-amber-100'}`}>{value}</span>
    </div>
  );
}
