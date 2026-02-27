import { ReactNode } from 'react';

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean; // kept for API compat; padding is handled by AppShell
}

// Layout is now a pure content wrapper.
// Navigation (bottom nav on mobile, sidebar on desktop) is rendered
// as a persistent singleton in App.tsx's AppShell, outside AnimatePresence.
export function MobileLayout({ children }: MobileLayoutProps) {
  return <>{children}</>;
}
