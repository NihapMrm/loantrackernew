import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db, generateId, nowISO } from '@/lib/db';
import { toast } from 'sonner';
import type { Account } from '@/hooks/useAccounts';

export type LoanType = 'GIVEN' | 'TAKEN';
export type LoanStatus = 'OPEN' | 'PARTIAL' | 'PAID';

export interface Person {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Loan {
  id: string;
  person_id: string;
  account_id: string | null;
  amount: number;
  type: LoanType;
  status: LoanStatus;
  due_date: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  person?: Person;
  account?: Account;
  payments?: Payment[];
}

export interface Payment {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: Date;
  notes: string | null;
  created_at: Date;
}

const toDate = (s: string | null | undefined): Date => s ? new Date(s) : new Date();

// ===== PEOPLE HOOKS =====

export function usePeople() {
  return useQuery({
    queryKey: ['people'],
    queryFn: async () => {
      const rows = await db.people.orderBy('name').toArray();
      return rows.map(r => ({
        ...r,
        created_at: toDate(r.created_at),
        updated_at: toDate(r.updated_at),
      })) as Person[];
    },
  });
}

export function usePerson(id: string | undefined) {
  return useQuery({
    queryKey: ['person', id],
    queryFn: async () => {
      if (!id) return null;
      const r = await db.people.get(id);
      if (!r) return null;
      return { ...r, created_at: toDate(r.created_at), updated_at: toDate(r.updated_at) } as Person;
    },
    enabled: !!id,
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; phone?: string; notes?: string }) => {
      const now = nowISO();
      const person = {
        id: generateId(),
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        notes: data.notes?.trim() || null,
        created_at: now,
        updated_at: now,
      };
      await db.people.add(person);
      return person;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success('Person added');
    },
    onError: (e: any) => toast.error('Failed to add person: ' + e.message),
  });
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; phone?: string; notes?: string }) => {
      await db.people.update(id, {
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        notes: data.notes?.trim() || null,
        updated_at: nowISO(),
      });
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['person', v.id] });
      toast.success('Person updated');
    },
    onError: (e: any) => toast.error('Failed to update person: ' + e.message),
  });
}

export function useDeletePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await db.people.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      toast.success('Person deleted');
    },
    onError: (e: any) => toast.error('Failed to delete person: ' + e.message),
  });
}

// ===== LOANS HOOKS =====

async function enrichLoan(loan: any): Promise<Loan> {
  const person = loan.person_id ? await db.people.get(loan.person_id) : undefined;
  const accountRow = loan.account_id ? await db.accounts.get(loan.account_id) : undefined;
  const payments = await db.payments.where('loan_id').equals(loan.id).toArray();
  return {
    ...loan,
    created_at: toDate(loan.created_at),
    updated_at: toDate(loan.updated_at),
    due_date: loan.due_date ? new Date(loan.due_date) : null,
    person: person ? { ...person, created_at: toDate(person.created_at), updated_at: toDate(person.updated_at) } : undefined,
    account: accountRow ? { ...accountRow, created_at: toDate(accountRow.created_at), updated_at: toDate(accountRow.updated_at) } as Account : undefined,
    payments: payments.map(p => ({
      ...p,
      payment_date: toDate(p.payment_date),
      created_at: toDate(p.created_at),
    })),
  };
}

export function useLoans() {
  return useQuery({
    queryKey: ['loans'],
    queryFn: async () => {
      const loans = await db.loans.orderBy('created_at').reverse().toArray();
      return Promise.all(loans.map(enrichLoan));
    },
  });
}

export function useLoansByPerson(personId: string | undefined) {
  return useQuery({
    queryKey: ['loans', 'person', personId],
    queryFn: async () => {
      if (!personId) return [];
      const loans = await db.loans.where('person_id').equals(personId).reverse().sortBy('created_at');
      return Promise.all(loans.map(enrichLoan));
    },
    enabled: !!personId,
  });
}

export function useLoan(id: string | undefined) {
  return useQuery({
    queryKey: ['loan', id],
    queryFn: async () => {
      if (!id) return null;
      const loan = await db.loans.get(id);
      if (!loan) return null;
      return enrichLoan(loan);
    },
    enabled: !!id,
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      person_id: string;
      amount: number;
      type: LoanType;
      account_id?: string;
      due_date?: string;
      notes?: string;
    }) => {
      const now = nowISO();
      const loan = {
        id: generateId(),
        person_id: data.person_id,
        amount: data.amount,
        type: data.type,
        status: 'OPEN' as LoanStatus,
        account_id: data.account_id || null,
        due_date: data.due_date || null,
        notes: data.notes?.trim() || null,
        created_at: now,
        updated_at: now,
      };
      await db.loans.add(loan);
      return loan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      toast.success('Loan added');
    },
    onError: (e: any) => toast.error('Failed to add loan: ' + e.message),
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      amount?: number;
      due_date?: string | null;
      notes?: string | null;
    }) => {
      const updates: any = { updated_at: nowISO() };
      if (data.amount !== undefined) updates.amount = data.amount;
      if (data.due_date !== undefined) updates.due_date = data.due_date || null;
      if (data.notes !== undefined) updates.notes = data.notes?.trim() || null;
      await db.loans.update(id, updates);
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan', v.id] });
      toast.success('Loan updated');
    },
    onError: (e: any) => toast.error('Failed to update loan: ' + e.message),
  });
}

export function useDeleteLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await db.loans.delete(id);
      await db.payments.where('loan_id').equals(id).delete();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      toast.success('Loan deleted');
    },
    onError: (e: any) => toast.error('Failed to delete loan: ' + e.message),
  });
}

// ===== PAYMENTS HOOKS =====

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      loan_id: string;
      amount: number;
      payment_date?: string;
      notes?: string;
    }) => {
      const now = nowISO();
      const payment = {
        id: generateId(),
        loan_id: data.loan_id,
        amount: data.amount,
        payment_date: data.payment_date || now,
        notes: data.notes?.trim() || null,
        created_at: now,
      };
      await db.payments.add(payment);

      // Update loan status
      const allPayments = await db.payments.where('loan_id').equals(data.loan_id).toArray();
      const loan = await db.loans.get(data.loan_id);
      if (loan) {
        const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount), 0);
        let status: LoanStatus = 'OPEN';
        if (totalPaid >= Number(loan.amount)) status = 'PAID';
        else if (totalPaid > 0) status = 'PARTIAL';
        await db.loans.update(data.loan_id, { status, updated_at: now });
      }

      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan'] });
      toast.success('Payment recorded');
    },
    onError: (e: any) => toast.error('Failed to record payment: ' + e.message),
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const payment = await db.payments.get(id);
      await db.payments.delete(id);

      // Recalculate loan status
      if (payment) {
        const now = nowISO();
        const remaining = await db.payments.where('loan_id').equals(payment.loan_id).toArray();
        const loan = await db.loans.get(payment.loan_id);
        if (loan) {
          const totalPaid = remaining.reduce((s, p) => s + Number(p.amount), 0);
          let status: LoanStatus = 'OPEN';
          if (totalPaid >= Number(loan.amount)) status = 'PAID';
          else if (totalPaid > 0) status = 'PARTIAL';
          await db.loans.update(payment.loan_id, { status, updated_at: now });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan'] });
      toast.success('Payment deleted');
    },
    onError: (e: any) => toast.error('Failed to delete payment: ' + e.message),
  });
}

/** Delete all payments for a loan → resets status to OPEN */
export function useResetLoanPayments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (loanId: string) => {
      const now = nowISO();
      await db.payments.where('loan_id').equals(loanId).delete();
      await db.loans.update(loanId, { status: 'OPEN', updated_at: now });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan'] });
      toast.success('Loan marked as unpaid');
    },
    onError: (e: any) => toast.error('Failed to update loan: ' + e.message),
  });
}

/** Delete the most recent payment for a loan → may revert PAID → PARTIAL/OPEN */
export function useDeleteLastPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (loanId: string) => {
      const now = nowISO();
      const payments = await db.payments.where('loan_id').equals(loanId).sortBy('created_at');
      if (!payments.length) return;
      const last = payments[payments.length - 1];
      await db.payments.delete(last.id);

      const remaining = await db.payments.where('loan_id').equals(loanId).toArray();
      const loan = await db.loans.get(loanId);
      if (loan) {
        const totalPaid = remaining.reduce((s, p) => s + Number(p.amount), 0);
        let status: LoanStatus = 'OPEN';
        if (totalPaid >= Number(loan.amount)) status = 'PAID';
        else if (totalPaid > 0) status = 'PARTIAL';
        await db.loans.update(loanId, { status, updated_at: now });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan'] });
      toast.success('Last payment removed');
    },
    onError: (e: any) => toast.error('Failed to update loan: ' + e.message),
  });
}

// ===== COMPUTED VALUES =====

export function calculateBalance(loan: Loan): number {
  const totalPaid = loan.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  return Number(loan.amount) - totalPaid;
}

export function calculateTotals(loans: Loan[]) {
  const openLoans = loans.filter(l => l.status !== 'PAID' && Number(l.amount) > 0);
  const toReceive = openLoans.filter(l => l.type === 'GIVEN').reduce((sum, l) => sum + calculateBalance(l), 0);
  const toPay = openLoans.filter(l => l.type === 'TAKEN').reduce((sum, l) => sum + calculateBalance(l), 0);
  return { toReceive, toPay };
}
