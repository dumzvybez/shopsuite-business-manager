'use client';

import { useEffect, useState, useCallback } from 'react';
import { ToastProvider } from '@/components/toast-provider';
import { SetupWizard } from '@/components/setup-wizard';
import { LandingPage } from '@/components/landing-page';
import { AppLock } from '@/components/app-lock';
import { MissedDaysModal } from '@/components/missed-days-modal';
import { MonthEndReminderModal } from '@/components/month-end-reminder-modal';
import { Dashboard } from '@/components/dashboard';
import { ProfitCalculatorScreen } from '@/components/profit-calculator-screen';
import { DailyReportsScreen } from '@/components/daily-reports-screen';
import { MonthlyReportsScreen } from '@/components/monthly-reports-screen';
import { PdfReportScreen } from '@/components/pdf-report-screen';
import { BackupScreen } from '@/components/backup-screen';
import { SettingsScreen } from '@/components/settings-screen';
import { CreditScreen } from '@/components/credit-screen';
import { SuppliersScreen } from '@/components/suppliers-screen';
import { SupplierProfileScreen } from '@/components/supplier-profile-screen';
import { InventoryScreen } from '@/components/inventory-screen';
import { EditHistoryScreen } from '@/components/edit-history-screen';
import { ExpenseScreen } from '@/components/expense-screen';
import { BottomNav, type NavView } from '@/components/bottom-nav';
import { Footer } from '@/components/footer';
import {
  useSettings, useCredits, useThemeSync,
  detectMissedDays, saveSettings, todayStr,
} from '@/lib/data-hooks-adapter';
import { I18nProvider } from '@/lib/i18n-context';

type View =
  | 'dashboard' | 'sales' | 'reports' | 'monthly' | 'pdf' | 'backup'
  | 'settings' | 'credit' | 'suppliers' | 'supplier-profile' | 'inventory'
  | 'edit-history' | 'expenses';

type Route = { view: View; date?: string; supplierId?: string | null };

const DEFAULT_ROUTE: Route = { view: 'dashboard' };

function parseHash(): Route {
  if (typeof window === 'undefined') return DEFAULT_ROUTE;
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (!raw) return DEFAULT_ROUTE;
  const parts = raw.split('/').filter(Boolean);
  const [head, a] = parts;
  switch (head) {
    case 'dashboard': return { view: 'dashboard' };
    case 'sales':
    case 'calculator':
      return a ? { view: 'sales', date: a } : { view: 'sales' };
    case 'suppliers': return { view: 'suppliers' };
    case 'supplier':
    case 'supplier-profile':
      return a ? { view: 'supplier-profile', supplierId: a } : { view: 'suppliers' };
    case 'inventory': return { view: 'inventory' };
    case 'credit': return { view: 'credit' };
    case 'expenses': return { view: 'expenses' };
    case 'reports':
    case 'reports-daily':
    case 'daily-reports': return { view: 'reports' };
    case 'monthly':
    case 'reports-monthly':
    case 'monthly-reports': return { view: 'monthly' };
    case 'pdf': return { view: 'pdf' };
    case 'backup': return { view: 'backup' };
    case 'settings': return { view: 'settings' };
    case 'edit-history': return { view: 'edit-history' };
    default: return DEFAULT_ROUTE;
  }
}

function routeToHash(route: Route): string {
  const { view, date, supplierId } = route;
  switch (view) {
    case 'sales': return date ? `#/sales/${date}` : '#/sales';
    case 'supplier-profile': return supplierId ? `#/supplier/${supplierId}` : '#/suppliers';
    default: return `#/${view}`;
  }
}

function AppInner() {
  const { settings, loading, update, refresh } = useSettings();
  const { active: activeCredits } = useCredits();
  const [route, setRoute] = useState<Route>(DEFAULT_ROUTE);
  const [showLanding, setShowLanding] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [locked, setLocked] = useState(false);
  const [showMissedDays, setShowMissedDays] = useState(false);
  const [showMonthEndReminder, setShowMonthEndReminder] = useState(false);
  const [monthEndMonth, setMonthEndMonth] = useState<string>('');
  const [missedChecked, setMissedChecked] = useState(false);

  const view: View = route.view;
  const activeDate = route.date || todayStr();
  const activeSupplierId = route.supplierId || null;

  // Sync theme
  useThemeSync();

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {/* ignore */});
    }
  }, []);

  // -------- URL routing --------
  useEffect(() => {
    setRoute(parseHash());
    const onPop = () => setRoute(parseHash());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  const navigate = useCallback((next: Route) => {
    const hash = routeToHash(next);
    if (typeof window !== 'undefined') {
      if (window.location.hash === hash) {
        setRoute(next);
      } else {
        window.history.pushState(null, '', hash);
        setRoute(next);
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    } else {
      setRoute(next);
    }
  }, []);

  // -------- Post-unlock checks --------
  const runPostUnlockChecks = useCallback(() => {
    if (missedChecked) return;
    (async () => {
      const missed = await detectMissedDays();
      if (missed.length > 0) setShowMissedDays(true);
      setMissedChecked(true);
    })();

    // Month-end reminder
    if (!settings) return;
    const today = new Date();
    const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    if (settings.lastMonthEndPrompted === todayMonth) return;
    const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const installDate = settings.installDate;
    if (!installDate) return;
    const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    if (installDate >= thisMonthStart) return;
    setMonthEndMonth(prevMonth);
    setShowMonthEndReminder(true);
    saveSettings({ lastMonthEndPrompted: todayMonth });
  }, [missedChecked, settings]);

  // -------- Boot sequence --------
  useEffect(() => {
    if (loading) return;

    // Show landing page if onboarding not completed
    if (!settings?.onboardingCompleted) {
      setShowLanding(true);
      return;
    }

    // Check app lock
    if (settings.appLockEnabled && settings.appLockPin) {
      setLocked(true);
    }

    // Missed days check (after unlock — handled below)
    if (!settings.appLockEnabled) {
      runPostUnlockChecks();
    }
  }, [loading, settings?.onboardingCompleted, settings?.appLockEnabled, settings?.appLockPin]);

  // When unlocked, run the post-unlock checks
  useEffect(() => {
    if (!locked && settings?.onboardingCompleted && !settings?.appLockEnabled) {
      runPostUnlockChecks();
    }
  }, [locked, settings?.onboardingCompleted, settings?.appLockEnabled, runPostUnlockChecks]);

  // -------- Auto-backup --------
  useEffect(() => {
    if (loading || !settings?.onboardingCompleted) return;
    if (!settings.autoBackupEnabled) return;
    if (settings.autoBackupFrequency === 'manual') return;
    const today = todayStr();
    if ((settings as any)._lastAutoBackup === today) return;
    (async () => {
      try {
        const { saveAutoBackup } = await import('@/lib/db');
        await saveAutoBackup();
        await saveSettings({ ...(settings as any), _lastAutoBackup: today, lastAutoBackupAt: Date.now() } as any);
      } catch { /* best-effort */ }
    })();
  }, [loading, settings?.onboardingCompleted, settings?.autoBackupEnabled, settings?.autoBackupFrequency]);

  const handleGetStarted = useCallback(() => {
    setShowLanding(false);
    setShowSetup(true);
  }, []);

  const handleSetupComplete = useCallback(() => {
    setShowSetup(false);
    refresh();
  }, [refresh]);

  const handleShowTutorial = useCallback(async () => {
    await saveSettings({ tutorialDone: false });
    navigate({ view: 'dashboard' });
    setShowSetup(true);
  }, [navigate]);

  const handleUnlocked = useCallback(() => {
    setLocked(false);
    runPostUnlockChecks();
  }, [runPostUnlockChecks]);

  // -------- Render gates --------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-body">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-3xl overflow-hidden shadow-xl">
            <img src="/icons/icon-1024.png" alt="ShopSuite" className="w-full h-full object-cover" />
          </div>
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-stone-600 dark:text-amber-100/70 mt-3">Loading…</p>
        </div>
      </div>
    );
  }

  // Landing page (before onboarding)
  if (showLanding) {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  // Onboarding wizard
  if (showSetup) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  // App Lock
  if (locked) {
    return <AppLock onUnlocked={handleUnlocked} />;
  }

  const currency = settings?.currency || 'LKR';
  const shopName = settings?.shopName || '';
  const ownerName = settings?.ownerName || '';
  const shopType = settings?.shopType || '';

  // Bottom nav active state
  const navActive: NavView =
    view === 'sales' ? 'today'
    : view === 'credit' ? 'credit'
    : view === 'suppliers' || view === 'supplier-profile' ? 'suppliers'
    : view === 'expenses' ? 'expenses'
    : view === 'reports' || view === 'monthly' || view === 'pdf' ? 'reports'
    : 'dashboard';

  const handleNavChange = (v: NavView) => {
    if (v === 'today') navigate({ view: 'sales', date: todayStr() });
    else if (v === 'credit') navigate({ view: 'credit' });
    else if (v === 'reports') navigate({ view: 'reports' });
    else if (v === 'suppliers') navigate({ view: 'suppliers' });
    else if (v === 'expenses') navigate({ view: 'expenses' });
    else navigate({ view: 'dashboard' });
  };

  const wrapWithFooter = (content: React.ReactNode) => (
    <>
      {content}
      <Footer />
    </>
  );

  return (
    <>
      {view === 'dashboard' && wrapWithFooter(
        <Dashboard
          date={activeDate}
          currency={currency}
          onSeeAllReports={() => navigate({ view: 'reports' })}
          onSeeMonthlyReports={() => navigate({ view: 'monthly' })}
          onRecentClick={(date) => navigate({ view: 'sales', date })}
          onNewSale={() => navigate({ view: 'sales', date: todayStr() })}
          onAddStock={() => navigate({ view: 'inventory' })}
          onSupplierPurchase={() => navigate({ view: 'suppliers' })}
          onCollectCredit={() => navigate({ view: 'credit' })}
          onAddExpense={() => navigate({ view: 'expenses' })}
          onGenerateReport={() => navigate({ view: 'pdf' })}
          shopName={shopName}
          ownerName={ownerName}
          shopType={shopType}
          onOpenSettings={() => navigate({ view: 'settings' })}
          onOpenInventory={() => navigate({ view: 'inventory' })}
          onOpenSuppliers={() => navigate({ view: 'suppliers' })}
          onOpenCredit={() => navigate({ view: 'credit' })}
          onOpenExpenses={() => navigate({ view: 'expenses' })}
        />
      )}

      {view === 'sales' && wrapWithFooter(
        <ProfitCalculatorScreen
          date={activeDate}
          onBack={() => navigate({ view: 'dashboard' })}
          currency={currency}
        />
      )}

      {view === 'reports' && wrapWithFooter(
        <DailyReportsScreen
          currency={currency}
          onBack={() => navigate({ view: 'dashboard' })}
          onEditDay={(date) => navigate({ view: 'sales', date })}
          onOpenPdf={() => navigate({ view: 'pdf' })}
          onOpenMonthly={() => navigate({ view: 'monthly' })}
        />
      )}

      {view === 'monthly' && wrapWithFooter(
        <MonthlyReportsScreen
          currency={currency}
          onBack={() => navigate({ view: 'dashboard' })}
          onOpenDaily={() => navigate({ view: 'reports' })}
          onOpenPdf={() => navigate({ view: 'pdf' })}
        />
      )}

      {view === 'pdf' && wrapWithFooter(
        <PdfReportScreen
          settings={{ shopName, ownerName, currency }}
          onBack={() => navigate({ view: 'reports' })}
        />
      )}

      {view === 'backup' && wrapWithFooter(
        <BackupScreen
          settings={{ shopName, ownerName, currency, lastBackupAt: settings?.lastBackupAt || null, autoBackupFrequency: settings?.autoBackupFrequency || 'daily', lastAutoBackupAt: settings?.lastAutoBackupAt || null }}
          onBack={() => navigate({ view: 'settings' })}
          onChanged={refresh}
        />
      )}

      {view === 'settings' && settings && wrapWithFooter(
        <SettingsScreen
          settings={settings}
          onBack={() => navigate({ view: 'dashboard' })}
          onChanged={refresh}
          onShowTutorial={handleShowTutorial}
          onOpenBackup={() => navigate({ view: 'backup' })}
          onOpenEditHistory={() => navigate({ view: 'edit-history' })}
        />
      )}

      {view === 'credit' && wrapWithFooter(
        <CreditScreen
          onBack={() => navigate({ view: 'dashboard' })}
          currency={currency}
        />
      )}

      {view === 'suppliers' && wrapWithFooter(
        <SuppliersScreen
          onBack={() => navigate({ view: 'dashboard' })}
          onOpenSupplier={(id) => navigate({ view: 'supplier-profile', supplierId: id })}
          currency={currency}
        />
      )}

      {view === 'supplier-profile' && activeSupplierId && wrapWithFooter(
        <SupplierProfileScreen
          supplierId={activeSupplierId}
          onBack={() => navigate({ view: 'suppliers' })}
          currency={currency}
        />
      )}

      {view === 'inventory' && wrapWithFooter(
        <InventoryScreen
          onBack={() => navigate({ view: 'dashboard' })}
          currency={currency}
        />
      )}

      {view === 'expenses' && wrapWithFooter(
        <ExpenseScreen
          onBack={() => navigate({ view: 'dashboard' })}
          currency={currency}
        />
      )}

      {view === 'edit-history' && wrapWithFooter(
        <EditHistoryScreen
          onBack={() => navigate({ view: 'settings' })}
        />
      )}

      <MissedDaysModal
        open={showMissedDays}
        onClose={() => setShowMissedDays(false)}
        onBackfill={(date) => navigate({ view: 'sales', date })}
      />

      <MonthEndReminderModal
        open={showMonthEndReminder}
        month={monthEndMonth}
        onViewReport={() => {
          setShowMonthEndReminder(false);
          navigate({ view: 'monthly' });
        }}
        onClose={() => setShowMonthEndReminder(false)}
      />

      <BottomNav
        active={navActive}
        onChange={handleNavChange}
        creditBadge={activeCredits.length}
      />
    </>
  );
}

export default function Home() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </I18nProvider>
  );
}
