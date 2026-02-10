import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* الشريط الجانبي */}
      <aside className={cn(
        "flex-shrink-0 border-l border-sidebar-border bg-sidebar transition-all duration-300 z-50",
        "fixed lg:sticky top-0 h-screen",
        // Desktop
        sidebarOpen ? "lg:w-80" : "lg:w-0 lg:overflow-hidden",
        // Mobile
        mobileMenuOpen ? "w-80" : "w-0 overflow-hidden lg:overflow-visible"
      )}>
        <Sidebar className="h-screen" />
      </aside>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header with toggle button */}
        <header className="sticky top-0 z-30 bg-background border-b border-border p-2 md:p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileMenuOpen(!mobileMenuOpen);
              } else {
                setSidebarOpen(!sidebarOpen);
              }
            }}
            className="h-8 w-8"
          >
            {(sidebarOpen || mobileMenuOpen) ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
