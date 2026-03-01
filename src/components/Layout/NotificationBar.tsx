import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ChevronDown, ChevronUp, DollarSign, CalendarClock,
  Wrench, Trash2, ClipboardList, CreditCard, BookOpen, HardHat,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface Notification {
  id: string;
  type: 'warning' | 'info' | 'success' | 'urgent';
  message: string;
  category: string;
}

const categoryConfig: Record<string, { icon: typeof Bell; link: string; dotColor: string; iconColor: string }> = {
  'دفعات متأخرة':    { icon: DollarSign,    link: '/admin/overdue-payments',      dotColor: 'bg-red-500',     iconColor: 'text-red-500' },
  'عقود تنتهي قريباً': { icon: CalendarClock, link: '/admin/contracts',             dotColor: 'bg-amber-500',   iconColor: 'text-amber-500' },
  'مهام تركيب':      { icon: Wrench,         link: '/admin/installation-tasks',    dotColor: 'bg-blue-500',    iconColor: 'text-blue-500' },
  'مهام إزالة':      { icon: Trash2,         link: '/admin/removal-tasks',         dotColor: 'bg-orange-500',  iconColor: 'text-orange-500' },
  'مهام مجمعة':      { icon: ClipboardList,  link: '/admin/composite-tasks',       dotColor: 'bg-indigo-500',  iconColor: 'text-indigo-500' },
  'آخر الدفعات':     { icon: CreditCard,     link: '/admin/payments',              dotColor: 'bg-emerald-500', iconColor: 'text-emerald-500' },
  'طلبات حجز':       { icon: BookOpen,       link: '/admin/booking-requests',      dotColor: 'bg-purple-500',  iconColor: 'text-purple-500' },
  'صيانة':           { icon: HardHat,        link: '/admin/billboard-maintenance', dotColor: 'bg-yellow-600',  iconColor: 'text-yellow-600' },
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
        removalRes, bookingsRes, maintenanceRes, recentPaymentsRes,
      ] = await Promise.all([
        supabase.from('Contract').select('Contract_Number, "Customer Name", Remaining, "End Date"').gt('Remaining', '0').lt('End Date', today).limit(20),
        supabase.from('Contract').select('Contract_Number, "Customer Name", "End Date"').gte('End Date', today).lte('End Date', nextWeekStr).limit(20),
        supabase.from('composite_tasks').select('id, contract_id, customer_name, task_type, status').in('status', ['pending', 'in_progress']).limit(20),
        supabase.from('installation_tasks').select('id, contract_id, status, task_type').in('status', ['pending', 'in_progress']).limit(20),
        supabase.from('removal_tasks').select('id, contract_id, status').in('status', ['pending', 'in_progress']).limit(20),
        supabase.from('booking_requests').select('id, status, total_price, start_date, end_date').eq('status', 'pending').limit(10),
        supabase.from('billboards').select('ID, Billboard_Name, maintenance_status').eq('maintenance_status', 'needs_maintenance').limit(10),
        supabase.from('customer_payments').select('id, amount, customer_name, contract_number, method, paid_at').order('paid_at', { ascending: false }).limit(10),
      ]);

      for (const c of overdueRes.data || []) {
        alerts.push({ id: `overdue-${c.Contract_Number}`, type: 'urgent', category: 'دفعات متأخرة',
          message: `عقد ${c.Contract_Number} — ${c['Customer Name'] || 'بدون اسم'} — متبقي: ${Number(c.Remaining).toLocaleString()} د.ل`,
        });
      }
      for (const c of expiringRes.data || []) {
        const daysLeft = Math.ceil((new Date(c['End Date']!).getTime() - Date.now()) / 86400000);
        alerts.push({ id: `expiring-${c.Contract_Number}`, type: 'warning', category: 'عقود تنتهي قريباً',
          message: `عقد ${c.Contract_Number} — ${c['Customer Name'] || 'بدون اسم'} — ينتهي بعد ${daysLeft} يوم`,
        });
      }
      for (const t of compositeRes.data || []) {
        alerts.push({ id: `composite-${t.id}`, type: 'info', category: 'مهام مجمعة',
          message: `${t.task_type === 'new_installation' ? 'تركيب جديد' : 'إعادة تركيب'} — عقد ${t.contract_id} — ${t.customer_name || 'بدون اسم'}`,
        });
      }
      for (const t of installRes.data || []) {
        alerts.push({ id: `install-${t.id}`, type: 'info', category: 'مهام تركيب',
          message: `عقد ${t.contract_id} — ${t.status === 'pending' ? 'قيد الانتظار' : 'قيد التنفيذ'}`,
        });
      }
      for (const t of removalRes.data || []) {
        alerts.push({ id: `removal-${t.id}`, type: 'warning', category: 'مهام إزالة',
          message: `عقد ${t.contract_id || '-'} — ${t.status === 'pending' ? 'قيد الانتظار' : 'قيد التنفيذ'}`,
        });
      }
      for (const p of recentPaymentsRes.data || []) {
        alerts.push({ id: `payment-${p.id}`, type: 'success', category: 'آخر الدفعات',
          message: `${p.customer_name || 'عميل'} | عقد ${p.contract_number || '-'} | ${Number(p.amount).toLocaleString()} د.ل | ${p.method || ''} | ${p.paid_at?.split('T')[0] || ''}`,
        });
      }
      for (const b of bookingsRes.data || []) {
        alerts.push({ id: `booking-${b.id}`, type: 'warning', category: 'طلبات حجز',
          message: `${b.start_date} → ${b.end_date} — ${Number(b.total_price).toLocaleString()} د.ل`,
        });
      }
      for (const b of maintenanceRes.data || []) {
        alerts.push({ id: `maintenance-${b.ID}`, type: 'warning', category: 'صيانة',
          message: `لوحة ${b.ID} — ${b.Billboard_Name || ''} تحتاج صيانة`,
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

  const sortedCategories = categoryOrder.filter(c => grouped[c]);

  return (
    <div className="shrink-0 border-b border-border bg-card">
      {/* Compact top bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
          <div className="relative shrink-0">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold px-1">
              {totalCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {sortedCategories.map(cat => {
              const conf = categoryConfig[cat];
              const Icon = conf.icon;
              return (
                <span key={cat} className="inline-flex items-center gap-0.5 shrink-0">
                  <Icon className={cn('h-3.5 w-3.5', conf.iconColor)} />
                  <span className="text-[11px] font-semibold text-foreground/70">{grouped[cat].length}</span>
                </span>
              );
            })}
          </div>
        </div>
        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        }
      </button>

      {/* Expanded accordion panel */}
      {expanded && (
        <div className="max-h-[420px] overflow-y-auto border-t border-border">
          {sortedCategories.map(cat => {
            const conf = categoryConfig[cat];
            const Icon = conf.icon;
            const items = grouped[cat];
            const isOpen = expandedCat === cat;

            return (
              <div key={cat} className="border-b border-border/50 last:border-b-0">
                {/* Category row */}
                <button
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedCat(isOpen ? null : cat)}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', conf.dotColor)} />
                    <Icon className={cn('h-4 w-4 shrink-0', conf.iconColor)} />
                    <span className="text-[13px] font-bold text-foreground">{cat}</span>
                    <span className="text-[11px] font-semibold text-muted-foreground bg-muted rounded-full min-w-[22px] h-5 flex items-center justify-center px-1.5">
                      {items.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      role="link"
                      className="text-[11px] font-medium text-primary hover:underline"
                      onClick={(e) => { e.stopPropagation(); navigate(conf.link); }}
                    >
                      عرض الكل ←
                    </span>
                    {isOpen
                      ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </div>
                </button>

                {/* Items list */}
                {isOpen && (
                  <div className="bg-muted/5">
                    {items.map(n => (
                      <div
                        key={n.id}
                        onClick={() => navigate(conf.link)}
                        className={cn(
                          'flex items-center gap-2 px-5 py-1.5 cursor-pointer transition-colors hover:bg-muted/30',
                          'border-r-[3px]',
                        )}
                        style={{
                          borderRightColor:
                            n.type === 'urgent' ? '#ef4444' :
                            n.type === 'warning' ? '#f59e0b' :
                            n.type === 'success' ? '#10b981' : '#3b82f6',
                        }}
                      >
                        <span className="text-[12px] leading-relaxed text-foreground/85 font-medium">
                          {n.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
