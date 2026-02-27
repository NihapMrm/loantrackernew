import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useLoans, calculateTotals, calculateBalance, Loan, useCreatePayment, useResetLoanPayments, useDeleteLastPayment } from '@/hooks/useLoans';
import { AmountDisplay, StatusBadge, LoanTypeBadge } from '@/components/ui/amount-display';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SwipeableLoanCard, useSwipeOpen } from '@/components/SwipeableLoanCard';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import confetti from 'canvas-confetti';

export default function Dashboard() {
  const { data: loans, isLoading } = useLoans();
  const createPayment = useCreatePayment();
  const resetLoan = useResetLoanPayments();
  const deleteLastPayment = useDeleteLastPayment();
  const navigate = useNavigate();
  const totals = loans ? calculateTotals(loans) : { toReceive: 0, toPay: 0 };
  
  // Separate loans by type (only active loans with a non-zero amount)
  const loansToReceive = loans?.filter(l => l.type === 'GIVEN' && l.status !== 'PAID' && Number(l.amount) > 0) || [];
  const loansToPay = loans?.filter(l => l.type === 'TAKEN' && l.status !== 'PAID' && Number(l.amount) > 0) || [];

  const handleQuickAddPayment = (loan: Loan) => {
    navigate(`/add-payment/${loan.id}`);
  };

  const handleQuickMarkPaid = async (loan: Loan) => {
    if (!loan.id) return;
    const totalPaid = (loan.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = loan.amount - totalPaid;
    if (remainingAmount <= 0) return;

    await createPayment.mutateAsync({
      loan_id: loan.id,
      amount: remainingAmount,
      payment_date: new Date().toISOString().split('T')[0],
      notes: 'Marked as paid',
    });

    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#6ee7b7'],
    });
  };

  const calculateProgress = (loan: Loan) => {
    const totalPaid = (loan.payments || []).reduce((sum, p) => sum + p.amount, 0);
    return (totalPaid / loan.amount) * 100;
  };

  const handleQuickMarkUnpaid = async (loan: Loan) => {
    if (!loan.id) return;
    await resetLoan.mutateAsync(loan.id);
  };

  const handleQuickMarkPartial = async (loan: Loan) => {
    if (!loan.id) return;
    await deleteLastPayment.mutateAsync(loan.id);
  };

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4 space-y-6 max-w-6xl mx-auto lg:px-8 lg:pt-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-primary rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 lg:w-6 lg:h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">LoanTracker</h1>
            <p className="text-sm lg:text-base text-muted-foreground">Your loan overview</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <Card className="bg-loan-given-light border-0 shadow-sm lg:col-span-2">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-loan-given/10 rounded-lg flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 lg:w-5 lg:h-5 text-loan-given" />
                </div>
                <span className="text-xs lg:text-sm font-medium text-loan-given-foreground">To Receive</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-24 lg:h-10 lg:w-32" />
              ) : (
                <AmountDisplay amount={totals.toReceive} size="lg" className="text-loan-given lg:text-2xl" />
              )}
            </CardContent>
          </Card>

          <Card className="bg-loan-taken-light border-0 shadow-sm lg:col-span-2">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-loan-taken/10 rounded-lg flex items-center justify-center">
                  <ArrowDownLeft className="w-4 h-4 lg:w-5 lg:h-5 text-loan-taken" />
                </div>
                <span className="text-xs lg:text-sm font-medium text-loan-taken-foreground">To Pay</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-24 lg:h-10 lg:w-32" />
              ) : (
                <AmountDisplay amount={totals.toPay} size="lg" className="text-loan-taken lg:text-2xl" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Loans Tabs */}
        <Tabs defaultValue="to-receive" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex">
            <TabsTrigger value="to-receive" className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4" />
              To Receive ({loansToReceive.length})
            </TabsTrigger>
            <TabsTrigger value="to-pay" className="flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4" />
              To Pay ({loansToPay.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="to-receive" className="mt-4">
            {isLoading ? (
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : loansToReceive.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="p-6 text-center lg:py-12">
                  <p className="text-muted-foreground mb-2">No money to receive</p>
                  <Link to="/add-loan" className="text-primary font-medium text-sm">
                    Add a loan you gave →
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {loansToReceive.map((loan) => (
                  <SwipeableLoanCard
                    key={loan.id}
                    onAddPayment={() => handleQuickAddPayment(loan)}
                    onMarkPaid={() => handleQuickMarkPaid(loan)}
                    onMarkUnpaid={() => handleQuickMarkUnpaid(loan)}
                    onMarkPartial={() => handleQuickMarkPartial(loan)}
                    status={loan.status}
                  >
                    <LoanCard loan={loan} progress={calculateProgress(loan)} />
                  </SwipeableLoanCard>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="to-pay" className="mt-4">
            {isLoading ? (
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : loansToPay.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="p-6 text-center lg:py-12">
                  <p className="text-muted-foreground mb-2">No money to pay</p>
                  <Link to="/add-loan" className="text-primary font-medium text-sm">
                    Add a loan you took →
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {loansToPay.map((loan) => (
                  <SwipeableLoanCard
                    key={loan.id}
                    onAddPayment={() => handleQuickAddPayment(loan)}
                    onMarkPaid={() => handleQuickMarkPaid(loan)}
                    onMarkUnpaid={() => handleQuickMarkUnpaid(loan)}
                    onMarkPartial={() => handleQuickMarkPartial(loan)}
                    status={loan.status}
                  >
                    <LoanCard loan={loan} progress={calculateProgress(loan)} />
                  </SwipeableLoanCard>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

    </MobileLayout>
  );
}

function LoanCard({ loan, progress }: { loan: Loan; progress: number }) {
  const balance = calculateBalance(loan);
  const isSwipeOpen = useSwipeOpen();
  const cappedProgress = Math.min(Math.max(progress, 0), 100);
  const progressColor = loan.type === 'GIVEN' ? 'bg-emerald-500' : 'bg-amber-500';
  const trackColor   = loan.type === 'GIVEN' ? 'bg-emerald-100 dark:bg-emerald-950' : 'bg-amber-100 dark:bg-amber-950';
  const showProgress = loan.status !== 'PAID' && cappedProgress > 0;
  const showFullBar  = loan.status === 'PAID';

  return (
    <Link to={`/loan/${loan.id}`}>
      <Card className={`shadow-card hover:shadow-md transition-all cursor-pointer overflow-hidden ${isSwipeOpen ? 'rounded-r-none' : ''}`}>
        <CardContent className="p-4 pb-3">
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

        {/* Progress bar */}
        {(showProgress || showFullBar) && (
          <div className={`mt-3 rounded-full h-1.5 ${showFullBar ? 'bg-emerald-100 dark:bg-emerald-950' : trackColor} overflow-hidden`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${showFullBar ? 'w-full bg-emerald-500' : progressColor}`}
              style={showProgress ? { width: `${cappedProgress}%` } : undefined}
            />
          </div>
        )}
      </CardContent>
      </Card>
    </Link>
  );
}
