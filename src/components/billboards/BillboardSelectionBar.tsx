import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Printer, CheckSquare, Square, Loader2, Image as ImageIcon, Settings, Camera, CameraOff, ImageOff, DollarSign, Tag, Percent, Save, RotateCcw, FileDown, Users, Megaphone, Calendar, CircleCheck, LayoutGrid, Palette, Columns, Check } from 'lucide-react';
import { toast } from 'sonner';
import { renderAllBillboardsTablePagesPreviewLike, BillboardRowData } from '@/lib/contractTableRenderer';
import { useContractTemplateSettings, DEFAULT_SECTION_SETTINGS } from '@/hooks/useContractTemplateSettings';
import { useContractPrint } from '@/hooks/useContractPrint';
import { supabase } from '@/integrations/supabase/client';
import { getCustomerCategories, getPriceFor, getDailyPriceFor, type CustomerType } from '@/services/pricingService';

interface BillboardSelectionBarProps {
  selectedBillboards: any[];
  filteredBillboards: any[];
  onClearSelection: () => void;
  onSelectAll: () => void;
  isAllSelected: boolean;
}

const AVAILABLE_BACKGROUNDS = [
  { id: 'template', name: 'من إعدادات القالب', url: 'template', preview: null, description: 'استخدام الخلفية المحفوظة في قالب العقد' },
  { id: 'bgc1', name: 'الذهبية الرسمية', url: '/bgc1.svg', preview: '/bgc1.svg', description: 'خلفية ذهبية فاخرة للعقود' },
  { id: 'bgc2', name: 'جدول بسيط', url: '/bgc2.svg', preview: '/bgc2.svg', description: 'خلفية بيضاء مع إطار ذهبي' },
  { id: 'mt1', name: 'جدول اللوحات', url: '/mt1.svg', preview: '/mt1.svg', description: 'مخصصة لتقارير اللوحات' },
  { id: 'ipg', name: 'قائمة الأسعار', url: '/ipg.svg', preview: '/ipg.svg', description: 'تصميم لعرض الأسعار' },
  { id: 'none', name: 'بدون خلفية', url: 'none', preview: null, description: 'طباعة بخلفية بيضاء نظيفة' },
  { id: 'custom', name: 'رابط مخصص', url: 'custom', preview: null, description: 'أدخل رابط خلفية مخصص' },
];

const PRINT_SETTINGS_KEY = 'billboard_print_settings';

interface PrintSettings {
  showLogo: boolean;
  showTableTerm: boolean;
  showImages: boolean;
  showPricing: boolean;
  showAdType: boolean; // إظهار نوع الإعلان
  showEndDate: boolean; // إظهار تاريخ الانتهاء
  showStatus: boolean; // إظهار الحالة
  backgroundType: 'preset' | 'custom';
  selectedBackground: string;
  customBackgroundUrl: string;
  selectedPeriod: string;
  selectedCustomerCategory: string;
  discounts: { [level: string]: { type: 'percentage' | 'fixed'; value: number } };
}

const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  showLogo: true,
  showTableTerm: false,
  showImages: true,
  showPricing: false,
  showAdType: false,
  showEndDate: false,
  showStatus: false,
  backgroundType: 'preset',
  selectedBackground: 'template',
  customBackgroundUrl: '',
  selectedPeriod: '1',
  selectedCustomerCategory: 'عادي',
  discounts: {},
};

// فترات الإيجار (تتوافق مع جدول الأسعار)
const RENTAL_PERIODS = [
  { value: 'daily', label: 'يومي', months: 0 },
  { value: '1', label: 'شهر', months: 1 },
  { value: '2', label: 'شهرين', months: 2 },
  { value: '3', label: '3 شهور', months: 3 },
  { value: '6', label: '6 شهور', months: 6 },
  { value: '12', label: 'سنة', months: 12 },
];

export const BillboardSelectionBar: React.FC<BillboardSelectionBarProps> = ({
  selectedBillboards,
  filteredBillboards,
  onClearSelection,
  onSelectAll,
  isAllSelected
}) => {
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  
  // إعدادات الطباعة
  const [showLogo, setShowLogo] = useState(true);
  const [showTableTerm, setShowTableTerm] = useState(false);
  const [showImages, setShowImages] = useState(true);
  const [showPricing, setShowPricing] = useState(false);
  const [showAdType, setShowAdType] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState('template');
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState('');
  const [backgroundType, setBackgroundType] = useState<'preset' | 'custom'>('preset');
  const [selectedPeriod, setSelectedPeriod] = useState('1');
  const [selectedCustomerCategory, setSelectedCustomerCategory] = useState<CustomerType>('عادي');
  const [customerCategories, setCustomerCategories] = useState<CustomerType[]>(['عادي', 'المدينة', 'مسوق', 'شركات']);
  const [billboardPrices, setBillboardPrices] = useState<Record<string, number | null>>({});
  const [discounts, setDiscounts] = useState<{ [level: string]: { type: 'percentage' | 'fixed'; value: number } }>({});

  // أسماء عدد الأوجه (من جدول الإعدادات billboard_faces)
  const [billboardFacesLabels, setBillboardFacesLabels] = useState<Record<number, string>>({});
  // ✅ استخدام useContractTemplateSettings hook مباشرة - مرتبط بإعدادات قالب العقد
  const { data: templateData, isLoading: templateLoading } = useContractTemplateSettings();
  
  // الإعدادات المدمجة من القالب
  const settings = useMemo(() => {
    return templateData?.settings || DEFAULT_SECTION_SETTINGS;
  }, [templateData]);
  
  const templateTableBackgroundUrl = useMemo(() => {
    return templateData?.tableBackgroundUrl || '/bgc2.svg';
  }, [templateData]);

  // استخراج الفئات الفريدة من اللوحات المحددة
  const uniqueLevels = useMemo(() => {
    const levels = new Set<string>();
    selectedBillboards.forEach(billboard => {
      const level = (billboard.Level || billboard.level || 'A').toUpperCase();
      levels.add(level);
    });
    return Array.from(levels).sort();
  }, [selectedBillboards]);

  // تحميل الإعدادات المحفوظة
  useEffect(() => {
    const loadSettings = async () => {
      if (!printDialogOpen) return;
      
      setIsLoadingSettings(true);
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', PRINT_SETTINGS_KEY)
          .maybeSingle();

        if (data?.setting_value) {
          const savedSettings: PrintSettings = JSON.parse(data.setting_value);
          setShowLogo(savedSettings.showLogo ?? true);
          setShowTableTerm(savedSettings.showTableTerm ?? false);
          setShowImages(savedSettings.showImages ?? true);
          setShowPricing(savedSettings.showPricing ?? false);
          setShowAdType(savedSettings.showAdType ?? false);
          setShowEndDate(savedSettings.showEndDate ?? false);
          setShowStatus(savedSettings.showStatus ?? false);
          setBackgroundType(savedSettings.backgroundType ?? 'preset');
          setSelectedBackground(savedSettings.selectedBackground ?? 'template');
          setCustomBackgroundUrl(savedSettings.customBackgroundUrl ?? '');
          setSelectedPeriod(savedSettings.selectedPeriod ?? '1');
          setSelectedCustomerCategory((savedSettings.selectedCustomerCategory as CustomerType) ?? 'عادي');
          setDiscounts(savedSettings.discounts ?? {});
        }
      } catch (error) {
        console.error('Error loading print settings:', error);
      } finally {
        setIsLoadingSettings(false);
      }
    };

    loadSettings();
  }, [printDialogOpen]);

  // تحميل أسماء عدد الأوجه من جدول الإعدادات
  useEffect(() => {
    const loadFacesLabels = async () => {
      if (!printDialogOpen) return;

      try {
        const { data, error } = await supabase
          .from('billboard_faces')
          .select('face_count, name, is_active');

        if (error) throw error;

        const map: Record<number, string> = {};
        (data || [])
          .filter((r) => r && (r as any).face_count != null && (r as any).name)
          .filter((r) => (r as any).is_active !== false)
          .forEach((r) => {
            const count = Number((r as any).face_count);
            if (Number.isFinite(count)) map[count] = String((r as any).name);
          });

        setBillboardFacesLabels(map);
      } catch (e) {
        console.error('Error loading billboard faces labels:', e);
      }
    };

    loadFacesLabels();
  }, [printDialogOpen]);

  // تحميل فئات العملاء من جدول الأسعار
  useEffect(() => {
    const loadCategories = async () => {
      if (!printDialogOpen) return;
      try {
        const categories = await getCustomerCategories();
        if (categories.length > 0) {
          setCustomerCategories(categories);
        }
      } catch (e) {
        console.error('Error loading customer categories:', e);
      }
    };
    loadCategories();
  }, [printDialogOpen]);

  // جلب الأسعار عند تغيير الفئة أو المدة
  useEffect(() => {
    const loadPrices = async () => {
      if (!showPricing || selectedBillboards.length === 0) {
        setBillboardPrices({});
        return;
      }

      const prices: Record<string, number | null> = {};
      const period = RENTAL_PERIODS.find(p => p.value === selectedPeriod);
      const months = period?.months || 1;

      for (const billboard of selectedBillboards) {
        const id = String(billboard.ID || billboard.id || '');
        const size = billboard.Size || billboard.size || '';
        const level = billboard.Level || billboard.level || 'A';

        let price: number | null = null;
        if (selectedPeriod === 'daily') {
          price = await getDailyPriceFor(size, level, selectedCustomerCategory);
        } else {
          price = await getPriceFor(size, level, selectedCustomerCategory, months);
        }

        // تطبيق التخفيض حسب الفئة
        const levelKey = level.toUpperCase();
        const discount = discounts[levelKey];
        if (price !== null && discount && discount.value > 0) {
          if (discount.type === 'percentage') {
            price = price * (1 - discount.value / 100);
          } else {
            price = price - discount.value;
          }
          if (price < 0) price = 0;
        }

        prices[id] = price;
      }

      setBillboardPrices(prices);
    };

    loadPrices();
  }, [showPricing, selectedPeriod, selectedCustomerCategory, selectedBillboards, discounts]);

  // حفظ الإعدادات
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const settingsToSave: PrintSettings = {
        showLogo,
        showTableTerm,
        showImages,
        showPricing,
        showAdType,
        showEndDate,
        showStatus,
        backgroundType,
        selectedBackground,
        customBackgroundUrl,
        selectedPeriod,
        selectedCustomerCategory,
        discounts,
      };

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: PRINT_SETTINGS_KEY,
          setting_value: JSON.stringify(settingsToSave),
          setting_type: 'json',
          description: 'إعدادات طباعة اللوحات',
          category: 'print',
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      toast.success('تم حفظ إعدادات الطباعة');
    } catch (error) {
      console.error('Error saving print settings:', error);
      toast.error('فشل في حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  // إعادة تعيين الإعدادات
  const handleResetSettings = () => {
    setShowLogo(DEFAULT_PRINT_SETTINGS.showLogo);
    setShowTableTerm(DEFAULT_PRINT_SETTINGS.showTableTerm);
    setShowImages(DEFAULT_PRINT_SETTINGS.showImages);
    setShowPricing(DEFAULT_PRINT_SETTINGS.showPricing);
    setShowAdType(DEFAULT_PRINT_SETTINGS.showAdType);
    setShowEndDate(DEFAULT_PRINT_SETTINGS.showEndDate);
    setShowStatus(DEFAULT_PRINT_SETTINGS.showStatus);
    setBackgroundType(DEFAULT_PRINT_SETTINGS.backgroundType);
    setSelectedBackground(DEFAULT_PRINT_SETTINGS.selectedBackground);
    setCustomBackgroundUrl(DEFAULT_PRINT_SETTINGS.customBackgroundUrl);
    setSelectedPeriod(DEFAULT_PRINT_SETTINGS.selectedPeriod);
    setSelectedCustomerCategory(DEFAULT_PRINT_SETTINGS.selectedCustomerCategory as CustomerType);
    setDiscounts(DEFAULT_PRINT_SETTINGS.discounts);
    toast.info('تم إعادة تعيين الإعدادات');
  };

  const handleDiscountChange = (level: string, field: 'type' | 'value', value: string | number) => {
    setDiscounts(prev => ({
      ...prev,
      [level]: {
        type: prev[level]?.type || 'percentage',
        value: prev[level]?.value || 0,
        [field]: field === 'value' ? Number(value) || 0 : value
      }
    }));
  };

  const getBackgroundUrl = (): string => {
    // إذا تم اختيار "رابط مخصص" من القائمة
    if (selectedBackground === 'custom' && customBackgroundUrl) {
      return customBackgroundUrl;
    }
    // دعم النظام القديم (backgroundType)
    if (backgroundType === 'custom' && customBackgroundUrl) {
      return customBackgroundUrl;
    }
    if (selectedBackground === 'template') {
      return templateTableBackgroundUrl;
    }
    return selectedBackground === 'none' || selectedBackground === 'custom' ? '' : selectedBackground;
  };

  // تحويل اللوحات للتنسيق المطلوب - نفس التنسيق المستخدم في طباعة العقد
  // ✅ دالة مساعدة لحساب الحالة الفعلية بناءً على بيانات العقد الساري
  const calculateActualStatus = (billboard: any, activeContract: any): string => {
    const rawStatus = String(billboard.Status ?? billboard.status ?? '').trim();
    const maintStatus = String(billboard.maintenance_status ?? '').trim();
    
    // التحقق من حالات الصيانة والإزالة أولاً
    if (rawStatus === 'removed' || rawStatus === 'مزالة') return 'مزالة';
    if (rawStatus === 'not_installed' || rawStatus === 'غير مركبة') return 'غير مركبة';
    if (rawStatus === 'needs_removal' || rawStatus === 'بحاجة للإزالة') return 'بحاجة للإزالة';
    if (maintStatus === 'متضررة اللوحة') return 'متضررة';
    if (rawStatus === 'صيانة' || rawStatus === 'maintenance' || maintStatus === 'repair_needed') return 'صيانة';
    
    // إذا وجد عقد ساري = محجوز
    if (activeContract) return 'محجوز';
    
    // التحقق من العقد في بيانات اللوحة نفسها
    const contractNum = billboard.Contract_Number || billboard.contractNumber;
    const endDate = billboard.Rent_End_Date || billboard.rent_end_date;
    if (contractNum && endDate) {
      try {
        const endDateObj = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (endDateObj >= today) return 'محجوز';
      } catch {}
    }
    
    return 'متاح';
  };

  const prepareBillboardsData = async (billboards: any[]): Promise<BillboardRowData[]> => {
    const period = RENTAL_PERIODS.find(p => p.value === selectedPeriod);
    const periodLabel = period?.label || '';

    // ✅ جلب العقود السارية لجميع اللوحات المحددة
    const billboardIds = billboards.map(b => String(b.ID || b.id || ''));
    const today = new Date().toISOString().split('T')[0];
    
    let activeContracts: Record<string, any> = {};
    
    if (showStatus) {
      try {
        const { data: contractsData } = await supabase
          .from('Contract')
          .select('Contract_Number, "Customer Name", "Ad Type", "End Date", billboard_ids')
          .gte('"End Date"', today);
        
        if (contractsData) {
          // بناء خريطة للوحات وعقودها السارية
          for (const contract of contractsData) {
            const idsStr = contract.billboard_ids || '';
            for (const billboardId of billboardIds) {
              // التحقق من وجود ID اللوحة في قائمة billboard_ids
              const idPattern = new RegExp(`(^|,)\\s*${billboardId}\\s*(,|$)`);
              if (idPattern.test(idsStr)) {
                activeContracts[billboardId] = contract;
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading active contracts for print:', error);
      }
    }

    return billboards.map((b) => {
      const facesRaw = b.Faces_Count ?? b.faces_count ?? b.faces ?? '1';
      const facesNum = Number(facesRaw);
      const facesLabel = Number.isFinite(facesNum) ? billboardFacesLabels[facesNum] : undefined;
      const id = String(b.ID || b.id || '');
      // استخدام اسم اللوحة (Billboard_Name) كـ "كود" بدلاً من الرقم
      const billboardCode = b.Billboard_Name || b.billboard_name || id;
      const calculatedPrice = showPricing ? billboardPrices[id] : null;
      const priceStr = calculatedPrice !== null && calculatedPrice !== undefined 
        ? `${Math.round(calculatedPrice).toLocaleString()}` 
        : '';

      // ✅ حساب الحالة الفعلية بناءً على العقد الساري
      const activeContract = activeContracts[id];
      const actualStatus = calculateActualStatus(b, activeContract);

      return {
        id: billboardCode,
        billboardName: b.Billboard_Name || b.billboard_name || '',
        image: showImages ? (b.Image_URL || b.image_url || '') : '',
        municipality: b.Municipality || b.municipality || '',
        district: b.District || b.district || '',
        landmark: b.Nearest_Landmark || b.nearest_landmark || '',
        size: b.Size || b.size || '',
        level: b.Level || b.level || '',
        // ✅ عرض عدد الأوجه كنص من إعدادات billboard_faces إذا توفر
        faces: facesLabel || String(facesRaw ?? ''),
        // ✅ السعر من جدول الأسعار إذا كانت الأسعار مفعلة
        price: priceStr,
        // ✅ تاريخ الانتهاء إذا كان مفعلاً
        rent_end_date: showEndDate ? (b.Rent_End_Date || b.rent_end_date || '') : '',
        // ✅ مدة الإيجار المختارة إذا كانت الأسعار مفعلة
        duration_days: showPricing ? periodLabel : '',
        // ✅ نوع الإعلان إذا كان مفعلاً
        ad_type: showAdType ? (b.Ad_Type || b.ad_type || b['Ad Type'] || '') : '',
        // ✅ الحالة الفعلية بناءً على العقد الساري
        status: showStatus ? actualStatus : '',
        mapLink:
          b.GPS_Link || b.GPS_Coordinates
            ? `https://www.google.com/maps?q=${b.GPS_Coordinates || ''}`
            : '',
      };
    });
  };

  const { printMultiplePages } = useContractPrint();

  const handlePrint = async () => {
    if (selectedBillboards.length === 0) {
      toast.error('لم يتم اختيار أي لوحات');
      return;
    }

    setIsPrinting(true);

    try {
      const bgUrl = getBackgroundUrl();
      const billboardsData = await prepareBillboardsData(selectedBillboards);

      // 🔍 تتبع البيانات للتشخيص
      console.log('🔍 Print Debug:', {
        showEndDate,
        showAdType,
        showStatus,
        billboardsDataSample: billboardsData.slice(0, 2).map(b => ({
          id: b.id,
          rent_end_date: b.rent_end_date,
          ad_type: b.ad_type,
          status: b.status
        }))
      });

      // ✅ مهم: "بدون خلفية" يرجّع '' ويجب عدم استبداله بخلفية افتراضية
      const tableBgUrl = bgUrl === '' ? '' : (bgUrl || templateTableBackgroundUrl || '/bgc2.svg');

      // ✅ إضافة الأعمدة الديناميكية بناءً على الإعدادات
      const baseColumns = settings.tableSettings?.columns || [];
      
      // إزالة عمود الـ QR مؤقتاً لإضافته في النهاية
      const locationColumnIndex = baseColumns.findIndex(c => c.key === 'location');
      const locationColumn = locationColumnIndex >= 0 ? baseColumns[locationColumnIndex] : null;
      const columnsWithoutLocation = locationColumnIndex >= 0 
        ? baseColumns.filter((_, i) => i !== locationColumnIndex)
        : baseColumns;
      
      // ✅ تحديث الأعمدة الموجودة أو إضافتها حسب إعدادات المستخدم
      let dynamicColumns = columnsWithoutLocation.map(col => {
        // تحديث حالة ظهور عمود نوع الإعلان
        if (col.key === 'adType') {
          return { ...col, visible: showAdType };
        }
        // تحديث حالة ظهور عمود تاريخ الانتهاء
        if (col.key === 'endDate') {
          return { ...col, visible: showEndDate };
        }
        // تحديث حالة ظهور عمود الحالة
        if (col.key === 'status') {
          return { ...col, visible: showStatus };
        }
        return col;
      });
      
      // إضافة عمود نوع الإعلان إذا كان مفعلاً وغير موجود
      if (showAdType && !dynamicColumns.some(c => c.key === 'adType')) {
        dynamicColumns.push({ key: 'adType', label: 'نوع الإعلان', visible: true, width: 8, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 });
      }
      
      // إضافة عمود تاريخ الانتهاء إذا كان مفعلاً وغير موجود
      if (showEndDate && !dynamicColumns.some(c => c.key === 'endDate')) {
        dynamicColumns.push({ key: 'endDate', label: 'تاريخ الانتهاء', visible: true, width: 9, fontSize: 24, headerFontSize: 26, padding: 2, lineHeight: 1.3 });
      }
      
      // إضافة عمود الحالة إذا كان مفعلاً وغير موجود
      if (showStatus && !dynamicColumns.some(c => c.key === 'status')) {
        dynamicColumns.push({ key: 'status', label: 'الحالة', visible: true, width: 7, fontSize: 26, headerFontSize: 28, padding: 2, lineHeight: 1.3 });
      }
      
      // إضافة عمود الـ QR في النهاية
      if (locationColumn) {
        dynamicColumns.push(locationColumn);
      }

      // إنشاء نسخة معدلة من الإعدادات مع الأعمدة الجديدة
      const adjustedSettings = {
        ...settings,
        tableSettings: {
          ...settings.tableSettings,
          columns: dynamicColumns
        }
      };

      // 🔍 تتبع الأعمدة النهائية
      console.log('🔍 Final Columns (with visibility):', dynamicColumns.map(c => ({ 
        key: c.key, 
        label: c.label, 
        visible: c.visible,
        width: c.width 
      })));
      console.log('🔍 EndDate column check:', {
        showEndDate,
        endDateColumn: dynamicColumns.find(c => c.key === 'endDate'),
        sampleData: billboardsData[0]?.rent_end_date
      });

      // ✅ صفحات HTML بحجم التصميم (2480x3508) مثل معاينة إعدادات قالب العقد
      // ✅ نمرر false دائماً لـ showTableTerm لأن هذه طباعة لوحات مستقلة بدون بنود العقد
      const pages = renderAllBillboardsTablePagesPreviewLike(
        billboardsData,
        adjustedSettings,
        tableBgUrl,
        settings.tableSettings?.maxRows || 12,
        false // لا نظهر عنوان البند والخط الذهبي في طباعة اللوحات
      ).map((pageHtml) => {
        let finalHtml = pageHtml;

        // ✅ إزالة عنوان البند/الخط الذهبي إذا كان يظهر لأي سبب (احتياط)
        finalHtml = finalHtml.replace(
          /<div\s+style="\s*text-align:\s*center;[\s\S]*?<\/div>\s*(?=<table)/,
          ''
        );
        
        if (showLogo) {
          // إضافة شعار كـ overlay بدون تغيير تخطيط الصفحة
          const logoHtml = `
            <div style="position:absolute; top:120px; right:120px; z-index:1000;">
              <img src="/logofaresgold.svg" alt="شعار الفارس" style="height:95px; width:auto;" onerror="this.style.display='none'" />
            </div>
          `;
          finalHtml = finalHtml.replace(/<div[^>]*class="[^"]*contract-preview-container[^"]*"[^>]*>/, (match) => `${match}${logoHtml}`);
        }

        return finalHtml;
      });

      if (pages.length === 0) {
        toast.error('لا توجد لوحات للطباعة');
        return;
      }

      // ✅ نفس طريقة الطباعة المستخدمة في إعدادات القالب (تحجيم تلقائي لـ A4)
      printMultiplePages(pages, {
        title: `طباعة اللوحات - ${selectedBillboards.length} لوحة`,
        designWidth: 2480,
        designHeight: 3508,
      });
    } catch (error) {
      console.error('Print error:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
      setPrintDialogOpen(false);
    }
  };

  if (selectedBillboards.length === 0) {
    return null;
  }

  return (
    <>
      {/* الشريط العائم */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-primary/95 to-primary-foreground/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-primary/20">
          {/* عدد اللوحات المختارة */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1.5 text-base font-bold bg-white/90 text-primary">
              {selectedBillboards.length}
            </Badge>
            <span className="text-white font-medium">لوحة مختارة</span>
          </div>

          <div className="w-px h-8 bg-white/30" />

          {/* اختيار الكل */}
          <Button
            variant="ghost"
            size="sm"
            onClick={isAllSelected ? onClearSelection : onSelectAll}
            className="text-white hover:bg-white/20 gap-2"
          >
            {isAllSelected ? (
              <>
                <CheckSquare className="h-4 w-4" />
                إلغاء الكل ({filteredBillboards.length})
              </>
            ) : (
              <>
                <Square className="h-4 w-4" />
                اختيار الكل ({filteredBillboards.length})
              </>
            )}
          </Button>

          <div className="w-px h-8 bg-white/30" />

          {/* زر الطباعة */}
          <Button
            onClick={() => setPrintDialogOpen(true)}
            className="bg-white text-primary hover:bg-white/90 gap-2 font-bold shadow-lg"
          >
            <Printer className="h-4 w-4" />
            طباعة اللوحات
          </Button>

          {/* زر إلغاء الاختيار */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            className="text-white hover:bg-white/20 rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* نافذة إعدادات الطباعة المبسطة */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Printer className="h-5 w-5 text-primary" />
              إعدادات الطباعة
              <Badge variant="secondary" className="mr-auto">{selectedBillboards.length} لوحة</Badge>
            </DialogTitle>
          </DialogHeader>

          {isLoadingSettings ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="display" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-3 mx-6 mt-4" style={{ width: 'calc(100% - 48px)' }}>
                <TabsTrigger value="display" className="gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  العرض
                </TabsTrigger>
                <TabsTrigger value="columns" className="gap-2">
                  <Columns className="h-4 w-4" />
                  الأعمدة
                </TabsTrigger>
                <TabsTrigger value="pricing" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  الأسعار
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 px-6">
                {/* تبويب العرض */}
                <TabsContent value="display" className="mt-4 space-y-4">
                  {/* الشعار والصور */}
                  <div className="grid grid-cols-2 gap-3">
                    <div 
                      onClick={() => setShowLogo(!showLogo)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 ${
                        showLogo ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <ImageIcon className={`h-5 w-5 ${showLogo ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="flex-1">
                        <p className="font-medium text-sm">الشعار</p>
                      </div>
                      <Switch checked={showLogo} onCheckedChange={setShowLogo} />
                    </div>

                    <div 
                      onClick={() => setShowImages(!showImages)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 ${
                        showImages ? "border-emerald-500 bg-emerald-500/10" : "border-border hover:border-emerald-500/50"
                      }`}
                    >
                      <Camera className={`h-5 w-5 ${showImages ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      <div className="flex-1">
                        <p className="font-medium text-sm">الصور</p>
                      </div>
                      <Switch checked={showImages} onCheckedChange={setShowImages} />
                    </div>
                  </div>

                  {/* الخلفية */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">الخلفية</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {AVAILABLE_BACKGROUNDS.map(bg => (
                        <button
                          key={bg.id}
                          onClick={() => setSelectedBackground(bg.url)}
                          className={`relative p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                            selectedBackground === bg.url
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          {bg.preview ? (
                            <div className="w-full h-12 rounded overflow-hidden bg-white border border-border">
                              <img 
                                src={bg.preview} 
                                alt={bg.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          ) : (
                            <div className={`w-full h-12 rounded flex items-center justify-center ${
                              bg.id === 'none' ? 'bg-white border border-dashed border-muted-foreground/30' : 
                              bg.id === 'custom' ? 'bg-white border border-dashed border-primary/50' :
                              'bg-white border border-border'
                            }`}>
                              {bg.id === 'template' ? (
                                <Settings className="h-5 w-5 text-primary" />
                              ) : bg.id === 'custom' ? (
                                <Palette className="h-5 w-5 text-primary" />
                              ) : (
                                <ImageOff className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          )}
                          <span className="text-xs font-medium text-center leading-tight">{bg.name}</span>
                          {selectedBackground === bg.url && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    
                    {/* حقل إدخال الرابط المخصص */}
                    {selectedBackground === 'custom' && (
                      <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                        <Label className="text-xs font-medium">رابط الخلفية المخصصة</Label>
                        <Input
                          type="url"
                          placeholder="https://example.com/background.svg"
                          value={customBackgroundUrl}
                          onChange={(e) => setCustomBackgroundUrl(e.target.value)}
                          className="text-xs h-9"
                          dir="ltr"
                        />
                        {customBackgroundUrl && (
                          <div className="w-full h-16 rounded overflow-hidden bg-white border border-border">
                            <img 
                              src={customBackgroundUrl} 
                              alt="معاينة الخلفية"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* وصف الخلفية المختارة */}
                    {selectedBackground !== 'custom' && AVAILABLE_BACKGROUNDS.find(bg => bg.url === selectedBackground)?.description && (
                      <p className="text-xs text-muted-foreground text-center">
                        {AVAILABLE_BACKGROUNDS.find(bg => bg.url === selectedBackground)?.description}
                      </p>
                    )}
                  </div>

                  {/* معلومات الجدول */}
                  <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 mb-2">
                      <Settings className="h-4 w-4" />
                      <span className="font-medium">إعدادات الجدول (من قالب العقد)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <span>الصفوف: {settings.tableSettings?.maxRows || 12}</span>
                      <span>الارتفاع: {settings.tableSettings?.rowHeight || 12}mm</span>
                    </div>
                  </div>
                </TabsContent>

                {/* تبويب الأعمدة الإضافية */}
                <TabsContent value="columns" className="mt-4 space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">اختر الأعمدة الإضافية للظهور في التقرير</p>
                  
                  <div 
                    onClick={() => setShowAdType(!showAdType)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 ${
                      showAdType ? "border-purple-500 bg-purple-500/10" : "border-border hover:border-purple-500/50"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      showAdType ? "bg-purple-500 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">نوع الإعلان</p>
                      <p className="text-xs text-muted-foreground">مثل: لوحات، شاشات، ستاندات</p>
                    </div>
                    <Switch checked={showAdType} onCheckedChange={setShowAdType} />
                  </div>

                  <div 
                    onClick={() => setShowEndDate(!showEndDate)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 ${
                      showEndDate ? "border-orange-500 bg-orange-500/10" : "border-border hover:border-orange-500/50"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      showEndDate ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">تاريخ الانتهاء</p>
                      <p className="text-xs text-muted-foreground">تاريخ انتهاء الإيجار</p>
                    </div>
                    <Switch checked={showEndDate} onCheckedChange={setShowEndDate} />
                  </div>

                  <div 
                    onClick={() => setShowStatus(!showStatus)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 ${
                      showStatus ? "border-green-500 bg-green-500/10" : "border-border hover:border-green-500/50"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      showStatus ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      <CircleCheck className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">الحالة</p>
                      <p className="text-xs text-muted-foreground">متاحة، غير متاحة، قريباً</p>
                    </div>
                    <Switch checked={showStatus} onCheckedChange={setShowStatus} />
                  </div>
                </TabsContent>

                {/* تبويب الأسعار */}
                <TabsContent value="pricing" className="mt-4 space-y-4">
                  <div 
                    onClick={() => setShowPricing(!showPricing)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 ${
                      showPricing ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-blue-500/50"
                    }`}
                  >
                    <DollarSign className={`h-6 w-6 ${showPricing ? 'text-blue-500' : 'text-muted-foreground'}`} />
                    <div className="flex-1">
                      <p className="font-medium">تفعيل عرض الأسعار</p>
                      <p className="text-xs text-muted-foreground">إظهار أسعار الإيجار في التقرير</p>
                    </div>
                    <Switch checked={showPricing} onCheckedChange={setShowPricing} />
                  </div>

                  {showPricing && (
                    <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">فئة العميل</Label>
                        <Select
                          value={selectedCustomerCategory}
                          onValueChange={(v) => setSelectedCustomerCategory(v as CustomerType)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر فئة العميل" />
                          </SelectTrigger>
                          <SelectContent>
                            {customerCategories.map(category => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">مدة الإيجار</Label>
                        <div className="flex flex-wrap gap-2">
                          {RENTAL_PERIODS.map(period => (
                            <button
                              key={period.value}
                              onClick={() => setSelectedPeriod(period.value)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-all ${
                                selectedPeriod === period.value
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-border hover:border-primary/50"
                              }`}
                            >
                              {period.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {uniqueLevels.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <Percent className="w-4 h-4" />
                            التخفيضات
                          </Label>
                          <div className="space-y-2">
                            {uniqueLevels.map(level => (
                              <div key={level} className="flex items-center gap-2 p-2 bg-background rounded border">
                                <span className="w-14 text-sm font-medium text-primary">فئة {level}</span>
                                <Select
                                  value={discounts[level]?.type || 'percentage'}
                                  onValueChange={(v) => handleDiscountChange(level, 'type', v)}
                                >
                                  <SelectTrigger className="w-24 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="percentage">%</SelectItem>
                                    <SelectItem value="fixed">د.ل</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  min="0"
                                  value={discounts[level]?.value || 0}
                                  onChange={(e) => handleDiscountChange(level, 'value', e.target.value)}
                                  className="w-20 h-8"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>

              {/* أزرار الإجراءات */}
              <div className="p-4 border-t mt-auto space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span className="mr-1">حفظ</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetSettings}
                    className="flex-1"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span className="mr-1">إعادة تعيين</span>
                  </Button>
                </div>

                <Button
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="w-full"
                  size="lg"
                >
                  {isPrinting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <FileDown className="h-5 w-5" />
                  )}
                  <span className="mr-2 font-bold">طباعة التقرير</span>
                </Button>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BillboardSelectionBar;
