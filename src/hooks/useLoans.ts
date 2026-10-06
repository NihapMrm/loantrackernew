import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db, generateId, nowISO, todayISODate, parseLocalDate, roundMoney, deriveStatus, PaymentRow } from '@/lib/db';
import { unpinLoans, prunePinnedLoans } from '@/hooks/usePinnedLoans';
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

// A missing timestamp becomes an Invalid Date (shown as "—"), never a made-up "now"
const toDate = (s: string | null | undefined): Date => s ? new Date(s) : new Date(NaN);

export { deriveStatus };

/** Re-read a loan's payments and store the matching status. Call inside the write's transaction. */
export async function recalcStatus(loanId: string) {
  const loan = await db.loans.get(loanId);
  if (!loan) return;
  const payments = await db.payments.where('loan_id').equals(loanId).toArray();
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  await db.loans.update(loanId, { status: deriveStatus(loan.amount, totalPaid), updated_at: nowISO() });
}

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
      // Cascade: a person's loans and their payments go with them
      return db.transaction('rw', db.people, db.loans, db.payments, async () => {
        const loanIds = await db.loans.where('person_id').equals(id).primaryKeys();
        await db.payments.where('loan_id').anyOf(loanIds).delete();
        await db.loans.bulkDelete(loanIds);
        await db.people.delete(id);
        return loanIds;
      });
    },
    onSuccess: (loanIds, id) => {
      unpinLoans(loanIds);
      queryClient.removeQueries({ queryKey: ['person', id] });
      loanIds.forEach(loanId => queryClient.removeQueries({ queryKey: ['loan', loanId] }));
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      toast.success('Person deleted');
    },
    onError: (e: any) => toast.error('Failed to delete person: ' + e.message),
  });
}

// ===== LOANS HOOKS =====

type LoanRowLike = { id: string; person_id: string; account_id: string | null; due_date: string | null; created_at: string; updated_at: string };

/** Join loans with their person, account and payments using one bulk read per table */
async function enrichLoans(loans: LoanRowLike[]): Promise<Loan[]> {
  const ids = loans.map(l => l.id);
  const [people, accounts, payments] = await Promise.all([
    db.people.bulkGet([...new Set(loans.map(l => l.person_id))]),
    db.accounts.bulkGet([...new Set(loans.map(l => l.account_id).filter((x): x is string => !!x))]),
    db.payments.where('loan_id').anyOf(ids).toArray(),
  ]);
  const personById = new Map(people.filter(Boolean).map(p => [p!.id, p!]));
  const accountById = new Map(accounts.filter(Boolean).map(a => [a!.id, a!]));
  const paymentsByLoan = new Map<string, Payment[]>();
  for (const p of payments) {
    const list = paymentsByLoan.get(p.loan_id) ?? [];
    list.push({ ...p, payment_date: parseLocalDate(p.payment_date), created_at: toDate(p.created_at) });
    paymentsByLoan.set(p.loan_id, list);
  }
  return loans.map(loan => {
    const person = personById.get(loan.person_id);
    const accountRow = loan.account_id ? accountById.get(loan.account_id) : undefined;
    return {
      ...loan,
      created_at: toDate(loan.created_at),
      updated_at: toDate(loan.updated_at),
      due_date: loan.due_date ? parseLocalDate(loan.due_date) : null,
      person: person ? { ...person, created_at: toDate(person.created_at), updated_at: toDate(person.updated_at) } : undefined,
      account: accountRow ? { ...accountRow, created_at: toDate(accountRow.created_at), updated_at: toDate(accountRow.updated_at) } as Account : undefined,
      payments: paymentsByLoan.get(loan.id) ?? [],
    } as Loan;
  });
}

export function useLoans() {
  return useQuery({
    queryKey: ['loans'],
    queryFn: async () => {
      const loans = await db.loans.orderBy('created_at').reverse().toArray();
      prunePinnedLoans(new Set(loans.map(l => l.id)));
      return enrichLoans(loans);
    },
  });
}

export function useLoansByPerson(personId: string | undefined) {
  return useQuery({
    queryKey: ['loans', 'person', personId],
    queryFn: async () => {
      if (!personId) return [];
      const loans = await db.loans.where('person_id').equals(personId).reverse().sortBy('created_at');
      return enrichLoans(loans);
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
      return (await enrichLoans([loan]))[0];
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
        amount: roundMoney(data.amount),
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
      account_id?: string | null;
      due_date?: string | null;
      notes?: string | null;
    }) => {
      const updates: Record<string, unknown> = { updated_at: nowISO() };
      if (data.amount !== undefined) updates.amount = roundMoney(data.amount);
      if (data.account_id !== undefined) updates.account_id = data.account_id || null;
      if (data.due_date !== undefined) updates.due_date = data.due_date || null;
      if (data.notes !== undefined) updates.notes = data.notes?.trim() || null;
      await db.transaction('rw', db.loans, db.payments, async () => {
        await db.loans.update(id, updates);
        // Amount may have moved past (or below) what's already paid
        if (data.amount !== undefined) await recalcStatus(id);
      });
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
      await db.transaction('rw', db.loans, db.payments, async () => {
        await db.payments.where('loan_id').equals(id).delete();
        await db.loans.delete(id);
      });
    },
    onSuccess: (_, id) => {
      unpinLoans([id]);
      queryClient.removeQueries({ queryKey: ['loan', id] });
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
        amount: roundMoney(data.amount),
        payment_date: data.payment_date || todayISODate(),
        notes: data.notes?.trim() || null,
        created_at: now,
      };
      await db.transaction('rw', db.loans, db.payments, async () => {
        await db.payments.add(payment);
        await recalcStatus(data.loan_id);
      });
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
      await db.transaction('rw', db.loans, db.payments, async () => {
        const payment = await db.payments.get(id);
        await db.payments.delete(id);
        if (payment) await recalcStatus(payment.loan_id);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan'] });
      toast.success('Payment deleted');
    },
    onError: (e: any) => toast.error('Failed to delete payment: ' + e.message),
  });
}

/** Put back payments removed by a swipe action (the toast's Undo) */
async function restorePayments(payments: PaymentRow[]) {
  await db.transaction('rw', db.loans, db.payments, async () => {
    await db.payments.bulkPut(payments);
    for (const loanId of new Set(payments.map(p => p.loan_id))) await recalcStatus(loanId);
  });
}

function useUndoablePaymentRemoval(
  remove: (loanId: string) => Promise<PaymentRow[]>,
  message: string,
) {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['loans'] });
    queryClient.invalidateQueries({ queryKey: ['loan'] });
  };
  return useMutation({
    mutationFn: (loanId: string) => db.transaction('rw', db.loans, db.payments, () => remove(loanId)),
    onSuccess: (removed) => {
      refresh();
      if (!removed.length) return;
      toast.success(message, {
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: () => restorePayments(removed)
            .then(refresh)
            .catch((e: Error) => toast.error('Undo failed: ' + e.message)),
        },
      });
    },
    onError: (e: any) => toast.error('Failed to update loan: ' + e.message),
  });
}

/** Delete all payments for a loan → resets status to OPEN (undoable) */
export function useResetLoanPayments() {
  return useUndoablePaymentRemoval(async (loanId) => {
    const payments = await db.payments.where('loan_id').equals(loanId).toArray();
    await db.payments.bulkDelete(payments.map(p => p.id));
    await recalcStatus(loanId);
    return payments;
  }, 'Loan marked as unpaid');
}

/** Delete the most recent payment for a loan → may revert PAID → PARTIAL/OPEN (undoable) */
export function useDeleteLastPayment() {
  return useUndoablePaymentRemoval(async (loanId) => {
    const payments = await db.payments.where('loan_id').equals(loanId).sortBy('created_at');
    const last = payments.at(-1);
    if (!last) return [];
    await db.payments.delete(last.id);
    await recalcStatus(loanId);
    return [last];
  }, 'Last payment removed');
}

// ===== COMPUTED VALUES =====

export function calculateBalance(loan: Loan): number {
  const totalPaid = loan.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  return roundMoney(Number(loan.amount) - totalPaid);
}

export function calculateTotals(loans: Loan[]) {
  const openLoans = loans.filter(l => l.status !== 'PAID' && Number(l.amount) > 0);
  const toReceive = roundMoney(openLoans.filter(l => l.type === 'GIVEN').reduce((sum, l) => sum + calculateBalance(l), 0));
  const toPay = roundMoney(openLoans.filter(l => l.type === 'TAKEN').reduce((sum, l) => sum + calculateBalance(l), 0));
  return { toReceive, toPay };
}
