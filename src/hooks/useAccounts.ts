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
  
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; icon?: string }) => {
      if (!user) throw new Error('Not authenticated');
      
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
      const docRef = doc(db, 'accounts', id);
      await updateDoc(docRef, {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        icon: data.icon || 'wallet',
        updated_at: serverTimestamp(),
      });
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
      await deleteDoc(doc(db, 'accounts', id));
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

