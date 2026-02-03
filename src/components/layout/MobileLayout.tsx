import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Plus, Settings, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/people', icon: Users, label: 'People' },
  { path: '/add-loan', icon: Plus, label: 'Add', isAction: true },
  { path: '/accounts', icon: Wallet, label: 'Accounts' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function MobileLayout({ children, showNav = true }: MobileLayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className={cn("flex-1", showNav && "pb-20 lg:pb-6")}>
        {children}
      </main>

      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom z-50 lg:top-0 lg:bottom-auto lg:border-t-0 lg:border-b lg:shadow-sm">
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto lg:max-w-6xl lg:justify-end lg:gap-2 lg:px-8">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              if (item.isAction) {
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex flex-col items-center justify-center -mt-4 lg:mt-0 lg:ml-4"
                  >
                    <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg lg:w-10 lg:h-10 lg:shadow-none">
                      <Icon className="w-6 h-6 text-primary-foreground lg:w-5 lg:h-5" />
                    </div>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors lg:flex-row lg:gap-2 lg:px-4 lg:py-2 lg:rounded-lg lg:hover:bg-accent",
                    isActive ? "text-primary lg:bg-accent" : "text-muted-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium lg:text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
