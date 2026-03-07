import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ChevronDown, ChevronUp, DollarSign, CalendarClock,
  Wrench, Trash2, ClipboardList, CreditCard, BookOpen, HardHat,
  ExternalLink, X, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface Notification {
  id: string;
  type: 'warning' | 'info' | 'success' | 'urgent';
  message: string;
  details?: string[];
  category: string;
}

const categoryConfig: Record<string, { icon: typeof Bell; link: string; color: string; bg: string }> = {
  'دفعات متأخرة':      { icon: DollarSign,    link: '/admin/overdue-payments',      color: 'text-red-600 dark:text-red-400',        bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/50' },
  'عقود تنتهي قريباً':  { icon: CalendarClock, link: '/admin/contracts',             color: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50' },
  'مهام تركيب':        { icon: Wrench,         link: '/admin/installation-tasks',    color: 'text-blue-600 dark:text-blue-400',      bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/50' },
  'مهام إزالة':        { icon: Trash2,         link: '/admin/removal-tasks',         color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/50' },
  'مهام مجمعة':        { icon: ClipboardList,  link: '/admin/composite-tasks',       color: 'text-indigo-600 dark:text-indigo-400',  bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/50' },
  'آخر الدفعات':       { icon: CreditCard,     link: '/admin/payments',              color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50' },
  'آخر الحركات':       { icon: Activity,       link: '/admin/activity-log',          color: 'text-cyan-600 dark:text-cyan-400',      bg: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800/50' },
  'طلبات حجز':         { icon: BookOpen,       link: '/admin/booking-requests',      color: 'text-purple-600 dark:text-purple-400',  bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/50' },
  'صيانة':             { icon: HardHat,        link: '/admin/billboard-maintenance', color: 'text-yellow-600 dark:text-yellow-400',  bg: 'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800/50' },
};

const categoryOrder = Object.keys(categoryConfig);

export function NotificationBar() {
  const [expanded, setExpanded] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: notifications = [] } = useQuery({
    queryKey: ['system-notifications-detailed'],
    queryFn: async (): Promise<Notification[]> => {
      const alerts: Notification[] = [];
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      const [
        overdueRes, expiringRes, compositeRes, installRes,
        removalRes, bookingsRes, maintenanceRes, recentPaymentsRes, activityRes,
      ] = await Promise.all([
        supabase.from('Contract').select('Contract_Number, "Customer Name", Remaining, "End Date", "Ad Type"').gt('Remaining', '0').lt('End Date', today).limit(20),
        supabase.from('Contract').select('Contract_Number, "Customer Name", "End Date", "Ad Type"').gte('End Date', today).lte('End Date', nextWeekStr).limit(20),
        supabase.from('composite_tasks').select('id, contract_id, customer_name, task_type, status').in('status', ['pending', 'in_progress']).limit(20),
        supabase.from('installation_tasks').select('id, contract_id, status, task_type').in('status', ['pending', 'in_progress']).limit(20),
        supabase.from('removal_tasks').select('id, contract_id, status').in('status', ['pending', 'in_progress']).limit(20),
        supabase.from('booking_requests').select('id, status, total_price, start_date, end_date').eq('status', 'pending').limit(10),
        supabase.from('billboards').select('ID, Billboard_Name, maintenance_status, "Ad_Type"').eq('maintenance_status', 'needs_maintenance').limit(10),
        supabase.from('customer_payments').select('id, amount, customer_name, contract_number, method, paid_at').order('paid_at', { ascending: false }).limit(10),
        supabase.from('activity_log').select('id, action, entity_type, description, customer_name, contract_number, created_at, details').order('created_at', { ascending: false }).limit(10),
      ]);

      for (const c of overdueRes.data || []) {
        const adType = c['Ad Type'] || '';
        alerts.push({ id: `overdue-${c.Contract_Number}`, type: 'urgent', category: 'دفعات متأخرة',
          message: `عقد #${c.Contract_Number}`,
          details: [
            c['Customer Name'] || 'بدون اسم',
            adType ? `📋 ${adType}` : '',
            `💰 متبقي: ${Number(c.Remaining).toLocaleString()} د.ل`,
          ].filter(Boolean),
        });
      }
      for (const c of expiringRes.data || []) {
        const daysLeft = Math.ceil((new Date(c['End Date']!).getTime() - Date.now()) / 86400000);
        const adType = c['Ad Type'] || '';
        alerts.push({ id: `expiring-${c.Contract_Number}`, type: 'warning', category: 'عقود تنتهي قريباً',
          message: `عقد #${c.Contract_Number}`,
          details: [
            c['Customer Name'] || 'بدون اسم',
            adType ? `📋 ${adType}` : '',
            `⏳ ينتهي بعد ${daysLeft} يوم`,
          ].filter(Boolean),
        });
      }
      for (const t of compositeRes.data || []) {
        alerts.push({ id: `composite-${t.id}`, type: 'info', category: 'مهام مجمعة',
          message: t.task_type === 'new_installation' ? 'تركيب جديد' : 'إعادة تركيب',
          details: [
            `عقد #${t.contract_id}`,
            t.customer_name || 'بدون اسم',
            `📌 ${t.status === 'pending' ? 'قيد الانتظار' : 'قيد التنفيذ'}`,
          ].filter(Boolean),
        });
      }
      for (const t of installRes.data || []) {
        alerts.push({ id: `install-${t.id}`, type: 'info', category: 'مهام تركيب',
          message: `عقد #${t.contract_id}`,
          details: [
            `📌 ${t.status === 'pending' ? 'قيد الانتظار' : 'قيد التنفيذ'}`,
          ].filter(Boolean),
        });
      }
      for (const t of removalRes.data || []) {
        alerts.push({ id: `removal-${t.id}`, type: 'warning', category: 'مهام إزالة',
          message: `عقد #${t.contract_id || '-'}`,
          details: [
            `📌 ${t.status === 'pending' ? 'قيد الانتظار' : 'قيد التنفيذ'}`,
          ].filter(Boolean),
        });
      }
      for (const p of recentPaymentsRes.data || []) {
        alerts.push({ id: `payment-${p.id}`, type: 'success', category: 'آخر الدفعات',
          message: p.customer_name || 'عميل',
          details: [
            `عقد #${p.contract_number || '-'}`,
            `💰 ${Number(p.amount).toLocaleString()} د.ل`,
            p.method ? `🏦 ${p.method}` : '',
            `📅 ${p.paid_at?.split('T')[0] || ''}`,
          ].filter(Boolean),
        });
      }
      for (const b of bookingsRes.data || []) {
        alerts.push({ id: `booking-${b.id}`, type: 'warning', category: 'طلبات حجز',
          message: 'طلب حجز جديد',
          details: [
            `📅 ${b.start_date} → ${b.end_date}`,
            `💰 ${Number(b.total_price).toLocaleString()} د.ل`,
          ],
        });
      }
      for (const b of maintenanceRes.data || []) {
        const adType = (b as any).Ad_Type || '';
        alerts.push({ id: `maintenance-${b.ID}`, type: 'warning', category: 'صيانة',
          message: `لوحة #${b.ID}`,
          details: [b.Billboard_Name || '', adType ? `📋 ${adType}` : '', '🔧 تحتاج صيانة'].filter(Boolean),
        });
      }
      const actionLabels: Record<string, string> = { create: '➕ إنشاء', update: '✏️ تعديل', delete: '🗑️ حذف' };
      for (const a of activityRes.data || []) {
        const actionLabel = actionLabels[a.action] || a.action;
        const timeStr = new Date(a.created_at).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' });
        alerts.push({ id: `activity-${a.id}`, type: 'info', category: 'آخر الحركات',
          message: a.description || 'حركة',
          details: [
            actionLabel,
            a.contract_number ? `عقد #${a.contract_number}` : '',
            a.customer_name || '',
            (a.details as any)?.amount ? `💰 ${Number((a.details as any).amount).toLocaleString()} د.ل` : '',
            `🕐 ${timeStr}`,
          ].filter(Boolean),
        });
      }
      return alerts;
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const totalCount = notifications.length;
  if (totalCount === 0) return null;

  const grouped = notifications.reduce((acc, n) => {
    (acc[n.category] = acc[n.category] || []).push(n);
    return acc;
  }, {} as Record<string, Notification[]>);

  // Always show "آخر الحركات" even if empty
  const sortedCategories = categoryOrder.filter(c => grouped[c] || c === 'آخر الحركات');

  return (
    <div className="shrink-0 border-b border-border/60">
      {/* Summary bar - scrollable chips */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-card/80">
        {/* Bell + total */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="relative shrink-0 h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
        >
          <Bell className="h-4.5 w-4.5 text-primary" />
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-destructive text-destructive-foreground text-[11px] flex items-center justify-center font-bold px-1.5">
            {totalCount}
          </span>
        </button>

        {/* Category chips - horizontal scroll */}
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2">
            {sortedCategories.map(cat => {
              const conf = categoryConfig[cat];
              const Icon = conf.icon;
              const count = (grouped[cat] || []).length;
              const isActive = expandedCat === cat && expanded;

              return (
                <button
                  key={cat}
                  onClick={() => {
                    // If category has no items, navigate directly to the page
                    if (count === 0) {
                      navigate(conf.link);
                      return;
                    }
                    if (isActive) {
                      setExpandedCat(null);
                    } else {
                      setExpandedCat(cat);
                      setExpanded(true);
                    }
                  }}
                  className={cn(
                    'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all',
                    isActive
                      ? cn(conf.bg, conf.color, 'ring-1 ring-current/20 shadow-sm')
                      : 'border-border/60 bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', isActive ? '' : conf.color)} />
                  <span className="whitespace-nowrap">{cat}</span>
                  {count > 0 && (
                    <span className={cn(
                      'min-w-[20px] h-5 rounded-full text-[11px] font-bold flex items-center justify-center px-1',
                      isActive ? 'bg-foreground/10' : 'bg-muted'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Expand/collapse toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {expanded
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-border/40">
          {/* If no specific category selected, show all as cards */}
          {!expandedCat ? (
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[320px] overflow-y-auto">
              {sortedCategories.map(cat => {
                const conf = categoryConfig[cat];
                const Icon = conf.icon;
                const count = grouped[cat].length;

                return (
                  <button
                    key={cat}
                    onClick={() => setExpandedCat(cat)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm text-right',
                      conf.bg
                    )}
                  >
                    <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-background/60', conf.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-bold', conf.color)}>{count}</p>
                      <p className="text-xs text-muted-foreground truncate">{cat}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground/50 -rotate-90 rtl:rotate-90 shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : (
            // Specific category details
            <div className="max-h-[400px] overflow-y-auto">
              {/* Category header */}
              <div className={cn('flex items-center justify-between px-4 py-3 border-b border-border/40', categoryConfig[expandedCat].bg)}>
                <div className="flex items-center gap-2.5">
                  {(() => {
                    const conf = categoryConfig[expandedCat];
                    const Icon = conf.icon;
                    return (
                      <>
                        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center bg-background/60', conf.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{expandedCat}</p>
                          <p className="text-[11px] text-muted-foreground">{grouped[expandedCat].length} عنصر</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(categoryConfig[expandedCat].link)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline px-2.5 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                  >
                    <span>عرض الكل</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setExpandedCat(null)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Items list */}
              <div className="p-2 space-y-1.5">
                {grouped[expandedCat].map(n => (
                  <button
                    key={n.id}
                    onClick={() => navigate(categoryConfig[expandedCat].link)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3.5 py-2.5 rounded-lg text-right transition-colors border',
                      'hover:shadow-sm bg-card border-border/40 hover:border-border'
                    )}
                  >
                    <span className={cn(
                      'mt-1 w-2.5 h-2.5 rounded-full shrink-0',
                      n.type === 'urgent' ? 'bg-destructive' :
                      n.type === 'warning' ? 'bg-amber-500 dark:bg-amber-400' :
                      n.type === 'success' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-blue-500 dark:bg-blue-400'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-foreground">{n.message}</p>
                      {n.details && n.details.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          {n.details.map((d, i) => (
                            <span key={i} className="text-[12px] text-muted-foreground whitespace-nowrap">{d}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
