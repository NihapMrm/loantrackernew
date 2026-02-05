import { Timestamp } from 'firebase/firestore';

export type LoanType = 'GIVEN' | 'TAKEN';
export type LoanStatus = 'OPEN' | 'PARTIAL' | 'PAID';

export interface Person {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: Timestamp | Date;
  updated_at: Timestamp | Date;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  created_at: Timestamp | Date;
  updated_at: Timestamp | Date;
}

export interface Loan {
  id: string;
  user_id: string;
  person_id: string;
  account_id: string | null;
  amount: number;
  type: LoanType;
  status: LoanStatus;
  due_date: Timestamp | Date | null;
  notes: string | null;
  created_at: Timestamp | Date;
  updated_at: Timestamp | Date;
}

export interface Payment {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: Timestamp | Date;
  notes: string | null;
  created_at: Timestamp | Date;
}
