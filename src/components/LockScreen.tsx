import { useState, useEffect } from 'react';
import { useSecurity } from '@/lib/security';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Fingerprint, Delete } from 'lucide-react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export function LockScreen() {
  const { authenticate, authenticateWithBiometric, biometricEnabled, biometricType, verifyPIN } = useSecurity();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [shake, setShake] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
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
    const isCorrect = verifyPIN(pinToVerify);
    
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
        setLockoutUntil(lockoutTime);
        setRemainingSeconds(LOCKOUT_DURATION);
        setError(`Too many attempts. Wait ${LOCKOUT_DURATION} seconds.`);
      } else {
        setError(`Incorrect PIN (${newFailedAttempts}/${MAX_ATTEMPTS})`);
      }
    } else {
      // Reset failed attempts on success
      setFailedAttempts(0);
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

  const pinDots = Array(4).fill(0).map((_, i) => (
    <div
      key={i}
      className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
        isSuccess
          ? 'bg-green-600 border-green-600 scale-110'
          : i < pin.length 
          ? 'bg-blue-600 border-blue-600 scale-110' 
          : 'bg-transparent border-gray-300 scale-100'
      }`}
    />
  ));

  const numberButtons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((num, i) => {
    if (num === '') {
      return <div key={i} />;
    }
    
    const isDisabled = isSuccess || !!lockoutUntil;
    
    if (num === 'del') {
      return (
        <Button
          key={i}
          variant="ghost"
          size="lg"
          type="button"
          tabIndex={-1}
          disabled={isDisabled}
          className="h-16 text-lg font-semibold active:scale-95 active:bg-gray-200 transition-transform focus:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-transparent data-[state=open]:bg-transparent disabled:opacity-50"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDelete();
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).blur();
          }}
          onPointerCancel={(e) => {
            (e.currentTarget as HTMLElement).blur();
          }}
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
        className="h-16 text-2xl font-semibold active:scale-95 active:bg-blue-100 transition-transform focus:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-transparent data-[state=open]:bg-transparent disabled:opacity-50"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleNumberClick(num);
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLElement).blur();
        }}
        onPointerCancel={(e) => {
          (e.currentTarget as HTMLElement).blur();
        }}
      >
        {num}
      </Button>
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
            <Lock className="w-10 h-10 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Enter PIN</CardTitle>
          <CardDescription>
            Enter your 4-digit PIN to unlock
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PIN Dots */}
          <div className={`flex justify-center gap-4 py-4 ${shake ? 'animate-shake' : ''}`}>
            {pinDots}
          </div>
          
          {lockoutUntil ? (
            <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3">
              <p className="text-sm text-red-700 dark:text-red-300 text-center font-medium">
                Too many failed attempts
              </p>
              <p className="text-2xl text-red-600 dark:text-red-400 text-center font-bold mt-1">
                {remainingSeconds}s
              </p>
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 text-center font-medium">{error}</p>
          ) : null}

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-2">
            {numberButtons}
          </div>

          {/* Biometric Button (only if enabled) */}
          {biometricEnabled && biometricType && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              
              <Button
                onClick={handleBiometric}
                disabled={isAuthenticating}
                variant="outline"
                className="w-full h-12"
              >
                <Fingerprint className="w-5 h-5 mr-2" />
                Use {biometricType}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
