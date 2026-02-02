import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useLoans, calculateTotals, calculateBalance, Loan, useCreatePayment } from '@/hooks/useLoans';
import { AmountDisplay, StatusBadge, LoanTypeBadge } from '@/components/ui/amount-display';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { data: loans, isLoading } = useLoans();
  const createPayment = useCreatePayment();
  const totals = loans ? calculateTotals(loans) : { toReceive: 0, toPay: 0 };
  
  // Filter to show only open/partial loans
  const activeLoans = loans?.filter(l => l.status !== 'PAID') || [];

  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [paymentType, setPaymentType] = useState<'full' | 'partial' | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoanClick = (loan: Loan) => {
    setSelectedLoan(loan);
    setPaymentType(null);
    setPartialAmount('');
  };

  const handlePaymentTypeSelect = (type: 'full' | 'partial') => {
    setPaymentType(type);
    if (type === 'full' && selectedLoan) {
      setPartialAmount(calculateBalance(selectedLoan).toString());
    } else {
      setPartialAmount('');
    }
  };

  const handleSubmitPayment = async () => {
    if (!selectedLoan) return;
    
    const balance = calculateBalance(selectedLoan);
    const amount = paymentType === 'full' ? balance : parseFloat(partialAmount);
    
    if (isNaN(amount) || amount <= 0 || amount > balance) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createPayment.mutateAsync({
        loan_id: selectedLoan.id,
        amount,
        payment_date: new Date().toISOString().split('T')[0],
      });
      setSelectedLoan(null);
      setPaymentType(null);
      setPartialAmount('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBalance = selectedLoan ? calculateBalance(selectedLoan) : 0;

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">LoanTracker</h1>
            <p className="text-sm text-muted-foreground">Your loan overview</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-loan-given-light border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-loan-given/10 rounded-lg flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 text-loan-given" />
                </div>
                <span className="text-xs font-medium text-loan-given-foreground">To Receive</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <AmountDisplay amount={totals.toReceive} size="lg" className="text-loan-given" />
              )}
            </CardContent>
          </Card>

          <Card className="bg-loan-taken-light border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-loan-taken/10 rounded-lg flex items-center justify-center">
                  <ArrowDownLeft className="w-4 h-4 text-loan-taken" />
                </div>
                <span className="text-xs font-medium text-loan-taken-foreground">To Pay</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <AmountDisplay amount={totals.toPay} size="lg" className="text-loan-taken" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* All Active Loans */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Active Loans</h2>
            <span className="text-sm text-muted-foreground">
              {activeLoans.length} {activeLoans.length === 1 ? 'loan' : 'loans'}
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : activeLoans.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground mb-2">No active loans</p>
                <Link to="/add-loan" className="text-primary font-medium text-sm">
                  Add your first loan →
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeLoans.map((loan) => (
                <LoanCard key={loan.id} loan={loan} onClick={() => handleLoanClick(loan)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={!!selectedLoan} onOpenChange={(open) => !open && setSelectedLoan(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {selectedLoan && (
                <>
                  <span className="font-medium text-foreground">{selectedLoan.person?.name}</span>
                  {' '}{selectedLoan.type === 'GIVEN' ? 'owes you' : 'you owe'}{' '}
                  <AmountDisplay amount={selectedBalance} size="sm" type={selectedLoan.type} />
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {!paymentType ? (
            <div className="grid grid-cols-2 gap-3 py-4">
              <Button
                variant="outline"
                className="h-24 flex flex-col gap-2"
                onClick={() => handlePaymentTypeSelect('partial')}
              >
                <span className="text-2xl">📝</span>
                <span>Partial Payment</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex flex-col gap-2"
                onClick={() => handlePaymentTypeSelect('full')}
              >
                <span className="text-2xl">✅</span>
                <span>Full Payment</span>
              </Button>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {paymentType === 'partial' && (
                <div className="space-y-2">
                  <Label htmlFor="amount">Payment Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rs</span>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      className="pl-10"
                      min={0}
                      max={selectedBalance}
                      step="0.01"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximum: <AmountDisplay amount={selectedBalance} size="sm" />
                  </p>
                </div>
              )}

              {paymentType === 'full' && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-2">Recording full payment of</p>
                  <AmountDisplay amount={selectedBalance} size="xl" type={selectedLoan?.type} />
                </div>
              )}

              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setPaymentType(null)}
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmitPayment}
                  disabled={
                    isSubmitting || 
                    (paymentType === 'partial' && (
                      !partialAmount || 
                      parseFloat(partialAmount) <= 0 || 
                      parseFloat(partialAmount) > selectedBalance
                    ))
                  }
                >
                  {isSubmitting ? 'Updating...' : 'Update'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}

function LoanCard({ loan, onClick }: { loan: Loan; onClick: () => void }) {
  const balance = calculateBalance(loan);
  
  return (
    <Card 
      className="shadow-card hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-foreground truncate">
                {loan.person?.name || 'Unknown'}
              </span>
              <LoanTypeBadge type={loan.type} />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{format(new Date(loan.created_at), 'MMM d, yyyy')}</span>
              <StatusBadge status={loan.status} />
            </div>
          </div>
          <div className="text-right">
            <AmountDisplay 
              amount={balance} 
              type={loan.type} 
              size="md"
            />
            {loan.status !== 'OPEN' && (
              <p className="text-xs text-muted-foreground">
                of <AmountDisplay amount={Number(loan.amount)} size="sm" />
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
