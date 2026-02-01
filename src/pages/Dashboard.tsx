import { Link } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useLoans, calculateTotals, calculateBalance, Loan } from '@/hooks/useLoans';
import { AmountDisplay, StatusBadge, LoanTypeBadge } from '@/components/ui/amount-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Wallet } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { data: loans, isLoading } = useLoans();
  const totals = loans ? calculateTotals(loans) : { toReceive: 0, toPay: 0 };
  const recentLoans = loans?.slice(0, 5) || [];

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

        {/* Recent Loans */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Recent Loans</h2>
            {loans && loans.length > 5 && (
              <Link to="/people" className="text-sm text-primary font-medium flex items-center gap-1">
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : recentLoans.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground mb-2">No loans yet</p>
                <Link to="/add-loan" className="text-primary font-medium text-sm">
                  Add your first loan →
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentLoans.map((loan) => (
                <LoanCard key={loan.id} loan={loan} />
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
  
  return (
    <Link to={`/loan/${loan.id}`}>
      <Card className="shadow-card hover:shadow-md transition-shadow">
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
    </Link>
  );
}
