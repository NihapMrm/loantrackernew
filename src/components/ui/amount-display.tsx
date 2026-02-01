import { cn } from '@/lib/utils';
import { LoanType } from '@/hooks/useLoans';

interface AmountDisplayProps {
  amount: number;
  type?: LoanType;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSign?: boolean;
  className?: string;
}

export function AmountDisplay({ 
  amount, 
  type, 
  size = 'md', 
  showSign = false,
  className 
}: AmountDisplayProps) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  const sign = showSign ? (amount >= 0 ? '+' : '-') : '';

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base font-medium',
    lg: 'text-xl font-semibold',
    xl: 'text-3xl font-bold',
  };

  const typeClasses = type 
    ? type === 'GIVEN' 
      ? 'text-loan-given' 
      : 'text-loan-taken'
    : '';

  return (
    <span className={cn(sizeClasses[size], typeClasses, className)}>
      {sign}{formatted}
    </span>
  );
}

interface StatusBadgeProps {
  status: 'OPEN' | 'PARTIAL' | 'PAID';
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    OPEN: { label: 'Open', class: 'status-open' },
    PARTIAL: { label: 'Partial', class: 'status-partial' },
    PAID: { label: 'Paid', class: 'status-paid' },
  };

  const config = statusConfig[status];

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      config.class,
      className
    )}>
      {config.label}
    </span>
  );
}

interface LoanTypeBadgeProps {
  type: LoanType;
  className?: string;
}

export function LoanTypeBadge({ type, className }: LoanTypeBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      type === 'GIVEN' 
        ? 'bg-loan-given-light text-loan-given' 
        : 'bg-loan-taken-light text-loan-taken',
      className
    )}>
      {type === 'GIVEN' ? 'Given' : 'Taken'}
    </span>
  );
}
