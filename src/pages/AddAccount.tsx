import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAccount, useCreateAccount, useUpdateAccount, ACCOUNT_ICONS } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Wallet, PiggyBank, Landmark, CreditCard, Banknote, Building2 } from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'wallet': Wallet,
  'piggy-bank': PiggyBank,
  'landmark': Landmark,
  'credit-card': CreditCard,
  'banknote': Banknote,
  'building-2': Building2,
};

const accountSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name is too long'),
  description: z.string().trim().max(200, 'Description is too long').optional(),
  icon: z.string().optional(),
});

export default function AddAccount() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: existingAccount, isLoading: loadingAccount } = useAccount(id);
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('wallet');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isEdit && existingAccount && !initialized) {
      setName(existingAccount.name);
      setDescription(existingAccount.description || '');
      setIcon(existingAccount.icon || 'wallet');
      setInitialized(true);
    }
  }, [isEdit, existingAccount, initialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const data = {
        name,
        description: description || undefined,
        icon,
      };
      
      accountSchema.parse(data);
      setErrors({});

      if (isEdit && id) {
        await updateAccount.mutateAsync({ id, ...data });
      } else {
        await createAccount.mutateAsync(data);
      }
      
      navigate('/accounts');
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          const field = e.path[0] as string;
          fieldErrors[field] = e.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  const isPending = createAccount.isPending || updateAccount.isPending;
  const isLoading = isEdit && loadingAccount;

  if (isLoading) {
    return (
      <MobileLayout showNav={false}>
        <div className="px-4 pt-6 text-center text-muted-foreground">Loading...</div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <div className="px-4 pt-4 pb-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">
            {isEdit ? 'Edit Account' : 'Add Account'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Icon Selection */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-6 gap-2">
              {ACCOUNT_ICONS.map((iconOption) => {
                const IconComponent = iconMap[iconOption.value] || Wallet;
                return (
                  <button
                    key={iconOption.value}
                    type="button"
                    onClick={() => setIcon(iconOption.value)}
                    className={cn(
                      'p-3 rounded-xl border-2 transition-all flex items-center justify-center',
                      icon === iconOption.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-primary/50'
                    )}
                  >
                    <IconComponent className={cn(
                      'w-5 h-5',
                      icon === iconOption.value ? 'text-primary' : 'text-muted-foreground'
                    )} />
                  </button>
                );
              })}
            </div>
          </div>

          <Card className="shadow-card">
            <CardContent className="p-4 space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Cash, Savings, Bank Account"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Add any notes about this account..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
                {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1" 
              disabled={isPending}
            >
              {isPending ? 'Saving...' : isEdit ? 'Update' : 'Create Account'}
            </Button>
          </div>
        </form>
      </div>
    </MobileLayout>
  );
}
