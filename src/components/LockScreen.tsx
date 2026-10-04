import { useState, useEffect } from 'react';
import { useSecurity } from '@/lib/security';
import { Button } from '@/components/ui/button';
import { Lock, Fingerprint, Delete } from 'lucide-react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const LOCKOUT_KEY = 'app_lockout_until';

// Persisted so restarting the app doesn't reset the lockout
function readLockout(): number | null {
  const t = Number(localStorage.getItem(LOCKOUT_KEY));
  return t > Date.now() ? t : null;
}

export function LockScreen() {
  const { authenticate, authenticateWithBiometric, biometricEnabled, biometricType, verifyPIN } = useSecurity();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [shake, setShake] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(readLockout);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const MAX_ATTEMPTS = 3;
  const LOCKOUT_DURATION = 30; // 30 seconds

  useEffect(() => {
    // Auto-trigger biometric on mount if enabled
    if (biometricEnabled) {
      handleBiometric();
    }
  }, [biometricEnabled]);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now >= lockoutUntil) {
        localStorage.removeItem(LOCKOUT_KEY);
        setLockoutUntil(null);
        setFailedAttempts(0);
        setRemainingSeconds(0);
        setError('');
      } else {
        setRemainingSeconds(Math.ceil((lockoutUntil - now) / 1000));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handleBiometric = async () => {
    setIsAuthenticating(true);
    setError('');
    
    const success = await authenticateWithBiometric();
    
    if (!success) {
      setError('Biometric authentication failed. Use PIN.');
    }
    
    setIsAuthenticating(false);
  };

  const handleNumberClick = (num: string) => {
    if (pin.length < 4 && !isSuccess && !lockoutUntil) {
      // Haptic feedback
      Haptics.impact({ style: ImpactStyle.Light });
      
      const newPin = pin + num;
      setPin(newPin);
      
      // Auto-submit when 4 digits entered
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0 && !isSuccess && !lockoutUntil) {
      // Haptic feedback
      Haptics.impact({ style: ImpactStyle.Light });
      setPin(pin.slice(0, -1));
      setError('');
    }
  };

  const verifyPin = async (pinToVerify: string) => {
    setError('');
    
    // Check if currently locked out
    if (lockoutUntil && Date.now() < lockoutUntil) {
      return;
    }
    
    // Check if PIN is correct without setting isUnlocked yet
    const isCorrect = await verifyPIN(pinToVerify);
    
    if (!isCorrect) {
      const newFailedAttempts = failedAttempts + 1;
      setFailedAttempts(newFailedAttempts);
      
      // Strong haptic feedback for error
      Haptics.notification({ type: NotificationType.Error });
      setPin('');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      
      // Check if we need to apply lockout
      if (newFailedAttempts >= MAX_ATTEMPTS) {
        const lockoutTime = Date.now() + (LOCKOUT_DURATION * 1000);
        localStorage.setItem(LOCKOUT_KEY, String(lockoutTime));
        setLockoutUntil(lockoutTime);
        setRemainingSeconds(LOCKOUT_DURATION);
        setError(`Too many attempts. Wait ${LOCKOUT_DURATION} seconds.`);
      } else {
        setError(`Incorrect PIN (${newFailedAttempts}/${MAX_ATTEMPTS})`);
      }
    } else {
      // Reset failed attempts on success
      setFailedAttempts(0);
      localStorage.removeItem(LOCKOUT_KEY);
      setLockoutUntil(null);
      
      // Success haptic feedback
      Haptics.notification({ type: NotificationType.Success });
      setIsSuccess(true);
      
      // Wait 1 second before unlocking
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now actually authenticate and unlock
      await authenticate(pinToVerify);
    }
  };

  const isDisabled = isSuccess || !!lockoutUntil;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <div className="px-4 pt-10 pb-6 flex items-center gap-2">
        <div className="w-1.5 h-5 rounded-full bg-primary" />
        <span className="text-sm font-black tracking-tight text-foreground">LoanTracker</span>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 max-w-sm mx-auto w-full">

        {/* Icon tile */}
        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center relative overflow-hidden ${
          isSuccess
            ? 'bg-emerald-500'
            : lockoutUntil
            ? 'bg-rose-500'
            : 'bg-primary'
        }`}>
          <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full bg-white/10 pointer-events-none" />
          {isSuccess
            ? <Lock className="w-9 h-9 text-white z-10" strokeWidth={2.5} />
            : lockoutUntil
            ? <Lock className="w-9 h-9 text-white z-10" strokeWidth={2.5} />
            : <Lock className="w-9 h-9 text-primary-foreground z-10" strokeWidth={2.5} />
          }
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <p className="text-2xl font-black tracking-tight text-foreground">
            {isSuccess ? 'Welcome back' : 'Enter PIN'}
          </p>
          <p className="text-sm text-muted-foreground">
            {lockoutUntil
              ? 'Too many failed attempts'
              : isSuccess
              ? 'Unlocking…'
              : 'Enter your 4-digit PIN to unlock'}
          </p>
        </div>

        {/* PIN Dots */}
        <div className={`flex gap-5 ${shake ? 'animate-shake' : ''}`}>
          {Array(4).fill(0).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                isSuccess
                  ? 'bg-emerald-500 border-emerald-500 scale-110'
                  : lockoutUntil
                  ? 'bg-rose-300 border-rose-300 scale-100'
                  : i < pin.length
                  ? 'bg-primary border-primary scale-110'
                  : 'bg-transparent border-muted-foreground/30 scale-100'
              }`}
            />
          ))}
        </div>

        {/* Status tile */}
        {lockoutUntil ? (
          <div className="w-full rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-1">
              Locked out
            </p>
            <p className="text-4xl font-black text-rose-600 dark:text-rose-400 leading-none">
              {remainingSeconds}s
            </p>
          </div>
        ) : error ? (
          <p className="text-sm text-rose-600 dark:text-rose-400 font-medium text-center">{error}</p>
        ) : (
          <div className="h-[22px]" /> /* spacer to keep layout stable */
        )}

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-2 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((num, i) => {
            if (num === '') return <div key={i} />;

            if (num === 'del') {
              return (
                <Button
                  key={i}
                  variant="ghost"
                  size="lg"
                  type="button"
                  tabIndex={-1}
                  disabled={isDisabled}
                  className="h-16 rounded-2xl text-muted-foreground active:scale-95 active:bg-muted transition-transform focus:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/50 disabled:opacity-30"
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(); }}
                  onPointerUp={(e) => { (e.currentTarget as HTMLElement).blur(); }}
                  onPointerCancel={(e) => { (e.currentTarget as HTMLElement).blur(); }}
                >
                  <Delete className="w-5 h-5" />
                </Button>
              );
            }

            return (
              <Button
                key={i}
                variant="ghost"
                size="lg"
                type="button"
                tabIndex={-1}
                disabled={isDisabled}
                className="h-16 rounded-2xl text-2xl font-black text-foreground active:scale-95 active:bg-primary/10 transition-transform focus:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/50 disabled:opacity-30"
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleNumberClick(num); }}
                onPointerUp={(e) => { (e.currentTarget as HTMLElement).blur(); }}
                onPointerCancel={(e) => { (e.currentTarget as HTMLElement).blur(); }}
              >
                {num}
              </Button>
            );
          })}
        </div>

        {/* Biometric */}
        {biometricEnabled && biometricType && !lockoutUntil && (
          <Button
            onClick={handleBiometric}
            disabled={isAuthenticating || isDisabled}
            variant="outline"
            className="w-full h-12 rounded-2xl border-border font-semibold"
          >
            <Fingerprint className="w-5 h-5 mr-2" />
            Use {biometricType}
          </Button>
        )}

      </div>
    </div>
  );
}
