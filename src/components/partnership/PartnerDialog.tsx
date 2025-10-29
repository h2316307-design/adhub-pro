import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface PartnerDialogProps {
  trigger?: React.ReactNode;
  partner?: { id?: string; name: string; phone?: string | null } | null;
  onSaved?: () => void;
}

export function PartnerDialog({ trigger, partner, onSaved }: PartnerDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultPre, setDefaultPre] = useState<number>(35);
  const [defaultPost, setDefaultPost] = useState<number>(50);
  const [defaultCapital, setDefaultCapital] = useState<number>(0);
  const isEdit = Boolean(partner?.id);

  useEffect(() => {
    const loadDefaults = async () => {
      if (!partner?.id) return;
      const { data } = await supabase.from('partners').select('default_partner_pre_pct, default_partner_post_pct, default_capital_contribution').eq('id', partner.id).single();
      if (data) {
        setDefaultPre(Number(data.default_partner_pre_pct ?? 35));
        setDefaultPost(Number(data.default_partner_post_pct ?? 50));
        setDefaultCapital(Number(data.default_capital_contribution ?? 0));
      }
    };
    if (open) {
      setName(partner?.name || '');
      setPhone(partner?.phone || '');
      setDefaultPre(35); setDefaultPost(50); setDefaultCapital(0);
      if (isEdit) loadDefaults();
    }
  }, [open, partner, isEdit]);

  const save = async () => {
    const payload: any = {
      name: name.trim(),
      phone: phone.trim() || null,
      default_partner_pre_pct: Number(defaultPre||0),
      default_partner_post_pct: Number(defaultPost||0),
      default_capital_contribution: Number(defaultCapital||0),
    };
    if (!payload.name) { toast.error('الاسم مطلوب'); return; }
    if (payload.default_partner_pre_pct < 0 || payload.default_partner_post_pct < 0) { toast.error('النِسب يجب أن تكون موجبة'); return; }
    if (payload.default_partner_pre_pct > 100 || payload.default_partner_post_pct > 100) { toast.error('النِسب لا تتجاوز 100%'); return; }

    try {
      let error;
      if (isEdit) {
        ({ error } = await supabase.from('partners').update(payload).eq('id', partner!.id));
      } else {
        ({ error } = await supabase.from('partners').insert(payload));
      }
      if (error) throw error;
      toast.success(isEdit ? 'تم تحديث الشركة' : 'تمت إضافة الشركة');
      setOpen(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message || 'فشل الحفظ');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'تعديل شركة مشاركة' : 'إضافة شركة مشاركة'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>اسم الشركة</Label>
            <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="اسم الشركة" />
          </div>
          <div className="grid gap-2">
            <Label>رقم الهاتف</Label>
            <Input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="09XXXXXXXX" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>نسبة الشريك (الاسترداد)</Label>
              <Input type="number" value={defaultPre} onChange={(e)=>setDefaultPre(Number(e.target.value||0))} />
            </div>
            <div className="grid gap-2">
              <Label>نسبة الشريك (بعد السداد)</Label>
              <Input type="number" value={defaultPost} onChange={(e)=>setDefaultPost(Number(e.target.value||0))} />
            </div>
            <div className="grid gap-2">
              <Label>رأس المال الافتراضي</Label>
              <Input type="number" value={defaultCapital} onChange={(e)=>setDefaultCapital(Number(e.target.value||0))} />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="secondary" onClick={()=>setOpen(false)}>إلغاء</Button>
          <Button onClick={save}>{isEdit ? 'حفظ' : 'إضافة'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
