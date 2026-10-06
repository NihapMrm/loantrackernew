import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useSettings } from '@/hooks/useSettings';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { usePeople, useCreateLoan, useUpdateLoan, useLoan, LoanType } from '@/hooks/useLoans';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Wallet, PiggyBank, Landmark, CreditCard, Banknote, Building2 } from 'lucide-react';
import { z } from 'zod';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/lib/formatting';
import { roundMoney } from '@/lib/db';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'wallet': Wallet,
  'piggy-bank': PiggyBank,
  'landmark': Landmark,
  'credit-card': CreditCard,
  'banknote': Banknote,
  'building-2': Building2,
};

const loanSchema = z.object({
  person_id: z.string().min(1, 'Please select a person'),
  amount: z.number().positive('Amount must be greater than 0'),
  type: z.enum(['GIVEN', 'TAKEN']),
  account_id: z.string().optional(),
  due_date: z.string().optional(),
  notes: z.string().trim().max(500, 'Notes are too long').optional(),
});

export default function AddLoan() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: people, isLoading: loadingPeople } = usePeople();
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: existingLoan, isLoading: loadingLoan } = useLoan(id);
  const createLoan = useCreateLoan();
  const updateLoan = useUpdateLoan();
  const { settings } = useSettings();

  const [personId, setPersonId] = useState(searchParams.get('person') || '');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<LoanType>('GIVEN');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize form with existing data for edit
  useEffect(() => {
    if (isEdit && existingLoan && !initialized) {
      setPersonId(existingLoan.person_id);
      setAccountId(existingLoan.account_id || '');
      setAmount(String(existingLoan.amount));
      setType(existingLoan.type);
      setDueDate(existingLoan.due_date ? format(existingLoan.due_date, 'yyyy-MM-dd') : '');
      setNotes(existingLoan.notes || '');
      setInitialized(true);
    }
  }, [isEdit, existingLoan, initialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const data = {
        person_id: personId,
        amount: roundMoney(parseFloat(amount)),
        type,
        account_id: accountId || undefined,
        due_date: dueDate || undefined,
        notes: notes || undefined,
      };
      
      loanSchema.parse(data);

      // An edit can't take the amount below what's already been repaid
      const totalPaid = existingLoan?.payments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
      if (isEdit && data.amount < totalPaid) {
        setErrors({ amount: `Amount can't be less than the ${formatAmount(totalPaid)} already paid` });
        return;
      }
      setErrors({});

      if (isEdit && id) {
        await updateLoan.mutateAsync({ 
          id, 
          amount: data.amount,
          account_id: accountId || null,
          due_date: data.due_date || null,
          notes: data.notes || null,
        });
      } else {
        await createLoan.mutateAsync(data);
      }
      
      navigate(-1);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          const field = e.path[0] as string;
          fieldErrors[field] = e.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  const isPending = createLoan.isPending || updateLoan.isPending;
  const isLoading = loadingPeople || loadingAccounts || (isEdit && loadingLoan);

  if (isLoading) {
    return (
      <MobileLayout showNav={false}>
        <div className="px-4 pt-6 text-center text-muted-foreground">Loading...</div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <div className="px-4 pt-4 pb-4 max-w-2xl mx-auto lg:px-8 lg:pt-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 rounded-full bg-primary" />
            <span className="text-sm font-black tracking-tight text-foreground uppercase">
              {isEdit ? 'Edit Loan' : 'Add Loan'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
          {/* Loan Type Selection */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <button
                type="button"
                onClick={() => setType('GIVEN')}
                className={cn(
                  'p-4 lg:p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                  type === 'GIVEN'
                    ? 'border-loan-given bg-loan-given-light'
                    : 'border-border bg-card hover:border-loan-given/50'
                )}
              >
                <div className={cn(
                  'w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center',
                  type === 'GIVEN' ? 'bg-loan-given' : 'bg-secondary'
                )}>
                  <ArrowUpRight className={cn(
                    'w-5 h-5 lg:w-6 lg:h-6',
                    type === 'GIVEN' ? 'text-white' : 'text-muted-foreground'
                  )} />
                </div>
                <div className="text-center">
                  <p className={cn(
                    'font-medium lg:text-lg',
                    type === 'GIVEN' ? 'text-loan-given' : 'text-foreground'
                  )}>Money Given</p>
                  <p className="text-xs lg:text-sm text-muted-foreground">You lent money</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('TAKEN')}
                className={cn(
                  'p-4 lg:p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                  type === 'TAKEN'
                    ? 'border-loan-taken bg-loan-taken-light'
                    : 'border-border bg-card hover:border-loan-taken/50'
                )}
              >
                <div className={cn(
                  'w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center',
                  type === 'TAKEN' ? 'bg-loan-taken' : 'bg-secondary'
                )}>
                  <ArrowDownLeft className={cn(
                    'w-5 h-5 lg:w-6 lg:h-6',
                    type === 'TAKEN' ? 'text-white' : 'text-muted-foreground'
                  )} />
                </div>
                <div className="text-center">
                  <p className={cn(
                    'font-medium lg:text-lg',
                    type === 'TAKEN' ? 'text-loan-taken' : 'text-foreground'
                  )}>Money Taken</p>
                  <p className="text-xs lg:text-sm text-muted-foreground">You borrowed money</p>
                </div>
              </button>
            </div>
          )}

          <Card className="shadow-card">
            <CardContent className="p-4 space-y-4 lg:p-6">
              {/* Person Selection */}
              {!isEdit && (
                <div className="space-y-2">
                  <Label htmlFor="person">Person *</Label>
                  <Select value={personId} onValueChange={setPersonId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a person" />
                    </SelectTrigger>
                    <SelectContent>
                      {people?.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.person_id && <p className="text-sm text-destructive">{errors.person_id}</p>}
                  {people?.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No people yet.{' '}
                      <button
                        type="button"
                        onClick={() => navigate('/add-person')}
                        className="text-primary underline"
                      >
                        Add one first
                      </button>
                    </p>
                  )}
                </div>
              )}

              {/* Account Selection */}
              <div className="space-y-2">
                <Label htmlFor="account">Account (optional)</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account">
                      {accountId && accounts?.find(a => a.id === accountId) && (
                        <div className="flex items-center gap-2">
                          {(() => {
                            const account = accounts?.find(a => a.id === accountId);
                            const IconComponent = account ? (iconMap[account.icon] || Wallet) : Wallet;
                            return <IconComponent className="w-4 h-4" />;
                          })()}
                          <span>{accounts?.find(a => a.id === accountId)?.name}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((account) => {
                      const IconComponent = iconMap[account.icon] || Wallet;
                      return (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="w-4 h-4" />
                            <span>{account.name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {accounts?.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No accounts yet.{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/add-account')}
                      className="text-primary underline"
                    >
                      Create one
                    </button>
                  </p>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{settings.currencySymbol}</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date (optional)</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
                {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 lg:justify-end">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1 lg:flex-none lg:w-32"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1 lg:flex-none lg:w-32" 
              disabled={isPending || (!isEdit && people?.length === 0)}
            >
              {isPending ? 'Saving...' : isEdit ? 'Update' : 'Add Loan'}
            </Button>
          </div>
        </form>
      </div>
    </MobileLayout>
  );
}
