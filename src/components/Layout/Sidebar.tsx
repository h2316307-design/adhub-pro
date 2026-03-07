import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Chrome as Home, MapPin, Trash2, Wrench, FileText, Users, Merge, TrendingUp, TrendingDown, CreditCard, DollarSign, Calculator, Calendar, ChartBar as BarChart3, Settings, LogOut, Printer, Database, AlertCircle, MessageSquare, Moon, Sun, Hammer, Scissors, Building2, Link, Briefcase, FileSpreadsheet, AlertTriangle, CalendarPlus, Percent, Palette, Shield, Images, Image, ChevronDown, Send, Camera } from 'lucide-react';

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
  icon: LucideIcon;
  items: SidebarItem[];
}

const coreItems: SidebarItem[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: Home, path: '/admin' },
  { id: 'contracts', label: 'العقود', icon: FileText, path: '/admin/contracts' },
  { id: 'offers', label: 'العروض', icon: FileSpreadsheet, path: '/admin/offers' },
  { id: 'booking_requests', label: 'طلبات الحجز', icon: Calendar, path: '/admin/booking-requests' },
];

const sidebarSections: SidebarSection[] = [
  {
    id: 'billboards',
    title: 'اللوحات',
    icon: MapPin,
    items: [
      { id: 'billboards', label: 'جميع اللوحات', icon: MapPin, path: '/admin/billboards' },
      { id: 'billboard_photos', label: 'معرض الصور', icon: Image, path: '/admin/billboard-photos' },
      { id: 'extended_billboards', label: 'اللوحات الممددة', icon: CalendarPlus, path: '/admin/extended-billboards' },
      { id: 'billboard_cleanup', label: 'تنظيف المنتهية', icon: Trash2, path: '/admin/billboard-cleanup' },
      { id: 'billboard_maintenance', label: 'الصيانة', icon: Wrench, path: '/admin/billboard-maintenance' },
      { id: 'delayed_billboards', label: 'اللوحات المتأخرة', icon: AlertTriangle, path: '/admin/delayed-billboards' },
      { id: 'smart_distribution', label: 'التوزيع الذكي', icon: MapPin, path: '/admin/smart-distribution' },
      { id: 'rephotography', label: 'إعادة التصوير', icon: Camera, path: '/admin/rephotography' },
    ],
  },
  {
    id: 'tasks_management',
    title: 'المهام',
    icon: Calendar,
    items: [
      { id: 'tasks', label: 'المهمات اليومية', icon: Calendar, path: '/admin/tasks' },
      { id: 'installation_tasks', label: 'التركيب', icon: Hammer, path: '/admin/installation-tasks' },
      { id: 'removal_tasks', label: 'الإزالة', icon: Trash2, path: '/admin/removal-tasks' },
      { id: 'print_tasks', label: 'الطباعة', icon: Printer, path: '/admin/print-tasks' },
      { id: 'cutout_tasks', label: 'المجسمات', icon: Scissors, path: '/admin/cutout-tasks' },
      { id: 'composite_tasks', label: 'المهام المجمعة', icon: FileText, path: '/admin/composite-tasks' },
      { id: 'image_gallery', label: 'معرض الصور', icon: Images, path: '/admin/image-gallery' },
    ],
  },
  {
    id: 'finance',
    title: 'المالية',
    icon: DollarSign,
    items: [
      { id: 'overdue_payments', label: 'الدفعات المتأخرة', icon: AlertCircle, path: '/admin/overdue-payments' },
      { id: 'payments', label: 'الدفعات والإيصالات', icon: CreditCard, path: '/admin/payments-receipts-page' },
      { id: 'revenue', label: 'الإيرادات', icon: TrendingUp, path: '/admin/revenue' },
      { id: 'expenses', label: 'المصروفات', icon: TrendingDown, path: '/admin/expense-management' },
      { id: 'salaries', label: 'الرواتب', icon: Users, path: '/admin/salaries' },
      { id: 'custody', label: 'العهد المالية', icon: Briefcase, path: '/admin/custody-management' },
    ],
  },
  {
    id: 'customers',
    title: 'العملاء',
    icon: Users,
    items: [
      { id: 'customers', label: 'قائمة العملاء', icon: Users, path: '/admin/customers' },
      { id: 'customer_merge', label: 'دمج المكررين', icon: Merge, path: '/admin/customer-merge' },
    ],
  },
  {
    id: 'partnerships',
    title: 'الشراكات',
    icon: Building2,
    items: [
      { id: 'shared_billboards', label: 'اللوحات المشتركة', icon: FileText, path: '/admin/shared-billboards' },
      { id: 'shared_companies', label: 'الشركات المشاركة', icon: Building2, path: '/admin/shared-companies' },
      { id: 'friend_billboards', label: 'لوحات الأصدقاء', icon: Building2, path: '/admin/friend-billboards' },
      { id: 'friend_accounts', label: 'حسابات الأصدقاء', icon: DollarSign, path: '/admin/friend-accounts' },
    ],
  },
  {
    id: 'municipalities',
    title: 'البلديات',
    icon: Printer,
    items: [
      { id: 'municipality_stickers', label: 'ملصقات البلديات', icon: Printer, path: '/admin/municipality-stickers' },
      { id: 'municipality_stats', label: 'الإحصائيات', icon: BarChart3, path: '/admin/municipality-stats' },
      { id: 'municipality_rent_prices', label: 'أسعار الإيجار', icon: DollarSign, path: '/admin/municipality-rent-prices' },
      { id: 'municipality_organizer', label: 'تنظيم اللوحات', icon: FileText, path: '/admin/municipality-organizer' },
    ],
  },
  {
    id: 'accounts',
    title: 'الحسابات',
    icon: CreditCard,
    items: [
      { id: 'printed_invoices_page', label: 'فواتير الطباعة', icon: Printer, path: '/admin/printed-invoices-page' },
      { id: 'printer_accounts', label: 'حسابات المطابع', icon: Building2, path: '/admin/printer-accounts' },
      { id: 'installation_team_accounts', label: 'حسابات فرق التركيب', icon: DollarSign, path: '/admin/installation-team-accounts' },
    ],
  },
  {
    id: 'pricing',
    title: 'التسعير',
    icon: Calculator,
    items: [
      { id: 'pricing', label: 'أسعار الإيجار', icon: Calculator, path: '/admin/pricing' },
      { id: 'pricing_factors', label: 'نظام المعاملات', icon: Percent, path: '/admin/pricing-factors' },
    ],
  },
  {
    id: 'reports',
    title: 'التقارير',
    icon: BarChart3,
    items: [
      { id: 'reports', label: 'التقارير والإحصائيات', icon: BarChart3, path: '/admin/reports' },
      { id: 'kpi_dashboard', label: 'مؤشرات الأداء', icon: TrendingUp, path: '/admin/kpi-dashboard' },
      { id: 'profitability_reports', label: 'تقارير الربحية', icon: DollarSign, path: '/admin/profitability-reports' },
    ],
  },
  {
    id: 'team',
    title: 'الفريق',
    icon: Users,
    items: [
      { id: 'users', label: 'المستخدمين', icon: Users, path: '/admin/users' },
      { id: 'roles', label: 'الأدوار والصلاحيات', icon: Shield, path: '/admin/roles' },
      { id: 'installation_teams', label: 'فرق التركيب', icon: Users, path: '/admin/installation-teams' },
      { id: 'printers', label: 'المطابع', icon: Printer, path: '/admin/printers' },
    ],
  },
  {
    id: 'settings',
    title: 'الإعدادات',
    icon: Settings,
    items: [
      { id: 'settings', label: 'الإعدادات العامة', icon: Settings, path: '/admin/settings' },
      { id: 'system_settings', label: 'إعدادات النظام', icon: Link, path: '/admin/system-settings' },
      { id: 'messaging_settings', label: 'المراسلات', icon: MessageSquare, path: '/admin/messaging-settings' },
      { id: 'messaging_settings', label: 'إرسال جماعي واتساب', icon: Send, path: '/admin/bulk-whatsapp' },
      { id: 'currency_settings', label: 'العملة', icon: DollarSign, path: '/admin/currency-settings' },
      { id: 'print_design', label: 'تصميم الطباعة', icon: Palette, path: '/admin/print-design' },
      { id: 'billboard_print_settings', label: 'إعدادات طباعة اللوحات', icon: Printer, path: '/admin/billboard-print-settings' },
      { id: 'contract_terms', label: 'بنود العقد', icon: FileText, path: '/admin/contract-terms' },
      { id: 'database_backup', label: 'النسخ الاحتياطي', icon: Database, path: '/admin/database-backup' },
      { id: 'database_setup', label: 'إعداد قاعدة البيانات', icon: Database, path: '/admin/database-setup' },
    ],
  },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, signOut, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const filteredCoreItems = useMemo(
    () => coreItems.filter(item => hasPermission(item.id)),
    [hasPermission]
  );

  const filteredSections = useMemo(
    () => sidebarSections
      .map(section => ({
        ...section,
        items: section.items.filter(item => hasPermission(item.id))
      }))
      .filter(section => section.items.length > 0),
    [hasPermission]
  );

  const isActive = useCallback((path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  }, [location.pathname]);

  const activeSectionIds = useMemo(
    () =>
      filteredSections
        .filter((section) => section.items.some((item) => location.pathname.startsWith(item.path)))
        .map((section) => section.id),
    [location.pathname, filteredSections],
  );

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeSectionIds.length > 0) {
      setExpandedSections(prev => {
        const next = new Set(prev);
        activeSectionIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [activeSectionIds]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNavigate = (path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
    onNavigate?.();
  };

  return (
    <div className={cn('flex flex-col h-full bg-sidebar text-sidebar-foreground', className)}>
      {/* Logo / Brand */}
      <div className="shrink-0 px-4 py-4 border-b border-sidebar-border/60">
        <div className="flex items-center gap-3" style={{ direction: 'rtl' }}>
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <MapPin className="h-[18px] w-[18px] text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-sidebar-foreground leading-tight">لوحة التحكم</p>
            <p className="text-[10px] text-sidebar-foreground/45 leading-tight">إدارة اللوحات الإعلانية</p>
          </div>
        </div>
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        <nav className="px-2 py-2 space-y-0.5" style={{ direction: 'rtl' }}>
          {/* Core items */}
          {filteredCoreItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.path)}
                className={cn(
                  'sidebar-item group',
                  active && 'sidebar-item-active'
                )}
              >
                <Icon className={cn('sidebar-icon', active && 'text-primary-foreground')} />
                <span className="sidebar-label">{item.label}</span>
              </button>
            );
          })}

          <div className="my-2.5 mx-1 h-px bg-sidebar-border/40" />

          {/* Collapsible sections */}
          {filteredSections.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            const hasActiveChild = section.items.some(item => isActive(item.path));
            const SectionIcon = section.icon;

            return (
              <div key={section.id}>
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    'sidebar-section-header group',
                    hasActiveChild && 'text-primary'
                  )}
                >
                  <SectionIcon className="h-[14px] w-[14px] shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                  <span className="flex-1 truncate">{section.title}</span>
                  <ChevronDown className={cn(
                    'h-3 w-3 shrink-0 opacity-40 transition-transform duration-200',
                    isExpanded && 'rotate-180'
                  )} />
                </button>

                {/* Animated collapse */}
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-200',
                    isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                  )}
                >
                  <div className="mr-[18px] pr-2 border-r-2 border-sidebar-border/25 space-y-0.5 py-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavigate(item.path)}
                          className={cn(
                            'sidebar-sub-item group',
                            active && 'sidebar-sub-item-active'
                          )}
                        >
                          <Icon className={cn(
                            'h-[13px] w-[13px] shrink-0 transition-colors',
                            active ? 'text-primary' : 'opacity-40 group-hover:opacity-70'
                          )} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-sidebar-border/60 p-2 space-y-1" style={{ direction: 'rtl' }}>
        {/* Theme toggle */}
        <button onClick={toggleTheme} className="sidebar-footer-btn">
          {theme === 'dark' ? <Sun className="h-[14px] w-[14px]" /> : <Moon className="h-[14px] w-[14px]" />}
          <span>{theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
        </button>

        {/* User card */}
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-sidebar-accent/40">
          <div className="w-8 h-8 rounded-full bg-primary/90 flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
            {profile?.name ? profile.name.charAt(0) : 'م'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-sidebar-foreground truncate leading-tight">
              {profile?.name || 'مستخدم'}
            </p>
            <p className="text-[10px] text-sidebar-foreground/40 truncate leading-tight">{user?.email || ''}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={async () => { await signOut(); navigate('/auth'); }}
          className="sidebar-footer-btn text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/8"
        >
          <LogOut className="h-[14px] w-[14px]" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
}
