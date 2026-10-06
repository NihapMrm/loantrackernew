import { format as dateFnsFormat } from 'date-fns';
import { getSettings, AppSettings } from '@/hooks/useSettings';
import { parseLocalDate } from '@/lib/db';

/** Format an amount using the user's currency + number settings */
export function formatAmount(amount: number, overrideSettings?: AppSettings): string {
  const s = overrideSettings ?? getSettings();
  const num = new Intl.NumberFormat(s.numberLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  return s.currencyPosition === 'before'
    ? `${s.currencySymbol} ${num}`
    : `${num} ${s.currencySymbol}`;
}

/** Format a date string or Date object using the user's date format setting */
export function formatDate(date: string | Date, overrideSettings?: AppSettings): string {
  try {
    const s = overrideSettings ?? getSettings();
    const d = typeof date === 'string' ? parseLocalDate(date) : date;
    if (isNaN(d.getTime())) return '—';
    return dateFnsFormat(d, s.dateFormat);
  } catch {
    return String(date);
  }
}
