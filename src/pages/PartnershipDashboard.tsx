import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export default function PartnershipDashboard() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data: partners } = await supabase.from('partners').select('id,name,phone').order('name');
      const names = ['الفارس', ...(partners||[]).map(p=>p.name)];

      const results: any[] = [];
      for (const n of names) {
        const { data, error } = await supabase.rpc('shared_company_summary', { p_beneficiary: n });
        if (error) throw error;
        const r = (data && data[0]) || { total_due: 0, total_paid: 0 } as any;
        results.push({ name: n, phone: (partners||[]).find(p=>p.name===n)?.phone || null, total_due: Number(r.total_due||0), total_paid: Number(r.total_paid||0) });
      }
      setRows(results);
    } catch (e:any) { console.error(e); toast.error('فشل التحميل'); } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, []);

  const withdraw = async (name: string) => {
    const amount = Number(withdrawAmount[name]||0);
    if (!amount || amount <= 0) { toast.error('أدخل مبلغاً صحيحاً'); return; }
    try {
      const { error } = await supabase.from('shared_transactions').insert({ beneficiary: name, amount, type: 'withdrawal' });
      if (error) throw error;
      toast.success('تم تسجيل السحب');
      setWithdrawAmount(p=>({ ...p, [name]: 0 }));
      load();
    } catch (e:any) { toast.error(e?.message || 'خطأ أثناء السحب'); }
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>حصة كل شركة من إجمالي إيجارات اللوحات المشتركة</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الجهة</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>المستحق</TableHead>
                    <TableHead>المسحوبات</TableHead>
                    <TableHead>المتبقي</TableHead>
                    <TableHead>سحب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.phone || '-'}</TableCell>
                      <TableCell>{r.total_due.toLocaleString()}</TableCell>
                      <TableCell>{r.total_paid.toLocaleString()}</TableCell>
                      <TableCell className="font-semibold">{(r.total_due - r.total_paid).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input type="number" className="w-32" value={withdrawAmount[r.name] || ''} onChange={(e)=>setWithdrawAmount(p=>({ ...p, [r.name]: Number(e.target.value||0) }))} />
                          <Button size="sm" onClick={()=>withdraw(r.name)}>سحب</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
