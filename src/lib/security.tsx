import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { PrivacyScreen } from '@/lib/privacyScreen';
import { hashPin, verifyPinHash, isLegacyHash, isValidPin } from '@/lib/pinHash';

interface SecurityContextType {
  isUnlocked: boolean;
  hasPIN: boolean;
  pinLength: number;
  biometricEnabled: boolean;
  biometricType: string | null;
  setPIN: (pin: string) => Promise<void>;
  removePIN: () => Promise<void>;
  verifyPIN: (pin: string) => Promise<boolean>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  authenticate: (pin: string) => Promise<boolean>;
  authenticateWithBiometric: () => Promise<boolean>;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

const PIN_KEY = 'app_security_pin';
const PIN_LENGTH_KEY = 'app_security_pin_length';
const BIOMETRIC_KEY = 'app_biometric_enabled';

// PINs set before v2 have no stored length and are always 4 digits
const readPinLength = () => (localStorage.getItem(PIN_LENGTH_KEY) === '6' ? 6 : 4);

// Read synchronously so the very first render is already locked (no flash of data)
const isNativePlatform = Capacitor.isNativePlatform();
const pinSetAtLaunch = isNativePlatform && !!localStorage.getItem(PIN_KEY);

// The file picker and share sheet are separate Android screens, so opening them pauses the app.
// Re-locking then would unmount the page that is waiting for the result, so the app can mark
// a pause as expected for a short window before it opens one of them.
let skipLockUntil = 0;
export function allowExternalActivity(ms = 10000) {
  skipLockUntil = Date.now() + ms;
}

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(!pinSetAtLaunch);
  const [hasPIN, setHasPIN] = useState(pinSetAtLaunch);
  const [pinLength, setPinLength] = useState(readPinLength);
  const [biometricEnabled, setBiometricEnabled] = useState(
    pinSetAtLaunch && localStorage.getItem(BIOMETRIC_KEY) === 'true'
  );
  const [biometricType, setBiometricType] = useState<string | null>(null);

  useEffect(() => {
    if (!isNativePlatform) return;
    const init = async () => {
      // Check if biometric is available
      try {
        const result = await NativeBiometric.isAvailable();
        if (result.isAvailable) {
          setBiometricType(
            result.biometryType === BiometryType.FINGERPRINT ? 'Fingerprint' :
            result.biometryType === BiometryType.FACE_AUTHENTICATION ? 'Face' :
            result.biometryType === BiometryType.IRIS_AUTHENTICATION ? 'Iris' :
            'Biometric'
          );
        }
      } catch (err) {
        console.log('Biometric not available:', err);
      }
    };

    init();
  }, []);

  // Hide app content in the recent-apps screen while a PIN protects it
  useEffect(() => {
    if (!isNativePlatform) return;
    PrivacyScreen.setEnabled({ enabled: hasPIN }).catch(err => console.log('Privacy screen unavailable:', err));
  }, [hasPIN]);

  useEffect(() => {
    if (!isNativePlatform || !hasPIN) return;

    // Re-lock when app goes to background
    const pause = CapacitorApp.addListener('pause', () => {
      if (Date.now() < skipLockUntil) return;
      setIsUnlocked(false);
    });
    // Back in the app: the next pause is a real one again
    const resume = CapacitorApp.addListener('resume', () => { skipLockUntil = 0; });

    return () => {
      pause.then(l => l.remove());
      resume.then(l => l.remove());
    };
  }, [hasPIN]);

  const setPIN = async (pin: string) => {
    if (!isValidPin(pin)) {
      throw new Error('PIN must be 4 or 6 digits');
    }
    localStorage.setItem(PIN_KEY, await hashPin(pin));
    localStorage.setItem(PIN_LENGTH_KEY, String(pin.length));
    setPinLength(pin.length);
    setHasPIN(true);
    setIsUnlocked(true);
  };

  const removePIN = async () => {
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem(PIN_LENGTH_KEY);
    localStorage.removeItem(BIOMETRIC_KEY);
    setHasPIN(false);
    setBiometricEnabled(false);
    setIsUnlocked(true);
  };

  const verifyPIN = async (pin: string): Promise<boolean> => {
    const stored = localStorage.getItem(PIN_KEY);
    if (!stored || !(await verifyPinHash(pin, stored))) return false;
    // Upgrade a v1 unsalted SHA-256 hash now that we have the PIN
    if (isLegacyHash(stored)) localStorage.setItem(PIN_KEY, await hashPin(pin));
    return true;
  };

  const authenticate = async (pin: string): Promise<boolean> => {
    if (await verifyPIN(pin)) {
      setIsUnlocked(true);
      return true;
    }
    return false;
  };

  const authenticateWithBiometric = async (): Promise<boolean> => {
    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Authenticate to access LoanTracker',
        title: 'LoanTracker',
        subtitle: 'Unlock with biometrics',
        description: 'Use your fingerprint or face to unlock',
      });
      setIsUnlocked(true);
      return true;
    } catch (err) {
      return false;
    }
  };

  const enableBiometric = async () => {
    if (!hasPIN) {
      throw new Error('Set a PIN first before enabling biometric');
    }
    // Test biometric
    const success = await authenticateWithBiometric();
    if (success) {
      localStorage.setItem(BIOMETRIC_KEY, 'true');
      setBiometricEnabled(true);
    } else {
      throw new Error('Biometric authentication failed');
    }
  };

  const disableBiometric = async () => {
    localStorage.setItem(BIOMETRIC_KEY, 'false');
    setBiometricEnabled(false);
  };

  return (
    <SecurityContext.Provider
      value={{
        isUnlocked,
        hasPIN,
        pinLength,
        biometricEnabled,
        biometricType,
        setPIN,
        removePIN,
        verifyPIN,
        enableBiometric,
        disableBiometric,
        authenticate,
        authenticateWithBiometric,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within SecurityProvider');
  }
  return context;
}
