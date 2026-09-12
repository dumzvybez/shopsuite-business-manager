'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Package, AlertTriangle, TrendingUp, History, X, Check,
  Pencil, Trash2, Tag, Boxes, Download,
} from 'lucide-react';
import {
  useProducts, useInventory, useI18n,
  saveProduct, updateProduct, deleteProduct, adjustInventory, getAllStockMovements, genId,
  formatNumber, formatDate, todayStr,
  PRODUCT_COLOR_PALETTE,
  type Product, type StockMovement,
} from '@/lib/data-hooks-adapter';
import { useAppToast } from './toast-provider';
import { getCurrency } from '@/lib/currencies';

const MEDIUM_THRESHOLD = 50;
const HIGH_THRESHOLD = 100;

type Props = {
  onBack: () => void;
  currency: string;
};

export function InventoryScreen({ onBack, currency }: Props) {
  const { t, lang } = useI18n();
  const { products, refresh: refreshProducts } = useProducts();
  const { inventory, refresh: refreshInventory } = useInventory();
  const { toast } = useAppToast();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [addStockProduct, setAddStockProduct] = useState<Product | null>(null);

  const currencySymbol = getCurrency(currency).symbol;

  useEffect(() => {
    getAllStockMovements().then(setMovements);
  }, [inventory]);

  const totalEggs = products.reduce((a, p) => a + (inventory[p.id] || 0), 0);
  const outOfStockCount = products.filter(p => (inventory[p.id] || 0) === 0).length;
  const lowStockCount = products.filter(p => {
    const qty = inventory[p.id] || 0;
    return qty > 0 && qty < (p.reorderThreshold || MEDIUM_THRESHOLD);
  }).length;

  const handleOpenAdd = () => {
    setEditing(null);
    setShowForm(true);
  };
  const handleOpenEdit = (p: Product) => {
    setEditing(p);
    setShowForm(true);
  };
  const handleDelete = async (p: Product) => {
    if (!confirm(t('inventory.deleteConfirm'))) return;
    await deleteProduct(p.id);
    await Promise.all([refreshProducts(), refreshInventory()]);
    toast({ title: t('inventory.productDeleted'), variant: 'success' });
  };

  const stockLevel = (qty: number, threshold: number): 'out' | 'low' | 'medium' | 'high' => {
    if (qty === 0) return 'out';
    if (qty < (threshold || MEDIUM_THRESHOLD)) return 'low';
    if (qty < HIGH_THRESHOLD) return 'medium';
    return 'high';
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
            <h1 className="text-lg font-bold text-stone-800 dark:text-amber-50">{t('inventory.title')}</h1>
            <p className="text-xs text-stone-600 dark:text-amber-100/70">{t('inventory.sub')}</p>
          </div>
          <button
            onClick={async () => {
              try {
                const { exportInventoryCSV, downloadTextFile } = await import('@/lib/db');
                const csv = await exportInventoryCSV();
                downloadTextFile(`shopsuite-inventory-${todayStr()}.csv`, csv);
              } catch (e: any) { /* ignore */ }
            }}
            className="w-10 h-10 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50 active:scale-90 transition-transform"
            aria-label="Export CSV"
          >
            <Download size={18} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="w-10 h-10 rounded-full glass-primary flex items-center justify-center text-white active:scale-90 transition-transform"
            aria-label={t('inventory.addProduct')}
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="glass-primary rounded-2xl p-3 text-center">
            <p className="text-xs opacity-90">{t('inventory.totalEggs')}</p>
            <p className="text-lg font-bold text-white">{formatNumber(totalEggs)}</p>
          </div>
          <div className={`rounded-2xl p-3 text-center ${lowStockCount > 0 ? 'glass-danger' : 'glass'}`}>
            <p className="text-xs opacity-90">{t('inventory.lowStockCount')}</p>
            <p className={`text-lg font-bold ${lowStockCount > 0 ? 'text-white' : 'text-stone-800 dark:text-amber-50'}`}>{lowStockCount}</p>
          </div>
          <div className={`rounded-2xl p-3 text-center ${outOfStockCount > 0 ? 'glass-danger' : 'glass'}`}>
            <p className="text-xs opacity-90">{t('inventory.outOfStockCount')}</p>
            <p className={`text-lg font-bold ${outOfStockCount > 0 ? 'text-white' : 'text-stone-800 dark:text-amber-50'}`}>{outOfStockCount}</p>
          </div>
        </div>

        {lowStockCount > 0 && (
          <div className="glass rounded-2xl p-3 border-amber-300 bg-amber-50/60 dark:bg-amber-900/20 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {t('inventory.lowStockAlert')}: {lowStockCount} {t('inventory.lowStockCount')}
            </p>
          </div>
        )}

        {/* Product cards */}
        {products.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Package className="mx-auto text-stone-400 dark:text-amber-100/40 mb-3" size={40} />
            <p className="text-sm text-stone-600 dark:text-amber-100/70 mb-4">{t('inventory.empty')}</p>
            <button
              onClick={handleOpenAdd}
              className="glass-primary rounded-2xl px-5 py-2.5 font-bold text-white text-sm inline-flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <Plus size={16} /> {t('inventory.addProduct')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p, i) => {
              const qty = inventory[p.id] || 0;
              const level = stockLevel(qty, p.reorderThreshold);
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.4) }}
                  className="glass-strong rounded-3xl p-4"
                >
                  <div className="h-1.5 rounded-full mb-3" style={{ background: p.color }} />
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ background: p.color }}
                    >
                      <Package size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-stone-800 dark:text-amber-50 truncate">{p.name}</p>
                      <p className="text-[10px] text-stone-500 dark:text-amber-100/50">
                        {p.category || '—'} · {p.unit || 'pcs'}
                      </p>
                      <p className="text-[10px] text-stone-500 dark:text-amber-100/50 mt-0.5">
                        Buy: {currencySymbol} {formatNumber(p.purchasePrice, 2)} · Sell: {currencySymbol} {formatNumber(p.sellingPrice, 2)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setAddStockProduct(p)}
                        className="w-7 h-7 rounded-lg glass-success flex items-center justify-center text-white active:scale-90 transition-transform"
                        aria-label={t('inventory.addStock')}
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="w-7 h-7 rounded-lg glass flex items-center justify-center text-stone-600 dark:text-amber-100 active:scale-90 transition-transform"
                        aria-label={t('common.edit')}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="w-7 h-7 rounded-lg glass-danger flex items-center justify-center text-white active:scale-90 transition-transform"
                        aria-label={t('common.delete')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-stone-500 dark:text-amber-100/60">{t('inventory.currentStock')}</p>
                      {level === 'out' ? (
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">{t('inventory.outOfStock')}</p>
                      ) : (
                        <p className={`text-lg font-bold ${
                          level === 'low' ? 'text-orange-600 dark:text-orange-400' :
                          level === 'medium' ? 'text-amber-600 dark:text-amber-400' :
                          'text-stone-800 dark:text-amber-50'
                        }`}>
                          {formatNumber(qty)} <span className="text-xs font-normal opacity-70">{p.unit || 'pcs'}</span>
                        </p>
                      )}
                    </div>
                    <StockBadge level={level} t={t} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Stock Movement History */}
        <div className="glass-strong rounded-3xl p-5">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl glass-info flex items-center justify-center text-white">
                <History size={16} />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-stone-800 dark:text-amber-50">{t('inventory.stockHistory')}</p>
                <p className="text-[10px] text-stone-500 dark:text-amber-100/60">{movements.length} {t('common.actions').toLowerCase()}</p>
              </div>
            </div>
            <Plus size={16} className={`text-stone-400 transition-transform ${showHistory ? 'rotate-45' : ''}`} />
          </button>
          {showHistory && (
            <div className="mt-3 max-h-80 overflow-y-auto scroll-area space-y-1.5">
              {movements.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-amber-100/60 text-center py-4">
                  {t('inventory.noMovements')}
                </p>
              ) : (
                movements.slice(0, 50).map((m) => {
                  const product = products.find(p => p.id === m.productId);
                  const isAdd = m.changeType === 'added' || m.changeType === 'returned';
                  return (
                    <div key={m.id} className="glass rounded-xl p-2.5 flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0 ${
                        isAdd ? 'glass-success' : m.changeType === 'damaged' ? 'glass-danger' : 'glass-info'
                      }`}>
                        {isAdd ? <Plus size={12} /> : m.changeType === 'damaged' ? <AlertTriangle size={12} /> : <TrendingUp size={12} className="rotate-180" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-stone-800 dark:text-amber-50">
                          {isAdd ? '+' : '−'}{formatNumber(m.quantity)} {product?.name || m.productId}
                        </p>
                        <p className="text-[10px] text-stone-500 dark:text-amber-100/50">
                          {formatDate(m.date, lang)} · {m.sourceType} · {t('inventory.remaining')}: {formatNumber(m.remainingAfter)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>

      <ProductForm
        open={showForm}
        editing={editing}
        onClose={() => setShowForm(false)}
        onSaved={async () => {
          await Promise.all([refreshProducts(), refreshInventory()]);
          setShowForm(false);
        }}
        productCount={products.length}
        currency={currency}
      />

      <AddStockDialog
        open={!!addStockProduct}
        product={addStockProduct}
        currency={currency}
        onClose={() => setAddStockProduct(null)}
        onAdded={async () => {
          await refreshInventory();
          setAddStockProduct(null);
        }}
      />
    </div>
  );
}

function StockBadge({ level, t }: { level: 'out' | 'low' | 'medium' | 'high'; t: (k: string) => string }) {
  const map = {
    out: { cls: 'glass-danger', icon: <AlertTriangle size={10} />, label: t('inventory.outOfStock') },
    low: { cls: 'glass-danger', icon: <AlertTriangle size={10} />, label: t('inventory.lowStock') },
    medium: { cls: 'glass-info', icon: <Boxes size={10} />, label: t('inventory.mediumStock') },
    high: { cls: 'glass-success', icon: <TrendingUp size={10} />, label: t('inventory.highStock') },
  };
  const m = map[level];
  return (
    <span className={`${m.cls} px-2 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1`}>
      {m.icon} {m.label}
    </span>
  );
}

function ProductForm({ open, editing, onClose, onSaved, productCount, currency }: {
  open: boolean;
  editing: Product | null;
  onClose: () => void;
  onSaved: () => void;
  productCount: number;
  currency: string;
}) {
  const { t } = useI18n();
  const { toast } = useAppToast();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [openingStock, setOpeningStock] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [reorderThreshold, setReorderThreshold] = useState('10');
  const [color, setColor] = useState(PRODUCT_COLOR_PALETTE[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setCategory(editing.category || '');
        setUnit(editing.unit || 'pcs');
        setOpeningStock(String(editing.openingStock || 0));
        setPurchasePrice(String(editing.purchasePrice || ''));
        setSellingPrice(String(editing.sellingPrice || ''));
        setReorderThreshold(String(editing.reorderThreshold || 10));
        setColor(editing.color || PRODUCT_COLOR_PALETTE[0]);
      } else {
        setName(''); setCategory(''); setUnit('pcs'); setOpeningStock('');
        setPurchasePrice(''); setSellingPrice(''); setReorderThreshold('10');
        setColor(PRODUCT_COLOR_PALETTE[productCount % PRODUCT_COLOR_PALETTE.length]);
      }
    }
  }, [open, editing, productCount]);

  const parseNum = (s: string) => { const n = parseFloat(s); return isFinite(n) ? n : 0; };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: t('supplier.err.name'), variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const product: Product = {
        id: editing?.id || genId(),
        name: name.trim(),
        category: category.trim() || 'General',
        unit: unit.trim() || 'pcs',
        color,
        order: editing?.order ?? productCount,
        openingStock: editing ? editing.openingStock : parseNum(openingStock),
        purchasePrice: parseNum(purchasePrice),
        sellingPrice: parseNum(sellingPrice),
        reorderThreshold: parseNum(reorderThreshold),
        createdAt: editing?.createdAt || Date.now(),
      };
      if (editing) {
        await updateProduct(product);
        toast({ title: t('inventory.productUpdated'), variant: 'success' });
      } else {
        await saveProduct(product);
        toast({ title: t('inventory.productSaved'), variant: 'success' });
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
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-md glass-strong rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
            initial={{ scale: 0.95, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-white/30">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl glass-primary flex items-center justify-center text-white">
                  <Package size={16} />
                </div>
                <h2 className="text-base font-bold text-stone-800 dark:text-amber-50">
                  {editing ? t('inventory.editProduct') : t('inventory.addProduct')}
                </h2>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto scroll-area space-y-3 flex-1">
              <div>
                <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('inventory.productName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('inventory.productNamePlaceholder')}
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('inventory.category')}</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder={t('inventory.categoryPlaceholder')}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('inventory.unit')}</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder={t('inventory.unitPlaceholder')}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
              {!editing && (
                <div>
                  <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('inventory.openingStock')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={openingStock}
                    onChange={(e) => setOpeningStock(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('inventory.purchasePrice')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">{currency}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('inventory.sellingPrice')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">{currency}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('inventory.reorderThreshold')}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={reorderThreshold}
                  onChange={(e) => setReorderThreshold(e.target.value)}
                  placeholder="10"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <p className="text-[10px] text-stone-500 dark:text-amber-100/50 mt-1">{t('inventory.reorderThresholdHint')}</p>
              </div>
              <div>
                <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_COLOR_PALETTE.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-amber-400 scale-110' : ''}`}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-white/30 glass-tint grid grid-cols-2 gap-3">
              <button
                onClick={onClose}
                className="glass rounded-2xl py-2.5 font-semibold text-stone-700 dark:text-amber-100 text-sm active:scale-95 transition-transform"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="glass-primary rounded-2xl py-2.5 font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={14} /> {t('common.save')}</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Add Stock dialog (adds quantity to an existing product via adjustInventory) ─

function AddStockDialog({ open, product, currency, onClose, onAdded }: {
  open: boolean;
  product: Product | null;
  currency: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useAppToast();
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setQty('');
  }, [open]);

  const parseNum = (s: string) => { const n = parseFloat(s); return isFinite(n) && n > 0 ? n : 0; };

  const handleSubmit = async () => {
    if (!product) return;
    const n = parseNum(qty);
    if (n <= 0) {
      toast({ title: t('inventory.addStockQty'), description: 'Enter a quantity greater than 0', variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await adjustInventory(product.id, n, 'manual');
      toast({
        title: t('inventory.stockAdded'),
        description: t('inventory.stockAddedDesc', { qty: String(n), name: product.name }),
        variant: 'success',
      });
      onAdded();
    } catch (e: any) {
      toast({ title: t('toast.error'), description: e?.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && product && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-sm glass-strong rounded-3xl p-5"
            initial={{ scale: 0.95, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl glass-success flex items-center justify-center text-white">
                <Plus size={16} />
              </div>
              <div>
                <h2 className="text-base font-bold text-stone-800 dark:text-amber-50">{t('inventory.addStockTitle')}</h2>
                <p className="text-[10px] text-stone-500 dark:text-amber-100/60">{product.name}</p>
              </div>
            </div>

            <p className="text-[11px] text-stone-600 dark:text-amber-100/70 mb-3">{t('inventory.addStockDesc')}</p>

            <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{t('inventory.addStockQty')}</label>
            <input
              type="number"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
            />

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={onClose}
                className="glass rounded-2xl py-2.5 font-semibold text-stone-700 dark:text-amber-100 text-sm active:scale-95 transition-transform"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="glass-success rounded-2xl py-2.5 font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Plus size={14} /> {t('inventory.addStock')}</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
