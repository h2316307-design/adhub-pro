import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      {/* الشريط الجانبي */}
      <aside className="w-80 flex-shrink-0 border-l border-sidebar-border bg-sidebar">
        <Sidebar className="h-screen sticky top-0" />
      </aside>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
