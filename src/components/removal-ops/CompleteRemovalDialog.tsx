import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/** تأكيد توثيق الإزالة: التاريخ وملاحظة اختيارية لعدد من اللوحات */
export function CompleteRemovalDialog({ open, count, subtitle, onOpenChange, onConfirm }: {
  open: boolean; count: number; subtitle?: string; onOpenChange: (o: boolean) => void;
  onConfirm: (date: string, notes: string) => Promise<void>;
}) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setDate(format(new Date(), 'yyyy-MM-dd')); setNotes(''); } }, [open]);
  const go = async () => {
    setBusy(true);
    try { await onConfirm(date, notes); onOpenChange(false); } catch { /* الخطأ يُعرض في onConfirm */ } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <DialogContent dir="rtl" className="max-w-md text-right">
        <DialogHeader className="text-right">
          <DialogTitle>توثيق إزالة {count} لوحة</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="removal-date">تاريخ الإزالة</Label><Input id="removal-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="removal-notes">ملاحظات (اختياري)</Label><Textarea id="removal-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">تصبح اللوحات متاحة وتُفرَّغ من بيانات العقد بعد التأكيد.</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>إلغاء</Button>
          <Button onClick={go} disabled={busy || !date || count === 0}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}تأكيد الإزالة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
