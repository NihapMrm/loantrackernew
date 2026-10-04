import { todayISODate } from '@/lib/db';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useLoans, calculateTotals, calculateBalance, Loan, useCreatePayment, useResetLoanPayments, useDeleteLastPayment } from '@/hooks/useLoans';
import { AmountDisplay, StatusBadge, LoanTypeBadge, MarqueeAmount } from '@/components/ui/amount-display';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SwipeableLoanCard, useSwipeOpen } from '@/components/SwipeableLoanCard';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, Minus, Pin } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useMemo } from 'react';
import { usePinnedLoans } from '@/hooks/usePinnedLoans';
import { formatDate } from '@/lib/formatting';
import { useSettings } from '@/hooks/useSettings';

export default function Dashboard() {
  const { data: loans, isLoading } = useLoans();
  const createPayment = useCreatePayment();
  const resetLoan = useResetLoanPayments();
  const deleteLastPayment = useDeleteLastPayment();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { pinnedIds, toggle: togglePin, isPinned } = usePinnedLoans();
  const totals = loans ? calculateTotals(loans) : { toReceive: 0, toPay: 0 };
  const net = totals.toReceive - totals.toPay;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);
  
  // Pinned loans (active only — PAID loans are excluded from pinned section)
  const pinnedLoans = loans?.filter(l => l.id && isPinned(l.id) && l.status !== 'PAID') || [];

  // Separate loans by type (only active loans with a non-zero amount, excluding pinned)
  const loansToReceive = loans?.filter(l => l.type === 'GIVEN' && l.status !== 'PAID' && Number(l.amount) > 0 && !(l.id && isPinned(l.id))) || [];
  const loansToPay = loans?.filter(l => l.type === 'TAKEN' && l.status !== 'PAID' && Number(l.amount) > 0 && !(l.id && isPinned(l.id))) || [];

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
      <div className="pb-4 space-y-0 max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="px-4 pt-6 pb-2 lg:px-10 lg:pt-8">
          {/* top label */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-primary" />
              <span className="text-sm font-black tracking-tight text-foreground">LoanTracker</span>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">{greeting} · {formatDate(new Date().toISOString(), settings)}</span>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-5 grid-rows-2 gap-2.5 h-[168px] lg:h-[180px]">

            {/* Net — tall left tile (col 1-3, row 1-2) */}
            <div className={`col-span-3 row-span-2 rounded-2xl p-4 flex flex-col justify-between overflow-hidden relative ${
              net > 0 ? 'bg-emerald-500' : net < 0 ? 'bg-rose-500' : 'bg-foreground'
            }`}>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 z-10">Net Balance</p>
              <div className="z-10">
                {isLoading
                  ? <Skeleton className="h-10 w-28 bg-white/20 rounded-lg mb-1" />
                  : <div className="mb-1">
                      <MarqueeAmount>
                        <span className="text-3xl lg:text-4xl font-black text-white leading-none">
                          {net > 0 ? '+' : ''}<AmountDisplay amount={net} size="lg" className="inline text-inherit" />
                        </span>
                      </MarqueeAmount>
                    </div>
                }
                <div className="flex items-center gap-1">
                  {net > 0 ? <TrendingUp className="w-3 h-3 text-white/60" /> : net < 0 ? <TrendingDown className="w-3 h-3 text-white/60" /> : <Minus className="w-3 h-3 text-white/40" />}
                  <span className="text-[11px] text-white/60 font-medium">
                    {net > 0 ? "You're ahead" : net < 0 ? "You owe more" : "All square"}
                  </span>
                </div>
              </div>
            </div>

            {/* To Receive — top right (col 4-5, row 1) */}
            <div className="col-span-2 row-span-1 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Receive</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              {isLoading
                ? <Skeleton className="h-6 w-20" />
                : <MarqueeAmount><AmountDisplay amount={totals.toReceive} size="md" className="text-emerald-700 dark:text-emerald-400 font-black" /></MarqueeAmount>
              }
              <span className="text-[10px] text-emerald-600/60 dark:text-emerald-500/60">{loansToReceive.length} {loansToReceive.length === 1 ? 'loan' : 'loans'}</span>
            </div>

            {/* To Pay — bottom right (col 4-5, row 2) */}
            <div className="col-span-2 row-span-1 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-700 dark:text-rose-400">Pay</span>
                <ArrowDownLeft className="w-3.5 h-3.5 text-rose-500" />
              </div>
              {isLoading
                ? <Skeleton className="h-6 w-20" />
                : <MarqueeAmount><AmountDisplay amount={totals.toPay} size="md" className="text-rose-700 dark:text-rose-400 font-black" /></MarqueeAmount>
              }
              <span className="text-[10px] text-rose-600/60 dark:text-rose-500/60">{loansToPay.length} {loansToPay.length === 1 ? 'loan' : 'loans'}</span>
            </div>

          </div>
        </div>

        <div className="px-4 pt-3 pb-0 space-y-4 lg:px-8">

        {/* ── Pinned Loans ── */}
        {pinnedLoans.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pinned</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {pinnedLoans.map((loan) => (
                <SwipeableLoanCard
                  key={loan.id}
                  onAddPayment={() => handleQuickAddPayment(loan)}
                  onMarkPaid={() => handleQuickMarkPaid(loan)}
                  onMarkUnpaid={() => handleQuickMarkUnpaid(loan)}
                  onMarkPartial={() => handleQuickMarkPartial(loan)}
                  status={loan.status}
                  isPinned={true}
                  onTogglePin={loan.status !== 'PAID' ? () => loan.id && togglePin(loan.id) : undefined}
                >
                  <LoanCard loan={loan} progress={calculateProgress(loan)} />
                </SwipeableLoanCard>
              ))}
            </div>
          </div>
        )}

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
                {loansToReceive.map((loan, i) => (
                  <SwipeableLoanCard
                    key={loan.id}
                    onAddPayment={() => handleQuickAddPayment(loan)}
                    onMarkPaid={() => handleQuickMarkPaid(loan)}
                    onMarkUnpaid={() => handleQuickMarkUnpaid(loan)}
                    onMarkPartial={() => handleQuickMarkPartial(loan)}
                    status={loan.status}
                    peekDelay={i * 150}
                    isPinned={loan.id ? isPinned(loan.id) : false}
                    onTogglePin={loan.status !== 'PAID' ? () => loan.id && togglePin(loan.id) : undefined}
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
                {loansToPay.map((loan, i) => (
                  <SwipeableLoanCard
                    key={loan.id}
                    onAddPayment={() => handleQuickAddPayment(loan)}
                    onMarkPaid={() => handleQuickMarkPaid(loan)}
                    onMarkUnpaid={() => handleQuickMarkUnpaid(loan)}
                    onMarkPartial={() => handleQuickMarkPartial(loan)}
                    status={loan.status}
                    peekDelay={i * 150}
                    isPinned={loan.id ? isPinned(loan.id) : false}
                    onTogglePin={loan.status !== 'PAID' ? () => loan.id && togglePin(loan.id) : undefined}
                  >
                    <LoanCard loan={loan} progress={calculateProgress(loan)} />
                  </SwipeableLoanCard>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        </div> {/* end inner padded div */}
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
              <span>{formatDate(loan.created_at)}</span>
              <StatusBadge status={loan.status} />
            </div>
          </div>
          <div className="text-right max-w-[130px] min-w-0">
            <MarqueeAmount>
              <AmountDisplay 
                amount={balance} 
                type={loan.type} 
                size="md"
              />
            </MarqueeAmount>
            {loan.status !== 'OPEN' && (
              <div className="text-xs text-muted-foreground">
                of <MarqueeAmount className="inline-block max-w-[90px]"><AmountDisplay amount={Number(loan.amount)} size="sm" /></MarqueeAmount>
              </div>
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
