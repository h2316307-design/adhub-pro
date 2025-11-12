import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface TaskCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (result: 'completed' | 'not_completed', notes: string, reason?: string) => void;
}

export function TaskCompletionDialog({ open, onOpenChange, onComplete }: TaskCompletionDialogProps) {
  const [result, setResult] = useState<'completed' | 'not_completed'>('completed');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    onComplete(result, notes, result === 'not_completed' ? reason : undefined);
    setResult('completed');
    setNotes('');
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إتمام المهمة</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>حالة الإنجاز</Label>
            <RadioGroup value={result} onValueChange={(v) => setResult(v as any)} className="mt-2">
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="completed" id="completed" />
                <Label htmlFor="completed" className="cursor-pointer">تم الإنجاز</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="not_completed" id="not_completed" />
                <Label htmlFor="not_completed" className="cursor-pointer">لم يتم الإنجاز</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>ملاحظات الإنجاز</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب ما حصل في المهمة..."
              rows={3}
            />
          </div>

          {result === 'not_completed' && (
            <div>
              <Label>سبب عدم الإنجاز *</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اذكر السبب..."
                rows={2}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit}>
              حفظ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}