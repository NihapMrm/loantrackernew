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

/** Today's date as yyyy-MM-dd in local time (the format <input type="date"> uses) */
export function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
