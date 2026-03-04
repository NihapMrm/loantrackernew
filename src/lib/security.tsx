import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

interface SecurityContextType {
  isUnlocked: boolean;
  hasPIN: boolean;
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
const BIOMETRIC_KEY = 'app_biometric_enabled';

async function hashPIN(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(true); // Default unlocked (no security)
  const [hasPIN, setHasPIN] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [isNativePlatform, setIsNativePlatform] = useState(false);

  useEffect(() => {
    const init = async () => {
      const native = Capacitor.isNativePlatform();
      setIsNativePlatform(native);

      if (!native) {
        setIsUnlocked(true);
        return;
      }

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

      // Check if PIN is set
      const pin = localStorage.getItem(PIN_KEY);
      const hasPinSet = !!pin;
      setHasPIN(hasPinSet);

      // Check if biometric is enabled
      const bioEnabled = localStorage.getItem(BIOMETRIC_KEY) === 'true';
      setBiometricEnabled(bioEnabled);

      // Lock app if PIN is set
      if (hasPinSet) {
        setIsUnlocked(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!isNativePlatform || !hasPIN) return;

    // Re-lock when app goes to background
    const listener = CapacitorApp.addListener('pause', () => {
      setIsUnlocked(false);
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [isNativePlatform, hasPIN]);

  const setPIN = async (pin: string) => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw new Error('PIN must be exactly 4 digits');
    }
    const hashed = await hashPIN(pin);
    localStorage.setItem(PIN_KEY, hashed);
    setHasPIN(true);
    setIsUnlocked(true);
  };

  const removePIN = async () => {
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem(BIOMETRIC_KEY);
    setHasPIN(false);
    setBiometricEnabled(false);
    setIsUnlocked(true);
  };

  const verifyPIN = async (pin: string): Promise<boolean> => {
    const stored = localStorage.getItem(PIN_KEY);
    if (!stored) return false;
    const hashed = await hashPIN(pin);
    return stored === hashed;
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
