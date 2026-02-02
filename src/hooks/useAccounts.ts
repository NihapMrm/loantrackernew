import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  created_at: string;
  updated_at: string;
}

export function useAccounts() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });
}

export function useAccount(id: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      if (!user || !id) return null;
      
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Account | null;
    },
    enabled: !!user && !!id,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; icon?: string }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data: account, error } = await supabase
        .from('accounts')
        .insert({
          user_id: user.id,
          name: data.name.trim(),
          description: data.description?.trim() || null,
          icon: data.icon || 'wallet',
        })
        .select()
        .single();
      
      if (error) throw error;
      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account created');
    },
    onError: (error) => {
      toast.error('Failed to create account: ' + error.message);
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; description?: string; icon?: string }) => {
      const { error } = await supabase
        .from('accounts')
        .update({
          name: data.name.trim(),
          description: data.description?.trim() || null,
          icon: data.icon || 'wallet',
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account', variables.id] });
      toast.success('Account updated');
    },
    onError: (error) => {
      toast.error('Failed to update account: ' + error.message);
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      toast.success('Account deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete account: ' + error.message);
    },
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
