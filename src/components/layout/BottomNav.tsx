import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Plus, Settings as SettingsIcon, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export const TAB_ROUTES = ['/', '/people', '/accounts', '/settings'];

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/people', icon: Users, label: 'People' },
  { path: '/add-loan', icon: Plus, label: 'Add', isAction: true },
  { path: '/accounts', icon: Wallet, label: 'Accounts' },
  { path: '/settings', icon: SettingsIcon, label: 'Settings' },
];

export function BottomNav() {
  const location = useLocation();
  const showNav = TAB_ROUTES.includes(location.pathname);

  return (
    <motion.nav
      initial={false}
      animate={{ y: showNav ? 0 : 120 }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
    >
      {/* SVG notch bar background */}
      <div className="relative mx-auto max-w-lg pointer-events-auto">
        {/* bar */}
<div className="mx-4 h-[64px] bg-background border border-border rounded-[28px] shadow-[0_4px_32px_rgba(0,0,0,0.08)] flex items-center relative overflow-visible" style={{ marginBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>

          {/* left 2 items */}
          <div className="flex flex-1 items-center justify-around h-full">
            {navItems.slice(0, 2).map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path} className="relative flex items-center justify-center flex-1 h-full">
                  <Icon className={cn(
                    'w-5 h-5 transition-all duration-300',
                    isActive ? 'text-primary scale-110 -translate-y-2' : 'text-muted-foreground/50 translate-y-0'
                  )} />
                  <span className={cn(
                    'absolute bottom-2 left-0 right-0 text-center text-[9px] font-bold leading-none tracking-wide transition-all duration-300',
                    isActive ? 'text-primary opacity-100 -translate-y-2' : 'opacity-0'
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* centre notch gap */}
          <div className="w-16 shrink-0" />

          {/* right 2 items */}
          <div className="flex flex-1 items-center justify-around h-full">
            {navItems.slice(3).map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path} className="relative flex items-center justify-center flex-1 h-full">
                  <Icon className={cn(
                    'w-5 h-5 transition-all duration-300',
                    isActive ? 'text-primary scale-110 -translate-y-2' : 'text-muted-foreground/50 translate-y-0'
                  )} />
                  <span className={cn(
                    'absolute bottom-2 left-0 right-0 text-center text-[9px] font-bold leading-none tracking-wide transition-all duration-300',
                    isActive ? 'text-primary opacity-100 -translate-y-2' : 'opacity-0'
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* FAB centred, raised above bar */}
        <Link
          to="/add-loan"
          className="absolute left-1/2 -translate-x-1/2 bottom-[22px] z-20"
        >
          <motion.div whileTap={{ scale: 0.84 }} className="relative w-14 h-14">
            {/* outer glow */}
            <span className="absolute inset-0 rounded-full bg-primary/20 blur-lg scale-125" />
            {/* ring border */}
            <span className="absolute inset-0 rounded-full border-[3px] border-background" />
            {/* button */}
            <div className="relative w-full h-full rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
              <Plus className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
            </div>
          </motion.div>
        </Link>
      </div>
    </motion.nav>
  );
}
