import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useLoan, useDeleteLoan, useDeletePayment, calculateBalance, Payment } from '@/hooks/useLoans';
import { AmountDisplay, StatusBadge, LoanTypeBadge, MarqueeAmount } from '@/components/ui/amount-display';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
import { ArrowLeft, Edit, Trash2, Plus, Calendar, FileText, User, Wallet, X } from 'lucide-react';
import { format } from 'date-fns';
import { formatDate } from '@/lib/formatting';

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: loan, isLoading } = useLoan(id);
  const deleteLoan = useDeleteLoan();
  const deletePayment = useDeletePayment();

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="px-4 pt-6 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </MobileLayout>
    );
  }

  if (!loan) {
    return (
      <MobileLayout>
        <div className="px-4 pt-6 text-center">
          <p className="text-muted-foreground">Loan not found</p>
          <Button variant="link" onClick={() => navigate('/')}>
            Back to Dashboard
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const balance = calculateBalance(loan);
  const totalPaid = loan.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const paymentProgress = (totalPaid / Number(loan.amount)) * 100;

  const handleDeleteLoan = async () => {
    await deleteLoan.mutateAsync(loan.id);
    navigate(-1);
  };

  const handleDeletePayment = async (paymentId: string) => {
    await deletePayment.mutateAsync(paymentId);
  };

  return (
    <MobileLayout>
      <div className="px-4 pt-4 pb-4 space-y-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-1.5 h-5 rounded-full bg-primary shrink-0" />
            <span className="text-sm font-black tracking-tight text-foreground uppercase">Loan Details</span>
          </div>
          <Link to={`/edit-loan/${loan.id}`}>
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
                <AlertDialogTitle>Delete this loan?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this loan and all its payments. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteLoan} className="bg-destructive text-destructive-foreground">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="space-y-3">
          {/* Loan Summary Hero */}
          <div className={`relative rounded-2xl overflow-hidden ${
            loan.type === 'GIVEN'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800'
          } p-4`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <LoanTypeBadge type={loan.type} />
                  <StatusBadge status={loan.status} />
                </div>
                <Link to={`/person/${loan.person_id}`} className="flex items-center gap-2 text-sm hover:underline font-medium">
                  <User className="w-4 h-4" />
                  {loan.person?.name || 'Unknown'}
                </Link>
              </div>
              <div className="text-right max-w-[160px] min-w-0">
                <p className="text-xs text-muted-foreground mb-1">
                  {loan.type === 'GIVEN' ? 'Remaining to receive' : 'Remaining to pay'}
                </p>
                <MarqueeAmount><AmountDisplay amount={balance} type={loan.type} size="xl" className="font-black" /></MarqueeAmount>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span><AmountDisplay amount={totalPaid} size="sm" /> paid</span>
                <span>of <AmountDisplay amount={Number(loan.amount)} size="sm" /></span>
              </div>
              <Progress value={paymentProgress} className="h-1.5" />
            </div>
          </div>

          {/* Details */}
          <Card className="shadow-card rounded-2xl">
            <CardContent className="p-4 space-y-3">
              {loan.account && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[10px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Account</p>
                    <Link to={`/account/${loan.account_id}`} className="font-medium hover:underline">
                      {loan.account.name}
                    </Link>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">{format(new Date(loan.created_at), 'MMMM d, yyyy')}</p>
                </div>
              </div>
              {loan.due_date && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[10px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due date</p>
                    <p className="font-medium">{formatDate(loan.due_date)}</p>
                  </div>
                </div>
              )}
              {loan.notes && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-[10px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p>{loan.notes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-primary" />
              <span className="text-sm font-black tracking-tight text-foreground uppercase">Payments</span>
            </div>
            {loan.status !== 'PAID' && (
              <Link to={`/add-payment/${loan.id}`}>
                <Button size="sm" variant="outline" className="gap-1 h-8 rounded-xl text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  Add Payment
                </Button>
              </Link>
            )}
          </div>

          {!loan.payments?.length ? (
            <Card className="shadow-card">
              <CardContent className="p-6 text-center lg:py-8">
                <p className="text-muted-foreground">No payments recorded yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {loan.payments.map((payment) => (
                <PaymentRow 
                  key={payment.id} 
                  payment={payment} 
                  onDelete={() => handleDeletePayment(payment.id)} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}

function PaymentRow({ payment, onDelete }: { payment: Payment; onDelete: () => void }) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3">
        <div 
          className="flex items-center justify-between"
          onClick={() => setShowDelete(!showDelete)}
        >
          <div>
            <p className="text-sm text-muted-foreground">
              {formatDate(payment.payment_date)}
            </p>
            {payment.notes && (
              <p className="text-xs text-muted-foreground mt-0.5">{payment.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <MarqueeAmount className="max-w-[110px]"><AmountDisplay amount={Number(payment.amount)} size="md" className="text-success" /></MarqueeAmount>
            {showDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                    <X className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete payment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove this payment record.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
