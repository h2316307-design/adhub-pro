import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Chrome as Home, MapPin, Trash2, Wrench, FileText, Users, Merge, TrendingUp, TrendingDown, CreditCard, DollarSign, Calculator, Calendar, ChartBar as BarChart3, Settings, LogOut, Printer, Receipt, Database, AlertCircle, MessageSquare, Moon, Sun, Hammer, Scissors, Building2, Link, Briefcase, FileSpreadsheet, AlertTriangle, CalendarPlus, Percent, Palette, Shield, Images, Image } from 'lucide-react';

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
      { id: 'billboard_photos', label: 'معرض صور اللوحات', icon: Image, path: '/admin/billboard-photos' },
      { id: 'extended_billboards', label: 'اللوحات الممددة', icon: CalendarPlus, path: '/admin/extended-billboards' },
      { id: 'municipality_stickers', label: 'ملصقات البلديات', icon: Printer, path: '/admin/municipality-stickers' },
      { id: 'billboard_cleanup', label: 'تنظيف اللوحات المنتهية', icon: Trash2, path: '/admin/billboard-cleanup' },
      { id: 'billboard_maintenance', label: 'صيانة اللوحات', icon: Wrench, path: '/admin/billboard-maintenance' },
      { id: 'shared_billboards', label: 'اللوحات المشتركة', icon: FileText, path: '/admin/shared-billboards' },
      { id: 'shared_companies', label: 'الشركات المشاركة', icon: FileText, path: '/admin/shared-companies' },
      { id: 'friend_billboards', label: 'لوحات الأصدقاء', icon: Building2, path: '/admin/friend-billboards' },
      { id: 'friend_accounts', label: 'حسابات لوحات الأصدقاء', icon: DollarSign, path: '/admin/friend-accounts' },
      { id: 'municipality_stats', label: 'إحصائيات البلديات', icon: BarChart3, path: '/admin/municipality-stats' },
      { id: 'municipality_rent_prices', label: 'أسعار إيجار البلديات', icon: DollarSign, path: '/admin/municipality-rent-prices' },
      { id: 'municipality_organizer', label: 'تنظيم لوحات البلدية', icon: FileText, path: '/admin/municipality-organizer' },
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
      { id: 'payments', label: 'الدفعات والإيصالات', icon: CreditCard, path: '/admin/payments-receipts-page' },
      { id: 'printed_invoices_page', label: 'فواتير الطباعة', icon: Printer, path: '/admin/printed-invoices-page' },
      { id: 'printer_accounts', label: 'حسابات المطابع', icon: Building2, path: '/admin/printer-accounts' },
      { id: 'installation_team_accounts', label: 'حسابات فرق التركيب', icon: DollarSign, path: '/admin/installation-team-accounts' },
      { id: 'salaries', label: 'الرواتب', icon: Users, path: '/admin/salaries' },
      { id: 'custody', label: 'العهد المالية', icon: Briefcase, path: '/admin/custody-management' },
      { id: 'revenue', label: 'تقرير الإيرادات', icon: TrendingUp, path: '/admin/revenue' },
      { id: 'expenses', label: 'إدارة المصروفات', icon: TrendingDown, path: '/admin/expense-management' },
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
      { id: 'image_gallery', label: 'معرض الصور', icon: Images, path: '/admin/image-gallery' },
    ],
  },
  {
    id: 'other',
    title: 'أخرى',
    items: [
      { id: 'booking_requests', label: 'طلبات الحجز', icon: Calendar, path: '/admin/booking-requests' },
      { id: 'users', label: 'المستخدمين', icon: Users, path: '/admin/users' },
      { id: 'roles', label: 'إدارة الأدوار', icon: Shield, path: '/admin/roles' },
      { id: 'installation_teams', label: 'فرقة التركيبات', icon: Users, path: '/admin/installation-teams' },
      { id: 'printers', label: 'إدارة المطابع', icon: Printer, path: '/admin/printers' },
      { id: 'reports', label: 'التقارير والإحصائيات', icon: BarChart3, path: '/admin/reports' },
      { id: 'kpi_dashboard', label: 'لوحة مؤشرات الأداء', icon: TrendingUp, path: '/admin/kpi-dashboard' },
      { id: 'profitability_reports', label: 'تقارير الربحية', icon: DollarSign, path: '/admin/profitability-reports' },
      { id: 'smart_distribution', label: 'التوزيع الذكي', icon: MapPin, path: '/admin/smart-distribution' },
      { id: 'database_backup', label: 'النسخ الاحتياطي', icon: Database, path: '/admin/database-backup' },
      { id: 'messaging_settings', label: 'إعدادات المراسلات', icon: MessageSquare, path: '/admin/messaging-settings' },
      { id: 'currency_settings', label: 'إعدادات العملة', icon: DollarSign, path: '/admin/currency-settings' },
      { id: 'print_design', label: 'تصميم الطباعة', icon: Palette, path: '/admin/print-design' },
      { id: 'billboard_print_settings', label: 'إعدادات طباعة الكل', icon: Printer, path: '/admin/billboard-print-settings' },
      { id: 'contract_terms', label: 'بنود العقد', icon: FileText, path: '/admin/contract-terms' },
      { id: 'system_settings', label: 'إعدادات النظام', icon: Link, path: '/admin/system-settings' },
      { id: 'settings', label: 'الإعدادات', icon: Settings, path: '/admin/settings' },
      { id: 'database_setup', label: 'إعداد قاعدة البيانات', icon: Database, path: '/admin/database-setup' },
    ],
  },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, signOut, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // تصفية العناصر الأساسية حسب الصلاحيات
  const filteredCoreItems = useMemo(
    () => coreItems.filter(item => hasPermission(item.id)),
    [hasPermission]
  );

  // تصفية الأقسام والعناصر حسب الصلاحيات
  const filteredSections = useMemo(
    () => sidebarSections
      .map(section => ({
        ...section,
        items: section.items.filter(item => hasPermission(item.id))
      }))
      .filter(section => section.items.length > 0),
    [hasPermission]
  );

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const activeSectionIds = useMemo(
    () =>
      filteredSections
        .filter((section) => section.items.some((item) => location.pathname.startsWith(item.path)))
        .map((section) => section.id),
    [location.pathname, filteredSections],
  );

  const [openSections, setOpenSections] = useState<string[]>([]);

  useEffect(() => {
    if (activeSectionIds.length === 0) {
      if (filteredSections.length > 0 && openSections.length === 0) {
        setOpenSections([filteredSections[0].id]);
      }
      return;
    }
    setOpenSections((prev) => {
      const newSections = Array.from(new Set([...prev, ...activeSectionIds]));
      if (newSections.length === prev.length && newSections.every(s => prev.includes(s))) {
        return prev;
      }
      return newSections;
    });
  }, [activeSectionIds, filteredSections]);

  const handleNavigate = (path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  return (
    <div className={cn('flex flex-col bg-sidebar text-sidebar-foreground overflow-hidden', className)}>
      {/* Header with gradient */}
      <div className="p-5 border-b border-sidebar-border/50 bg-gradient-to-br from-sidebar via-sidebar to-sidebar-accent/20">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
            <MapPin className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">لوحة التحكم</h1>
            <p className="text-xs text-sidebar-foreground/60">إدارة اللوحات الإعلانية</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {/* Core items with better styling */}
        <div className="space-y-1">
          {filteredCoreItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="default"
                onClick={() => handleNavigate(item.path)}
                className={cn(
                  'w-full flex-row-reverse justify-start gap-3 h-10 px-3 rounded-lg transition-all duration-200',
                  active
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                )}
              >
                <span className="flex-1 text-right font-medium text-sm">{item.label}</span>
                <Icon className={cn("h-4 w-4", active && "text-primary-foreground")} />
              </Button>
            );
          })}
        </div>

        {/* Sections with improved accordion */}
        <Accordion
          type="multiple"
          value={openSections}
          onValueChange={(value) => setOpenSections(value)}
          className="space-y-2"
        >
          {filteredSections.map((section) => (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="border-none rounded-lg bg-sidebar-accent/20 overflow-hidden"
            >
              <AccordionTrigger className="flex-row-reverse justify-between px-3 py-2.5 text-xs font-semibold text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 hover:no-underline transition-colors">
                <span>{section.title}</span>
              </AccordionTrigger>
              <AccordionContent className="px-1 pt-0 pb-1">
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <Button
                        key={item.id}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleNavigate(item.path)}
                        className={cn(
                          'w-full flex-row-reverse justify-start gap-2.5 h-9 px-3 rounded-md transition-all duration-200',
                          active
                            ? 'bg-primary/90 text-primary-foreground shadow-sm'
                            : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                        )}
                      >
                        <span className="flex-1 text-right font-normal text-xs">{item.label}</span>
                        <Icon className={cn("h-3.5 w-3.5", active ? "text-primary-foreground" : "text-sidebar-foreground/50")} />
                      </Button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </nav>

      {/* Footer section */}
      <div className="p-3 border-t border-sidebar-border/50 space-y-2 bg-sidebar-accent/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="w-full justify-start gap-2 h-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4" />
              <span className="text-xs">الوضع الفاتح</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" />
              <span className="text-xs">الوضع الداكن</span>
            </>
          )}
        </Button>

        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-sidebar-accent/30">
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm shadow-md">
            {profile?.name ? profile.name.charAt(0) : 'م'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-sidebar-foreground truncate">
              {profile?.name ? `${profile.name}` : 'مستخدم'}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email || ''}</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await signOut();
            navigate('/auth');
          }}
          className="w-full justify-start gap-2 h-8 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10"
        >
          <span className="flex-1 text-right text-xs">تسجيل الخروج</span>
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
