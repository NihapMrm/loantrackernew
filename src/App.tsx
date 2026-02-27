import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, useNavigate, useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { SecurityProvider, useSecurity } from "@/lib/security";
import { LockScreen } from "@/components/LockScreen";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { useIsMobile } from "@/hooks/use-mobile";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { Home, Users, Plus, Settings as SettingsIcon, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

// Pages
import Index from "./pages/Index";
import People from "./pages/People";
import PersonDetail from "./pages/PersonDetail";
import AddPerson from "./pages/AddPerson";
import AddLoan from "./pages/AddLoan";
import LoanDetail from "./pages/LoanDetail";
import AddPayment from "./pages/AddPayment";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import AddAccount from "./pages/AddAccount";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Handle Android hardware back button
function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (location.pathname === '/' || !canGoBack) {
        // On home page or can't go back -> exit app
        CapacitorApp.exitApp();
      } else {
        // Navigate back in browser history
        navigate(-1);
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [navigate, location]);

  return null;
}

// App content that checks security
function AppContent() {
  const { isUnlocked } = useSecurity();

  if (!isUnlocked) {
    return <LockScreen />;
  }

  return (
    <HashRouter>
      <BackButtonHandler />
      <AppShell />
    </HashRouter>
  );
}

// Tab routes that should show bottom nav
const TAB_ROUTES = ['/', '/people', '/accounts', '/settings'];

// Persistent bottom nav — lives outside AnimatePresence, never remounts
const mobileNavItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/people', icon: Users, label: 'People' },
  { path: '/add-loan', icon: Plus, label: 'Add', isAction: true },
  { path: '/accounts', icon: Wallet, label: 'Accounts' },
  { path: '/settings', icon: SettingsIcon, label: 'Settings' },
];

function BottomNav() {
  const location = useLocation();
  const showNav = TAB_ROUTES.includes(location.pathname);

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom z-50 transition-transform duration-300',
        showNav ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {mobileNavItems.map((item) => {
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
                'flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Root shell — nav is a persistent sibling to the animated content
function AppShell() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const showNav = TAB_ROUTES.includes(location.pathname);

  if (!isMobile) {
    return (
      <div className="min-h-screen flex w-full">
        <DesktopSidebar />
        <main className="flex-1">
          <AnimatedRoutes />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className={cn('flex-1', showNav && 'pb-16')}>
        <AnimatedRoutes />
      </main>
      {/* Persistent nav — always mounted, slides in/out via CSS */}
      <BottomNav />
    </div>
  );
}

// Animated routes component
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/people" element={<PageTransition><People /></PageTransition>} />
        <Route path="/person/:id" element={<PageTransition><PersonDetail /></PageTransition>} />
        <Route path="/add-person" element={<PageTransition><AddPerson /></PageTransition>} />
        <Route path="/edit-person/:id" element={<PageTransition><AddPerson /></PageTransition>} />
        <Route path="/add-loan" element={<PageTransition><AddLoan /></PageTransition>} />
        <Route path="/edit-loan/:id" element={<PageTransition><AddLoan /></PageTransition>} />
        <Route path="/loan/:id" element={<PageTransition><LoanDetail /></PageTransition>} />
        <Route path="/add-payment/:loanId" element={<PageTransition><AddPayment /></PageTransition>} />
        <Route path="/accounts" element={<PageTransition><Accounts /></PageTransition>} />
        <Route path="/account/:id" element={<PageTransition><AccountDetail /></PageTransition>} />
        <Route path="/add-account" element={<PageTransition><AddAccount /></PageTransition>} />
        <Route path="/edit-account/:id" element={<PageTransition><AddAccount /></PageTransition>} />
        <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SecurityProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </SecurityProvider>
  </QueryClientProvider>
);

export default App;
