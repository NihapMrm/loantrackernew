import { todayISODate } from '@/lib/db';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAccount } from '@/hooks/useAccounts';
import { useLoans, calculateBalance, Loan, useCreatePayment, useResetLoanPayments, useDeleteLastPayment } from '@/hooks/useLoans';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AmountDisplay, StatusBadge, MarqueeAmount } from '@/components/ui/amount-display';
import { ArrowLeft, User, Calendar, Wallet, PiggyBank, Landmark, CreditCard, Banknote, Building2 } from 'lucide-react';
import { useMemo } from 'react';
import { formatDate } from '@/lib/formatting';
import confetti from 'canvas-confetti';
import { SwipeableLoanCard, useSwipeOpen } from '@/components/SwipeableLoanCard';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'wallet': Wallet,
  'piggy-bank': PiggyBank,
  'landmark': Landmark,
  'credit-card': CreditCard,
  'banknote': Banknote,
  'building-2': Building2,
};

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: account, isLoading: accountLoading } = useAccount(id);
  const { data: loans, isLoading: loansLoading } = useLoans();
  const createPayment = useCreatePayment();
  const resetLoan = useResetLoanPayments();
  const deleteLastPayment = useDeleteLastPayment();

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
      payment_date: todayISODate(),
      notes: 'Marked as paid',
    });
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#6ee7b7'],
    });
  };

  const handleQuickMarkUnpaid = async (loan: Loan) => {
    if (!loan.id) return;
    await resetLoan.mutateAsync(loan.id);
  };

  const handleQuickMarkPartial = async (loan: Loan) => {
    if (!loan.id) return;
    await deleteLastPayment.mutateAsync(loan.id);
  };

  // Filter loans for this account that are GIVEN and not fully paid
  const accountLoans = useMemo(() => {
    if (!loans || !id) return [];
    
    return loans
      .filter(loan => loan.account_id === id && loan.type === 'GIVEN' && loan.status !== 'PAID')
      .sort((a, b) => {
        // Sort by balance (highest first)
        const balanceA = calculateBalance(a);
        const balanceB = calculateBalance(b);
        return balanceB - balanceA;
      });
  }, [loans, id]);

  // Calculate total to receive
  const totalToReceive = useMemo(() => {
    return accountLoans.reduce((sum, loan) => sum + calculateBalance(loan), 0);
  }, [accountLoans]);

  const isLoading = accountLoading || loansLoading;

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="px-4 pt-6 pb-24">
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        </div>
      </MobileLayout>
    );
  }

  if (!account) {
    return (
      <MobileLayout>
        <div className="px-4 pt-6 pb-24">
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Account not found</p>
            <Button onClick={() => navigate('/accounts')}>Back to Accounts</Button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="px-4 pt-4 pb-4 max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/accounts')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-1.5 h-5 rounded-full bg-primary shrink-0" />
            <span className="text-sm font-black tracking-tight text-foreground truncate uppercase">{account.name}</span>
          </div>
        </div>

        {/* Account Hero Tile */}
        {(() => {
          const IconComponent = iconMap[account.icon] || Wallet;
          return (
            <div className="relative rounded-2xl bg-foreground p-5 overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
              <div className="flex items-center gap-4 relative">
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                  <IconComponent className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-white text-xl tracking-tight truncate">{account.name}</p>
                  {account.description && (
                    <p className="text-white/60 text-sm mt-0.5">{account.description}</p>
                  )}
                </div>
              </div>
              <div className="relative mt-4 rounded-xl bg-emerald-500/20 border border-emerald-400/20 p-3">
                <p className="text-emerald-300 text-xs font-medium mb-0.5">Total to Receive</p>
                <MarqueeAmount><AmountDisplay amount={totalToReceive} size="xl" type="GIVEN" className="text-emerald-400 font-black" /></MarqueeAmount>
                <p className="text-emerald-400/60 text-xs mt-1">
                  From {accountLoans.length} outstanding {accountLoans.length === 1 ? 'loan' : 'loans'}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Loans List */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-5 rounded-full bg-primary" />
            <span className="text-sm font-black tracking-tight text-foreground uppercase">Who Owes You</span>
          </div>

          {accountLoans.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No outstanding loans from this account</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {accountLoans.map((loan, i) => (
                <SwipeableLoanCard
                  key={loan.id}
                  onAddPayment={() => handleQuickAddPayment(loan)}
                  onMarkPaid={() => handleQuickMarkPaid(loan)}
                  onMarkUnpaid={() => handleQuickMarkUnpaid(loan)}
                  onMarkPartial={() => handleQuickMarkPartial(loan)}
                  status={loan.status}
                  peekDelay={i * 150}
                >
                  <AccountLoanCard loan={loan} />
                </SwipeableLoanCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}

function AccountLoanCard({ loan }: { loan: Loan }) {
  const balance = calculateBalance(loan);
  const isSwipeOpen = useSwipeOpen();
  return (
    <Link to={`/loan/${loan.id}`}>
      <Card className={`shadow-card hover:shadow-md transition-shadow ${isSwipeOpen ? 'rounded-r-none' : ''}`}>
        <CardContent className="p-4 lg:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {loan.person?.name || 'Unknown'}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={loan.status} />
                  {loan.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(loan.due_date)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right max-w-[130px] min-w-0">
              <MarqueeAmount><AmountDisplay amount={balance} size="md" type="GIVEN" /></MarqueeAmount>
              {balance < loan.amount && (
                <div className="text-xs text-muted-foreground">
                  of <MarqueeAmount className="inline-block max-w-[90px]"><AmountDisplay amount={loan.amount} size="sm" /></MarqueeAmount>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
