import { useNavigate, useParams } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAccount } from '@/hooks/useAccounts';
import { useLoans, calculateBalance, Loan } from '@/hooks/useLoans';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AmountDisplay, StatusBadge } from '@/components/ui/amount-display';
import { ArrowLeft, User, Calendar } from 'lucide-react';
import { useMemo } from 'react';
import { format } from 'date-fns';

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: account, isLoading: accountLoading } = useAccount(id);
  const { data: loans, isLoading: loansLoading } = useLoans();

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
      <div className="px-4 pt-6 pb-24 max-w-4xl mx-auto lg:px-8 lg:pt-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/accounts')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{account.name}</h1>
            {account.description && (
              <p className="text-sm lg:text-base text-muted-foreground">{account.description}</p>
            )}
          </div>
        </div>

        {/* Summary Card */}
        <Card className="shadow-card mb-6">
          <CardContent className="p-4 lg:p-6">
            <p className="text-sm lg:text-base text-muted-foreground mb-1">Total to Receive</p>
            <AmountDisplay amount={totalToReceive} size="xl" type="GIVEN" className="lg:text-3xl" />
            <p className="text-xs lg:text-sm text-muted-foreground mt-2">
              From {accountLoans.length} outstanding {accountLoans.length === 1 ? 'loan' : 'loans'}
            </p>
          </CardContent>
        </Card>

        {/* Loans List */}
        <h2 className="text-lg lg:text-xl font-semibold text-foreground mb-3">Who Owes You</h2>
        
        {accountLoans.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-6 text-center lg:py-8">
              <p className="text-muted-foreground">No outstanding loans from this account</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {accountLoans.map((loan) => {
              const balance = calculateBalance(loan);
              return (
                <Card 
                  key={loan.id} 
                  className="shadow-card cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/loan/${loan.id}`)}
                >
                  <CardContent className="p-4 lg:p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 lg:w-12 lg:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground lg:text-lg">
                            {loan.person?.name || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <StatusBadge status={loan.status} />
                            {loan.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(loan.due_date), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <AmountDisplay amount={balance} size="md" type="GIVEN" />
                        {balance < loan.amount && (
                          <p className="text-xs text-muted-foreground">
                            of <AmountDisplay amount={loan.amount} size="sm" />
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
