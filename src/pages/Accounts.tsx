import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAccounts, useDeleteAccount, ACCOUNT_ICONS, Account } from '@/hooks/useAccounts';
import { useLoans, calculateBalance } from '@/hooks/useLoans';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AmountDisplay } from '@/components/ui/amount-display';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Plus, Wallet, PiggyBank, Landmark, CreditCard, Banknote, Building2, Trash2, Pencil } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'wallet': Wallet,
  'piggy-bank': PiggyBank,
  'landmark': Landmark,
  'credit-card': CreditCard,
  'banknote': Banknote,
  'building-2': Building2,
};

export default function Accounts() {
  const navigate = useNavigate();
  const { data: accounts, isLoading } = useAccounts();
  const { data: loans } = useLoans();
  const deleteAccount = useDeleteAccount();
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  // Calculate "to receive" amount for each account from GIVEN loans
  const accountBalances = useMemo(() => {
    if (!loans) return {};
    
    const balances: Record<string, number> = {};
    
    loans
      .filter(loan => loan.type === 'GIVEN' && loan.status !== 'PAID' && loan.account_id)
      .forEach(loan => {
        const balance = calculateBalance(loan);
        if (loan.account_id) {
          balances[loan.account_id] = (balances[loan.account_id] || 0) + balance;
        }
      });
    
    return balances;
  }, [loans]);

  const handleDelete = async () => {
    if (accountToDelete) {
      await deleteAccount.mutateAsync(accountToDelete.id);
      setAccountToDelete(null);
    }
  };

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
            <p className="text-sm text-muted-foreground">Manage your payment accounts</p>
          </div>
          <Button size="icon" onClick={() => navigate('/add-account')}>
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Account List */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : accounts?.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">No accounts yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create accounts like Cash, Savings, Bank to track where your loans come from
              </p>
              <Button onClick={() => navigate('/add-account')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {accounts?.map((account) => {
              const IconComponent = iconMap[account.icon] || Wallet;
              const toReceive = accountBalances[account.id] || 0;
              return (
                <Card 
                  key={account.id} 
                  className="shadow-card cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/account/${account.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <IconComponent className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{account.name}</p>
                        {toReceive > 0 ? (
                          <p className="text-sm text-loan-given">
                            To receive: <AmountDisplay amount={toReceive} size="sm" className="text-loan-given" />
                          </p>
                        ) : account.description ? (
                          <p className="text-sm text-muted-foreground truncate">{account.description}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">No outstanding loans</p>
                        )}
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => navigate(`/edit-account/${account.id}`)}
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setAccountToDelete(account)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!accountToDelete} onOpenChange={() => setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{accountToDelete?.name}"? Loans using this account will have no account selected.
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
    </MobileLayout>
  );
}
