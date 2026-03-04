import { cn } from '@/lib/utils';
import { LoanType } from '@/hooks/useLoans';
import { useSettings } from '@/hooks/useSettings';
import { formatAmount } from '@/lib/formatting';
import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

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
  const { settings } = useSettings();
  const formatted = formatAmount(amount, settings);
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

/* ── MarqueeAmount: auto-scrolls when content overflows its container ── */
export function MarqueeAmount({ children, className }: { children: React.ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [translateX, setTranslateX] = useState(0);

  useEffect(() => {
    const check = () => {
      if (!containerRef.current || !contentRef.current) return;
      const overflow = contentRef.current.scrollWidth - containerRef.current.clientWidth;
      setTranslateX(overflow > 2 ? overflow : 0);
    };
    check();
    const ro = new ResizeObserver(check);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div ref={containerRef} className={cn('overflow-hidden w-full', className)}>
      <motion.span
        ref={contentRef}
        className="inline-block whitespace-nowrap"
        animate={translateX > 0
          ? { x: [0, -translateX, -translateX, 0] }
          : { x: 0 }
        }
        transition={translateX > 0 ? {
          duration: 2.5 + translateX / 60,
          times: [0, 0.45, 0.55, 1],
          ease: 'easeInOut',
          repeat: Infinity,
          repeatDelay: 0.8,
        } : { duration: 0 }}
      >
        {children}
      </motion.span>
    </div>
  );
}
