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
  
  return useMutation({
    mutationFn: async (data: { name: string; phone?: string; notes?: string }) => {
      if (!user) throw new Error('Not authenticated');
      
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
      const docRef = doc(db, 'people', id);
      await updateDoc(docRef, {
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        notes: data.notes?.trim() || null,
        updated_at: serverTimestamp(),
      });
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
      await deleteDoc(doc(db, 'people', id));
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
    queryKey: ['loans', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      
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
      
      // Batch fetch all people
      const peopleMap = new Map<string, Person>();
      if (personIds.length > 0) {
        const peoplePromises = personIds.map(id => getDoc(doc(db, 'people', id)));
        const peopleSnaps = await Promise.all(peoplePromises);
        peopleSnaps.forEach(snap => {
          if (snap.exists()) {
            peopleMap.set(snap.id, {
              id: snap.id,
              ...snap.data(),
              created_at: timestampToDate(snap.data().created_at),
              updated_at: timestampToDate(snap.data().updated_at),
            } as Person);
          }
        });
      }
      
      // Batch fetch all payments
      const loanIds = snapshot.docs.map(doc => doc.id);
      const paymentsMap = new Map<string, Payment[]>();
      if (loanIds.length > 0) {
        const paymentsQuery = query(
          collection(db, 'payments'),
          where('loan_id', 'in', loanIds.slice(0, 10)) // Firestore 'in' query limit is 10
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
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
      }
      
      // Map loans with pre-fetched data
      const loans = snapshot.docs.map(docSnap => {
        const loanData = docSnap.data();
        return {
          id: docSnap.id,
          ...loanData,
          created_at: timestampToDate(loanData.created_at),
          updated_at: timestampToDate(loanData.updated_at),
          due_date: loanData.due_date ? timestampToDate(loanData.due_date) : null,
          person: loanData.person_id ? peopleMap.get(loanData.person_id) : undefined,
          payments: paymentsMap.get(docSnap.id) || [],
        } as Loan;
      });
      
      return loans;
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
  
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'loans', id));
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
      await deleteDoc(doc(db, 'payments', id));
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
