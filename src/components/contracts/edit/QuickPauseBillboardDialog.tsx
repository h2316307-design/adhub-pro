import { InstantBillboardSwapDialog } from './InstantBillboardSwapDialog';
import { supabase } from '@/integrations/supabase/client';
import { parsePriceSnapshot, priceId, type ContractPriceSnapshot } from '@/utils/contractEditMoney';
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PauseCircle, Loader2 } from 'lucide-react';
import { calculateRemainingBillboardValue } from '@/utils/contractBillboardCalculations';
import { executeQuickPause } from '@/services/contractBillboardSwapService';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  billboard: {
    ID: number | string;
    Billboard_Name?: string | null;
    Size?: string | null;
    City?: string | null;
    Rent_Start_Date?: string | null;
    Rent_End_Date?: string | null;
  };
  contractNumber: number;
  contractStartDate: string;
  contractEndDate: string;
  contractedPrice?: number;
  onPaused?: (result: { pauseRefund: number; newBillboardIds: string[] }) => void;
}

type SavedPausePrice = ContractPriceSnapshot & {
  currency: string;
  start: string;
  end: string;
  revision: number;
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'حدث خطأ غير متوقع';

export function QuickPauseBillboardDialog({
  open,
  onOpenChange,
  billboard,
  contractNumber,
  contractStartDate,
  contractEndDate,
  contractedPrice,
  onPaused,
}: Props) {
  const todayStr = new Date().toISOString().split('T')[0];
  const initialPauseDate = (todayStr >= contractStartDate && todayStr <= contractEndDate)
    ? todayStr
    : contractStartDate || todayStr;

  const [pauseDate, setPauseDate] = useState(initialPauseDate);
  const [notes, setNotes] = useState('');
  const [physicallyRemoved, setPhysicallyRemoved] = useState(false);
  const [resolution, setResolution] = useState<'refund' | 'replace'>('refund');
  const [swapOpen, setSwapOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const [saved, setSaved] = useState<SavedPausePrice | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setPhysicallyRemoved(false); setSaved(null); setResolution('refund'); setNotes(''); setSwapOpen(false);
    (async () => {
      const { data, error } = await supabase.from('Contract').select('*').eq('Contract_Number', contractNumber).single();
      if (!active) return;
      if (error) { toast.error('تعذر تحميل السعر المحفوظ'); return; }
      const contractRecord = data as unknown as Record<string, unknown>;
      const price = parsePriceSnapshot(data.billboard_prices).find(p => priceId(p) === String(billboard.ID));
      if (!price) { toast.error('احفظ سعر اللوحة قبل إيقافها'); return; }
      const start = String(price.startDate || billboard.Rent_Start_Date || data['Contract Date']);
      const end = String(price.endDate || billboard.Rent_End_Date || data['End Date']);
      setSaved({ ...price,
        printCost: ['true', '1'].includes(String(data.print_cost_enabled)) ? Number(price.printCost || 0) : 0,
        installationCost: !['false', '0'].includes(String(data.installation_enabled)) ? Number(price.installationCost || 0) : 0,
        currency: String(contractRecord.contract_currency || price.currency || 'LYD'), start, end, revision: Number(contractRecord.edit_revision || 0) });
      setPauseDate(todayStr >= start && todayStr <= end ? todayStr : start);
    })();
    return () => { active = false; };
  }, [open, contractNumber, billboard.ID, billboard.Rent_Start_Date, billboard.Rent_End_Date, todayStr]);
  const currencySymbol = ({ LYD: 'د.ل', USD: '$', EUR: '€' } as Record<string, string>)[saved?.currency] || saved?.currency || 'د.ل';
  const effectivePrice = Number(saved?.finalPrice ?? saved?.priceAfterDiscount ?? saved?.contractPrice ?? 0);

  const remainingCalc = useMemo(() => {
    return calculateRemainingBillboardValue({
      startDate: saved?.start,
      endDate: saved?.end,
      effectiveDate: pauseDate,
      contractedPrice: effectivePrice,
      printCost: Number(saved?.printCost || 0),
      installCost: Number(saved?.installationCost || 0),
    });
  }, [saved, pauseDate, effectivePrice]);

  const handleExecute = async () => {
    if (!billboard || !saved || isExecuting || !pauseDate || pauseDate < saved.start || pauseDate > saved.end) return;

    if (physicallyRemoved && !notes.trim()) { toast.error('أدخل سبب الإزالة الفعلية لتسجيله في العقد'); return; }
    setIsExecuting(true);
    try {
      const result = await executeQuickPause({
        contractNumber,
        billboardId: Number(billboard.ID),
        pauseDate,
        expectedRevision: saved.revision,
        notes: physicallyRemoved ? `[PHYSICAL_REMOVAL] تمت إزالة اللوحة من الموقع بسبب ظروف قاهرة بتاريخ ${pauseDate}. السبب: ${notes.trim()}` : notes.trim() || undefined,
      });

      if (result.success) {
        toast.success(`تم إيقاف اللوحة #${billboard.ID} بنجاح وخصم المسترجع (${Math.round(result.pauseRefund).toLocaleString('ar-LY')} ${currencySymbol}) من العقد`);
        onOpenChange(false);
        if (onPaused) {
          onPaused(result);
        }
      } else {
        toast.error(result.error || 'تعذر إيقاف اللوحة');
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <>
    <InstantBillboardSwapDialog open={swapOpen} onOpenChange={setSwapOpen} originalBillboard={billboard}
      contractNumber={contractNumber} contractStartDate={saved?.start || contractStartDate} contractEndDate={saved?.end || contractEndDate}
      onSwapped={() => { setSwapOpen(false); onOpenChange(false); onPaused?.({ pauseRefund: 0, newBillboardIds: [] }); }} />
    <Dialog open={open && !swapOpen} onOpenChange={v => { if (!isExecuting) onOpenChange(v); }}>
      <DialogContent className="max-w-md bg-background border-border" dir="rtl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-amber-500">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">إزالة اللوحة وتسوية العقد</DialogTitle>
              <p className="text-xs text-muted-foreground">
                اختر بديلة أو أبقِ اللوحة في سجل العقد كملغاة مع خصم الإيجار المتبقي دون بديل
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Billboard Info Card */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-foreground">{billboard?.Billboard_Name || `#${billboard?.ID}`}</span>
              <Badge variant="outline" className="text-[11px]">{billboard?.Size} • {billboard?.City}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 text-muted-foreground">
              <div>السعر الإجمالي: <strong className="text-foreground">{Math.round(effectivePrice).toLocaleString('ar-LY')} {currencySymbol}</strong></div>
              <div>الأيام المتبقية: <strong className="text-foreground">{remainingCalc.remainingDays} يوم</strong></div>
            </div>
          </div>

          <label className="flex gap-2 items-start rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm cursor-pointer">
            <input type="checkbox" checked={physicallyRemoved} onChange={e => { setPhysicallyRemoved(e.target.checked); if(e.target.checked) setResolution('refund'); }} />
            <span>اللوحة أُزيلت فعلياً من الموقع بسبب ظروف قاهرة<span className="block text-xs text-muted-foreground mt-1">تسجيل الواقعة وتاريخها وسببها ضمن سجل العقد. يمكنك تخصيص بديل من بطاقة اللوحة بعد التسجيل.</span></span>
          </label>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="معالجة اللوحة بعد الإزالة">
            <Button variant={resolution === 'refund' ? 'default' : 'outline'} className="h-auto min-h-12 whitespace-normal cursor-pointer transition-all duration-200" onClick={() => setResolution('refund')}>دون بديل وخصم القيمة</Button>
            <Button variant={resolution === 'replace' ? 'default' : 'outline'} className="h-auto min-h-12 whitespace-normal cursor-pointer transition-all duration-200" disabled={physicallyRemoved} onClick={() => setResolution('replace')}>اختيار لوحة بديلة</Button>
          </div>
          <p className="text-xs text-muted-foreground">{resolution === 'replace' ? 'تُحفظ اللوحة الأصلية في السجل، وتُنقل قيمة المدة المتبقية إلى البديلة وفق تسوية الاستبدال.' : 'تُستبعد اللوحة من اللوحات النشطة وتبقى في السجل؛ يُخصم الإيجار غير المستهلك وتبقى خدمات التركيب والطباعة المنفذة محسوبة.'} {physicallyRemoved ? 'ستُحفظ واقعة الإزالة الفعلية في العقد.' : 'الإزالة الفعلية تُوثّق عند إتمام مهمة الإزالة.'}</p>
          {resolution === 'refund' && <>
          {/* Pause Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">تاريخ إنهاء احتساب إيجار اللوحة:</Label>
            <Input
              type="date"
              value={pauseDate}
              min={saved?.start}
              max={saved?.end}
              onChange={(e) => setPauseDate(e.target.value)}
              className="text-xs bg-background"
            />
          </div>

          </>}
          {/* Financial Refund Preview */}
          <div className="p-3 rounded-lg bg-primary/10 border border-emerald-500/20 text-xs space-y-1">
            <div className="flex justify-between items-center text-emerald-500 font-bold">
              <span>{resolution === 'refund' ? 'قيمة الخصم من العقد:' : 'قيمة المدة المتبقية للتسوية:'}</span>
              <span className="text-sm">{Math.round(remainingCalc.remainingValue).toLocaleString('ar-LY')} {currencySymbol}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground text-[11px] pt-1">
              <span>المبلغ المستهلك للأيام المنقضية ({remainingCalc.elapsedDays} يوم):</span>
              <span>{Math.round(remainingCalc.consumedValue).toLocaleString('ar-LY')} {currencySymbol}</span>
            </div>
          </div>

          {resolution === 'refund' && <>
          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{physicallyRemoved ? 'سبب الإزالة بسبب الظروف القاهرة (مطلوب):' : 'سبب إزالة اللوحة (اختياري):'}</Label>
            <Textarea
              placeholder="اكتب ملاحظات إن وجدت..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-xs bg-background resize-none"
            />
          </div>
          </>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isExecuting} className="min-h-10 cursor-pointer transition-all duration-200">
            إلغاء
          </Button>
          <Button
            size="sm"
            onClick={() => resolution === 'replace' ? setSwapOpen(true) : handleExecute()}
            disabled={isExecuting || !saved || !pauseDate || pauseDate < saved.start || pauseDate > saved.end}
            className="min-h-10 cursor-pointer bg-amber-500 text-white font-bold transition-all duration-200 hover:bg-amber-600 active:scale-95"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin ml-1.5" />
                <span>جاري الإيقاف...</span>
              </>
            ) : (
              <span>{resolution === 'replace' ? 'متابعة واختيار البديلة' : 'تأكيد الإزالة وخصم القيمة'}</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
