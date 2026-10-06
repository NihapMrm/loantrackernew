import { useState, useCallback, useEffect } from 'react';

export interface AppSettings {
  // Currency
  currencySymbol: string;        // e.g. 'Rs.', '$', '₹', '€'
  currencyPosition: 'before' | 'after';
  // Number format locale (affects thousands / decimal separators)
  numberLocale: 'en-US' | 'en-IN' | 'de-DE' | 'fr-FR';
  // Date display format (date-fns pattern)
  dateFormat: 'MMM d, yyyy' | 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd';
  // Haptic feedback on swipe actions
  hapticFeedback: boolean;
  // Daily backup to Documents/LoanTracker (Android only)
  autoBackup: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  currencySymbol: 'Rs.',
  currencyPosition: 'before',
  numberLocale: 'en-US',
  dateFormat: 'MMM d, yyyy',
  hapticFeedback: true,
  autoBackup: true,
};

const STORAGE_KEY = 'lt_settings';
const SETTINGS_EVENT = 'lt_settings_changed';

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(s: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

// Returns current settings snapshot (no reactivity) — fast, use in formatters
export function getSettings(): AppSettings {
  return load();
}

// Reactive hook
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(load);

  useEffect(() => {
    const handler = () => setSettings(load());
    window.addEventListener(SETTINGS_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_EVENT, handler);
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    save(next);
    setSettings(next);
  }, [settings]);

  return { settings, update };
}
