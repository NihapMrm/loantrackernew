import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useLoan, useDeleteLoan, useDeletePayment, calculateBalance, Payment } from '@/hooks/useLoans';
import { AmountDisplay, StatusBadge, LoanTypeBadge } from '@/components/ui/amount-display';
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
import { ArrowLeft, Edit, Trash2, Plus, Calendar, FileText, User, X } from 'lucide-react';
import { format } from 'date-fns';

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
      <div className="px-4 pt-4 pb-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Loan Details</h1>
          </div>
          <Link to={`/edit-loan/${loan.id}`}>
            <Button variant="ghost" size="icon">
              <Edit className="w-5 h-5" />
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 className="w-5 h-5" />
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

        {/* Loan Summary Card */}
        <Card className={`shadow-card border-0 ${loan.type === 'GIVEN' ? 'bg-loan-given-light' : 'bg-loan-taken-light'}`}>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <LoanTypeBadge type={loan.type} />
                  <StatusBadge status={loan.status} />
                </div>
                <Link to={`/person/${loan.person_id}`} className="flex items-center gap-2 text-sm hover:underline">
                  <User className="w-4 h-4" />
                  {loan.person?.name || 'Unknown'}
                </Link>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">
                  {loan.type === 'GIVEN' ? 'Remaining to receive' : 'Remaining to pay'}
                </p>
                <AmountDisplay amount={balance} type={loan.type} size="xl" />
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  <AmountDisplay amount={totalPaid} size="sm" /> paid
                </span>
                <span className="text-muted-foreground">
                  of <AmountDisplay amount={Number(loan.amount)} size="sm" />
                </span>
              </div>
              <Progress value={paymentProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="shadow-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{format(new Date(loan.created_at), 'MMMM d, yyyy')}</p>
              </div>
            </div>
            {loan.due_date && (
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Due date</p>
                  <p className="font-medium">{format(new Date(loan.due_date), 'MMMM d, yyyy')}</p>
                </div>
              </div>
            )}
            {loan.notes && (
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p>{loan.notes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Payments</h2>
            {loan.status !== 'PAID' && (
              <Link to={`/add-payment/${loan.id}`}>
                <Button size="sm" variant="outline" className="gap-1">
                  <Plus className="w-4 h-4" />
                  Add Payment
                </Button>
              </Link>
            )}
          </div>

          {!loan.payments?.length ? (
            <Card className="shadow-card">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No payments recorded yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
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
              {format(new Date(payment.payment_date), 'MMM d, yyyy')}
            </p>
            {payment.notes && (
              <p className="text-xs text-muted-foreground mt-0.5">{payment.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <AmountDisplay amount={Number(payment.amount)} size="md" className="text-success" />
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
