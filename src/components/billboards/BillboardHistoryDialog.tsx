import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileText, Calendar, User, DollarSign, Clock, Printer, CheckCircle2, Trash2, Image as ImageIcon } from 'lucide-react';
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
  installation_date: string;
  design_face_a_url: string;
  design_face_b_url: string;
  design_name: string;
  installed_image_face_a_url: string;
  installed_image_face_b_url: string;
  team_name: string;
  notes: string;
  created_at: string;
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

      if (historyData) {
        console.log('📊 Billboard History Data:', historyData);
        console.log('🎨 Design URLs:', historyData.map((h: any) => ({ 
          id: h.id, 
          design_a: h.design_face_a_url, 
          design_b: h.design_face_b_url,
          design_name: h.design_name 
        })));
      }

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

          // ✅ جلب التكلفة الكاملة والتصاميم
          const { data: contractData } = await supabase
            .from('Contract')
            .select('Total, Discount, installation_cost, installation_enabled, design_data')
            .eq('Contract_Number', billboard.Contract_Number)
            .single();

          const totalAmount = contractData?.Total || billboard.Price || 0;
          const discountAmount = contractData?.Discount || 0;
          const installCost = (contractData?.installation_enabled && contractData?.installation_cost) || 0;
          const finalAmount = totalAmount + installCost - discountAmount;

          // ✅ استخراج التصاميم
          let designA = billboard.design_face_a || '';
          let designB = billboard.design_face_b || '';
          let designName = '';
          
          // محاولة جلب التصاميم من design_data
          if (contractData?.design_data) {
            const designs = Array.isArray(contractData.design_data) ? contractData.design_data : [contractData.design_data];
            if (designs[0] && typeof designs[0] === 'object') {
              const design = designs[0] as any;
              designA = design.face_a_url || design.faceAUrl || designA;
              designB = design.face_b_url || design.faceBUrl || designB;
              designName = design.design_name || designName;
            }
          }

          // ✅ جلب صور التركيب والتصاميم من installation_task_items
          const { data: tasks } = await supabase.from('installation_tasks').select('id').eq('contract_id', billboard.Contract_Number);
          let imgA = '', imgB = '';
          if (tasks?.length) {
            const { data: items } = await supabase.from('installation_task_items')
              .select('installed_image_face_a_url, installed_image_face_b_url, design_face_a, design_face_b, selected_design_id')
              .eq('billboard_id', billboardId)
              .in('task_id', tasks.map(t => t.id))
              .limit(1);
            
            if (items?.[0]) {
              imgA = items[0].installed_image_face_a_url || '';
              imgB = items[0].installed_image_face_b_url || '';
              
              // جلب التصاميم من task item إذا لم تكن موجودة
              if (!designA && items[0].design_face_a) designA = items[0].design_face_a;
              if (!designB && items[0].design_face_b) designB = items[0].design_face_b;
              
              // جلب التصميم من task_designs إذا كان محدداً
              if (items[0].selected_design_id && !designA && !designB) {
                const { data: taskDesign } = await supabase
                  .from('task_designs')
                  .select('design_face_a_url, design_face_b_url, design_name')
                  .eq('id', items[0].selected_design_id)
                  .single();
                
                if (taskDesign) {
                  designA = taskDesign.design_face_a_url || designA;
                  designB = taskDesign.design_face_b_url || designB;
                  designName = taskDesign.design_name || designName;
                }
              }
            }
          }

          console.log('🎨 Current Contract Designs:', { designA, designB, designName, imgA, imgB });

          const currentRecord: HistoryRecord = {
            id: `current-${billboard.Contract_Number}`,
            contract_number: billboard.Contract_Number,
            customer_name: billboard.Customer_Name || '',
            ad_type: billboard.Ad_Type || '',
            start_date: billboard.Rent_Start_Date,
            end_date: billboard.Rent_End_Date || '',
            duration_days: durationDays,
            rent_amount: finalAmount,
            discount_amount: discountAmount,
            installation_date: billboard.Rent_Start_Date,
            design_face_a_url: designA,
            design_face_b_url: designB,
            design_name: designName,
            installed_image_face_a_url: imgA,
            installed_image_face_b_url: imgB,
            team_name: '',
            notes: 'عقد حالي نشط',
            created_at: new Date().toISOString()
          };

          allRecords = [currentRecord, ...allRecords];
        }
      }

      setHistory(allRecords);
      
      // حساب الإحصائيات
      const rentalsCount = allRecords.length;
      const revenue = allRecords.reduce((sum, record) => sum + (Number(record.rent_amount) || 0), 0);
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
                <th>المبلغ</th>
                <th>الخصم</th>
                <th>الفريق</th>
                <th>التصميم الأمامي</th>
                <th>التصميم الخلفي</th>
                <th>صور التركيب (أمامي)</th>
                <th>صور التركيب (خلفي)</th>
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
                  <td>${Number(record.rent_amount || 0).toLocaleString()} دينار</td>
                  <td>${record.discount_amount ? Number(record.discount_amount).toLocaleString() + ' دينار' : '-'}</td>
                  <td>${record.team_name || '-'}</td>
                  <td>
                    ${record.design_face_a_url ? `<img src="${record.design_face_a_url}" alt="التصميم الأمامي" style="max-width: 100px; max-height: 100px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;" />` : '-'}
                  </td>
                  <td>
                    ${record.design_face_b_url ? `<img src="${record.design_face_b_url}" alt="التصميم الخلفي" style="max-width: 100px; max-height: 100px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;" />` : '-'}
                  </td>
                  <td>
                    ${record.installed_image_face_a_url ? `<img src="${record.installed_image_face_a_url}" alt="تركيب وجه أمامي" style="max-width: 100px; max-height: 100px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;" />` : '-'}
                  </td>
                  <td>
                    ${record.installed_image_face_b_url ? `<img src="${record.installed_image_face_b_url}" alt="تركيب وجه خلفي" style="max-width: 100px; max-height: 100px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;" />` : '-'}
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

        {/* الإحصائيات */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm text-muted-foreground">عدد مرات التأجير</div>
              <div className="text-xl font-bold text-foreground">{totalRentals}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            <div>
              <div className="text-sm text-muted-foreground">إجمالي الإيرادات</div>
              <div className="text-xl font-bold text-foreground">{totalRevenue.toLocaleString()} دينار</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <div>
              <div className="text-sm text-muted-foreground">إجمالي أيام الإيجار</div>
              <div className="text-xl font-bold text-foreground">{totalDays} يوم</div>
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
                className="p-4 bg-background border border-border rounded-lg hover:shadow-md transition-shadow"
              >
                {/* Badge للعقد الحالي */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    {record.id.toString().startsWith('current-') && (
                      <Badge className="bg-green-500 text-white">عقد حالي نشط</Badge>
                    )}
                  </div>
                  {!record.id.toString().startsWith('current-') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRecordToDelete(record.id);
                        setDeleteDialogOpen(true);
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      رقم العقد
                    </div>
                    <div className="font-semibold text-foreground">{record.contract_number}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      اسم الزبون
                    </div>
                    <div className="font-semibold text-foreground">{record.customer_name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">نوع الإعلان</div>
                    <div className="font-semibold text-foreground">{record.ad_type || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      المبلغ
                    </div>
                    <div className="font-semibold text-foreground">
                      {Number(record.rent_amount || 0).toLocaleString()} دينار
                    </div>
                  </div>
                  {record.discount_amount && record.discount_amount > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground">الخصم</div>
                      <div className="font-semibold text-orange-500">
                        {Number(record.discount_amount).toLocaleString()} دينار
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      تاريخ البداية
                    </div>
                    <div className="text-sm text-foreground">{formatGregorianDate(record.start_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      تاريخ النهاية
                    </div>
                    <div className="text-sm text-foreground">{formatGregorianDate(record.end_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      المدة
                    </div>
                    <div className="text-sm text-foreground">{record.duration_days} يوم</div>
                  </div>
                  {record.team_name && (
                    <div>
                      <div className="text-xs text-muted-foreground">الفريق</div>
                      <div className="text-sm text-foreground">{record.team_name}</div>
                    </div>
                  )}
                </div>

                {/* صور التصميم */}
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    التصميم الأمامي
                  </div>
                  {record.design_face_a_url ? (
                    <img
                      src={record.design_face_a_url}
                      alt="التصميم الأمامي"
                      className="w-24 h-24 object-cover rounded border border-border cursor-pointer hover:opacity-80"
                      onClick={() => setSelectedImage(record.design_face_a_url)}
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground">لا يوجد تصميم</div>
                  )}
                </div>

                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    التصميم الخلفي
                  </div>
                  {record.design_face_b_url ? (
                    <img
                      src={record.design_face_b_url}
                      alt="التصميم الخلفي"
                      className="w-24 h-24 object-cover rounded border border-border cursor-pointer hover:opacity-80"
                      onClick={() => setSelectedImage(record.design_face_b_url)}
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground">لا يوجد تصميم</div>
                  )}
                </div>

                {record.design_name && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground">اسم التصميم</div>
                    <div className="text-sm text-foreground font-medium">{record.design_name}</div>
                  </div>
                )}

                {/* صور التركيب */}
                {(record.installed_image_face_a_url || record.installed_image_face_b_url) && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      صور التركيب
                    </div>
                    <div className="flex gap-2">
                      {record.installed_image_face_a_url && (
                        <img
                          src={record.installed_image_face_a_url}
                          alt="تركيب وجه أ"
                          className="w-20 h-20 object-cover rounded border border-border cursor-pointer hover:opacity-80"
                          onClick={() => setSelectedImage(record.installed_image_face_a_url)}
                        />
                      )}
                      {record.installed_image_face_b_url && (
                        <img
                          src={record.installed_image_face_b_url}
                          alt="تركيب وجه ب"
                          className="w-20 h-20 object-cover rounded border border-border cursor-pointer hover:opacity-80"
                          onClick={() => setSelectedImage(record.installed_image_face_b_url)}
                        />
                      )}
                    </div>
                  </div>
                )}

                {record.notes && record.notes !== 'عقد حالي نشط' && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground">ملاحظات</div>
                    <div className="text-sm text-foreground">{record.notes}</div>
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
            className="border-border text-foreground hover:bg-accent"
          >
            إغلاق
          </Button>
          <Button
            onClick={printHistory}
            disabled={history.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Printer className="h-4 w-4 mr-2" />
            طباعة التقرير
          </Button>
        </div>
      </DialogContent>

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