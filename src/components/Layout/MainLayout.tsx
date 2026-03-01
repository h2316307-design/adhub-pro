import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBar } from './NotificationBar';
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
    /* 
      البنية الصحيحة:
      - html/body/root → h-full
      - الحاوية الخارجية → h-screen overflow-hidden (تمنع الـ body من التمرير)
      - الـ Sidebar → h-screen sticky (لا يتأثر بالتمرير)
      - منطقة المحتوى → flex-col h-full
      - الـ Header → shrink-0 (لا يتمدد)
      - الـ main → flex-1 overflow-y-auto (هنا يحدث التمرير فقط)
    */
    <div className="h-screen overflow-hidden bg-background flex" dir="rtl">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* الشريط الجانبي — ثابت بالكامل */}
      <aside className={cn(
        "flex-shrink-0 border-l border-sidebar-border bg-sidebar transition-all duration-300 z-50",
        "fixed lg:sticky top-0 h-screen",
        sidebarOpen ? "lg:w-80" : "lg:w-0 lg:overflow-hidden",
        mobileMenuOpen ? "w-80" : "w-0 overflow-hidden lg:overflow-visible"
      )}>
        <Sidebar className="h-full overflow-y-auto" />
      </aside>

      {/* المحتوى الرئيسي — يملأ المساحة المتبقية */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Notification bar */}
        <NotificationBar />

        {/* Header ثابت — لا يتمرر */}
        <header className="shrink-0 sticky top-0 z-30 bg-background border-b border-border p-2 md:p-3">
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

        {/* منطقة المحتوى — هنا فقط يحدث التمرير */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
