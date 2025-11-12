// @ts-nocheck
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PartnerDialog } from '@/components/partnership/PartnerDialog';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';

export default function SharedCompanies() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('partners').select('id,name,phone').order('name');
      setCompanies(data || []);
    } catch (e:any) {
      console.error(e);
      toast.error('فشل تحميل الشركات');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addCompany = async () => {
    const name = newName.trim(); if (!name) return;
    try {
      const { data, error } = await supabase.from('partners').insert({ name }).select().single();
      if (error) throw error;
      toast.success('تمت الإضافة');
      setNewName('');
      load();
    } catch (e:any) { console.error(e); toast.error(e?.message || 'فشل الإضافة'); }
  };

  const computeTotals = async (companyName: string) => {
    try {
      const { data } = await supabase.rpc('shared_company_totals', { p_beneficiary: companyName });
      return data;
    } catch (e) {
      console.error('computeTotals', e);
      return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>الشركات المشاركة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input placeholder="اسم الشركة" value={newName} onChange={(e)=>setNewName(e.target.value)} />
            <Button onClick={addCompany}>إضافة شركة</Button>
            <PartnerDialog onSaved={load} trigger={<Button variant="outline">إضافة/تعديل</Button>} />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اسم الشركة</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>الإجمالي (المستحق)</TableHead>
                <TableHead>المقبوض</TableHead>
                <TableHead>المتبقي</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.phone || '-'}</TableCell>
                  <TableCell>
                    <Button size="sm" onClick={async () => {
                      const { data, error } = await supabase.rpc('shared_company_summary', { p_beneficiary: c.name });
                      if (error) { toast.error(error.message); return; }
                      const totals = (data && data[0]) || { total_due: 0, total_paid: 0 } as any;
                      toast.success(`الإجمالي: ${Number(totals.total_due||0).toLocaleString()}، المقبوض: ${Number(totals.total_paid||0).toLocaleString()}، المتبقي: ${(Number(totals.total_due||0)-Number(totals.total_paid||0)).toLocaleString()}`);
                    }}>عرض المبالغ</Button>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell className="space-x-2 space-x-reverse">
                    <PartnerDialog partner={c} onSaved={load} trigger={<Button size="sm" variant="outline">تعديل</Button>} />
                    <Button size="sm" variant="destructive" onClick={async ()=>{
                      const ok = window.confirm('هل تريد حذف هذه الشركة؟ سيتم إزالة ربطها باللوحات المشتركة.');
                      if (!ok) return;
                      try {
                        await supabase.from('shared_billboards').delete().eq('partner_company_id', c.id);
                        const { error } = await supabase.from('partners').delete().eq('id', c.id);
                        if (error) throw error;
                        toast.success('ت�� حذف الشركة');
                        load();
                      } catch(e:any) { toast.error(e?.message || 'فشل حذف الشركة'); }
                    }}>حذف</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
