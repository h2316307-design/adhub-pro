import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BillboardImageWithBlur } from '@/components/BillboardImageWithBlur';
import {
  Edit, Trash2, Copy, Printer, FileOutput, Calendar, Building, User, Phone,
  Wrench, TrendingUp, Layers, FileSpreadsheet, PaintBucket, Ruler, ImageIcon,
} from 'lucide-react';

interface OfferCardProps {
  offer: any;
  customerInfo?: { company?: string; phone?: string } | null;
  currencySymbol: string;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onPrint: () => void;
  onPrintAll: () => void;
  onConvert: () => void;
  onExportExcel?: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
  /** horizontal: الصور بجانب التفاصيل (نفس تخطيط كرت العقد) */
  layout?: 'horizontal' | 'vertical';
}

const STATUS_RING: Record<string, string> = {
  approved: 'border-emerald-500/30',
  converted: 'border-blue-500/30',
  rejected: 'border-rose-500/30',
};

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('ar') : '—');

export function OfferCard({
  offer, customerInfo, currencySymbol, onEdit, onDelete, onCopy, onPrint, onPrintAll, onConvert, onExportExcel, getStatusBadge,
  layout = 'vertical',
}: OfferCardProps) {
  const H = layout === 'horizontal';

  const billboardsData: any[] = (() => {
    try { return JSON.parse(offer.billboards_data || '[]'); } catch { return []; }
  })();
  const sizes = [...new Set(billboardsData.map((b: any) => b.Size || b.size).filter(Boolean))] as string[];
  const preview = billboardsData.slice(0, 4);
  const count = offer.billboards_count ?? billboardsData.length;
  const total = Number(offer.total) || 0;
  const installation = Number(offer.installation_cost) || 0;
  const print = offer.print_cost_enabled ? Number(offer.print_cost) || 0 : 0;
  const operating = Number(offer.operating_fee) || 0;
  const discount = Number(offer.discount) || 0;
  const money = (v: number) => v.toLocaleString('ar-LY');
  const phone = customerInfo?.phone;
  const company = customerInfo?.company;

  /** الرقم والزبون: فوق الصورة في البطاقة العرضية، وفي التفاصيل في الطولية */
  const identity = (
    <>
        <div className={cn('flex items-baseline justify-between gap-3')}>
          <span dir="ltr" className="font-manrope text-2xl font-extrabold leading-none tabular-nums text-foreground">#{offer.offer_number}</span>
          <span className="text-xs text-muted-foreground">عرض سعر</span>
        </div>

        {/* الزبون والشركة */}
        <div className={cn('space-y-1')}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="shrink-0 rounded-lg bg-primary/10 p-1.5 text-primary"><User className="h-4 w-4" /></div>
              <h3 className="truncate text-base font-bold text-foreground">{offer.customer_name}</h3>
            </div>
            {phone && (
              <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()} dir="ltr"
                className="flex shrink-0 items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 font-manrope text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
                <Phone className="h-3 w-3" /><span>{phone}</span>
              </a>
            )}
          </div>
          {company && (
            <div className="mr-7 flex items-center gap-1.5 text-xs">
              <Building className="h-3.5 w-3.5 shrink-0 text-primary/80" />
              <span className="truncate font-semibold text-muted-foreground">{company}</span>
            </div>
          )}
        </div>

    </>
  );

  return (
    <Card
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground transition-[border-color,box-shadow,transform] duration-200 hover:shadow-xl hover:shadow-primary/5 motion-safe:hover:-translate-y-0.5',
        STATUS_RING[offer.status] || 'border-border/60',
        H && 'md:flex-row',
      )}
    >
      {/* صور اللوحات */}
      <div className={cn('flex-shrink-0 p-3 pb-0', H && 'md:w-[52%] md:pb-3 md:pe-0')}>
        {H && <div className="mb-3 space-y-2 px-1">{identity}</div>}
        <div className={cn('relative w-full overflow-hidden rounded-xl border border-border/50 bg-muted/20', preview.length || H ? 'aspect-[8/3]' : 'h-14')}>
          {preview.length > 0 ? (
            <div className={cn('grid h-full w-full gap-0.5', ['grid-cols-1', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'][preview.length])}>
              {preview.map((b: any, idx: number) => (
                <div key={idx} className="relative min-h-0 overflow-hidden">
                  <BillboardImageWithBlur
                    billboard={{
                      Image_URL: b.Image_URL || b.image_url || b.image,
                      Billboard_Name: b.Billboard_Name || b.name,
                      image_name: b.image_name,
                    }}
                    className="h-full w-full"
                    alt={b.Billboard_Name || b.name || 'لوحة'}
                  />
                  {idx === 3 && billboardsData.length > 4 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <span className="font-manrope text-lg font-bold text-white">+{billboardsData.length - 4}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center gap-2 text-muted-foreground/60">
              <ImageIcon className="h-4 w-4" />
              <span className="text-xs">لا توجد لوحات</span>
            </div>
          )}
          <div className="absolute left-2.5 top-2.5 z-10">{getStatusBadge(offer.status)}</div>
          {count > 0 && (
            <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-lg bg-black/80 px-2.5 py-1 text-xs font-bold text-white">
              <Layers className="h-3 w-3" /><span className="font-manrope tabular-nums">{count}</span> لوحة
            </div>
          )}
        </div>
      </div>

      <CardContent className={cn('flex flex-grow flex-col justify-between space-y-3 p-4', H && 'min-w-0')}>
        {!H && identity}
        {/* نوع الإعلان والمقاسات */}
        <div className={cn('flex items-center justify-between gap-2.5 border-t border-border/50 pt-3')}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <PaintBucket className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-bold text-foreground">{offer.ad_type || 'عرض سعر'}</span>
          </div>
          {sizes.length > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              <Ruler className="h-3 w-3 text-muted-foreground" />
              {sizes.slice(0, 3).map((s) => (
                <Badge key={s} variant="outline" dir="ltr" className="border-border/60 bg-muted/50 px-1.5 py-0 font-manrope text-[11px] font-semibold text-foreground/80">{s}</Badge>
              ))}
              {sizes.length > 3 && <Badge variant="outline" className="px-1.5 py-0 text-[11px]">+{sizes.length - 3}</Badge>}
            </div>
          )}
        </div>

        {/* التواريخ */}
        <div className={cn('flex items-center justify-between gap-2 text-xs')}>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            من <span className="font-manrope font-semibold tabular-nums text-foreground">{fmtDate(offer.start_date)}</span>
          </span>
          <span className="text-muted-foreground">{offer.duration_label || (offer.duration_months ? `${offer.duration_months} شهر` : '')}</span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            إلى <span className="font-manrope font-semibold tabular-nums text-foreground">{fmtDate(offer.end_date)}</span>
          </span>
        </div>

        {/* المبالغ */}
        <div className={cn('space-y-3 rounded-xl bg-muted/30 p-3.5')}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">إجمالي العرض</span>
            <span className="font-manrope text-lg font-extrabold tabular-nums text-primary">{money(total)} <span className="text-xs">{currencySymbol}</span></span>
          </div>
          <dl className="grid grid-cols-3 gap-2 border-t border-border/50 pt-2.5">
            <div>
              <dt className="flex items-center gap-1 text-[11px] text-muted-foreground"><Wrench className="h-3 w-3" />التركيب</dt>
              <dd className={cn('font-manrope text-sm font-bold tabular-nums', offer.installation_enabled === false ? 'text-muted-foreground line-through' : 'text-foreground')}>{money(installation)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-[11px] text-muted-foreground"><Printer className="h-3 w-3" />الطباعة</dt>
              <dd className="font-manrope text-sm font-bold tabular-nums text-foreground">{money(print)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-[11px] text-muted-foreground"><TrendingUp className="h-3 w-3" />التشغيل{offer.operating_fee_rate ? ` ${offer.operating_fee_rate}%` : ''}</dt>
              <dd className="font-manrope text-sm font-bold tabular-nums text-foreground">{money(operating)}</dd>
            </div>
          </dl>
          {discount > 0 && (
            <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
              <span className="text-rose-500">التخفيض</span>
              <span className="font-manrope font-bold text-rose-500">-{money(discount)}</span>
            </div>
          )}
        </div>

        {/* الإجراءات */}
        <div className={cn('space-y-2 border-t border-border/50 pt-3')}>
          <div className="flex gap-2">
            <Button onClick={onPrint} className="h-10 flex-1 rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90">
              <Printer className="ml-1 h-4 w-4 shrink-0" />طباعة العرض
            </Button>
            <Button onClick={onEdit} variant="outline" className="h-10 flex-1 rounded-lg border-border/60 text-sm font-bold hover:bg-muted">
              <Edit className="ml-1 h-4 w-4 shrink-0" />تعديل العرض
            </Button>
            <Button onClick={onConvert} disabled={offer.status === 'converted'} variant="outline" size="icon" title="تحويل لعقد"
              className="h-10 w-10 shrink-0 rounded-xl border-border text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-40">
              <FileOutput className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Button size="sm" variant="outline" onClick={onPrintAll} className="h-9 gap-1 rounded-lg border-border/60 text-xs font-bold">
              <Printer className="h-3.5 w-3.5" />طباعة التركيب
            </Button>
            {onExportExcel ? (
              <Button size="sm" variant="outline" onClick={onExportExcel} className="h-9 gap-1 rounded-lg border-border/60 text-xs font-bold">
                <FileSpreadsheet className="h-3.5 w-3.5" />Excel
              </Button>
            ) : <span />}
            <Button size="sm" variant="outline" onClick={onCopy} className="h-9 gap-1 rounded-lg border-border/60 text-xs font-bold">
              <Copy className="h-3.5 w-3.5" />نسخ
            </Button>
            <Button size="sm" variant="outline" onClick={onDelete} className="h-9 gap-1 rounded-lg border-border/60 text-xs font-bold text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />حذف
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
