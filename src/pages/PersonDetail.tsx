import { todayISODate } from '@/lib/db';
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { usePerson, useLoansByPerson, useDeletePerson, calculateBalance, Loan, useCreatePayment, useResetLoanPayments, useDeleteLastPayment } from '@/hooks/useLoans';
import { AmountDisplay, StatusBadge, LoanTypeBadge, MarqueeAmount } from '@/components/ui/amount-display';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Edit, Trash2, Plus, Phone, FileText } from 'lucide-react';
import { format } from 'date-fns';
import confetti from 'canvas-confetti';
import { SwipeableLoanCard, useSwipeOpen } from '@/components/SwipeableLoanCard';

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: person, isLoading: loadingPerson } = usePerson(id);
  const { data: loans, isLoading: loadingLoans } = useLoansByPerson(id);
  const deletePerson = useDeletePerson();
  const createPayment = useCreatePayment();
  const resetLoan = useResetLoanPayments();
  const deleteLastPayment = useDeleteLastPayment();

  const isLoading = loadingPerson || loadingLoans;

  // Calculate totals
  const openLoans = loans?.filter((l) => l.status !== 'PAID') || [];
  const toReceive = openLoans
    .filter((l) => l.type === 'GIVEN')
    .reduce((sum, l) => sum + calculateBalance(l), 0);
  const toPay = openLoans
    .filter((l) => l.type === 'TAKEN')
    .reduce((sum, l) => sum + calculateBalance(l), 0);

  const handleDelete = async () => {
    if (!id) return;
    await deletePerson.mutateAsync(id);
    navigate('/people');
  };

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

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="px-4 pt-6 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </MobileLayout>
    );
  }

  if (!person) {
    return (
      <MobileLayout>
        <div className="px-4 pt-6 text-center">
          <p className="text-muted-foreground">Person not found</p>
          <Button variant="link" onClick={() => navigate('/people')}>
            Back to People
          </Button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="px-4 pt-4 pb-4 space-y-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-1.5 h-5 rounded-full bg-primary shrink-0" />
            <span className="text-sm font-black tracking-tight text-foreground truncate uppercase">{person.name}</span>
          </div>
          <Link to={`/edit-person/${id}`}>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Edit className="w-4 h-4" />
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {person.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this person and all their loans. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Person Hero Tile */}
        <div className="relative rounded-2xl bg-foreground p-5 overflow-hidden">
          <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
          <div className="flex items-center gap-4 relative">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <span className="text-white font-black text-xl">{person.name[0].toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="font-black text-white text-xl tracking-tight truncate">{person.name}</p>
              {person.phone && (
                <p className="text-white/60 text-sm mt-0.5 flex items-center gap-1.5">
                  <Phone className="w-3 h-3 shrink-0" /> {person.phone}
                </p>
              )}
            </div>
          </div>
          {person.notes && (
            <div className="relative mt-3 pt-3 border-t border-white/10">
              <p className="text-white/60 text-sm flex items-start gap-1.5">
                <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {person.notes}
              </p>
            </div>
          )}
        </div>

        {/* Balance Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-4 text-center">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1.5">To Receive</p>
            <MarqueeAmount><AmountDisplay amount={toReceive} size="lg" className="text-emerald-600 dark:text-emerald-400 font-black" /></MarqueeAmount>
          </div>
          <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-4 text-center">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300 mb-1.5">To Pay</p>
            <MarqueeAmount><AmountDisplay amount={toPay} size="lg" className="text-rose-600 dark:text-rose-400 font-black" /></MarqueeAmount>
          </div>
        </div>

        {/* Loans Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-primary" />
              <span className="text-sm font-black tracking-tight text-foreground uppercase">Loans</span>
            </div>
            <Link to={`/add-loan?person=${id}`}>
              <Button size="sm" variant="outline" className="gap-1 h-8 rounded-xl text-xs">
                <Plus className="w-3.5 h-3.5" />
                Add Loan
              </Button>
            </Link>
          </div>

          {loans?.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-6 text-center lg:py-8">
                <p className="text-muted-foreground">No loans with this person yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {loans?.map((loan, i) => (
                <SwipeableLoanCard
                  key={loan.id}
                  onAddPayment={() => handleQuickAddPayment(loan)}
                  onMarkPaid={() => handleQuickMarkPaid(loan)}
                  onMarkUnpaid={() => handleQuickMarkUnpaid(loan)}
                  onMarkPartial={() => handleQuickMarkPartial(loan)}
                  status={loan.status}
                  peekDelay={i * 150}
                >
                  <LoanCard loan={loan} />
                </SwipeableLoanCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}

function LoanCard({ loan }: { loan: Loan }) {
  const balance = calculateBalance(loan);
  const isSwipeOpen = useSwipeOpen();
  const totalPaid = (loan.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const cappedProgress = Math.min(Math.max((totalPaid / loan.amount) * 100, 0), 100);
  const progressColor = loan.type === 'GIVEN' ? 'bg-emerald-500' : 'bg-amber-500';
  const trackColor   = loan.type === 'GIVEN' ? 'bg-emerald-100 dark:bg-emerald-950' : 'bg-amber-100 dark:bg-amber-950';
  const showProgress = loan.status !== 'PAID' && cappedProgress > 0;
  const showFullBar  = loan.status === 'PAID';

  return (
    <Link to={`/loan/${loan.id}`}>
      <Card className={`shadow-card hover:shadow-md transition-all overflow-hidden ${isSwipeOpen ? 'rounded-r-none' : ''}`}>
        <CardContent className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <LoanTypeBadge type={loan.type} />
                <StatusBadge status={loan.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {format(new Date(loan.created_at), 'MMM d, yyyy')}
                {loan.due_date && ` • Due ${format(new Date(loan.due_date), 'MMM d')}`}
              </p>
            </div>
            <div className="text-right max-w-[130px] min-w-0">
              <MarqueeAmount><AmountDisplay amount={balance} type={loan.type} size="md" /></MarqueeAmount>
              {loan.status !== 'OPEN' && (
                <div className="text-xs text-muted-foreground">
                  of <MarqueeAmount className="inline-block max-w-[90px]"><AmountDisplay amount={Number(loan.amount)} size="sm" /></MarqueeAmount>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {(showProgress || showFullBar) && (
            <div className={`mt-3 rounded-full h-1.5 overflow-hidden ${showFullBar ? 'bg-emerald-100 dark:bg-emerald-950' : trackColor}`}>
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
