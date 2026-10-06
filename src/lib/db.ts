import Dexie, { Table } from 'dexie';

// Raw row shapes as stored in IndexedDB (dates are ISO strings).
// The enriched, Date-typed versions used by the UI live in hooks/useLoans.ts and hooks/useAccounts.ts.

export type LoanType = 'GIVEN' | 'TAKEN';
export type LoanStatus = 'OPEN' | 'PARTIAL' | 'PAID';

export interface PersonRow {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountRow {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface LoanRow {
  id: string;
  person_id: string;
  account_id: string | null;
  amount: number;
  type: LoanType;
  status: LoanStatus;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRow {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

class LoanTrackerDB extends Dexie {
  people!: Table<PersonRow, string>;
  accounts!: Table<AccountRow, string>;
  loans!: Table<LoanRow, string>;
  payments!: Table<PaymentRow, string>;

  constructor() {
    super('LoanTrackerDB');
    this.version(1).stores({
      people: 'id, name',
      accounts: 'id, name',
      loans: 'id, person_id, account_id, status, type, created_at',
      payments: 'id, loan_id, payment_date',
    });
    // v2: index due_date (reminders, overdue filter); clean up v1 data in place
    this.version(2).stores({
      loans: 'id, person_id, account_id, status, type, created_at, due_date',
    }).upgrade(async tx => {
      const paid = new Map<string, number>();
      await tx.table<PaymentRow, string>('payments').toCollection().modify(p => {
        p.amount = roundMoney(p.amount);
        p.payment_date = normalizePaymentDate(p.payment_date);
        paid.set(p.loan_id, (paid.get(p.loan_id) ?? 0) + p.amount);
      });
      await tx.table<LoanRow, string>('loans').toCollection().modify(l => {
        l.amount = roundMoney(l.amount);
        l.status = deriveStatus(l.amount, paid.get(l.id) ?? 0);
      });
    });
  }
}

export const db = new LoanTrackerDB();

// Generate a cryptographically random unique ID
export function generateId(): string {
  return crypto.randomUUID();
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Round money to 2 decimals so float sums like 0.1 + 0.2 don't drift */
export function roundMoney(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** Status rule shared by every payment/amount change: PAID ≥ amount, PARTIAL > 0, else OPEN */
export function deriveStatus(amount: number, totalPaid: number): LoanStatus {
  const paid = roundMoney(totalPaid);
  if (paid >= roundMoney(amount)) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  return 'OPEN';
}

/** Midnight-UTC timestamps written by older versions are really calendar days */
export function normalizePaymentDate(s: string): string {
  return /^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?Z$/.test(s) ? s.slice(0, 10) : s;
}

/**
 * Parse a stored date. A bare `yyyy-MM-dd` is a calendar day, so it becomes local midnight
 * (`new Date('2026-03-20')` would be UTC midnight and show the day before west of UTC).
 */
export function parseLocalDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
}

/** Today's date as yyyy-MM-dd in local time (the format <input type="date"> uses) */
export function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
