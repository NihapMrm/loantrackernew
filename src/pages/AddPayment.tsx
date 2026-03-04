import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useLoan, useCreatePayment, calculateBalance } from '@/hooks/useLoans';
import { AmountDisplay, LoanTypeBadge, MarqueeAmount } from '@/components/ui/amount-display';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, User } from 'lucide-react';
import { z } from 'zod';

export default function AddPayment() {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();

  const { data: loan, isLoading } = useLoan(loanId);
  const createPayment = useCreatePayment();

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const balance = loan ? calculateBalance(loan) : 0;

  const paymentSchema = z.object({
    amount: z
      .number()
      .positive('Amount must be greater than 0')
      .max(balance, `Amount cannot exceed remaining balance of Rs ${balance.toFixed(2)}`),
    payment_date: z.string().min(1, 'Payment date is required'),
    notes: z.string().trim().max(500, 'Notes are too long').optional(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loanId) return;

    try {
      const data = {
        loan_id: loanId,
        amount: parseFloat(amount),
        payment_date: paymentDate,
        notes: notes || undefined,
      };
      
      paymentSchema.parse(data);
      setErrors({});

      await createPayment.mutateAsync(data);
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

  const handlePayFull = () => {
    setAmount(balance.toFixed(2));
  };

  if (isLoading) {
    return (
      <MobileLayout showNav={false}>
        <div className="px-4 pt-6 text-center text-muted-foreground">Loading...</div>
      </MobileLayout>
    );
  }

  if (!loan) {
    return (
      <MobileLayout showNav={false}>
        <div className="px-4 pt-6 text-center">
          <p className="text-muted-foreground">Loan not found</p>
          <Button variant="link" onClick={() => navigate('/')}>
            Back to Dashboard
          </Button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <div className="px-4 pt-4 pb-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 rounded-full bg-primary" />
            <span className="text-sm font-black tracking-tight text-foreground uppercase">Add Payment</span>
          </div>
        </div>

        {/* Loan Info */}
        <div className={`rounded-2xl border p-4 mb-4 ${
          loan.type === 'GIVEN'
            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
            : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-medium">{loan.person?.name}</p>
                <LoanTypeBadge type={loan.type} />
              </div>
            </div>
            <div className="text-right max-w-[140px] min-w-0">
              <p className="text-xs text-muted-foreground">Remaining</p>
              <MarqueeAmount><AmountDisplay amount={balance} type={loan.type} size="lg" /></MarqueeAmount>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="p-4 space-y-4">
              {/* Amount */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="amount">Amount *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handlePayFull}
                    className="text-primary text-xs h-auto py-1"
                  >
                    Pay full balance
                  </Button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rs</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={balance}
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-8"
                    autoFocus
                  />
                </div>
                {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
              </div>

              {/* Payment Date */}
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Payment Date *</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
                {errors.payment_date && <p className="text-sm text-destructive">{errors.payment_date}</p>}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
                {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={createPayment.isPending}>
              {createPayment.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </div>
    </MobileLayout>
  );
}
