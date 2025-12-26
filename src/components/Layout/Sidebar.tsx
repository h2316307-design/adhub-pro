import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Chrome as Home, MapPin, Trash2, Wrench, FileText, Users, Merge, TrendingUp, TrendingDown, CreditCard, DollarSign, Calculator, Calendar, ChartBar as BarChart3, Settings, LogOut, Printer, Wallet, Receipt, Database, AlertCircle, MessageSquare, Moon, Sun, Hammer, Scissors, Building2, Link, Briefcase, FileSpreadsheet, AlertTriangle, CalendarPlus, Percent, Palette } from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface SidebarItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
}

interface SidebarSection {
  id: string;
  title: string;
  items: SidebarItem[];
}

const coreItems: SidebarItem[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: Home, path: '/admin' },
  { id: 'contracts', label: 'العقود', icon: FileText, path: '/admin/contracts' },
  { id: 'offers', label: 'العروض', icon: FileSpreadsheet, path: '/admin/offers' },
];

const sidebarSections: SidebarSection[] = [
  {
    id: 'billboards',
    title: 'إدارة اللوحات',
    items: [
      { id: 'billboards', label: 'إدارة اللوحات', icon: MapPin, path: '/admin/billboards' },
      { id: 'extended_billboards', label: 'اللوحات الممددة', icon: CalendarPlus, path: '/admin/extended-billboards' },
      { id: 'municipality_stickers', label: 'ملصقات البلديات', icon: Printer, path: '/admin/municipality-stickers' },
      { id: 'billboard_cleanup', label: 'تنظيف اللوحات المنتهية', icon: Trash2, path: '/admin/billboard-cleanup' },
      { id: 'billboard_maintenance', label: 'صيانة اللوحات', icon: Wrench, path: '/admin/billboard-maintenance' },
      { id: 'shared_billboards', label: 'اللوحات المشتركة', icon: FileText, path: '/admin/shared-billboards' },
      { id: 'shared_companies', label: 'الشركات المشاركة', icon: FileText, path: '/admin/shared-companies' },
      { id: 'friend_billboards', label: 'لوحات الأصدقاء', icon: Building2, path: '/admin/friend-billboards' },
      { id: 'friend_accounts', label: 'حسابات لوحات الأصدقاء', icon: DollarSign, path: '/admin/friend-accounts' },
    ],
  },
  {
    id: 'customers',
    title: 'إدارة العملاء',
    items: [
      { id: 'customers', label: 'الزبائن', icon: Users, path: '/admin/customers' },
      { id: 'customer_merge', label: 'دمج العملاء المكررين', icon: Merge, path: '/admin/customer-merge' },
    ],
  },
  {
    id: 'finance',
    title: 'الإدارة المالية',
    items: [
      { id: 'overdue_payments', label: 'الدفعات المتأخرة', icon: AlertCircle, path: '/admin/overdue-payments' },
      { id: 'payments_receipts', label: 'الدفعات والإيصالات', icon: CreditCard, path: '/admin/payments-receipts-page' },
      { id: 'printed_invoices_page', label: 'فواتير الطباعة', icon: Printer, path: '/admin/printed-invoices-page' },
      { id: 'printer_accounts', label: 'حسابات المطابع', icon: Building2, path: '/admin/printer-accounts' },
      { id: 'installation_team_accounts', label: 'حسابات فرق التركيب', icon: DollarSign, path: '/admin/installation-team-accounts' },
      { id: 'salaries', label: 'الرواتب', icon: Users, path: '/admin/salaries' },
      { id: 'custody_management', label: 'العهد المالية', icon: Briefcase, path: '/admin/custody-management' },
      { id: 'revenue', label: 'تقرير الإيرادات', icon: TrendingUp, path: '/admin/revenue' },
      { id: 'expense_management', label: 'إدارة المصروفات', icon: TrendingDown, path: '/admin/expense-management' },
    ],
  },
  {
    id: 'pricing',
    title: 'التسعير',
    items: [
      { id: 'pricing', label: 'أسعار الإيجار', icon: Calculator, path: '/admin/pricing' },
      { id: 'pricing_factors', label: 'نظام المعاملات', icon: Percent, path: '/admin/pricing-factors' },
    ],
  },
  {
    id: 'tasks_management',
    title: 'إدارة المهام',
    items: [
      { id: 'tasks', label: 'المهمات اليومية', icon: Calendar, path: '/admin/tasks' },
      { id: 'installation_tasks', label: 'مهام التركيب', icon: Hammer, path: '/admin/installation-tasks' },
      { id: 'delayed_billboards', label: 'اللوحات المتأخرة', icon: AlertTriangle, path: '/admin/delayed-billboards' },
      { id: 'removal_tasks', label: 'مهام إزالة الدعاية', icon: Trash2, path: '/admin/removal-tasks' },
      { id: 'print_tasks', label: 'مهام الطباعة', icon: Printer, path: '/admin/print-tasks' },
      { id: 'cutout_tasks', label: 'مهام المجسمات', icon: Scissors, path: '/admin/cutout-tasks' },
      { id: 'composite_tasks', label: 'المهام المجمعة', icon: FileText, path: '/admin/composite-tasks' },
    ],
  },
  {
    id: 'other',
    title: 'أخرى',
    items: [
      { id: 'booking_requests', label: 'طلبات الحجز', icon: Calendar, path: '/admin/booking-requests' },
      { id: 'users', label: 'المستخدمين', icon: Users, path: '/admin/users' },
      { id: 'installation_teams', label: 'فرقة التركيبات', icon: Users, path: '/admin/installation-teams' },
      { id: 'printers', label: 'إدارة المطابع', icon: Printer, path: '/admin/printers' },
      { id: 'reports', label: 'التقارير والإحصائيات', icon: BarChart3, path: '/admin/reports' },
      { id: 'database_backup', label: 'النسخ الاحتياطي', icon: Database, path: '/admin/database-backup' },
      { id: 'messaging_settings', label: 'إعدادات المراسلات', icon: MessageSquare, path: '/admin/messaging-settings' },
      { id: 'currency_settings', label: 'إعدادات العملة', icon: DollarSign, path: '/admin/currency-settings' },
      { id: 'pdf_templates', label: 'إعدادات قوالب PDF', icon: FileText, path: '/admin/pdf-templates' },
      { id: 'print_design', label: 'تصميم الطباعة', icon: Palette, path: '/admin/print-design' },
      { id: 'contract_terms', label: 'بنود العقد', icon: FileText, path: '/admin/contract-terms' },
      { id: 'system_settings', label: 'إعدادات النظام', icon: Link, path: '/admin/system-settings' },
      { id: 'settings', label: 'الإعدادات', icon: Settings, path: '/admin/settings' },
    ],
  },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const activeSectionIds = useMemo(
    () =>
      sidebarSections
        .filter((section) => section.items.some((item) => location.pathname.startsWith(item.path)))
        .map((section) => section.id),
    [location.pathname],
  );

  const [openSections, setOpenSections] = useState<string[]>(() => {
    if (activeSectionIds.length > 0) return activeSectionIds;
    return sidebarSections.length > 0 ? [sidebarSections[0].id] : [];
  });

  useEffect(() => {
    if (activeSectionIds.length === 0) return;
    setOpenSections((prev) => Array.from(new Set([...prev, ...activeSectionIds])));
  }, [activeSectionIds]);

  const handleNavigate = (path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  return (
    <div className={cn('flex flex-col bg-sidebar text-sidebar-foreground overflow-hidden', className)}>
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-gold">
            <MapPin className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-sidebar-foreground">لوحة التحكم</h1>
            <p className="text-sm text-sidebar-foreground/70">إدارة شاملة للوحات الإعلانية</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <div className="space-y-2">
          {coreItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Button
                key={item.id}
                variant={active ? 'default' : 'ghost'}
                size="default"
                onClick={() => handleNavigate(item.path)}
                className={cn(
                  'w-full flex-row-reverse justify-start gap-3 h-11 px-4 rounded-xl transition-colors',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg hover:bg-sidebar-primary'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )}
              >
                <span className="flex-1 text-right font-medium text-sm">{item.label}</span>
                <Icon className="h-5 w-5" />
              </Button>
            );
          })}
        </div>

        <Accordion
          type="multiple"
          value={openSections}
          onValueChange={(value) => setOpenSections(value)}
          className="space-y-3"
        >
          {sidebarSections.map((section) => (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="border-none rounded-xl bg-sidebar-accent/30 backdrop-blur-sm"
            >
              <AccordionTrigger className="flex-row-reverse justify-between px-3 text-sm font-semibold text-sidebar-foreground/80">
                <span>{section.title}</span>
              </AccordionTrigger>
              <AccordionContent className="px-1 pt-0">
                <div className="space-y-2 py-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <Button
                        key={item.id}
                        variant="ghost"
                        size="default"
                        onClick={() => handleNavigate(item.path)}
                        className={cn(
                          'w-full flex-row-reverse justify-start gap-3 h-11 px-4 rounded-xl transition-colors',
                          active
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                        )}
                      >
                        <span className="flex-1 text-right font-medium text-sm">{item.label}</span>
                        <Icon className="h-5 w-5" />
                      </Button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          className="w-full justify-start gap-2"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4" />
              <span>الوضع الفاتح</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" />
              <span>الوضع الداكن</span>
            </>
          )}
        </Button>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/50">
          <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white font-bold">
            {profile?.name ? profile.name.charAt(0) : 'م'}
          </div>
          <div className="flex-1">
            <p className="font-medium text-sidebar-foreground">
              {profile?.name ? `مرحباً ${profile.name}` : 'مرحباً'}
            </p>
            <p className="text-sm text-sidebar-foreground/70">{user?.email || 'مستخدم'}</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await signOut();
            navigate('/auth');
          }}
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <span className="flex-1 text-right">تسجيل الخروج</span>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
