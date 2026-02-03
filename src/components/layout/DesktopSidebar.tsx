import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Plus, Settings, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/people', icon: Users, label: 'People' },
  { path: '/accounts', icon: Wallet, label: 'Accounts' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function DesktopSidebar() {
  const location = useLocation();

  return (
    <aside className="w-16 border-r bg-card flex flex-col items-center py-4 gap-2">
      {/* Logo */}
      <Link to="/" className="mb-4">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <Wallet className="w-5 h-5 text-primary-foreground" />
        </div>
      </Link>

      {/* Nav Items */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>
                <Link
                  to={item.path}
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Add Loan Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/add-loan"
            className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          Add Loan
        </TooltipContent>
      </Tooltip>
    </aside>
  );
}
