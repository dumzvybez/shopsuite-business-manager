'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Check, ChevronRight, ChevronLeft, Store, User, Palette, Lock, Coins,
  ShoppingBag, Calculator, BarChart3, Package, Truck, Image as ImageIcon,
  Fingerprint, AlertTriangle, Loader2,
} from 'lucide-react';
import {
  useI18n, applyThemeAndBackground, saveSettings, todayStr, getProducts, saveProduct,
  type Settings, type Product,
} from '@/lib/data-hooks-adapter';
import { useAppToast } from './toast-provider';
import { PinSetupDialog, BiometricSetupDialog } from './app-lock';
import { THEMES, BACKGROUNDS, type ThemeId, type BackgroundId } from '@/lib/themes';
import { CURRENCIES } from '@/lib/currencies';
import { BUSINESS_TYPES } from '@/lib/business-types';
import { PRODUCT_COLOR_PALETTE } from '@/lib/db';

const STEPS = ['welcome', 'business', 'appearance', 'security', 'tutorial', 'done'] as const;
type Step = typeof STEPS[number];

export function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const { t } = useI18n();
  const { toast } = useAppToast();
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];

  // Form state
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [shopType, setShopType] = useState('grocery');
  const [currency, setCurrency] = useState('LKR');
  const [themeId, setThemeId] = useState<ThemeId>('modern-dark');
  const [backgroundId, setBackgroundId] = useState<BackgroundId>('default');
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [appLockPin, setAppLockPin] = useState<string | null>(null);
  const [appLockBiometric, setAppLockBiometric] = useState(false);
  const [webauthnCredentialId, setWebauthnCredentialId] = useState<string | null>(null);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [useEggPreset, setUseEggPreset] = useState(false);

  // Detect WebAuthn support once on mount so the biometric option can be
  // shown/disabled appropriately (same check used in Settings + AppLock).
  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) {
        setBiometricSupported(false);
        return;
      }
      try {
        const available = await (PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable?.();
        setBiometricSupported(!!available);
      } catch {
        setBiometricSupported(false);
      }
    })();
  }, []);

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const prev = () => setStepIdx((i) => Math.max(i - 1, 0));

  const handleThemeChange = (id: ThemeId) => {
    setThemeId(id);
    applyThemeAndBackground(id, backgroundId);
  };
  const handleBackgroundChange = (id: BackgroundId) => {
    setBackgroundId(id);
    applyThemeAndBackground(themeId, id);
  };

  const handlePinSaved = (pin: string) => {
    setAppLockPin(pin);
    setShowPinSetup(false);
    toast({ title: 'PIN set', variant: 'success' });
  };

  // Biometric (WebAuthn) registration — reuses the SAME BiometricSetupDialog
  // and registration logic as Settings. This is NOT a second implementation.
  const handleBiometricToggle = (enabled: boolean) => {
    if (enabled) {
      if (!biometricSupported) {
        toast({ title: 'Biometric unlock is not supported on this device/browser. PIN lock remains active.', variant: 'error' });
        return;
      }
      setShowBiometricSetup(true);
    } else {
      setAppLockBiometric(false);
      setWebauthnCredentialId(null);
    }
  };

  const handleBiometricRegistered = (credentialId: string) => {
    setShowBiometricSetup(false);
    setAppLockBiometric(true);
    setWebauthnCredentialId(credentialId);
    toast({ title: 'Biometric unlock enabled', variant: 'success' });
  };

  const handleBiometricSetupCancel = () => {
    setShowBiometricSetup(false);
    // Revert the toggle since setup was cancelled — keeps state consistent.
    setAppLockBiometric(false);
    setWebauthnCredentialId(null);
  };

  const finish = async () => {
    const patch: Partial<Settings> = {
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      shopType,
      currency,
      themeId,
      backgroundId,
      theme: themeId === 'light-pro' ? 'light' : 'dark',
      appLockEnabled,
      appLockPin,
      appLockBiometric,
      webauthnCredentialId, // registered during onboarding via BiometricSetupDialog
      tutorialDone: true,
      onboardingCompleted: true,
      installDate: todayStr(),
    };
    await saveSettings(patch);
    applyThemeAndBackground(themeId, backgroundId);

    // Seed egg preset products if user opted in
    if (useEggPreset && shopType === 'egg') {
      const bt = BUSINESS_TYPES.find((b) => b.id === 'egg');
      if (bt?.presetProducts) {
        const existing = await getProducts();
        if (existing.length === 0) {
          for (let i = 0; i < bt.presetProducts.length; i++) {
            const p = bt.presetProducts[i];
            const product: Product = {
              id: `${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
              name: p.name,
              category: p.category,
              unit: p.unit,
              color: p.color,
              order: i,
              openingStock: 0,
              purchasePrice: p.purchasePrice,
              sellingPrice: p.sellingPrice,
              reorderThreshold: 10,
              createdAt: Date.now(),
            };
            await saveProduct(product);
          }
        }
      }
    }

    toast({ title: t('toast.ready'), description: t('toast.readyDesc'), variant: 'success' });
    onComplete();
  };

  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[150] app-body overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 safe-top safe-bottom">
        <div className="w-full max-w-md">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-stone-500 dark:text-amber-100/60">
                Step {stepIdx + 1} of {STEPS.length}
              </span>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              />
            </div>
          </div>

          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
          >
            {step === 'welcome' && (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-5 rounded-3xl overflow-hidden shadow-xl">
                  <img src="/icons/icon-1024.png" alt="ShopSuite" className="w-full h-full object-cover" />
                </div>
                <h1 className="text-2xl font-bold text-stone-800 dark:text-amber-50 mb-2">
                  Welcome to ShopSuite
                </h1>
                <p className="text-sm text-stone-600 dark:text-amber-100/70 mb-1">
                  A clean, offline-first management system for your shop
                </p>
                <p className="text-xs text-stone-500 dark:text-amber-100/60 mb-6 max-w-sm mx-auto">
                  Track sales, inventory, suppliers, credit, expenses and reports — all from one simple app.
                </p>
                <button
                  onClick={next}
                  className="w-full glass-primary rounded-2xl py-4 font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  Get Started <ChevronRight size={18} />
                </button>
              </div>
            )}

            {step === 'business' && (
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-2xl glass-primary flex items-center justify-center text-white">
                    <Store size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-800 dark:text-amber-50">Business Profile</h2>
                    <p className="text-xs text-stone-500 dark:text-amber-100/60">Tell us about your shop</p>
                  </div>
                </div>

                <div className="glass-strong rounded-3xl p-5 space-y-3">
                  <div>
                    <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block flex items-center gap-1">
                      <Store size={12} /> Shop name
                    </label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. My Shop"
                      className="w-full px-3 py-3 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block flex items-center gap-1">
                      <User size={12} /> Owner name
                    </label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-3 py-3 rounded-xl bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 text-stone-800 dark:text-amber-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">Business type</label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto scroll-area">
                      {BUSINESS_TYPES.map((bt) => (
                        <button
                          key={bt.id}
                          onClick={() => setShopType(bt.id)}
                          className={`px-2 py-2 rounded-xl text-xs font-semibold transition-all text-left ${
                            shopType === bt.id
                              ? 'glass-primary text-white'
                              : 'glass text-stone-700 dark:text-amber-100'
                          }`}
                        >
                          {bt.label}
                        </button>
                      ))}
                    </div>
                    {shopType === 'egg' && (
                      <label className="flex items-center gap-2 mt-2 text-xs text-stone-600 dark:text-amber-100/70 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useEggPreset}
                          onChange={(e) => setUseEggPreset(e.target.checked)}
                          className="w-4 h-4 rounded accent-amber-500"
                        />
                        Pre-seed 6 egg product templates
                      </label>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block flex items-center gap-1">
                      <Coins size={12} /> Currency
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => setCurrency(c.code)}
                          className={`px-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                            currency === c.code
                              ? 'glass-primary text-white'
                              : 'glass text-stone-700 dark:text-amber-100'
                          }`}
                        >
                          <div className="font-bold">{c.code}</div>
                          <div className="text-[9px] opacity-70">{c.symbol}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={prev}
                    disabled={stepIdx === 0}
                    className="glass rounded-2xl py-3 font-semibold text-stone-700 dark:text-amber-100 text-sm flex items-center justify-center gap-1 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    onClick={next}
                    disabled={!ownerName.trim()}
                    className="glass-primary rounded-2xl py-3 font-bold text-white text-sm flex items-center justify-center gap-1 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {step === 'appearance' && (
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-2xl glass-primary flex items-center justify-center text-white">
                    <Palette size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-800 dark:text-amber-50">Appearance</h2>
                    <p className="text-xs text-stone-500 dark:text-amber-100/60">Choose your theme & background</p>
                  </div>
                </div>

                <div className="glass-strong rounded-3xl p-5 space-y-4">
                  <div>
                    <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-2 block">Theme</label>
                    <div className="grid grid-cols-3 gap-2">
                      {THEMES.map((th) => (
                        <button
                          key={th.id}
                          onClick={() => handleThemeChange(th.id)}
                          className={`p-2 rounded-xl text-xs font-semibold transition-all ${
                            themeId === th.id
                              ? 'glass-primary text-white'
                              : 'glass text-stone-700 dark:text-amber-100'
                          }`}
                        >
                          <div
                            className="w-6 h-6 mx-auto mb-1 rounded-full"
                            style={{ background: th.swatch }}
                          />
                          {th.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-2 block">Background</label>
                    <div className="grid grid-cols-3 gap-2">
                      {BACKGROUNDS.map((bg) => (
                        <button
                          key={bg.id}
                          onClick={() => handleBackgroundChange(bg.id)}
                          className={`p-2 rounded-xl text-xs font-semibold transition-all ${
                            backgroundId === bg.id
                              ? 'glass-primary text-white'
                              : 'glass text-stone-700 dark:text-amber-100'
                          }`}
                        >
                          <div
                            className="w-full h-8 mb-1 rounded-lg"
                            style={{ background: bg.preview }}
                          />
                          {bg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={prev}
                    className="glass rounded-2xl py-3 font-semibold text-stone-700 dark:text-amber-100 text-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    onClick={next}
                    className="glass-primary rounded-2xl py-3 font-bold text-white text-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {step === 'security' && (
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-2xl glass-primary flex items-center justify-center text-white">
                    <Lock size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-800 dark:text-amber-50">Security</h2>
                    <p className="text-xs text-stone-500 dark:text-amber-100/60">Optional app lock</p>
                  </div>
                </div>

                <div className="glass-strong rounded-3xl p-5 space-y-3">
                  <label className="flex items-center justify-between p-3 glass rounded-xl cursor-pointer">
                    <div>
                      <p className="font-semibold text-sm text-stone-800 dark:text-amber-50">Enable App Lock</p>
                      <p className="text-[10px] text-stone-500 dark:text-amber-100/60">Require PIN to open the app</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={appLockEnabled}
                      onChange={(e) => {
                        setAppLockEnabled(e.target.checked);
                        if (e.target.checked && !appLockPin) {
                          setShowPinSetup(true);
                        }
                      }}
                      className="w-5 h-5 rounded accent-amber-500"
                    />
                  </label>

                  {appLockEnabled && appLockPin && (
                    <>
                      <div className={`glass rounded-xl p-3 ${!biometricSupported ? 'opacity-60' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <p className="font-semibold text-sm text-stone-800 dark:text-amber-50">Biometric unlock</p>
                            <p className="text-[10px] text-stone-500 dark:text-amber-100/60">
                              {biometricSupported ? 'Fingerprint / face unlock' : 'Not supported on this device/browser'}
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={appLockBiometric}
                            disabled={!biometricSupported}
                            onChange={(e) => handleBiometricToggle(e.target.checked)}
                            className="w-5 h-5 rounded accent-amber-500"
                          />
                        </div>
                        {appLockBiometric && biometricSupported && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-green-600 dark:text-green-400">
                            <Fingerprint size={11} />
                            <span>Biometric unlock configured — tap to re-register</span>
                          </div>
                        )}
                        {appLockBiometric && (
                          <button
                            onClick={() => setShowBiometricSetup(true)}
                            className="w-full mt-2 glass-info rounded-lg py-1.5 text-[10px] font-semibold text-white flex items-center justify-center gap-1 active:scale-95 transition-transform"
                          >
                            <Fingerprint size={11} /> {webauthnCredentialId ? 'Re-register biometric' : 'Set up biometric'}
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setShowPinSetup(true)}
                        className="w-full glass rounded-xl py-2.5 text-xs font-semibold text-stone-700 dark:text-amber-100 active:scale-95 transition-transform"
                      >
                        Change PIN
                      </button>
                    </>
                  )}

                  {!appLockEnabled && (
                    <p className="text-[10px] text-stone-500 dark:text-amber-100/50 text-center py-2">
                      You can enable App Lock later in Settings → Security
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={prev}
                    className="glass rounded-2xl py-3 font-semibold text-stone-700 dark:text-amber-100 text-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    onClick={next}
                    className="glass-primary rounded-2xl py-3 font-bold text-white text-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {step === 'tutorial' && (
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-2xl glass-info flex items-center justify-center text-white">
                    <BarChart3 size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-800 dark:text-amber-50">Quick Tour</h2>
                    <p className="text-xs text-stone-500 dark:text-amber-100/60">A quick overview of the app</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <TutorialCard icon={<Package size={16} />} color="amber"
                    title="Add your products" text="Open Inventory to create products with purchase price, selling price and opening stock." />
                  <TutorialCard icon={<Calculator size={16} />} color="green"
                    title="Record sales" text="Use the Sales screen to log each sale. Profit is calculated automatically and stock is deducted." />
                  <TutorialCard icon={<Truck size={16} />} color="cyan"
                    title="Track credit & suppliers" text="Record customer credit and supplier purchases. Track outstanding balances and partial payments." />
                  <TutorialCard icon={<BarChart3 size={16} />} color="amber"
                    title="Watch your dashboard" text="Cash available, gross profit, net profit and dues — all on the home screen." />
                  <TutorialCard icon={<Coins size={16} />} color="green"
                    title="Reports & PDF" text="Review daily, monthly and printable PDF reports anytime — even offline." />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button
                    onClick={prev}
                    className="glass rounded-2xl py-3 font-semibold text-stone-700 dark:text-amber-100 text-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    onClick={next}
                    className="glass-primary rounded-2xl py-3 font-bold text-white text-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 18, stiffness: 200 }}
                  className="w-20 h-20 mx-auto mb-5 rounded-full glass-success flex items-center justify-center text-white shadow-xl"
                >
                  <Check size={36} />
                </motion.div>
                <h1 className="text-2xl font-bold text-stone-800 dark:text-amber-50 mb-2">All set!</h1>
                <p className="text-sm text-stone-600 dark:text-amber-100/70 mb-1">Your shop is ready to go.</p>
                <p className="text-xs text-stone-500 dark:text-amber-100/60 mb-6 max-w-sm mx-auto">
                  Start by adding your first product in Inventory, or jump straight to recording a sale.
                </p>
                <button
                  onClick={finish}
                  className="w-full glass-success rounded-2xl py-4 font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <Check size={18} /> Enter ShopSuite
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <PinSetupDialog
        open={showPinSetup}
        onClose={() => {
          setShowPinSetup(false);
          if (!appLockPin) setAppLockEnabled(false);
        }}
        onSaved={handlePinSaved}
      />

      <BiometricSetupDialog
        open={showBiometricSetup}
        onClose={handleBiometricSetupCancel}
        onRegistered={handleBiometricRegistered}
      />
    </div>
  );
}

function TutorialCard({ icon, color, title, text }: {
  icon: React.ReactNode;
  color: 'amber' | 'green' | 'cyan';
  title: string;
  text: string;
}) {
  const colorMap = {
    amber: 'glass-primary',
    green: 'glass-success',
    cyan: 'glass-info',
  };
  return (
    <div className="glass rounded-2xl p-3 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl ${colorMap[color]} flex items-center justify-center text-white flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-stone-800 dark:text-amber-50">{title}</p>
        <p className="text-xs text-stone-600 dark:text-amber-100/70 mt-0.5">{text}</p>
      </div>
    </div>
  );
}
