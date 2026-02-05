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

export type LoanType = 'GIVEN' | 'TAKEN';
export type LoanStatus = 'OPEN' | 'PARTIAL' | 'PAID';

export interface Person {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Loan {
  id: string;
  user_id: string;
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

// ===== PEOPLE HOOKS =====

export function usePeople() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['people', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      
      const q = query(
        collection(db, 'people'),
        where('user_id', '==', user.uid),
        orderBy('name')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: timestampToDate(doc.data().created_at),
        updated_at: timestampToDate(doc.data().updated_at),
      })) as Person[];
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
      
      const docRef = doc(db, 'people', id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return null;
      
      return {
        id: docSnap.id,
        ...docSnap.data(),
        created_at: timestampToDate(docSnap.data().created_at),
        updated_at: timestampToDate(docSnap.data().updated_at),
      } as Person;
    },
    enabled: !!user && !!id,
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  
  return useMutation({
    mutationFn: async (data: { name: string; phone?: string; notes?: string }) => {
      if (!user) throw new Error('Not authenticated');
      
      // If offline, skip Firebase call (optimistic update handles UI)
      if (!isOnline) {
        return { id: generateTempId(), ...data };
      }
      
      const docRef = await addDoc(collection(db, 'people'), {
        user_id: user.uid,
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        notes: data.notes?.trim() || null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      
      return { id: docRef.id, ...data };
    },
    onMutate: async (newPerson) => {
      if (!user) return;
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['people', user.uid] });
      
      // Snapshot previous value
      const previousPeople = queryClient.getQueryData(['people', user.uid]);
      
      // Generate temp ID
      const tempId = generateTempId();
      
      // Optimistically update
      queryClient.setQueryData(['people', user.uid], (old: any) => {
        const newEntry = {
          id: tempId,
          user_id: user.uid,
          name: newPerson.name.trim(),
          phone: newPerson.phone?.trim() || null,
          notes: newPerson.notes?.trim() || null,
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
          collection: 'people',
          data: {
            user_id: user.uid,
            name: newPerson.name.trim(),
            phone: newPerson.phone?.trim() || null,
            notes: newPerson.notes?.trim() || null,
          },
          tempId,
        });
        toast.info('Person will be saved when online');
      }
      
      return { previousPeople, tempId };
    },
    onError: (error, _, context) => {
      if (context?.previousPeople && user) {
        queryClient.setQueryData(['people', user.uid], context.previousPeople);
      }
      if (isOnline) {
        toast.error('Failed to add person: ' + error.message);
      }
    },
    onSuccess: () => {
      if (isOnline) {
        toast.success('Person added');
      }
    },
    onSettled: (_, __, ___, context) => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['people', user.uid] });
      }
    },
  });
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; phone?: string; notes?: string }) => {
      // If offline, skip Firebase call
      if (!isOnline) {
        return { id, ...data };
      }
      
      const docRef = doc(db, 'people', id);
      await updateDoc(docRef, {
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        notes: data.notes?.trim() || null,
        updated_at: serverTimestamp(),
      });
    },
    onMutate: async (updatedPerson) => {
      if (!user) return;
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['people', user.uid] });
      await queryClient.cancelQueries({ queryKey: ['person', updatedPerson.id] });
      
      // Snapshot previous values
      const previousPeople = queryClient.getQueryData(['people', user.uid]);
      const previousPerson = queryClient.getQueryData(['person', updatedPerson.id]);
      
      // Optimistically update people list
      queryClient.setQueryData(['people', user.uid], (old: any) => {
        if (!old) return old;
        return old.map((person: Person) =>
          person.id === updatedPerson.id
            ? { ...person, ...updatedPerson, updated_at: new Date(), _pendingSync: true }
            : person
        );
      });
      
      // Optimistically update single person
      queryClient.setQueryData(['person', updatedPerson.id], (old: any) => {
        if (!old) return old;
        return { ...old, ...updatedPerson, updated_at: new Date(), _pendingSync: true };
      });
      
      // Queue if offline
      if (!isOnline) {
        await offlineQueue.addToQueue({
          type: 'update',
          collection: 'people',
          data: {
            id: updatedPerson.id,
            name: updatedPerson.name.trim(),
            phone: updatedPerson.phone?.trim() || null,
            notes: updatedPerson.notes?.trim() || null,
            updated_at: new Date(),
          },
        });
        toast.info('Changes will sync when online');
      }
      
      return { previousPeople, previousPerson };
    },
    onError: (error, variables, context) => {
      if (user && context) {
        if (context.previousPeople) {
          queryClient.setQueryData(['people', user.uid], context.previousPeople);
        }
        if (context.previousPerson) {
          queryClient.setQueryData(['person', variables.id], context.previousPerson);
        }
      }
      if (isOnline) {
        toast.error('Failed to update person: ' + error.message);
      }
    },
    onSuccess: (_, variables) => {
      if (isOnline) {
        toast.success('Person updated');
      }
    },
    onSettled: (_, __, variables) => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['people', user.uid] });
        queryClient.invalidateQueries({ queryKey: ['person', variables.id] });
      }
    },
  });
}

export function useDeletePerson() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      
      // First, find and delete all loans related to this person
      const loansQuery = query(
        collection(db, 'loans'),
        where('user_id', '==', user.uid),
        where('person_id', '==', id)
      );
      
      const loansSnapshot = await getDocs(loansQuery);
      
      // Delete all related loans and their payments
      await Promise.all(
        loansSnapshot.docs.map(async (loanDoc) => {
          // Delete payments for this loan
          const paymentsQuery = query(
            collection(db, 'payments'),
            where('loan_id', '==', loanDoc.id)
          );
          const paymentsSnapshot = await getDocs(paymentsQuery);
          await Promise.all(
            paymentsSnapshot.docs.map(paymentDoc => deleteDoc(paymentDoc.ref))
          );
          
          // Delete the loan
          await deleteDoc(loanDoc.ref);
        })
      );
      
      // Finally, delete the person
      await deleteDoc(doc(db, 'people', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      toast.success('Person and related loans deleted');
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
    queryKey: ['loans', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      
      try {
        const q = query(
          collection(db, 'loans'),
          where('user_id', '==', user.uid),
          orderBy('created_at', 'desc')
        );
        
        const snapshot = await getDocs(q);
        
        // Extract unique person IDs
        const personIds = [...new Set(
          snapshot.docs
            .map(doc => doc.data().person_id)
            .filter(Boolean)
        )] as string[];
      
        // Batch fetch all people with error handling for each
        const peopleMap = new Map<string, Person>();
        if (personIds.length > 0) {
          const peoplePromises = personIds.map(async (id) => {
            try {
              const personDoc = await getDoc(doc(db, 'people', id));
              if (personDoc.exists()) {
                return {
                  id: personDoc.id,
                  data: {
                    id: personDoc.id,
                    ...personDoc.data(),
                    created_at: timestampToDate(personDoc.data().created_at),
                    updated_at: timestampToDate(personDoc.data().updated_at),
                  } as Person
                };
              }
            } catch (error) {
            // Silently skip person documents that can't be fetched
          }
          return null;
        });
        
        const peopleResults = await Promise.all(peoplePromises);
        peopleResults.forEach(result => {
          if (result && result.data) {
            peopleMap.set(result.id, result.data);
          }
        });
      }
      
      // Batch fetch all payments (handling Firestore 'in' query limit of 10)
      const loanIds = snapshot.docs.map(doc => doc.id);
        const paymentsMap = new Map<string, Payment[]>();
        if (loanIds.length > 0) {
          // Split loanIds into chunks of 10 (Firestore 'in' query limit)
          const chunks = [];
          for (let i = 0; i < loanIds.length; i += 10) {
            chunks.push(loanIds.slice(i, i + 10));
          }
          
          // Fetch payments for each chunk
          const paymentsPromises = chunks.map(chunk =>
            getDocs(query(
              collection(db, 'payments'),
              where('loan_id', 'in', chunk)
            ))
          );
          
          const paymentsSnapshots = await Promise.all(paymentsPromises);
          
          // Combine all payment documents
          let totalPayments = 0;
          paymentsSnapshots.forEach(paymentsSnapshot => {
            totalPayments += paymentsSnapshot.docs.length;
            paymentsSnapshot.docs.forEach(paymentDoc => {
              const payment = {
                id: paymentDoc.id,
                ...paymentDoc.data(),
                payment_date: timestampToDate(paymentDoc.data().payment_date),
                created_at: timestampToDate(paymentDoc.data().created_at),
              } as Payment;
              const loanId = paymentDoc.data().loan_id;
              if (!paymentsMap.has(loanId)) {
                paymentsMap.set(loanId, []);
              }
              paymentsMap.get(loanId)!.push(payment);
            });
          });
        }
        
        // Map loans with pre-fetched data
        const loans = snapshot.docs.map(docSnap => {
          const loanData = docSnap.data();
          const loan = {
            id: docSnap.id,
            ...loanData,
            created_at: timestampToDate(loanData.created_at),
            updated_at: timestampToDate(loanData.updated_at),
            due_date: loanData.due_date ? timestampToDate(loanData.due_date) : null,
            person: loanData.person_id ? peopleMap.get(loanData.person_id) : undefined,
            payments: paymentsMap.get(docSnap.id) || [],
          } as Loan;
          return loan;
        });
        
        return loans;
      } catch (error) {
        throw error;
      }
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
      
      const q = query(
        collection(db, 'loans'),
        where('user_id', '==', user.uid),
        where('person_id', '==', personId),
        orderBy('created_at', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const loans = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const loanData = docSnap.data();
          
          // Fetch associated person
          let person = undefined;
          const personDoc = await getDoc(doc(db, 'people', personId));
          if (personDoc.exists()) {
            person = {
              id: personDoc.id,
              ...personDoc.data(),
              created_at: timestampToDate(personDoc.data().created_at),
              updated_at: timestampToDate(personDoc.data().updated_at),
            } as Person;
          }
          
          // Fetch payments
          const paymentsQuery = query(
            collection(db, 'payments'),
            where('loan_id', '==', docSnap.id)
          );
          const paymentsSnapshot = await getDocs(paymentsQuery);
          const payments = paymentsSnapshot.docs.map(paymentDoc => ({
            id: paymentDoc.id,
            ...paymentDoc.data(),
            payment_date: timestampToDate(paymentDoc.data().payment_date),
            created_at: timestampToDate(paymentDoc.data().created_at),
          })) as Payment[];
          
          return {
            id: docSnap.id,
            ...loanData,
            created_at: timestampToDate(loanData.created_at),
            updated_at: timestampToDate(loanData.updated_at),
            due_date: loanData.due_date ? timestampToDate(loanData.due_date) : null,
            person,
            payments,
          } as Loan;
        })
      );
      
      return loans;
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
      
      const docRef = doc(db, 'loans', id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return null;
      
      const loanData = docSnap.data();
      
      // Fetch associated person
      let person = undefined;
      if (loanData.person_id) {
        const personDoc = await getDoc(doc(db, 'people', loanData.person_id));
        if (personDoc.exists()) {
          person = {
            id: personDoc.id,
            ...personDoc.data(),
            created_at: timestampToDate(personDoc.data().created_at),
            updated_at: timestampToDate(personDoc.data().updated_at),
          } as Person;
        }
      }
      
      // Fetch payments
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('loan_id', '==', id)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const payments = paymentsSnapshot.docs.map(paymentDoc => ({
        id: paymentDoc.id,
        ...paymentDoc.data(),
        payment_date: timestampToDate(paymentDoc.data().payment_date),
        created_at: timestampToDate(paymentDoc.data().created_at),
      })) as Payment[];
      
      return {
        id: docSnap.id,
        ...loanData,
        created_at: timestampToDate(loanData.created_at),
        updated_at: timestampToDate(loanData.updated_at),
        due_date: loanData.due_date ? timestampToDate(loanData.due_date) : null,
        person,
        payments,
      } as Loan;
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
      
      const docRef = await addDoc(collection(db, 'loans'), {
        user_id: user.uid,
        person_id: data.person_id,
        amount: data.amount,
        type: data.type,
        status: 'OPEN' as LoanStatus,
        account_id: data.account_id || null,
        due_date: data.due_date ? Timestamp.fromDate(new Date(data.due_date)) : null,
        notes: data.notes?.trim() || null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      
      return { id: docRef.id, ...data };
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
      const docRef = doc(db, 'loans', id);
      const updateData: any = {
        updated_at: serverTimestamp(),
      };
      
      if (data.amount !== undefined) updateData.amount = data.amount;
      if (data.due_date !== undefined) {
        updateData.due_date = data.due_date ? Timestamp.fromDate(new Date(data.due_date)) : null;
      }
      if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
      
      await updateDoc(docRef, updateData);
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
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // If offline, skip Firebase call
      if (!isOnline) {
        return { id };
      }
      
      await deleteDoc(doc(db, 'loans', id));
    },
    onMutate: async (loanId) => {
      if (!user) return;
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['loans', user.uid] });
      
      // Snapshot previous value
      const previousLoans = queryClient.getQueryData(['loans', user.uid]);
      
      // Optimistically remove loan
      queryClient.setQueryData(['loans', user.uid], (old: any) => {
        if (!old) return old;
        return old.filter((loan: Loan) => loan.id !== loanId);
      });
      
      // Queue if offline
      if (!isOnline) {
        await offlineQueue.addToQueue({
          type: 'delete',
          collection: 'loans',
          data: { id: loanId },
        });
        toast.info('Deletion will sync when online');
      }
      
      return { previousLoans };
    },
    onError: (error, _, context) => {
      if (context?.previousLoans && user) {
        queryClient.setQueryData(['loans', user.uid], context.previousLoans);
      }
      if (isOnline) {
        toast.error('Failed to delete loan: ' + error.message);
      }
    },
    onSuccess: () => {
      if (isOnline) {
        toast.success('Loan deleted');
      }
    },
    onSettled: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['loans', user.uid] });
      }
    },
  });
}

// ===== PAYMENTS HOOKS =====

export function useCreatePayment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  
  return useMutation({
    mutationFn: async (data: { 
      loan_id: string; 
      amount: number; 
      payment_date?: string;
      notes?: string;
    }) => {
      // If offline, skip Firebase call
      if (!isOnline) {
        return { id: generateTempId(), ...data };
      }
      
      const docRef = await addDoc(collection(db, 'payments'), {
        loan_id: data.loan_id,
        amount: data.amount,
        payment_date: data.payment_date 
          ? Timestamp.fromDate(new Date(data.payment_date))
          : Timestamp.fromDate(new Date()),
        notes: data.notes?.trim() || null,
        created_at: serverTimestamp(),
      });
      
      return { id: docRef.id, ...data };
    },
    onMutate: async (newPayment) => {
      if (!user) return;
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['loans', user.uid] });
      await queryClient.cancelQueries({ queryKey: ['loan', newPayment.loan_id] });
      
      // Snapshot previous values
      const previousLoans = queryClient.getQueryData(['loans', user.uid]);
      const previousLoan = queryClient.getQueryData(['loan', newPayment.loan_id]);
      
      // Generate temp ID
      const tempId = generateTempId();
      
      // Optimistically update loans list
      queryClient.setQueryData(['loans', user.uid], (old: any) => {
        if (!old) return old;
        return old.map((loan: Loan) => {
          if (loan.id === newPayment.loan_id) {
            const payment = {
              id: tempId,
              loan_id: newPayment.loan_id,
              amount: newPayment.amount,
              payment_date: newPayment.payment_date ? new Date(newPayment.payment_date) : new Date(),
              notes: newPayment.notes?.trim() || null,
              created_at: new Date(),
              _pendingSync: true,
            };
            return {
              ...loan,
              payments: [...(loan.payments || []), payment],
            };
          }
          return loan;
        });
      });
      
      // Optimistically update single loan
      queryClient.setQueryData(['loan', newPayment.loan_id], (old: any) => {
        if (!old) return old;
        const payment = {
          id: tempId,
          loan_id: newPayment.loan_id,
          amount: newPayment.amount,
          payment_date: newPayment.payment_date ? new Date(newPayment.payment_date) : new Date(),
          notes: newPayment.notes?.trim() || null,
          created_at: new Date(),
          _pendingSync: true,
        };
        return {
          ...old,
          payments: [...(old.payments || []), payment],
        };
      });
      
      // Queue if offline
      if (!isOnline) {
        await offlineQueue.addToQueue({
          type: 'create',
          collection: 'payments',
          data: {
            loan_id: newPayment.loan_id,
            amount: newPayment.amount,
            payment_date: newPayment.payment_date || new Date().toISOString(),
            notes: newPayment.notes?.trim() || null,
          },
          tempId,
        });
        toast.info('Payment will be saved when online');
      }
      
      return { previousLoans, previousLoan, tempId };
    },
    onError: (error, variables, context) => {
      if (user && context) {
        if (context.previousLoans) {
          queryClient.setQueryData(['loans', user.uid], context.previousLoans);
        }
        if (context.previousLoan) {
          queryClient.setQueryData(['loan', variables.loan_id], context.previousLoan);
        }
      }
      if (isOnline) {
        toast.error('Failed to record payment: ' + error.message);
      }
    },
    onSuccess: () => {
      if (isOnline) {
        toast.success('Payment recorded');
      }
    },
    onSettled: (_, __, variables) => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['loans', user.uid] });
        queryClient.invalidateQueries({ queryKey: ['loan', variables.loan_id] });
      }
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // If offline, skip Firebase call
      if (!isOnline) {
        return { id };
      }
      
      await deleteDoc(doc(db, 'payments', id));
    },
    onMutate: async (paymentId) => {
      if (!user) return;
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['loans', user.uid] });
      
      // Snapshot previous value
      const previousLoans = queryClient.getQueryData(['loans', user.uid]);
      
      // Optimistically remove payment from all loans
      queryClient.setQueryData(['loans', user.uid], (old: any) => {
        if (!old) return old;
        return old.map((loan: Loan) => ({
          ...loan,
          payments: loan.payments?.filter((payment: Payment) => payment.id !== paymentId) || [],
        }));
      });
      
      // Queue if offline
      if (!isOnline) {
        await offlineQueue.addToQueue({
          type: 'delete',
          collection: 'payments',
          data: { id: paymentId },
        });
        toast.info('Deletion will sync when online');
      }
      
      return { previousLoans };
    },
    onError: (error, _, context) => {
      if (context?.previousLoans && user) {
        queryClient.setQueryData(['loans', user.uid], context.previousLoans);
      }
      if (isOnline) {
        toast.error('Failed to delete payment: ' + error.message);
      }
    },
    onSuccess: () => {
      if (isOnline) {
        toast.success('Payment deleted');
      }
    },
    onSettled: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['loans', user.uid] });
        queryClient.invalidateQueries({ queryKey: ['loan'] });
      }
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
