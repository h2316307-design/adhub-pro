import { Fragment, type ComponentType, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Check, MapPin } from 'lucide-react';

/**
 * الهيكل الموحد لكرت اللوحة في كل النظام:
 * رأس (الكود، المقاس، المستوى، الإجراءات) ← الصورة مع شارات الحالة ← العنوان وأقرب نقطة دالة
 * ← البلدية / المنطقة / المدينة ← محتوى خاص بالصفحة ← تذييل السعر.
 * صفحة اللوحات، اللوحات المتاحة، ولوحات العقد تستخدم الهيكل نفسه وتختلف في الإجراءات فقط.
 */

export type CardTone = 'default' | 'selected' | 'locked' | 'danger' | 'renewed' | 'replacement';

const TONE: Record<CardTone, string> = {
  default: 'border-border hover:border-primary/40',
  selected: 'border-primary ring-2 ring-primary/30',
  locked: 'border-rose-500/30 hover:border-amber-400/60',
  danger: 'border-destructive ring-2 ring-destructive/30',
  renewed: 'border-emerald-500/40',
  replacement: 'border-primary ring-2 ring-primary/40',
};

export type StatusKind = 'available' | 'soon' | 'rented' | 'maintenance' | 'locked' | 'unlocked' | 'info' | 'warning';

const STATUS: Record<StatusKind, string> = {
  available: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60',
  soon: 'bg-amber-950/90 text-amber-300 border-amber-500/60',
  rented: 'bg-rose-950/90 text-rose-300 border-rose-500/60',
  maintenance: 'bg-amber-950/90 text-amber-300 border-amber-500/60',
  locked: 'bg-rose-700 text-white border-rose-400/80 hover:bg-amber-600',
  unlocked: 'bg-emerald-700 text-white border-emerald-400/80',
  info: 'bg-black/75 text-white border-white/20',
  warning: 'bg-amber-600/90 text-white border-amber-400/40',
};

export function CardStatusBadge({ kind, label, icon: Icon, onClick, title }: {
  kind: StatusKind; label: ReactNode; icon?: ComponentType<{ className?: string }>; onClick?: (e: MouseEvent) => void; title?: string;
}) {
  return (
    <span
      onClick={onClick}
      title={title}
      className={cn('pointer-events-auto inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold shadow-md backdrop-blur-sm',
        STATUS[kind], onClick && 'cursor-pointer')}
    >
      {Icon && <Icon className="h-3 w-3" />}{label}
    </span>
  );
}

export function CardIconButton({ icon: Icon, onClick, title, tone = 'default', active }: {
  icon: ComponentType<{ className?: string }>; onClick: (e: MouseEvent) => void; title: string;
  tone?: 'default' | 'primary' | 'warning' | 'danger'; active?: boolean;
}) {
  const tones = {
    default: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    primary: 'text-primary hover:bg-primary/10',
    warning: 'text-amber-500 hover:bg-amber-500/10',
    danger: 'text-destructive hover:bg-destructive/10',
  };
  return (
    <button type="button" title={title} aria-label={title}
      onClick={e => { e.stopPropagation(); onClick(e); }}
      className={cn('inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        tones[tone], active && 'bg-muted')}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Chip({ children, onClick, title, strong }: { children: ReactNode; onClick?: () => void; title?: string; strong?: boolean }) {
  return (
    <span
      onClick={onClick ? (e => { e.stopPropagation(); onClick(); }) : undefined}
      title={title}
      className={cn('inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-xs font-semibold',
        strong ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-muted/40 text-foreground/85',
        onClick && 'cursor-pointer hover:border-primary/60 hover:text-primary')}
    >
      {children}
    </span>
  );
}

export function BillboardCardFrame({
  tone = 'default', onClick, code, size, onSizeClick, level, faces, headerExtra, headerActions, banner,
  image, imageHeight = 'aspect-[16/10]', statusBadges, selectMark, imageOverlayBottom,
  title, landmark, municipality, district, city, onMunicipalityClick, onDistrictClick, onCityClick, billboardType, compact = false, managementLayout = false, onLevelClick,
  children, priceLabel, price, priceTone = 'primary', footer, after, className, style, dimmed, horizontal = false, imageAspect, sideExtra,
}: {
  /** بالعرض مع نسبة ثابتة: محتوى إضافي تحت الصورة في العمود الجانبي (مثل التصميم) */
  sideExtra?: ReactNode;
  /** نسبة ثابتة للصورة في الوضعين (مثل aspect-[8/3]) */
  imageAspect?: string;
  /** بطاقة بالعرض: الصورة في جانب والتفاصيل بجانبها (عرض الصورة من --img-w) */
  horizontal?: boolean;
  tone?: CardTone;
  onClick?: () => void;
  code: string;
  size?: string;
  onSizeClick?: () => void;
  level?: string;
  faces?: string;
  headerExtra?: ReactNode;
  headerActions?: ReactNode;
  banner?: ReactNode;
  image: ReactNode;
  imageHeight?: string;
  statusBadges?: ReactNode;
  /** null = لا تظهر علامة الاختيار، true/false = حالة الاختيار */
  selectMark?: boolean | null;
  imageOverlayBottom?: ReactNode;
  title: string;
  billboardType?: string;
  compact?: boolean;
  managementLayout?: boolean;
  onLevelClick?: () => void;
  landmark?: string | null;
  municipality?: string;
  district?: string;
  city?: string;
  onMunicipalityClick?: () => void;
  onDistrictClick?: () => void;
  onCityClick?: () => void;
  children?: ReactNode;
  priceLabel?: string;
  price?: ReactNode;
  priceTone?: 'primary' | 'good';
  footer?: ReactNode;
  after?: ReactNode;
  className?: string;
  style?: CSSProperties;
  dimmed?: boolean;
}) {
  const displayTitle = managementLayout ? code : title;
  const displayLandmark = managementLayout ? (landmark || (title !== code ? title : null)) : landmark;
  const imageBox = (
    <div className={cn('relative shrink-0 overflow-hidden bg-muted/40', horizontal
      ? (imageAspect ? cn('w-full flex-1 rounded-xl border border-border/60', imageAspect) : 'min-h-[calc(var(--img-w,260px)*0.75)] w-[var(--img-w,260px)] self-stretch border-l border-border/60')
      : cn('w-full border-y border-border/60', imageAspect || imageHeight))}>
      {horizontal ? <div className="absolute inset-0">{image}</div> : image}
      {statusBadges && <div className="pointer-events-none absolute right-3 top-3 z-10 flex max-w-[80%] flex-col items-end gap-1">{statusBadges}</div>}
      {selectMark !== null && selectMark !== undefined && <span className={cn('absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm backdrop-blur-sm', selectMark ? 'border-primary bg-primary text-primary-foreground' : 'border-white/30 bg-black/50 text-white/60')}><Check className="h-4 w-4" /></span>}
      {imageOverlayBottom}
    </div>
  );
  /** بالعرض مع نسبة ثابتة: الرأس والعنوان والصورة والتصميم في العمود الجانبي، والتفاصيل في الآخر */
  const sided = horizontal && !!imageAspect;
  const headerEl = (
      <header className="billboard-card-header flex min-h-12 items-center justify-between gap-2 px-3.5 py-2">
        {managementLayout ? (
          <div className="billboard-management-specs flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <span
              dir="ltr"
              onClick={onSizeClick ? (e => { e.stopPropagation(); onSizeClick(); }) : undefined}
              className={cn(
                'billboard-management-size shrink-0 font-manrope text-xl font-black leading-none tracking-tight text-primary',
                onSizeClick && 'cursor-pointer hover:underline'
              )}
              title={onSizeClick ? `تصفية بالمقاس ${size}` : undefined}
              aria-label={`المقاس ${size || 'غير محدد'}`}
            >
              {size || '—'}
            </span>

            {faces && (
              <span className="shrink-0 text-xs font-semibold text-foreground/85" aria-label={`عدد الأوجه: ${faces}`}>
                {faces}
              </span>
            )}

            {level && (
              onLevelClick ? (
                <button
                  type="button"
                  onClick={event => { event.stopPropagation(); onLevelClick(); }}
                  className="inline-flex h-5 min-w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border border-primary/30 bg-primary/10 px-1.5 font-manrope text-[11px] font-bold text-primary transition-all duration-200 hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary"
                  title="تعديل مستوى اللوحة"
                  aria-label="تعديل مستوى اللوحة"
                >
                  {level}
                </button>
              ) : (
                <span
                  className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-muted px-1.5 font-manrope text-[11px] font-bold text-muted-foreground"
                  aria-label={`المستوى ${level}`}
                >
                  {level}
                </span>
              )
            )}

            {billboardType && (
              <span
                className="truncate rounded-md bg-muted/60 border border-border/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                title={`نوع اللوحة: ${billboardType}`}
                aria-label={`نوع اللوحة: ${billboardType}`}
              >
                {billboardType}
              </span>
            )}

            {headerExtra && <div className="flex shrink-0 items-center gap-1">{headerExtra}</div>}
          </div>
        ) : (
          <div className="min-w-0">
            <span className="mb-0.5 block text-[10px] font-medium text-muted-foreground">اللوحة</span>
            <span className="block truncate font-manrope text-sm font-bold tracking-wide text-foreground" title={code}>
              {code}
            </span>
          </div>
        )}
        {headerActions && <div className="flex shrink-0 items-center gap-1">{headerActions}</div>}
      </header>
  );
  const titleBlock = (
        <div className="min-w-0 space-y-2">
          <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><h4 className="min-w-0 flex-1 break-words text-sm font-semibold leading-relaxed text-foreground">{displayTitle}</h4></div>{!managementLayout && billboardType && <span className="max-w-[40%] truncate rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground" title={billboardType}>{billboardType}</span>}</div>
          {displayLandmark && displayLandmark !== displayTitle && <p className="flex items-start gap-1.5 text-[15px] font-bold leading-relaxed text-foreground"><MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" /><span className="break-words">{displayLandmark}</span></p>}
          {(municipality || district || city) && <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {municipality && <Chip onClick={onMunicipalityClick} title="البلدية">{municipality}</Chip>}
            {district && district !== municipality && <Chip onClick={onDistrictClick} title="المنطقة">{district}</Chip>}
            {city && city !== district && city !== municipality && <Chip onClick={onCityClick} title="المدينة">{city}</Chip>}
          </div>}
        </div>
  );
  const Shell = horizontal ? 'div' : Fragment;
  return (
    <article dir="rtl" onClick={onClick} style={style}
      className={cn('group relative flex min-w-0 overflow-hidden rounded-2xl border bg-card text-right shadow-sm motion-safe:transition-all motion-safe:duration-200 hover:shadow-md', horizontal ? 'flex-row' : 'flex-col', TONE[tone], onClick && 'cursor-pointer', dimmed && 'opacity-90', className)}>
      {horizontal && (imageAspect
        ? <div className="flex w-1/2 shrink-0 flex-col gap-2 border-l border-border/60 pb-2.5">{headerEl}<div className="flex flex-1 flex-col gap-2 px-2.5">{titleBlock}{imageBox}{sideExtra}</div></div>
        : imageBox)}
      <Shell {...(horizontal ? { className: 'flex min-w-0 flex-1 flex-col' } : {})}>
      {!sided && headerEl}
      {banner}
      {!horizontal && imageBox}
      {!managementLayout && (size || level || faces || headerExtra) && <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border/60 bg-muted/20 px-4 py-2 text-xs">
        {size && <button type="button" dir="ltr" disabled={!onSizeClick} onClick={e => { e.stopPropagation(); onSizeClick?.(); }} title={onSizeClick ? `تصفية بالمقاس ${size}` : 'مقاس اللوحة'} className={cn('rounded-md bg-primary/10 px-2 py-1 font-manrope text-xs font-bold text-primary transition-all duration-200 disabled:cursor-default', onSizeClick && 'cursor-pointer hover:bg-primary/20')}>{size}</button>}
        {level && <span className="text-muted-foreground">مستوى <b className="font-semibold text-foreground">{level}</b></span>}
        {faces && <span className="text-muted-foreground">{faces}</span>}
        {headerExtra}
      </div>}
      <div className={cn('billboard-card-body flex min-w-0 flex-1 flex-col', horizontal ? (sided ? 'gap-2.5 p-3' : 'gap-2 px-3 pb-3 pt-1') : 'p-4', !horizontal && (compact ? 'gap-3' : 'gap-4'))}>
        {!sided && titleBlock}
        {children}
      </div>
      {price !== undefined && price !== null && <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-3"><span className="text-xs text-muted-foreground">{priceLabel || 'السعر'}</span><span className={cn('font-manrope text-base font-bold tabular-nums', priceTone === 'good' ? 'text-emerald-500' : 'text-primary')}>{price}</span></footer>}
      {footer}
      </Shell>
      {after}
    </article>
  );
}

/** قراءة الحقول بأسمائها المختلفة في الجداول */
export function billboardFields(b: any) {
  const id = Number(b?.ID ?? b?.id);
  const code = b?.code || b?.Code || `TR-${String(id).padStart(4, '0')}`;
  const rawName = String(b?.name || b?.Billboard_Name || '').trim();
  const landmark = String(b?.location || b?.Nearest_Landmark || b?.Nearest_landmark || '').trim();
  const isCodeOnly = !rawName || rawName.toLowerCase() === String(code).toLowerCase() || (rawName.startsWith('TR-') && rawName.length <= 12);
  const facesRaw = String(b?.Faces_Count || b?.faces_count || b?.Faces || '');
  return {
    id,
    code,
    title: isCodeOnly ? (landmark || 'لوحة إعلانية') : rawName,
    landmark: isCodeOnly ? null : (landmark && landmark !== rawName ? landmark : null),
    size: b?.Size || b?.size || '',
    level: b?.Level || b?.level || '',
    faces: facesRaw === '2' ? 'وجهين' : facesRaw === '1' ? 'وجه واحد' : facesRaw ? `${facesRaw} أوجه` : '',
    municipality: b?.municipality || b?.Municipality || b?.Municipality_Name || '',
    district: b?.district || b?.District || b?.area || b?.Area || '',
    city: b?.city || b?.City || b?.City_Name || '',
  };
}
