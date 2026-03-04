import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db, generateId, nowISO } from '@/lib/db';
import { toast } from 'sonner';

export interface Account {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  created_at: Date;
  updated_at: Date;
}

const toDate = (s: string): Date => new Date(s);

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const rows = await db.accounts.orderBy('name').toArray();
      return rows.map(r => ({
        ...r,
        created_at: toDate(r.created_at),
        updated_at: toDate(r.updated_at),
      })) as Account[];
    },
  });
}

export function useAccount(id: string | undefined) {
  return useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      if (!id) return null;
      const r = await db.accounts.get(id);
      if (!r) return null;
      return { ...r, created_at: toDate(r.created_at), updated_at: toDate(r.updated_at) } as Account;
    },
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; icon?: string }) => {
      const now = nowISO();
      const account = {
        id: generateId(),
        name: data.name.trim(),
        description: data.description?.trim() || null,
        icon: data.icon || 'wallet',
        created_at: now,
        updated_at: now,
      };
      await db.accounts.add(account);
      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account created');
    },
    onError: (e: any) => toast.error('Failed to create account: ' + e.message),
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; description?: string; icon?: string }) => {
      await db.accounts.update(id, {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        icon: data.icon || 'wallet',
        updated_at: nowISO(),
      });
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account', v.id] });
      toast.success('Account updated');
    },
    onError: (e: any) => toast.error('Failed to update account: ' + e.message),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await db.accounts.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      toast.success('Account deleted');
    },
    onError: (e: any) => toast.error('Failed to delete account: ' + e.message),
  });
}

export const ACCOUNT_ICONS = [
  { value: 'wallet', label: 'Wallet' },
  { value: 'piggy-bank', label: 'Savings' },
  { value: 'landmark', label: 'Bank' },
  { value: 'credit-card', label: 'Card' },
  { value: 'banknote', label: 'Cash' },
  { value: 'building-2', label: 'Business' },
] as const;
