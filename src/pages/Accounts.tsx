import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAccounts, useDeleteAccount, Account } from '@/hooks/useAccounts';
import { useLoans, calculateBalance } from '@/hooks/useLoans';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AmountDisplay, MarqueeAmount } from '@/components/ui/amount-display';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Wallet, PiggyBank, Landmark, CreditCard, Banknote, Building2, Trash2, Pencil, ArrowUpRight } from 'lucide-react';

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

  const totalOutstanding = Object.values(accountBalances).reduce((s, v) => s + v, 0);

  const handleDelete = async () => {
    if (accountToDelete) {
      await deleteAccount.mutateAsync(accountToDelete.id);
      setAccountToDelete(null);
    }
  };

  return (
    <MobileLayout>
      <div className="pb-4 max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="px-4 pt-6 pb-2 lg:px-10 lg:pt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-primary" />
              <span className="text-sm font-black tracking-tight text-foreground">Accounts</span>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 rounded-xl h-8 text-xs" onClick={() => navigate('/add-account')}>
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>

          {/* Summary bento */}
          <div className="grid grid-cols-5 grid-rows-2 gap-2.5 h-[120px]">

            {/* Account count — tall left */}
            <div className="col-span-5 row-span-2 rounded-2xl bg-foreground p-4 flex flex-row justify-between items-center relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
              
               <div className="flex gap-2 flex-col">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 z-10">Accounts</p>
              <div className="flex items-center gap-1">
                <Wallet className="w-3 h-3 text-white/50" />
                <span className="text-[11px] text-white/50 font-medium">Manage all your accounts here</span>
              </div>
              </div>
              <div className="z-10">
                {isLoading
                  ? <Skeleton className="h-10 w-12 bg-white/20 rounded-lg mb-1" />
                  : <p className="text-4xl font-black text-white leading-none mb-1">{accounts?.length ?? 0}</p>
                }
                
              </div>
            </div>


          </div>
        </div>

        {/* ── Account List ── */}
        <div className="px-4 pt-3 lg:px-10">
          {isLoading ? (
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-[72px] rounded-2xl" />)}
            </div>
          ) : accounts?.length === 0 ? (
            <Card className="shadow-card rounded-2xl">
              <CardContent className="p-8 text-center">
                <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-bold text-foreground mb-1">No accounts yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create accounts like Cash, Savings, Bank to track where your loans come from
                </p>
                <Button onClick={() => navigate('/add-account')} className="rounded-xl gap-2">
                  <Plus className="w-4 h-4" />
                  Add Account
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {accounts?.map((account) => {
                const IconComponent = iconMap[account.icon] || Wallet;
                const toReceive = accountBalances[account.id] || 0;
                return (
                  <Card
                    key={account.id}
                    className="shadow-card cursor-pointer hover:shadow-md transition-all rounded-2xl overflow-hidden"
                    onClick={() => navigate(`/account/${account.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">

                        {/* Icon */}
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                          <IconComponent className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground truncate">{account.name}</p>
                          {toReceive > 0 ? (
                            <div className="flex items-center gap-1">
                              <ArrowUpRight className="w-3 h-3 text-emerald-500 shrink-0" />
                              <AmountDisplay amount={toReceive} size="sm" className="text-emerald-600 dark:text-emerald-400 font-medium" />
                            </div>
                          ) : account.description ? (
                            <p className="text-xs text-muted-foreground truncate">{account.description}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">No outstanding loans</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl"
                            onClick={() => navigate(`/edit-account/${account.id}`)}
                          >
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl"
                            onClick={() => setAccountToDelete(account)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
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
