'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Fingerprint, Delete, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { getSettings, saveSettings } from '@/lib/db';

/**
 * App Lock — full-screen overlay shown when appLockEnabled is true.
 * Blocks all app access until the user enters the correct PIN or
 * authenticates via WebAuthn (platform biometric).
 *
 * Security model:
 *  - PIN is stored locally in IndexedDB (settings.appLockPin).
 *  - WebAuthn credential ID is stored in settings.webauthnCredentialId.
 *  - The lock is a UI-access gate. It does NOT encrypt stored data.
 *  - Biometric unlock uses navigator.credentials.get() with the stored
 *    credential ID in allowCredentials, so it authenticates against the
 *    exact credential registered during setup.
 */

// ─── WebAuthn helpers ────────────────────────────────────────────────────────

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function isWebAuthnSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('PublicKeyCredential' in window)) return false;
  try {
    return !!(await (PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable?.());
  } catch {
    return false;
  }
}

/**
 * Register a WebAuthn platform credential for biometric unlock.
 * Returns the base64-encoded credential ID, or null if failed/cancelled.
 */
async function registerBiometricCredential(): Promise<string | null> {
  if (!(await isWebAuthnSupported())) return null;
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(8);
    crypto.getRandomValues(userId);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'ShopSuite' },
        user: {
          id: userId,
          name: 'ShopSuite User',
          displayName: 'ShopSuite User',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    } as any)) as PublicKeyCredential | null;

    if (!credential) return null;
    return bufToBase64(credential.rawId);
  } catch {
    return null;
  }
}

/**
 * Authenticate using a previously-registered WebAuthn credential.
 * Returns true if authentication succeeded.
 */
async function authenticateBiometric(credentialIdB64: string): Promise<boolean> {
  if (!(await isWebAuthnSupported())) return false;
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const allowCredentials = [{
      type: 'public-key',
      id: base64ToBuf(credentialIdB64),
      transports: ['internal'] as AuthenticatorTransport[],
    }];

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        allowCredentials,
      },
    } as any);
    return !!assertion;
  } catch {
    return false;
  }
}

// ─── AppLock (full-screen lock) ──────────────────────────────────────────────

type Props = {
  onUnlocked: () => void;
};

export function AppLock({ onUnlocked }: Props) {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [correctPin, setCorrectPin] = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  // Explicit state machine for biometric unlock attempts.
  //   idle              — nothing has happened yet (settings still loading or not eligible)
  //   automaticAttempt  — the first automatic prompt is in-flight
  //   authenticating    — a manual prompt is in-flight
  //   cancelled         — the user cancelled the prompt (no auto-retry)
  //   failed            — the prompt errored (no auto-retry)
  const [bioStatus, setBioStatus] = useState<'idle' | 'automaticAttempt' | 'authenticating' | 'cancelled' | 'failed'>('idle');
  const [attempts, setAttempts] = useState(0);
  // Guards against the auto-trigger effect ever firing more than once per mount,
  // regardless of how React re-creates the handleBiometric callback.
  const autoTriggeredRef = useRef(false);
  const settingsLoadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setCorrectPin(s.appLockPin);
      setBiometricEnabled(s.appLockBiometric);
      setCredentialId(s.webauthnCredentialId);
      if (s.appLockBiometric && s.webauthnCredentialId) {
        setBiometricAvailable(await isWebAuthnSupported());
      }
      settingsLoadedRef.current = true;
    })();
  }, []);

  const runBiometric = useCallback(async (credentialIdB64: string, isAutomatic: boolean) => {
    setBioStatus(isAutomatic ? 'automaticAttempt' : 'authenticating');
    try {
      const ok = await authenticateBiometric(credentialIdB64);
      if (ok) {
        setBioStatus('idle');
        onUnlocked();
        return;
      }
      // null/failed result without throwing — treat as cancelled
      setBioStatus('cancelled');
    } catch {
      setBioStatus('cancelled');
    }
  }, [onUnlocked]);

  // Auto-trigger biometric EXACTLY ONCE on mount, only after settings are loaded,
  // only if biometric is enabled + a credential exists + WebAuthn is available.
  // This effect has NO dependency on `runBiometric` (which would change identity
  // on re-render) — it reads the needed values via refs so it cannot re-fire.
  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (!settingsLoadedRef.current) return;
    if (!biometricAvailable || !biometricEnabled || !credentialId) return;
    autoTriggeredRef.current = true;
    runBiometric(credentialId, true);
  }, [biometricAvailable, biometricEnabled, credentialId, runBiometric]);

  // Manual retry — triggered by the user pressing the biometric button.
  const handleBiometricManual = useCallback(() => {
    if (!credentialId) return;
    if (bioStatus === 'authenticating' || bioStatus === 'automaticAttempt') return; // already in-flight
    runBiometric(credentialId, false);
  }, [credentialId, bioStatus, runBiometric]);

  const biometricBusy = bioStatus === 'automaticAttempt' || bioStatus === 'authenticating';
  const showCancelledMsg = bioStatus === 'cancelled' || bioStatus === 'failed';

  const handleDigit = (d: string) => {
    if (pin.length >= 8) return;
    setError(false);
    const next = pin + d;
    setPin(next);
    const targetLen = correctPin?.length || 4;
    if (next.length === targetLen) {
      if (next === correctPin) {
        setTimeout(() => onUnlocked(), 150);
      } else {
        setTimeout(() => {
          setError(true);
          setPin('');
          setAttempts((a) => a + 1);
        }, 200);
      }
    }
  };

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
    setError(false);
  };

  const shake = error;
  const dots = Array.from({ length: correctPin?.length || 4 }, (_, i) => i);
  const canUseBiometric = biometricAvailable && biometricEnabled && !!credentialId;

  return (
    <motion.div
      className="fixed inset-0 z-[300] app-body flex flex-col items-center justify-center safe-top safe-bottom"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="w-full max-w-[22rem] px-5 sm:px-6 mx-auto flex flex-col items-center">
        {/* Logo + title */}
        <div className="text-center mb-6 sm:mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-3xl glass-primary flex items-center justify-center text-white shadow-xl"
          >
            <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8" />
          </motion.div>
          <h1 className="text-lg sm:text-xl font-bold text-stone-800 dark:text-amber-50">ShopSuite</h1>
          <p className="text-xs text-stone-500 dark:text-amber-100/60 mt-1">Enter your PIN to unlock</p>
        </div>

        {/* PIN dots */}
        <motion.div
          className="flex items-center justify-center gap-2.5 sm:gap-3 mb-6 sm:mb-8"
          animate={shake ? { x: [-8, 8, -8, 8, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          {dots.map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 transition-all ${
                error
                  ? 'border-red-500 bg-red-500/20'
                  : i < pin.length
                  ? 'border-amber-500 bg-amber-500'
                  : 'border-stone-400 dark:border-amber-100/30'
              }`}
            />
          ))}
        </motion.div>

        {/* Error / status message */}
        <div className="min-h-[1.5rem] text-center mb-3 sm:mb-4">
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs font-semibold text-red-500"
            >
              {attempts >= 3 ? 'Too many attempts. Try again.' : 'Wrong PIN. Try again.'}
            </motion.p>
          )}
          {showCancelledMsg && !error && canUseBiometric && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-stone-500 dark:text-amber-100/60"
            >
              Biometric prompt cancelled
            </motion.p>
          )}
        </div>

        {/* Number pad — responsive: centered, capped width, touch-friendly buttons */}
        <div
          className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-4 w-full max-w-[18rem] mx-auto"
          style={{ touchAction: 'manipulation' }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="aspect-square glass-strong rounded-2xl text-lg sm:text-xl font-bold text-stone-800 dark:text-amber-50 flex items-center justify-center active:scale-90 transition-transform select-none"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleBiometricManual}
            disabled={!canUseBiometric || biometricBusy}
            className={`aspect-square rounded-2xl flex items-center justify-center transition-transform ${
              canUseBiometric
                ? 'glass-info text-white active:scale-90'
                : 'glass text-stone-300 dark:text-amber-100/20 cursor-not-allowed'
            }`}
            aria-label="Use biometric"
          >
            {biometricBusy ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : <Fingerprint className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="aspect-square glass-strong rounded-2xl text-lg sm:text-xl font-bold text-stone-800 dark:text-amber-50 flex items-center justify-center active:scale-90 transition-transform select-none"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="aspect-square glass rounded-2xl text-stone-700 dark:text-amber-100 flex items-center justify-center active:scale-90 transition-transform"
            aria-label="Delete"
          >
            <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Manual retry button — visible after cancellation */}
        {showCancelledMsg && canUseBiometric && (
          <button
            onClick={handleBiometricManual}
            disabled={biometricBusy}
            className="glass-info rounded-xl px-4 py-2 text-xs font-semibold text-white flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-60 mb-2"
          >
            <Fingerprint size={14} /> Try biometric again
          </button>
        )}

        <p className="text-center text-[10px] text-stone-400 dark:text-amber-100/40">
          <Lock size={10} className="inline mr-1" />
          App access is protected on this device
        </p>
      </div>
    </motion.div>
  );
}

// ─── PIN setup dialog (used in onboarding + settings) ───────────────────────

type SetupProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (pin: string) => void;
  title?: string;
};

export function PinSetupDialog({ open, onClose, onSaved, title = 'Set App Lock PIN' }: SetupProps) {
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStep('enter');
      setPin1('');
      setPin2('');
      setError('');
    }
  }, [open]);

  const handleDigit = (d: string) => {
    setError('');
    const maxLen = 8;
    if (step === 'enter') {
      if (pin1.length >= maxLen) return;
      const next = pin1 + d;
      setPin1(next);
      if (next.length >= 4) {
        setTimeout(() => setStep('confirm'), 150);
      }
    } else {
      if (pin2.length >= maxLen) return;
      const next = pin2 + d;
      setPin2(next);
      if (next.length >= 4 && next === pin1) {
        setTimeout(() => onSaved(next), 150);
      } else if (next.length >= pin1.length) {
        setTimeout(() => {
          setError('PINs do not match. Start again.');
          setStep('enter');
          setPin1('');
          setPin2('');
        }, 200);
      }
    }
  };

  const handleDelete = () => {
    setError('');
    if (step === 'enter') setPin1((p) => p.slice(0, -1));
    else setPin2((p) => p.slice(0, -1));
  };

  const currentPin = step === 'enter' ? pin1 : pin2;
  const dots = Array.from({ length: Math.max(4, currentPin.length) }, (_, i) => i);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-xs glass-strong rounded-3xl p-6"
            initial={{ scale: 0.9, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl glass-primary flex items-center justify-center text-white">
                <Lock size={20} />
              </div>
              <h2 className="text-base font-bold text-stone-800 dark:text-amber-50">{title}</h2>
              <p className="text-xs text-stone-500 dark:text-amber-100/60 mt-1">
                {step === 'enter' ? 'Enter a 4–8 digit numeric PIN' : 'Confirm your PIN'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 mb-6">
              {dots.map((i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    i < currentPin.length
                      ? 'border-amber-500 bg-amber-500'
                      : 'border-stone-400 dark:border-amber-100/30'
                  }`}
                />
              ))}
            </div>

            <div className="h-5 text-center mb-3">
              {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
            </div>

            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[16rem] mx-auto" style={{ touchAction: 'manipulation' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDigit(d)}
                  className="aspect-square glass rounded-xl text-lg font-bold text-stone-800 dark:text-amber-50 flex items-center justify-center active:scale-90 transition-transform select-none"
                >
                  {d}
                </button>
              ))}
              <div />
              <button
                onClick={() => handleDigit('0')}
                className="aspect-square glass rounded-xl text-lg font-bold text-stone-800 dark:text-amber-50 flex items-center justify-center active:scale-90 transition-transform select-none"
              >
                0
              </button>
              <button
                onClick={handleDelete}
                className="aspect-square glass rounded-xl text-stone-700 dark:text-amber-100 flex items-center justify-center active:scale-90 transition-transform"
              >
                <Delete size={18} />
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-4 text-xs text-stone-500 dark:text-amber-100/60 py-2"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Biometric (WebAuthn) setup dialog ───────────────────────────────────────

type BioSetupProps = {
  open: boolean;
  onClose: () => void;
  onRegistered: (credentialId: string) => void;
};

export function BiometricSetupDialog({ open, onClose, onRegistered }: BioSetupProps) {
  const [status, setStatus] = useState<'idle' | 'registering' | 'failed' | 'unsupported'>('idle');

  useEffect(() => {
    if (!open) {
      setStatus('idle');
      return;
    }
    (async () => {
      setStatus('registering');
      const supported = await isWebAuthnSupported();
      if (!supported) {
        setStatus('unsupported');
        return;
      }
      const credId = await registerBiometricCredential();
      if (credId) {
        onRegistered(credId);
      } else {
        setStatus('failed');
      }
    })();
  }, [open, onRegistered]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[210] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
          <motion.div
            className="relative w-full max-w-xs glass-strong rounded-3xl p-6 text-center"
            initial={{ scale: 0.9, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            {status === 'registering' && (
              <>
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl glass-info flex items-center justify-center text-white">
                  <Loader2 size={26} className="animate-spin" />
                </div>
                <h2 className="text-base font-bold text-stone-800 dark:text-amber-50 mb-1">Setting up biometric</h2>
                <p className="text-xs text-stone-500 dark:text-amber-100/60">
                  Follow your device's prompt to register your fingerprint or face.
                </p>
              </>
            )}

            {status === 'failed' && (
              <>
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl glass-danger flex items-center justify-center text-white">
                  <AlertTriangle size={26} />
                </div>
                <h2 className="text-base font-bold text-stone-800 dark:text-amber-50 mb-1">Setup cancelled</h2>
                <p className="text-xs text-stone-500 dark:text-amber-100/60 mb-4">
                  Biometric setup was cancelled or failed. Your PIN lock remains active.
                </p>
                <button
                  onClick={onClose}
                  className="w-full glass rounded-xl py-2.5 text-xs font-semibold text-stone-700 dark:text-amber-100 active:scale-95 transition-transform"
                >
                  OK
                </button>
              </>
            )}

            {status === 'unsupported' && (
              <>
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl glass-danger flex items-center justify-center text-white">
                  <AlertTriangle size={26} />
                </div>
                <h2 className="text-base font-bold text-stone-800 dark:text-amber-50 mb-1">Not supported</h2>
                <p className="text-xs text-stone-500 dark:text-amber-100/60 mb-4">
                  Biometric unlock is not supported on this device or browser. PIN lock remains active.
                </p>
                <button
                  onClick={onClose}
                  className="w-full glass rounded-xl py-2.5 text-xs font-semibold text-stone-700 dark:text-amber-100 active:scale-95 transition-transform"
                >
                  OK
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── PIN verification dialog (for auth actions like backup restore) ──────────

type VerifyProps = {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  title?: string;
};

export function PinVerifyDialog({ open, onClose, onVerified, title = 'Enter PIN' }: VerifyProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [correctPin, setCorrectPin] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (open) {
      setPin('');
      setError(false);
      setAttempts(0);
      (async () => {
        const s = await getSettings();
        setCorrectPin(s.appLockPin);
      })();
    }
  }, [open]);

  const handleDigit = (d: string) => {
    if (pin.length >= 8 || !correctPin) return;
    setError(false);
    const next = pin + d;
    setPin(next);
    const targetLen = correctPin.length || 4;
    if (next.length === targetLen) {
      if (next === correctPin) {
        setTimeout(() => {
          onVerified();
          setPin('');
        }, 150);
      } else {
        setTimeout(() => {
          setError(true);
          setPin('');
          setAttempts((a) => a + 1);
        }, 200);
      }
    }
  };

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
    setError(false);
  };

  const dots = Array.from({ length: correctPin?.length || 4 }, (_, i) => i);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[210] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-xs glass-strong rounded-3xl p-6"
            initial={{ scale: 0.9, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl glass-primary flex items-center justify-center text-white">
                <Lock size={20} />
              </div>
              <h2 className="text-base font-bold text-stone-800 dark:text-amber-50">{title}</h2>
              <p className="text-xs text-stone-500 dark:text-amber-100/60 mt-1">
                Enter your App Lock PIN to continue
              </p>
            </div>

            <motion.div
              className="flex items-center justify-center gap-3 mb-6"
              animate={error ? { x: [-8, 8, -8, 8, 0] } : {}}
              transition={{ duration: 0.4 }}
            >
              {dots.map((i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    error
                      ? 'border-red-500 bg-red-500/20'
                      : i < pin.length
                      ? 'border-amber-500 bg-amber-500'
                      : 'border-stone-400 dark:border-amber-100/30'
                  }`}
                />
              ))}
            </motion.div>

            <div className="h-5 text-center mb-3">
              {error && (
                <p className="text-xs font-semibold text-red-500">
                  {attempts >= 3 ? 'Too many attempts. Try again.' : 'Wrong PIN. Try again.'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[16rem] mx-auto" style={{ touchAction: 'manipulation' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDigit(d)}
                  className="aspect-square glass rounded-xl text-lg font-bold text-stone-800 dark:text-amber-50 flex items-center justify-center active:scale-90 transition-transform select-none"
                >
                  {d}
                </button>
              ))}
              <div />
              <button
                onClick={() => handleDigit('0')}
                className="aspect-square glass rounded-xl text-lg font-bold text-stone-800 dark:text-amber-50 flex items-center justify-center active:scale-90 transition-transform select-none"
              >
                0
              </button>
              <button
                onClick={handleDelete}
                className="aspect-square glass rounded-xl text-stone-700 dark:text-amber-100 flex items-center justify-center active:scale-90 transition-transform"
              >
                <Delete size={18} />
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-4 text-xs text-stone-500 dark:text-amber-100/60 py-2"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
