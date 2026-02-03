import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Plus, Settings, Wallet, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DesktopSidebar } from './DesktopSidebar';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();

  // Mobile layout with bottom nav
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className={cn("flex-1", showNav && "pb-20")}>
          {children}
        </main>

        {showNav && (
          <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom z-50">
            <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;

                if (item.isAction) {
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="flex flex-col items-center justify-center -mt-4"
                    >
                      <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
                        <Icon className="w-6 h-6 text-primary-foreground" />
                      </div>
                    </Link>
                  );
                }

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    );
  }

  // Desktop layout with left sidebar
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {showNav && <DesktopSidebar />}
        <div className="flex-1 flex flex-col">
          {showNav && (
            <header className="h-14 border-b flex items-center px-4 bg-background">
              <SidebarTrigger>
                <Button variant="ghost" size="icon">
                  <PanelLeft className="w-5 h-5" />
                </Button>
              </SidebarTrigger>
            </header>
          )}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
