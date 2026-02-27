import Dexie, { Table } from 'dexie';

export type LoanType = 'GIVEN' | 'TAKEN';
export type LoanStatus = 'OPEN' | 'PARTIAL' | 'PAID';

export interface Person {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface Loan {
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

export interface Payment {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

class LoanTrackerDB extends Dexie {
  people!: Table<Person, string>;
  accounts!: Table<Account, string>;
  loans!: Table<Loan, string>;
  payments!: Table<Payment, string>;

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

// Generate a simple unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function nowISO(): string {
  return new Date().toISOString();
}
