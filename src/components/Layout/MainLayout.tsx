import { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBar } from './NotificationBar';
import { Menu, X, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isOfflineMode } from '@/integrations/supabase/client';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-background flex" dir="rtl">
      {/* Mobile overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-foreground/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300',
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Sidebar - Desktop: sticky, Mobile: fixed drawer */}
      <aside
        className={cn(
          'flex-shrink-0 bg-sidebar transition-all duration-300 z-50',
          // Desktop
          'hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:border-l lg:border-sidebar-border/60',
          sidebarOpen ? 'lg:w-[260px]' : 'lg:w-0 lg:overflow-hidden lg:border-l-0',
        )}
      >
        <Sidebar className="h-full w-[260px]" />
      </aside>

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          'fixed top-0 right-0 h-screen w-[280px] bg-sidebar z-50 shadow-2xl transition-transform duration-300 ease-out lg:hidden border-l border-sidebar-border/60',
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <Sidebar className="h-full" onNavigate={() => setMobileMenuOpen(false)} />
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <NotificationBar />

        {/* Top bar */}
        <header className="shrink-0 sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/60 px-3 py-2 flex items-center gap-2">
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileMenuOpen(!mobileMenuOpen);
              } else {
                setSidebarOpen(!sidebarOpen);
              }
            }}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          
          {/* Database Mode Indicator */}
          <div className={cn(
            "mr-auto flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
            isOfflineMode 
              ? "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" 
              : "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
          )}>
            {isOfflineMode ? (
              <>
                <WifiOff className="h-3 w-3" />
                <span>أوفلاين</span>
              </>
            ) : (
              <>
                <Wifi className="h-3 w-3" />
                <span>Cloud</span>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
