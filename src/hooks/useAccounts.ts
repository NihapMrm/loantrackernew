import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { offlineQueue } from '@/lib/offline-queue';
import { useNetworkStatus } from './useNetworkStatus';

// Helper to generate temporary IDs for offline creates
const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export interface Account {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  created_at: Date;
  updated_at: Date;
}

// Helper to convert Firestore Timestamp to Date
const timestampToDate = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  return new Date();
};

export function useAccounts() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['accounts', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      
      const q = query(
        collection(db, 'accounts'),
        where('user_id', '==', user.uid),
        orderBy('name')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: timestampToDate(doc.data().created_at),
        updated_at: timestampToDate(doc.data().updated_at),
      })) as Account[];
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
      
      const docRef = doc(db, 'accounts', id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return null;
      
      return {
        id: docSnap.id,
        ...docSnap.data(),
        created_at: timestampToDate(docSnap.data().created_at),
        updated_at: timestampToDate(docSnap.data().updated_at),
      } as Account;
    },
    enabled: !!user && !!id,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; icon?: string }) => {
      if (!user) throw new Error('Not authenticated');
      
      // If offline, skip Firebase call
      if (!isOnline) {
        return { id: generateTempId(), ...data };
      }
      
      const docRef = await addDoc(collection(db, 'accounts'), {
        user_id: user.uid,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        icon: data.icon || 'wallet',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      
      return { id: docRef.id, ...data };
    },
    onMutate: async (newAccount) => {
      if (!user) return;
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['accounts', user.uid] });
      
      // Snapshot previous value
      const previousAccounts = queryClient.getQueryData(['accounts', user.uid]);
      
      // Generate temp ID
      const tempId = generateTempId();
      
      // Optimistically update
      queryClient.setQueryData(['accounts', user.uid], (old: any) => {
        const newEntry = {
          id: tempId,
          user_id: user.uid,
          name: newAccount.name.trim(),
          description: newAccount.description?.trim() || null,
          icon: newAccount.icon || 'wallet',
          created_at: new Date(),
          updated_at: new Date(),
          _pendingSync: true,
        };
        return old ? [newEntry, ...old] : [newEntry];
      });
      
      // Queue if offline
      if (!isOnline) {
        await offlineQueue.addToQueue({
          type: 'create',
          collection: 'accounts',
          data: {
            user_id: user.uid,
            name: newAccount.name.trim(),
            description: newAccount.description?.trim() || null,
            icon: newAccount.icon || 'wallet',
          },
          tempId,
        });
        toast.info('Account will be saved when online');
      }
      
      return { previousAccounts, tempId };
    },
    onError: (error, _, context) => {
      if (context?.previousAccounts && user) {
        queryClient.setQueryData(['accounts', user.uid], context.previousAccounts);
      }
      if (isOnline) {
        toast.error('Failed to create account: ' + error.message);
      }
    },
    onSuccess: () => {
      if (isOnline) {
        toast.success('Account created');
      }
    },
    onSettled: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['accounts', user.uid] });
      }
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; description?: string; icon?: string }) => {
      // If offline, skip Firebase call
      if (!isOnline) {
        return { id, ...data };
      }
      
      const docRef = doc(db, 'accounts', id);
      await updateDoc(docRef, {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        icon: data.icon || 'wallet',
        updated_at: serverTimestamp(),
      });
    },
    onMutate: async (updatedAccount) => {
      if (!user) return;
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['accounts', user.uid] });
      await queryClient.cancelQueries({ queryKey: ['account', updatedAccount.id] });
      
      // Snapshot previous values
      const previousAccounts = queryClient.getQueryData(['accounts', user.uid]);
      const previousAccount = queryClient.getQueryData(['account', updatedAccount.id]);
      
      // Optimistically update accounts list
      queryClient.setQueryData(['accounts', user.uid], (old: any) => {
        if (!old) return old;
        return old.map((account: Account) =>
          account.id === updatedAccount.id
            ? { ...account, ...updatedAccount, updated_at: new Date(), _pendingSync: true }
            : account
        );
      });
      
      // Optimistically update single account
      queryClient.setQueryData(['account', updatedAccount.id], (old: any) => {
        if (!old) return old;
        return { ...old, ...updatedAccount, updated_at: new Date(), _pendingSync: true };
      });
      
      // Queue if offline
      if (!isOnline) {
        await offlineQueue.addToQueue({
          type: 'update',
          collection: 'accounts',
          data: {
            id: updatedAccount.id,
            name: updatedAccount.name.trim(),
            description: updatedAccount.description?.trim() || null,
            icon: updatedAccount.icon || 'wallet',
            updated_at: new Date(),
          },
        });
        toast.info('Changes will sync when online');
      }
      
      return { previousAccounts, previousAccount };
    },
    onError: (error, variables, context) => {
      if (user && context) {
        if (context.previousAccounts) {
          queryClient.setQueryData(['accounts', user.uid], context.previousAccounts);
        }
        if (context.previousAccount) {
          queryClient.setQueryData(['account', variables.id], context.previousAccount);
        }
      }
      if (isOnline) {
        toast.error('Failed to update account: ' + error.message);
      }
    },
    onSuccess: (_, variables) => {
      if (isOnline) {
        toast.success('Account updated');
      }
    },
    onSettled: (_, __, variables) => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['accounts', user.uid] });
        queryClient.invalidateQueries({ queryKey: ['account', variables.id] });
      }
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // If offline, skip Firebase call
      if (!isOnline) {
        return { id };
      }
      
      // First, update all loans that reference this account
      const loansQuery = query(
        collection(db, 'loans'),
        where('account_id', '==', id)
      );
      
      const loansSnapshot = await getDocs(loansQuery);
      
      // Set account_id to null for all loans using this account
      await Promise.all(
        loansSnapshot.docs.map(loanDoc => 
          updateDoc(loanDoc.ref, { account_id: null })
        )
      );
      
      // Finally, delete the account
      await deleteDoc(doc(db, 'accounts', id));
    },
    onMutate: async (accountId) => {
      if (!user) return;
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['accounts', user.uid] });
      await queryClient.cancelQueries({ queryKey: ['loans', user.uid] });
      
      // Snapshot previous values
      const previousAccounts = queryClient.getQueryData(['accounts', user.uid]);
      const previousLoans = queryClient.getQueryData(['loans', user.uid]);
      
      // Optimistically remove account
      queryClient.setQueryData(['accounts', user.uid], (old: any) => {
        if (!old) return old;
        return old.filter((account: Account) => account.id !== accountId);
      });
      
      // Optimistically nullify account_id in loans
      queryClient.setQueryData(['loans', user.uid], (old: any) => {
        if (!old) return old;
        return old.map((loan: any) =>
          loan.account_id === accountId
            ? { ...loan, account_id: null, _pendingSync: true }
            : loan
        );
      });
      
      // Queue if offline
      if (!isOnline) {
        await offlineQueue.addToQueue({
          type: 'delete',
          collection: 'accounts',
          data: { id: accountId },
        });
        toast.info('Deletion will sync when online');
      }
      
      return { previousAccounts, previousLoans };
    },
    onError: (error, _, context) => {
      if (user && context) {
        if (context.previousAccounts) {
          queryClient.setQueryData(['accounts', user.uid], context.previousAccounts);
        }
        if (context.previousLoans) {
          queryClient.setQueryData(['loans', user.uid], context.previousLoans);
        }
      }
      if (isOnline) {
        toast.error('Failed to delete account: ' + error.message);
      }
    },
    onSuccess: () => {
      if (isOnline) {
        toast.success('Account deleted');
      }
    },
    onSettled: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['accounts', user.uid] });
        queryClient.invalidateQueries({ queryKey: ['loans', user.uid] });
      }
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

