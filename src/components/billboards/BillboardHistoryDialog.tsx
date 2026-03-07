import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FileText, Calendar, User, DollarSign, Clock, Printer, CheckCircle2, Trash2, 
  Image as ImageIcon, TrendingUp, BarChart3, Wallet, Tag, Wrench, Palette
} from 'lucide-react';
import { formatGregorianDate } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BillboardHistoryPrintDialog } from './BillboardHistoryPrintDialog';

interface BillboardHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboardId: number;
  billboardName: string;
}

interface HistoryRecord {
  id: string;
  contract_number: number;
  customer_name: string;
  ad_type: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  rent_amount: number;
  discount_amount?: number;
  discount_percentage?: number;
  installation_date: string;
  installation_cost?: number;
  billboard_rent_price?: number;
  total_before_discount?: number;
  design_face_a_url: string;
  design_face_b_url: string;
  design_name: string;
  installed_image_face_a_url: string;
  installed_image_face_b_url: string;
  team_name: string;
  notes: string;
  created_at: string;
  // ✅ حقول جديدة
  print_cost?: number;
  include_installation_in_price?: boolean;
  include_print_in_price?: boolean;
  pricing_category?: string;
  pricing_mode?: string;
  contract_total?: number;
  contract_total_rent?: number;
  contract_discount?: number;
  individual_billboard_data?: any;
}

export const BillboardHistoryDialog: React.FC<BillboardHistoryDialogProps> = ({
  open,
  onOpenChange,
  billboardId,
  billboardName
}) => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRentals, setTotalRentals] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  useEffect(() => {
    if (open && billboardId) {
      loadHistory();
    }
  }, [open, billboardId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      // جلب السجلات التاريخية
      const { data: historyData, error: historyError } = await supabase
        .from('billboard_history' as any)
        .select('*')
        .eq('billboard_id', billboardId)
        .order('start_date', { ascending: false });

      if (historyError) throw historyError;

      // جلب العقد الحالي النشط للوحة
      const { data: billboard, error: billboardError } = await supabase
        .from('billboards')
        .select('*')
        .eq('ID', billboardId)
        .single();

      if (billboardError && billboardError.code !== 'PGRST116') throw billboardError;

      let allRecords: HistoryRecord[] = (historyData || []) as unknown as HistoryRecord[];

      // إضافة العقد الحالي إذا كان موجوداً ونشطاً
      if (billboard?.Contract_Number && billboard?.Rent_Start_Date) {
        const endDate = billboard.Rent_End_Date ? new Date(billboard.Rent_End_Date) : null;
        const today = new Date();
        const isActive = !endDate || endDate >= today;

        if (isActive) {
          // ✅ إزالة التكرار - حذف العقد النشط من السجلات التاريخية
          allRecords = allRecords.filter(r => r.contract_number !== billboard.Contract_Number);

          const startDate = new Date(billboard.Rent_Start_Date);
          const durationDays = endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

          // ✅ جلب بيانات العقد الكاملة مع معلومات التركيب والطباعة
          const { data: contractData } = await supabase
            .from('Contract')
            .select('Total, "Total Rent", Discount, installation_cost, installation_enabled, design_data, billboard_ids, billboard_prices, print_cost, include_installation_in_price, include_print_in_billboard_price')
            .eq('Contract_Number', billboard.Contract_Number)
            .single();

          // ✅ حساب السعر الفردي للوحة
          const billboardIds = contractData?.billboard_ids ? contractData.billboard_ids.split(',').map((id: string) => id.trim()) : [];
          const billboardCount = billboardIds.length || 1;
          
          // محاولة الحصول على السعر الفردي من billboard_prices
          let individualPrice = 0;
          let individualDiscount = 0;
          let individualPrintCost = 0;
          let individualInstallationCost = 0;
          let pricingCategory = '';
          let pricingMode = '';
          let individualBillboardData: any = null;
          
          if (contractData?.billboard_prices) {
            try {
              const prices = typeof contractData.billboard_prices === 'string' 
                ? JSON.parse(contractData.billboard_prices) 
                : contractData.billboard_prices;
              
              const billboardPriceData = Array.isArray(prices) 
                ? prices.find((p: any) => p.billboardId?.toString() === billboardId.toString())
                : null;
              
              if (billboardPriceData) {
                individualBillboardData = billboardPriceData;
                individualPrice = billboardPriceData.priceBeforeDiscount || billboardPriceData.contractPrice || 0;
                individualDiscount = billboardPriceData.discountPerBillboard || 0;
                individualPrintCost = billboardPriceData.printCost || 0;
                individualInstallationCost = billboardPriceData.installationCost || 0;
                pricingCategory = billboardPriceData.pricingCategory || '';
                pricingMode = billboardPriceData.pricingMode || '';
              }
            } catch (e) {
              console.error('Error parsing billboard_prices:', e);
            }
          }
          
          // إذا لم نجد السعر في billboard_prices، نحسبه نسبياً
          if (individualPrice === 0) {
            const rentOnly = Math.max((contractData?.Total || 0) - (contractData?.installation_cost || 0), 0);
            individualPrice = rentOnly / billboardCount;
            individualDiscount = (contractData?.Discount || 0) / billboardCount;
            individualInstallationCost = ((contractData?.installation_enabled && contractData?.installation_cost) || 0) / billboardCount;
            individualPrintCost = (contractData?.print_cost || 0) / billboardCount;
          }

          const finalAmount = individualPrice - individualDiscount + individualInstallationCost + individualPrintCost;
          const discountPct = individualPrice > 0 ? (individualDiscount / individualPrice) * 100 : 0;

          // ✅ جلب التصاميم من installation_task_items → task_designs → billboards
          let designA = '';
          let designB = '';
          
          const { data: tasks } = await supabase
            .from('installation_tasks')
            .select('id')
            .eq('contract_id', billboard.Contract_Number);
          
          if (tasks?.length) {
            const { data: items } = await supabase
              .from('installation_task_items')
              .select('design_face_a, design_face_b, selected_design_id, installed_image_face_a_url, installed_image_face_b_url')
              .eq('billboard_id', billboardId)
              .in('task_id', tasks.map(t => t.id))
              .limit(1);
            
            if (items?.[0]) {
              designA = items[0].design_face_a || '';
              designB = items[0].design_face_b || '';
              
              // إذا لم توجد، جرب من task_designs
              if ((!designA || !designB) && items[0].selected_design_id) {
                const { data: designData } = await supabase
                  .from('task_designs')
                  .select('design_face_a_url, design_face_b_url')
                  .eq('id', items[0].selected_design_id)
                  .single();
                
                if (designData) {
                  designA = designData.design_face_a_url || designA;
                  designB = designData.design_face_b_url || designB;
                }
              }
            }
          }
          
          // Fallback: من billboards أو contract design_data
          if (!designA && !designB) {
            designA = billboard.design_face_a || '';
            designB = billboard.design_face_b || '';
            
            if ((!designA || !designB) && contractData?.design_data) {
              const designs = Array.isArray(contractData.design_data) ? contractData.design_data : [contractData.design_data];
              if (designs[0] && typeof designs[0] === 'object') {
                const design = designs[0] as any;
                designA = design.face_a_url || design.faceAUrl || designA;
                designB = design.face_b_url || design.faceBUrl || designB;
              }
            }
          }

          // ✅ جلب صور التركيب
          let imgA = '', imgB = '';
          if (tasks?.length) {
            const { data: items } = await supabase.from('installation_task_items')
              .select('installed_image_face_a_url, installed_image_face_b_url')
              .eq('billboard_id', billboardId).in('task_id', tasks.map(t => t.id)).limit(1);
            if (items?.[0]) {
              imgA = items[0].installed_image_face_a_url || '';
              imgB = items[0].installed_image_face_b_url || '';
            }
          }

          const currentRecord: HistoryRecord = {
            id: `current-${billboard.Contract_Number}`,
            contract_number: billboard.Contract_Number,
            customer_name: billboard.Customer_Name || '',
            ad_type: billboard.Ad_Type || '',
            start_date: billboard.Rent_Start_Date,
            end_date: billboard.Rent_End_Date || '',
            duration_days: durationDays,
            rent_amount: finalAmount,
            discount_amount: individualDiscount,
            discount_percentage: discountPct,
            installation_date: billboard.Rent_Start_Date,
            installation_cost: individualInstallationCost,
            billboard_rent_price: billboard.Price || 0,
            total_before_discount: individualPrice,
            design_face_a_url: designA,
            design_face_b_url: designB,
            design_name: '',
            installed_image_face_a_url: imgA,
            installed_image_face_b_url: imgB,
            team_name: '',
            notes: 'عقد حالي نشط',
            created_at: new Date().toISOString(),
            // ✅ حقول جديدة
            print_cost: individualPrintCost,
            include_installation_in_price: contractData?.include_installation_in_price || false,
            include_print_in_price: contractData?.include_print_in_billboard_price || false,
            pricing_category: pricingCategory,
            pricing_mode: pricingMode,
            contract_total: contractData?.Total || 0,
            contract_total_rent: contractData?.['Total Rent'] || 0,
            contract_discount: contractData?.Discount || 0,
            individual_billboard_data: individualBillboardData
          };

          allRecords = [currentRecord, ...allRecords];
        }
      }

      setHistory(allRecords);
      
      // حساب الإحصائيات (✅ تضمين تكلفة التركيب والطباعة في الإيرادات)
      const rentalsCount = allRecords.length;
      const revenue = allRecords.reduce((sum, record) => 
        sum + (Number(record.rent_amount) || 0), 0
      );
      const days = allRecords.reduce((sum, record) => sum + (record.duration_days || 0), 0);

      setTotalRentals(rentalsCount);
      setTotalRevenue(revenue);
      setTotalDays(days);
    } catch (error: any) {
      console.error('Error loading history:', error);
      toast.error('فشل تحميل السجل التاريخي');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;

    try {
      const { error } = await supabase
        .from('billboard_history')
        .delete()
        .eq('id', recordToDelete);

      if (error) throw error;

      toast.success('تم حذف السجل بنجاح');
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      loadHistory(); // إعادة تحميل البيانات
    } catch (error: any) {
      console.error('Error deleting record:', error);
      toast.error('فشل حذف السجل');
    }
  };

  const printHistory = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('يرجى السماح بفتح النوافذ المنبثقة');
        return;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>تقرير تاريخ اللوحة ${billboardName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              direction: rtl;
            }
            h1 {
              text-align: center;
              color: #333;
              margin-bottom: 30px;
            }
            .stats {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-bottom: 30px;
              padding: 20px;
              background: #f5f5f5;
              border-radius: 8px;
            }
            .stat-item {
              text-align: center;
            }
            .stat-label {
              color: #666;
              font-size: 14px;
              margin-bottom: 5px;
            }
            .stat-value {
              font-size: 24px;
              font-weight: bold;
              color: #333;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 12px;
              text-align: right;
            }
            th {
              background-color: #4CAF50;
              color: white;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .badge {
              display: inline-block;
              padding: 4px 8px;
              background: #4CAF50;
              color: white;
              border-radius: 4px;
              font-size: 12px;
            }
            .images {
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
            }
            .images img {
              max-width: 100px;
              max-height: 100px;
              object-fit: cover;
              border-radius: 4px;
              border: 1px solid #ddd;
            }
            @media print {
              body { padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>تقرير تاريخ اللوحة: ${billboardName}</h1>
          
          <div class="stats">
            <div class="stat-item">
              <div class="stat-label">عدد مرات التأجير</div>
              <div class="stat-value">${totalRentals}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">إجمالي الإيرادات</div>
              <div class="stat-value">${totalRevenue.toLocaleString()} دينار</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">إجمالي أيام الإيجار</div>
              <div class="stat-value">${totalDays} يوم</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>رقم العقد</th>
                <th>اسم الزبون</th>
                <th>نوع الإعلان</th>
                <th>تاريخ البداية</th>
                <th>تاريخ النهاية</th>
                <th>المدة</th>
                <th>سعر اللوحة</th>
                <th>المبلغ قبل الخصم</th>
                <th>الخصم</th>
                <th>نسبة الخصم</th>
                <th>تكلفة التركيب</th>
                <th>تكلفة الطباعة</th>
                <th>التركيب ضمن السعر</th>
                <th>الطباعة ضمن السعر</th>
                <th>المبلغ النهائي</th>
                <th>الفريق</th>
                <th>فئة التسعير</th>
                <th>صور التصميم</th>
                <th>صور التركيب</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(record => `
                <tr>
                  <td>
                    ${record.contract_number || '-'}
                    ${record.id.toString().startsWith('current-') ? '<span class="badge">عقد حالي</span>' : ''}
                  </td>
                  <td>${record.customer_name || '-'}</td>
                  <td>${record.ad_type || '-'}</td>
                  <td>${formatGregorianDate(record.start_date)}</td>
                  <td>${formatGregorianDate(record.end_date)}</td>
                  <td>${record.duration_days || 0} يوم</td>
                  <td>${record.billboard_rent_price ? Number(record.billboard_rent_price).toLocaleString() + ' دينار' : '-'}</td>
                  <td>${record.total_before_discount ? Number(record.total_before_discount).toLocaleString() + ' دينار' : '-'}</td>
                  <td>${record.discount_amount ? Number(record.discount_amount).toLocaleString() + ' دينار' : '-'}</td>
                  <td>${record.discount_percentage ? Number(record.discount_percentage).toFixed(2) + '%' : '-'}</td>
                  <td>${record.installation_cost ? Number(record.installation_cost).toLocaleString() + ' دينار' : '-'}</td>
                  <td>${record.print_cost ? Number(record.print_cost).toLocaleString() + ' دينار' : '-'}</td>
                  <td>${record.include_installation_in_price ? '✓ نعم' : '-'}</td>
                  <td>${record.include_print_in_price ? '✓ نعم' : '-'}</td>
                  <td>${Number(record.rent_amount || 0).toLocaleString()} دينار</td>
                  <td>${record.team_name || '-'}</td>
                  <td>${record.pricing_category || '-'}</td>
                  <td>
                    <div class="images">
                      ${record.design_face_a_url ? `<img src="${record.design_face_a_url}" alt="تصميم وجه أ" />` : ''}
                      ${record.design_face_b_url ? `<img src="${record.design_face_b_url}" alt="تصميم وجه ب" />` : ''}
                      ${!record.design_face_a_url && !record.design_face_b_url ? '-' : ''}
                    </div>
                  </td>
                  <td>
                    <div class="images">
                      ${record.installed_image_face_a_url ? `<img src="${record.installed_image_face_a_url}" alt="تركيب وجه أ" />` : ''}
                      ${record.installed_image_face_b_url ? `<img src="${record.installed_image_face_b_url}" alt="تركيب وجه ب" />` : ''}
                      ${!record.installed_image_face_a_url && !record.installed_image_face_b_url ? '-' : ''}
                    </div>
                  </td>
                  <td>${record.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">
              طباعة
            </button>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      toast.success('تم فتح نافذة الطباعة');
    } catch (error) {
      console.error('Print error:', error);
      toast.error('فشل فتح نافذة الطباعة');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5" />
            تاريخ اللوحة: {billboardName}
          </DialogTitle>
        </DialogHeader>

        {/* الإحصائيات - تصميم محسّن */}
        <div className="grid grid-cols-3 gap-4 p-4">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/15 rounded-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">عدد مرات التأجير</div>
                <div className="text-2xl font-bold text-foreground">{totalRentals}</div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl p-4 border border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-500/15 rounded-lg">
                <Wallet className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">إجمالي الإيرادات</div>
                <div className="text-2xl font-bold text-green-600">{totalRevenue.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">دينار ليبي</div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl p-4 border border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/15 rounded-lg">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">إجمالي أيام الإيجار</div>
                <div className="text-2xl font-bold text-amber-600">{totalDays}</div>
                <div className="text-[10px] text-muted-foreground">يوم</div>
              </div>
            </div>
          </div>
        </div>

        {/* السجلات */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا يوجد سجل تاريخي لهذه اللوحة
            </div>
          ) : (
            history.map((record) => (
              <div
                key={record.id}
                className={`rounded-xl border transition-all hover:shadow-lg ${
                  record.id.toString().startsWith('current-') 
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800' 
                    : 'bg-card border-border hover:border-primary/30'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${record.id.toString().startsWith('current-') ? 'bg-green-100 dark:bg-green-900/50' : 'bg-muted'}`}>
                      <FileText className={`h-4 w-4 ${record.id.toString().startsWith('current-') ? 'text-green-600' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">عقد #{record.contract_number}</span>
                        {record.id.toString().startsWith('current-') && (
                          <Badge className="bg-green-500 text-white text-[10px]">نشط</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{record.customer_name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-left">
                      <div className="text-xl font-bold text-green-600">{Number(record.rent_amount || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">دينار ليبي</div>
                    </div>
                    {!record.id.toString().startsWith('current-') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setRecordToDelete(record.id);
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {/* نوع الإعلان */}
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-[10px] text-muted-foreground">نوع الإعلان</div>
                      <div className="text-sm font-medium">{record.ad_type || '-'}</div>
                    </div>
                  </div>
                  
                  {/* التواريخ */}
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-[10px] text-muted-foreground">الفترة</div>
                      <div className="text-sm font-medium">
                        {formatGregorianDate(record.start_date)} - {formatGregorianDate(record.end_date)}
                      </div>
                    </div>
                  </div>

                  {/* المدة */}
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-[10px] text-muted-foreground">المدة</div>
                      <div className="text-sm font-medium">{record.duration_days} يوم</div>
                    </div>
                  </div>

                  {/* فئة التسعير */}
                  {record.pricing_category && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                      <Palette className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">فئة التسعير</div>
                        <div className="text-sm font-medium">{record.pricing_category}</div>
                      </div>
                    </div>
                  )}

                  {/* المبلغ قبل الخصم */}
                  {record.total_before_discount && record.total_before_discount > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
                      <DollarSign className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">قبل الخصم</div>
                        <div className="text-sm font-semibold text-blue-600">{Number(record.total_before_discount).toLocaleString()}</div>
                      </div>
                    </div>
                  )}

                  {/* الخصم */}
                  {record.discount_amount && record.discount_amount > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-100 dark:border-orange-900">
                      <TrendingUp className="h-4 w-4 text-orange-500 rotate-180" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">الخصم</div>
                        <div className="text-sm font-semibold text-orange-600">
                          {Number(record.discount_amount).toLocaleString()}
                          <span className="text-[10px] mr-1">({Number(record.discount_percentage || 0).toFixed(1)}%)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* التركيب */}
                  {record.installation_cost && record.installation_cost > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-100 dark:border-purple-900">
                      <Wrench className="h-4 w-4 text-purple-500" />
                      <div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          التركيب
                          {record.include_installation_in_price && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0">ضمن السعر</Badge>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-purple-600">{Number(record.installation_cost).toLocaleString()}</div>
                      </div>
                    </div>
                  )}

                  {/* الطباعة */}
                  {record.print_cost && record.print_cost > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg border border-cyan-100 dark:border-cyan-900">
                      <Printer className="h-4 w-4 text-cyan-500" />
                      <div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          الطباعة
                          {record.include_print_in_price && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0">ضمن السعر</Badge>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-cyan-600">{Number(record.print_cost).toLocaleString()}</div>
                      </div>
                    </div>
                  )}

                  {/* الفريق */}
                  {record.team_name && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">فريق التركيب</div>
                        <div className="text-sm font-medium">{record.team_name}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* صور التصميم والتركيب */}
                {(record.design_face_a_url || record.design_face_b_url || record.installed_image_face_a_url || record.installed_image_face_b_url) && (
                  <div className="px-4 pb-4 flex flex-wrap gap-4">
                    {/* صور التصميم */}
                    {(record.design_face_a_url || record.design_face_b_url) && (
                      <div>
                        <div className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          صور التصميم
                        </div>
                        <div className="flex gap-2">
                          {record.design_face_a_url && (
                            <img
                              src={record.design_face_a_url}
                              alt="تصميم وجه أ"
                              className="w-16 h-16 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 hover:scale-105 transition-transform"
                              onClick={() => setSelectedImage(record.design_face_a_url)}
                            />
                          )}
                          {record.design_face_b_url && (
                            <img
                              src={record.design_face_b_url}
                              alt="تصميم وجه ب"
                              className="w-16 h-16 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 hover:scale-105 transition-transform"
                              onClick={() => setSelectedImage(record.design_face_b_url)}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* صور التركيب */}
                    {(record.installed_image_face_a_url || record.installed_image_face_b_url) && (
                      <div>
                        <div className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          صور التركيب
                        </div>
                        <div className="flex gap-2">
                          {record.installed_image_face_a_url && (
                            <img
                              src={record.installed_image_face_a_url}
                              alt="تركيب وجه أ"
                              className="w-16 h-16 object-cover rounded-lg border border-green-200 dark:border-green-800 cursor-pointer hover:opacity-80 hover:scale-105 transition-transform"
                              onClick={() => setSelectedImage(record.installed_image_face_a_url)}
                            />
                          )}
                          {record.installed_image_face_b_url && (
                            <img
                              src={record.installed_image_face_b_url}
                              alt="تركيب وجه ب"
                              className="w-16 h-16 object-cover rounded-lg border border-green-200 dark:border-green-800 cursor-pointer hover:opacity-80 hover:scale-105 transition-transform"
                              onClick={() => setSelectedImage(record.installed_image_face_b_url)}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ملاحظات */}
                {record.notes && record.notes !== 'عقد حالي نشط' && (
                  <div className="px-4 pb-4">
                    <div className="text-xs text-muted-foreground mb-1">ملاحظات</div>
                    <div className="text-sm text-foreground bg-muted/30 p-2 rounded">{record.notes}</div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* أزرار */}
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            إغلاق
          </Button>
          <Button
            onClick={() => setPrintDialogOpen(true)}
            disabled={history.length === 0}
          >
            <Printer className="h-4 w-4 ml-2" />
            طباعة التقرير
          </Button>
        </div>
      </DialogContent>

      {/* نافذة طباعة التقرير المتقدمة */}
      <BillboardHistoryPrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        billboardId={billboardId}
        billboardName={billboardName}
        history={history}
        totalRentals={totalRentals}
        totalRevenue={totalRevenue}
        totalDays={totalDays}
      />

      {/* نافذة تأكيد الحذف */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا السجل من التاريخ؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecord} className="bg-destructive text-destructive-foreground">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* نافذة عرض الصورة */}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>عرض الصورة</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center">
              <img
                src={selectedImage}
                alt="صورة مكبرة"
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};