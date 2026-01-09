import React, { useMemo, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Eye, Edit, Trash2, Calendar, User, DollarSign, 
  Building, AlertCircle, Clock, CheckCircle, Printer, 
  Hammer, Wrench, Percent, PaintBucket, FileText, 
  Send, FileSpreadsheet, MoreHorizontal, Phone,
  TrendingUp, TrendingDown, Minus, ImageIcon, RefreshCw,
  Maximize2, X
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Contract } from '@/services/contractService';
import { useNavigate } from 'react-router-dom';
import { AddPaymentDialog } from './AddPaymentDialog';
import { SendContractDialog } from './SendContractDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ContractCardProps {
  contract: Contract;
  yearlyCode?: string;
  onDelete: (id: string) => void;
  onPrint: (contract: Contract) => void;
  onInstall: (contract: Contract) => void;
  onBillboardPrint: (contract: Contract) => void;
  onPrintAll?: (contract: Contract) => void;
  onExport: (contract: Contract, type: 'basic' | 'detailed' | 'installation') => void;
  onRefresh: () => void;
  isSelected?: boolean;
  onToggleSelect?: (contractId: string | number) => void;
}

export const ContractCard: React.FC<ContractCardProps> = ({
  contract,
  yearlyCode,
  onDelete,
  onPrint,
  onInstall,
  onBillboardPrint,
  onPrintAll,
  onExport,
  onRefresh,
  isSelected = false,
  onToggleSelect
}) => {
  const navigate = useNavigate();
  const [designImage, setDesignImage] = useState<string | null>(null);
  // نخزن اللون كلون HSL (صيغة CSS الحديثة: "210 50% 40%")
  const [dominantHsl, setDominantHsl] = useState<string | null>(null);
  const [actualPaid, setActualPaid] = useState<number | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [showDesignFullscreen, setShowDesignFullscreen] = useState(false);
  const [customerData, setCustomerData] = useState<{ phone: string | null; company: string | null } | null>(null);

  // جلب بيانات العميل من جدول customers
  useEffect(() => {
    const fetchCustomerData = async () => {
      const customerId = (contract as any).customer_id;
      if (!customerId) return;
      
      const { data, error } = await supabase
        .from('customers')
        .select('phone, company')
        .eq('id', customerId)
        .single();
      
      if (!error && data) {
        setCustomerData(data);
      }
    };
    
    fetchCustomerData();
  }, [contract]);

  // دالة تجديد العقد - إنشاء عقد جديد من بيانات العقد الحالي
  const handleRenewContract = async () => {
    try {
      setIsRenewing(true);
      
      const contractData = contract as any;
      const billboardIds = contractData.billboard_ids || '';
      
      // حساب التواريخ الجديدة
      const today = new Date();
      const origStart = contractData['Contract Date'] || contractData.start_date;
      const origEnd = contractData['End Date'] || contractData.end_date;
      
      let durationMonths = 3; // افتراضي
      if (origStart && origEnd) {
        const sd = new Date(origStart);
        const ed = new Date(origEnd);
        const diffDays = Math.ceil((ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24));
        durationMonths = Math.max(1, Math.round(diffDays / 30));
      }
      
      const newEndDate = new Date(today);
      newEndDate.setMonth(newEndDate.getMonth() + durationMonths);
      
      // إنشاء العقد الجديد
      const { data: newContract, error } = await supabase
        .from('Contract')
        .insert({
          'Customer Name': contractData['Customer Name'] || contractData.customer_name,
          customer_id: contractData.customer_id,
          'Contract Date': today.toISOString().slice(0, 10),
          'End Date': newEndDate.toISOString().slice(0, 10),
          'Ad Type': contractData['Ad Type'] || contractData.ad_type || 'إعلان',
          'Total Rent': contractData['Total Rent'] || contractData.total_rent || 0,
          Discount: 0,
          Total: contractData['Total'] || contractData.total || 0,
          billboard_ids: billboardIds,
          billboards_count: billboardIds ? billboardIds.split(',').filter(Boolean).length : 0,
          customer_category: contractData.customer_category,
          contract_currency: contractData.contract_currency || 'LYD',
          exchange_rate: contractData.exchange_rate || '1',
          installation_cost: contractData.installation_cost || 0,
          installation_enabled: contractData.installation_enabled !== false,
          print_cost: contractData.print_cost || 0,
          print_cost_enabled: contractData.print_cost_enabled || 'false',
          print_price_per_meter: contractData.print_price_per_meter || '0',
          operating_fee_rate: contractData.operating_fee_rate || 3,
          payment_status: 'unpaid',
          'Renewal Status': 'نشط',
        })
        .select('Contract_Number')
        .single();
      
      if (error) throw error;
      
      if (newContract?.Contract_Number) {
        toast.success(`تم إنشاء العقد الجديد رقم ${newContract.Contract_Number}`);
        navigate(`/admin/contracts/edit?contract=${newContract.Contract_Number}`);
      }
    } catch (error) {
      console.error('Error renewing contract:', error);
      toast.error('حدث خطأ أثناء تجديد العقد');
    } finally {
      setIsRenewing(false);
    }
  };
  
  // جلب المدفوعات الفعلية من customer_payments
  useEffect(() => {
    const fetchActualPayments = async () => {
      const contractNumber = (contract as any).Contract_Number || (contract as any)['Contract Number'] || contract.id;
      const { data, error } = await supabase
        .from('customer_payments')
        .select('amount')
        .eq('contract_number', contractNumber);
      
      if (!error && data) {
        const total = data.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        setActualPaid(total);
      }
    };
    
    fetchActualPayments();
  }, [contract]);
  
  // حساب القيم
  const totalRent = Number(contract.rent_cost || (contract as any)['Total Rent'] || 0);
  const installationCost = Number((contract as any).installation_cost || 0);
  const printCost = Number((contract as any).print_cost || 0);
  const operatingFee = Number((contract as any).fee || 0);
  const totalCost = Number((contract as any).total_cost || (contract as any)['Total'] || 0);
  const discount = Number((contract as any).Discount || (contract as any).discount || 0);
  
  // إذا كان الإيجار = 0، لا نحسب التركيب والطباعة في المجموع المستحق لأنها لم تحدث بعد
  const hasRentalActivity = totalRent > 0 || totalCost > 0;
  const effectiveInstallationCost = hasRentalActivity ? installationCost : 0;
  const effectivePrintCost = hasRentalActivity ? printCost : 0;
  const effectiveOperatingFee = hasRentalActivity ? operatingFee : 0;
  
  const finalTotalCost = totalCost > 0 ? totalCost : (totalRent + effectiveInstallationCost + effectivePrintCost + effectiveOperatingFee);
  
  // استخدام المدفوعات الفعلية إذا توفرت، وإلا استخدام القيمة المحفوظة
  const totalPaid = actualPaid !== null ? actualPaid : Number((contract as any)['Total Paid'] || (contract as any).total_paid || 0);
  const paymentPercentage = finalTotalCost > 0 ? (totalPaid / finalTotalCost) * 100 : 0;
  const remaining = finalTotalCost - totalPaid;
  
  // استخراج اللون السائد من الصورة (كنمط HSL لتوافق أفضل مع الثيم)
  const extractDominantColor = (imageUrl: string) => {
    const rgbToHsl = (r: number, g: number, b: number) => {
      r /= 255;
      g /= 255;
      b /= 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;

      let h = 0;
      let s = 0;
      const l = (max + min) / 2;

      if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * l - 1));
        switch (max) {
          case r:
            h = ((g - b) / delta) % 6;
            break;
          case g:
            h = (b - r) / delta + 2;
            break;
          default:
            h = (r - g) / delta + 4;
        }
        h *= 60;
        if (h < 0) h += 360;
      }

      return {
        h: Math.round(h),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
      };
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);

        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0,
          g = 0,
          b = 0,
          count = 0;

        for (let i = 0; i < imageData.length; i += 4) {
          const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
          // تجاهل الأسود/الأبيض الشديد
          if (brightness > 30 && brightness < 225) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
          }
        }

        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);

          const hsl = rgbToHsl(r, g, b);
          setDominantHsl(`${hsl.h} ${hsl.s}% ${hsl.l}%`);
        } else {
          // fallback بسيط لو فشل الاستخراج
          setDominantHsl('var(--primary)');
        }
      } catch (e) {
        // غالباً بسبب CORS (canvas tainted)
        setDominantHsl('var(--primary)');
      }
    };
    img.src = imageUrl;
  };
  
  // جلب أول صورة تصميم من مهام التركيب عبر اللوحات المشتركة
  useEffect(() => {
    const fetchDesignImage = async () => {
      const rawContractNumber =
        (contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? contract.id;

      const contractNumber = Number(rawContractNumber);
      if (!Number.isFinite(contractNumber)) return;

      let foundImage: string | null = null;

      // جلب billboard_ids من العقد
      const { data: contractData } = await supabase
        .from('Contract')
        .select('billboard_ids')
        .eq('Contract_Number', contractNumber)
        .single();

      if (contractData?.billboard_ids) {
        // تحويل النص إلى مصفوفة أرقام
        const billboardIds = contractData.billboard_ids
          .split(',')
          .map((id: string) => parseInt(id.trim(), 10))
          .filter((id: number) => !isNaN(id));

        if (billboardIds.length > 0) {
          // البحث عن تصميم في installation_task_items للوحات هذا العقد
          const { data: items } = await supabase
            .from('installation_task_items')
            .select('design_face_a, design_face_b')
            .in('billboard_id', billboardIds)
            .or('design_face_a.not.is.null,design_face_b.not.is.null')
            .limit(1);

          if (items && items.length > 0) {
            foundImage = items[0].design_face_a || items[0].design_face_b;
          }
        }
      }

      // إذا وجدنا صورة، نثبتها ونستخرج اللون السائد
      if (foundImage) {
        setDesignImage(foundImage);
        extractDominantColor(foundImage);
      } else {
        setDesignImage(null);
        setDominantHsl(null);
      }
    };

    fetchDesignImage();
  }, [contract]);
  
  // حساب حالة العقد
  const getStatus = () => {
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    const startDate = new Date(contract.start_date || '');
    
    if (!contract.end_date || !contract.start_date) {
      return { label: 'غير محدد', variant: 'secondary' as const, icon: null };
    }
    
    if (today < startDate) {
      return { label: 'لم يبدأ', variant: 'secondary' as const, icon: <Clock className="h-3 w-3" /> };
    } else if (today > endDate) {
      return { label: 'منتهي', variant: 'destructive' as const, icon: <AlertCircle className="h-3 w-3" /> };
    } else {
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 7) {
        return { label: `ينتهي خلال ${daysRemaining} أيام`, variant: 'outline' as const, icon: <Clock className="h-3 w-3" />, className: 'border-orange-500 text-orange-500' };
      }
      return { label: 'نشط', variant: 'default' as const, icon: <CheckCircle className="h-3 w-3" /> };
    }
  };
  
  // حساب التقدم/التأخر
  const getProgress = () => {
    // إذا كانت نسبة السداد 100% أو أكثر - مكتمل
    if (paymentPercentage >= 100) {
      return { label: 'مكتمل', variant: 'default' as const, percent: 0, icon: <CheckCircle className="h-4 w-4" /> };
    }

    const startDate = contract.start_date ? new Date(contract.start_date) : null;
    const endDate = contract.end_date ? new Date(contract.end_date) : null;
    const today = new Date();

    if (!startDate || !endDate || today < startDate) {
      return { label: '—', variant: 'secondary' as const, percent: 0, icon: <Minus className="h-4 w-4" /> };
    }

    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = today.getTime() - startDate.getTime();
    const timePercentage = totalDuration > 0 ? Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100) : 0;
    const diff = paymentPercentage - timePercentage;
    const percent = Math.abs(diff);

    if (percent < 5) {
      return { label: 'متوازن', variant: 'secondary' as const, percent, icon: <Minus className="h-4 w-4" /> };
    }
    if (diff > 0) {
      return { label: `متقدم ${percent.toFixed(0)}%`, variant: 'default' as const, percent, icon: <TrendingUp className="h-4 w-4" /> };
    }
    return { label: `متأخر ${percent.toFixed(0)}%`, variant: 'destructive' as const, percent, icon: <TrendingDown className="h-4 w-4" /> };
  };
  
  const status = getStatus();
  const progress = getProgress();
  const contractNumber = String((contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? contract.id);
  
  // تحديد لون الكارد حسب الحالة
  const getCardStyle = () => {
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    
    if (!contract.end_date) return '';
    
    if (today > endDate) {
      return 'border-destructive/50 bg-destructive/5';
    }
    
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining <= 7 && daysRemaining > 0) {
      return 'border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20';
    }
    
    return 'border-border hover:border-primary/50';
  };

  // نمط الكارت مع اللون السائد - ألوان قوية وواضحة جداً
  const cardStyle = dominantHsl
    ? {
        background: `linear-gradient(145deg, hsl(${dominantHsl} / 0.35) 0%, hsl(${dominantHsl} / 0.18) 40%, hsl(${dominantHsl} / 0.08) 80%, transparent 100%)`,
        borderColor: `hsl(${dominantHsl} / 0.75)`,
        borderWidth: '3px',
        boxShadow: `0 12px 32px hsl(${dominantHsl} / 0.3), 0 4px 12px hsl(${dominantHsl} / 0.2), inset 0 0 60px hsl(${dominantHsl} / 0.1)`,
      }
    : {};

  return (
    <Card 
      className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg ${getCardStyle()} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      style={cardStyle}
    >
      {/* Checkbox للاختيار - في أعلى اليمين فوق كل شيء */}
      {onToggleSelect && (
        <div 
          className="absolute -top-1 -right-1 z-50 cursor-pointer p-2"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(contract.id);
          }}
        >
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shadow-md ${
            isSelected 
              ? 'bg-primary border-primary text-primary-foreground' 
              : 'bg-background border-border hover:border-primary'
          }`}>
            {isSelected && (
              <CheckCircle className="h-4 w-4" />
            )}
          </div>
        </div>
      )}
      
      {/* صورة التصميم إذا متوفرة */}
      {designImage && (
        <>
          <div 
            className="relative h-32 w-full overflow-hidden bg-muted cursor-pointer group/design"
            onClick={() => setShowDesignFullscreen(true)}
          >
            <img 
              src={designImage} 
              alt="تصميم الإعلان" 
              className="w-full h-full object-cover transition-transform duration-300 group-hover/design:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover/design:bg-black/20 transition-colors duration-300 flex items-center justify-center">
              <Maximize2 className="h-8 w-8 text-white opacity-0 group-hover/design:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="absolute top-2 left-2">
              <Badge
                variant="secondary"
                className="gap-1 border-0"
                style={
                  dominantHsl
                    ? {
                        backgroundColor: `hsl(${dominantHsl} / 0.92)`,
                        color: 'hsl(var(--primary-foreground))',
                      }
                    : {
                        backgroundColor: 'hsl(var(--foreground) / 0.6)',
                        color: 'hsl(var(--primary-foreground))',
                      }
                }
              >
                <ImageIcon className="h-3 w-3" />
                تصميم متوفر
              </Badge>
            </div>
          </div>
          
          {/* Fullscreen Design Modal */}
          {showDesignFullscreen && (
            <div 
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
              onClick={() => setShowDesignFullscreen(false)}
            >
              <button
                onClick={() => setShowDesignFullscreen(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="h-6 w-6 text-white" />
              </button>
              <img 
                src={designImage} 
                alt="تصميم الإعلان - عرض كامل" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
                عقد #{contractNumber} - {contract.customer_name}
              </div>
            </div>
          )}
        </>
      )}
      
      {/* شريط الحالة العلوي */}
      <div
        className={`h-1.5 w-full ${
          !dominantHsl
            ? status.variant === 'destructive'
              ? 'bg-destructive'
              : status.variant === 'default'
                ? 'bg-primary'
                : status.className?.includes('orange')
                  ? 'bg-orange-500'
                  : 'bg-muted'
            : ''
        }`}
        style={dominantHsl ? { backgroundColor: `hsl(${dominantHsl})` } : {}}
      />
      
      <CardContent className="p-5">
        {/* الرأس */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl font-bold font-manrope text-foreground">#{contractNumber}</span>
              {yearlyCode && (
                <Badge variant="secondary" className="text-base font-bold font-manrope px-2 py-1">
                  {yearlyCode}
                </Badge>
              )}
              <Badge variant={status.variant} className={`gap-1 ${status.className || ''}`}>
                {status.icon}
                {status.label}
              </Badge>
            </div>
            {/* اسم العميل مع الشركة والهاتف */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-bold text-xl text-foreground">{contract.customer_name}</span>
              </div>
              {(contract.Company || customerData?.company) && (
                <div className="flex items-center gap-1.5">
                  <Building className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-lg text-primary">{contract.Company || customerData?.company}</span>
                </div>
              )}
              {(contract.Phone || customerData?.phone) && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span dir="ltr" className="font-manrope font-semibold text-lg text-muted-foreground">{contract.Phone || customerData?.phone}</span>
                </div>
              )}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate(`/admin/contracts/view/${contract.id}`)}>
                <Eye className="h-4 w-4 ml-2" />
                عرض التفاصيل
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/admin/contracts/edit?contract=${contract.id}`)}>
                <Edit className="h-4 w-4 ml-2" />
                تعديل
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleRenewContract}
                disabled={isRenewing}
                className="text-green-600 focus:text-green-600"
              >
                <RefreshCw className={`h-4 w-4 ml-2 ${isRenewing ? 'animate-spin' : ''}`} />
                {isRenewing ? 'جاري التجديد...' : 'تجديد العقد'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onPrint(contract)}>
                <Printer className="h-4 w-4 ml-2" />
                طباعة العقد
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onInstall(contract)}>
                <Hammer className="h-4 w-4 ml-2" />
                طباعة التركيب
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBillboardPrint(contract)}>
                <FileText className="h-4 w-4 ml-2" />
                لوحات منفصلة
              </DropdownMenuItem>
              {onPrintAll && (
                <DropdownMenuItem onClick={() => onPrintAll(contract)}>
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة الكل
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => {
                const contractNum = (contract as any).Contract_Number || (contract as any)['Contract Number'] || contract.id;
                window.location.href = `/admin/billboard-print-settings?contract=${contractNum}`;
              }}>
                <Printer className="h-4 w-4 ml-2" />
                طباعة منفصلة (متقدم)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onExport(contract, 'basic')}>
                <FileSpreadsheet className="h-4 w-4 ml-2" />
                تصدير Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(String(contract.id))}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 ml-2" />
                حذف العقد
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* نوع الإعلان */}
        <div className="flex items-center gap-2 mb-4">
          <PaintBucket className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-base">نوع الإعلان:</span>
          <span className="font-bold text-xl text-primary">{(contract as any)['Ad Type'] || 'غير محدد'}</span>
        </div>
        
        {/* التواريخ */}
        <div className="grid grid-cols-2 gap-3 mb-3 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            <div>
              <span className="text-muted-foreground text-xs block">البداية</span>
              <span className="font-semibold font-manrope text-base">{contract.start_date ? new Date(contract.start_date).toLocaleDateString('ar') : '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-red-600" />
            <div>
              <span className="text-muted-foreground text-xs block">النهاية</span>
              <span className="font-semibold font-manrope text-base">{contract.end_date ? new Date(contract.end_date).toLocaleDateString('ar') : '—'}</span>
            </div>
          </div>
        </div>
        
        {/* شريط السداد - محسّن وأوضح */}
        <div 
          className="mb-4 p-3 rounded-xl border-2"
          style={dominantHsl ? {
            background: `linear-gradient(135deg, hsl(${dominantHsl} / 0.12) 0%, hsl(${dominantHsl} / 0.04) 100%)`,
            borderColor: `hsl(${dominantHsl} / 0.4)`,
          } : {
            background: 'hsl(var(--muted) / 0.5)',
            borderColor: 'hsl(var(--border))',
          }}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">نسبة السداد</span>
            </div>
            <span 
              className="text-2xl font-bold font-manrope"
              style={dominantHsl ? { color: `hsl(${dominantHsl})` } : { color: 'hsl(var(--primary))' }}
            >
              {paymentPercentage.toFixed(0)}%
            </span>
          </div>
          <div 
            className="relative h-4 rounded-full overflow-hidden"
            style={{ backgroundColor: dominantHsl ? `hsl(${dominantHsl} / 0.2)` : 'hsl(var(--muted))' }}
          >
            <div 
              className="absolute inset-y-0 right-0 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(paymentPercentage, 100)}%`,
                background: dominantHsl 
                  ? `linear-gradient(90deg, hsl(${dominantHsl}) 0%, hsl(${dominantHsl} / 0.8) 100%)`
                  : 'linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%)',
                boxShadow: dominantHsl ? `0 0 12px hsl(${dominantHsl} / 0.5)` : '0 0 12px hsl(var(--primary) / 0.5)',
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-muted-foreground text-sm">
              المدفوع:{' '}
              <span className="font-bold font-manrope text-base" style={{ color: 'hsl(var(--primary))' }}>
                {totalPaid.toLocaleString('ar-LY')} د.ل
              </span>
            </span>
            <span className="text-muted-foreground text-sm">
              المتبقي:{' '}
              <span className="font-bold font-manrope text-base" style={{ color: 'hsl(var(--foreground))' }}>
                {remaining.toLocaleString('ar-LY')} د.ل
              </span>
            </span>
          </div>

          {/* ✅ متأخر/متوازن/متقدم تحت شريط السداد */}
          <div className="mt-2">
            <Badge
              variant={progress.variant}
              className="gap-1"
              style={
                dominantHsl
                  ? {
                      backgroundColor:
                        progress.variant === 'default'
                          ? `hsl(${dominantHsl} / 0.18)`
                          : progress.variant === 'destructive'
                            ? 'hsl(var(--destructive) / 0.12)'
                            : 'hsl(var(--muted) / 0.7)',
                      borderColor:
                        progress.variant === 'default'
                          ? `hsl(${dominantHsl} / 0.5)`
                          : progress.variant === 'destructive'
                            ? 'hsl(var(--destructive) / 0.35)'
                            : 'hsl(var(--border))',
                      color:
                        progress.variant === 'default'
                          ? `hsl(${dominantHsl})`
                          : progress.variant === 'destructive'
                            ? 'hsl(var(--destructive))'
                            : 'hsl(var(--foreground))',
                    }
                  : undefined
              }
            >
              {progress.icon}
              <span className="text-sm font-medium">{progress.label}</span>
            </Badge>
          </div>
        </div>
        
        {/* التكاليف */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">الإيجار</span>
            <span className="font-bold font-manrope text-base" style={{ color: 'hsl(var(--primary))' }}>
              {totalRent.toLocaleString('ar-LY')} د.ل
            </span>
          </div>
          
          {installationCost > 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                <Wrench className="h-3 w-3" />
                <span>التركيب</span>
              </div>
              <span className="font-semibold font-manrope text-base" style={{ color: 'hsl(var(--foreground))' }}>
                {installationCost.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          )}
          
          {printCost > 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                <PaintBucket className="h-3 w-3" />
                <span>الطباعة</span>
              </div>
              <span className="font-semibold font-manrope text-base" style={{ color: 'hsl(var(--foreground))' }}>
                {printCost.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          )}
          
          {operatingFee > 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                <Percent className="h-3 w-3" />
                <span>رسوم التشغيل</span>
              </div>
              <span className="font-semibold font-manrope text-base" style={{ color: 'hsl(var(--foreground))' }}>
                {operatingFee.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          )}
          
          {discount > 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                <TrendingDown className="h-3 w-3" />
                <span>التخفيض</span>
              </div>
              <span className="font-semibold font-manrope text-base" style={{ color: 'hsl(var(--destructive))' }}>
                - {discount.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
          )}
          
          <div className="border-t pt-2 flex justify-between items-center">
            <span className="font-semibold">المجموع الكلي</span>
            <span className="font-bold font-manrope text-xl text-primary">{finalTotalCost.toLocaleString('ar-LY')} د.ل</span>
          </div>
        </div>
        {/* الأزرار السريعة */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/admin/contracts/view/${contract.id}`)}
            className="flex-1 gap-1"
          >
            <Eye className="h-4 w-4" />
            عرض
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPrint(contract)}
            className="flex-1 gap-1"
          >
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onBillboardPrint(contract)}
            className="flex-1 gap-1"
            title="طباعة لوحات منفصلة"
          >
            <FileText className="h-4 w-4" />
            منفصلة
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/admin/contracts/edit?contract=${contract.id}`)}
            className="flex-1 gap-1"
          >
            <Edit className="h-4 w-4" />
            تعديل
          </Button>
          <AddPaymentDialog
            contractNumber={contractNumber}
            customerName={contract.customer_name || ''}
            customerId={(contract as any).customer_id}
            onPaymentAdded={onRefresh}
          />
        </div>
      </CardContent>
    </Card>
  );
};
