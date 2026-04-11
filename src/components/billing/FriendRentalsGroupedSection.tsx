import { useMemo, useState } from 'react';
import { ArrowRightLeft, Building2, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { printPurchaseInvoice } from '@/components/billing/PurchaseInvoicePrint';

interface FriendRentalItem {
  id: string;
  billboard_id: number;
  contract_number: number;
  friend_rental_cost: number;
  customer_rental_price?: number | null;
  profit?: number | null;
  used_as_payment?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  billboards?: {
    Billboard_Name?: string | null;
    Size?: string | null;
    Municipality?: string | null;
    Faces_Count?: number | null;
    Image_URL?: string | null;
    Nearest_Landmark?: string | null;
    design_face_a?: string | null;
  } | null;
}

interface FriendRentalsGroupedSectionProps {
  friendBillboardRentals: FriendRentalItem[];
  customerName: string;
  onUseAsPayment: (rentals: FriendRentalItem[]) => void;
}

export function FriendRentalsGroupedSection({
  friendBillboardRentals,
  customerName,
  onUseAsPayment,
}: FriendRentalsGroupedSectionProps) {
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set());

  const contractGroups = useMemo(() => {
    const groupMap = new Map<number, FriendRentalItem[]>();
    friendBillboardRentals.forEach((r) => {
      const cn = Number(r.contract_number) || 0;
      if (!groupMap.has(cn)) groupMap.set(cn, []);
      groupMap.get(cn)!.push(r);
    });

    const now = new Date();
    return Array.from(groupMap.entries())
      .map(([contractNumber, rentals]) => {
        const totalFriendCost = rentals.reduce((s, r) => s + (Number(r.friend_rental_cost) || 0), 0);
        const totalCustomerPrice = rentals.reduce((s, r) => s + (Number(r.customer_rental_price) || 0), 0);
        const totalProfit = rentals.reduce((s, r) => s + (Number(r.profit) || 0), 0);
        const totalUsedAsPayment = rentals.reduce((s, r) => s + (Number(r.used_as_payment) || 0), 0);
        const remainingForPayment = Math.max(0, totalFriendCost - totalUsedAsPayment);
        const designImage =
          rentals.find((r) => r.billboards?.design_face_a)?.billboards?.design_face_a ||
          rentals.find((r) => r.billboards?.Image_URL)?.billboards?.Image_URL ||
          undefined;
        const isActive = rentals.some((r) => !r.end_date || new Date(r.end_date) >= now);
        return { contractNumber, rentals, totalFriendCost, totalCustomerPrice, totalProfit, totalUsedAsPayment, remainingForPayment, designImage, isActive };
      })
      .sort((a, b) => b.contractNumber - a.contractNumber);
  }, [friendBillboardRentals]);

  const totalAll = useMemo(
    () => friendBillboardRentals.reduce((s, r) => s + (Number(r.friend_rental_cost) || 0), 0),
    [friendBillboardRentals],
  );

  const toggleGroup = (cn: number) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(cn) ? next.delete(cn) : next.add(cn);
      return next;
    });
  };

  const handlePrintContractInvoice = (contractNumber: number, rentals: FriendRentalItem[], designImage?: string) => {
    const invoiceDate = new Date().toLocaleDateString('ar-LY', { day: 'numeric', month: 'long', year: 'numeric' });
    const items = rentals.map((rental) => {
      const bb = rental.billboards;
      const s = rental.start_date ? new Date(rental.start_date) : null;
      const e = rental.end_date ? new Date(rental.end_date) : null;
      const days = s && e ? Math.ceil((e.getTime() - s.getTime()) / 86400000) : 0;
      return {
        description: `إيجار لوحة ${bb?.Billboard_Name || 'لوحة'} - ${bb?.Size || ''} - ${bb?.Municipality || ''} - ${bb?.Nearest_Landmark || ''}`,
        quantity: 1,
        unit: 'لوحة',
        unitPrice: Number(rental.friend_rental_cost) || 0,
        total: Number(rental.friend_rental_cost) || 0,
        durationMonths: Math.round(days / 30) || 1,
      };
    });
    const firstStart = rentals.find((r) => r.start_date)?.start_date;
    const lastEnd = rentals.reduce((l, r) => (!r.end_date ? l : !l || r.end_date > l ? r.end_date : l), '' as string);
    printPurchaseInvoice({
      invoiceNumber: String(contractNumber || ''),
      invoiceDate,
      invoiceName: 'فاتورة مشتريات - إيجار لوحات صديقة',
      supplierName: customerName,
      supplierCompany: customerName,
      billboardImage: designImage,
      items,
      totalAmount: rentals.reduce((s, r) => s + (Number(r.friend_rental_cost) || 0), 0),
      notes: `عقد رقم ${contractNumber} - ${rentals.length} لوحات - من ${firstStart ? new Date(firstStart).toLocaleDateString('ar-LY') : '—'} إلى ${lastEnd ? new Date(lastEnd).toLocaleDateString('ar-LY') : '—'}`,
    });
  };

  if (friendBillboardRentals.length === 0) return null;

  return (
    <Card className="mt-6 border-amber-500/30">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <Building2 className="h-5 w-5 text-amber-500" />
          إيجارات اللوحات (شركة صديقة) ({friendBillboardRentals.length})
        </CardTitle>
        <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30">
          إجمالي: {totalAll.toLocaleString('ar-LY')} د.ل
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {contractGroups.map((group) => {
          const isOpen = openGroups.has(group.contractNumber);
          return (
            <div key={group.contractNumber} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Header row — always visible */}
              <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
                <button type="button" onClick={() => toggleGroup(group.contractNumber)} className="flex flex-1 items-start gap-4 text-right">
                  {group.designImage && (
                    <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                      <img src={group.designImage} alt="" className="h-full w-full object-cover" loading="lazy" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold">عقد #{group.contractNumber}</span>
                      <Badge variant={group.isActive ? 'default' : 'secondary'}>{group.isActive ? 'نشط' : 'منتهي'}</Badge>
                      <Badge variant="outline">{group.rentals.length} لوحات</Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-3">
                      <span>التكلفة: <b className="text-foreground">{group.totalFriendCost.toLocaleString('ar-LY')} د.ل</b></span>
                      <span>سعر الزبون: <b className="text-foreground">{group.totalCustomerPrice.toLocaleString('ar-LY')} د.ل</b></span>
                      <span>الربح: <b className="text-foreground">{group.totalProfit.toLocaleString('ar-LY')} د.ل</b></span>
                    </div>
                    {group.remainingForPayment > 0 && (
                      <p className="text-sm text-amber-600">المتاح كدفعة: {group.remainingForPayment.toLocaleString('ar-LY')} د.ل</p>
                    )}
                  </div>
                  <div className="pt-1 text-muted-foreground">{isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                </button>

                <div className="flex flex-wrap gap-2 xl:justify-end" onClick={(ev) => ev.stopPropagation()}>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => handlePrintContractInvoice(group.contractNumber, group.rentals, group.designImage)}>
                    <Printer className="h-4 w-4" />
                    طباعة فاتورة
                  </Button>
                  {group.remainingForPayment > 0 && (
                    <Button variant="outline" size="sm" className="gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10" onClick={() => onUseAsPayment(group.rentals)}>
                      <ArrowRightLeft className="h-4 w-4" />
                      استخدام كدفعة ({group.remainingForPayment.toLocaleString('ar-LY')} د.ل)
                    </Button>
                  )}
                </div>
              </div>

              {/* Expandable detail cards */}
              {isOpen && (
                <div className="border-t border-border p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.rentals.map((rental) => {
                      const bb = rental.billboards;
                      const sd = rental.start_date ? new Date(rental.start_date) : null;
                      const ed = rental.end_date ? new Date(rental.end_date) : null;
                      const days = sd && ed ? Math.ceil((ed.getTime() - sd.getTime()) / 86400000) + 1 : 0;
                      const active = ed ? new Date() <= ed : true;
                      return (
                        <Card key={rental.id} className={`border ${active ? 'border-green-500/30 bg-green-500/5' : 'border-border'}`}>
                          <CardContent className="pt-4 space-y-3">
                            {bb?.Image_URL && (
                              <div className="w-full h-32 rounded-lg overflow-hidden border border-border">
                                <img src={bb.Image_URL} alt={bb?.Billboard_Name || ''} className="w-full h-full object-cover" loading="lazy" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />
                              </div>
                            )}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="font-bold text-base">{bb?.Billboard_Name || 'لوحة غير معروفة'}</p>
                                <p className="text-sm text-muted-foreground">{bb?.Size || '—'} • {bb?.Municipality || '—'}</p>
                                {bb?.Nearest_Landmark && <p className="text-xs text-muted-foreground mt-1">📍 {bb.Nearest_Landmark}</p>}
                              </div>
                              <Badge variant={active ? 'default' : 'secondary'} className="text-xs">{active ? 'نشط' : 'منتهي'}</Badge>
                            </div>
                            <div className="space-y-1 text-sm pt-2 border-t border-border">
                              <div className="flex justify-between"><span className="text-muted-foreground">المدة:</span><span>{days} يوم</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">التكلفة:</span><span className="font-semibold text-amber-600">{(Number(rental.friend_rental_cost) || 0).toLocaleString('ar-LY')} د.ل</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">إيجار الزبون:</span><span>{(Number(rental.customer_rental_price) || 0).toLocaleString('ar-LY')} د.ل</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">الربح:</span><span className="font-semibold text-primary">{(Number(rental.profit) || 0).toLocaleString('ar-LY')} د.ل</span></div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}