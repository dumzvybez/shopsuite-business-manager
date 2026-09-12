'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Check, X, AlertTriangle, Trash2, Save, History, Info, PackageX, HeartCrack } from 'lucide-react';
import {
  useProducts, useDayData, useI18n, useInventory,
  saveSale, updateSale, deleteSale,
  getLatestPriceSessionForProduct, getPriceSessionsForDate, savePriceSession, recalcDay, genId,
  getDamagesForDate, saveDamage, deleteDamage, todayStr,
  type Sale, type PriceSession, type DamageRecord,
} from '@/lib/data-hooks-adapter';
import { useAppToast } from './toast-provider';
import { formatDate, formatNumber, formatCurrency, formatQuantity } from '@/lib/sinhala';

type Props = {
  date: string;
  onBack: () => void;
  currency: string;
};

export function ProfitCalculatorScreen({ date, onBack, currency }: Props) {
  const { products } = useProducts();
  const { day, sales, sessions, loading, refresh } = useDayData(date);
  const { inventory, refresh: refreshInventory } = useInventory();
  const { t, lang } = useI18n();
  const { toast } = useAppToast();
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  /**
   * Available products = those with prices set (buy AND sell not null) AND stock > 0.
   * Marked unavailable products = those with stock > 0 but marked "Not available"
   * (latest session has null prices). These show with a "Sell Today" button.
   * Out of stock = stock === 0 (shown in warning banner, not in chips).
   */
  const [availableProducts, setAvailableProducts] = useState<typeof products>([]);
  const [markedUnavailableProducts, setMarkedUnavailableProducts] = useState<{ cat: typeof products[0]; stock: number }[]>([]);
  const [outOfStockProducts, setOutOfStockProducts] = useState<Set<string>>(new Set());
  const [showPriceFormFor, setShowPriceFormFor] = useState<string | null>(null);
  const [miniBuyPrice, setMiniBuyPrice] = useState('');
  const [miniSellPrice, setMiniSellPrice] = useState('');
  const [miniSaving, setMiniSaving] = useState(false);

  // Damage eggs state
  const [showDamageForm, setShowDamageForm] = useState(false);
  const [damageProductId, setDamageProductId] = useState('');
  const [damageQty, setDamageQty] = useState('');
  const [damagePrice, setDamagePrice] = useState('');
  const [damageSaving, setDamageSaving] = useState(false);
  const [damages, setDamages] = useState<DamageRecord[]>([]);

  useEffect(() => {
    (async () => {
      const available: typeof products = [];
      const marked: { cat: typeof products[0]; stock: number }[] = [];
      const outOfStock = new Set<string>();
      for (const c of products) {
        const stock = inventory[c.id] || 0;
        if (stock === 0) {
          outOfStock.add(c.id);
          continue;
        }
        const latest = await getLatestPriceSessionForProduct(date, c.id);
        if (latest && latest.buyPrice != null && latest.sellPrice != null) {
          available.push(c);
        } else {
          // Has stock but no prices (or marked "Not available")
          marked.push({ cat: c, stock });
        }
      }
      setAvailableProducts(available);
      setMarkedUnavailableProducts(marked);
      setOutOfStockProducts(outOfStock);
      // If currently selected is not in available, switch
      if (available.length > 0) {
        const stillAvailable = available.some(c => c.id === selectedProduct);
        if (!stillAvailable) setSelectedProduct(available[0].id);
      }
    })();
  }, [products, date, sessions, selectedProduct, inventory]);

  // Load today's damages
  useEffect(() => {
    getDamagesForDate(date).then(setDamages);
  }, [date, inventory]);

  // When "Sell Today" is clicked, open mini form
  const handleSellToday = (productId: string) => {
    setShowPriceFormFor(productId);
    setMiniBuyPrice('');
    setMiniSellPrice('');
  };

  // Save prices for a previously-marked-unavailable egg
  const handleSaveMiniPrices = async () => {
    if (!showPriceFormFor) return;
    const buyN = parseFloat(miniBuyPrice);
    const sellN = parseFloat(miniSellPrice);
    if (!isFinite(buyN) || buyN <= 0 || !isFinite(sellN) || sellN <= 0) {
      toast({ title: t('calc.err.price'), description: t('calc.err.priceDesc'), variant: 'warning' });
      return;
    }
    setMiniSaving(true);
    try {
      const existing = await getPriceSessionsForDate(date);
      const maxIdx = existing.reduce((m, s) => Math.max(m, s.sessionIndex), -1);
      const newSession: PriceSession = {
        id: genId(),
        date,
        productId: showPriceFormFor,
        sessionIndex: maxIdx + 1,
        buyPrice: buyN,
        sellPrice: sellN,
        createdAt: Date.now(),
      };
      await savePriceSession(newSession);
      // Switch to this category
      setSelectedProduct(showPriceFormFor);
      setBuyPrice(String(buyN));
      setSellPrice(String(sellN));
      setShowPriceFormFor(null);
      toast({ title: t('calc.nowAvailable'), variant: 'success' });
      // Refresh will happen via sessions dependency
    } catch (e: any) {
      toast({ title: t('toast.error'), description: e?.message, variant: 'error' });
    } finally {
      setMiniSaving(false);
    }
  };

  // --- Damage eggs handlers ---
  const handleOpenDamageForm = () => {
    setShowDamageForm(true);
    setDamageQty('');
    setDamagePrice('');
    // Pick first category with stock
    const firstWithStock = products.find(c => (inventory[c.id] || 0) > 0);
    setDamageProductId(firstWithStock?.id || '');
    // Pre-fill price if today's price exists
    if (firstWithStock) {
      getLatestPriceSessionForProduct(date, firstWithStock.id).then(latest => {
        if (latest && latest.buyPrice != null) {
          setDamagePrice(String(latest.buyPrice));
        }
      });
    }
  };

  const handleDamageCategoryChange = async (catId: string) => {
    setDamageProductId(catId);
    setDamagePrice('');
    const latest = await getLatestPriceSessionForProduct(date, catId);
    if (latest && latest.buyPrice != null) {
      setDamagePrice(String(latest.buyPrice));
    }
  };

  const handleSaveDamage = async () => {
    const qtyN = parseInt(damageQty);
    const priceN = parseFloat(damagePrice);
    if (!damageProductId) { toast({ title: t('damage.err.qty'), variant: 'warning' }); return; }
    if (!isFinite(qtyN) || qtyN <= 0) { toast({ title: t('damage.err.qty'), variant: 'warning' }); return; }
    const stock = inventory[damageProductId] || 0;
    if (stock === 0) { toast({ title: t('damage.noStock'), variant: 'error' }); return; }
    if (!isFinite(priceN) || priceN <= 0) { toast({ title: t('damage.err.price'), variant: 'warning' }); return; }
    if (qtyN > stock) {
      toast({ title: t('inventory.insufficientStock'), description: t('inventory.insufficientStockDesc', { available: String(stock), requested: String(qtyN) }), variant: 'error' });
      return;
    }
    setDamageSaving(true);
    try {
      const damage: DamageRecord = {
        id: genId(),
        date,
        productId: damageProductId,
        quantity: qtyN,
        pricePerEgg: priceN,
        totalCost: qtyN * priceN,
        createdAt: Date.now(),
      };
      await saveDamage(damage);
      // Refresh inventory and damages
      await refreshInventory();
      const updated = await getDamagesForDate(date);
      setDamages(updated);
      toast({ title: t('damage.saved'), description: t('damage.savedDesc', { qty: formatNumber(qtyN), amount: formatCurrency(qtyN * priceN, currency) }), variant: 'success' });
      setShowDamageForm(false);
    } catch (e: any) {
      toast({ title: t('toast.error'), description: e?.message, variant: 'error' });
    } finally {
      setDamageSaving(false);
    }
  };

  const handleDeleteDamage = async (d: DamageRecord) => {
    if (!confirm(`${t('common.delete')}? ${d.quantity} ${t('inventory.eggs')}`)) return;
    await deleteDamage(d.id);
    await refreshInventory();
    const updated = await getDamagesForDate(date);
    setDamages(updated);
    toast({ title: t('toast.saved'), variant: 'success' });
  };

  const totalDamageEggs = damages.reduce((a, d) => a + d.quantity, 0);
  const totalDamageCost = damages.reduce((a, d) => a + d.totalCost, 0);

  // When category changes, fetch latest prices for that category on this date
  useEffect(() => {
    if (!selectedProduct) return;
    (async () => {
      const latest = await getLatestPriceSessionForProduct(date, selectedProduct);
      if (latest && latest.buyPrice != null && latest.sellPrice != null) {
        setBuyPrice(String(latest.buyPrice));
        setSellPrice(String(latest.sellPrice));
      }
    })();
  }, [selectedProduct, date]);

  const parseNum = (s: string): number => {
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };

  const buyN = parseNum(buyPrice);
  const sellN = parseNum(sellPrice);
  const qtyN = parseNum(quantity);
  const profitPerEgg = sellN - buyN;
  const totalProfit = profitPerEgg * qtyN;
  const isNegative = sellN > 0 && buyN > 0 && sellN < buyN;

  // Current stock for the selected category
  const currentStock = selectedProduct ? (inventory[selectedProduct] || 0) : 0;
  const exceedsStock = !editingId && qtyN > currentStock && currentStock > 0;

  const handleSave = async () => {
    if (!selectedProduct) {
      toast({ title: t('calc.err.category'), variant: 'warning' });
      return;
    }
    if (qtyN <= 0) {
      toast({ title: t('calc.err.qty'), description: t('calc.err.qtyDesc'), variant: 'warning' });
      return;
    }
    if (buyN <= 0 || sellN <= 0) {
      toast({ title: t('calc.err.price'), description: t('calc.err.priceDesc'), variant: 'warning' });
      return;
    }

    // Inventory check: prevent selling more than current stock (only for new sales)
    if (!editingId) {
      if (currentStock === 0) {
        toast({
          title: t('inventory.insufficientStock'),
          description: t('inventory.outOfStockWarn'),
          variant: 'error',
        });
        return;
      }
      if (qtyN > currentStock) {
        toast({
          title: t('inventory.insufficientStock'),
          description: t('inventory.insufficientStockDesc', { available: String(currentStock), requested: String(qtyN) }),
          variant: 'error',
        });
        return;
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        const existing = sales.find((s) => s.id === editingId);
        if (existing) {
          const updated: Sale = {
            ...existing,
            productId: selectedProduct,
            quantity: qtyN,
            buyPrice: buyN,
            sellPrice: sellN,
            profit: totalProfit,
          };
          await updateSale(updated, `Sale edited for ${date}`);
          toast({ title: t('calc.editSaved.title'), variant: 'success' });
        }
        setEditingId(null);
      } else {
        // Check if prices changed from latest session; if so, create a new session
        const latest = await getLatestPriceSessionForProduct(date, selectedProduct);
        let sessionIndex = latest?.sessionIndex ?? 0;
        const pricesChanged = !latest || latest.buyPrice !== buyN || latest.sellPrice !== sellN;
        if (pricesChanged) {
          sessionIndex = (latest?.sessionIndex ?? -1) + 1;
          const newSession: PriceSession = {
            id: genId(),
            date,
            productId: selectedProduct,
            sessionIndex,
            buyPrice: buyN,
            sellPrice: sellN,
            createdAt: Date.now(),
          };
          await savePriceSession(newSession);
        }

        const sale: Sale = {
          id: genId(),
          date,
          productId: selectedProduct,
          sessionIndex,
          quantity: qtyN,
          buyPrice: buyN,
          sellPrice: sellN,
          profit: totalProfit,
          createdAt: Date.now(),
        };
        await saveSale(sale);
        toast({
          title: t('calc.saleSaved.title'),
          description: t('calc.saleSaved.desc', { qty: formatNumber(qtyN), profit: formatCurrency(totalProfit, currency) }),
          variant: 'success',
        });
      }

      setQuantity('');
      await refresh();
      await refreshInventory();
    } catch (e: any) {
      toast({ title: t('toast.error'), description: e?.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (sale: Sale) => {
    setEditingId(sale.id);
    setSelectedProduct(sale.productId);
    setQuantity(String(sale.quantity));
    setBuyPrice(String(sale.buyPrice));
    setSellPrice(String(sale.sellPrice));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (sale: Sale) => {
    if (!confirm(t('calc.deleteConfirm', {
      qty: formatNumber(sale.quantity),
      profit: formatCurrency(sale.profit, currency),
    }))) return;
    await deleteSale(sale.id, `Sale deleted for ${date}`);
    toast({ title: t('calc.deleted.title'), variant: 'success' });
    if (editingId === sale.id) {
      setEditingId(null);
      setQuantity('');
    }
    await refresh();
    await refreshInventory();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setQuantity('');
  };

  // Group sales by category for display
  const salesByProduct = useMemo(() => {
    const map = new Map<string, Sale[]>();
    for (const s of sales) {
      if (!map.has(s.productId)) map.set(s.productId, []);
      map.get(s.productId)!.push(s);
    }
    return map;
  }, [sales]);

  const noAvailableCategories = availableProducts.length === 0 && markedUnavailableProducts.length === 0;
  const hasOutOfStockCats = outOfStockProducts.size > 0;
  const hasMarkedCats = markedUnavailableProducts.length > 0;

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
            <h1 className="text-lg font-bold text-stone-800 dark:text-amber-50">{t('calc.title')}</h1>
            <p className="text-xs text-stone-600 dark:text-amber-100/70">{formatDate(date, lang)}</p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform ${
              showHistory ? 'glass-primary text-white' : 'glass text-stone-700 dark:text-amber-50'
            }`}
            aria-label={t('calc.priceSessions')}
          >
            <History size={18} />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Today's totals */}
        {!loading && day && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label={t('dashboard.todayProfit')} value={formatCurrency(day.totalProfit, currency)} color="success" />
            <StatCard label={t('dashboard.todayEggs')} value={`${formatNumber((day.totalItems != null ? day.totalItems : (day as any).totalEggs))} `.trim()} color="primary" />
            <StatCard label={t('dashboard.todaySell')} value={formatCurrency(day.totalSell, currency)} color="info" />
            <StatCard label={t('dashboard.todayBuy')} value={formatCurrency(day.totalBuy, currency)} color="muted" />
          </div>
        )}

        {/* Out-of-stock warning banner */}
        {hasOutOfStockCats && (
          <div className="glass rounded-2xl p-3 border-red-300 bg-red-50/60 dark:bg-red-900/20 flex items-start gap-2">
            <PackageX className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-red-700 dark:text-red-300">
              {Array.from(outOfStockProducts).map(id => {
                const c = products.find(x => x.id === id);
                return c?.name || id;
              }).join(', ')} — {t('inventory.outOfStock')}
            </p>
          </div>
        )}

        {/* Editor card */}
        <div className="glass-strong rounded-3xl p-5 animate-pop-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-stone-800 dark:text-amber-50">
              {editingId ? t('calc.editSale') : t('calc.newSale')}
            </h2>
            {editingId && (
              <button
                onClick={handleCancelEdit}
                className="text-xs text-stone-500 dark:text-amber-100/60 flex items-center gap-1"
              >
                <X size={12} /> {t('calc.cancelEdit')}
              </button>
            )}
          </div>

          {noAvailableCategories ? (
            <div className="glass rounded-2xl p-6 text-center">
              <AlertTriangle className="mx-auto text-amber-500 mb-2" size={32} />
              <p className="text-sm text-stone-700 dark:text-amber-100 mb-3">
                {hasOutOfStockCats
                  ? t('inventory.outOfStockWarn')
                  : 'No products available today. Add products in Inventory first.'
                }
              </p>
            </div>
          ) : (
            <>
              {/* Category chips — available products with stock AND prices */}
              {availableProducts.length > 0 && (
                <div className="flex gap-2 overflow-x-auto scroll-area pb-2 -mx-1 px-1 mb-4">
                  {availableProducts.map((c) => {
                    const stock = inventory[c.id] || 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedProduct(c.id)}
                        className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${
                          selectedProduct === c.id
                            ? 'glass-primary text-white'
                            : 'glass text-stone-700 dark:text-amber-100'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                        {c.name}
                        <span className="text-[10px] opacity-70">({formatNumber(stock)})</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Current stock indicator */}
              {selectedProduct && availableProducts.some(c => c.id === selectedProduct) && (
                <div className="glass rounded-xl p-2.5 mb-3 flex items-center justify-between text-xs">
                  <span className="text-stone-600 dark:text-amber-100/70">{t('inventory.currentStock')}</span>
                  <span className={`font-bold ${currentStock < 50 ? 'text-orange-600 dark:text-orange-400' : 'text-green-700 dark:text-green-400'}`}>
                    {formatNumber(currentStock)} {t('inventory.eggs')}
                  </span>
                </div>
              )}

              {/* Inputs — only show when an available category is selected */}
              {selectedProduct && availableProducts.some(c => c.id === selectedProduct) && (
              <>
              {/* Inputs */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('calc.buyPerEgg')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-3 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">LKR</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('calc.sellPerEgg')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      placeholder="0.00"
                      className={`w-full px-3 py-3 rounded-xl bg-white/70 dark:bg-white/5 border font-semibold focus:outline-none focus:ring-2 ${
                        isNegative ? 'border-red-300 focus:ring-red-400' : 'border-white/80 dark:border-white/10 focus:ring-amber-400'
                      } text-stone-800 dark:text-amber-50`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">LKR</span>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('calc.qtySold')}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={t('calc.qtyPlaceholder')}
                  className={`w-full px-3 py-3 rounded-xl bg-white/70 dark:bg-white/5 border font-semibold text-lg focus:outline-none focus:ring-2 ${
                    exceedsStock ? 'border-red-300 focus:ring-red-400' : 'border-white/80 dark:border-white/10 focus:ring-amber-400'
                  } text-stone-800 dark:text-amber-50`}
                />
              </div>

              {/* Insufficient stock warning */}
              {exceedsStock && (
                <div className="glass rounded-2xl p-3 mb-3 border-red-300 bg-red-50/60 dark:bg-red-900/20 flex items-start gap-2">
                  <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-red-700 dark:text-red-300">
                    {t('inventory.insufficientStockDesc', { available: String(currentStock), requested: String(qtyN) })}
                  </p>
                </div>
              )}

              {/* Live preview */}
              {qtyN > 0 && buyN > 0 && sellN > 0 && !exceedsStock && (
                <div className="glass rounded-2xl p-3 mb-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-stone-600 dark:text-amber-100/70">
                    <span>{t('calc.profitPerEgg')}</span>
                    <span className={isNegative ? 'text-red-600 dark:text-red-400 font-bold' : 'text-green-700 dark:text-green-400 font-bold'}>
                      {formatCurrency(profitPerEgg, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-stone-600 dark:text-amber-100/70">
                    <span>{t('calc.soldQty')}</span>
                    <span className="font-bold text-stone-800 dark:text-amber-50">{formatNumber(qtyN)} ''</span>
                  </div>
                  <div className="border-t border-white/30 dark:border-white/10 pt-1.5 flex justify-between">
                    <span className="text-sm font-semibold text-stone-700 dark:text-amber-100">{t('calc.totalProfit')}</span>
                    <span className={`text-lg font-bold ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                      {formatCurrency(totalProfit, currency)}
                    </span>
                  </div>
                </div>
              )}

              {isNegative && (
                <div className="glass rounded-2xl p-3 mb-3 border-red-300 bg-red-50/60 dark:bg-red-900/20 flex items-start gap-2">
                  <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-red-700 dark:text-red-300">
                    {t('calc.negativeWarning')}
                  </p>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || exceedsStock}
                className={`w-full rounded-2xl py-4 font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60 ${
                  editingId ? 'glass-info text-white' : 'glass-primary text-white'
                }`}
              >
                {saving ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {editingId ? <Save size={18} /> : <Plus size={18} />}
                    {editingId ? t('calc.saveEdit') : t('calc.saveSale')}
                  </>
                )}
              </button>
              </>
              )}

              {/* Marked unavailable products — moved below submit button */}
              {hasMarkedCats && (
                <div className="mt-4">
                  <p className="text-xs text-stone-500 dark:text-amber-100/50 mb-2">{t('calc.markedNotSelling')}</p>
                  <div className="space-y-2">
                    {markedUnavailableProducts.map(({ cat, stock }) => (
                      <div key={cat.id} className="glass rounded-xl p-3 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-stone-700 dark:text-amber-100/70 truncate">
                            {cat?.name}
                          </p>
                          <p className="text-[10px] text-stone-500 dark:text-amber-100/40">
                            {formatNumber(stock)} {t('inventory.eggs')} · {t('calc.markedUnavailable')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleSellToday(cat.id)}
                          className="px-3 py-1.5 rounded-lg glass-primary text-white text-xs font-bold flex-shrink-0 active:scale-95 transition-transform"
                        >
                          {t('calc.sellToday')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Damage Eggs section */}
        <div className="glass-strong rounded-3xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl glass-danger flex items-center justify-center text-white">
                <HeartCrack size={16} />
              </div>
              <div>
                <h2 className="font-bold text-sm text-stone-800 dark:text-amber-50">{t('damage.title')}</h2>
                <p className="text-[10px] text-stone-500 dark:text-amber-100/50">
                  {damages.length > 0
                    ? `${formatNumber(totalDamageEggs)} ${t('inventory.eggs')} · ${formatCurrency(totalDamageCost, currency)}`
                    : t('damage.noDamages')}
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenDamageForm}
              className="px-3 py-2 rounded-xl glass-danger text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform"
            >
              <Plus size={14} /> {t('damage.add')}
            </button>
          </div>
          {damages.length > 0 && (
            <div className="space-y-1.5">
              {damages.map((d) => {
                const cat = products.find(c => c.id === d.productId);
                return (
                  <div key={d.id} className="glass rounded-xl p-2.5 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat?.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-stone-800 dark:text-amber-50">
                        {formatNumber(d.quantity)} {cat?.name}
                      </p>
                      <p className="text-[10px] text-stone-500 dark:text-amber-100/50">
                        {formatCurrency(d.totalCost, currency)} · {new Date(d.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteDamage(d)}
                      className="w-7 h-7 rounded-lg glass-danger flex items-center justify-center text-white flex-shrink-0 active:scale-90 transition-transform"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Today's sales list */}
        {!loading && sales.length > 0 && (
          <div className="glass-strong rounded-3xl p-5 animate-pop-in">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-stone-800 dark:text-amber-50">{t('calc.todaySales')} ({sales.length})</h2>
              <span className="text-xs text-stone-500 dark:text-amber-100/60">{sessions.length} {t('calc.priceSessions')}</span>
            </div>
            <div className="space-y-2">
              {sales.slice().sort((a, b) => b.createdAt - a.createdAt).map((sale) => {
                const cat = products.find((c) => c.id === sale.productId);
                return (
                  <div
                    key={sale.id}
                    className={`glass rounded-2xl p-3 flex items-center gap-3 ${editingId === sale.id ? 'ring-2 ring-amber-400' : ''}`}
                  >
                    <div className="w-1 self-stretch rounded-full" style={{ background: cat?.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-stone-800 dark:text-amber-50 truncate">
                          {cat?.name}
                        </p>
                        <span className="text-[10px] text-stone-500 dark:text-amber-100/50 flex-shrink-0">
                          {t('calc.sessionN', { n: sale.sessionIndex + 1 })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-stone-600 dark:text-amber-100/70 mt-0.5">
                        <span>{formatQuantity(sale.quantity)}</span>
                        <span>·</span>
                        <span>{t('common.buy')} {formatCurrency(sale.buyPrice, currency)}</span>
                        <span>·</span>
                        <span>{t('common.sell')} {formatCurrency(sale.sellPrice, currency)}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold text-sm ${sale.profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                        {formatCurrency(sale.profit, currency)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleEdit(sale)}
                        className="w-7 h-7 rounded-lg glass flex items-center justify-center text-stone-600 dark:text-amber-100 active:scale-90 transition-transform"
                        aria-label={t('common.edit')}
                      >
                        <Save size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(sale)}
                        className="w-7 h-7 rounded-lg glass-danger flex items-center justify-center text-white active:scale-90 transition-transform"
                        aria-label={t('common.delete')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && sales.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center text-stone-500 dark:text-amber-100/60 text-sm">
            {t('calc.noSales')}
          </div>
        )}

        {/* Price sessions (history) */}
        {showHistory && sessions.length > 0 && (
          <div className="glass-strong rounded-3xl p-5 animate-pop-in">
            <h2 className="font-bold text-stone-800 dark:text-amber-50 mb-3">{t('calc.priceSessions')} ({sessions.length})</h2>
            <div className="space-y-2">
              {sessions.slice().sort((a, b) => b.createdAt - a.createdAt).map((s) => {
                const cat = products.find((c) => c.id === s.productId);
                const unavailable = s.buyPrice == null && s.sellPrice == null;
                return (
                  <div key={s.id} className={`glass rounded-2xl p-3 flex items-center gap-3 ${unavailable ? 'opacity-60' : ''}`}>
                    <div className="w-1 self-stretch rounded-full" style={{ background: cat?.color }} />
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-stone-800 dark:text-amber-50">
                        {cat?.name}
                        {unavailable && <span className="ml-2 text-[10px] text-stone-500">· {t('price.notAvailable')}</span>}
                      </p>
                      <p className="text-xs text-stone-600 dark:text-amber-100/70">
                        {t('calc.sessionN', { n: s.sessionIndex + 1 })} · {t('common.buy')} {unavailable ? '—' : formatCurrency(s.buyPrice!, currency)} · {t('common.sell')} {unavailable ? '—' : formatCurrency(s.sellPrice!, currency)}
                      </p>
                    </div>
                    <span className="text-[10px] text-stone-500 dark:text-amber-100/50">
                      {new Date(s.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 glass rounded-xl p-3 flex items-start gap-2 text-xs text-stone-600 dark:text-amber-100/70">
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <p>{t('calc.sessionsInfo')}</p>
            </div>
          </div>
        )}
      </main>

      {/* Mini price form for marked-unavailable eggs */}
      <AnimatePresence>
        {showPriceFormFor && (
          <motion.div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setShowPriceFormFor(null)} />
            <motion.div
              className="relative w-full max-w-sm glass-strong rounded-3xl overflow-hidden"
              initial={{ scale: 0.95, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            >
              {(() => {
                const cat = products.find(c => c.id === showPriceFormFor);
                return (
                  <>
                    <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-white/30">
                      <div>
                        <h2 className="text-base font-bold text-stone-800 dark:text-amber-50">{t('calc.enterPricesFor')}</h2>
                        <p className="text-xs text-stone-600 dark:text-amber-100/70 flex items-center gap-1 mt-0.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: cat?.color }} />
                          {cat?.name}
                        </p>
                      </div>
                      <button onClick={() => setShowPriceFormFor(null)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('calc.buyPerEgg')}</label>
                          <div className="relative">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              value={miniBuyPrice}
                              onChange={(e) => setMiniBuyPrice(e.target.value)}
                              placeholder="0.00"
                              autoFocus
                              className="w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">LKR</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('calc.sellPerEgg')}</label>
                          <div className="relative">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              value={miniSellPrice}
                              onChange={(e) => setMiniSellPrice(e.target.value)}
                              placeholder="0.00"
                              className="w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">LKR</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="px-5 py-4 border-t border-white/30 glass-tint grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setShowPriceFormFor(null)}
                        className="glass rounded-2xl py-2.5 font-semibold text-stone-700 dark:text-amber-100 text-sm active:scale-95 transition-transform"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={handleSaveMiniPrices}
                        disabled={miniSaving}
                        className="glass-primary rounded-2xl py-2.5 font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
                      >
                        {miniSaving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={14} /> {t('common.save')}</>}
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Damage Eggs Form popup */}
      <AnimatePresence>
        {showDamageForm && (
          <motion.div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setShowDamageForm(false)} />
            <motion.div
              className="relative w-full max-w-sm glass-strong rounded-3xl overflow-hidden"
              initial={{ scale: 0.95, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            >
              <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-white/30">
                <div className="flex items-center gap-2">
                  <HeartCrack size={18} className="text-red-500" />
                  <h2 className="text-base font-bold text-stone-800 dark:text-amber-50">{t('damage.add')}</h2>
                </div>
                <button onClick={() => setShowDamageForm(false)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50">
                  <X size={16} />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                {/* Egg type selector */}
                <div>
                  <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('damage.eggType')}</label>
                  <div className="flex gap-1.5 overflow-x-auto scroll-area pb-1">
                    {products.filter(c => (inventory[c.id] || 0) > 0).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleDamageCategoryChange(c.id)}
                        className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                          damageProductId === c.id ? 'glass-danger text-white' : 'glass text-stone-700 dark:text-amber-100'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                        {c.name}
                        <span className="text-[9px] opacity-70">({formatNumber(inventory[c.id] || 0)})</span>
                      </button>
                    ))}
                  </div>
                  {products.filter(c => (inventory[c.id] || 0) > 0).length === 0 && (
                    <p className="text-xs text-red-500 mt-1">{t('damage.noStock')}</p>
                  )}
                </div>
                {/* Quantity */}
                <div>
                  <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('damage.quantity')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={damageQty}
                    onChange={(e) => setDamageQty(e.target.value)}
                    placeholder="0"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                {/* Price per egg */}
                <div>
                  <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('damage.eggPriceLabel')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={damagePrice}
                      onChange={(e) => setDamagePrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">LKR</span>
                  </div>
                </div>
                {/* Total preview */}
                {parseInt(damageQty) > 0 && parseFloat(damagePrice) > 0 && (
                  <div className="glass rounded-xl p-2.5 flex items-center justify-between">
                    <span className="text-xs text-stone-600 dark:text-amber-100/70">{t('damage.totalCost')}</span>
                    <span className="font-bold text-sm text-red-600 dark:text-red-400">
                      {formatCurrency(parseInt(damageQty) * parseFloat(damagePrice), currency)}
                    </span>
                  </div>
                )}
              </div>
              <div className="px-5 py-4 border-t border-white/30 glass-tint grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowDamageForm(false)}
                  className="glass rounded-2xl py-2.5 font-semibold text-stone-700 dark:text-amber-100 text-sm active:scale-95 transition-transform"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSaveDamage}
                  disabled={damageSaving}
                  className="glass-danger rounded-2xl py-2.5 font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
                >
                  {damageSaving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={14} /> {t('common.save')}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: 'primary' | 'success' | 'info' | 'muted' }) {
  const colorMap = {
    primary: 'glass-primary',
    success: 'glass-success',
    info: 'glass-info',
    muted: 'glass text-stone-800 dark:text-amber-50',
  };
  return (
    <div className={`${colorMap[color]} rounded-2xl p-4`}>
      <p className="text-xs opacity-90 mb-1">{label}</p>
      <p className="text-lg font-bold leading-tight">{value}</p>
    </div>
  );
}
