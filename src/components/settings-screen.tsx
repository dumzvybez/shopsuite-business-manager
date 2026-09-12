'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Store, User, Coins, Palette, Save, BookOpen, DatabaseBackup,
  History, Info, ChevronRight, Github, Globe, Youtube, Lock,
  ShieldCheck, Fingerprint, Trash2, Briefcase, Settings as SettingsIcon, Heart,
  Smartphone, WifiOff, AlertTriangle, ExternalLink, Clock,
} from 'lucide-react';
import {
  useI18n, applyThemeAndBackground, saveSettings, getEditHistory,
  type Settings, type EditHistoryEntry,
} from '@/lib/data-hooks-adapter';
import { useAppToast } from './toast-provider';
import { PinSetupDialog, BiometricSetupDialog } from './app-lock';
import { THEMES, BACKGROUNDS, type ThemeId, type BackgroundId } from '@/lib/themes';
import { CURRENCIES, getCurrency } from '@/lib/currencies';
import { BUSINESS_TYPES } from '@/lib/business-types';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

type Props = {
  settings: Settings;
  onBack: () => void;
  onChanged: () => void;
  onShowTutorial: () => void;
  onOpenBackup: () => void;
  onOpenEditHistory: () => void;
};

// Fields tracked in the draft (saved together via global Save button).
// App Lock / PIN / Biometric are security actions executed immediately
// and are NOT part of the draft.
type DraftSettings = {
  shopName: string;
  ownerName: string;
  shopPhone: string;
  shopAddress: string;
  shopType: string;
  currency: string;
  themeId: ThemeId;
  backgroundId: BackgroundId;
  autoBackupEnabled: boolean;
  autoBackupFrequency: 'daily' | 'weekly' | 'manual';
};

function toDraft(s: Settings): DraftSettings {
  return {
    shopName: s.shopName,
    ownerName: s.ownerName,
    shopPhone: s.shopPhone,
    shopAddress: s.shopAddress,
    shopType: s.shopType,
    currency: s.currency || 'LKR',
    themeId: (s.themeId as ThemeId) || 'modern-dark',
    backgroundId: (s.backgroundId as BackgroundId) || 'default',
    autoBackupEnabled: s.autoBackupEnabled,
    autoBackupFrequency: s.autoBackupFrequency,
  };
}

export function SettingsScreen({
  settings, onBack, onChanged, onShowTutorial, onOpenBackup, onOpenEditHistory,
}: Props) {
  const { t } = useI18n();
  const { toast } = useAppToast();

  // --- Draft state (for the global Save button) ---
  const [draft, setDraft] = useState<DraftSettings>(() => toDraft(settings));
  const [savedDraft, setSavedDraft] = useState<DraftSettings>(() => toDraft(settings));

  // Sync draft when settings prop changes (after save/restore)
  useEffect(() => {
    const d = toDraft(settings);
    setDraft(d);
    setSavedDraft(d);
  }, [settings]);

  // --- Security state (immediate actions, not part of draft) ---
  const [appLockEnabled, setAppLockEnabled] = useState(settings.appLockEnabled);
  const [appLockBiometric, setAppLockBiometric] = useState(settings.appLockBiometric);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(() => {
    setAppLockEnabled(settings.appLockEnabled);
    setAppLockBiometric(settings.appLockBiometric);
  }, [settings.appLockEnabled, settings.appLockBiometric]);

  // Check WebAuthn platform authenticator availability
  useEffect(() => {
    (async () => {
      if ('PublicKeyCredential' in window) {
        try {
          const available = await (PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable?.();
          setBiometricSupported(!!available);
        } catch {
          setBiometricSupported(false);
        }
      } else {
        setBiometricSupported(false);
      }
    })();
  }, []);

  // --- Edit history ---
  const [history, setHistory] = useState<EditHistoryEntry[]>([]);
  useEffect(() => {
    getEditHistory(5).then(setHistory);
  }, []);

  // --- Dirty-state detection ---
  const isDirty = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(savedDraft);
  }, [draft, savedDraft]);

  // --- Unsaved-changes navigation warning ---
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  const attemptBack = useCallback(() => {
    if (isDirty) {
      setPendingNav(() => onBack);
      setShowUnsavedDialog(true);
    } else {
      onBack();
    }
  }, [isDirty, onBack]);

  const handleSaveAll = useCallback(async () => {
    await saveSettings({
      shopName: draft.shopName.trim(),
      ownerName: draft.ownerName.trim(),
      shopPhone: draft.shopPhone,
      shopAddress: draft.shopAddress,
      shopType: draft.shopType,
      currency: draft.currency,
      themeId: draft.themeId,
      theme: draft.themeId === 'light-pro' ? 'light' : 'dark',
      backgroundId: draft.backgroundId,
      autoBackupEnabled: draft.autoBackupEnabled,
      autoBackupFrequency: draft.autoBackupFrequency,
    });
    setSavedDraft({ ...draft });
    toast({ title: t('settings.saved.title'), variant: 'success' });
    onChanged();
  }, [draft, toast, t, onChanged]);

  const handleSaveAndLeave = useCallback(async () => {
    await handleSaveAll();
    setShowUnsavedDialog(false);
    pendingNav?.();
  }, [handleSaveAll, pendingNav]);

  const handleLeaveWithoutSaving = useCallback(() => {
    // Reset draft to the last saved state
    setDraft({ ...savedDraft });
    // Restore theme/background to saved state
    applyThemeAndBackground(savedDraft.themeId, savedDraft.backgroundId);
    setShowUnsavedDialog(false);
    pendingNav?.();
  }, [savedDraft, pendingNav]);

  // --- Draft change handlers (with live preview for theme/bg) ---
  const updateDraft = useCallback(<K extends keyof DraftSettings>(key: K, value: DraftSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleThemeChange = useCallback((id: ThemeId) => {
    updateDraft('themeId', id);
    // Live preview
    applyThemeAndBackground(id, draft.backgroundId);
  }, [updateDraft, draft.backgroundId]);

  const handleBackgroundChange = useCallback((id: BackgroundId) => {
    updateDraft('backgroundId', id);
    // Live preview
    applyThemeAndBackground(draft.themeId, id);
  }, [updateDraft, draft.themeId]);

  // --- Security handlers (immediate, not part of draft) ---
  const handleAppLockToggle = useCallback(async (enabled: boolean) => {
    if (enabled) {
      setAppLockEnabled(true);
      setShowPinSetup(true);
    } else {
      setAppLockEnabled(false);
      setAppLockBiometric(false);
      await saveSettings({ appLockEnabled: false, appLockPin: null, appLockBiometric: false, webauthnCredentialId: null });
      toast({ title: 'App Lock disabled', variant: 'success' });
      onChanged();
    }
  }, [toast, onChanged]);

  const handlePinSaved = useCallback(async (pin: string) => {
    setShowPinSetup(false);
    await saveSettings({ appLockEnabled: true, appLockPin: pin });
    setAppLockEnabled(true);
    toast({ title: 'PIN set — App Lock enabled', variant: 'success' });
    onChanged();
  }, [toast, onChanged]);

  const handleBiometricToggle = useCallback(async (enabled: boolean) => {
    if (enabled) {
      if (!biometricSupported) {
        toast({ title: t('settings.biometricUnsupported'), variant: 'error' });
        return;
      }
      // Open the biometric setup dialog (registration)
      setShowBiometricSetup(true);
    } else {
      setAppLockBiometric(false);
      await saveSettings({ appLockBiometric: false, webauthnCredentialId: null });
      toast({ title: 'Biometric unlock disabled', variant: 'success' });
      onChanged();
    }
  }, [biometricSupported, toast, t, onChanged]);

  const handleBiometricRegistered = useCallback(async (credentialId: string) => {
    setShowBiometricSetup(false);
    setAppLockBiometric(true);
    await saveSettings({ appLockBiometric: true, webauthnCredentialId: credentialId });
    toast({ title: 'Biometric unlock enabled', variant: 'success' });
    onChanged();
  }, [toast, onChanged]);

  const handleBiometricSetupCancel = useCallback(() => {
    setShowBiometricSetup(false);
    // Revert the toggle since setup was cancelled
    setAppLockBiometric(false);
  }, []);

  const ACTION_COLORS: Record<string, string> = {
    create: 'bg-green-500',
    update: 'bg-amber-500',
    'mark-paid': 'bg-cyan-500',
    delete: 'bg-red-500',
  };

  const currentCurrency = getCurrency(draft.currency);

  return (
    <div className="app-shell pb-28">
      <header className="glass-strong sticky top-0 z-30 safe-top">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={attemptBack}
            className="w-10 h-10 rounded-full glass flex items-center justify-center text-stone-700 dark:text-amber-50 active:scale-90 transition-transform"
            aria-label={t('common.back')}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-stone-800 dark:text-amber-50">{t('settings.title')}</h1>
            <p className="text-xs text-stone-600 dark:text-amber-100/70">{t('settings.sub')}</p>
          </div>
          {isDirty && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleSaveAll}
              className="glass-primary rounded-xl px-3 py-2 text-xs font-bold text-white flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <Save size={14} /> {t('settings.saveChanges')}
            </motion.button>
          )}
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* ─────────── BUSINESS ─────────── */}
        <SettingsSection icon={<Briefcase size={16} />} title={t('settings.business')}>
          <Field label={t('settings.shopName')}>
            <input type="text" value={draft.shopName} onChange={(e) => updateDraft('shopName', e.target.value)}
              className="settings-input" />
          </Field>
          <Field label={t('settings.ownerName')}>
            <input type="text" value={draft.ownerName} onChange={(e) => updateDraft('ownerName', e.target.value)}
              className="settings-input" />
          </Field>
          <Field label="Shop phone">
            <input type="tel" value={draft.shopPhone} onChange={(e) => updateDraft('shopPhone', e.target.value)} placeholder="Optional"
              className="settings-input" />
          </Field>
          <Field label="Shop address">
            <input type="text" value={draft.shopAddress} onChange={(e) => updateDraft('shopAddress', e.target.value)} placeholder="Optional"
              className="settings-input" />
          </Field>
          <Field label={t('settings.shopType')}>
            <Select value={draft.shopType} onValueChange={(v) => updateDraft('shopType', v)}>
              <SelectTrigger className="settings-select">
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((bt) => (
                  <SelectItem key={bt.id} value={bt.id}>
                    <span className="font-semibold">{bt.label}</span>
                    <span className="text-xs text-stone-500 ml-1">— {bt.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </SettingsSection>

        {/* ─────────── CURRENCY & REGIONAL ─────────── */}
        <SettingsSection icon={<Coins size={16} />} title={t('settings.currencyRegional')}>
          <Field label={t('settings.currency')}>
            <Select value={draft.currency} onValueChange={(v) => updateDraft('currency', v)}>
              <SelectTrigger className="settings-select">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="font-bold mr-2">{c.symbol}</span>
                    <span className="font-semibold">{c.code}</span>
                    <span className="text-xs text-stone-500 ml-1">— {c.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="glass rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg glass-primary flex items-center justify-center text-white font-bold text-sm">
              {currentCurrency.symbol}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-stone-800 dark:text-amber-50">{currentCurrency.name}</p>
              <p className="text-xs text-stone-500 dark:text-amber-100/60">
                {currentCurrency.code} · {currentCurrency.decimals} decimal{currentCurrency.decimals !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-500 dark:text-amber-100/60">Preview</p>
              <p className="font-bold text-sm text-stone-800 dark:text-amber-50">
                {currentCurrency.position === 'before'
                  ? `${currentCurrency.symbol} 1,234${currentCurrency.decimals > 0 ? '.' + '0'.repeat(currentCurrency.decimals) : ''}`
                  : `1,234${currentCurrency.decimals > 0 ? '.' + '0'.repeat(currentCurrency.decimals) : ''} ${currentCurrency.symbol}`}
              </p>
            </div>
          </div>
        </SettingsSection>

        {/* ─────────── APPEARANCE ─────────── */}
        <SettingsSection icon={<Palette size={16} />} title={t('settings.appearance')}>
          <Field label={t('settings.theme')}>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((th) => (
                <button key={th.id} onClick={() => handleThemeChange(th.id)}
                  className={`p-2 rounded-xl text-xs font-semibold transition-all ${
                    draft.themeId === th.id ? 'glass-primary text-white ring-2 ring-amber-400' : 'glass text-stone-700 dark:text-amber-100'
                  }`}>
                  <div className="w-6 h-6 mx-auto mb-1 rounded-full" style={{ background: th.swatch }} />
                  {th.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Background">
            <div className="grid grid-cols-3 gap-2">
              {BACKGROUNDS.map((bg) => (
                <button key={bg.id} onClick={() => handleBackgroundChange(bg.id)}
                  className={`p-2 rounded-xl text-xs font-semibold transition-all ${
                    draft.backgroundId === bg.id ? 'glass-primary text-white ring-2 ring-amber-400' : 'glass text-stone-700 dark:text-amber-100'
                  }`}>
                  <div className="w-full h-8 mb-1 rounded-lg" style={{ background: bg.preview }} />
                  {bg.label}
                </button>
              ))}
            </div>
          </Field>
          {isDirty && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle size={10} /> Press Save Changes to persist appearance
            </p>
          )}
        </SettingsSection>

        {/* ─────────── SECURITY ─────────── */}
        <SettingsSection icon={<Lock size={16} />} title={t('settings.security')}>
          <ToggleRow
            icon={<Lock size={16} className="text-amber-500" />}
            title={t('settings.appLockTitle')}
            desc={t('settings.appLockDesc')}
            checked={appLockEnabled}
            onChange={handleAppLockToggle}
          />
          {appLockEnabled && (
            <>
              <ToggleRow
                icon={<Fingerprint size={16} className="text-amber-500" />}
                title={t('settings.biometricTitle')}
                desc={biometricSupported ? t('settings.biometricDesc') : t('settings.biometricUnsupported')}
                checked={appLockBiometric}
                disabled={!biometricSupported}
                onChange={handleBiometricToggle}
              />
              <button
                onClick={() => setShowPinSetup(true)}
                className="w-full glass rounded-xl py-2.5 text-xs font-semibold text-stone-700 dark:text-amber-100 active:scale-95 transition-transform flex items-center justify-center gap-1.5"
              >
                <Lock size={12} /> {t('settings.changePin')}
              </button>
            </>
          )}
          <div className="glass rounded-xl p-3 flex items-start gap-2">
            <ShieldCheck size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-stone-600 dark:text-amber-100/70 leading-relaxed">
              {t('settings.securityNote')}
            </p>
          </div>
        </SettingsSection>

        {/* ─────────── BACKUP & DATA ─────────── */}
        <SettingsSection icon={<DatabaseBackup size={16} />} title={t('settings.backupData')}>
          <ToggleRow
            icon={<Clock size={16} className="text-amber-500" />}
            title={t('settings.autoBackupToggle')}
            desc={t('settings.autoBackupDesc')}
            checked={draft.autoBackupEnabled}
            onChange={(v) => updateDraft('autoBackupEnabled', v)}
          />
          {draft.autoBackupEnabled && (
            <Field label={t('settings.autoBackupFreq')}>
              <Select
                value={draft.autoBackupFrequency}
                onValueChange={(v) => updateDraft('autoBackupFrequency', v as 'daily' | 'weekly' | 'manual')}
              >
                <SelectTrigger className="settings-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="manual">Manual only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <button onClick={onOpenBackup}
            className="w-full glass rounded-2xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
            <div className="w-10 h-10 rounded-xl glass-success flex items-center justify-center text-white">
              <DatabaseBackup size={18} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm text-stone-800 dark:text-amber-50">{t('settings.backup')}</p>
              <p className="text-xs text-stone-600 dark:text-amber-100/70">{t('settings.backupSub')}</p>
            </div>
            <ChevronRight size={18} className="text-stone-400" />
          </button>
          <div className="glass rounded-xl p-3 flex items-start gap-2">
            <Lock size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-stone-600 dark:text-amber-100/70 leading-relaxed">
              Automatic backups are stored unencrypted in this browser's IndexedDB. They are not password-protected. Exported backup files are also unencrypted — store them securely.
            </p>
          </div>
        </SettingsSection>

        {/* ─────────── TUTORIAL & HISTORY ─────────── */}
        <SettingsSection icon={<BookOpen size={16} />} title="Quick Actions">
          <button onClick={onShowTutorial}
            className="w-full glass rounded-2xl p-3 flex items-center gap-2 active:scale-[0.98] transition-transform">
            <BookOpen size={16} className="text-amber-500" />
            <span className="text-sm font-semibold text-stone-700 dark:text-amber-100 flex-1 text-left">Replay Tutorial</span>
            <ChevronRight size={14} className="text-stone-400" />
          </button>
          <button onClick={onOpenEditHistory}
            className="w-full glass rounded-2xl p-3 flex items-center gap-2 active:scale-[0.98] transition-transform">
            <History size={16} className="text-amber-500" />
            <span className="text-sm font-semibold text-stone-700 dark:text-amber-100 flex-1 text-left">Edit History</span>
            <ChevronRight size={14} className="text-stone-400" />
          </button>
        </SettingsSection>

        {/* ─────────── ABOUT & DEVELOPER ─────────── */}
        <SettingsSection icon={<Heart size={16} />} title={t('settings.aboutDeveloper')}>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full glass-primary flex items-center justify-center text-white">
              <Heart size={24} />
            </div>
            <div>
              <p className="font-bold text-stone-800 dark:text-amber-50">Dumindu Wanasinghe</p>
              <p className="text-xs text-stone-600 dark:text-amber-100/70">Founder & Developer</p>
            </div>
          </div>

          <p className="text-xs text-stone-600 dark:text-amber-100/70">
            ShopSuite is a privacy-first, offline-first Progressive Web App for small-business management. All data stays on your device — no servers, no tracking.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <LinkButton href="https://github.com/dumzvybez/shopsuite-business-manager" label="Repository" icon={<Github size={14} />} />
            <LinkButton href="https://shopsuite.vercel.app/" label="Live App" icon={<ExternalLink size={14} />} />
            <LinkButton href="https://github.com/dumzvybez" label="GitHub" icon={<Github size={14} />} />
            <LinkButton href="https://dumindu.vercel.app" label="Portfolio" icon={<Globe size={14} />} />
            <LinkButton href="https://www.youtube.com/@DuminduWanasinghe" label="YouTube" icon={<Youtube size={14} />} />
          </div>

          <div className="space-y-2">
            <FeatureRow icon={<Lock size={14} />} color="text-green-600" title="Privacy-First" desc="All data stays on your device. No servers, no accounts, no tracking." />
            <FeatureRow icon={<WifiOff size={14} />} color="text-blue-600" title="Offline-First" desc="Works completely without internet via IndexedDB storage." />
            <FeatureRow icon={<Smartphone size={14} />} color="text-amber-600" title="Installable PWA" desc="Install on Android, iOS, or desktop. Launches like a native app." />
          </div>

          <div className="glass rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-600 dark:text-amber-100/70">Version</span>
              <span className="font-bold text-stone-800 dark:text-amber-50">v3.3.0</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-600 dark:text-amber-100/70">Type</span>
              <span className="font-bold text-green-700 dark:text-green-400">PWA · Offline-first</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-600 dark:text-amber-100/70">License</span>
              <span className="font-bold text-stone-800 dark:text-amber-50">MIT</span>
            </div>
          </div>

          <p className="text-[10px] text-stone-500 dark:text-amber-100/50 text-center">
            © {new Date().getFullYear()} ShopSuite. All Rights Reserved.
          </p>
        </SettingsSection>

        {/* ─────────── RECENT CHANGES ─────────── */}
        <SettingsSection icon={<History size={16} />} title="Recent Changes">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-stone-600 dark:text-amber-100/70">{t('settings.editHistorySub', { n: history.length })}</p>
            <button onClick={onOpenEditHistory} className="text-xs text-amber-700 dark:text-amber-300 font-semibold">View all</button>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-amber-100/60 text-center py-3">No history yet.</p>
          ) : (
            <div className="space-y-1.5">
              {history.map((e) => (
                <div key={e.id} className="glass rounded-xl p-2 flex items-start gap-2">
                  <span className={`w-2 h-2 rounded-full ${ACTION_COLORS[e.action] || 'bg-stone-400'} mt-1.5 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-stone-800 dark:text-amber-50 truncate">{e.summary}</p>
                    <p className="text-[10px] text-stone-500 dark:text-amber-100/50">
                      {new Date(e.at).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>
      </main>

      {/* ─────────── DIALOGS ─────────── */}

      {/* Unsaved changes navigation warning */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              {t('settings.unsavedTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.unsavedDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={handleSaveAndLeave}
              className="glass-primary text-white w-full"
            >
              <Save size={14} className="mr-1.5" /> {t('settings.saveAndLeave')}
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={handleLeaveWithoutSaving}
              className="glass-danger text-white w-full mt-0"
            >
              {t('settings.leaveWithoutSaving')}
            </AlertDialogCancel>
            <AlertDialogCancel className="w-full mt-0">
              {t('common.cancel')}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PIN setup */}
      <PinSetupDialog
        open={showPinSetup}
        onClose={() => {
          setShowPinSetup(false);
          if (!settings.appLockPin) setAppLockEnabled(false);
        }}
        onSaved={handlePinSaved}
      />

      {/* Biometric (WebAuthn) setup */}
      <BiometricSetupDialog
        open={showBiometricSetup}
        onClose={handleBiometricSetupCancel}
        onRegistered={handleBiometricRegistered}
      />
    </div>
  );
}

// ─── Helper components ───────────────────────────────────────────────────────

function SettingsSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-3xl p-5 space-y-3"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg glass flex items-center justify-center text-amber-600 dark:text-amber-400">
          {icon}
        </div>
        <h2 className="font-bold text-stone-800 dark:text-amber-50">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-stone-600 dark:text-amber-100/70 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({ icon, title, desc, checked, onChange, disabled }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center justify-between p-3 glass rounded-xl ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex-shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-stone-800 dark:text-amber-50">{title}</p>
          <p className="text-[10px] text-stone-500 dark:text-amber-100/60">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-600'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </label>
  );
}

function FeatureRow({ icon, color, title, desc }: { icon: React.ReactNode; color: string; title: string; desc: string }) {
  return (
    <div className="glass rounded-xl p-3 flex items-start gap-2">
      <span className={color + ' flex-shrink-0 mt-0.5'}>{icon}</span>
      <div>
        <p className="text-xs font-semibold text-stone-800 dark:text-amber-50">{title}</p>
        <p className="text-[10px] text-stone-600 dark:text-amber-100/70">{desc}</p>
      </div>
    </div>
  );
}

function LinkButton({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="glass rounded-xl py-2.5 px-2 text-xs font-semibold text-stone-700 dark:text-amber-100 flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
      {icon} {label}
    </a>
  );
}
