// @ts-nocheck
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { CheckCircle2, Info, TrendingUp, Settings2 } from 'lucide-react';
import { SharedBillboardDialog } from '@/components/partnership/SharedBillboardDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SharedBillboards() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rentAmountById, setRentAmountById] = useState<Record<string, number>>({});
  const [rentContractById, setRentContractById] = useState<Record<string, string>>({});
  const [contractsById, setContractsById] = useState<Record<string, any[]>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('billboards')
        .select('*')
        .eq('is_partnership', true)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('load shared billboards', e, { message: e?.message, details: e?.details, hint: e?.hint });
      const msg = e?.message || (typeof e === 'object' ? JSON.stringify(e, Object.getOwnPropertyNames(e)) : String(e));
      toast.error(msg || 'فشل تحميل اللوحات المشتركة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const fetchTerms = async (billboardId: number | string) => {
    const { data } = await supabase
      .from('shared_billboards')
      .select('pre_company_pct, pre_capital_pct, post_company_pct, partner_company_id, partner_pre_pct, partner_post_pct')
      .eq('billboard_id', billboardId);
    return Array.isArray(data) ? data : [];
  };

  const getRentFromContract = (contract: any, billboardId: string | number) => {
    try {
      const raw = contract.billboards_data;
      if (!raw) return 0;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const found = arr.find((it: any) => String(it.id) === String(billboardId));
        if (found && found.contractPrice != null) return Number(found.contractPrice) || 0;
      }
    } catch {}
    return 0;
  };

  const loadContractsFor = async (billboardId: number | string) => {
    const idStr = String(billboardId);
    try {
      const results: any[] = [];
      const { data: byIds } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Total Rent", billboards_data, billboard_ids')
        .ilike('billboard_ids', `%${idStr}%`);
      if (Array.isArray(byIds)) results.push(...byIds);

      const { data: byJson } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Total Rent", billboards_data, billboard_ids')
        .ilike('billboards_data', `%"id":"${idStr}"%`);
      if (Array.isArray(byJson)) results.push(...byJson);

      const { data: byCol } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Total Rent", billboards_data, billboard_ids, billboard_id')
        .eq('billboard_id', billboardId);
      if (Array.isArray(byCol)) results.push(...byCol);

      const uniq = Object.values((results || []).reduce((acc: any, cur: any) => {
        acc[cur.Contract_Number] = cur; return acc;
      }, {}));

      setContractsById((p) => ({ ...p, [idStr]: uniq as any[] }));
    } catch (e) {
      console.warn('loadContractsFor error', e);
    }
  };

  useEffect(() => {
    if (list && list.length > 0) {
      list.forEach((bb:any) => loadContractsFor(bb.ID || bb.id));
    }
  }, [list]);

  const calculateSplit = async (billboard: any, rent: number) => {
    const capital = Number(billboard.capital || 0);
    const capRem = Number(billboard.capital_remaining ?? capital);
    const terms = await fetchTerms(billboard.ID || billboard.id);

    const preCompanyPct = Number(terms?.[0]?.pre_company_pct ?? 35) / 100;
    const preCapitalPct = Number(terms?.[0]?.pre_capital_pct ?? 30) / 100;
    const postCompanyPct = Number(terms?.[0]?.post_company_pct ?? 50) / 100;

    const partners = terms.map(t => ({ id: t.partner_company_id, pre: Number(t.partner_pre_pct ?? 35)/100, post: Number(t.partner_post_pct ?? 50)/100 }));

    if (capRem > 0) {
      const company = rent * preCompanyPct;
      const partnerTotal = rent * partners.reduce((s,p)=>s + p.pre, 0);
      const deduct = rent * preCapitalPct;
      const newCap = Math.max(0, capRem - deduct);
      return { company, partnerTotal, partners, deduct, newCap, phase: 'recovery' };
    }

    const company = rent * postCompanyPct;
    const partnerTotal = rent * partners.reduce((s,p)=>s + p.post, 0);
    return { company, partnerTotal, partners, deduct: 0, newCap: 0, phase: 'profit_sharing' };
  };

  const applyRent = async (bb: any) => {
    const rent = Number(rentAmountById[bb.ID || bb.id] || 0);
    if (!rent || rent <= 0) {
      toast.error('أدخل مبلغ إيجار صالح');
      return;
    }

    const split = await calculateSplit(bb, rent);

    // Optional: contract lookup
    const rowKey = String(bb.ID || bb.id);
    const contractNumberRaw = rentContractById[rowKey];
    const contractNumber = contractNumberRaw ? Number(contractNumberRaw) : null;
    let contractInfo: any = null;
    if (contractNumber) {
      try {
        const { data: c } = await supabase
          .from('Contract')
          .select('"Contract Date", "End Date", customer_id, "Customer Name"')
          .eq('Contract_Number', contractNumber)
          .limit(1)
          .single();
        contractInfo = c || null;
      } catch {}
    }

    try {
      const payload: any = {};
      if (split.newCap !== undefined) {
        payload.capital_remaining = split.newCap;
      }

      const { error } = await supabase
        .from('billboards')
        .update(payload)
        .eq('ID', bb.ID || bb.id);

      if (error) throw error;

      try {
        await supabase.from('shared_transactions').insert({
          billboard_id: bb.ID || bb.id,
          beneficiary: 'الفارس',
          amount: Number(split.company || 0),
          type: 'rental_income'
        });

        if (split.partners && split.partners.length > 0) {
          const partnerNames: Record<string,string> = {};
          try {
            const { data: ps } = await supabase.from('partners').select('id,name');
            (ps||[]).forEach((p:any)=>{ partnerNames[p.id]=p.name; });
          } catch {}

          const inserts = split.partners.map((p:any) => ({
            billboard_id: bb.ID || bb.id,
            beneficiary: partnerNames[p.id] || p.id,
            amount: (split.phase==='recovery' ? p.pre : p.post) * rent,
            type: 'rental_income'
          }));
          await supabase.from('shared_transactions').insert(inserts as any[]);
        }

        if (Number(split.deduct || 0) > 0) {
          await supabase.from('shared_transactions').insert({
            billboard_id: bb.ID || bb.id,
            beneficiary: 'رأس المال',
            amount: Number(split.deduct || 0),
            type: 'capital_deduction'
          });
        }
      } catch (txErr) {
        console.warn('failed to insert shared transactions', txErr);
      }

      const phase = split.phase === 'recovery' ? 'مرحلة استرداد رأس المال' : 'مرحلة توزيع الأرباح';
      toast.success(
        `تم تطبيق الإيجار (${phase})` +
        `\n• الفارس: ${split.company.toLocaleString()} د.ل` +
        `\n• الشركاء: ${split.partnerTotal.toLocaleString()} د.ل` +
        (split.deduct > 0 ? `\n• خصم رأس المال: ${split.deduct.toLocaleString()} د.ل` : ''),
        { duration: 5000 }
      );

      try {
        await supabase.from('billboard_rental_history').insert({
          billboard_id: bb.ID || bb.id,
          contract_number: contractNumber || null,
          customer_id: contractInfo?.customer_id || null,
          customer_name: contractInfo?.['Customer Name'] || null,
          start_date: contractInfo?.['Contract Date'] || null,
          end_date: contractInfo?.['End Date'] || null,
          rent_amount: rent,
          phase: split.phase,
        });
      } catch (e) {
        console.warn('rental history insert failed', e);
      }

      setRentAmountById(p => ({ ...p, [String(bb.ID || bb.id)]: 0 }));
      setRentContractById(p => ({ ...p, [String(bb.ID || bb.id)]: '' }));
      load();
    } catch (e: any) {
      console.error('apply rent error', e);
      toast.error(e?.message || 'فشل تطبيق الإيجار');
    }
  };

  const removeFromPartnership = async (bb: any) => {
    const confirmed = window.confirm('هل تريد إزالة هذه اللوحة من الشراكة؟');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('billboards')
        .update({ is_partnership: false, partner_companies: null })
        .eq('ID', bb.ID || bb.id);

      if (error) throw error;
      toast.success('تمت إزالة اللوحة من الشراكة');
      load();
    } catch (e: any) {
      console.error('remove partnership error', e);
      toast.error(e?.message || 'فشل إزالة اللوحة من الشراكة');
    }
  };

  const getCapitalStatus = (bb: any) => {
    const capital = Number(bb.capital || 0);
    const remaining = Number(bb.capital_remaining ?? capital);

    if (remaining <= 0) {
      return {
        badge: <Badge className="bg-green-600 hover:bg-green-700">مكتمل</Badge>,
        percentage: 100,
        phase: 'توزيع الأرباح'
      };
    }

    const recovered = capital - remaining;
    const percentage = capital > 0 ? Math.round((recovered / capital) * 100) : 0;

    return {
      badge: <Badge className="bg-blue-600 hover:bg-blue-700">استرداد</Badge>,
      percentage,
      phase: 'استرداد رأس المال'
    };
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">اللوحات المشتركة</h1>
        <p className="text-muted-foreground mt-2">إدارة اللوحات الإعلانية المشتركة مع الشركاء</p>
      </div>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            قائمة اللوحات المشتركة
          </CardTitle>
          <CardDescription>
            {list.length} لوحة مشتركة
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">جاري ا��تحميل...</div>
          ) : list.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">لا توجد لوحات مشتركة</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">اسم اللوحة</TableHead>
                    <TableHead className="font-bold">المقاس</TableHead>
                    <TableHead className="font-bold">الشركا��</TableHead>
                    <TableHead className="font-bold">رأس المال</TableHead>
                    <TableHead className="font-bold">المتبقي</TableHead>
                    <TableHead className="font-bold">الحالة</TableHead>
                    <TableHead className="font-bold">التقدم</TableHead>
                    <TableHead className="font-bold w-80">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((bb, i) => {
                    const rowKey = String(bb.ID || bb.id || `bb-${i}`);
                    const status = getCapitalStatus(bb);

                    return (
                      <TableRow key={rowKey} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{bb.Billboard_Name || bb.name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{bb.Size || bb.size || '-'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(bb.partner_companies) && bb.partner_companies.length > 0 ? (
                              bb.partner_companies.map((partner: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {partner}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {(Number(bb.capital) || 0).toLocaleString()} د.ل
                        </TableCell>
                        <TableCell className={status.percentage === 100 ? 'text-green-600 font-medium' : ''}>
                          {(Number(bb.capital_remaining) || 0).toLocaleString()} د.ل
                        </TableCell>
                        <TableCell>
                          {status.badge}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full transition-all ${status.percentage === 100 ? 'bg-green-600' : 'bg-blue-600'}`}
                                  style={{ width: `${status.percentage}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium w-10">{status.percentage}%</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {status.phase}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 items-center">
                            <Select
                              value={rentContractById[rowKey] || ''}
                              onValueChange={(val) => {
                                setRentContractById((p)=>({ ...p, [rowKey]: val }));
                                const listC = contractsById[String(bb.ID || bb.id)] || [];
                                const contract = listC.find((c:any)=> String(c.Contract_Number) === String(val));
                                const amt = contract ? getRentFromContract(contract, bb.ID || bb.id) : 0;
                                setRentAmountById((p)=>({ ...p, [rowKey]: Number(amt || 0) }));
                              }}
                            >
                              <SelectTrigger className="w-56">
                                <SelectValue placeholder="اختر عقداً (يملأ الإيجار تلقائياً)" />
                              </SelectTrigger>
                              <SelectContent>
                                {(contractsById[String(bb.ID || bb.id)] || []).map((c:any) => (
                                  <SelectItem key={c.Contract_Number} value={String(c.Contract_Number)}>
                                    عقد {c.Contract_Number} - {c['Customer Name'] || ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="مبلغ الإيجار"
                              className="w-32"
                              value={rentAmountById[rowKey] || ''}
                              onChange={(e) => setRentAmountById(p => ({ ...p, [rowKey]: Number(e.target.value) }))}
                            />
                            <Input
                              type="number"
                              placeholder="رقم العقد (اختياري)"
                              className="w-40"
                              value={rentContractById[rowKey] || ''}
                              onChange={(e) => setRentContractById(p => ({ ...p, [rowKey]: e.target.value }))}
                            />
                            <Button
                              size="sm"
                              onClick={() => applyRent(bb)}
                              disabled={!rentAmountById[rowKey] || rentAmountById[rowKey] <= 0}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              تطبيق
                            </Button>
                            <SharedBillboardDialog
                              billboard={bb}
                              onSaved={load}
                              trigger={
                                <Button size="sm" variant="outline">
                                  <Settings2 className="h-4 w-4 mr-1" /> إعداد الشركاء
                                </Button>
                              }
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeFromPartnership(bb)}
                            >
                              إزالة
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
