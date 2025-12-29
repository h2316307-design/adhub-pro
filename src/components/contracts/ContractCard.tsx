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
  TrendingUp, TrendingDown, Minus, ImageIcon, RefreshCw
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
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const [actualPaid, setActualPaid] = useState<number | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);

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
  
  // استخراج اللون السائد من الصورة
  const extractDominantColor = (imageUrl: string) => {
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
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < imageData.length; i += 4) {
          const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
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
          setDominantColor(`${r}, ${g}, ${b}`);
        }
      } catch (e) {
        console.log('Could not extract color');
      }
    };
    img.src = imageUrl;
  };
  
  // جلب أول صورة تصميم من مهام التركيب
  useEffect(() => {
    const fetchDesignImage = async () => {
      const contractId = (contract as any).Contract_Number || (contract as any)['Contract Number'] || contract.id;
      
      // جلب جميع مهام التركيب للعقد
      const { data: tasks } = await supabase
        .from('installation_tasks')
        .select('id')
        .eq('contract_id', contractId);
      
      if (tasks && tasks.length > 0) {
        // البحث في جميع المهام عن أي عنصر يحتوي على تصميم
        const taskIds = tasks.map(t => t.id);
        const { data: items } = await supabase
          .from('installation_task_items')
          .select('design_face_a, design_face_b')
          .in('task_id', taskIds)
          .or('design_face_a.not.is.null,design_face_b.not.is.null')
          .limit(1);
        
        if (items && items.length > 0) {
          const img = items[0].design_face_a || items[0].design_face_b;
          if (img) {
            setDesignImage(img);
            extractDominantColor(img);
          }
        }
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
    const startDate = contract.start_date ? new Date(contract.start_date) : null;
    const endDate = contract.end_date ? new Date(contract.end_date) : null;
    const today = new Date();
    
    if (!startDate || !endDate || today < startDate) {
      return { text: '—', color: 'text-muted-foreground', icon: <Minus className="h-4 w-4" /> };
    }
    
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = today.getTime() - startDate.getTime();
    const timePercentage = totalDuration > 0 ? Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100) : 0;
    const timeDifference = paymentPercentage - timePercentage;
    
    if (Math.abs(timeDifference) < 5) {
      return { text: 'متوازن', color: 'text-green-600', icon: <Minus className="h-4 w-4" /> };
    }
    if (timeDifference > 0) {
      return { text: `متقدم ${Math.abs(timeDifference).toFixed(0)}%`, color: 'text-blue-600', icon: <TrendingUp className="h-4 w-4" /> };
    }
    return { text: `متأخر ${Math.abs(timeDifference).toFixed(0)}%`, color: 'text-red-600', icon: <TrendingDown className="h-4 w-4" /> };
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

  // نمط الكارت مع اللون السائد
  const cardStyle = dominantColor ? {
    background: `linear-gradient(135deg, rgba(${dominantColor}, 0.08) 0%, transparent 50%)`,
    borderColor: `rgba(${dominantColor}, 0.3)`,
  } : {};

  return (
    <Card 
      className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg ${getCardStyle()} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      style={cardStyle}
    >
      {/* Checkbox للاختيار */}
      {onToggleSelect && (
        <div 
          className="absolute top-3 right-3 z-30 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(contract.id);
          }}
        >
          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
            isSelected 
              ? 'bg-primary border-primary text-primary-foreground' 
              : 'bg-background/80 border-border hover:border-primary backdrop-blur-sm'
          }`}>
            {isSelected && (
              <CheckCircle className="h-4 w-4" />
            )}
          </div>
        </div>
      )}
      
      {/* صورة التصميم إذا متوفرة */}
      {designImage && (
        <div className="relative h-32 w-full overflow-hidden bg-muted">
          <img 
            src={designImage} 
            alt="تصميم الإعلان" 
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute top-2 left-2">
            <Badge 
              variant="secondary" 
              className="gap-1 border-0"
              style={dominantColor ? { backgroundColor: `rgba(${dominantColor}, 0.9)`, color: 'white' } : { backgroundColor: 'rgba(0,0,0,0.6)', color: 'white' }}
            >
              <ImageIcon className="h-3 w-3" />
              تصميم متوفر
            </Badge>
          </div>
        </div>
      )}
      
      {/* شريط الحالة العلوي */}
      <div 
        className={`h-1.5 w-full ${!dominantColor ? (
          status.variant === 'destructive' ? 'bg-destructive' :
          status.variant === 'default' ? 'bg-primary' :
          status.className?.includes('orange') ? 'bg-orange-500' :
          'bg-muted'
        ) : ''}`}
        style={dominantColor ? { backgroundColor: `rgb(${dominantColor})` } : {}}
      />
      
      <CardContent className="p-5">
        {/* الرأس */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-bold text-foreground">#{contractNumber}</span>
              {yearlyCode && (
                <Badge variant="secondary" className="text-xs font-normal">
                  {yearlyCode}
                </Badge>
              )}
              <Badge variant={status.variant} className={`gap-1 ${status.className || ''}`}>
                {status.icon}
                {status.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="font-medium text-foreground">{contract.customer_name}</span>
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
        
        {/* نوع الإعلان والتواريخ */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Building className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">النوع:</span>
            <span className="font-medium">{(contract as any)['Ad Type'] || 'غير محدد'}</span>
          </div>
          {(contract as any).Phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span dir="ltr">{(contract as any).Phone}</span>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-green-600" />
            <div>
              <span className="text-muted-foreground text-xs block">البداية</span>
              <span className="font-medium">{contract.start_date ? new Date(contract.start_date).toLocaleDateString('ar') : '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-red-600" />
            <div>
              <span className="text-muted-foreground text-xs block">النهاية</span>
              <span className="font-medium">{contract.end_date ? new Date(contract.end_date).toLocaleDateString('ar') : '—'}</span>
            </div>
          </div>
        </div>
        
        {/* التكاليف */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">الإيجار</span>
            <span className="font-semibold text-green-600">{totalRent.toLocaleString('ar-LY')} د.ل</span>
          </div>
          
          {installationCost > 0 && (
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Wrench className="h-3 w-3" />
                <span>التركيب</span>
              </div>
              <span className="font-medium text-orange-600">{installationCost.toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}
          
          {printCost > 0 && (
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <PaintBucket className="h-3 w-3" />
                <span>الطباعة</span>
              </div>
              <span className="font-medium text-purple-600">{printCost.toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}
          
          {operatingFee > 0 && (
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Percent className="h-3 w-3" />
                <span>رسوم التشغيل</span>
              </div>
              <span className="font-medium text-blue-600">{operatingFee.toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}
          
          {discount > 0 && (
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <TrendingDown className="h-3 w-3" />
                <span>التخفيض</span>
              </div>
              <span className="font-medium text-red-500">- {discount.toLocaleString('ar-LY')} د.ل</span>
            </div>
          )}
          
          <div className="border-t pt-2 flex justify-between items-center">
            <span className="font-semibold">المجموع الكلي</span>
            <span className="font-bold text-lg text-primary">{finalTotalCost.toLocaleString('ar-LY')} د.ل</span>
          </div>
        </div>
        
        {/* شريط التقدم */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2 text-sm">
            <span className="text-muted-foreground">نسبة السداد</span>
            <span className="font-semibold">{paymentPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={paymentPercentage} className="h-2" />
          <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
            <span>المدفوع: {totalPaid.toLocaleString('ar-LY')} د.ل</span>
            <span>المتبقي: {remaining.toLocaleString('ar-LY')} د.ل</span>
          </div>
        </div>
        
        {/* مؤشر التقدم/التأخر */}
        <div className={`flex items-center gap-2 p-2 rounded-lg bg-muted/50 ${progress.color}`}>
          {progress.icon}
          <span className="text-sm font-medium">{progress.text}</span>
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
