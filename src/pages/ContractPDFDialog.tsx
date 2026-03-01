import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Printer, X, Download, Eye, Send } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';
import { useContractTemplateSettings, DEFAULT_SECTION_SETTINGS } from '@/hooks/useContractTemplateSettings';
import { ContractPDFPreview } from '@/components/contracts/ContractPDFPreview';
import { ContractPDFSummary } from '@/components/contracts/ContractPDFSummary';
import { ContractPDFActions } from '@/components/contracts/ContractPDFActions';
import { 
  renderAllBillboardsTablePages,
  renderBillboardsTablePage,
  BillboardRowData,
  solidFillDataUri,
} from '@/lib/contractTableRenderer';
import { 
  generateUnifiedPrintHTML, 
  openUnifiedPrintWindow, 
  BillboardPrintData as UnifiedBillboardData,
  ContractTerm as UnifiedContractTerm
} from '@/lib/unifiedContractPrint';
import { Installment, generatePaymentsClauseText } from '@/utils/paymentGrouping';

interface ContractPDFDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: any;
}

// ✅ تنسيق تاريخ DD/MM/YYYY للعرض داخل نص البند الخامس
const formatDateForDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

/**
 * ✅ البند الخامس: صيغة الدفعات المطلوبة
 * - لا نبدأ السطر برقم (لمنع مشكلة RTL)
 * - نفصل "دفعة أولى" دائماً ثم نجمع المتكرر بعد ذلك فقط
 */
const formatPaymentsClauseText = (
  installmentsData: string | null,
  currencySymbol: string,
  currencyWrittenName: string
): string => {
  if (!installmentsData) return 'دفعة واحدة عند التوقيع';

  try {
    const raw: any[] = typeof installmentsData === 'string' ? JSON.parse(installmentsData) : (installmentsData as any);
    const installments: Installment[] = Array.isArray(raw)
      ? raw.map((inst: any, idx: number) => ({
          amount: Number(inst?.amount ?? 0) || 0,
          description: String(inst?.description ?? inst?.desc ?? `الدفعة ${idx + 1}`).trim(),
          paymentType: String(inst?.paymentType ?? inst?.type ?? inst?.payment_type ?? '').trim(),
          dueDate: String(inst?.dueDate ?? inst?.due_date ?? '').trim(),
        }))
      : [];

    if (installments.length === 0) return 'دفعة واحدة عند التوقيع';

    return generatePaymentsClauseText(installments, currencySymbol, currencyWrittenName);
  } catch (e) {
    console.error('Error parsing installments:', e);
    return 'دفعة واحدة عند التوقيع';
  }
};

// ✅ HTML للمعاينة فقط
const formatPaymentsSummary = (installmentsData: string | null, currencySymbol: string, currencyWrittenName: string): string => {
  return formatPaymentsClauseText(installmentsData, currencySymbol, currencyWrittenName);
};

// ✅ نسخة للطباعة SVG (بدون HTML)
const formatPaymentsSummaryPlain = (installmentsData: string | null, currencySymbol: string, currencyWrittenName: string): string => {
  return formatPaymentsClauseText(installmentsData, currencySymbol, currencyWrittenName);
};

// ✅ NEW: Currency options with written names in Arabic
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', writtenName: 'دولار أمريكي' },
  { code: 'EUR', name: 'يورو', symbol: '€', writtenName: 'يورو' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£', writtenName: 'جنيه إسترليني' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', writtenName: 'ريال سعودي' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', writtenName: 'درهم إماراتي' },
];

// ✅ FIXED: Custom number formatting function for Arabic locale with proper thousands separator
const formatArabicNumber = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';

  // ✅ تقريب لرقم واحد بعد الفاصلة العشرية
  const rounded = Math.round(Number(num) * 10) / 10;

  // استخدم فاصل الآلاف "," والفاصل العشري "." مع رقم واحد بعد الفاصلة
  const [integerPart, decimalPart = '0'] = rounded.toString().split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${formattedInteger}.${decimalPart}`;
};

// ✅ Helper function to wrap LTR content (English text, numbers, phone numbers) for proper RTL display
const wrapLTRContent = (text: string): string => {
  if (!text) return '';

  // Wrap phone numbers with LTR marks
  // Match phone patterns like 0912612255, +218912612255, etc.
  let result = text.replace(
    /(\+?\d[\d\s\-()]{6,})/g,
    '<span class="phone-number">$1</span>'
  );

  // Wrap English text (sequences of Latin characters)
  result = result.replace(
    /([a-zA-Z][a-zA-Z0-9\s\-_.]*[a-zA-Z0-9]|[a-zA-Z])/g,
    '<span class="english-text">$1</span>'
  );

  return result;
};

// ✅ SVG helper: isolate Latin runs as LTR tspans inside RTL text
const wrapSvgLTRRuns = (text: string): string => {
  if (!text) return '';
  return text.replace(
    /([A-Za-z0-9][A-Za-z0-9\s\-_.&()\/+]*)/g,
    '<tspan direction="ltr" unicode-bidi="embed">$1</tspan>'
  );
};

// ✅ Text measurement (matches ContractTermsSettings preview behavior)
const __textMeasureCache = new Map<string, number>();
let __textMeasureCtx: CanvasRenderingContext2D | null = null;

function measureTextWidthPx(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: string | number = 400
): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.5;

  const key = `${fontFamily}|${fontWeight}|${fontSize}|${text}`;
  const cached = __textMeasureCache.get(key);
  if (cached != null) return cached;

  if (!__textMeasureCtx) {
    const canvas = document.createElement('canvas');
    __textMeasureCtx = canvas.getContext('2d');
  }

  if (!__textMeasureCtx) return text.length * fontSize * 0.5;

  __textMeasureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const width = __textMeasureCtx.measureText(text).width;
  __textMeasureCache.set(key, width);
  return width;
}

// ✅ Interface for contract terms
interface ContractTerm {
  id: string;
  term_key: string;
  term_title: string;
  term_content: string;
  term_order: number;
  is_active: boolean;
  font_size: number;
  font_weight: string;
  position_x: number;
  position_y: number;
}

export default function ContractPDFDialog({ open, onOpenChange, contract }: ContractPDFDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [printMode, setPrintMode] = useState<'auto' | 'manual'>('auto');
  const [useInstallationImages, setUseInstallationImages] = useState(false); // ✅ NEW: خيار استخدام صور التركيب
  const [customerData, setCustomerData] = useState<{
    name: string;
    company: string | null;
    phone: string | null;
  } | null>(null);
  // دالة لجلب بيانات المقاسات والبلديات والمستويات
  const [sizesData, setSizesData] = useState<any[]>([]);
  const [municipalitiesData, setMunicipalitiesData] = useState<any[]>([]);
  const [levelsData, setLevelsData] = useState<any[]>([]);
  // ✅ NEW: Contract terms from database
  const [contractTerms, setContractTerms] = useState<ContractTerm[]>([]);
  
  // ✅ NEW: Preview states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHTML, setPreviewHTML] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [yearlyContractCode, setYearlyContractCode] = useState('');
  const [sizesSummary, setSizesSummary] = useState<{size: string; count: number}[]>([]);
  
  // WhatsApp sending
  const { sendMessage, loading: sendingWhatsApp } = useSendWhatsApp();
  
  // ✅ جلب إعدادات القالب من قاعدة البيانات
  const { data: templateData } = useContractTemplateSettings();
  const templateSettings = templateData?.settings || DEFAULT_SECTION_SETTINGS;
  const templateBgUrl = templateData?.backgroundUrl || '/bgc1.svg';
  const tableBgUrl = templateData?.tableBackgroundUrl || '/bgc2.svg';

  // ✅ جلب بنود العقد من قاعدة البيانات
  const loadContractTerms = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_terms')
        .select('*')
        .eq('is_active', true)
        .order('term_order', { ascending: true });
      
      if (!error && data) {
        setContractTerms(data);
      }
    } catch (error) {
      console.error('Error loading contract terms:', error);
    }
  };

  useEffect(() => {
    if (open) {
      loadContractTerms();
    }
  }, [open]);

  // ✅ تحميل كود العقد السنوي عند فتح الحوار
  useEffect(() => {
    const loadYearlyCode = async () => {
      const contractDate = contract?.start_date || contract?.['Contract Date'];
      if (!contractDate) {
        setYearlyContractCode('');
        return;
      }
      
      const cDate = new Date(contractDate);
      if (isNaN(cDate.getTime())) {
        setYearlyContractCode('');
        return;
      }
      
      const cYear = cDate.getFullYear();
      const yearShort = cYear.toString().slice(-2);
      
      try {
        const startOfYear = `${cYear}-01-01`;
        const endOfYear = `${cYear}-12-31`;
        
        const { data: yearContracts } = await supabase
          .from('Contract')
          .select('Contract_Number, "Contract Date"')
          .gte('"Contract Date"', startOfYear)
          .lte('"Contract Date"', endOfYear)
          .order('Contract_Number', { ascending: true });
        
        if (yearContracts && yearContracts.length > 0) {
          const currentContractNum = contract?.Contract_Number || contract?.id;
          const order = yearContracts.findIndex(c => c.Contract_Number === currentContractNum) + 1;
          if (order > 0) {
            setYearlyContractCode(`${order}/${yearShort}`);
            return;
          }
        }
        
        const contractNum = parseInt(String(contract?.Contract_Number || contract?.id || '0'));
        setYearlyContractCode(`${contractNum}/${yearShort}`);
      } catch (error) {
        console.error('Error getting yearly code:', error);
        setYearlyContractCode('');
      }
    };
    
    if (open && contract) {
      loadYearlyCode();
    }
  }, [open, contract]);

  const loadSortingData = async () => {
    try {
      const [sizesRes, municipalitiesRes, levelsRes] = await Promise.all([
        supabase.from('sizes').select('*'),
        supabase.from('municipalities').select('*'),
        supabase.from('billboard_levels').select('*')
      ]);
      
      if (!sizesRes.error && Array.isArray(sizesRes.data)) {
        setSizesData(sizesRes.data);
      }
      if (!municipalitiesRes.error && Array.isArray(municipalitiesRes.data)) {
        setMunicipalitiesData(municipalitiesRes.data);
      }
      if (!levelsRes.error && Array.isArray(levelsRes.data)) {
        setLevelsData(levelsRes.data);
      }
    } catch (error) {
      console.error('Error loading sorting data:', error);
    }
  };

  useEffect(() => {
    if (open) {
      loadSortingData();
    }
  }, [open]);

  // ✅ حساب ملخص المقاسات عند فتح الحوار
  useEffect(() => {
    const calculateSizesSummary = async () => {
      if (!open || !contract) return;
      
      try {
        // جلب بيانات اللوحات
        const billboardIds = contract?.billboard_ids;
        let billboards: any[] = [];
        
        if (billboardIds) {
          const idsArray = typeof billboardIds === 'string' 
            ? billboardIds.split(',').map(id => id.trim()).filter(Boolean)
            : Array.isArray(billboardIds) ? billboardIds : [];
          
          if (idsArray.length > 0) {
            const { data } = await supabase
              .from('billboards')
              .select('Size')
              .in('ID', idsArray);
            
            if (data) billboards = data;
          }
        }
        
        // إذا لم نجد لوحات، استخدم البيانات المحفوظة
        if (billboards.length === 0 && contract?.billboards) {
          billboards = Array.isArray(contract.billboards) ? contract.billboards : [];
        }
        
        // حساب ملخص المقاسات
        const sizeCounts: Record<string, number> = {};
        billboards.forEach((b: any) => {
          const size = b.Size || b.size || 'غير محدد';
          sizeCounts[size] = (sizeCounts[size] || 0) + 1;
        });
        
        const summary = Object.entries(sizeCounts).map(([size, count]) => ({
          size: size.replace(/x/gi, '×'),
          count
        }));
        
        setSizesSummary(summary);
      } catch (error) {
        console.error('Error calculating sizes summary:', error);
        setSizesSummary([]);
      }
    };
    
    calculateSizesSummary();
  }, [open, contract]);

  // ✅ REFACTORED: Get currency information from contract
  const getCurrencyInfo = () => {
    const currencyCode = contract?.contract_currency || 'LYD';
    const currency = CURRENCIES.find(c => c.code === currencyCode);
    return {
      code: currencyCode,
      symbol: currency?.symbol || 'د.ل',
      name: currency?.name || 'دينار ليبي',
      writtenName: currency?.writtenName || 'دينار ليبي'
    };
  };

  // ✅ REFACTORED: Get discount information from contract - استخراج معلومات التخفيض من جميع المصادر الممكنة
  const getDiscountInfo = () => {
    const currencyInfo = getCurrencyInfo();
    const contractAny = contract as any;
    
    // البحث في جميع الحقول المحتملة للتخفيض
    let discountNum = 0;
    
    // 1. حقل Discount المباشر (من حفظ العقد)
    if (contractAny?.Discount !== undefined && contractAny?.Discount !== null) {
      discountNum = Number(contractAny.Discount);
    } else if (contractAny?.discount !== undefined && contractAny?.discount !== null) {
      discountNum = Number(contractAny.discount);
    }
    
    // 2. حساب التخفيض من level_discounts إذا كان موجوداً ولم يكن هناك تخفيض مباشر
    if (discountNum === 0 && contractAny?.level_discounts && typeof contractAny.level_discounts === 'object') {
      const levelDiscounts = contractAny.level_discounts as Record<string, number>;
      const billboards = contract?.billboards || [];
      
      if (billboards.length > 0 && Object.keys(levelDiscounts).length > 0) {
        let totalDiscountAmount = 0;
        
        billboards.forEach((billboard: any) => {
          const level = billboard.level || billboard.Level || billboard.billboard_level || '';
          const discountPercent = levelDiscounts[level] || 0;
          const billboardPrice = Number(billboard.price_after_discount || billboard.total_price || billboard.price || 0);
          
          if (discountPercent > 0 && billboardPrice > 0) {
            // إعادة حساب السعر الأصلي قبل الخصم
            const originalPrice = billboardPrice / (1 - discountPercent / 100);
            totalDiscountAmount += originalPrice - billboardPrice;
          }
        });
        
        discountNum = totalDiscountAmount;
      }
    }
    
    // 3. حساب التخفيض من الفرق بين السعر الكلي والمجموع
    if (discountNum === 0 && contract?.billboards && contract.billboards.length > 0) {
      const billboardsTotal = contract.billboards.reduce((sum: number, b: any) => {
        return sum + Number(b.total_price_before_discount || b.price_before_discount || 0);
      }, 0);
      
      const totalCost = Number(contract?.rent_cost || contract?.['Total Rent'] || (contractAny)?.Total || 0);
      
      if (billboardsTotal > 0 && billboardsTotal > totalCost) {
        discountNum = billboardsTotal - totalCost;
      }
    }

    // ✅ التحقق من أن الخصم ليس تكلفة الطباعة
    const printCostEnabled = Boolean(
      contractAny?.print_cost_enabled === true ||
        contractAny?.print_cost_enabled === 1 ||
        contractAny?.print_cost_enabled === 'true' ||
        contractAny?.print_cost_enabled === '1'
    );
    const printCost = Number(contractAny?.print_cost ?? 0);
    
    // إذا الخصم يساوي تكلفة الطباعة، لا نعتبره خصماً
    if (printCostEnabled && printCost > 0 && !Number.isNaN(discountNum) && discountNum === printCost) {
      return null;
    }

    if (discountNum === 0 || Number.isNaN(discountNum)) {
      return null; // No discount
    }

    // تقريب الخصم لأقرب رقم صحيح
    discountNum = Math.round(discountNum);

    return {
      type: 'fixed',
      value: discountNum,
      display: formatArabicNumber(discountNum),
      text: `${formatArabicNumber(discountNum)} ${currencyInfo.writtenName}`,
    };
  };

  // ✅ REFACTORED: Load customer data
  const loadCustomerData = async () => {
    try {
      const customerId = contract?.customer_id;
      const customerName = contract?.customer_name || contract?.['Customer Name'] || '';
      
      if (customerId) {
        // Try to get customer data by ID first
        const { data, error } = await supabase
          .from('customers')
          .select('name, company, phone')
          .eq('id', customerId)
          .single();
        
        if (!error && data) {
          setCustomerData({
            name: data.name || customerName,
            company: data.company,
            phone: data.phone
          });
          return;
        }
      }
      
      // Fallback: try to find customer by name
      if (customerName) {
        const { data, error } = await supabase
          .from('customers')
          .select('name, company, phone')
          .ilike('name', customerName)
          .limit(1)
          .single();
        
        if (!error && data) {
          setCustomerData({
            name: data.name || customerName,
            company: data.company,
            phone: data.phone
          });
          return;
        }
      }
      
      // Final fallback: use contract data only
      setCustomerData({
        name: customerName,
        company: contract?.Company || null,
        phone: contract?.Phone || null
      });
      
    } catch (error) {
      console.error('Error loading customer data:', error);
      // Use contract data as fallback
      setCustomerData({
        name: contract?.customer_name || contract?.['Customer Name'] || '',
        company: contract?.Company || null,
        phone: contract?.Phone || null
      });
    }
  };

  // Load customer data when dialog opens
  useEffect(() => {
    if (open && contract) {
      loadCustomerData();
    }
  }, [open, contract]);

  // ✅ REFACTORED: Calculate contract details
  const calculateContractDetails = () => {
    const startDate = contract?.start_date || contract?.['Contract Date'];
    const endDate = contract?.end_date || contract?.['End Date'];
    const currencyInfo = getCurrencyInfo();
    
    // ✅ FIXED: استخدم Total مباشرة لأنه يحتوي على السعر بالعملة المحولة
    const finalTotal = contract?.Total || contract?.total_cost || 0;
    const rentalCost = contract?.['Total Rent'] || contract?.rent_cost || 0;
    const installationCost = contract?.installation_cost || 0;
    
    let duration = '';
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      duration = `${days}`;
    }

    // ✅ FIXED: Format dates with Arabic month names
    const formatArabicDate = (dateString: string): string => {
      if (!dateString) return '';
      
      const date = new Date(dateString);
      const arabicMonths = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ];
      
      const day = date.getDate();
      const month = arabicMonths[date.getMonth()];
      const year = date.getFullYear();
      
      return `${day} ${month} ${year}`;
    };

    return {
      finalTotal: formatArabicNumber(finalTotal),
      rentalCost: formatArabicNumber(rentalCost),
      installationCost: formatArabicNumber(installationCost),
      duration,
      startDate: startDate ? formatArabicDate(startDate) : '',
      endDate: endDate ? formatArabicDate(endDate) : '',
      currencyInfo
    };
  };

  // ✅ REFACTORED: Get payment installments from installments_data
  const getPaymentInstallments = () => {
    const payments = [];
    const currencyInfo = getCurrencyInfo();
    
    // ✅ PRIORITY 1: Try to get installments from installments_data first (new dynamic system)
    if (contract?.installments_data) {
      try {
        const installmentsData = typeof contract.installments_data === 'string' 
          ? JSON.parse(contract.installments_data) 
          : contract.installments_data;
        
        if (Array.isArray(installmentsData) && installmentsData.length > 0) {
          console.log('Using installments_data for PDF:', installmentsData);
          
          return installmentsData.map((installment, index) => {
            // Format due date with Arabic month names
            const formatArabicDate = (dateString: string): string => {
              if (!dateString) return '';
              
              const date = new Date(dateString);
              const arabicMonths = [
                'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
              ];
              
              const day = date.getDate();
              const month = arabicMonths[date.getMonth()];
              const year = date.getFullYear();
              
              return `${day} ${month} ${year}`;
            };

            return {
              number: index + 1,
              amount: formatArabicNumber(Number(installment.amount || 0)),
              description: installment.description || `الدفعة ${index + 1}`,
              paymentType: installment.paymentType || 'شهري',
              dueDate: installment.dueDate ? formatArabicDate(installment.dueDate) : '',
              currencySymbol: currencyInfo.symbol,
              currencyWrittenName: currencyInfo.writtenName
            };
          });
        }
      } catch (e) {
        console.warn('Failed to parse installments_data:', e);
      }
    }
    
    // ✅ FALLBACK: Use old payment columns if no installments_data
    const payment1 = contract?.['Payment 1'] || 0;
    const payment2 = contract?.['Payment 2'] || 0;
    const payment3 = contract?.['Payment 3'] || 0;
    
    if (payment1 > 0) {
      payments.push({
        number: 1,
        amount: formatArabicNumber(Number(payment1)),
        description: 'الدفعة الأولى',
        paymentType: 'عند التوقيع',
        dueDate: '',
        currencySymbol: currencyInfo.symbol,
        currencyWrittenName: currencyInfo.writtenName
      });
    }
    
    if (payment2 > 0) {
      payments.push({
        number: 2,
        amount: formatArabicNumber(Number(payment2)),
        description: 'الدفعة الثانية',
        paymentType: 'شهري',
        dueDate: '',
        currencySymbol: currencyInfo.symbol,
        currencyWrittenName: currencyInfo.writtenName
      });
    }
    
    if (payment3 > 0) {
      payments.push({
        number: 3,
        amount: formatArabicNumber(Number(payment3)),
        description: 'الدفعة الثالثة',
        paymentType: 'شهري',
        dueDate: '',
        currencySymbol: currencyInfo.symbol,
        currencyWrittenName: currencyInfo.writtenName
      });
    }
    
    return payments;
  };

  // ✅ REFACTORED: Get billboards data from various sources with installation images option
  const getBillboardsData = async () => {
    let billboardsToShow = [];
    
    // Try to get billboards from billboard_ids column
    const billboardIds = contract?.billboard_ids;
    if (billboardIds) {
      try {
        const idsArray = typeof billboardIds === 'string' 
          ? billboardIds.split(',').map(id => id.trim()).filter(Boolean)
          : Array.isArray(billboardIds) ? billboardIds : [];

        if (idsArray.length > 0) {
          const { data: billboardsData, error } = await supabase
            .from('billboards')
            .select('*')
            .in('ID', idsArray);

          if (!error && billboardsData && billboardsData.length > 0) {
            billboardsToShow = billboardsData;
            
            // ✅ NEW: إذا كان useInstallationImages مفعل، جلب صور التركيب الفعلية
            if (useInstallationImages) {
              for (let billboard of billboardsToShow) {
                try {
                  const { data: installationData, error: installError } = await supabase
                    .from('installation_task_items')
                    .select('installed_image_face_a_url, installation_date')
                    .eq('billboard_id', billboard.ID)
                    .eq('status', 'completed')
                    .not('installed_image_face_a_url', 'is', null)
                    .order('installation_date', { ascending: false })
                    .limit(1)
                    .single();
                  
                  if (!installError && installationData?.installed_image_face_a_url) {
                    console.log(`✅ استخدام صورة التركيب للوحة ${billboard.ID}:`, installationData.installed_image_face_a_url);
                    // ✅ FIX: Update both Image_URL and image_name to force the new image to be used
                    billboard.Image_URL = installationData.installed_image_face_a_url;
                    billboard.image_name = null; // Clear image_name so Image_URL is used
                    billboard.image = installationData.installed_image_face_a_url;
                  }
                } catch (error) {
                  console.warn(`فشل جلب صورة التركيب للوحة ${billboard.ID}:`, error);
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to parse billboard_ids:', e);
      }
    }

    // Fallback to existing billboards relation or saved data
    if (billboardsToShow.length === 0) {
      const dbRows: any[] = Array.isArray(contract?.billboards) ? contract.billboards : [];
      let srcRows: any[] = dbRows;
      if (!srcRows.length) {
        try {
          const saved = (contract as any)?.saved_billboards_data ?? (contract as any)?.billboards_data ?? '[]';
          const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
          if (Array.isArray(parsed)) srcRows = parsed;
        } catch (e) {
          console.warn('Failed to parse saved billboards data:', e);
        }
      }
      billboardsToShow = srcRows;
    }

    // تطبيق single_face_billboards: إذا كانت اللوحة محددة كوجه واحد، نعدّل Faces_Count
    const singleFaceRaw = (contract as any)?.single_face_billboards;
    if (singleFaceRaw) {
      try {
        const ids = typeof singleFaceRaw === 'string' ? JSON.parse(singleFaceRaw) : singleFaceRaw;
        if (Array.isArray(ids)) {
          const singleFaceSet = new Set(ids.map(String));
          billboardsToShow = billboardsToShow.map((b: any) => {
            const bId = String(b.ID || b.id || '');
            if (singleFaceSet.has(bId)) {
              return { ...b, Faces_Count: 1, faces_count: 1 };
            }
            return b;
          });
        }
      } catch {}
    }

    return billboardsToShow;
  };

  // ✅ REFACTORED: Get billboard prices from contract (FIXED: handle all possible key formats)
  const getBillboardPrices = () => {
    let billboardPrices: Record<string, number> = {};
    if (contract?.billboard_prices) {
      try {
        const pricesData = typeof contract.billboard_prices === 'string' 
          ? JSON.parse(contract.billboard_prices) 
          : contract.billboard_prices;
        
        if (Array.isArray(pricesData)) {
          // ✅ FIX: Support multiple ID and price field names
          pricesData.forEach((item: any) => {
            const id = String(item.billboardId ?? item.billboard_id ?? item.ID ?? item.id ?? '');
            if (!id) return;
            
            // Try multiple price fields in order of preference
            const priceValue = item.finalPrice ?? item.calculatedPrice ?? item.price ?? 
                              item.contractPrice ?? item.priceBeforeDiscount ?? 
                              item.billboard_rent_price ?? item.billboardPrice ?? 0;
            const price = Number(priceValue);
            
            if (!Number.isNaN(price)) {
              billboardPrices[id] = price;
              // Also store with number key if the ID is numeric
              if (!isNaN(Number(id))) {
                billboardPrices[Number(id)] = price;
              }
            }
          });
          console.log('✅ Loaded billboard prices (with dual keys):', billboardPrices);
        }
      } catch (e) {
        console.warn('Failed to parse billboard_prices:', e);
      }
    }
    return billboardPrices;
  };

  // ✅ REFACTORED: Calculate billboard pricing with print cost (NO INSTALLATION COST)
  const calculateBillboardPricing = (billboardsToShow: any[], billboardPrices: any) => {
    const printCostEnabled = Boolean(
      contract?.print_cost_enabled === true || 
      contract?.print_cost_enabled === 1 || 
      contract?.print_cost_enabled === "true" ||
      contract?.print_cost_enabled === "1"
    );
    
    const printPricePerMeter = Number(contract?.print_price_per_meter || 0);
    console.log('Print cost settings:', { printCostEnabled, printPricePerMeter });

    const groupedBillboards = {};
    let subtotal = 0;

    billboardsToShow.forEach((billboard) => {
      const id = String(billboard.ID ?? billboard.id ?? billboard.code ?? '');
      const size = String(billboard.Size ?? billboard.size ?? 'غير محدد');
      const faces = Number(billboard.Faces ?? billboard.faces ?? billboard.Number_of_Faces ?? billboard.Faces_Count ?? billboard.faces_count ?? 1);
      
      // ✅ STEP 1: Get BASE RENT PRICE (without any print cost)
      let baseRentPrice = 0;
      const historicalPrice = billboardPrices[id];
      
          if (historicalPrice !== undefined && historicalPrice !== null && historicalPrice !== '') {
          const parsedPrice = Number(historicalPrice);
          if (!isNaN(parsedPrice)) {
            baseRentPrice = parsedPrice;
          }
      } else {
        // Fallback to current billboard price
        const priceVal = billboard.Price ?? billboard.price ?? billboard.rent ?? billboard.Rent_Price ?? billboard.rent_cost ?? billboard['Total Rent'] ?? 0;
          if (priceVal !== undefined && priceVal !== null && String(priceVal) !== '') {
            const parsedPrice = typeof priceVal === 'number' ? priceVal : Number(priceVal);
            if (!isNaN(parsedPrice)) {
              baseRentPrice = parsedPrice;
            }
          }
      }

      // ✅ STEP 2: Calculate PRINT COST based on faces and billboard size
      let printCostForBillboard = 0;
      if (printCostEnabled && printPricePerMeter > 0) {
        // Extract dimensions from size (e.g., "12×4" -> 12 * 4 = 48 square meters)
        const sizeMatch = size.match(/(\d+)×(\d+)/);
        if (sizeMatch) {
          const width = Number(sizeMatch[1]);
          const height = Number(sizeMatch[2]);
          const areaPerFace = width * height;
          // ✅ CRITICAL: Print cost = area per face × number of faces × price per meter
          printCostForBillboard = areaPerFace * faces * printPricePerMeter;
          console.log(`✅ Billboard ${id}: ${width}×${height} = ${areaPerFace}m² × ${faces} faces × ${printPricePerMeter}/m² = ${printCostForBillboard} print cost`);
        }
      }

      // ✅ STEP 3: TOTAL PRICE = BASE RENT + PRINT COST (NO INSTALLATION COST)
      const totalPricePerBillboard = baseRentPrice + printCostForBillboard;
      
      console.log(`✅ Billboard ${id} Final Calculation:`);
      console.log(`   - Base rent: ${baseRentPrice}`);
      console.log(`   - Print cost: ${printCostForBillboard} (${faces} faces)`);
      console.log(`   - Total: ${totalPricePerBillboard}`);

      // ✅ STEP 4: Group by size AND faces for proper display
      const groupKey = `${size}_${faces}وجه`;
      subtotal += totalPricePerBillboard;

      if (!groupedBillboards[groupKey]) {
        groupedBillboards[groupKey] = {
          size: size,
          faces: faces,
          billboardCount: 0,
          unitPrice: totalPricePerBillboard, // This includes rent + print cost only
          totalPrice: 0,
          baseRentPrice: baseRentPrice,
          printCostPerUnit: printCostForBillboard
        };
      }
      
      // Count billboards (each billboard = 1)
      groupedBillboards[groupKey].billboardCount += 1;
      groupedBillboards[groupKey].totalPrice += totalPricePerBillboard;
    });


    return { groupedBillboards: Object.values(groupedBillboards), subtotal };
  };

  // ✅ NEW: Preview Invoice HTML before PDF generation
  const handlePreviewInvoice = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للمعاينة');
      return;
    }

    setIsGenerating(true);
    try {
      const contractDetails = calculateContractDetails();
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();

      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();
      const { groupedBillboards, subtotal: billboardSubtotal } = calculateBillboardPricing(billboardsToShow, billboardPrices);

      // ✅ FIX: استخدام الإجمالي المخزن + رسوم التشغيل
      const contractTotal = Number(contract?.Total ?? contract?.total_cost ?? 0);
      const operatingFee = Number(contract?.fee ?? 0);
      const rentCost = Number(contract?.['Total Rent'] ?? contract?.rent_cost ?? billboardSubtotal);
      const installationCost = Number(contract?.installation_cost ?? 0);
      const printCost = Number(contract?.print_cost ?? 0);

      // ✅ المجموع الفرعي = Total (الإيجار + التركيب + الطباعة بعد الخصم)
      const subtotal = contractTotal > 0 ? contractTotal : rentCost + installationCost + printCost;

      // ✅ الإجمالي للعميل = المجموع الفرعي + رسوم التشغيل
      const grandTotal = subtotal + operatingFee;

      const FIXED_ROWS = 10;
      const displayItems = [...groupedBillboards];
      
      while (displayItems.length < FIXED_ROWS) {
        displayItems.push({
          size: '',
          faces: '',
          billboardCount: '',
          unitPrice: '',
          totalPrice: ''
        });
      }

      const invoiceDate = new Date().toLocaleDateString('ar-LY');
      const invoiceNumber = `INV-${contract?.id || Date.now()}`;
      const printCostEnabled = Boolean(
        contract?.print_cost_enabled === true || 
        contract?.print_cost_enabled === 1 || 
        contract?.print_cost_enabled === "true" ||
        contract?.print_cost_enabled === "1"
      );

      const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>معاينة فاتورة العقد ${contract?.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 210mm; height: 297mm; font-family: Arial, sans-serif; direction: rtl; background: white; color: #000; font-size: 12px; }
    .invoice-container { width: 210mm; height: 297mm; padding: 15mm; display: flex; flex-direction: column; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
    .invoice-info { text-align: left; direction: ltr; }
    .invoice-title { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
    .company-info { text-align: right; }
    .company-logo { max-width: 400px; height: auto; margin-bottom: 5px; }
    .customer-info { background: #f8f9fa; padding: 20px; margin-bottom: 25px; border-right: 4px solid #000; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    .items-table th { background: #000; color: white; padding: 12px 8px; text-align: center; font-weight: bold; border: 1px solid #000; }
    .items-table td { padding: 10px 8px; text-align: center; border: 1px solid #ddd; height: 35px; }
    .items-table tbody tr:nth-child(even) { background: #f8f9fa; }
    .total-section { margin-top: auto; border-top: 2px solid #000; padding-top: 20px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .total-row.grand-total { font-size: 20px; font-weight: bold; background: #000; color: white; padding: 20px 25px; margin-top: 15px; }
    .num { font-weight: 700; direction: ltr; display: inline-block; }
    .footer { margin-top: 25px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        <img src="${window.location.origin}/logofares.svg" alt="شعار الشركة" class="company-logo">
        <div>طرابلس – طريق المطار، حي الزهور<br>هاتف: 0912612255</div>
      </div>
      <div class="invoice-info">
        <div class="invoice-title">INVOICE</div>
        <div>رقم الفاتورة: ${invoiceNumber}<br>التاريخ: ${invoiceDate}<br>رقم العقد: ${contract?.id || 'غير محدد'}</div>
      </div>
    </div>
    <div class="customer-info">
      <div><strong>بيانات العميل</strong></div>
      <div><strong>الاسم:</strong> ${customerData.name}${customerData.company ? `<br><strong>الشركة:</strong> ${customerData.company}` : ''}${customerData.phone ? `<br><strong>الهاتف:</strong> ${customerData.phone}` : ''}<br><strong>مدة العقد:</strong> ${contractDetails.startDate} إلى ${contractDetails.endDate}</div>
    </div>
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 8%">#</th>
          <th style="width: 42%">الوصف / المقاس</th>
          <th style="width: 12%">الكمية</th>
          <th style="width: 12%">عدد الأوجه</th>
          <th style="width: 13%">السعر الوحدة</th>
          <th style="width: 13%">المجموع</th>
        </tr>
      </thead>
      <tbody>
        ${displayItems.map((item: any, index) => {
          const isEmpty = !item.size;
          return `<tr class="${isEmpty ? 'empty-row' : ''}">
            <td>${isEmpty ? '' : index + 1}</td>
            <td style="text-align: right; padding-right: 8px;">${isEmpty ? '' : `لوحة إعلانية مقاس ${item.size}`}</td>
            <td>${isEmpty ? '' : (typeof item.billboardCount === 'number' ? `<span class="num">${formatArabicNumber(item.billboardCount)}</span>` : item.billboardCount)}</td>
            <td>${isEmpty ? '' : (typeof item.faces === 'number' ? `<span class="num">${item.faces}</span>` : item.faces)}</td>
            <td>${isEmpty ? '' : (typeof item.unitPrice === 'number' ? `<span class="num">${formatArabicNumber(item.unitPrice)}</span> ${currencyInfo.symbol}` : item.unitPrice)}</td>
            <td>${isEmpty ? '' : (typeof item.totalPrice === 'number' ? `<span class="num">${formatArabicNumber(item.totalPrice)}</span> ${currencyInfo.symbol}` : item.totalPrice)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="total-section">
      <div class="total-row"><span>المجموع الفرعي:</span><span><span class="num">${formatArabicNumber(subtotal)}</span> ${currencyInfo.symbol}</span></div>
      ${operatingFee > 0 ? `<div class="total-row" style="color: #2563eb;"><span>رسوم التشغيل:</span><span><span class="num">${formatArabicNumber(operatingFee)}</span> ${currencyInfo.symbol}</span></div>` : ''}
      <div class="total-row grand-total"><span>الإجمالي للعميل:</span><span><span class="num">${formatArabicNumber(grandTotal)}</span> ${currencyInfo.symbol}</span></div>
      <div style="margin-top: 15px; text-align: center;">المبلغ بالكلمات: ${formatArabicNumber(grandTotal)} ${currencyInfo.writtenName}${printCostEnabled ? '<br><small style="color: #28a745;">* الأسعار شاملة تكلفة الطباعة</small>' : '<br><small>* الأسعار غير شاملة تكلفة الطباعة</small>'}</div>
    </div>
    <div class="footer">شكراً لتعاملكم معنا | Thank you for your business<br>هذه فاتورة إلكترونية ولا تحتاج إلى ختم أو توقيع</div>
  </div>
</body>
</html>`;

      setPreviewHTML(htmlContent);
      setPreviewTitle(`معاينة فاتورة العقد ${contract?.id}`);
      setPreviewOpen(true);
      toast.success('تم تحضير معاينة الفاتورة');

    } catch (error) {
      console.error('Error in handlePreviewInvoice:', error);
      toast.error('حدث خطأ أثناء تحضير معاينة الفاتورة');
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ دالة تحميل PDF للفاتورة مع تحسين التحميل
  const handleDownloadInvoicePDF = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل لتحميل PDF');
      return;
    }

    setIsGenerating(true);
    
    try {
      toast.info('جاري إنشاء ملف PDF للفاتورة...');

      const contractDetails = calculateContractDetails();
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();

      // Get billboards data and pricing
      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();
      const { groupedBillboards, subtotal: billboardSubtotal } = calculateBillboardPricing(billboardsToShow, billboardPrices);

      let subtotal = billboardSubtotal;
      let discountAmount = 0;
      let grandTotal = subtotal;

      if (discountInfo) {
        if (discountInfo.type === 'percentage') {
          discountAmount = (subtotal * discountInfo.value) / 100;
        } else {
          discountAmount = discountInfo.value;
        }
        grandTotal = subtotal - discountAmount;
      }

      const FIXED_ROWS = 10;
      const displayItems = [...groupedBillboards];
      
      while (displayItems.length < FIXED_ROWS) {
        displayItems.push({
          size: '',
          faces: '',
          billboardCount: '',
          unitPrice: '',
          totalPrice: ''
        });
      }

      const invoiceDate = new Date().toLocaleDateString('ar-LY');
      const invoiceNumber = `INV-${contract?.id || Date.now()}`;
      const printCostEnabled = Boolean(
        contract?.print_cost_enabled === true || 
        contract?.print_cost_enabled === 1 || 
        contract?.print_cost_enabled === "true" ||
        contract?.print_cost_enabled === "1"
      );

      // Generate HTML content (same as handlePrintInvoice but without the print script)
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>فاتورة العقد ${contract?.id}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">
          <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            html, body {
              width: 210mm; height: 297mm;
              font-family: 'Doran', 'Noto Sans Arabic', Arial, sans-serif;
              direction: rtl; text-align: right;
              background: white; color: #000;
              font-size: 12px; line-height: 1.4;
            }
            
            .invoice-container {
              width: 210mm; height: 297mm;
              padding: 15mm;
              display: flex; flex-direction: column;
            }
            
            .header {
              display: flex; justify-content: space-between;
              align-items: flex-start; margin-bottom: 30px;
              border-bottom: 2px solid #000; padding-bottom: 20px;
            }
            
            .invoice-info { text-align: left; direction: ltr; order: 2; }
            .invoice-title { font-size: 28px; font-weight: bold; color: #000; margin-bottom: 10px; }
            .invoice-details { font-size: 12px; color: #666; line-height: 1.6; }
            
            .company-info {
              display: flex; flex-direction: column;
              align-items: flex-end; text-align: right; order: 1;
            }
            
            .company-logo {
              max-width: 400px; height: auto;
              object-fit: contain; margin-bottom: 5px;
              display: block; margin-right: 0;
            }
            
            .company-details {
              font-size: 12px; color: #666;
              line-height: 1.6; font-weight: 400; text-align: right;
            }
            
            .customer-info {
              background: #f8f9fa; padding: 20px;
              border-radius: 0; margin-bottom: 25px;
              border-right: 4px solid #000;
            }
            
            .customer-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #000; }
            .customer-details { font-size: 13px; line-height: 1.6; }
            
            .items-table {
              width: 100%; border-collapse: collapse;
              margin-bottom: 25px; table-layout: fixed;
            }
            
            .items-table th {
              background: #000; color: white;
              padding: 12px 8px; text-align: center;
              font-weight: bold; border: 1px solid #000;
              font-size: 12px; height: 40px;
            }
            
            .items-table td {
              padding: 10px 8px; text-align: center;
              border: 1px solid #ddd; font-size: 11px;
              vertical-align: middle; height: 35px;
            }
            
            .items-table tbody tr:nth-child(even) { background: #f8f9fa; }
            .items-table tbody tr.empty-row { background: white; }
            .items-table tbody tr.empty-row:nth-child(even) { background: #f8f9fa; }
            
            .total-section {
              margin-top: auto; border-top: 2px solid #000; padding-top: 20px;
            }
            
            .total-row {
              display: flex; justify-content: space-between;
              align-items: center; padding: 8px 0; font-size: 14px;
            }
            
            .num {
              font-family: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
              font-variant-numeric: tabular-nums; font-weight: 700;
              direction: ltr; display: inline-block; text-align: left;
            }

            .currency {
              font-family: 'Doran', 'Noto Sans Arabic', Arial, sans-serif;
              color: #000; font-style: normal; font-weight: 700;
              display: inline-block; margin-left: 6px;
            }

            .grand-num {
              color: #FFD700;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
              font-weight: 800;
            }

            .total-row.grand-total .currency {
              color: #fff !important; margin-left: 6px; font-weight: 700;
            }
            
            .total-row.subtotal {
              font-size: 16px; font-weight: bold;
              border-bottom: 1px solid #ddd; margin-bottom: 10px;
            }

            .total-row.discount {
              font-size: 16px; font-weight: bold;
              color: #28a745; margin-bottom: 10px;
            }
            
            .total-row.grand-total {
              font-size: 20px; font-weight: bold;
              background: #000; color: white;
              padding: 20px 25px; border-radius: 0;
              margin-top: 15px; border: none;
            }
            
            .footer {
              margin-top: 25px; text-align: center;
              font-size: 11px; color: #666;
              border-top: 1px solid #ddd; padding-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <div class="company-info">
                <img src="${window.location.origin}/logofares.svg" alt="شعار الشركة" class="company-logo" crossorigin="anonymous">
                <div class="company-details">
                  طرابلس – طريق المطار، حي الزهور<br>
                  هاتف: 0912612255
                </div>
              </div>
              
              <div class="invoice-info">
                <div class="invoice-title">INVOICE</div>
                <div class="invoice-details">
                  رقم الفاتورة: ${invoiceNumber}<br>
                  التاريخ: ${invoiceDate}<br>
                  رقم العقد: ${contract?.id || 'غير محدد'}
                </div>
              </div>
            </div>
            
            <div class="customer-info">
              <div class="customer-title">بيانات العميل</div>
              <div class="customer-details">
                <strong>الاسم:</strong> ${customerData.name}<br>
                ${customerData.company ? `<strong>الشركة:</strong> ${customerData.company}<br>` : ''}
                ${customerData.phone ? `<strong>الهاتف:</strong> ${customerData.phone}<br>` : ''}
                <strong>مدة العقد:</strong> ${contractDetails.startDate} إلى ${contractDetails.endDate}
              </div>
            </div>
            
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 8%">#</th>
                  <th style="width: 42%">الوصف / المقاس</th>
                  <th style="width: 12%">الكمية</th>
                  <th style="width: 12%">عدد الأوجه</th>
                  <th style="width: 13%">السعر الوحدة</th>
                  <th style="width: 13%">المجموع</th>
                </tr>
              </thead>
              <tbody>
                ${displayItems.map((itemRaw, index) => {
                  const item: any = itemRaw;
                  const isEmpty = !item.size;
                  
                  return `
                    <tr class="${isEmpty ? 'empty-row' : ''}">
                      <td>${isEmpty ? '' : index + 1}</td>
                      <td style="text-align: right; padding-right: 8px;">
                        ${isEmpty ? '' : `لوحة إعلانية مقاس ${item.size}`}
                      </td>
                      <td>${isEmpty ? '' : (typeof item.billboardCount === 'number' ? `<span class="num">${formatArabicNumber(item.billboardCount)}</span>` : item.billboardCount)}</td>
                      <td>${isEmpty ? '' : (typeof item.faces === 'number' ? `<span class="num">${item.faces}</span>` : item.faces)}</td>
                      <td>${isEmpty ? '' : (typeof item.unitPrice === 'number' ? `<span style="direction:ltr;display:inline-block;"><span class="num">${formatArabicNumber(item.unitPrice)}</span> <span class="currency">${currencyInfo.symbol}</span></span>` : item.unitPrice)}</td>
                      <td>${isEmpty ? '' : (typeof item.totalPrice === 'number' ? `<span style="direction:ltr;display:inline-block;"><span class="num">${formatArabicNumber(item.totalPrice)}</span> <span class="currency">${currencyInfo.symbol}</span></span>` : item.totalPrice)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            
            <div class="total-section">
              ${discountInfo ? `
                <div class="total-row subtotal">
                  <span>المجموع الفرعي:</span>
                  <span style="direction:ltr;display:inline-block;"> <span class="num">${formatArabicNumber(subtotal)}</span> <span class="currency">${currencyInfo.symbol}</span></span>
                </div>
                <div class="total-row discount">
                  <span>خصم (${discountInfo.display}):</span>
                  <span style="direction:ltr;display:inline-block;">- <span class="num">${formatArabicNumber(discountAmount)}</span> <span class="currency">${currencyInfo.symbol}</span></span>
                </div>
              ` : ''}
              <div class="total-row grand-total">
                <span>المجموع الإجمالي:</span>
                <span style="direction:ltr;display:inline-block;"> <span class="grand-num">${formatArabicNumber(grandTotal)}</span> <span class="currency">${currencyInfo.symbol}</span></span>
              </div>
              <div style="margin-top: 15px; font-size: 13px; color: #666; text-align: center;">
                المبلغ بالكلمات: ${formatArabicNumber(grandTotal)} ${currencyInfo.writtenName}
                ${discountInfo ? `<br><small style="color: #28a745;">* تم تطبيق خصم ${discountInfo.text}</small>` : ''}
                ${printCostEnabled ? '<br><small style="color: #28a745;">* الأسعار شاملة تكلفة الطباعة حسب عدد الأوجه</small>' : '<br><small style="color: #6c757d;">* الأسعار غير شاملة تكلفة الطباعة</small>'}
              </div>
            </div>
            
            <div class="footer">
              شكراً لتعاملكم معنا | Thank you for your business<br>
              هذه فاتورة إلكترونية ولا تحتاج إلى ختم أو توقيع
            </div>
          </div>
        </body>
        </html>
      `;

      // ✅ إنشاء iframe مخفي لتحميل المحتوى بشكل كامل (الخطوط والصور)
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '210mm';
      iframe.style.height = '297mm';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('فشل في إنشاء iframe');
      }

      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // ✅ انتظار تحميل الخطوط والصور بالكامل
      await new Promise((resolve) => {
        if (iframe.contentWindow) {
          iframe.contentWindow.addEventListener('load', () => {
            setTimeout(resolve, 1500); // انتظار إضافي للتأكد من تحميل كل شيء
          });
        } else {
          setTimeout(resolve, 1500);
        }
      });

      // PDF options with improved settings
      const fileName = `فاتورة_عقد_${contract?.id}_${new Date().toISOString().slice(0, 10)}`;
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `${fileName}.pdf`,
        image: { type: 'jpeg' as 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          foreignObjectRendering: true
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' as 'portrait',
          compress: true
        }
      };

      console.log('📄 تحويل HTML إلى PDF...');
      
      // Generate and download PDF
      await html2pdf().set(opt).from(iframeDoc.body).save();
      
      // Cleanup
      document.body.removeChild(iframe);
      
      toast.success('تم تحميل ملف PDF للفاتورة بنجاح!');

    } catch (error) {
      console.error('Error in handleDownloadInvoicePDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء إنشاء PDF: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ REFACTORED: Invoice printing function using SizesInvoicePrintDialog style
  const handlePrintInvoice = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للطباعة');
      return;
    }

    setIsGenerating(true);
    
    try {
      const testWindow = window.open('', '_blank', 'width=1,height=1');
      if (!testWindow || testWindow.closed || typeof testWindow.closed === 'undefined') {
        toast.error('يرجى السماح بالنوافذ المنبثقة في المتصفح لتمكين الطباعة');
        setIsGenerating(false);
        return;
      }
      testWindow.close();

      const contractDetails = calculateContractDetails();
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();

      // Get billboards data and pricing
      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();
      const { groupedBillboards, subtotal: billboardSubtotal } = calculateBillboardPricing(billboardsToShow, billboardPrices);

      // ✅ Load unified invoice settings (same as SizesInvoicePrintDialog)
      let shared: any = {
        fontFamily: 'Doran',
        pageMarginTop: 15,
        pageMarginBottom: 15,
        pageMarginLeft: 15,
        pageMarginRight: 15,
        showLogo: true,
        logoPath: '/logofares.svg',
        logoSize: 60,
        logoPosition: 'right',
        showInvoiceTitle: true,
        invoiceTitleFontSize: 28,
        invoiceTitleAlignment: 'left',
        showContactInfo: true,
        contactInfoFontSize: 10,
        contactInfoAlignment: 'center',
        companyAddress: 'طرابلس – طريق المطار، حي الزهور',
        companyPhone: '0912612255',
        showCompanyInfo: true,
        showCompanyName: true,
        companyName: 'فارس ميديا',
        showCompanySubtitle: false,
        companySubtitle: '',
        headerMarginBottom: 20,
        contentBottomSpacing: 25,
        showFooter: true,
        footerText: 'شكراً لتعاملكم معنا | Thank you for your business',
        footerPosition: 15,
        footerBgColor: 'transparent',
        footerTextColor: '#666666',
        footerAlignment: 'center',
        showPageNumber: false,
        backgroundImage: '',
        backgroundOpacity: 100,
        backgroundScale: 100,
        backgroundPosX: 50,
        backgroundPosY: 50,
      };

      let individual: any = {
        primaryColor: '#D4AF37',
        secondaryColor: '#1a1a2e',
        accentColor: '#f5f5f5',
        tableHeaderBgColor: '#D4AF37',
        tableHeaderTextColor: '#ffffff',
        tableBorderColor: '#D4AF37',
        tableRowEvenColor: '#f8f9fa',
        tableRowOddColor: '#ffffff',
        tableTextColor: '#333333',
        tableRowOpacity: 100,
        customerSectionBgColor: '#f8f9fa',
        customerSectionBorderColor: '#D4AF37',
        customerSectionTitleColor: '#D4AF37',
        customerSectionTextColor: '#333333',
        subtotalBgColor: '#f0f0f0',
        subtotalTextColor: '#333333',
        totalBgColor: '#D4AF37',
        totalTextColor: '#ffffff',
        notesBgColor: '#fffbeb',
        notesTextColor: '#92400e',
        notesBorderColor: '#fbbf24',
        titleFontSize: 24,
        headerFontSize: 14,
        bodyFontSize: 12,
        showHeader: true,
        showCustomerSection: true,
        showTotalsSection: true,
      };

      // Try to load settings from database
      try {
        const { data: unifiedData } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'unified_invoice_templates_settings')
          .maybeSingle();

        if (unifiedData?.setting_value) {
          const allSettings = JSON.parse(unifiedData.setting_value);
          if (allSettings.shared) {
            shared = { ...shared, ...allSettings.shared };
          }
          if (allSettings.individual?.['contract_invoice']) {
            individual = { ...individual, ...allSettings.individual['contract_invoice'] };
          } else if (allSettings.individual?.['sizes_invoice']) {
            individual = { ...individual, ...allSettings.individual['sizes_invoice'] };
          }
        }
      } catch (e) {
        console.warn('Failed to load invoice settings, using defaults:', e);
      }

      // Extract colors
      const primaryColor = individual.primaryColor || '#D4AF37';
      const secondaryColor = individual.secondaryColor || '#1a1a2e';
      const tableHeaderBg = individual.tableHeaderBgColor || '#D4AF37';
      const tableHeaderText = individual.tableHeaderTextColor || '#ffffff';
      const tableBorder = individual.tableBorderColor || '#D4AF37';
      const tableRowEven = individual.tableRowEvenColor || '#f8f9fa';
      const tableRowOdd = individual.tableRowOddColor || '#ffffff';
      const tableText = individual.tableTextColor || '#333333';
      const customerBg = individual.customerSectionBgColor || '#f8f9fa';
      const customerBorder = individual.customerSectionBorderColor || '#D4AF37';
      const customerTitle = individual.customerSectionTitleColor || '#D4AF37';
      const customerText = individual.customerSectionTextColor || '#333333';
      const subtotalBg = individual.subtotalBgColor || '#f0f0f0';
      const subtotalText = individual.subtotalTextColor || '#333333';
      const totalBg = individual.totalBgColor || '#D4AF37';
      const totalText = individual.totalTextColor || '#ffffff';
      const notesBg = individual.notesBgColor || '#fffbeb';
      const notesText = individual.notesTextColor || '#92400e';
      const notesBorder = individual.notesBorderColor || '#fbbf24';
      const titleFontSize = individual.titleFontSize || 24;
      const headerFontSize = individual.headerFontSize || 14;
      const bodyFontSize = individual.bodyFontSize || 12;

      // ✅ Calculate final values correctly - use contract Total directly
      const contractTotal = Number(contract?.Total ?? contract?.total_cost ?? 0);
      const rentCost = Number(contract?.['Total Rent'] ?? contract?.rent_cost ?? billboardSubtotal);
      
      // ✅ Use contract total directly as grand total (no operating fee shown)
      const grandTotal = contractTotal > 0 ? contractTotal : rentCost;

      // Prepare display items
      const displayItems: any[] = groupedBillboards.map((item: any, idx: number) => ({
        ...item,
        index: idx + 1,
      }));

      const totalBillboards = displayItems.reduce((sum, item) => sum + (item.billboardCount || 0), 0);
      const invoiceDate = new Date().toLocaleDateString('ar-LY');
      const invoiceNumber = `INV-${contract?.id || Date.now()}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>فاتورة العقد ${contract?.id}</title>
          <style>
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
            @font-face { font-family: 'Manrope'; src: url('/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
            @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
            
            * { 
              margin: 0; 
              padding: 0; 
              box-sizing: border-box; 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
              color-adjust: exact !important; 
            }
            
            html, body { 
              font-family: '${shared.fontFamily || 'Doran'}', 'Noto Sans Arabic', Arial, sans-serif;
              direction: rtl;
              background: #ffffff !important;
              color: ${tableText};
              font-size: ${bodyFontSize}px;
              line-height: 1.4;
            }
            
            .print-container {
              width: 210mm;
              min-height: 297mm;
              padding: ${shared.pageMarginTop || 15}mm ${shared.pageMarginRight || 15}mm ${shared.pageMarginBottom || 15}mm ${shared.pageMarginLeft || 15}mm;
              background: #ffffff;
              position: relative;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: ${shared.headerMarginBottom || 20}px;
              padding-bottom: 15px;
              border-bottom: 2px solid ${primaryColor};
            }
            
            .header-title {
              flex: 1;
              text-align: right;
              direction: rtl;
            }
            
            .title {
              font-size: ${shared.invoiceTitleFontSize || 28}px;
              font-weight: bold;
              font-family: 'Manrope', sans-serif;
              letter-spacing: 2px;
              color: ${secondaryColor};
              margin: 0;
            }
            
            .title-info {
              font-size: 11px;
              color: ${customerText};
              margin-top: 8px;
              line-height: 1.6;
              direction: rtl;
              text-align: right;
            }
            
            .header-company {
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              gap: 8px;
            }
            
            .logo {
              height: ${shared.logoSize || 60}px;
              object-fit: contain;
              flex-shrink: 0;
            }
            
            .company-info {
              font-size: ${shared.contactInfoFontSize || 10}px;
              color: ${customerText};
              line-height: 1.6;
              text-align: center;
            }
            
            .customer-section {
              background: linear-gradient(135deg, ${customerBg}, #ffffff);
              padding: 20px;
              margin-bottom: 28px;
              border-radius: 12px;
              border-right: 5px solid ${customerBorder};
              box-shadow: 0 2px 12px rgba(0,0,0,0.06);
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .customer-label {
              font-size: ${bodyFontSize}px;
              color: ${customerText};
              opacity: 0.7;
              margin-bottom: 4px;
            }
            
            .customer-name {
              font-size: ${titleFontSize - 4}px;
              font-weight: bold;
              color: ${customerTitle};
            }
            
            .stats-cards {
              display: flex;
              gap: 24px;
            }
            
            .stat-card {
              text-align: center;
            }
            
            .stat-value {
              font-size: ${titleFontSize + 4}px;
              font-weight: bold;
              color: ${primaryColor};
              font-family: 'Manrope', sans-serif;
            }
            
            .stat-label {
              font-size: ${bodyFontSize}px;
              color: ${customerText};
              opacity: 0.7;
            }
            
            .items-table {
              width: 100%;
              border-collapse: collapse;
              font-size: ${bodyFontSize}px;
              margin-bottom: 20px;
            }
            
            .items-table th {
              background-color: ${tableHeaderBg} !important;
              padding: 12px 8px;
              color: ${tableHeaderText};
              border: 1px solid ${tableBorder};
              text-align: center;
              font-weight: bold;
            }
            
            .items-table td {
              padding: 10px 8px;
              border: 1px solid ${tableBorder};
              text-align: center;
              color: ${tableText};
            }
            
            .items-table .even-row { background-color: ${tableRowEven}; }
            .items-table .odd-row { background-color: ${tableRowOdd}; }
            
            .subtotal-row {
              background-color: ${subtotalBg} !important;
            }
            
            .subtotal-row td {
              font-weight: bold;
              color: ${subtotalText};
            }
            
            .grand-total-row {
              background-color: ${totalBg} !important;
            }
            
            .grand-total-row td {
              color: ${totalText};
              font-weight: bold;
              padding: 14px 12px;
            }
            
            .grand-total-row .totals-label {
              text-align: left;
              font-size: ${headerFontSize}px;
            }
            
            .grand-total-row .totals-value {
              text-align: center;
              font-size: ${headerFontSize + 2}px;
              font-family: 'Manrope', sans-serif;
            }
            
            .notes-section {
              margin-top: 15px;
              padding: 12px 16px;
              background-color: ${notesBg};
              border: 1px solid ${notesBorder};
              border-radius: 8px;
              color: ${notesText};
              font-size: ${bodyFontSize - 1}px;
            }
            
            .footer {
              margin-top: 25px;
              padding-top: 10px;
              border-top: 1px solid ${tableBorder};
              text-align: ${shared.footerAlignment || 'center'};
              font-size: 10px;
              color: ${shared.footerTextColor || '#666666'};
            }
            
            .num {
              font-family: 'Manrope', sans-serif;
              font-variant-numeric: tabular-nums;
              font-weight: 700;
            }
            
            @media print {
              @page { 
                size: A4; 
                margin: ${shared.pageMarginTop || 15}mm ${shared.pageMarginRight || 15}mm ${shared.pageMarginBottom || 15}mm ${shared.pageMarginLeft || 15}mm;
              }
              
              * { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
                color-adjust: exact !important; 
              }
              
              html, body { 
                background: #ffffff !important; 
                width: 100%;
                height: 100%;
              }
              
              .print-container {
                width: 100%;
                min-height: auto;
                padding: 0;
              }
              
              .items-table th {
                background-color: ${tableHeaderBg} !important;
              }
              
              .grand-total-row {
                background-color: ${totalBg} !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <!-- Header -->
            <div class="header">
              <div class="header-title">
                <h1 class="title">INVOICE</h1>
                <div class="title-info">
                  رقم الفاتورة: <span style="font-family: 'Manrope', sans-serif;">${invoiceNumber}</span><br/>
                  التاريخ: <span style="font-family: 'Manrope', sans-serif;">${invoiceDate}</span><br/>
                  رقم العقد: <span style="font-family: 'Manrope', sans-serif;">${contract?.id || 'غير محدد'}</span>
                </div>
              </div>
              
              <div class="header-company">
                ${shared.showLogo && shared.logoPath ? `
                  <img src="${shared.logoPath}" alt="Logo" class="logo" onerror="this.style.display='none'" />
                ` : ''}
                
                ${shared.showContactInfo ? `
                  <div class="company-info">
                    ${shared.companyAddress ? `<div>${shared.companyAddress}</div>` : ''}
                    ${shared.companyPhone ? `<div>هاتف: <span style="font-family: 'Manrope', sans-serif; direction: ltr; display: inline-block;">${shared.companyPhone}</span></div>` : ''}
                  </div>
                ` : ''}
              </div>
            </div>
            
            <!-- Customer Section -->
            <div class="customer-section">
              <div>
                <div class="customer-label">العميل</div>
                <div class="customer-name">${customerData.name}</div>
                ${customerData.company ? `<div style="font-size: ${bodyFontSize - 1}px; color: ${customerText}; opacity: 0.8;">${customerData.company}</div>` : ''}
              </div>
              <div class="stats-cards">
                <div class="stat-card">
                  <div class="stat-value">${totalBillboards}</div>
                  <div class="stat-label">لوحة</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${contractDetails.duration || '-'}</div>
                  <div class="stat-label">يوم</div>
                </div>
              </div>
            </div>
            
            <!-- Items Table -->
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 6%">#</th>
                  <th style="width: 30%">المقاس</th>
                  <th style="width: 12%">عدد الأوجه</th>
                  <th style="width: 12%">الكمية</th>
                  <th style="width: 20%">سعر اللوحة</th>
                  <th style="width: 20%">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                ${displayItems.map((item: any, idx: number) => `
                  <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">
                    <td>${idx + 1}</td>
                    <td style="font-weight: 600;">${item.size}</td>
                    <td>
                      <span style="display: inline-block; padding: 3px 10px; border-radius: 20px; background-color: ${item.faces === 1 ? '#e0f2fe' : primaryColor + '20'}; color: ${item.faces === 1 ? '#0369a1' : primaryColor}; font-family: 'Manrope', sans-serif; font-weight: bold; font-size: ${bodyFontSize - 1}px;">
                        ${item.faces}
                      </span>
                    </td>
                    <td style="font-family: 'Manrope', sans-serif; font-weight: bold;">${item.billboardCount}</td>
                    <td><span class="num">${formatArabicNumber(item.unitPrice)}</span> ${currencyInfo.symbol}</td>
                    <td style="color: ${primaryColor}; font-weight: bold;"><span class="num">${formatArabicNumber(item.totalPrice)}</span> ${currencyInfo.symbol}</td>
                  </tr>
                `).join('')}
                
                

                ${discountInfo ? `
                  <tr class="subtotal-row" style="color: #28a745;">
                    <td colspan="5" style="text-align: left;">الخصم (${discountInfo.display})</td>
                    <td style="font-family: 'Manrope', sans-serif; color: #28a745;">- <span class="num">${formatArabicNumber(discountInfo.type === 'percentage' ? (rentCost * discountInfo.value / 100) : discountInfo.value)}</span> ${currencyInfo.symbol}</td>
                  </tr>
                ` : ''}
                
                <!-- Grand Total Row -->
                <tr class="grand-total-row">
                  <td colspan="5" class="totals-label">الإجمالي للعميل (${totalBillboards} لوحة)</td>
                  <td class="totals-value"><span class="num">${formatArabicNumber(grandTotal)}</span> ${currencyInfo.symbol}</td>
                </tr>
              </tbody>
            </table>
            
            <!-- Footer -->
            ${shared.showFooter ? `
              <div class="footer">
                ${shared.footerText || 'شكراً لتعاملكم معنا | Thank you for your business'}
              </div>
            ` : ''}
          </div>
          
          <script>
            window.addEventListener('load', function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 800);
            });
          </script>
        </body>
        </html>
      `;

      // Open print window
      const windowFeatures = 'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no';
      const printWindow = window.open('', '_blank', windowFeatures);

      if (!printWindow) {
        throw new Error('فشل في فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح والسماح بالنوافذ المنبثقة.');
      }

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      toast.success(`تم فتح فاتورة العقد للطباعة بنجاح!`);
      
      if (printMode === 'auto') {
        onOpenChange(false);
      }

    } catch (error) {
      console.error('Error in handlePrintInvoice:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير الفاتورة للطباعة: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ REFACTORED: Contract printing function (NO INSTALLATION COST)
  const handlePrintContract = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للطباعة');
      return;
    }

    setIsGenerating(true);
    
    try {
      // Check if popup blocker might interfere
      const testWindow = window.open('', '_blank', 'width=1,height=1');
      if (!testWindow || testWindow.closed || typeof testWindow.closed === 'undefined') {
        toast.error('يرجى السماح بالنوافذ المنبثقة في المتصفح لتمكين الطباعة');
        setIsGenerating(false);
        return;
      }
      testWindow.close();

      const contractDetails = calculateContractDetails();
      const paymentInstallments = getPaymentInstallments();
      const year = contract?.['Contract Date'] ? new Date(contract['Contract Date']).getFullYear() : (contract?.start_date ? new Date(contract.start_date).getFullYear() : new Date().getFullYear());
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();

      // ✅ Check if this is an offer (not a contract)
      // Use regex to match standalone "عرض" or "عرض سعر" at start, not inside words like "معرض"
      const adTypeValue = contract?.['Ad Type'] || contract?.ad_type || '';
      const isOfferByAdType = /^عرض(\s|سعر|$)/.test(adTypeValue.trim());
      const isOffer = contract?.is_offer === true || 
                      isOfferByAdType ||
                      !contract?.Contract_Number ||
                      contract?.offer_number;
      
      // Extract all contract data automatically (NO INSTALLATION COST)
      const contractData = {
        contractNumber: isOffer ? (contract?.offer_number || contract?.id || '') : (contract?.id || contract?.Contract_Number || ''),
        customerName: customerData.name,
        customerCompany: customerData.company || '',
        customerPhone: customerData.phone || '',
        adType: contract?.ad_type || contract?.['Ad Type'] || (isOffer ? 'عرض سعر' : 'عقد إيجار لوحات إعلانية'),
        startDate: contractDetails.startDate,
        endDate: contractDetails.endDate,
        finalTotal: contractDetails.finalTotal,
        rentalCost: contractDetails.rentalCost,
        duration: contractDetails.duration,
        year: year.toString(),
        companyName: '',
        phoneNumber: '',
        payments: paymentInstallments,
        currencyInfo: currencyInfo,
        discountInfo: discountInfo,
        isOffer: isOffer // ✅ Flag to indicate if this is an offer
      };

      // Get billboards data
      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();

      const norm = (b: any) => {
        const id = String(b.ID ?? b.id ?? b.code ?? '');
        
        // ✅ FIX: Enhanced image handling - prioritize updated installation images
        let image = '';
        // First check if billboard has an updated image (from installation_task_items)
        if (b.image) {
          image = String(b.image);
        } else if (b.Image_URL) {
          image = String(b.Image_URL);
        } else {
          // Fall back to image_name if no direct URL
          const imageName = b.image_name || b.Image_Name;
          const imageUrl = b.billboard_image || b.imageUrl || b.img;
          image = imageName ? `/image/${imageName}` : (imageUrl || '');
        }
        
        const municipality = String(b.Municipality ?? b.municipality ?? b.city ?? '');
        const district = String(b.District ?? b.district ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.landmark ?? '');
        const size = String(b.Size ?? b.size ?? '');
        const level = String(b.Level ?? b.level ?? b.Category_Level ?? b.category_level ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b.Faces_Count ?? b.faces_count ?? '1');
        
        // ✅ FIX: Use historical price from billboard_prices column with proper ID matching
        let price = '';

        // الحصول على السعر قبل الخصم من بيانات العقد إن وجد
        let originalPriceBeforeDiscount: number | null = null;
        try {
          if (contract?.billboard_prices) {
            const pricesData = typeof contract.billboard_prices === 'string'
              ? JSON.parse(contract.billboard_prices)
              : contract.billboard_prices;
            if (Array.isArray(pricesData)) {
              const priceItem = pricesData.find((item: any) => String(item.billboardId) === id);
              if (priceItem && priceItem.priceBeforeDiscount != null) {
                originalPriceBeforeDiscount = Number(priceItem.priceBeforeDiscount);
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse billboard_prices for original price:', e);
        }
        
        // Try to get price using different ID formats
        const historicalPrice = billboardPrices[id] ?? billboardPrices[Number(id)];
        
        if (historicalPrice !== undefined && historicalPrice !== null && String(historicalPrice) !== '') {
          const num = Number(historicalPrice);
          if (!isNaN(num) && num > 0) {
            // ✅ FIXED: إظهار السعر قبل الخصم فقط إذا كان مختلفاً عن السعر النهائي
            if (originalPriceBeforeDiscount && originalPriceBeforeDiscount > 0 && originalPriceBeforeDiscount !== num) {
              // السعر قبل الخصم مختلف عن السعر النهائي - اعرض كلاهما
              price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">${formatArabicNumber(num)}</span> <span class=\"currency\">${currencyInfo.symbol}</span><br/><span class=\"original-price\" style=\"font-size:8px;\">(قبل الخصم: <span class=\"num\">${formatArabicNumber(originalPriceBeforeDiscount)}</span> <span class=\"currency\">${currencyInfo.symbol}</span>)</span></span>`;
            } else {
              // السعر قبل الخصم مساوي للسعر النهائي أو غير موجود - اعرض السعر فقط
              price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">${formatArabicNumber(num)}</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>`;
            }
            console.log(`✅ Using historical price for billboard ${id}: ${num} ${currencyInfo.symbol}`);
          } else {
            price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">0</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>`;
            console.warn(`⚠️ Invalid historical price for billboard ${id}: ${historicalPrice}`);
          }
        } else {
          // Fallback to current billboard price
          const priceVal = b.Price ?? b.price ?? b.rent ?? b.Rent_Price ?? b.rent_cost ?? b['Total Rent'] ?? 0;
          if (priceVal !== undefined && priceVal !== null && String(priceVal) !== '' && priceVal !== 0) {
            const num = typeof priceVal === 'number' ? priceVal : Number(priceVal);
            if (!isNaN(num) && num > 0) {
              price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">${formatArabicNumber(num)}</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>`;
              console.log(`⚠️ Using fallback price for billboard ${id}: ${num} ${currencyInfo.symbol}`);
            } else {
              price = String(priceVal);
            }
          } else {
            price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">0</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>`;
            console.warn(`⚠️ No price found for billboard ${id}`);
          }
        }

        // ✅ FIX: Use same logic as ContractTermsSettings preview
        // Check for valid values (not empty, not 0, not "0")
        const getValidValue = (val: any) => val && val !== '0' && val !== 0 ? String(val) : '';
        const rent_end_date = getValidValue(b.Rent_End_Date) || getValidValue(b.rent_end_date) || getValidValue(b.end_date) || contractDetails.endDate || '';

        // ✅ FIX: مدة اللوحات تعتمد على تواريخ العقد (المصدر الوحيد للحقيقة)
        // لا نعتمد على Days_Count المخزن في جدول اللوحات لأنه قد لا يتزامن بعد تعديل مدة العقد
        const duration_days = contractDetails.duration || '';

        // باقي الحقول
        let coords: string = String(b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? '');
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude;
          const lng = b.Longitude ?? b.lng ?? b.longitude;
          if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : (b.GPS_Link || '');
        const billboardName = String(b.Billboard_Name || '');

        return { id, billboardName, image, municipality, district, landmark, size, level, faces, price, rent_end_date, duration_days, mapLink };
      };

      // ربط كل لوحة ببيانات الترتيب (المقاس ثم البلدية ثم المستوى)
      const normalized = billboardsToShow.map(norm);
      const normalizedWithSortRanks = normalized.map((billboard) => {
        const sizeObj = sizesData.find(sz => sz.name === billboard.size);
        const municipalityObj = municipalitiesData.find(m => m.name === billboard.municipality);
        const levelObj = levelsData.find(l => l.level_code === billboard.level);
        return {
          ...billboard,
          size_order: sizeObj ? sizeObj.sort_order ?? 999 : 999,
          municipality_order: municipalityObj ? municipalityObj.sort_order ?? 999 : 999,
          level_order: levelObj ? levelObj.sort_order ?? 999 : 999,
        };
      });
      // ترتيب اللوحات: المقاس أولاً، ثم البلدية، ثم المستوى
      const sortedBillboards = normalizedWithSortRanks.sort((a, b) => {
        if (a.size_order !== b.size_order) return a.size_order - b.size_order;
        if (a.municipality_order !== b.municipality_order) return a.municipality_order - b.municipality_order;
        return a.level_order - b.level_order;
      });
      const ROWS_PER_PAGE = templateSettings.tableSettings.maxRows || 12;
      
      // تحويل اللوحات إلى صيغة BillboardRowData للاستخدام مع المُعالج المشترك
      const billboardRowData: BillboardRowData[] = sortedBillboards.map(b => ({
        id: b.id,
        billboardName: b.billboardName,
        image: b.image,
        municipality: b.municipality,
        district: b.district,
        landmark: b.landmark,
        size: b.size,
        level: b.level,
        faces: b.faces,
        price: b.price,
        rent_end_date: b.rent_end_date,
        duration_days: b.duration_days,
        mapLink: b.mapLink,
      }));
      
      // ✅ Native Chrome Pagination: Let the table flow naturally across pages.
      // No JS pagination - Chrome's print engine handles page breaks better than any JS measurement.
      const tablePagesHtml = sortedBillboards.length
        ? (() => {
            // Generate a SINGLE page container with ALL rows - Chrome will auto-paginate
            const allRowsHtml = renderBillboardsTablePage({
              settings: templateSettings,
              billboards: billboardRowData,
              tableBgUrl,
              pageIndex: 0,
              rowsPerPage: billboardRowData.length, // ALL rows in one table
              showTableTerm: true,
            });

            return allRowsHtml;
          })()
        : '';

      // ✅ FIXED: Check if print cost is enabled correctly - read from database
      const printCostEnabled = Boolean(
        contract?.print_cost_enabled === true || 
        contract?.print_cost_enabled === 1 || 
        contract?.print_cost_enabled === "true" ||
        contract?.print_cost_enabled === "1"
      );

      console.log('Print cost enabled check:', {
        raw_value: contract?.print_cost_enabled,
        type: typeof contract?.print_cost_enabled,
        enabled: printCostEnabled
      });

      // ✅ استخدام النسخة النظيفة للطباعة SVG
      const paymentsHtml = formatPaymentsSummaryPlain(contract?.installments_data, currencyInfo.symbol, currencyInfo.writtenName);

      // ✅ UPDATED: Generate enhanced PDF title with contract number, ad type, customer, billboards count and currency
      const billboardsCount = contract?.billboards_count || (contract?.billboard_ids ? contract.billboard_ids.split(',').length : 1);
      const pdfTitle = `عقد #${contractData.contractNumber} • ${contractData.adType} • ${contractData.customerName} • ${billboardsCount} لوحة • ${currencyInfo.name}`;

      // ✅ FIXED: Enhanced HTML content with proper A4 dimensions and layout
      // ✅ CRITICAL FIX: Use dir="ltr" on HTML to avoid SVG coordinate conflicts
      // SVG elements handle text direction internally via text-anchor and explicit positioning
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="ltr" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <base href="${window.location.origin}/" />
          <title>${pdfTitle}</title>
          <style>
            /* Enhanced font loading with fallbacks */
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700;900&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap');

            @font-face { 
              font-family: 'Doran'; 
              src: url('/Doran-Regular.otf') format('opentype'); 
              font-weight: 400; 
              font-style: normal; 
              font-display: swap; 
            }
            @font-face { 
              font-family: 'Doran'; 
              src: url('/Doran-Bold.otf') format('opentype'); 
              font-weight: 700; 
              font-style: normal; 
              font-display: swap; 
            }

            @page { size: A4; margin: 0; }

            /* ✅ FIXED: Proper A4 page setup with ltr for SVG compatibility */
            * { 
              margin: 0 !important; 
              padding: 0 !important; 
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            html, body { 
              width: 210mm !important; 
              margin: 0 !important;
              padding: 0 !important;
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
              direction: ltr; 
              background: white; 
              color: #000; 
              font-size: 14px;
              line-height: 1.6;
              -webkit-font-smoothing: antialiased;
              text-rendering: optimizeLegibility;
            }

            /* ✅ Native Chrome Print Pagination - NO scaling, NO JS pagination */
            @media print {
              html, body {
                width: 210mm !important;
                margin: 0 !important;
                padding: 0 !important;
              }
            }
            
            .template-container { 
              position: relative; 
              width: 210mm !important; 
              height: 297mm;
              display: block; 
              page-break-inside: avoid;
              page-break-after: always;
            }

            .template-container:last-child,
            .page:last-child {
              page-break-after: avoid !important;
            }

            /* ✅ For the FIRST page (contract terms) - fixed height */
            .template-container.first-page {
              height: 297mm !important;
              overflow: hidden;
            }

            /* ✅ For TABLE pages - allow natural height flow for Chrome pagination */
            .template-container.table-page {
              overflow: hidden;
              page-break-after: avoid;
            }
            
            .template-image { 
              position: absolute; 
              top: 0; 
              left: 0; 
              width: 210mm !important; 
              height: 297mm !important; 
              object-fit: cover; 
              object-position: center; 
              z-index: 1; 
              display: block; 
            }
            
            .overlay-svg { 
              position: absolute; 
              top: 0; 
              left: 0; 
              width: 210mm !important; 
              height: 297mm !important; 
              z-index: 10; 
              pointer-events: none; 
            }
            
            .page { 
              position: relative;
              width: 210mm !important;
              min-height: 297mm;
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            /* ✅ NATIVE CHROME PRINT PAGINATION for tables */
            .table-area { 
              position: relative; /* NOT absolute - allow natural flow */
              width: 100%;
              z-index: 20; 
            }
            
            .btable { 
              width: 100% !important; 
              border-collapse: collapse; 
              border-spacing: 0; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
              table-layout: fixed !important;
            }

            /* ✅ Chrome native table pagination */
            .btable thead {
              display: table-header-group !important; /* Repeat header on each page */
            }

            .btable tbody {
              display: table-row-group !important;
            }

            .btable tr {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            
            .btable th {
              vertical-align: middle;
            }
            
            .btable td { 
              vertical-align: middle; 
              white-space: normal; 
              word-break: break-word; 
              overflow: hidden; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
            }

            @media print {
              .btable thead {
                display: table-header-group !important;
              }
              .btable tr {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
              .table-area {
                position: relative !important;
              }
            }
            
            .btable tr { 
              /* height is set inline */
            }
            
            .btable th {
              vertical-align: middle;
            }
            
            .btable td { 
              vertical-align: middle; 
              white-space: normal; 
              word-break: break-word; 
              overflow: hidden; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
            }
            
            /* QR code styling */
            .qr-code-cell {
              padding: 1mm !important;
              cursor: pointer;
            }
            
            .qr-code-cell img {
              width: 11mm;
              height: 11mm;
              display: block;
              margin: 0 auto;
              cursor: pointer;
            }
            
            .c-img img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              object-position: center;
              border: none;
              border-radius: 0;
              display: block;
              background: none;
            }

            .btable td.c-img {
              width: 15.5mm;
              height: 15.5mm;
              padding: 0;
              overflow: hidden;
            }

            .btable td.c-img img {
              width: 100%;
              height: 100%;
              object-fit: contain;
              object-position: center;
              display: block;
            }

            .c-num { 
              text-align: center; 
              font-weight: 700; 
            }
            
            .btable a { 
              color: #004aad; 
              text-decoration: none; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
            }

            /* Dynamic clause positioning - now controlled via template settings */
            .dynamic-clause {
              position: absolute;
              left: 20mm;
              right: 13mm;
              z-index: 15;
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif;
              color: #000;
              text-align: right;
              direction: rtl;
              line-height: 1.6;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }

            .clause-header {
              font-weight: 800 !important;
            }

            .clause-content {
              font-weight: 400 !important;
            }

            /* ✅ FIXED: CSS positioning for right-aligned Arabic text with proper bidi handling */
            .right-aligned-text {
              position: absolute;
              right: 13mm;
              z-index: 15;
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif;
              color: #000;
              text-align: right;
              direction: rtl;
              unicode-bidi: plaintext;
            }

            /* ✅ FIX: Proper handling for mixed RTL/LTR content */
            .ltr-text {
              direction: ltr;
              unicode-bidi: embed;
              display: inline;
            }

            /* ✅ FIX: Phone numbers and English text should be LTR in RTL context */
            .phone-number, .english-text {
              direction: ltr;
              unicode-bidi: isolate;
              display: inline;
            }

            /* ✅ Ensure all table colors print correctly */
            table, thead, tbody, tr, th, td {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }

            th, td {
              background-color: inherit !important;
            }

            /* ✅ FIXED: Proper print media queries */
            @media print {
              html, body { 
                width: 210mm !important; 
                min-height: 297mm !important; 
                height: auto !important; 
                margin: 0 !important; 
                padding: 0 !important; 
                overflow: visible !important; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
                color-adjust: exact;
              }
              
              .template-container { 
                width: 210mm !important; 
                height: 297mm !important; 
                position: relative !important; 
                page-break-inside: avoid;
                page-break-after: always;
              }
              .template-container:last-child,
              .page:last-child {
                page-break-after: avoid !important;
              }
              
              .template-image, .overlay-svg { 
                width: 210mm !important; 
                height: 297mm !important; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
                color-adjust: exact;
              }
              
              .page { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
                color-adjust: exact;
                page-break-inside: avoid;
              }

              .btable tr:nth-of-type(12n) {
                page-break-after: always;
              }
              
              @page { 
                size: A4 portrait; 
                margin: 0 !important; 
                padding: 0 !important; 
              }
            }
            
            /* Loading and error handling */
            .loading-message {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: rgba(0,0,0,0.8);
              color: white;
              padding: 20px;
              border-radius: 5px;
              z-index: 1000;
              font-family: 'Noto Sans Arabic', Arial, sans-serif;
            }
          </style>
        </head>
        <body>
          <div id="loadingMessage" class="loading-message">جاري تحميل ${contractData.isOffer ? 'العرض' : 'العقد'}...</div>
          
          <div class="template-container first-page page">
            <img src="${templateBgUrl}" alt="${contractData.isOffer ? 'عرض سعر' : 'عقد إيجار لوحات إعلانية'}" class="template-image" 
                 onerror="console.warn('Failed to load contract template image')" />
                   onerror="console.warn('Failed to load contract template image')" />
            <svg class="overlay-svg" viewBox="0 0 2480 3508" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
              ${templateSettings.header.visible ? `
              <text x="${templateSettings.header.x}" y="${templateSettings.header.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.header.fontSize}" fill="#000" text-anchor="${templateSettings.header.textAlign || 'end'}" dominant-baseline="middle" style="direction: rtl; text-align: right">${contractData.isOffer ? `عرض سعر رقم: ${contractData.contractNumber} - صالح لمدة 24 ساعة` : `عقد إيجار مواقع إعلانية رقم: ${contractData.contractNumber} سنة ${contractData.year}`}</text>
              ` : ''}
               ${templateSettings.date.visible ? `
               <text x="${templateSettings.date.x}" y="${templateSettings.date.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.date.fontSize}" fill="#000" text-anchor="middle" dominant-baseline="middle">التاريخ: ${contractData.startDate}</text>
               <text x="${templateSettings.date.x}" y="${templateSettings.date.y + (templateSettings.date.fontSize || 42) * 1.3}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.date.fontSize}" fill="#000" text-anchor="middle" dominant-baseline="middle">الموافق: ${(() => { try { const rawDate = contract?.start_date || contract?.['Contract Date']; const d = rawDate ? new Date(rawDate) : new Date(); if (isNaN(d.getTime())) return ''; const f = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { calendar: 'islamic-umalqura', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Tripoli' }).format(d); return f.includes('هـ') ? f : f + ' هـ'; } catch { return ''; } })()}</text>
               ` : ''}
               
               ${templateSettings.adType?.visible ? `
               <text x="${templateSettings.adType.x}" y="${templateSettings.adType.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.adType.fontSize}" fill="#1a1a2e" text-anchor="start" dominant-baseline="middle" direction="rtl" style="unicode-bidi: plaintext;">نوع الإعلان: ${contractData.adType || 'غير محدد'}</text>
               ` : ''}

               ${templateSettings.firstParty.visible ? `
               <text x="${templateSettings.firstParty.x}" y="${templateSettings.firstParty.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.firstParty.fontSize + 4}" fill="#000" text-anchor="${templateSettings.firstParty.textAlign || 'end'}" dominant-baseline="middle">الطرف الأول: ${templateSettings.firstPartyData.companyName}، ${templateSettings.firstPartyData.address}</text>
               <text x="${templateSettings.firstParty.x}" y="${templateSettings.firstParty.y + (templateSettings.firstParty.lineSpacing || 50)}" font-family="Doran, sans-serif" font-size="${templateSettings.firstParty.fontSize}" fill="#000" text-anchor="${templateSettings.firstParty.textAlign || 'end'}" dominant-baseline="middle">${templateSettings.firstPartyData.representative}</text>
               ` : ''}
              
              <!-- البنود من قاعدة البيانات -->
              ${contractTerms.length > 0 ? (() => {
                let currentY = templateSettings.termsStartY;
                const termsX = templateSettings.termsStartX;
                const termsWidth = templateSettings.termsWidth || 2000;
                const charsPerLine = Math.floor(termsWidth / 28);
                const lineHeight = 55;
                const goldLineSettings = templateSettings.termsGoldLine || { visible: true, heightPercent: 30, color: '#D4AF37' };

                // ✅ IMPORTANT: لمطابقة صفحة الإعدادات (ContractTermsSettings) البنود دائماً text-anchor="end"
                // حتى لو تم تغيير termsTextAlign بالخطأ في الإعدادات.
                const textAnchor: 'end' = 'end';

                const calcRectX = (x: number, width: number) => x - width;

                // دالة لتقسيم النص إلى أسطر (نفس منطق المعاينة)
                const wrapText = (text: string, maxChars: number): string[] => {
                  const words = text.split(' ');
                  const lines: string[] = [];
                  let currentLine = '';

                  words.forEach((word) => {
                    if ((currentLine + ' ' + word).length > maxChars) {
                      if (currentLine) lines.push(currentLine.trim());
                      currentLine = word;
                    } else {
                      currentLine += ' ' + word;
                    }
                  });

                  if (currentLine) lines.push(currentLine.trim());
                  return lines;
                };

                // دالة لاستبدال المتغيرات في محتوى البند
                const discountInfo = getDiscountInfo();
                const discountText = discountInfo ? `بعد خصم ${discountInfo.display} ${currencyInfo.writtenName}` : '';
                
                const replaceVariables = (text: string): string => {
                  // ✅ بناء نص شامل الطباعة والتركيب
                  const installationEnabled = contract?.installation_enabled !== false && contract?.installation_enabled !== 0;
                  const printCostEnabled = Boolean(
                    contract?.print_cost_enabled === true || 
                    contract?.print_cost_enabled === 1 || 
                    contract?.print_cost_enabled === "true" ||
                    contract?.print_cost_enabled === "1"
                  );
                  const inclusionParts: string[] = [];
                  if (installationEnabled) { inclusionParts.push('شامل التركيب'); } else { inclusionParts.push('غير شامل التركيب'); }
                  if (printCostEnabled) { inclusionParts.push('شامل الطباعة'); } else { inclusionParts.push('غير شامل الطباعة'); }
                  const inclusionText = inclusionParts.join(' و');

                  let result = text
                    .replace(/{duration}/g, contractData.duration)
                    .replace(/{startDate}/g, contractData.startDate)
                    .replace(/{endDate}/g, contractData.endDate)
                    .replace(/{customerName}/g, contractData.customerName)
                    .replace(/{contractNumber}/g, contractData.contractNumber)
                    .replace(/{totalAmount}/g, contractDetails.finalTotal)
                    .replace(/{discount}/g, discountText)
                    .replace(/{currency}/g, currencyInfo.writtenName)
                    .replace(/{billboardsCount}/g, String(sortedBillboards.length))
                    .replace(/{inclusionText}/g, inclusionText)
                    .replace(/{payments}/g, paymentsHtml);
                  
                  // تنظيف المسافات الزائدة إذا كان التخفيض فارغاً
                  result = result.replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
                  return result;
                };

                return contractTerms.map((term) => {
                  const termY = currentY;
                  const fontSize = term.font_size || 42;

                  const titleText = term.term_title + ':';
                  const contentText = replaceVariables(term.term_content);
                  const fullText = titleText + ' ' + contentText;
                  const contentLines = wrapText(fullText, charsPerLine);
                  const termHeight = contentLines.length * lineHeight;

                  // تحديث موقع البند التالي
                  currentY = termY + termHeight + (templateSettings.termsSpacing || 40);

                  let svgContent = '';

                  contentLines.forEach((line, lineIndex) => {
                    const y = termY + (lineIndex * lineHeight);

                    // أول سطر: عنوان + محتوى بنفس عنصر text (tspan) مثل المعاينة
                    if (lineIndex === 0) {
                      const colonIndex = line.indexOf(':');
                      if (colonIndex !== -1) {
                        const titlePart = line.substring(0, colonIndex + 1);
                        const contentPart = line.substring(colonIndex + 1);

                        const titleWeight = templateSettings.termsTitleWeight || 'bold';
                        const titleWidth = Math.round(
                          measureTextWidthPx(titlePart, fontSize, 'Doran, sans-serif', titleWeight)
                        );

                        if (goldLineSettings.visible) {
                          const goldLineHeight = lineHeight * (goldLineSettings.heightPercent / 100);
                          const rectX = calcRectX(termsX, titleWidth);
                          const rectY = y - goldLineHeight / 2;
                          svgContent += '<rect x="' + rectX + '" y="' + rectY + '" width="' + titleWidth + '" height="' + goldLineHeight + '" fill="' + goldLineSettings.color + '" rx="2" />';
                        }

                        svgContent += '<text x="' + termsX + '" y="' + y + '" font-family="Doran, sans-serif" font-size="' + fontSize + '" fill="#000" text-anchor="' + textAnchor + '" dominant-baseline="middle" style="unicode-bidi: plaintext;">';
                        svgContent += '<tspan>' + '\u061C' + '</tspan>'; // ALM to stabilize RTL when line begins with numbers
                        svgContent += '<tspan font-weight="' + (templateSettings.termsTitleWeight || 'bold') + '">' + titlePart + '</tspan>';
                        svgContent += '<tspan font-weight="' + (templateSettings.termsContentWeight || 'normal') + '">' + contentPart + '</tspan>';
                        return;
                      }
                    }

                    // بقية الأسطر
                    svgContent += '<text x="' + termsX + '" y="' + y + '" font-family="Doran, sans-serif" font-weight="' + (templateSettings.termsContentWeight || 'normal') + '" font-size="' + fontSize + '" fill="#000" text-anchor="' + textAnchor + '" dominant-baseline="middle" style="unicode-bidi: plaintext;">' + line + '</text>';
                  });

                  return svgContent;
                }).join('');
              })() : ''}

              ${templateSettings.secondParty.visible ? `
               <text x="${templateSettings.secondParty.x}" y="${templateSettings.secondParty.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.secondParty.fontSize + 4}" fill="#000" text-anchor="${templateSettings.secondParty.textAlign || 'end'}" dominant-baseline="middle" direction="rtl">الطرف الثاني، ${wrapSvgLTRRuns(contractData.customerCompany || contractData.customerName)}</text>
               <text x="${templateSettings.secondParty.x}" y="${templateSettings.secondParty.y + 50}" font-family="Doran, sans-serif" font-size="${templateSettings.secondParty.fontSize}" fill="#000" text-anchor="${templateSettings.secondParty.textAlign || 'end'}" dominant-baseline="middle" direction="rtl">يمثلها السيد ${wrapSvgLTRRuns(contractData.customerName)}${contractData.customerCompany ? ` (${wrapSvgLTRRuns(contractData.customerCompany)})` : ''} - هاتف: <tspan direction="ltr" unicode-bidi="embed">${contractData.customerPhone || 'غير محدد'}</tspan></text>
              ` : ''}
            </svg>
          </div>

          ${tablePagesHtml}

          <script>
            let printAttempts = 0;
            const maxPrintAttempts = 3;

            function hideLoadingMessage() {
              const loading = document.getElementById('loadingMessage');
              if (loading) loading.style.display = 'none';
            }

            function attemptPrint() {
              try {
                if (printAttempts < maxPrintAttempts) {
                  printAttempts++;
                  window.focus();
                  window.print();
                }
              } catch (error) {
                console.error('Print error:', error);
                if (printAttempts < maxPrintAttempts) setTimeout(attemptPrint, 1000);
              }
            }

            window.addEventListener('load', function() {
              hideLoadingMessage();

              const imgs = Array.from(document.images || []);
              const waitImgs = Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((res) => {
                img.onload = () => res();
                img.onerror = () => res();
                setTimeout(() => res(), 2000);
              })));

              const waitFonts = (document.fonts && document.fonts.ready)
                ? document.fonts.ready.catch(function () { return; })
                : Promise.resolve();

              Promise.all([waitImgs, waitFonts]).then(function () {
                // ✅ No JS pagination - let Chrome handle it natively
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    setTimeout(attemptPrint, 100);
                  });
                });
              });
            });

            setTimeout(function() {
              hideLoadingMessage();
              if (printAttempts === 0) attemptPrint();
            }, 3500);
          </script>
              const images = document.querySelectorAll('img');
              images.forEach(img => {
                img.addEventListener('error', function() {
                  console.warn('Image failed to load:', this.src);
                });
              });
            });
          </script>
        </body>
        </html>
      `;

      // Enhanced window opening with better error handling
      const windowFeatures = 'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no';
      const printWindow = window.open('', '_blank', windowFeatures);

      if (!printWindow) {
        throw new Error('فشل في فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح والسماح بالنوافذ المنبثقة.');
      }

      // Enhanced window handling
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Enhanced error handling for window operations
      const handlePrintWindowError = (error: any) => {
        console.error('Print window error:', error);
        toast.error('حدث خطأ في نافذة الطباعة. يرجى المحاولة مرة أخرى.');
      };

      printWindow.addEventListener('error', handlePrintWindowError);
      
      // Check if window was closed unexpectedly
      const checkWindowClosed = () => {
        if (printWindow.closed) {
          console.log('Print window was closed');
        }
      };

      setTimeout(checkWindowClosed, 5000);

      toast.success(`تم فتح العقد للطباعة بنجاح بعملة ${currencyInfo.name}! إذا لم تظهر نافذة الطباعة، تحقق من إعدادات المتصفح.`);
      
      // Only close dialog if in auto mode
      if (printMode === 'auto') {
        onOpenChange(false);
      }

    } catch (error) {
      console.error('Error in handlePrintContract:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير العقد للطباعة: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ NEW: Preview Contract HTML before PDF generation
  const handlePreviewContract = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للمعاينة');
      return;
    }

    setIsGenerating(true);
    try {
      // Use the same logic as handlePrintContract but without auto-print
      toast.info('جاري تحضير معاينة العقد...');
      
      // Generate the contract HTML (reuse most of the print logic)
      const contractDetails = calculateContractDetails();
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();
      const contractData = {
        contractNumber: contract?.id || contract?.Contract_Number || '',
        customerName: customerData?.name || contract?.customer_name || contract?.['Customer Name'] || '',
        customerCompany: customerData?.company || '',
        customerPhone: customerData?.phone || contract?.phoneNumber || '',
        adType: contract?.ad_type || contract?.['Ad Type'] || 'عقد إيجار لوحات إعلانية',
        startDate: contractDetails.startDate,
        endDate: contractDetails.endDate,
        duration: contractDetails.duration,
        year: contract?.start_date ? new Date(contract.start_date).getFullYear().toString() : new Date().getFullYear().toString(),
      };

      const payments = getPaymentInstallments();
      const paymentsHtml = payments.length > 0
        ? payments.map((p, i) => {
            const separator = i === payments.length - 1 ? '' : (i === payments.length - 2 ? ' و' : '،');
            return `${p.description} بقيمة ${p.amount} ${p.currencyWrittenName}${separator}`;
          }).join(' ')
        : `دفعة واحدة بقيمة ${contractDetails.finalTotal} ${currencyInfo.writtenName}`;

      const printCostText = (contract?.print_cost_enabled === true || contract?.print_cost_enabled === 1 || contract?.print_cost_enabled === "true" || contract?.print_cost_enabled === "1")
        ? 'شاملة تكاليف الطباعة'
        : 'غير شاملة تكاليف الطباعة';

      const discountText = discountInfo ? ` بخصم ${discountInfo.text}` : '';

      // Simplified HTML for preview (first page only to keep it manageable)
      const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>معاينة عقد رقم ${contractData.contractNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 210mm; min-height: 297mm; font-family: Arial, sans-serif; direction: rtl; background: white; color: #000; }
    .page { width: 210mm; min-height: 297mm; padding: 10mm; position: relative; background: white; }
    .contract-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .contract-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
    .contract-info { font-size: 14px; line-height: 1.8; margin: 20px 0; text-align: right; }
    .contract-clause { margin: 15px 0; line-height: 1.8; }
    .clause-header { font-weight: bold; }
    .note { background: #fffbea; border-right: 4px solid #fbbf24; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="page">
    <div class="contract-header">
      <div class="contract-title">عقد إعلان رقم ${contractData.contractNumber}</div>
      <div>لسنة ${contractData.year}م</div>
    </div>

    <div class="contract-info">
      <div><strong>نوع الإعلان:</strong> <span style="direction: ltr; unicode-bidi: isolate; display: inline;">${contractData.adType}</span></div>
      <div><strong>الطرف الثاني:</strong> <span style="direction: ltr; unicode-bidi: isolate; display: inline;">${contractData.customerCompany || contractData.customerName}</span></div>
      <div><strong>يمثلها السيد:</strong> <span style="direction: ltr; unicode-bidi: isolate; display: inline;">${contractData.customerName}</span></div>
      <div><strong>رقم الهاتف:</strong> <span style="direction: ltr; unicode-bidi: isolate; display: inline;">${contractData.customerPhone || 'غير محدد'}</span></div>
    </div>

    <div class="contract-clause">
      <span class="clause-header">البند الأول:</span> 
      يتعهد الطرف الأول بتأجير المساحات الإعلانية المبينة في الصفحة الثانية للطرف الثاني لاستخدامها في الحملات الإعلانية.
    </div>

    <div class="contract-clause">
      <span class="clause-header">البند الثاني:</span> 
      يتحمل الطرف الثاني تكاليف تصميم وتنفيذ الحملة الإعلانية.
    </div>

    <div class="contract-clause">
      <span class="clause-header">البند الثالث:</span> 
      على الطرف الثاني الحصول على الموافقات اللازمة من الجهات ذات العلاقة.
    </div>

    <div class="contract-clause">
      <span class="clause-header">البند الرابع:</span> 
      لايجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول.
    </div>

    <div class="contract-clause">
      <span class="clause-header">البند الخامس:</span> 
      <div style="margin-top: 5px;">
        ${paymentsHtml}
        ${discountText ? `<br><small>${discountText}</small>` : ''}
        <br><br>وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.
      </div>
    </div>

    <div class="contract-clause">
      <span class="clause-header">البند السادس:</span> 
      مدة العقد ${contractData.duration} يومًا تبدأ من ${contractData.startDate} وتنتهي في ${contractData.endDate}، ويجوز تجديده برضى الطرفين قبل انتهائه بمدة لا تقل عن 15 يومًا.
    </div>

    <div class="contract-clause">
      <span class="clause-header">البند السابع:</span> 
      في حال حدوث خلاف بين الطرفين يتم حلّه وديًا، وإذا تعذر ذلك يُعين طرفان محاميان لتسوية النزاع بقرار نهائي وملزم للطرفين.
    </div>

    <div class="note">
      <strong>ملاحظة:</strong> هذه معاينة مبسطة للصفحة الأولى من العقد. العقد الكامل يحتوي على جدول اللوحات والتفاصيل الإضافية.
      لعرض العقد الكامل مع جميع الصفحات، استخدم زر "طباعة العقد" أو "تحميل عقد PDF".
    </div>
  </div>
</body>
</html>`;

      setPreviewHTML(htmlContent);
      setPreviewTitle(`معاينة العقد رقم ${contractData.contractNumber}`);
      setPreviewOpen(true);
      toast.success('تم تحضير معاينة العقد');

    } catch (error) {
      console.error('Error in handlePreviewContract:', error);
      toast.error('حدث خطأ أثناء تحضير معاينة العقد');
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ UNIFIED: Download Contract PDF using the SAME HTML as print (via saveHtmlAsPdf)
  const handleDownloadContractPDF = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للتحميل');
      return;
    }

    setIsGenerating(true);
    
    try {
      toast.info('جاري إنشاء ملف PDF للعقد...');

      // استخدم نفس منطق توليد HTML الخاص بـ handlePrintContract
      const contractDetails = calculateContractDetails();
      const paymentInstallments = getPaymentInstallments();
      const year = contract?.['Contract Date'] ? new Date(contract['Contract Date']).getFullYear() : (contract?.start_date ? new Date(contract.start_date).getFullYear() : new Date().getFullYear());
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();

      const contractData = {
        contractNumber: contract?.id || contract?.Contract_Number || '',
        customerName: customerData.name,
        customerCompany: customerData.company || '',
        customerPhone: customerData.phone || '',
        adType: contract?.ad_type || contract?.['Ad Type'] || 'عقد إيجار لوحات إعلانية',
        startDate: contractDetails.startDate,
        endDate: contractDetails.endDate,
        finalTotal: contractDetails.finalTotal,
        rentalCost: contractDetails.rentalCost,
        duration: contractDetails.duration,
        year: year.toString(),
        companyName: '',
        phoneNumber: '',
        payments: paymentInstallments,
        currencyInfo: currencyInfo,
        discountInfo: discountInfo
      };

      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();

      const norm = (b: any) => {
        const id = String(b.ID ?? b.id ?? b.code ?? '');
        const imageName = b.image_name || b.Image_Name;
        const imageUrl = b.Image_URL || b.image || b.billboard_image || b.imageUrl || b.img;
        const image = imageName ? `/image/${imageName}` : (imageUrl || '');
        const municipality = String(b.Municipality ?? b.municipality ?? b.city ?? '');
        const district = String(b.District ?? b.district ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.landmark ?? '');
        const size = String(b.Size ?? b.size ?? '');
        const level = String(b.Level ?? b.level ?? b.Category_Level ?? b.category_level ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b.Faces_Count ?? b.faces_count ?? '1');
        
        let price = '';

        // الحصول على السعر قبل الخصم من بيانات العقد إن وجد
        let originalPriceBeforeDiscount: number | null = null;
        try {
          if (contract?.billboard_prices) {
            const pricesData = typeof contract.billboard_prices === 'string'
              ? JSON.parse(contract.billboard_prices)
              : contract.billboard_prices;
            if (Array.isArray(pricesData)) {
              const priceItem = pricesData.find((item: any) => String(item.billboardId) === id);
              if (priceItem && priceItem.priceBeforeDiscount != null) {
                originalPriceBeforeDiscount = Number(priceItem.priceBeforeDiscount);
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse billboard_prices for original price:', e);
        }

        const historicalPrice = billboardPrices[id];
        if (historicalPrice !== undefined && historicalPrice !== null) {
          const num = Number(historicalPrice);
          if (!isNaN(num) && num > 0) {
            if (originalPriceBeforeDiscount && originalPriceBeforeDiscount > 0) {
              // ✅ إظهار السعر بعد الخصم مع السعر قبل الخصم في سطر جديد
              price = `<span style="direction:ltr;display:inline-block;"><span class="num">${formatArabicNumber(num)}</span> <span class="currency">${currencyInfo.symbol}</span><br/><span class="original-price" style="font-size:11px;">(قبل الخصم: <span class="num">${formatArabicNumber(originalPriceBeforeDiscount)}</span> <span class="currency">${currencyInfo.symbol}</span>)</span></span>`;
            } else {
              price = `<span style="direction:ltr;display:inline-block;"><span class="num">${formatArabicNumber(num)}</span> <span class="currency">${currencyInfo.symbol}</span></span>`;
            }
          } else {
            price = `<span style="direction:ltr;display:inline-block;"><span class="num">0</span> <span class="currency">${currencyInfo.symbol}</span></span>`;
          }
        } else {
          const priceVal = b.Price ?? b.price ?? b.rent ?? b.Rent_Price ?? b.rent_cost ?? b['Total Rent'] ?? 0;
          if (priceVal !== undefined && priceVal !== null && String(priceVal) !== '' && priceVal !== 0) {
            const num = typeof priceVal === 'number' ? priceVal : Number(priceVal);
            if (!isNaN(num) && num > 0) {
              price = `<span style="direction:ltr;display:inline-block;"><span class="num">${formatArabicNumber(num)}</span> <span class="currency">${currencyInfo.symbol}</span></span>`;
            } else {
              price = String(priceVal);
            }
          } else {
            price = `<span style="direction:ltr;display:inline-block;"><span class="num">0</span> <span class="currency">${currencyInfo.symbol}</span></span>`;
          }
        }

        // ✅ FIX: Use same logic - check for valid values (not empty, not 0)
        const getValidValue = (val: any) => val && val !== '0' && val !== 0 ? String(val) : '';
        const rent_end_date = getValidValue(b.Rent_End_Date) || getValidValue(b.rent_end_date) || getValidValue(b.end_date) || contractDetails.endDate || '';

        // ✅ FIX: مدة اللوحات تعتمد على تواريخ العقد (المصدر الوحيد للحقيقة)
        // لا نعتمد على Days_Count المخزن في جدول اللوحات لأنه قد لا يتزامن بعد تعديل مدة العقد
        const duration_days = contractDetails.duration || '';

        let coords: string = String(b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? '');
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude;
          const lng = b.Longitude ?? b.lng ?? b.longitude;
          if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : (b.GPS_Link || '');
        const billboardName = String(b.Billboard_Name || '');

        return { id, billboardName, image, municipality, district, landmark, size, level, faces, price, rent_end_date, duration_days, mapLink };
      };

      const normalized = billboardsToShow.map(norm);
      const normalizedWithSortRanks = normalized.map((billboard) => {
        const sizeObj = sizesData.find(sz => sz.name === billboard.size);
        const municipalityObj = municipalitiesData.find(m => m.name === billboard.municipality);
        const levelObj = levelsData.find(l => l.level_code === billboard.level);
        return {
          ...billboard,
          size_order: sizeObj ? sizeObj.sort_order ?? 999 : 999,
          municipality_order: municipalityObj ? municipalityObj.sort_order ?? 999 : 999,
          level_order: levelObj ? levelObj.sort_order ?? 999 : 999,
        };
      });
      
      const sortedBillboards = normalizedWithSortRanks.sort((a, b) => {
        if (a.size_order !== b.size_order) return a.size_order - b.size_order;
        if (a.municipality_order !== b.municipality_order) return a.municipality_order - b.municipality_order;
        return a.level_order - b.level_order;
      });
      // استخدام إعدادات الجدول من القالب
      const tblSettings = templateSettings.tableSettings;
      const visibleColumns = tblSettings.columns?.filter(c => c.visible) || [];
      const ROWS_PER_PAGE = tblSettings.maxRows || 12;
      
      // بناء عنوان البند الثامن
      const tableTerm = templateSettings.tableTerm;
      const tableTermHtml = tableTerm?.visible ? `
        <div style="
          text-align: center;
          margin-bottom: ${tableTerm.marginBottom || 8}mm;
          font-family: Doran, sans-serif;
          direction: rtl;
        ">
          <h2 style="
            font-size: ${tableTerm.fontSize || 14}px;
            color: ${tableTerm.color || '#1a1a2e'};
            margin: 0;
          ">
            <span style="font-weight: ${tableTerm.titleFontWeight || 'bold'}; position: relative; display: inline-block;">
              ${tableTerm.goldLine?.visible ? `<span style="position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: ${tableTerm.goldLine.heightPercent || 30}%; background-color: ${tableTerm.goldLine.color || '#D4AF37'}; border-radius: 2px; z-index: 0;"></span>` : ''}
              <span style="position: relative; z-index: 1;">${tableTerm.termTitle || 'البند الثامن:'}</span>
            </span>
            <span style="font-weight: ${tableTerm.contentFontWeight || 'normal'};">
              ${tableTerm.termContent || 'المواقع المتفق عليها بين الطرفين'}
            </span>
          </h2>
        </div>
      ` : '';
      
      const tablePagesHtml = sortedBillboards.length
        ? sortedBillboards
            .reduce((acc: any[][], r, i) => {
              const p = Math.floor(i / ROWS_PER_PAGE);
              (acc[p] ||= []).push(r);
              return acc;
            }, [])
            .map((pageRows, pageIdx) => `
              <div class="template-container page">
                <div class="scale-wrapper">
                  <img src="${tableBgUrl}" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load table background')" />
                <div class="table-area" style="top: ${tblSettings.topPosition || 63.53}mm;">
                  ${pageIdx === 0 ? tableTermHtml : ''}
                  <table class="btable" dir="rtl" style="
                    width: ${tblSettings.tableWidth || 90}%;
                    margin: 0 auto;
                    border: 0.2mm solid ${tblSettings.borderColor || '#000000'};
                  ">
                    <colgroup>
                      ${visibleColumns.map(col => `<col style="width:${col.width}%" />`).join('')}
                    </colgroup>
                    <thead>
                      <tr style="background: ${tblSettings.headerBgColor || '#000000'}; height: ${tblSettings.headerRowHeight || 14}mm;">
                        ${visibleColumns.map(col => `
                          <th style="
                            color: ${tblSettings.headerTextColor || '#ffffff'};
                            font-size: ${col.headerFontSize || tblSettings.headerFontSize || 11}px;
                            font-weight: ${tblSettings.headerFontWeight || 'bold'};
                            border: 0.2mm solid ${tblSettings.borderColor || '#000000'};
                            padding: ${tblSettings.cellPadding || 2}mm;
                            text-align: ${col.textAlign || 'center'};
                          ">${col.label}</th>
                        `).join('')}
                      </tr>
                    </thead>
                    <tbody>
                      ${pageRows.map((r, rowIdx) => {
                        const globalIdx = pageIdx * ROWS_PER_PAGE + rowIdx;
                        const isEven = globalIdx % 2 === 0;
                        const rowBg = isEven ? (tblSettings.alternateRowColor || '#f5f5f5') : '#ffffff';
                        
                        return `<tr style="height: ${tblSettings.rowHeight || 12}mm;">
                          ${visibleColumns.map(col => {
                            const isHighlighted = tblSettings.highlightedColumns?.includes(col.key);
                            const cellBg = isHighlighted ? (tblSettings.highlightedColumnBgColor || '#E8CC64') : rowBg;
                            const cellColor = isHighlighted ? (tblSettings.highlightedColumnTextColor || '#000000') : (tblSettings.cellTextColor || '#000000');
                            
                            let content = '';
                            switch (col.key) {
                              case 'index': content = String(globalIdx + 1); break;
                              case 'image': content = r.image ? `<img src="${r.image}" alt="صورة" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;" />` : ''; break;
                              case 'code': content = r.id; break;
                              case 'billboardName': content = r.billboardName || ''; break;
                              case 'municipality': content = r.municipality; break;
                              case 'district': content = r.district; break;
                              case 'name': content = r.landmark; break;
                              case 'size': content = r.size; break;
                              case 'faces': content = `<span class="num">${r.faces}</span>`; break;
                              case 'price': content = r.price; break;
                              case 'endDate': content = r.rent_end_date || ''; break;
                              case 'durationDays': content = r.duration_days || ''; break;
                              case 'location': content = r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener" style="display:block;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(r.mapLink)}&color=${(tblSettings.qrForegroundColor || '#000000').replace('#', '')}&bgcolor=${(tblSettings.qrBackgroundColor || '#ffffff').replace('#', '')}" alt="QR" style="width:14mm;height:12mm;object-fit:contain;" /></a>` : ''; break;
                              default: content = '';
                            }
                            
                            return `<td style="
                              background: ${cellBg};
                              color: ${cellColor};
                              font-size: ${col.fontSize || tblSettings.fontSize || 10}px;
                              border: 0.2mm solid ${tblSettings.borderColor || '#000000'};
                              padding: ${tblSettings.cellPadding || 2}mm;
                              text-align: ${col.textAlign || 'center'};
                            ">${content}</td>`;
                          }).join('')}
                        </tr>`;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
              </div>
            `)
            .join('')
        : '';

      const printCostEnabled = Boolean(
        contract?.print_cost_enabled === true || 
        contract?.print_cost_enabled === 1 || 
        contract?.print_cost_enabled === "true" ||
        contract?.print_cost_enabled === "1"
      );

      // ✅ استخدام النسخة النظيفة للطباعة SVG
      const paymentsHtml = formatPaymentsSummaryPlain(contract?.installments_data, currencyInfo.symbol, currencyInfo.writtenName);

      // ✅ نفس HTML الذي يستخدمه handlePrintContract (كامل مع كل البنود والخلفية الصحيحة)
      const billboardsCount = contract?.billboards_count || (contract?.billboard_ids ? contract.billboard_ids.split(',').length : 1);
      const pdfTitle = `عقد #${contractData.contractNumber} • ${contractData.adType} • ${contractData.customerName} • ${billboardsCount} لوحة • ${currencyInfo.name}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${pdfTitle}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700;900&display=swap" rel="stylesheet">
          <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; font-display: swap; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Medium.otf') format('opentype'); font-weight: 500; font-display: swap; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; font-display: swap; }
            @font-face { font-family: 'Doran'; src: url('/Doran-ExtraBold.otf') format('opentype'); font-weight: 800; font-display: swap; }

            * { margin: 0 !important; padding: 0 !important; box-sizing: border-box; }
            
            html, body { 
              width: 210mm !important; 
              min-height: 297mm !important; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
              direction: rtl; 
              background: white; 
              color: #000; 
              font-size: 14px; 
              line-height: 1.6; 
              overflow-x: hidden; 
            }
            
            .template-container { 
              position: relative; 
              width: 210mm !important; 
              height: 297mm !important; 
              overflow: hidden; 
              display: block; 
              page-break-inside: avoid; 
            }
            
            .template-image { 
              position: absolute; 
              top: 0; 
              left: 0; 
              width: 210mm !important; 
              height: 297mm !important; 
              z-index: 10; 
              pointer-events: none; 
            }
            
            .overlay-svg { 
              position: absolute; 
              top: 0; 
              left: 0; 
              width: 210mm !important; 
              height: 297mm !important; 
              z-index: 10; 
              pointer-events: none; 
            }
            
            .page { 
              page-break-after: always; 
              page-break-inside: avoid;
            }

            .table-area { 
              position: absolute; 
              z-index: 20; 
            }
            
            .btable { 
              width: 100%; 
              border-collapse: collapse; 
              border-spacing: 0; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
              table-layout: fixed; 
            }

            .btable th,
            .btable td {
              vertical-align: middle;
              white-space: normal;
              word-break: normal;
              overflow-wrap: anywhere;
              overflow: hidden;
            }

            .btable img {
              max-width: 100%;
              max-height: 100%;
              display: block;
              margin: 0 auto;
              object-fit: contain;
            }

            .c-num { 
              text-align: center; 
              font-weight: 700; 
            }
            
            .btable a { 
              color: #004aad; 
              text-decoration: none; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
            }

            /* Dynamic clause positioning - controlled via template settings */
            .dynamic-clause {
              position: absolute;
              left: 20mm;
              right: 13mm;
              z-index: 15;
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif;
              color: #000;
              text-align: right;
              direction: rtl;
              line-height: 1.6;
            }

            .clause-header {
              font-weight: 800 !important;
            }

            .clause-content {
              font-weight: 400 !important;
            }

            .right-aligned-text {
              position: absolute;
              right: 13mm;
              z-index: 15;
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif;
              color: #000;
              text-align: right;
              direction: rtl;
              unicode-bidi: plaintext;
            }

            /* ✅ FIX: Proper handling for mixed RTL/LTR content */
            .phone-number, .english-text {
              direction: ltr;
              unicode-bidi: isolate;
              display: inline;
            }

            .num { 
              font-family: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; 
              font-variant-numeric: tabular-nums; 
              font-weight: 700; 
              direction: ltr; 
              display: inline-block; 
              text-align: left; 
            }
            
            .currency { 
              font-family: 'Doran', 'Noto Sans Arabic', Arial, sans-serif; 
              color: #000; 
              font-style: normal; 
              font-weight: 700; 
              display: inline-block; 
              margin-left: 6px; 
            }
          </style>
        </head>
        <body>
          <div class="template-container page">
            <img src="${templateBgUrl}" alt="عقد إيجار لوحات إعلانية" class="template-image" 
                 onerror="console.warn('Failed to load contract template image')" />
            <svg class="overlay-svg" viewBox="0 0 2480 3508" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
              ${templateSettings.header.visible ? `
              <text x="${templateSettings.header.x}" y="${templateSettings.header.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.header.fontSize}" fill="#000" text-anchor="${templateSettings.header.textAlign || 'end'}" dominant-baseline="middle">عقد إيجار مواقع إعلانية رقم: ${contractData.contractNumber} سنة ${contractData.year}</text>
              ` : ''}
              ${templateSettings.date.visible ? `
              <text x="${templateSettings.date.x}" y="${templateSettings.date.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.date.fontSize}" fill="#000" text-anchor="${templateSettings.date.textAlign || 'start'}" dominant-baseline="middle">التاريخ: ${contractData.startDate}</text>
              ` : ''}
              
              ${templateSettings.firstParty.visible ? `
              <text x="${templateSettings.firstParty.x}" y="${templateSettings.firstParty.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.firstParty.fontSize + 4}" fill="#000" text-anchor="${templateSettings.firstParty.textAlign || 'end'}" dominant-baseline="middle">الطرف الأول: ${templateSettings.firstPartyData.companyName}، ${templateSettings.firstPartyData.address}</text>
              <text x="${templateSettings.firstParty.x}" y="${templateSettings.firstParty.y + 50}" font-family="Doran, sans-serif" font-size="${templateSettings.firstParty.fontSize}" fill="#000" text-anchor="${templateSettings.firstParty.textAlign || 'end'}" dominant-baseline="middle">${templateSettings.firstPartyData.representative}</text>
              ` : ''}
              
              ${templateSettings.secondParty.visible ? `
               <text x="${templateSettings.secondParty.x}" y="${templateSettings.secondParty.y}" font-family="Doran, sans-serif" font-weight="bold" font-size="${templateSettings.secondParty.fontSize + 4}" fill="#000" text-anchor="${templateSettings.secondParty.textAlign || 'end'}" dominant-baseline="middle" direction="rtl">الطرف الثاني، ${wrapSvgLTRRuns(contractData.customerCompany || contractData.customerName)}</text>
               <text x="${templateSettings.secondParty.x}" y="${templateSettings.secondParty.y + 50}" font-family="Doran, sans-serif" font-size="${templateSettings.secondParty.fontSize}" fill="#000" text-anchor="${templateSettings.secondParty.textAlign || 'end'}" dominant-baseline="middle" direction="rtl">يمثلها السيد ${wrapSvgLTRRuns(contractData.customerName)} - هاتف: <tspan direction="ltr" unicode-bidi="embed">${contractData.customerPhone || 'غير محدد'}</tspan></text>
              ` : ''}
              
              ${contractTerms.length > 0 ? (() => {
                let currentY = templateSettings.termsStartY;
                const goldLineSettings = templateSettings.termsGoldLine || { visible: true, heightPercent: 30, color: '#D4AF37' };
                const charsPerLine = Math.floor((templateSettings.termsWidth || 2000) / 28);
                const lineHeight = 55;
                const termsX = templateSettings.termsStartX;
                
                // Text wrap function
                const wrapTextToLines = (text: string, maxChars: number): string[] => {
                  const words = text.split(' ');
                  const lines: string[] = [];
                  let currentLine = '';
                  for (const word of words) {
                    if ((currentLine + ' ' + word).trim().length <= maxChars) {
                      currentLine = (currentLine + ' ' + word).trim();
                    } else {
                      if (currentLine) lines.push(currentLine);
                      currentLine = word;
                    }
                  }
                  if (currentLine) lines.push(currentLine);
                  return lines;
                };
                
                // استخراج معلومات التخفيض
                const discountInfo = getDiscountInfo();
                const discountText = discountInfo ? `بعد خصم ${discountInfo.display} ${currencyInfo.writtenName}` : '';
                
                const replaceVars = (text: string): string => {
                  let result = text
                    .replace(/{duration}/g, contractData.duration)
                    .replace(/{startDate}/g, contractData.startDate)
                    .replace(/{endDate}/g, contractData.endDate)
                    .replace(/{customerName}/g, contractData.customerName)
                    .replace(/{contractNumber}/g, contractData.contractNumber)
                    .replace(/{totalAmount}/g, contractDetails.finalTotal)
                    .replace(/{discount}/g, discountText)
                    .replace(/{currency}/g, currencyInfo.writtenName)
                    .replace(/{billboardsCount}/g, String(sortedBillboards.length))
                    .replace(/{payments}/g, paymentsHtml);
                  
                  // تنظيف المسافات الزائدة إذا كان التخفيض فارغاً
                  result = result.replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
                  return result;
                };
                
                return contractTerms.map((term) => {
                  const termY = term.position_y > 0 ? term.position_y : currentY;
                  const fontSize = term.font_size || 42;
                  const titleText = term.term_title + ':';
                  const contentText = replaceVars(term.term_content);
                  const fullText = titleText + ' ' + contentText;
                  const contentLines = wrapTextToLines(fullText, charsPerLine);
                  const termHeight = contentLines.length * lineHeight;
                  
                  currentY = termY + termHeight + (templateSettings.termsSpacing || 40);
                  
                  return contentLines.map((line, lineIndex) => {
                    // First line contains the title
                    if (lineIndex === 0) {
                      const colonIndex = line.indexOf(':');
                      if (colonIndex !== -1) {
                        const titlePart = line.substring(0, colonIndex + 1);
                        const contentPart = line.substring(colonIndex + 1);
                        const titleWidth = titlePart.length * fontSize * 0.5;
                        const goldLineHeight = lineHeight * (goldLineSettings.heightPercent / 100);
                        const rectX = termsX - titleWidth;
                        const rectY = termY + (lineIndex * lineHeight) - goldLineHeight / 2;
                        const textY = termY + (lineIndex * lineHeight);
                        
                        let result = '';
                        if (goldLineSettings.visible) {
                          result += '<rect x="' + rectX + '" y="' + rectY + '" width="' + titleWidth + '" height="' + goldLineHeight + '" fill="' + goldLineSettings.color + '" rx="2" />';
                        }
                        result += '<text x="' + termsX + '" y="' + textY + '" font-family="Doran, sans-serif" font-size="' + fontSize + '" fill="#000" text-anchor="end" dominant-baseline="middle">';
                        result += '<tspan font-weight="' + (templateSettings.termsTitleWeight || 'bold') + '">' + titlePart + '</tspan>';
                        result += '<tspan font-weight="' + (templateSettings.termsContentWeight || 'normal') + '">' + contentPart + '</tspan>';
                        result += '</text>';
                        return result;
                      }
                    }
                    const textY = termY + (lineIndex * lineHeight);
                    return '<text x="' + termsX + '" y="' + textY + '" font-family="Doran, sans-serif" font-weight="' + (templateSettings.termsContentWeight || 'normal') + '" font-size="' + fontSize + '" fill="#000" text-anchor="end" dominant-baseline="middle">' + line + '</text>';
                  }).join('');
                }).join('');
              })() : ''}
            </svg>
          </div>

          ${tablePagesHtml}
        </body>
        </html>`;

      // ======= 🎯 جزئية تحميل ملف PDF للعقد الرئيسي =======
      const jsPDF = (await import('jspdf')).jsPDF;
      const html2canvas = (await import('html2canvas')).default;

      // ======= 🔧 تحضير عنصر HTML مع الخطوط =======
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '210mm';
      container.style.height = '297mm';
      container.style.fontFamily = 'Noto Sans Arabic, Doran, Arial, sans-serif';
      container.style.direction = 'rtl';
      container.innerHTML = `
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">
        ${htmlContent}
      `;
      
      document.body.appendChild(container);

      // انتظار تحميل الخطوط والصور والخلفيات
      await new Promise(resolve => setTimeout(resolve, 3000));

      // ======= 🎨 معالجة صفحات العقد =======
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pages = container.querySelectorAll('.template-container');
      if (pages.length === 0) {
        document.body.removeChild(container);
        throw new Error('لم يتم العثور على صفحات العقد');
      }

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        
        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }
        
        // ======= 📸 تحويل كل صفحة إلى صورة =======
        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794, // عرض A4
          height: 1123, // ارتفاع A4
          scrollX: 0,
          scrollY: 0
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      // ======= 💾 حفظ العقد =======
      pdf.save(`عقد-${contractData.contractNumber}.pdf`);
      
      // تنظيف
      document.body.removeChild(container);

      toast.success('تم تحميل العقد بصيغة PDF بنجاح!');
      onOpenChange(false);

    } catch (error) {
      console.error('Error downloading contract PDF:', error);
      toast.error('حدث خطأ أثناء تحميل العقد: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ NEW: Send contract via WhatsApp
  const handleSendContractWhatsApp = async () => {
    if (!customerData?.phone) {
      toast.error('لا يوجد رقم هاتف للزبون');
      return;
    }

    try {
      setIsGenerating(true);
      
      // Generate contract HTML (same as handlePrintContract)
      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();
      const groupedBillboards = calculateBillboardPricing(billboardsToShow, billboardPrices);
      const paymentInstallments = getPaymentInstallments();
      const discountInfo = getDiscountInfo();
      const currencyInfo = getCurrencyInfo();
      
      const contractData = {
        contractNumber: contract?.Contract_Number || contract?.id || '',
        year: new Date(contract?.start_date || Date.now()).getFullYear(),
        adType: contract?.ad_type || 'غير محدد',
        customerName: customerData?.name || contract?.customer_name || '',
        companyName: customerData?.company || '',
        startDate: contract?.start_date ? new Date(contract.start_date).toLocaleDateString('ar-EG') : '',
        payments: paymentInstallments
      };

      const message = `مرحباً،\n\nنرسل لك ملف PDF للعقد رقم ${contractData.contractNumber}.\n\nشكراً لك.`;
      
      const success = await sendMessage({
        phone: customerData.phone,
        message: message
      });

      if (success) {
        toast.success('تم إرسال العقد عبر واتساب بنجاح');
      }
    } catch (error) {
      console.error('Error sending contract via WhatsApp:', error);
      toast.error('حدث خطأ أثناء إرسال العقد');
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ NEW: Send invoice via WhatsApp
  const handleSendInvoiceWhatsApp = async () => {
    if (!customerData?.phone) {
      toast.error('لا يوجد رقم هاتف للزبون');
      return;
    }

    try {
      setIsGenerating(true);
      
      const contractData = {
        contractNumber: contract?.Contract_Number || contract?.id || '',
        customerName: customerData?.name || contract?.customer_name || '',
      };

      const message = `مرحباً،\n\nنرسل لك ملف PDF للفاتورة الخاصة بالعقد رقم ${contractData.contractNumber}.\n\nشكراً لك.`;
      
      const success = await sendMessage({
        phone: customerData.phone,
        message: message
      });

      if (success) {
        toast.success('تم إرسال الفاتورة عبر واتساب بنجاح');
      }
    } catch (error) {
      console.error('Error sending invoice via WhatsApp:', error);
      toast.error('حدث خطأ أثناء إرسال الفاتورة');
    } finally {
      setIsGenerating(false);
    }
  };


  // ✅ NEW: Unified Print - يستخدم نفس بنية المعاينة من إعدادات القالب
  const handleUnifiedPrint = async () => {
    if (!contract || !customerData) {
      toast.error('لا توجد بيانات عقد أو عميل للطباعة');
      return;
    }

    setIsGenerating(true);
    
    try {
      const contractDetails = calculateContractDetails();
      const paymentInstallments = getPaymentInstallments();
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();
      const year = contract?.['Contract Date'] ? new Date(contract['Contract Date']).getFullYear() : (contract?.start_date ? new Date(contract.start_date).getFullYear() : new Date().getFullYear());

      // ✅ Use regex to match standalone "عرض" or "عرض سعر" at start, not inside words like "معرض"
      const adTypeValue = contract?.['Ad Type'] || contract?.ad_type || '';
      const isOfferByAdType = /^عرض(\s|سعر|$)/.test(adTypeValue.trim());
      const isOffer = contract?.is_offer === true || 
                      isOfferByAdType ||
                      !contract?.Contract_Number ||
                      contract?.offer_number;

      // Get billboards data
      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();

      // Normalize billboards
      const normalizedBillboards: UnifiedBillboardData[] = billboardsToShow.map((b: any) => {
        const id = String(b.ID ?? b.id ?? b.code ?? '');
        
        let image = '';
        if (b.image) {
          image = String(b.image);
        } else if (b.Image_URL) {
          image = String(b.Image_URL);
        }
        
        const historicalPrice = billboardPrices[id] ?? billboardPrices[Number(id)];
        let price = '';
        let priceNum = 0;
        if (historicalPrice !== undefined && historicalPrice !== null) {
          const num = Number(historicalPrice);
          if (!isNaN(num) && num > 0) {
            price = `${formatArabicNumber(num)} ${currencyInfo.symbol}`;
            priceNum = num;
          }
        } else {
          const priceVal = b.Price ?? b.price ?? 0;
          if (priceVal) {
            price = `${formatArabicNumber(Number(priceVal))} ${currencyInfo.symbol}`;
            priceNum = Number(priceVal);
          }
        }

        // الحصول على السعر الأصلي قبل التخفيض
        let originalPrice = '';
        let hasDiscount = false;
        try {
          if (contract?.billboard_prices) {
            const pricesData = typeof contract.billboard_prices === 'string'
              ? JSON.parse(contract.billboard_prices)
              : contract.billboard_prices;
            if (Array.isArray(pricesData)) {
              const priceItem = pricesData.find((item: any) => String(item.billboardId) === id);
              if (priceItem) {
                // ✅ FIX: التحقق من كلا الحقلين priceBeforeDiscount و basePriceBeforeDiscount
                const origPriceNum = Number(priceItem.priceBeforeDiscount ?? priceItem.basePriceBeforeDiscount ?? 0);
                if (!isNaN(origPriceNum) && origPriceNum > priceNum) {
                  originalPrice = `${formatArabicNumber(origPriceNum)} ${currencyInfo.symbol}`;
                  hasDiscount = true;
                }
              }
            }
          }
        } catch (e) {
          console.error('Error parsing billboard prices for discount:', e);
        }

        let coords = String(b.GPS_Coordinates ?? b.coords ?? '');
        const gpsLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : (b.GPS_Link || '');

        // ✅ FIX: Add endDate and durationDays - source of truth = contract dates
        const getValidValue = (val: any) => val && val !== '0' && val !== 0 ? String(val) : '';
        const rent_end_date = getValidValue(b.Rent_End_Date) || getValidValue(b.rent_end_date) || getValidValue(b.end_date) || contractDetails.endDate || '';
        const duration_days = contractDetails.duration || '';

        return {
          id,
          code: b.code || `TR-${String(b.ID || b.id || '').padStart(4, '0')}`,
          billboardName: b.Billboard_Name || b.billboardName || '',
          image,
          municipality: b.Municipality || b.municipality || '',
          district: b.District || b.district || '',
          landmark: b.Nearest_Landmark || b.nearest_landmark || '',
          size: b.Size || b.size || '',
          faces: String(b.Faces_Count || b.faces || '2'),
          price,
          originalPrice,
          hasDiscount,
          gpsLink,
          rent_end_date,
          duration_days,
        };
      });

      // Sort billboards
      const sortedBillboards = normalizedBillboards.sort((a, b) => {
        const sizeA = sizesData.find(s => s.name === a.size)?.sort_order ?? 999;
        const sizeB = sizesData.find(s => s.name === b.size)?.sort_order ?? 999;
        if (sizeA !== sizeB) return sizeA - sizeB;
        const munA = municipalitiesData.find(m => m.name === a.municipality)?.sort_order ?? 999;
        const munB = municipalitiesData.find(m => m.name === b.municipality)?.sort_order ?? 999;
        return munA - munB;
      });

      // Build payments HTML
      const printCostEnabled = Boolean(
        contract?.print_cost_enabled === true || 
        contract?.print_cost_enabled === 1 || 
        contract?.print_cost_enabled === "true" ||
        contract?.print_cost_enabled === "1"
      );
      
      const finalTotalAmount = contract?.Total || contract?.total_cost || 0;
      const installationEnabled = contract?.installation_enabled !== false && contract?.installation_enabled !== 0;
      const installationText = installationEnabled ? 'مع التركيب' : 'غير شامل التركيب';
      const printCostText = printCostEnabled ? 'شاملة تكاليف الطباعة' : 'غير شاملة تكاليف الطباعة';
      const discountText = discountInfo ? ` بعد خصم ${discountInfo.text}` : '';
      
      // ✅ صيغة البند الخامس للدفعات (دفعة أولى ... ثم ...)
      const paymentsSummary = formatPaymentsSummary(contract?.installments_data, currencyInfo.symbol, currencyInfo.writtenName);
      // ✅ نص يُحقن في {payments} - متصل بدون فراغات
      const paymentsText = `${paymentsSummary.replace(/<br>/g, ' ')}`;
      // ✅ نسخة HTML للمعاينة فقط
      const paymentsHtml = paymentsSummary;

      // Convert contract terms
      const unifiedTerms: UnifiedContractTerm[] = contractTerms.map(t => ({
        id: t.id,
        term_title: t.term_title,
        term_content: t.term_content,
        term_order: t.term_order,
        is_active: t.is_active,
        font_size: t.font_size,
      }));

      // Generate unified print HTML
      const billboardsCount = contract?.billboards_count || (contract?.billboard_ids ? contract.billboard_ids.split(',').length : sortedBillboards.length);
      
      // حساب ترتيب العقد في السنة - جلب العقود من نفس السنة وحساب الترتيب
      const getYearlyCode = async (): Promise<string> => {
        const contractDate = contract?.start_date || contract?.['Contract Date'];
        if (!contractDate) return '';
        const cDate = new Date(contractDate);
        if (isNaN(cDate.getTime())) return '';
        const cYear = cDate.getFullYear();
        const yearShort = cYear.toString().slice(-2);
        
        try {
          // جلب جميع العقود من نفس السنة
          const startOfYear = `${cYear}-01-01`;
          const endOfYear = `${cYear}-12-31`;
          
          // ✅ FIX: الترتيب حسب رقم العقد فقط (تصاعدي) لضمان التسلسل الصحيح
          const { data: yearContracts } = await supabase
            .from('Contract')
            .select('Contract_Number, "Contract Date"')
            .gte('"Contract Date"', startOfYear)
            .lte('"Contract Date"', endOfYear)
            .order('Contract_Number', { ascending: true });
          
          if (yearContracts && yearContracts.length > 0) {
            const currentContractNum = contract?.Contract_Number || contract?.id;
            const order = yearContracts.findIndex(c => c.Contract_Number === currentContractNum) + 1;
            if (order > 0) {
              return `${order}/${yearShort}`;
            }
          }
          
          // إذا لم نجد، نستخدم رقم العقد كترتيب
          const contractNum = parseInt(String(contract?.Contract_Number || contract?.id || '0'));
          return `${contractNum}/${yearShort}`;
        } catch (error) {
          console.error('Error getting yearly code:', error);
          const contractNum = parseInt(String(contract?.Contract_Number || contract?.id || '0'));
          return `${contractNum}/${yearShort}`;
        }
      };
      
      const rawStartDate = contract?.start_date || contract?.['Contract Date'] || '';
      const htmlContent = await generateUnifiedPrintHTML({
        settings: templateSettings,
        contractData: {
          contractNumber: isOffer ? (contract?.offer_number || contract?.id || '') : (contract?.id || contract?.Contract_Number || ''),
          yearlyCode: await getYearlyCode(),
          year: year.toString(),
          startDate: contractDetails.startDate,
          endDate: contractDetails.endDate,
          rawStartDate, // ISO date for Hijri conversion
          duration: contractDetails.duration,
          customerName: customerData.name,
          customerCompany: customerData.company || '',
          customerPhone: customerData.phone || '',
          isOffer,
          adType: contract?.ad_type || contract?.['Ad Type'] || (isOffer ? 'عرض سعر' : 'عقد إيجار'),
          billboardsCount,
          currencyName: currencyInfo.name,
        },
        terms: unifiedTerms,
        billboards: sortedBillboards,
        templateBgUrl: templateBgUrl,
        tableBgUrl: tableBgUrl,
        currencyInfo: {
          symbol: currencyInfo.symbol,
          writtenName: currencyInfo.writtenName,
        },
        contractDetails: {
          finalTotal: contractDetails.finalTotal,
          rentalCost: contractDetails.rentalCost,
          installationCost: contractDetails.installationCost,
          duration: contractDetails.duration,
          discount: discountInfo ? `بعد خصم ${discountInfo.text}` : '', // ✅ تمرير نص الخصم
          installationEnabled: installationEnabled, // ✅ تمرير حالة التركيب
          printCostEnabled: printCostEnabled, // ✅ تمرير حالة الطباعة
        },
        paymentsHtml: paymentsText, // استخدام النسخة النظيفة بدون HTML للطباعة
      });

      // Open print window
      openUnifiedPrintWindow(htmlContent);
      
      toast.success('تم فتح نافذة الطباعة الجديدة');
      
      if (printMode === 'auto') {
        onOpenChange(false);
      }

    } catch (error) {
      console.error('Error in handleUnifiedPrint:', error);
      toast.error('حدث خطأ أثناء تحضير الطباعة');
    } finally {
      setIsGenerating(false);
    }
  };

  const contractDetails = calculateContractDetails();
  const paymentInstallments = getPaymentInstallments();
  const currencyInfo = getCurrencyInfo();
  const discountInfo = getDiscountInfo();

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="max-w-2xl max-h-[70vh] overflow-hidden p-0 bg-gradient-to-br from-background via-background to-primary/5 border-primary/20">
        <div className="flex flex-col h-full max-h-[70vh]">
          {/* Header */}
          <div className="relative bg-gradient-to-r from-primary via-primary to-primary-glow p-3 text-primary-foreground">
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Printer className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">عقد #{contract?.Contract_Number || contract?.id}{yearlyContractCode ? ` (${yearlyContractCode})` : ''} • {contract?.['Ad Type'] || 'غير محدد'}</h2>
                  <p className="text-xs text-primary-foreground/80">{customerData?.name || 'غير محدد'} • {contract?.billboards_count || contract?.billboard_ids?.split(',').length || 1} لوحة • {currencyInfo.name}</p>
                </div>
              </div>
            </div>
            <UIDialog.DialogClose className="absolute left-2 top-2 rounded-full w-6 h-6 flex items-center justify-center bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors">
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">إغلاق</span>
            </UIDialog.DialogClose>
          </div>

          {/* Content - Compact */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap'); .num { font-family: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial !important; font-variant-numeric: tabular-nums; font-weight:700; direction:ltr; display:inline-block; text-align:left;} .currency { font-family: 'Doran', 'Noto Sans Arabic', Arial, sans-serif !important; color:#000; font-weight:700; margin-left:6px; display:inline-block;}`}</style>
            
            {/* Compact Summary */}
            {isGenerating ? (
              <div className="text-center py-8">
                <div className="relative mx-auto w-12 h-12">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
                  <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                    <Printer className="h-5 w-5 text-primary-foreground animate-pulse" />
                  </div>
                </div>
                <p className="text-sm font-medium mt-3 text-foreground">جاري تحضير العقد...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Total & Duration Row */}
                <div className="flex gap-3">
                  <div className="flex-1 rounded-xl bg-gradient-to-br from-primary via-primary to-primary-glow p-3 text-primary-foreground">
                    <p className="text-xs text-primary-foreground/80">المجموع</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold" style={{ direction: 'ltr', display: 'inline-block' }}>{contractDetails.finalTotal}</span>
                      <span className="text-sm">{currencyInfo.symbol}</span>
                    </div>
                  </div>
                  <div className="flex-1 rounded-xl bg-card border p-3">
                    <p className="text-xs text-muted-foreground">المدة</p>
                    <p className="text-2xl font-bold">{contractDetails.duration} <span className="text-sm font-normal">يوم</span></p>
                  </div>
                </div>

                {/* Customer & Contract Info Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-card border p-2.5">
                    <p className="text-xs text-muted-foreground mb-1">العميل</p>
                    <p className="font-medium text-sm truncate">{customerData?.name || 'غير محدد'}</p>
                    {customerData?.phone && <p className="text-xs text-muted-foreground" dir="ltr">{customerData.phone}</p>}
                  </div>
                  <div className="rounded-lg bg-card border p-2.5">
                    <p className="text-xs text-muted-foreground mb-1">الفترة</p>
                    <p className="text-xs">{contractDetails.startDate}</p>
                    <p className="text-xs">{contractDetails.endDate}</p>
                  </div>
                </div>

                {/* Payments - With Dates */}
                {paymentInstallments.length > 0 && (
                  <div className="rounded-lg bg-card border p-2.5">
                    <p className="text-xs text-muted-foreground mb-2">الدفعات ({paymentInstallments.length})</p>
                    <div className="space-y-1.5">
                      {paymentInstallments.map((p, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-muted/50 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{p.number}</span>
                            <span className="font-medium">{p.amount} {p.currencySymbol}</span>
                          </div>
                          {p.dueDate && (
                            <span className="text-muted-foreground text-[10px]">{p.dueDate}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ✅ ملخص المقاسات */}
                {sizesSummary.length > 0 && (
                  <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/50 p-2.5">
                    <p className="text-xs text-muted-foreground mb-2">المقاسات ({sizesSummary.reduce((sum, s) => sum + s.count, 0)} لوحة)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sizesSummary.map((item, i) => (
                        <span 
                          key={i} 
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-gray-800 text-xs font-medium shadow-sm border"
                        >
                          <span className="text-primary font-bold">{item.count}</span>
                          <span className="text-muted-foreground">×</span>
                          <span dir="ltr">{item.size}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contract Details Summary */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">العملة</p>
                    <p className="text-xs font-bold">{currencyInfo.name}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">التركيب</p>
                    <p className="text-xs font-bold">{contract?.installation_enabled ? '✓ مشمول' : '✗ غير مشمول'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">الطباعة</p>
                    <p className="text-xs font-bold">{contract?.print_cost_enabled === 'yes' ? '✓ مشمول' : '✗ غير مشمول'}</p>
                  </div>
                </div>

                {/* Print Options - Compact */}
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={useInstallationImages} 
                      onChange={(e) => setUseInstallationImages(e.target.checked)}
                      className="w-3.5 h-3.5 text-primary focus:ring-primary rounded"
                    />
                    <span className="text-xs">صور التركيب الفعلية</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <ContractPDFActions
            isGenerating={isGenerating}
            sendingWhatsApp={sendingWhatsApp}
            hasPhone={!!customerData?.phone}
            printMode={printMode}
            onPrintInvoice={handlePrintInvoice}
            onPreviewInvoice={handlePreviewInvoice}
            onDownloadInvoice={handleDownloadInvoicePDF}
            onSendInvoiceWhatsApp={handleSendInvoiceWhatsApp}
            onPrintContract={handlePrintContract}
            onPreviewContract={handlePreviewContract}
            onDownloadContract={handleDownloadContractPDF}
            onSendContractWhatsApp={handleSendContractWhatsApp}
            onUnifiedPrint={handleUnifiedPrint}
          />
        </div>
      </UIDialog.DialogContent>

      {/* Preview Dialog */}
      <ContractPDFPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={previewTitle}
        html={previewHTML}
      />
    </UIDialog.Dialog>
  );
}