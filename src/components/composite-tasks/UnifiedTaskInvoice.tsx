import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Printer, Loader2, X, FileText, Wrench, Scissors, Building2, EyeOff, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CompositeTaskWithDetails } from '@/types/composite-task';
import {
  SharedInvoiceSettings,
  IndividualInvoiceSettings,
  AllInvoiceSettings,
  DEFAULT_SHARED_SETTINGS,
  DEFAULT_INDIVIDUAL_SETTINGS,
} from '@/types/invoice-templates';

const UNIFIED_SETTINGS_KEY = 'unified_invoice_templates_settings';

export type InvoiceType = 'customer' | 'print_vendor' | 'cutout_vendor' | 'installation_team';

interface InvoiceItem {
  designImage?: string;
  face: 'a' | 'b';
  sizeName: string;
  width: number;
  height: number;
  quantity: number;
  area: number;
  unitCost: number;
  totalCost: number;
  cutoutQuantity?: number;
  cutoutUnitCost?: number;
  cutoutTotalCost?: number;
  billboardName?: string;
}

interface UnifiedTaskInvoiceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CompositeTaskWithDetails;
  invoiceType: InvoiceType;
  invoiceData?: {
    items: InvoiceItem[];
    vendorName?: string;
    teamName?: string;
    pricePerMeter?: number;
    cutoutPricePerUnit?: number;
    totalArea?: number;
    totalCutouts?: number;
    totalCost?: number;
  };
}

export function UnifiedTaskInvoice({
  open,
  onOpenChange,
  task,
  invoiceType,
  invoiceData,
}: UnifiedTaskInvoiceProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shared, setShared] = useState<SharedInvoiceSettings>(DEFAULT_SHARED_SETTINGS);
  const [individual, setIndividual] = useState<IndividualInvoiceSettings>(DEFAULT_INDIVIDUAL_SETTINGS);
  const [showCosts, setShowCosts] = useState(true);
  const [data, setData] = useState<typeof invoiceData>(invoiceData);

  // Load settings and data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load unified settings
        const { data: unifiedData } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', UNIFIED_SETTINGS_KEY)
          .maybeSingle();

        if (unifiedData?.setting_value) {
          const allSettings: AllInvoiceSettings = JSON.parse(unifiedData.setting_value);
          if (allSettings.shared) {
            setShared({ ...DEFAULT_SHARED_SETTINGS, ...allSettings.shared });
          }
          if (allSettings.individual && allSettings.individual['sizes_invoice']) {
            setIndividual({ ...DEFAULT_INDIVIDUAL_SETTINGS, ...allSettings.individual['sizes_invoice'] });
          }
        }

        // If no data provided, load based on invoice type
        if (!invoiceData) {
          await loadInvoiceData();
        } else {
          setData(invoiceData);
        }
      } catch (e) {
        console.error('Error loading settings:', e);
      } finally {
        setIsLoading(false);
      }
    };

    if (open) {
      loadData();
    }
  }, [open, invoiceType, task.id]);

  const loadInvoiceData = async () => {
    const items: InvoiceItem[] = [];
    let vendorName = '';
    let teamName = '';
    let pricePerMeter = 0;
    let cutoutPricePerUnit = 0;
    let totalArea = 0;
    let totalCutouts = 0;
    let totalCost = 0;

    try {
      // Load sizes map
      const { data: sizesData } = await supabase.from('sizes').select('name, width, height, installation_price');
      const sizesMap: Record<string, { width: number; height: number; installationPrice: number }> = {};
      sizesData?.forEach((s: any) => {
        sizesMap[s.name] = { width: s.width || 0, height: s.height || 0, installationPrice: s.installation_price || 0 };
      });

      // جلب صور التصميم من مصادر مختلفة
      let designImages: Record<number, { face_a?: string; face_b?: string }> = {};
      
      // من print_task_items
      if (task.print_task_id) {
        const { data: printItems } = await supabase
          .from('print_task_items')
          .select('billboard_id, design_face_a, design_face_b')
          .eq('task_id', task.print_task_id);
        printItems?.forEach((item: any) => {
          if (item.billboard_id) {
            designImages[item.billboard_id] = { face_a: item.design_face_a, face_b: item.design_face_b };
          }
        });
      }
      
      // من installation_task_items
      if (task.installation_task_id) {
        const { data: installItems } = await supabase
          .from('installation_task_items')
          .select('billboard_id, design_face_a, design_face_b')
          .eq('task_id', task.installation_task_id);
        installItems?.forEach((item: any) => {
          if (item.billboard_id && !designImages[item.billboard_id]) {
            designImages[item.billboard_id] = { face_a: item.design_face_a, face_b: item.design_face_b };
          }
        });
      }

      if (invoiceType === 'print_vendor' && task.print_task_id) {
        // Load print task data
        const [printTaskResult, itemsResult] = await Promise.all([
          supabase.from('print_tasks').select('*, printer:printers!print_tasks_printer_id_fkey(name)').eq('id', task.print_task_id).single(),
          supabase.from('print_task_items').select('*').eq('task_id', task.print_task_id),
        ]);

        const printTask = printTaskResult.data;
        const printItems = itemsResult.data || [];
        vendorName = (printTask as any)?.printer?.name || 'غير محدد';
        totalArea = printItems.reduce((sum: number, item: any) => sum + (item.area * item.quantity), 0);
        totalCost = task.company_print_cost || 0;
        pricePerMeter = totalArea > 0 ? totalCost / totalArea : 0;

        printItems.forEach((item: any) => {
          if (item.design_face_a) {
            items.push({
              designImage: item.design_face_a,
              face: 'a',
              sizeName: item.size_name || `${item.width}×${item.height}`,
              width: item.width,
              height: item.height,
              quantity: item.quantity,
              area: item.area * item.quantity,
              unitCost: pricePerMeter,
              totalCost: item.area * item.quantity * pricePerMeter,
            });
          }
          if (item.design_face_b) {
            items.push({
              designImage: item.design_face_b,
              face: 'b',
              sizeName: item.size_name || `${item.width}×${item.height}`,
              width: item.width,
              height: item.height,
              quantity: item.quantity,
              area: item.area * item.quantity,
              unitCost: pricePerMeter,
              totalCost: item.area * item.quantity * pricePerMeter,
            });
          }
        });
      } else if (invoiceType === 'cutout_vendor' && task.cutout_task_id) {
        // Load cutout task data
        const [cutoutTaskResult, cutoutItemsResult] = await Promise.all([
          supabase.from('cutout_tasks').select('*, printer:printers!cutout_tasks_printer_id_fkey(name)').eq('id', task.cutout_task_id).single(),
          supabase.from('cutout_task_items').select('*, billboard:billboards(Billboard_Name, Size)').eq('task_id', task.cutout_task_id),
        ]);

        const cutoutTask = cutoutTaskResult.data;
        const cutoutItems = cutoutItemsResult.data || [];
        vendorName = (cutoutTask as any)?.printer?.name || 'غير محدد';
        totalCutouts = cutoutTask?.total_quantity || cutoutItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
        totalCost = task.company_cutout_cost || 0;
        cutoutPricePerUnit = totalCutouts > 0 ? totalCost / totalCutouts : 0;

        cutoutItems.forEach((item: any) => {
          const billboardId = item.billboard_id;
          const designs = designImages[billboardId] || {};
          // الحصول على صورة التصميم من cutout_task_items نفسه أو من designImages
          const cutoutImage = item.cutout_image_url || designs.face_a || designs.face_b;
          
          items.push({
            designImage: cutoutImage,
            face: 'a',
            sizeName: item.description || item.billboard?.Size || 'مجسم',
            width: 0,
            height: 0,
            quantity: item.quantity,
            area: 0,
            unitCost: cutoutPricePerUnit,
            totalCost: item.quantity * cutoutPricePerUnit,
            billboardName: item.billboard?.Billboard_Name,
          });
        });
      } else if (invoiceType === 'installation_team' && task.installation_task_id) {
        // Load installation task data
        const [installTaskResult, installItemsResult] = await Promise.all([
          supabase.from('installation_tasks').select('*, team:installation_teams(team_name)').eq('id', task.installation_task_id).single(),
          supabase.from('installation_task_items').select('*, billboard:billboards(ID, Billboard_Name, Size, design_face_a, design_face_b)').eq('task_id', task.installation_task_id),
        ]);

        const installTask = installTaskResult.data;
        const installItems = installItemsResult.data || [];
        teamName = (installTask as any)?.team?.team_name || 'غير محدد';
        
        installItems.forEach((item: any) => {
          const billboardSize = item.billboard?.Size;
          const sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0, installationPrice: 0 };
          
          // جلب صورة التصميم من مصادر متعددة
          const billboardId = item.billboard?.ID || item.billboard_id;
          const designs = designImages[billboardId] || {};
          const designImage = item.design_face_a || item.design_face_b || 
                             designs.face_a || designs.face_b ||
                             item.billboard?.design_face_a || item.billboard?.design_face_b;

          items.push({
            designImage,
            face: 'a',
            sizeName: billboardSize || 'غير محدد',
            width: sizeInfo.width,
            height: sizeInfo.height,
            quantity: 1,
            area: sizeInfo.width * sizeInfo.height,
            unitCost: sizeInfo.installationPrice,
            totalCost: sizeInfo.installationPrice,
            billboardName: item.billboard?.Billboard_Name,
          });
        });

        totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
      } else if (invoiceType === 'customer') {
        // Customer invoice - جلب بيانات من installation_task_items للحصول على اللوحات
        if (task.installation_task_id) {
          const { data: installItems } = await supabase
            .from('installation_task_items')
            .select('*, billboard:billboards(ID, Billboard_Name, Size, design_face_a, design_face_b)')
            .eq('task_id', task.installation_task_id);

          if (installItems && installItems.length > 0) {
            // حساب سعر المتر للطباعة
            totalArea = 0;
            installItems.forEach((item: any) => {
              const billboardSize = item.billboard?.Size;
              const sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0 };
              const facesCount = item.faces_count || 1;
              totalArea += sizeInfo.width * sizeInfo.height * facesCount;
            });
            
            pricePerMeter = totalArea > 0 ? (task.customer_print_cost || 0) / totalArea : 0;

            installItems.forEach((item: any) => {
              const billboardSize = item.billboard?.Size;
              const sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0 };
              const billboardId = item.billboard?.ID || item.billboard_id;
              const designs = designImages[billboardId] || {};
              
              const faceAImage = item.design_face_a || designs.face_a || item.billboard?.design_face_a;
              const faceBImage = item.design_face_b || designs.face_b || item.billboard?.design_face_b;
              const facesCount = item.faces_count || 1;
              const areaPerFace = sizeInfo.width * sizeInfo.height;

              // إضافة الوجه الأول
              if (faceAImage || facesCount >= 1) {
                items.push({
                  designImage: faceAImage,
                  face: 'a',
                  sizeName: billboardSize || `${sizeInfo.width}×${sizeInfo.height}`,
                  width: sizeInfo.width,
                  height: sizeInfo.height,
                  quantity: 1,
                  area: areaPerFace,
                  unitCost: pricePerMeter,
                  totalCost: areaPerFace * pricePerMeter,
                  billboardName: item.billboard?.Billboard_Name,
                });
              }

              // إضافة الوجه الثاني إذا كان موجوداً
              if (faceBImage || facesCount >= 2) {
                items.push({
                  designImage: faceBImage,
                  face: 'b',
                  sizeName: billboardSize || `${sizeInfo.width}×${sizeInfo.height}`,
                  width: sizeInfo.width,
                  height: sizeInfo.height,
                  quantity: 1,
                  area: areaPerFace,
                  unitCost: pricePerMeter,
                  totalCost: areaPerFace * pricePerMeter,
                  billboardName: item.billboard?.Billboard_Name,
                });
              }
            });
          }
        } else if (task.print_task_id) {
          // فولباك: من print_task_items
          const { data: printItems } = await supabase
            .from('print_task_items')
            .select('*')
            .eq('task_id', task.print_task_id);

          totalArea = printItems?.reduce((sum: number, item: any) => sum + (item.area * item.quantity), 0) || 0;
          pricePerMeter = totalArea > 0 ? (task.customer_print_cost || 0) / totalArea : 0;

          printItems?.forEach((item: any) => {
            if (item.design_face_a) {
              items.push({
                designImage: item.design_face_a,
                face: 'a',
                sizeName: item.size_name || `${item.width}×${item.height}`,
                width: item.width,
                height: item.height,
                quantity: item.quantity,
                area: item.area * item.quantity,
                unitCost: pricePerMeter,
                totalCost: item.area * item.quantity * pricePerMeter,
              });
            }
            if (item.design_face_b) {
              items.push({
                designImage: item.design_face_b,
                face: 'b',
                sizeName: item.size_name || `${item.width}×${item.height}`,
                width: item.width,
                height: item.height,
                quantity: item.quantity,
                area: item.area * item.quantity,
                unitCost: pricePerMeter,
                totalCost: item.area * item.quantity * pricePerMeter,
              });
            }
          });
        }

        // Load cutout data
        if (task.cutout_task_id) {
          const { data: cutoutTask } = await supabase
            .from('cutout_tasks')
            .select('total_quantity')
            .eq('id', task.cutout_task_id)
            .single();
          totalCutouts = cutoutTask?.total_quantity || 0;
          cutoutPricePerUnit = totalCutouts > 0 ? (task.customer_cutout_cost || 0) / totalCutouts : 0;
        }

        totalCost = task.customer_total || 0;
      }

      setData({
        items,
        vendorName,
        teamName,
        pricePerMeter,
        cutoutPricePerUnit,
        totalArea,
        totalCutouts,
        totalCost,
      });
    } catch (error) {
      console.error('Error loading invoice data:', error);
      toast.error('فشل في تحميل بيانات الفاتورة');
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;

    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('فشل فتح نافذة الطباعة');
      return;
    }

    const fontFamily = shared.fontFamily || 'Doran';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${getInvoiceTitle()}</title>
        <style>
          @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
          @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
          @font-face { font-family: 'Manrope'; src: url('/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
          @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
          
          * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { font-family: '${fontFamily}', 'Noto Sans Arabic', Arial, sans-serif; direction: rtl; background: #fff; }
          
          .print-container {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm;
            background: #fff;
          }
          
          @media print {
            @page { size: A4; margin: 15mm; }
            .print-container { width: 100%; min-height: auto; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${printContent}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 800);
  };

  const getInvoiceTitle = () => {
    switch (invoiceType) {
      case 'customer': return `فاتورة الزبون - ${task.customer_name}`;
      case 'print_vendor': return `فاتورة الطباعة - ${data?.vendorName || 'المطبعة'}`;
      case 'cutout_vendor': return `فاتورة القص - ${data?.vendorName || 'المطبعة'}`;
      case 'installation_team': return `فاتورة التركيب - ${data?.teamName || 'الفرقة'}`;
      default: return 'فاتورة';
    }
  };

  const getInvoiceIcon = () => {
    switch (invoiceType) {
      case 'customer': return <FileText className="h-5 w-5 text-primary" />;
      case 'print_vendor': return <Printer className="h-5 w-5 text-blue-600" />;
      case 'cutout_vendor': return <Scissors className="h-5 w-5 text-purple-600" />;
      case 'installation_team': return <Wrench className="h-5 w-5 text-green-600" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getRecipientInfo = () => {
    switch (invoiceType) {
      case 'customer':
        return { label: 'العميل', name: task.customer_name || 'غير محدد' };
      case 'print_vendor':
        return { label: 'المطبعة', name: data?.vendorName || 'غير محدد' };
      case 'cutout_vendor':
        return { label: 'ورشة القص', name: data?.vendorName || 'غير محدد' };
      case 'installation_team':
        return { label: 'فرقة التركيب', name: data?.teamName || 'غير محدد' };
      default:
        return { label: 'المستلم', name: 'غير محدد' };
    }
  };

  const primaryColor = individual.primaryColor || '#D4AF37';
  const secondaryColor = individual.secondaryColor || '#1a1a2e';
  const tableHeaderBg = individual.tableHeaderBgColor || '#D4AF37';
  const tableHeaderText = individual.tableHeaderTextColor || '#ffffff';
  const tableBorder = individual.tableBorderColor || '#D4AF37';
  const tableRowEven = individual.tableRowEvenColor || '#f8f9fa';
  const tableRowOdd = individual.tableRowOddColor || '#ffffff';
  const tableText = individual.tableTextColor || '#333333';
  const totalBg = individual.totalBgColor || '#D4AF37';
  const totalText = individual.totalTextColor || '#ffffff';

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const recipient = getRecipientInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] p-0">
        <DialogHeader className="p-4 border-b bg-gradient-to-l from-primary/5 to-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                {getInvoiceIcon()}
              </div>
              <div>
                <DialogTitle className="text-lg">{getInvoiceTitle()}</DialogTitle>
                <p className="text-sm text-muted-foreground">عقد #{task.contract_id}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {invoiceType !== 'customer' && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="showCosts"
                    checked={showCosts}
                    onCheckedChange={setShowCosts}
                  />
                  <Label htmlFor="showCosts" className="text-sm cursor-pointer flex items-center gap-1">
                    {showCosts ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {showCosts ? 'إظهار التكلفة' : 'إخفاء التكلفة'}
                  </Label>
                </div>
              )}
              <Button onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                طباعة
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(95vh-80px)]">
          <div className="p-6 flex justify-center bg-muted/30">
            <div
              ref={printRef}
              className="bg-white shadow-2xl"
              style={{
                width: '210mm',
                minHeight: '297mm',
                backgroundColor: '#fff',
                fontFamily: `${shared.fontFamily || 'Doran'}, 'Noto Sans Arabic', Arial, sans-serif`,
                padding: '15mm',
                direction: 'rtl',
                color: tableText,
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '20px',
                paddingBottom: '15px',
                borderBottom: `3px solid ${primaryColor}`,
              }}>
                <div style={{ flex: 1 }}>
                  <h1 style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: secondaryColor,
                    marginBottom: '8px',
                  }}>
                    {invoiceType === 'customer' ? 'فاتورة العميل' : 
                     invoiceType === 'print_vendor' ? 'فاتورة طباعة' :
                     invoiceType === 'cutout_vendor' ? 'فاتورة قص مجسمات' : 'فاتورة تركيب'}
                  </h1>
                  <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.8 }}>
                    <div>التاريخ: {format(new Date(), 'dd MMMM yyyy', { locale: ar })}</div>
                    <div>رقم العقد: #{task.contract_id}</div>
                  </div>
                </div>

                {shared.showLogo && shared.logoPath && (
                  <img
                    src={shared.logoPath}
                    alt="Logo"
                    style={{ height: '60px', objectFit: 'contain' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>

              {/* Recipient Info */}
              <div style={{
                background: `linear-gradient(135deg, #f8f9fa, #ffffff)`,
                padding: '20px',
                marginBottom: '24px',
                borderRadius: '12px',
                borderRight: `5px solid ${primaryColor}`,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{recipient.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: primaryColor }}>{recipient.name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    {invoiceType === 'print_vendor' && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: primaryColor, fontFamily: 'Manrope' }}>
                          {(data?.totalArea || 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>م² إجمالي</div>
                      </div>
                    )}
                    {invoiceType === 'cutout_vendor' && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: primaryColor, fontFamily: 'Manrope' }}>
                          {data?.totalCutouts || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>مجسم</div>
                      </div>
                    )}
                    {invoiceType === 'installation_team' && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: primaryColor, fontFamily: 'Manrope' }}>
                          {data?.items?.length || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>لوحة</div>
                      </div>
                    )}
                    {showCosts && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: primaryColor, fontFamily: 'Manrope' }}>
                          {(data?.totalCost || 0).toLocaleString('ar-LY')}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>د.ل</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '24px' }}>
                <thead>
                  <tr style={{ backgroundColor: tableHeaderBg }}>
                    <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '8%' }}>#</th>
                    <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '12%' }}>التصميم</th>
                    {invoiceType === 'installation_team' && (
                      <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>اللوحة</th>
                    )}
                    <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>المقاس</th>
                    {(invoiceType === 'print_vendor' || invoiceType === 'customer') && (
                      <>
                        <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>الكمية</th>
                        <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>المساحة</th>
                      </>
                    )}
                    {invoiceType === 'cutout_vendor' && (
                      <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>العدد</th>
                    )}
                    {showCosts && (
                      <>
                        <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>السعر</th>
                        <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>الإجمالي</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data?.items?.map((item, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? tableRowEven : tableRowOdd }}>
                      <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center' }}>
                        {item.designImage ? (
                          <div>
                            <img
                              src={item.designImage}
                              alt="تصميم"
                              style={{ maxWidth: '50px', maxHeight: '50px', objectFit: 'contain', margin: '0 auto', borderRadius: '4px' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                              {item.face === 'a' ? 'أمامي' : 'خلفي'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#999' }}>-</span>
                        )}
                      </td>
                      {invoiceType === 'installation_team' && (
                        <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontWeight: 'bold' }}>
                          {item.billboardName || '-'}
                        </td>
                      )}
                      <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontWeight: 'bold' }}>
                        {item.sizeName}
                      </td>
                      {(invoiceType === 'print_vendor' || invoiceType === 'customer') && (
                        <>
                          <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope' }}>
                            {item.quantity}
                          </td>
                          <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope' }}>
                            {item.area.toFixed(2)} م²
                          </td>
                        </>
                      )}
                      {invoiceType === 'cutout_vendor' && (
                        <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold' }}>
                          {item.quantity}
                        </td>
                      )}
                      {showCosts && (
                        <>
                          <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope' }}>
                            {item.unitCost.toFixed(2)} د.ل
                          </td>
                          <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: primaryColor }}>
                            {item.totalCost.toFixed(2)} د.ل
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total Section */}
              {showCosts && (
                <div style={{
                  background: `linear-gradient(135deg, ${totalBg}, ${totalBg}dd)`,
                  padding: '20px',
                  textAlign: 'center',
                  borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '14px', color: totalText, opacity: 0.9, marginBottom: '6px' }}>
                    الإجمالي المستحق
                  </div>
                  <div style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    color: totalText,
                    fontFamily: 'Manrope',
                  }}>
                    {(data?.totalCost || 0).toLocaleString('ar-LY')}
                    <span style={{ fontSize: '16px', marginRight: '8px' }}>دينار ليبي</span>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div style={{
                marginTop: '30px',
                paddingTop: '15px',
                borderTop: `1px solid ${tableBorder}`,
                textAlign: 'center',
                fontSize: '10px',
                color: '#666',
              }}>
                {shared.footerText || 'شكراً لتعاملكم معنا'}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
