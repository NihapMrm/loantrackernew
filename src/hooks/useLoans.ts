import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export type LoanType = 'GIVEN' | 'TAKEN';
export type LoanStatus = 'OPEN' | 'PARTIAL' | 'PAID';

export interface Person {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: string;
  user_id: string;
  person_id: string;
  account_id: string | null;
  amount: number;
  type: LoanType;
  status: LoanStatus;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  person?: Person;
  payments?: Payment[];
}

export interface Payment {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

// ===== PEOPLE HOOKS =====

export function usePeople() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['people', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Person[];
    },
    enabled: !!user,
  });
}

export function usePerson(id: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['person', id],
    queryFn: async () => {
      if (!user || !id) return null;
      
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Person | null;
    },
    enabled: !!user && !!id,
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: { name: string; phone?: string; notes?: string }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data: person, error } = await supabase
        .from('people')
        .insert({
          user_id: user.id,
          name: data.name.trim(),
          phone: data.phone?.trim() || null,
          notes: data.notes?.trim() || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return person;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success('Person added');
    },
    onError: (error) => {
      toast.error('Failed to add person: ' + error.message);
    },
  });
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; phone?: string; notes?: string }) => {
      const { error } = await supabase
        .from('people')
        .update({
          name: data.name.trim(),
          phone: data.phone?.trim() || null,
          notes: data.notes?.trim() || null,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['person', variables.id] });
      toast.success('Person updated');
    },
    onError: (error) => {
      toast.error('Failed to update person: ' + error.message);
    },
  });
}

export function useDeletePerson() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('people')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      toast.success('Person deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete person: ' + error.message);
    },
  });
}

// ===== LOANS HOOKS =====

export function useLoans() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['loans', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          person:people(*),
          payments(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Loan[];
    },
    enabled: !!user,
  });
}

export function useLoansByPerson(personId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['loans', 'person', personId],
    queryFn: async () => {
      if (!user || !personId) return [];
      
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          person:people(*),
          payments(*)
        `)
        .eq('person_id', personId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Loan[];
    },
    enabled: !!user && !!personId,
  });
}

export function useLoan(id: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['loan', id],
    queryFn: async () => {
      if (!user || !id) return null;
      
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          person:people(*),
          payments(*)
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Loan | null;
    },
    enabled: !!user && !!id,
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: { 
      person_id: string; 
      amount: number; 
      type: LoanType; 
      account_id?: string;
      due_date?: string; 
      notes?: string 
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data: loan, error } = await supabase
        .from('loans')
        .insert({
          user_id: user.id,
          person_id: data.person_id,
          amount: data.amount,
          type: data.type,
          account_id: data.account_id || null,
          due_date: data.due_date || null,
          notes: data.notes?.trim() || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return loan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      toast.success('Loan added');
    },
    onError: (error) => {
      toast.error('Failed to add loan: ' + error.message);
    },
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
      const { error } = await supabase
        .from('loans')
        .update({
          amount: data.amount,
          due_date: data.due_date,
          notes: data.notes?.trim() || null,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan', variables.id] });
      toast.success('Loan updated');
    },
    onError: (error) => {
      toast.error('Failed to update loan: ' + error.message);
    },
  });
}

export function useDeleteLoan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      toast.success('Loan deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete loan: ' + error.message);
    },
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
      const { data: payment, error } = await supabase
        .from('payments')
        .insert({
          loan_id: data.loan_id,
          amount: data.amount,
          payment_date: data.payment_date || new Date().toISOString().split('T')[0],
          notes: data.notes?.trim() || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan'] });
      toast.success('Payment recorded');
    },
    onError: (error) => {
      toast.error('Failed to record payment: ' + error.message);
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan'] });
      toast.success('Payment deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete payment: ' + error.message);
    },
  });
}

// ===== COMPUTED VALUES =====

export function calculateBalance(loan: Loan): number {
  const totalPaid = loan.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  return Number(loan.amount) - totalPaid;
}

export function calculateTotals(loans: Loan[]) {
  const openLoans = loans.filter(l => l.status !== 'PAID');
  
  const toReceive = openLoans
    .filter(l => l.type === 'GIVEN')
    .reduce((sum, l) => sum + calculateBalance(l), 0);
  
  const toPay = openLoans
    .filter(l => l.type === 'TAKEN')
    .reduce((sum, l) => sum + calculateBalance(l), 0);
  
  return { toReceive, toPay };
}
