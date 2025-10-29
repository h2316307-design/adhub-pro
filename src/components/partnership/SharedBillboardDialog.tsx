import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';

interface PartnerRow {
  id: string; // partner id
  name: string;
  phone?: string | null;
  capital_contribution: number;
  capital_remaining: number;
  partner_pre_pct: number;
  partner_post_pct: number;
}

interface Props {
  trigger: React.ReactNode;
  billboard: any;
  onSaved?: () => void;
}

export function SharedBillboardDialog({ trigger, billboard, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [allPartners, setAllPartners] = useState<{ id: string; name: string; phone?: string | null; default_partner_pre_pct?: number; default_partner_post_pct?: number; default_capital_contribution?: number }[]>([]);
  const [rows, setRows] = useState<PartnerRow[]>([]);

  const [preCompanyPct, setPreCompanyPct] = useState<number>(35);
  const [preCapitalPct, setPreCapitalPct] = useState<number>(30);
  const [postCompanyPct, setPostCompanyPct] = useState<number>(50);

  const partnersPctSum = useMemo(()=> rows.reduce((s,r)=>s + (Number(r.partner_pre_pct)||0), 0), [rows]);
  const partnersPostPctSum = useMemo(()=> rows.reduce((s,r)=>s + (Number(r.partner_post_pct)||0), 0), [rows]);

  const load = async () => {
    try {
      const { data: partners } = await supabase.from('partners').select('id,name,phone,default_partner_pre_pct,default_partner_post_pct,default_capital_contribution').order('name');
      setAllPartners(partners || []);

      const { data: sbLinks } = await supabase
        .from('shared_billboards')
        .select('*')
        .eq('billboard_id', billboard.ID || billboard.id);

      if (Array.isArray(sbLinks) && sbLinks.length > 0) {
        const mapped: PartnerRow[] = sbLinks.map((r:any) => ({
          id: r.partner_company_id,
          name: partners?.find(p=>p.id===r.partner_company_id)?.name || '',
          phone: partners?.find(p=>p.id===r.partner_company_id)?.phone || null,
          capital_contribution: Number(r.capital_contribution||0),
          capital_remaining: Number((r.capital_remaining ?? r.capital_contribution ?? 0)),
          partner_pre_pct: Number(r.partner_pre_pct ?? 35),
          partner_post_pct: Number(r.partner_post_pct ?? 50),
        }));
        setRows(mapped);
        const any = sbLinks[0];
        setPreCompanyPct(Number(any.pre_company_pct ?? 35));
        setPreCapitalPct(Number(any.pre_capital_pct ?? 30));
        setPostCompanyPct(Number(any.post_company_pct ?? 50));
      } else {
        setRows([]);
        setPreCompanyPct(35); setPreCapitalPct(30); setPostCompanyPct(50);
      }
    } catch (e:any) {
      console.error(e);
      toast.error('فشل تحميل بيانات المشاركة');
    }
  };

  useEffect(()=>{ if (open) load(); }, [open]);

  const addRow = (partnerId: string) => {
    if (!partnerId) return;
    const p = allPartners.find(p=>p.id===partnerId);
    if (!p) return;
    if (rows.some(r=>r.id===partnerId)) { toast.error('تم إضافة الشريك بالفعل'); return; }
    setRows(r=>[...r, { id: p.id, name: p.name, phone: p.phone, capital_contribution: Number(p.default_capital_contribution||0), capital_remaining: Number(p.default_capital_contribution||0), partner_pre_pct: Number(p.default_partner_pre_pct ?? 35), partner_post_pct: Number(p.default_partner_post_pct ?? 50) }]);
  };

  const removeRow = (partnerId: string) => {
    setRows(r=>r.filter(x=>x.id!==partnerId));
  };

  const validate = () => {
    const preSum = preCompanyPct + partnersPctSum + preCapitalPct;
    const postSum = postCompanyPct + partnersPostPctSum;
    if (Math.round(preSum) !== 100) { toast.error(`نسب مرحلة الاسترداد يجب أن تساوي 100% (الحالي ${preSum}%)`); return false; }
    if (Math.round(postSum) !== 100) { toast.error(`نسب مرحلة الأرباح يجب أن تساوي 100% (الحالي ${postSum}%)`); return false; }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    try {
      const billboardId = billboard.ID || billboard.id;

      const { data: existing } = await supabase
        .from('shared_billboards')
        .select('id')
        .eq('billboard_id', billboardId);

      if (existing && existing.length > 0) {
        await supabase.from('shared_billboards').delete().eq('billboard_id', billboardId);
      }

      const inserts = rows.map(r => ({
        billboard_id: billboardId,
        partner_company_id: r.id,
        partnership_percentage: r.partner_post_pct, // legacy field
        capital_contribution: r.capital_contribution,
        capital_remaining: r.capital_remaining || r.capital_contribution,
        status: 'active',
        pre_company_pct: preCompanyPct,
        pre_capital_pct: preCapitalPct,
        post_company_pct: postCompanyPct,
        partner_pre_pct: r.partner_pre_pct,
        partner_post_pct: r.partner_post_pct,
      }));

      const { error } = await supabase.from('shared_billboards').insert(inserts);
      if (error) throw error;

      const totalCapital = rows.reduce((s,r)=>s + Number(r.capital_contribution||0), 0);
      const totalRemaining = rows.reduce((s,r)=>s + Number(r.capital_remaining||r.capital_contribution||0), 0);

      await supabase.from('billboards').update({
        is_partnership: true,
        partner_companies: rows.map(r=>r.name),
        capital: totalCapital,
        capital_remaining: totalRemaining,
      }).eq('ID', billboardId);

      toast.success('تم حفظ بيانات المشاركة');
      setOpen(false);
      onSaved?.();
    } catch (e:any) {
      console.error('save shared billboard', e);
      toast.error(e?.message || 'فشل الحفظ');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>إعداد مشاركة اللوحة: {billboard.Billboard_Name || billboard.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>نسبة الفارس (الاسترداد)</Label>
              <Input type="number" value={preCompanyPct} onChange={(e)=>setPreCompanyPct(Number(e.target.value||0))} />
            </div>
            <div className="grid gap-2">
              <Label>نسبة رأس المال (الاسترداد)</Label>
              <Input type="number" value={preCapitalPct} onChange={(e)=>setPreCapitalPct(Number(e.target.value||0))} />
            </div>
            <div className="grid gap-2">
              <Label>نسبة الفارس (بعد السداد)</Label>
              <Input type="number" value={postCompanyPct} onChange={(e)=>setPostCompanyPct(Number(e.target.value||0))} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 items-end">
            <div className="grid gap-2">
              <Label>إضافة شريك</Label>
              <Select onValueChange={addRow}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر شريكاً" />
                </SelectTrigger>
                <SelectContent>
                  {allPartners.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشريك</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>رأس المال</TableHead>
                  <TableHead>المتبقي</TableHead>
                  <TableHead>% شريك (الاسترداد)</TableHead>
                  <TableHead>% شريك (بعد السداد)</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.phone || '-'}</TableCell>
                    <TableCell>
                      <Input type="number" value={r.capital_contribution}
                        onChange={(e)=>setRows(rs=>rs.map(x=>x.id===r.id?{...x, capital_contribution:Number(e.target.value||0)}:x))} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={r.capital_remaining}
                        onChange={(e)=>setRows(rs=>rs.map(x=>x.id===r.id?{...x, capital_remaining:Number(e.target.value||0)}:x))} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={r.partner_pre_pct}
                        onChange={(e)=>setRows(rs=>rs.map(x=>x.id===r.id?{...x, partner_pre_pct:Number(e.target.value||0)}:x))} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={r.partner_post_pct}
                        onChange={(e)=>setRows(rs=>rs.map(x=>x.id===r.id?{...x, partner_post_pct:Number(e.target.value||0)}:x))} />
                    </TableCell>
                    <TableCell>
                      <Button variant="destructive" size="sm" onClick={()=>removeRow(r.id)}>حذف</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <div>مجموع نسب الاسترداد = الفارس {preCompanyPct}% + الشركاء {partnersPctSum}% + رأس المال {preCapitalPct}% = {preCompanyPct + partnersPctSum + preCapitalPct}%</div>
            <div>مجموع نسب الأرباح = الفارس {postCompanyPct}% + الشركاء {partnersPostPctSum}% = {postCompanyPct + partnersPostPctSum}%</div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="secondary" onClick={()=>setOpen(false)}>إلغاء</Button>
          <Button onClick={save}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
