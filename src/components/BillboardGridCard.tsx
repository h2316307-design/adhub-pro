import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { MapPin, Calendar, Building, Eye, User, FileText, Clock, Camera, ChevronDown, ChevronUp, CheckCircle2, XCircle, History, EyeOff, Wrench, CalendarPlus, Pencil, ImageIcon, Check, ZoomIn, X, Copy } from 'lucide-react';
import { Billboard } from '@/types';
import { formatGregorianDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { BillboardImage } from './BillboardImage';
import { BillboardImageWithBlur } from './BillboardImageWithBlur';
import { DesignImageWithBlur } from './DesignImageWithBlur';
import { BillboardHistoryDialog } from './billboards/BillboardHistoryDialog';
import { BillboardExtendRentalDialog } from './billboards/BillboardExtendRentalDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BillboardGridCardProps {
  billboard: Billboard & {
    contract?: {
      id: string;
      customer_name: string;
      ad_type: string;
      "Ad Type": string;
      start_date: string;
      end_date: string;
      rent_cost: number;
    };
  };
  onBooking?: (billboard: Billboard) => void;
  onViewDetails?: (billboard: Billboard) => void;
  showBookingActions?: boolean;
  onUpdate?: () => void; // ✅ Callback لتحديث البيانات بدون إعادة تحميل الصفحة
  // ✅ خصائص الاختيار الجديدة
  isSelectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export const BillboardGridCard: React.FC<BillboardGridCardProps> = ({
  billboard,
  onBooking,
  onViewDetails,
  showBookingActions = true,
  onUpdate,
  isSelectable = false,
  isSelected = false,
  onToggleSelect
}) => {
  const { isAdmin } = useAuth();
  const [installationStatusOpen, setInstallationStatusOpen] = useState(false);
  const [latestTask, setLatestTask] = useState<any>(null);
  const [showInstallationImage, setShowInstallationImage] = useState(false); // ✅ NEW: خيار عرض صورة التركيب
  const [loadingTask, setLoadingTask] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [extensionData, setExtensionData] = useState<{
    extension_days: number;
    old_end_date: string;
    new_end_date: string;
    reason: string;
    extension_type: string;
  } | null>(null);
  
  // ✅ NEW: حالة كود العقد السنوي
  const [yearlyContractCode, setYearlyContractCode] = useState<string>('');
  
  // ✅ NEW: حالة العقد الساري (من billboard_ids)
  const [activeContract, setActiveContract] = useState<any>(null);
  
  // حالة التعديل السريع - عرض الأسعار من جدول pricing
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditLevel, setQuickEditLevel] = useState(billboard.Level || '');
  const [pricingRows, setPricingRows] = useState<any[]>([]);
  const [savingQuickEdit, setSavingQuickEdit] = useState(false);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [levels, setLevels] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPrices, setEditingPrices] = useState<Record<string, any>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  
  // ✅ NEW: حالة تكبير التصاميم والصور
  const [designPreviewOpen, setDesignPreviewOpen] = useState(false);
  const [designPreviewUrl, setDesignPreviewUrl] = useState<string>('');
  const [designPreviewTitle, setDesignPreviewTitle] = useState<string>('');
  
  // ✅ NEW: اللون الغالب من التصميم
  const [dominantColor, setDominantColor] = useState<string | null>(null);

  // ✅ استخراج اللون الغالب من تصميم الوجه الأمامي (من latestTask أو billboard)
  useEffect(() => {
    // جلب التصميم من أماكن متعددة بالأولوية
    const billboardAny = billboard as any;
    let designImage: string | null = null;
    
    // 1. من task_designs (selected_design)
    if (latestTask?.selected_design?.design_face_a_url) {
      designImage = latestTask.selected_design.design_face_a_url;
    }
    // 2. من installation_task_items
    else if (latestTask?.design_face_a) {
      designImage = latestTask.design_face_a;
    }
    // 3. من billboards مباشرة
    else if (billboardAny.design_face_a) {
      designImage = billboardAny.design_face_a;
    }
    
    if (!designImage) {
      setDominantColor(null);
      return;
    }

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
        } else {
          setDominantColor(null);
        }
      } catch (e) {
        console.log('Could not extract color from design - CORS issue likely');
        setDominantColor(null);
      }
    };
    img.onerror = () => {
      console.log('Failed to load design image for color extraction');
      setDominantColor(null);
    };
    img.src = designImage;
  }, [latestTask, (billboard as any).design_face_a]);

  useEffect(() => {
    const loadTaskData = async () => {
      if (!billboard.ID) {
        console.warn('Billboard ID is missing');
        return;
      }
      
      setLoadingTask(true);
      try {
        console.log('🔍 Loading task for billboard ID:', billboard.ID);
        
        // First get the task item
        const { data: taskItem, error: taskError } = await supabase
          .from('installation_task_items')
          .select('*')
          .eq('billboard_id', billboard.ID)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (taskError) {
          console.error('❌ Supabase error loading task:', taskError);
          return;
        }
        
        if (!taskItem) {
          console.log('⚠️ No task data found for billboard:', billboard.ID);
          setLatestTask(null);
          return;
        }

        // Get the design if selected_design_id exists
        let designData = null;
        if (taskItem.selected_design_id) {
          const { data: design } = await supabase
            .from('task_designs')
            .select('*')
            .eq('id', taskItem.selected_design_id)
            .single();
          designData = design;
        }

        // Get the task details
        let taskDetails = null;
        if (taskItem.task_id) {
          const { data: task } = await supabase
            .from('installation_tasks')
            .select(`
              *,
              team:installation_teams(*)
            `)
            .eq('id', taskItem.task_id)
            .single();
          taskDetails = task;
        }

        const enrichedTask = {
          ...taskItem,
          selected_design: designData,
          task: taskDetails
        };

        console.log('✅ Task data loaded successfully for billboard', billboard.ID, ':', enrichedTask);
        setLatestTask(enrichedTask);
      } catch (error) {
        console.error('❌ Error loading task:', error);
      } finally {
        setLoadingTask(false);
      }
    };
    
    if (isAdmin && billboard.ID) {
      loadTaskData();
    }
  }, [billboard.ID, isAdmin]);

  // التحقق من وجود تمديد للوحة وجلب تفاصيله
  useEffect(() => {
    const checkExtension = async () => {
      if (!billboard.ID) return;
      
      const { data } = await supabase
        .from('billboard_extensions')
        .select('extension_days, old_end_date, new_end_date, reason, extension_type')
        .eq('billboard_id', billboard.ID)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        setHasExtension(true);
        setExtensionData(data[0]);
      } else {
        setHasExtension(false);
        setExtensionData(null);
      }
    };
    
    checkExtension();
  }, [billboard.ID]);

  // ✅ NEW: جلب كود العقد السنوي
  useEffect(() => {
    const loadYearlyCode = async () => {
      const contractNum = (billboard as any).Contract_Number || (billboard as any).contractNumber;
      const startDate = billboard.Rent_Start_Date || (billboard as any).contract?.start_date;
      
      if (!contractNum || !startDate) {
        setYearlyContractCode('');
        return;
      }
      
      try {
        const startDateObj = new Date(startDate);
        if (isNaN(startDateObj.getTime())) {
          setYearlyContractCode('');
          return;
        }
        
        const year = startDateObj.getFullYear();
        const yearShort = year.toString().slice(-2);
        
        // جلب كل العقود في نفس السنة لحساب الترتيب
        const { data: contracts } = await supabase
          .from('Contract')
          .select('Contract_Number, "Contract Date"')
          .gte('"Contract Date"', `${year}-01-01`)
          .lte('"Contract Date"', `${year}-12-31`)
          .order('"Contract Date"', { ascending: true });
        
        if (contracts && contracts.length > 0) {
          const index = contracts.findIndex((c: any) => c.Contract_Number === contractNum);
          if (index !== -1) {
            setYearlyContractCode(`${index + 1}/${yearShort}`);
            return;
          }
        }
        
        setYearlyContractCode(yearShort);
      } catch (error) {
        console.error('Error loading yearly code:', error);
        setYearlyContractCode('');
      }
    };
    
    loadYearlyCode();
  }, [billboard.Contract_Number, billboard.Rent_Start_Date]);

  // جلب المستويات المتاحة
  useEffect(() => {
    const loadLevels = async () => {
      const { data } = await supabase.from('billboard_levels').select('level_code').order('level_code');
      if (data) setLevels(data.map(l => l.level_code));
    };
    if (isAdmin) loadLevels();
  }, [isAdmin]);

  // ✅ NEW: جلب العقد الساري من جدول العقود عبر billboard_ids
  useEffect(() => {
    const loadActiveContract = async () => {
      if (!billboard.ID) return;
      
      const idStr = String(billboard.ID);
      const today = new Date().toISOString().split('T')[0];
      
      try {
        const { data: contractData } = await supabase
          .from('Contract')
          .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date", billboard_ids')
          .or(`billboard_ids.ilike."%25,${idStr},%25",billboard_ids.ilike."${idStr},%25",billboard_ids.ilike."%25,${idStr}",billboard_ids.eq.${idStr}`)
          .gte('"End Date"', today)
          .order('"End Date"', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (contractData) {
          setActiveContract(contractData);
        } else {
          setActiveContract(null);
        }
      } catch (error) {
        console.error('Error loading active contract:', error);
        setActiveContract(null);
      }
    };
    
    loadActiveContract();
  }, [billboard.ID]);

  // تحميل أسعار جميع الفئات السعرية من جدول pricing للمقاس والمستوى المحدد
  const loadPricingForSizeLevel = async (sizeName: string, level: string) => {
    setLoadingPricing(true);
    try {
      const { data } = await supabase
        .from('pricing')
        .select('*')
        .eq('size', sizeName)
        .eq('billboard_level', level)
        .order('customer_category');
      
      if (data && data.length > 0) {
        setPricingRows(data);
        const categories = data.map(r => r.customer_category);
        setAvailableCategories(categories);
        // إذا لم يكن هناك فئة مختارة، اختر أول واحدة
        if (!selectedCategory || !categories.includes(selectedCategory)) {
          setSelectedCategory(categories[0]);
        }
        // تهيئة بيانات التعديل
        const edits: Record<string, any> = {};
        data.forEach(row => {
          edits[row.customer_category] = {
            id: row.id,
            one_day: row.one_day || 0,
            one_month: row.one_month || 0,
            '2_months': row['2_months'] || 0,
            '3_months': row['3_months'] || 0,
            '6_months': row['6_months'] || 0,
            full_year: row.full_year || 0,
          };
        });
        setEditingPrices(edits);
      } else {
        setPricingRows([]);
        setAvailableCategories([]);
        setSelectedCategory('');
        setEditingPrices({});
      }
    } catch (error) {
      console.error('Error loading pricing:', error);
    } finally {
      setLoadingPricing(false);
    }
  };

  // دالة حفظ التعديل السريع - تحديث الأسعار في جدول pricing ومستوى اللوحة
  const handleQuickEditSave = async () => {
    setSavingQuickEdit(true);
    try {
      // حفظ الأسعار إذا كان في وضع التعديل
      if (isEditMode) {
        for (const [category, prices] of Object.entries(editingPrices)) {
          if (prices.id) {
            const { error } = await supabase.from('pricing').update({
              one_day: prices.one_day,
              one_month: prices.one_month,
              '2_months': prices['2_months'],
              '3_months': prices['3_months'],
              '6_months': prices['6_months'],
              full_year: prices.full_year,
            }).eq('id', prices.id);
            if (error) throw error;
          }
        }
      }

      // تحديث مستوى اللوحة إذا تغير
      if (quickEditLevel !== billboard.Level) {
        await supabase.from('billboards').update({ Level: quickEditLevel }).eq('ID', billboard.ID);
      }

      toast.success(isEditMode ? 'تم تحديث الأسعار والمستوى بنجاح' : 'تم تحديث المستوى بنجاح');
      setQuickEditOpen(false);
      setIsEditMode(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('فشل في الحفظ');
    } finally {
      setSavingQuickEdit(false);
    }
  };

  // استخدام بيانات العقد المرتبط أو البيانات المباشرة في اللوحة
  const contractInfo = billboard.contract;
  const customerName = contractInfo?.customer_name || billboard.Customer_Name || (billboard as any).clientName || '';
  
  // ✅ FIXED: تحسين استدعاء نوع الإعلان مع جميع الاحتمالات الممكنة
  const getAdType = () => {
    // من بيانات العقد أولاً
    if (contractInfo) {
      const contractAdType = contractInfo["Ad Type"] || 
                           contractInfo.ad_type || '';
      if (contractAdType && contractAdType.trim()) {
        return contractAdType.trim();
      }
    }
    
    // من بيانات اللوحة مباشرة
    const billboardAdType = billboard.Ad_Type || 
                           (billboard as any).adType || 
                           (billboard as any).ad_type || '';
    
    if (billboardAdType && billboardAdType.trim()) {
      return billboardAdType.trim();
    }
    
    // من بيانات العقود المدمجة في اللوحة
    if ((billboard as any).contracts && Array.isArray((billboard as any).contracts) && (billboard as any).contracts.length > 0) {
      const contract = (billboard as any).contracts[0];
      const contractAdType = contract["Ad Type"] || 
                           contract.ad_type || '';
      if (contractAdType && contractAdType.trim()) {
        return contractAdType.trim();
      }
    }
    
    return '';
  };

  const adType = getAdType();
  
  const startDate = contractInfo?.start_date || billboard.Rent_Start_Date || '';
  // استخدام تاريخ انتهاء اللوحة أولاً (لأنه يتم تحديثه عند التمديد)
  // ✅ استخدام بيانات العقد الساري أولاً (من billboard_ids)
  const endDate = activeContract?.['End Date'] || billboard.Rent_End_Date || contractInfo?.end_date || '';
  const contractId = activeContract?.Contract_Number || (billboard as any).Contract_Number || (billboard as any).contractNumber || contractInfo?.id || '';

  // استخدام yearlyContractCode من الـ state

  // تحديد حالة اللوحة مع فحص تاريخ انتهاء العقد
  const isContractExpired = () => {
    // إذا وجد عقد ساري من activeContract فهو غير منتهي بالتأكيد
    if (activeContract) return false;
    if (!endDate) return true;
    try {
      const endDateObj = new Date(endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return endDateObj < today;
    } catch {
      return true;
    }
  };

  const contractExpired = isContractExpired();
  // ✅ إذا وجد عقد ساري من activeContract أو من بيانات اللوحة
  const hasActiveContract = !!activeContract || (!!(contractInfo || billboard.Contract_Number) && !contractExpired);
  const rawStatus = (billboard as any).Status ?? (billboard as any).status ?? '';
  const statusNorm = String(rawStatus).trim();
  const maintStatus = String(((billboard as any).maintenance_status ?? '')).trim().toLowerCase();

  // تحديد نوع الحالة بدقة - ✅ تحسين فحص حالة الصيانة
  const isNotInstalled = maintStatus === 'لم يتم التركيب';
  const needsRemoval = maintStatus === 'تحتاج ازالة لغرض التطوير';
  const isRemoved = statusNorm === 'إزالة' || statusNorm.toLowerCase() === 'ازالة' || maintStatus === 'removed';
  const isDamaged = maintStatus === 'متضررة اللوحة';
  
  // ✅ تحسين: الصيانة تشمل كل الحالات غير التشغيلية
  const isMaintenance = statusNorm === 'صيانة' || 
                        statusNorm.toLowerCase() === 'maintenance' || 
                        maintStatus === 'maintenance' || 
                        maintStatus === 'repair_needed' || 
                        maintStatus === 'out_of_service';
  
  // ✅ اللوحة متاحة فقط إذا لم يكن هناك عقد ساري ولا مشاكل صيانة
  const isAvailable = !hasActiveContract && !isRemoved && !isNotInstalled && !needsRemoval && !isMaintenance && !isDamaged;
  
  // ✅ تحديد نص الحالة مع أولوية للصيانة
  const getMaintenanceLabel = () => {
    if (maintStatus === 'repair_needed') return 'تحتاج إصلاح';
    if (maintStatus === 'out_of_service') return 'خارج الخدمة';
    if (maintStatus === 'maintenance') return 'قيد الصيانة';
    return 'صيانة';
  };
  
  let statusLabel = 'متاح';
  
  if (isNotInstalled) {
    statusLabel = 'لم يتم التركيب';
  } else if (needsRemoval) {
    statusLabel = 'تحتاج إزالة';
  } else if (isRemoved) {
    statusLabel = 'تمت الإزالة';
  } else if (isDamaged) {
    statusLabel = 'متضررة';
  } else if (isMaintenance) {
    statusLabel = getMaintenanceLabel();
  } else if (hasActiveContract) {
    statusLabel = 'محجوز';
  }

  // حساب الأيام المتبقية
  const getDaysRemaining = () => {
    if (!endDate || contractExpired) return null;

    try {
      const endDateObj = new Date(endDate);
      const today = new Date();
      const diffTime = endDateObj.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays > 0 ? diffDays : 0;
    } catch {
      return null;
    }
  };

  const daysRemaining = getDaysRemaining();
  const isNearExpiry = daysRemaining !== null && daysRemaining <= 20 && daysRemaining > 0;

  const [previewOpen, setPreviewOpen] = React.useState(false);

  // ✅ دالة لوضع علامة على اللوحة أنها تحتاج إعادة تصوير - kept for future use
  // const handleMarkForRephotography = async () => { ... }

  const [isVisibleInAvailable, setIsVisibleInAvailable] = React.useState(
    (billboard as any).is_visible_in_available !== false
  );

  // Sync with prop changes
  React.useEffect(() => {
    setIsVisibleInAvailable((billboard as any).is_visible_in_available !== false);
  }, [(billboard as any).is_visible_in_available]);

  // ✅ دالة لتبديل حالة الظهور في المتاح
  const handleToggleVisibility = async () => {
    try {
      const newStatus = !isVisibleInAvailable;
      
      const { error } = await supabase
        .from('billboards')
        .update({ is_visible_in_available: newStatus })
        .eq('ID', billboard.ID);

      if (error) throw error;

      toast.success(newStatus ? 'ستظهر اللوحة في قائمة المتاح' : 'لن تظهر اللوحة في قائمة المتاح');
      
      // ✅ تحديث الحالة المحلية فوراً
      setIsVisibleInAvailable(newStatus);
      (billboard as any).is_visible_in_available = newStatus;
      
      // ✅ استدعاء callback بدلاً من إعادة تحميل الصفحة
      onUpdate?.();
    } catch (error) {
      console.error('Error updating visibility status:', error);
      toast.error('فشل في تحديث حالة الظهور');
    }
  };

  // Helper function to get face count display name
  const getFaceCountDisplay = () => {
    const facesCount = billboard.Faces_Count || (billboard as any).faces_count || (billboard as any).faces || (billboard as any).Number_of_Faces || (billboard as any).Faces || '';
    
    // If it's a number, convert to descriptive text
    switch (String(facesCount)) {
      case '1':
        return 'وجه واحد';
      case '2':
        return 'وجهين';
      case '3':
        return 'ثلاثة أوجه';
      case '4':
        return 'أربعة أوجه';
      default:
        return facesCount || 'غير محدد';
    }
  };

  // Helper function to get billboard type display
  const getBillboardTypeDisplay = () => {
    return (billboard as any).billboard_type || (billboard as any).Billboard_Type || 'غير محدد';
  };

  // Helper function to get level display
  const getLevelDisplay = () => {
    return billboard.Level || (billboard as any).level || 'غير محدد';
  };

  // Determine if billboard is shared (partnership)
  const isShared = Boolean(
    (billboard as any).is_partnership ||
    (billboard as any).Is_Partnership ||
    (billboard as any).shared ||
    (billboard as any).isShared
  );

  // الحصول على صورة التصميم الأمامي
  const getFrontDesignUrl = () => {
    if (latestTask?.design_face_a || latestTask?.selected_design?.design_face_a_url) {
      return latestTask.design_face_a || latestTask.selected_design?.design_face_a_url;
    }
    return null;
  };

  const frontDesignUrl = getFrontDesignUrl();

  // دالة فتح تكبير التصميم/الصورة
  const openDesignPreview = (url: string, title: string) => {
    setDesignPreviewUrl(url);
    setDesignPreviewTitle(title);
    setDesignPreviewOpen(true);
  };

  // حساب ستايل الكرت بناءً على اللون الغالب
  const getCardStyle = (): React.CSSProperties => {
    if (dominantColor) {
      return {
        borderColor: `rgba(${dominantColor}, 0.8)`,
        background: `linear-gradient(145deg, rgba(${dominantColor}, 0.35) 0%, rgba(${dominantColor}, 0.2) 30%, rgba(15, 15, 15, 0.98) 100%)`,
        boxShadow: `0 8px 32px rgba(${dominantColor}, 0.4), inset 0 1px 0 rgba(${dominantColor}, 0.3), inset 0 0 20px rgba(${dominantColor}, 0.1)`
      };
    }
    // اللون الأسود الفخم الافتراضي
    return {
      borderColor: 'rgba(80, 80, 80, 0.6)',
      background: 'linear-gradient(145deg, #252525 0%, #1a1a1a 30%, #0a0a0a 100%)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
    };
  };

  return (
    <>
      <Card 
        className={`group relative overflow-hidden rounded-2xl border-2 shadow-md transition-all duration-300 hover:shadow-xl ${
          isSelected ? 'ring-2 ring-primary/50' : ''
        }`}
        style={getCardStyle()}
      >
        {/* Selection checkbox overlay */}
        {isSelectable && (
          <div 
            className={`absolute top-3 right-3 z-50 ${
              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            } transition-opacity duration-200`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
          >
            <div className={`w-7 h-7 rounded-md flex items-center justify-center shadow-md backdrop-blur-sm ${
              isSelected 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-white/90 dark:bg-slate-900/90 text-muted-foreground hover:bg-primary hover:text-primary-foreground'
            }`}>
              <Check className="h-4 w-4" />
            </div>
          </div>
        )}

        
        <div className="relative">
          {/* صورة اللوحة أو صورة التركيب */}
          <div 
            className="aspect-[4/3] bg-muted relative overflow-hidden cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen(true);
            }}
          >
            {/* طبقة الصورة - z-index منخفض */}
            <div className="absolute inset-0 z-0">
              {showInstallationImage && (latestTask?.installed_image_url || latestTask?.installed_image_face_a_url) ? (
                <img 
                  src={latestTask.installed_image_url || latestTask.installed_image_face_a_url} 
                  alt="صورة التركيب"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <BillboardImageWithBlur
                  billboard={billboard}
                  alt={billboard.Billboard_Name}
                  className="w-full h-full"
                />
              )}
            </div>
            
            {/* Gradient overlay - z-index متوسط */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent z-10" />
            
            {/* أيقونة التكبير */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
              <div className="bg-black/50 rounded-full p-2 backdrop-blur-sm">
                <ZoomIn className="h-6 w-6 text-white" />
              </div>
            </div>

            {/* Top badges row - z-index عالي */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-30">
              {/* حجم اللوحة */}
              <Badge className="bg-white/95 dark:bg-slate-900/95 text-foreground shadow-xl border-0 font-bold px-4 py-1.5 text-sm backdrop-blur-sm font-manrope">
                {billboard.Size}
              </Badge>

              {/* حالة اللوحة */}
              <Badge
                className={`shadow-xl border-0 font-semibold px-4 py-1.5 backdrop-blur-sm ${
                  isAvailable 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' 
                    : isNotInstalled || isRemoved
                    ? 'bg-gradient-to-r from-slate-500 to-slate-600 text-white'
                    : needsRemoval
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                    : isDamaged
                    ? 'bg-gradient-to-r from-rose-500 to-red-500 text-white'
                    : isMaintenance
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white'
                    : 'bg-gradient-to-r from-rose-500 to-pink-500 text-white'
                }`}
              >
                {statusLabel}
              </Badge>
            </div>

            {/* زر تبديل صورة التركيب - يظهر إذا كان هناك أي صورة تركيب */}
            {isAdmin && (latestTask?.installed_image_url || latestTask?.installed_image_face_a_url || latestTask?.installed_image_face_b_url) && (
              <div className="absolute bottom-4 left-4 z-30">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInstallationImage(!showInstallationImage);
                  }}
                  className="h-8 px-3 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-xs font-semibold shadow-lg backdrop-blur-sm"
                >
                  <Camera className="h-3 w-3 ml-1" />
                  {showInstallationImage ? 'الصورة الأصلية' : 'صورة التركيب'}
                </Button>
              </div>
            )}

            {/* Corner badges - z-index عالي */}
            {isNearExpiry && !contractExpired && (
              <div className="absolute top-14 right-4 z-30">
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg animate-pulse">
                  <Calendar className="h-3 w-3 mr-1" />
                  {daysRemaining} يوم
                </Badge>
              </div>
            )}

            {contractExpired && (contractId || endDate) && (
              <div className="absolute top-14 right-4 z-30">
                <Badge className="bg-gradient-to-r from-rose-600 to-red-600 text-white border-0 shadow-lg">
                  <Calendar className="h-3 w-3 mr-1" />
                  منتهي
                </Badge>
              </div>
            )}
          </div>

          {/* ✅ معلومات الموقع مباشرة تحت الصورة */}
          <div className="px-4 py-3 bg-gradient-to-r from-muted/50 to-muted/30 border-b border-border/30">
            {/* كود اللوحة وأقرب نقطة دالة بخط كبير */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-lg text-foreground">
                  {billboard.Billboard_Name || `لوحة رقم ${billboard.ID}`}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-primary shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(billboard.Billboard_Name || `لوحة رقم ${billboard.ID}`);
                    toast.success('تم نسخ اسم اللوحة');
                  }}
                  title="نسخ اسم اللوحة"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              {billboard.Nearest_Landmark && (
                <p className="font-bold text-lg text-primary flex items-center gap-2">
                  <MapPin className="h-5 w-5 flex-shrink-0" />
                  {billboard.Nearest_Landmark}
                </p>
              )}
            </div>
            
            {/* البلدية والمنطقة */}
            {(billboard.Municipality || billboard.District) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {billboard.Municipality && (
                  <Badge variant="secondary" className="text-xs bg-muted/80">
                    <Building className="h-3 w-3 ml-1" />
                    {billboard.Municipality}
                  </Badge>
                )}
                {billboard.District && (
                  <Badge variant="secondary" className="text-xs bg-muted/80">
                    المنطقة: {billboard.District}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* ✅ التصميم بعرض الكرت بالكامل - بدون عنوان */}
          {isAdmin && (latestTask?.design_face_a || latestTask?.selected_design?.design_face_a_url) && (
            <div 
              className="relative w-full aspect-[16/9] overflow-hidden cursor-pointer group/design"
              onClick={(e) => {
                e.stopPropagation();
                openDesignPreview(latestTask.design_face_a || latestTask.selected_design?.design_face_a_url, 'التصميم');
              }}
            >
              <img 
                src={latestTask.design_face_a || latestTask.selected_design?.design_face_a_url} 
                alt="التصميم" 
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              {/* تأثير التكبير عند التحويم */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/design:opacity-100 transition-opacity flex items-center justify-center">
                <div className="bg-black/50 rounded-full p-2 backdrop-blur-sm">
                  <ZoomIn className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          )}

          <CardContent className="p-5 space-y-4">
            {/* Quick info grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20">
                <span className="text-xs text-muted-foreground mb-1">الأوجه</span>
                <span className="font-bold text-sm text-blue-600 dark:text-blue-400 font-manrope">{getFaceCountDisplay()}</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20">
                <span className="text-xs text-muted-foreground mb-1">النوع</span>
                <span className="font-bold text-sm text-purple-600 dark:text-purple-400 text-center line-clamp-1">{getBillboardTypeDisplay()}</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 relative">
                <span className="text-xs text-muted-foreground mb-1">المستوى</span>
                <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-manrope">{getLevelDisplay()}</span>
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-1 left-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditMode(false);
                      setQuickEditLevel(billboard.Level || 'A');
                      loadPricingForSizeLevel(billboard.Size || '', billboard.Level || 'A');
                      setQuickEditOpen(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Partnership indicator */}
            {isShared && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-pink-500/10 border border-violet-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-violet-600 dark:text-violet-400">🤝 لوحة مشتركة</span>
                  <Badge className="bg-gradient-to-r from-violet-500 to-pink-500 text-white text-xs border-0">
                    شراكة
                  </Badge>
                </div>
                {((billboard as any).partner_companies && Array.isArray((billboard as any).partner_companies) && (billboard as any).partner_companies.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {(billboard as any).partner_companies.map((company: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs border-violet-300 text-violet-600 dark:text-violet-400">
                        {company}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Friend company */}
            {(billboard as any).friend_companies?.name && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-sky-500/10 border border-cyan-500/20">
                <span className="text-xs text-cyan-600 dark:text-cyan-400">🏢 الشركة الصديقة</span>
                <Badge variant="outline" className="text-xs border-cyan-300 text-cyan-600 dark:text-cyan-400">
                  {(billboard as any).friend_companies.name}
                </Badge>
              </div>
            )}

            {/* معلومات العقد المحسنة - فقط للعقود النشطة وغير المنتهية */}
            {hasActiveContract && !contractExpired && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-transparent border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">معلومات العقد</span>
              </div>
              
              {/* الصف الأول: اسم العميل ورقم العقد */}
              <div className="grid grid-cols-2 gap-4 mb-2">
                {customerName && (
                  <div className="flex items-center gap-2 text-xs">
                    <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">العميل:</span>
                      <span className="font-medium text-foreground">{customerName}</span>
                    </div>
                  </div>
                )}
                
                {contractId && (
                  <div className="flex items-center gap-2 text-xs">
                    <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">رقم العقد:</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-xs w-fit">#{contractId}</Badge>
                        {yearlyContractCode && (
                          <Badge className="text-xs bg-primary/10 text-primary border-primary/20">{yearlyContractCode}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* الصف الثاني: نوع الإعلان والأيام المتبقية */}
              <div className="grid grid-cols-2 gap-4 mb-2">
                {/* ✅ FIXED: عرض نوع الإعلان مع التحقق من وجوده */}
                {adType && (
                  <div className="flex items-center gap-2 text-xs">
                    <Building className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">نوع الإعلان:</span>
                      <Badge variant="outline" className="text-xs w-fit font-medium">{adType}</Badge>
                    </div>
                  </div>
                )}

                {daysRemaining !== null && (
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">متبقي:</span>
                      <Badge 
                        variant={isNearExpiry ? "destructive" : "secondary"} 
                        className="text-xs w-fit"
                      >
                        {daysRemaining} يوم
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* الصف الثالث: تاريخ البداية والنهاية */}
              <div className="grid grid-cols-2 gap-4">
                {startDate && (
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="h-3 w-3 text-green-600 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">يبدأ:</span>
                      <span className="font-medium text-foreground">{formatGregorianDate(startDate, 'ar-LY')}</span>
                    </div>
                  </div>
                )}
                
                {endDate && (
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="h-3 w-3 text-red-600 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">ينتهي:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">{formatGregorianDate(endDate, 'ar-LY')}</span>
                        {isNearExpiry && (
                          <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">
                            قريب الانتهاء
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* قيمة الإيجار */}
              {contractInfo?.rent_cost && (
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">قيمة الإيجار:</span>
                    <span className="font-bold text-primary">{contractInfo.rent_cost.toLocaleString()} د.ل</span>
                  </div>
                </div>
              )}
              </div>
            )}

            {/* معلومات العقد المنتهي للمدير فقط */}
            {isAdmin && contractExpired && (contractId || endDate || customerName) && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-rose-500/10 to-red-500/5 border border-rose-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-rose-600" />
                  <span className="font-semibold text-sm text-rose-600 dark:text-rose-400">عقد منتهي</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {contractId && (
                    <Badge variant="outline" className="text-rose-600 border-rose-300">رقم العقد: {contractId}</Badge>
                  )}
                  {endDate && (
                    <Badge className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">انتهى: {formatGregorianDate(endDate, 'ar-LY')}</Badge>
                  )}
                  {customerName && (
                    <Badge variant="outline" className="text-rose-600 border-rose-300">{customerName}</Badge>
                  )}
                  {adType && (
                    <Badge variant="outline" className="text-rose-600 border-rose-300">نوع الإعلان: {adType}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* قسم معلومات التمديد */}
            {hasExtension && extensionData && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-sky-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarPlus className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">تمديد مفعّل</span>
                  <Badge className="bg-gradient-to-r from-blue-500 to-sky-500 text-white text-xs border-0">
                    +{extensionData.extension_days} يوم
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex flex-col p-2 rounded-lg bg-blue-500/10">
                    <span className="text-muted-foreground">من تاريخ:</span>
                    <span className="font-medium text-foreground">{formatGregorianDate(extensionData.old_end_date, 'ar-LY')}</span>
                  </div>
                  <div className="flex flex-col p-2 rounded-lg bg-blue-500/10">
                    <span className="text-muted-foreground">إلى تاريخ:</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">{formatGregorianDate(extensionData.new_end_date, 'ar-LY')}</span>
                  </div>
                </div>

                {extensionData.reason && (
                  <div className="mt-3 pt-3 border-t border-blue-500/20">
                    <span className="text-xs text-muted-foreground">السبب: </span>
                    <span className="text-xs text-foreground">{extensionData.reason}</span>
                  </div>
                )}
              </div>
            )}

            {/* قسم حالة التركيب في الواقع - محسّن */}
            {isAdmin && (
              <Collapsible open={installationStatusOpen} onOpenChange={setInstallationStatusOpen} className="mt-4">
                <CollapsibleTrigger className="group flex items-center justify-between w-full p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/5 border border-violet-500/20 hover:from-violet-500/15 hover:to-purple-500/10 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                      <Camera className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-sm text-foreground block">حالة التركيب في الواقع</span>
                      <span className="text-xs text-muted-foreground">
                        {latestTask ? (latestTask.status === 'completed' ? 'تم التركيب ✓' : 'قيد الانتظار') : 'لا توجد بيانات'}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-full bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors">
                    {installationStatusOpen ? <ChevronUp className="h-4 w-4 text-violet-600" /> : <ChevronDown className="h-4 w-4 text-violet-600" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 p-4 bg-gradient-to-br from-background to-muted/30 rounded-xl border border-border/50 shadow-inner">
                    {loadingTask ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-10 h-10 border-3 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mb-3" />
                        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
                      </div>
                    ) : latestTask ? (
                      <div className="space-y-4">
                        {/* حالة ومعلومات المهمة */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-slate-500/10 to-gray-500/5 border border-slate-500/20">
                            <span className="text-xs text-muted-foreground block mb-1">الحالة</span>
                            {latestTask.status === 'completed' ? (
                              <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 shadow-lg shadow-emerald-500/25">
                                <CheckCircle2 className="h-3 w-3 ml-1" />
                                مكتمل
                              </Badge>
                            ) : (
                              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg shadow-amber-500/25">
                                <Clock className="h-3 w-3 ml-1" />
                                معلق
                              </Badge>
                            )}
                          </div>

                          {latestTask.installation_date && (
                            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-sky-500/5 border border-blue-500/20">
                              <span className="text-xs text-muted-foreground block mb-1">تاريخ التركيب</span>
                              <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                                {formatGregorianDate(latestTask.installation_date)}
                              </span>
                            </div>
                          )}
                        </div>

                        {latestTask.task?.team?.team_name && (
                          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 to-blue-500/5 border border-indigo-500/20">
                            <span className="text-xs text-muted-foreground block mb-1">فريق التركيب</span>
                            <Badge variant="secondary" className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-0">
                              {latestTask.task.team.team_name}
                            </Badge>
                          </div>
                        )}

                        {latestTask.notes && (
                          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/20">
                            <span className="text-xs text-muted-foreground block mb-2">ملاحظات</span>
                            <p className="text-sm text-foreground bg-white/50 dark:bg-black/20 p-2 rounded-lg">{latestTask.notes}</p>
                          </div>
                        )}

                        {/* التصاميم - الأمامي والخلفي */}
                        {(latestTask.selected_design || latestTask.design_face_a || latestTask.design_face_b) && (
                          <div className="space-y-3 pt-3 border-t border-border/50">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600">
                                <ImageIcon className="h-3 w-3 text-white" />
                              </div>
                              <h4 className="font-bold text-sm text-foreground">التصاميم</h4>
                              {latestTask.selected_design?.design_name && (
                                <Badge className="bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-0 text-xs">
                                  {latestTask.selected_design.design_name}
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {/* التصميم الأمامي */}
                              {(latestTask.design_face_a || latestTask.selected_design?.design_face_a_url) && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">الوجه الأمامي</p>
                                  <div 
                                    className="relative aspect-video rounded-xl overflow-hidden border-2 border-pink-500/30 shadow-lg shadow-pink-500/10 group/img cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDesignPreview(
                                        latestTask.design_face_a || latestTask.selected_design?.design_face_a_url,
                                        'التصميم الأمامي'
                                      );
                                    }}
                                  >
                                    <img 
                                      src={latestTask.design_face_a || latestTask.selected_design?.design_face_a_url} 
                                      alt="التصميم الأمامي" 
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = "/placeholder.svg";
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="h-6 w-6 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                              {/* التصميم الخلفي */}
                              {(latestTask.design_face_b || latestTask.selected_design?.design_face_b_url) && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">الوجه الخلفي</p>
                                  <div 
                                    className="relative aspect-video rounded-xl overflow-hidden border-2 border-purple-500/30 shadow-lg shadow-purple-500/10 group/img cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDesignPreview(
                                        latestTask.design_face_b || latestTask.selected_design?.design_face_b_url,
                                        'التصميم الخلفي'
                                      );
                                    }}
                                  >
                                    <img 
                                      src={latestTask.design_face_b || latestTask.selected_design?.design_face_b_url} 
                                      alt="التصميم الخلفي" 
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = "/placeholder.svg";
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="h-6 w-6 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* صور التركيب الفعلي - الأمامي والخلفي */}
                        {(latestTask.installed_image_url || latestTask.installed_image_face_a_url || latestTask.installed_image_face_b_url) && (
                          <div className="space-y-3 pt-3 border-t border-border/50">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600">
                                <Camera className="h-3 w-3 text-white" />
                              </div>
                              <h4 className="font-bold text-sm text-foreground">صور التركيب الفعلي</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {/* صورة التركيب الأمامي */}
                              {(latestTask.installed_image_url || latestTask.installed_image_face_a_url) && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">الوجه الأمامي</p>
                                  <div 
                                    className="relative aspect-video rounded-xl overflow-hidden border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/10 group/img cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDesignPreview(
                                        latestTask.installed_image_url || latestTask.installed_image_face_a_url,
                                        'صورة التركيب - الوجه الأمامي'
                                      );
                                    }}
                                  >
                                    <img 
                                      src={latestTask.installed_image_url || latestTask.installed_image_face_a_url} 
                                      alt="صورة التركيب الأمامي" 
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = "/placeholder.svg";
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="h-6 w-6 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                              {/* صورة التركيب الخلفي */}
                              {latestTask.installed_image_face_b_url && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">الوجه الخلفي</p>
                                  <div 
                                    className="relative aspect-video rounded-xl overflow-hidden border-2 border-teal-500/30 shadow-lg shadow-teal-500/10 group/img cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDesignPreview(
                                        latestTask.installed_image_face_b_url,
                                        'صورة التركيب - الوجه الخلفي'
                                      );
                                    }}
                                  >
                                    <img 
                                      src={latestTask.installed_image_face_b_url} 
                                      alt="صورة التركيب الخلفي" 
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = "/placeholder.svg";
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                      <ZoomIn className="h-6 w-6 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="p-4 rounded-full bg-muted/50 mb-3">
                          <XCircle className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">لا توجد بيانات تركيب</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">لم يتم إضافة هذه اللوحة إلى أي مهمة تركيب</p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* أزرار الإجراءات - محسّنة */}
            {isAdmin && (
              <div className="mt-5 space-y-3">
                {/* أزرار رئيسية */}
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => setHistoryOpen(true)}
                    className="group relative overflow-hidden h-10 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white shadow-lg shadow-slate-500/20 border-0 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <History className="h-4 w-4 ml-2" />
                    <span className="text-xs font-semibold">تاريخ اللوحة</span>
                  </Button>
                  
                  {hasActiveContract && endDate && (
                    <Button 
                      size="sm" 
                      onClick={() => setExtendDialogOpen(true)}
                      className={`group relative overflow-hidden h-10 shadow-lg border-0 transition-all duration-300 ${
                        hasExtension 
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/25'
                          : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-emerald-500/25'
                      }`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <CalendarPlus className="h-4 w-4 ml-2" />
                      <span className="text-xs font-semibold">
                        {hasExtension ? 'تمديد إضافي' : 'تمديد الإيجار'}
                      </span>
                    </Button>
                  )}
                </div>

                {/* زر الظهور في المتاح */}
                <Button 
                  size="sm" 
                  onClick={handleToggleVisibility}
                  className={`w-full group relative overflow-hidden h-10 shadow-lg border-0 transition-all duration-300 ${
                    isVisibleInAvailable 
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sky-500/25'
                      : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-rose-500/25'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {isVisibleInAvailable ? (
                    <>
                      <Eye className="h-4 w-4 ml-2" />
                      <span className="text-xs font-semibold">تظهر في اللوحات المتاحة</span>
                      <Badge className="mr-auto bg-white/20 text-white border-0 text-[10px] font-bold">مفعّل</Badge>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4 ml-2" />
                      <span className="text-xs font-semibold">مخفية من اللوحات المتاحة</span>
                      <Badge className="mr-auto bg-white/20 text-white border-0 text-[10px] font-bold">معطّل</Badge>
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* أزرار الإجراءات للحجز */}
            {showBookingActions && (
              <div className="mt-5 flex gap-2">
                <Button
                  size="sm"
                  className={`flex-1 h-11 font-semibold transition-all duration-300 shadow-lg ${
                    isAvailable 
                      ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-emerald-500/30' 
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/30'
                  }`}
                  onClick={() => onBooking?.(billboard)}
                >
                  {isAvailable ? 'حجز سريع' : 'تفريغ'}
                </Button>
                
                <Button 
                  size="sm" 
                  onClick={() => {
                    if (billboard.GPS_Coordinates) {
                      const mapsUrl = `https://www.google.com/maps/@${billboard.GPS_Coordinates}`;
                      window.open(mapsUrl, '_blank');
                    }
                  }}
                  disabled={!billboard.GPS_Coordinates}
                  className="h-11 w-11 p-0 bg-gradient-to-r from-blue-500 to-sky-600 hover:from-blue-600 hover:to-sky-700 text-white shadow-lg shadow-blue-500/30 border-0 disabled:opacity-50"
                >
                  <MapPin className="h-5 w-5" />
                </Button>
                
                <Button 
                  size="sm" 
                  onClick={() => onViewDetails?.(billboard)}
                  className="h-11 w-11 p-0 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/30 border-0"
                >
                  <Eye className="h-5 w-5" />
                </Button>
              </div>
            )}
        </CardContent>
      </div>
    </Card>

    {/* Image Preview Dialog - نافذة تكبير الصورة */}
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0">
        <div className="relative w-full h-full flex items-center justify-center min-h-[60vh]">
          {/* زر الإغلاق */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPreviewOpen(false)}
            className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full"
          >
            <X className="h-6 w-6" />
          </Button>
          
          {/* معلومات اللوحة */}
          <div className="absolute top-4 left-4 z-50 bg-black/50 rounded-lg px-4 py-2 backdrop-blur-sm">
            <h3 className="text-white font-bold text-lg">
              {billboard.Billboard_Name || `لوحة ${billboard.ID}`}
            </h3>
            <p className="text-white/70 text-sm">{billboard.Size} • {billboard.Municipality}</p>
          </div>
          
          {/* الصورة المكبرة */}
          <BillboardImage 
            billboard={billboard} 
            alt={billboard.Billboard_Name} 
            className="max-w-full max-h-[85vh] object-contain" 
          />
        </div>
      </DialogContent>
    </Dialog>

    {/* Dialog تاريخ اللوحة */}
    <BillboardHistoryDialog
      open={historyOpen}
      onOpenChange={setHistoryOpen}
      billboardId={billboard.ID}
      billboardName={billboard.Billboard_Name || `لوحة #${billboard.ID}`}
    />

    {/* Dialog تمديد الإيجار */}
    <BillboardExtendRentalDialog
      open={extendDialogOpen}
      onOpenChange={setExtendDialogOpen}
      billboard={{
        ID: billboard.ID,
        Billboard_Name: billboard.Billboard_Name,
        Rent_End_Date: endDate,
        Contract_Number: (billboard as any).Contract_Number
      }}
      onSuccess={onUpdate}
    />

    {/* Dialog عرض/تعديل الأسعار حسب الفئات السعرية */}
    <Dialog open={quickEditOpen} onOpenChange={setQuickEditOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">الأسعار والمستوى</DialogTitle>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <Badge variant="outline" className="text-xs font-mono">{billboard.Billboard_Name}</Badge>
            {billboard.Size && <Badge variant="secondary" className="text-xs font-bold">{billboard.Size}</Badge>}
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary">المستوى: {quickEditLevel}</Badge>
          </div>
        </DialogHeader>
        {loadingPricing ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">جاري تحميل الأسعار...</div>
        ) : (
          <div className="space-y-4 py-2">
            {/* تغيير المستوى */}
            <div>
              <Label className="text-foreground text-sm">مستوى اللوحة</Label>
              <Select 
                value={quickEditLevel} 
                onValueChange={(v) => {
                  setQuickEditLevel(v);
                  loadPricingForSizeLevel(billboard.Size || '', v);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="اختر المستوى" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((lv) => (
                    <SelectItem key={lv} value={lv}>{lv}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* جدول الأسعار حسب الفئة السعرية */}
            {pricingRows.length > 0 ? (
              <div className="space-y-3">
                {/* اختيار الفئة السعرية مع بحث */}
                <div className="space-y-2">
                  <Label className="text-foreground text-sm font-semibold">الفئة السعرية</Label>
                  <Input
                    type="text"
                    placeholder="ابحث عن الفئة السعرية..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                    {availableCategories
                      .filter(cat => !categorySearch || cat.includes(categorySearch))
                      .map((cat) => (
                        <button
                          key={cat}
                          onClick={() => { setSelectedCategory(cat); setCategorySearch(''); }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                            selectedCategory === cat
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-muted/50 text-foreground border-border hover:bg-muted'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    {availableCategories.filter(cat => !categorySearch || cat.includes(categorySearch)).length === 0 && (
                      <span className="text-xs text-muted-foreground py-2">لا توجد نتائج</span>
                    )}
                  </div>
                </div>

                {/* عرض أسعار الفئة المختارة */}
                {selectedCategory && editingPrices[selectedCategory] && (() => {
                  const prices = editingPrices[selectedCategory];
                  const fields = [
                    { key: 'one_day', label: 'يوم واحد' },
                    { key: 'one_month', label: 'شهر' },
                    { key: '2_months', label: 'شهرين' },
                    { key: '3_months', label: '3 أشهر' },
                    { key: '6_months', label: '6 أشهر' },
                    { key: 'full_year', label: 'سنة' },
                  ];
                  return (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">
                        أسعار المقاس {billboard.Size} - المستوى {quickEditLevel} - الفئة: {selectedCategory}
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        {fields.map(({ key, label }) => (
                          <div key={key} className="p-3 rounded-lg border border-border bg-muted/30 text-center">
                            <span className="text-xs text-muted-foreground block mb-1">{label}</span>
                            {isEditMode ? (
                              <Input
                                type="number"
                                min="0"
                                value={prices[key] || ''}
                                onChange={(e) => {
                                  setEditingPrices(prev => ({
                                    ...prev,
                                    [selectedCategory]: { ...prev[selectedCategory], [key]: Number(e.target.value) || 0 }
                                  }));
                                }}
                                className="h-8 text-center text-sm font-mono"
                                placeholder="0"
                              />
                            ) : (
                              <span className="font-bold text-foreground text-sm font-mono">
                                {prices[key] ? Number(prices[key]).toLocaleString() : '-'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                لا توجد أسعار مسجلة لهذا المقاس والمستوى
              </div>
            )}
          </div>
        )}
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setQuickEditOpen(false)}>إغلاق</Button>
          {quickEditLevel !== billboard.Level && !isEditMode && (
            <Button onClick={handleQuickEditSave} disabled={savingQuickEdit}>
              {savingQuickEdit ? 'جاري الحفظ...' : 'حفظ المستوى'}
            </Button>
          )}
          {!isEditMode && pricingRows.length > 0 ? (
            <Button variant="secondary" onClick={() => setIsEditMode(true)}>
              <Pencil className="h-4 w-4 ml-1" />
              تعديل الأسعار
            </Button>
          ) : isEditMode ? (
            <Button onClick={handleQuickEditSave} disabled={savingQuickEdit || loadingPricing}>
              {savingQuickEdit ? 'جاري الحفظ...' : 'حفظ الأسعار'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Dialog تكبير التصاميم وصور التركيب */}
    <Dialog open={designPreviewOpen} onOpenChange={setDesignPreviewOpen}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0">
        <div className="relative w-full h-full flex items-center justify-center min-h-[60vh]">
          {/* زر الإغلاق */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDesignPreviewOpen(false)}
            className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full"
          >
            <X className="h-6 w-6" />
          </Button>
          
          {/* عنوان الصورة */}
          <div className="absolute top-4 left-4 z-50 bg-black/50 rounded-lg px-4 py-2 backdrop-blur-sm">
            <h3 className="text-white font-bold text-lg">{designPreviewTitle}</h3>
            <p className="text-white/70 text-sm">{billboard.Billboard_Name || `لوحة ${billboard.ID}`}</p>
          </div>
          
          {/* الصورة المكبرة */}
          <img 
            src={designPreviewUrl} 
            alt={designPreviewTitle}
            className="max-w-full max-h-[85vh] object-contain" 
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/placeholder.svg";
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
};
