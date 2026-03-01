// @ts-nocheck
// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Printer, 
  Eye, 
  Calculator, 
  FileText, 
  Settings, 
  Trash2,
  Plus,
  Receipt,
  Save,
  X,
  Download
} from 'lucide-react';
import { generateModernPrintInvoiceHTML } from './InvoiceTemplates';
import { SendInvoiceWhatsApp } from './SendInvoiceWhatsApp';
import { usePrintInvoicePrint } from './PrintInvoicePrint';
import html2pdf from 'html2pdf.js';

interface PrintItem {
  size: string;
  quantity: number;
  faces: number;
  totalFaces: number;
  area: number;
  pricePerMeter: number;
  totalArea: number;
  totalPrice: number;
  sortOrder: number;
  width: number;
  height: number;
  isCustomItem?: boolean;
  customDescription?: string;
}

interface ContractRow {
  Contract_Number: string;
  'Customer Name': string;
  'Ad Type': string;
  'Total': number;
  billboard_ids?: string;
  billboards?: any[];
  saved_billboards_data?: string;
  billboards_data?: string;
  [key: string]: any;
}

interface ModernPrintInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string;
  contracts: ContractRow[];
  selectedContracts: string[];
  onSelectContracts: (contracts: string[]) => void;
  printItems: PrintItem[];
  onUpdatePrintItem: (index: number, field: keyof PrintItem, value: number) => void;
  onRemoveItem: (index: number) => void;
  includeAccountBalance: boolean;
  onIncludeAccountBalance: (include: boolean) => void;
  accountPayments: number;
  onPrintInvoice: () => void;
  onSaveInvoice: () => void;
  // New props for loading/saving existing invoices and auto-printing
  initialInvoice?: any | null;
  openToPreview?: boolean;
  autoPrint?: boolean;
  autoPrintForPrinter?: boolean;
  paymentMethod?: string; // طريقة الدفع
}

const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', writtenName: 'دو  ار أمريكي' },
  { code: 'EUR', name: 'يورو', symbol: '€', writtenName: 'يورو' },
];

// ✅ دالة تنسيق الأرقام العربية
const formatArabicNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  
  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  }
  
  return formattedInteger;
};

export default function ModernPrintInvoiceDialog({
  open,
  customerPhone,
  onClose,
  customerId,
  customerName,
  contracts,
  selectedContracts,
  onSelectContracts,
  printItems,
  onUpdatePrintItem,
  onRemoveItem,
  includeAccountBalance,
  onIncludeAccountBalance,
  accountPayments,
  onPrintInvoice,
  onSaveInvoice,
  initialInvoice,
  openToPreview,
  autoPrint,
  autoPrintForPrinter,
  paymentMethod
}: ModernPrintInvoiceDialogProps) {
  const [activeTab, setActiveTab] = useState<'setup' | 'preview'>('setup');
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [invoiceType, setInvoiceType] = useState<'print_only' | 'print_install' | 'install_only'>('print_only');
  const [localPaymentMethod, setLocalPaymentMethod] = useState<string>(paymentMethod || 'نقدي');
  const [accountDeduction, setAccountDeduction] = useState(0); // مبلغ الخصم من رصيد الحساب
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(''); // المطبعة المختارة
  const [printers, setPrinters] = useState<any[]>([]); // قائمة المطابع
  const [showNotes, setShowNotes] = useState(true); // ✅ إظهار/إخفاء الملاحظات
  const [includedInContract, setIncludedInContract] = useState(false); // ✅ مضمنة في العقد

  const [localPrintItems, setLocalPrintItems] = useState<PrintItem[]>([]);
  const [sizeOrderMap, setSizeOrderMap] = useState<{ [key: string]: number }>({});
  const [sizeDimensionsMap, setSizeDimensionsMap] = useState<{ [key: string]: { width: number; height: number } }>({});

  const [customDesc, setCustomDesc] = useState('');
  const [customQty, setCustomQty] = useState<number>(1);
  const [customPrice, setCustomPrice] = useState<number>(0);

  // ✅ استخدام Print Engine الموحد للطباعة (بنفس تصميم فاتورة المقاسات)
  const { print: printWithEngine, isPrinting: isEnginePrinting, isLoading: isThemeLoading } = usePrintInvoicePrint();

  // ✅ جلب بيانات الأحجام من قاعدة البيانات مع الأبعاد
  const fetchSizeData = async () => {
    try {
      const { data: sizesData, error } = await supabase
        .from('sizes')
        .select('name, sort_order, width, height')
        .order('sort_order', { ascending: true });

      if (!error && sizesData) {
        const orderMap: { [key: string]: number } = {};
        const dimensionsMap: { [key: string]: { width: number; height: number } } = {};
        
        sizesData.forEach(size => {
          orderMap[size.name] = size.sort_order || 999;
          dimensionsMap[size.name] = {
            width: Number(size.width) || 0,
            height: Number(size.height) || 0
          };
        });
        
        setSizeOrderMap(orderMap);
        setSizeDimensionsMap(dimensionsMap);
        console.log('Size data loaded:', { orderMap, dimensionsMap });
      } else {
        console.warn('Failed to load size data:', error);
      }
    } catch (error) {
      console.error('Error fetching size data:', error);
    }
  };

  // ✅ جلب قائمة المطابع
  const fetchPrinters = async () => {
    try {
      const { data, error } = await supabase
        .from('printers')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (!error && data) {
        setPrinters(data);
      }
    } catch (error) {
      console.error('Error fetching printers:', error);
    }
  };

  // ✅ المجموعات: المجموع النقدي وإج  الي الأوجه
  const moneySubtotal = useMemo(() => {
    let sum = 0;
    localPrintItems.forEach((item, index) => {
      const itemTotal = Number(item.totalPrice) || ((Number(item.width) || 0) * (Number(item.height) || 0) * (Number(item.totalFaces) || 0) * (Number(item.pricePerMeter) || 0));
      sum += itemTotal;
      console.log(`Item ${index} (${item.size}): totalPrice = ${itemTotal}`);
    });
    console.log('Final monetary subtotal calculated:', sum);
    return sum;
  }, [localPrintItems]);

  const facesTotal = useMemo(() => {
    return localPrintItems.reduce((s, it) => s + (Number(it.totalFaces) || 0), 0);
  }, [localPrintItems]);

  // Discount interpreted as percentage or fixed monetary amount
  const discountAmount = useMemo(() => {
    if (discountType === 'percentage') {
      return Math.round((moneySubtotal * discount) / 100);
    }
    return Number(discount) || 0;
  }, [moneySubtotal, discount, discountType]);

  const total = useMemo(() => {
    let finalTotal = moneySubtotal - discountAmount;
    // خصم المبلغ المحدد من رصيد الحساب
    if (accountDeduction > 0) {
      finalTotal = finalTotal - accountDeduction;
    }
    return Math.max(0, finalTotal);
  }, [moneySubtotal, discountAmount, accountDeduction]);

  useEffect(() => {
    if (open) {
      // If an initial invoice is provided (editing a saved invoice), populate fields from it
      if (initialInvoice) {
        try {
          const inv = initialInvoice as any;
          console.log('ModernPrintInvoiceDialog: initialInvoice received:', inv);
          // parse print items from multiple possible fields (print_items, print_items_json, items, items_json)
          let items: any[] = [];
          const possible = inv.print_items ?? inv.print_items_json ?? inv.items ?? inv.items_json ?? null;

          console.log('ModernPrintInvoiceDialog: possible items field:', possible ? typeof possible : 'none');

          if (possible) {
            try {
              if (typeof possible === 'string') {
                const parsed = JSON.parse(possible);
                if (Array.isArray(parsed)) items = parsed;
              } else if (Array.isArray(possible)) {
                items = possible;
              } else if (Array.isArray(inv.items)) {
                items = inv.items;
              }
            } catch (e) {
              console.warn('Failed to parse invoice items from initialInvoice', e);
              items = [];
            }
          }

          const mapped = (items || []).map((it:any) => ({
            size: it.size || it.name || '',
            quantity: Number(it.quantity ?? it.qty ?? 0) || 0,
            faces: Number(it.faces ?? it.face_count ?? it.Number_of_Faces ?? 0) || 0,
            totalFaces: Number(it.totalFaces ?? it.total_faces ?? 0) || 0,
            area: Number((it.area ?? it.area_m2 ?? (Number(it.width || 0) * Number(it.height || 0))) || 0) || 0,
            pricePerMeter: Number((it.pricePerMeter ?? it.print_price ?? it.price) || 0) || 13,
            totalArea: Number((it.totalArea ?? it.total_area ?? 0) || 0) || 0,
            totalPrice: Number((it.totalPrice ?? it.total_price ?? it.price_total) || 0) || 0,
            sortOrder: Number(it.sortOrder ?? it.sort_order ?? 0) || 0,
            width: Number(it.width || it.w || 0) || 0,
            height: Number(it.height || it.h || 0) || 0,
          }));

          console.log('ModernPrintInvoiceDialog: parsed items count:', mapped.length, mapped);

          setLocalPrintItems(mapped);

          if (inv.invoice_number) setInvoiceNumber(inv.invoice_number);
          if (inv.invoice_date) setInvoiceDate(typeof inv.invoice_date === 'string' ? inv.invoice_date.slice(0,10) : new Date(inv.invoice_date).toISOString().slice(0,10));
          setNotes(inv.notes || '');
          if (inv.payment_method) setLocalPaymentMethod(inv.payment_method);
          if (inv.currency) {
            const found = CURRENCIES.find(c => c.code === inv.currency || c.name === inv.currency);
            if (found) setCurrency(found);
          }
          if (typeof inv.discount === 'number') setDiscount(inv.discount);
          if (inv.discount_type === 'fixed' || inv.discount_type === 'percentage') setDiscountType(inv.discount_type);
          if (typeof inv.account_deduction === 'number') setAccountDeduction(inv.account_deduction);
          
          // ✅ تحميل المطبعة المحفوظة
          if (inv.printer_id) {
            setSelectedPrinterId(inv.printer_id);
          }
          
          // ✅ تحميل نوع الفاتورة
          if (inv.invoice_type) {
            if (inv.invoice_type === 'print') {
              setInvoiceType('print_only');
            } else if (inv.invoice_type === 'print_install') {
              setInvoiceType('print_install');
            } else if (inv.invoice_type === 'install') {
              setInvoiceType('install_only');
            }
          }

          // ✅ تحميل حالة "مضمنة في العقد"
          if (typeof inv.included_in_contract === 'boolean') {
            setIncludedInContract(inv.included_in_contract);
          }

          // If contract_numbers provided, set selected contracts via callback
          if (inv.contract_numbers && onSelectContracts) {
            if (Array.isArray(inv.contract_numbers)) onSelectContracts(inv.contract_numbers.map(String));
            else if (typeof inv.contract_numbers === 'string') onSelectContracts(inv.contract_numbers.split(',').map((s:string)=>s.trim()));
          }

          // open preview tab if requested
          if (openToPreview) setActiveTab('preview');
        } catch (e) {
          console.warn('Failed to parse initial invoice', e);
        }
      } else {
        setActiveTab('setup');
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        setInvoiceNumber(`INV-${timestamp}${randomSuffix}`);
        setInvoiceDate(new Date().toISOString().slice(0, 10));
        setNotes('');
        setDiscount(0);
        setAccountDeduction(0);
        setLocalPrintItems([]);
        setLocalPaymentMethod(paymentMethod || 'نقدي');
        setIncludedInContract(false); // ✅ إعادة تعيين حالة "مضمنة في العقد"
      }

      // Always fetch size data (dimensions) and printers
      fetchSizeData();
      fetchPrinters();
    }
  }, [open, initialInvoice]);

  const getBillboardsFromContracts = async (contractNumbers: string[]) => {
    if (contractNumbers.length === 0) {
      setLocalPrintItems([]);
      return;
    }

    try {
      const selectedContractData = contracts.filter(contract => 
        contractNumbers.includes(contract.Contract_Number)
      );

      let allBillboards: any[] = [];

      for (const contract of selectedContractData) {
        let billboardsToShow = [];
        
        const billboardIds = contract?.billboard_ids;
        if (billboardIds) {
          try {
            const idsArray = typeof billboardIds === 'string' 
              ? billboardIds.split(',').map(id => id.trim()).filter(Boolean)
              : Array.isArray(billboardIds) ? billboardIds : [];

            if (idsArray.length > 0) {
              // Convert string IDs to numbers for database query
              const numericIds = idsArray.map(id => Number(id)).filter(n => !isNaN(n));
              const { data: billboardsData, error } = await supabase
                .from('billboards')
                .select('*')
                .in('ID', numericIds);

              if (!error && billboardsData && billboardsData.length > 0) {
                billboardsToShow = billboardsData;
              }
            }
          } catch (e) {
            console.warn('Failed to parse billboard_ids:', e);
          }
        }

        if (billboardsToShow.length === 0) {
          const dbRows: any[] = Array.isArray(contract?.billboards) ? contract.billboards : [];
          let srcRows: any[] = dbRows;
          if (!srcRows.length) {
            try {
              const saved = contract?.saved_billboards_data ?? contract?.billboards_data ?? '[]';
              const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
              if (Array.isArray(parsed)) srcRows = parsed;
            } catch (e) {
              console.warn('Failed to parse saved billboards data:', e);
            }
          }
          billboardsToShow = srcRows;
        }

        allBillboards = [...allBillboards, ...billboardsToShow];
      }

      const printItemsFromBillboards = convertBillboardsToPrintItems(allBillboards);
      setLocalPrintItems(printItemsFromBillboards);

    } catch (error) {
      console.error('Error fetching billboards from contracts:', error);
      toast.error('حدث خطأ في جلب بي  نات اللوحات');
      setLocalPrintItems([]);
    }
  };

  // ✅ دالة التحويل مع استخدام أبعاد قاعدة البيانات
  const convertBillboardsToPrintItems = (billboards: any[]): PrintItem[] => {
    const groupedBillboards: { [key: string]: PrintItem } = {};

    billboards.forEach((billboard) => {
      const size = String(billboard.Size ?? billboard.size ?? 'غير محدد');
      const faces = Number(billboard.Faces ?? billboard.faces ?? billboard.Number_of_Faces ?? billboard.Faces_Count ?? billboard.faces_count ?? 1);
      
      // ✅ جلب الأبعاد م   قاعدة البيانات
      const dimensions = sizeDimensionsMap[size];
      const width = dimensions?.width || 0;
      const height = dimensions?.height || 0;
      const area = width * height;

      const groupKey = `${size}_${faces}`;
      const sortOrder = sizeOrderMap[size] || 999;

      if (!groupedBillboards[groupKey]) {
        groupedBillboards[groupKey] = {
          size: size,
          quantity: 0,
          faces: faces,
          totalFaces: 0,
          area: area,
          pricePerMeter: 13,
          totalArea: 0,
          totalPrice: 0,
          sortOrder: sortOrder,
          width: width,
          height: height
        };
      }

      groupedBillboards[groupKey].quantity += 1;
      groupedBillboards[groupKey].totalFaces += faces;
      groupedBillboards[groupKey].totalArea += area;
    });

    // ✅ حساب الأسعار الإج  الية وترتيب النتائج
    const result = Object.values(groupedBillboards).map(item => {
      // ✅ الحساب الصحيح: العرض × الارتفاع × عدد الأوجه × سعر المتر
      const calculatedPrice = item.width * item.height * item.totalFaces * item.pricePerMeter;
      
      console.log(`Processing item ${item.size}: ${item.width} × ${item.height} × ${item.totalFaces} × ${item.pricePerMeter} = ${calculatedPrice}`);
      
      return {
        ...item,
        totalPrice: calculatedPrice
      };
    });

    result.sort((a, b) => a.sortOrder - b.sortOrder);
    
    console.log('Final converted print items:', result);
    return result;
  };

  useEffect(() => {
    // If we're editing an existing saved invoice (initialInvoice), do not override its items
    if (open && Object.keys(sizeDimensionsMap).length > 0 && !initialInvoice) {
      getBillboardsFromContracts(selectedContracts);
    }
  }, [selectedContracts, open, contracts, sizeDimensionsMap, initialInvoice]);

  const handleContractToggle = (contractNumber: string) => {
    const isSelected = selectedContracts.includes(contractNumber);
    if (isSelected) {
      onSelectContracts(selectedContracts.filter(c => c !== contractNumber));
    } else {
      onSelectContracts([...selectedContracts, contractNumber]);
    }
  };

  const handleRowClick = (contractNumber: string, event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('input[type="checkbox"]')) {
      return;
    }
    handleContractToggle(contractNumber);
  };

  // ✅ دالة تحديث العناصر مع الحساب الصحيح
  const handlePrintItemUpdate = (index: number, field: keyof PrintItem, value: number) => {
    const updatedItems = [...localPrintItems];
    const item = { ...updatedItems[index] };
    
    const numericValue = isNaN(value) ? 0 : Number(value);
    item[field] = numericValue;
    
    // معالجة البنود المخصصة
    if (item.isCustomItem) {
      if (field === 'quantity') {
        item.totalFaces = numericValue;
        item.totalArea = numericValue;
        item.totalPrice = numericValue * item.pricePerMeter;
      } else if (field === 'pricePerMeter') {
        item.totalPrice = item.quantity * numericValue;
      }
    } else {
      // معالجة بنود الطباعة العادية
      if (field === 'width' || field === 'height') {
        item.area = item.width * item.height;
        item.totalArea = item.area * item.totalFaces;
      } else if (field === 'totalFaces') {
        item.totalArea = item.area * numericValue;
      } else if (field === 'quantity') {
        item.totalFaces = numericValue * item.faces;
        item.totalArea = item.area * item.totalFaces;
      }
      
      // ✅ الحساب الصحيح: العرض × الارتفاع × عدد الأوجه × سعر المتر
      item.totalPrice = item.width * item.height * item.totalFaces * item.pricePerMeter;
    }
    
    updatedItems[index] = item;
    
    console.log(`Updated item ${index}:`, {
      size: item.size,
      isCustomItem: item.isCustomItem,
      quantity: item.quantity,
      pricePerMeter: item.pricePerMeter,
      totalPrice: item.totalPrice
    });
    
    setLocalPrintItems(updatedItems);
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = localPrintItems.filter((_, i) => i !== index);
    setLocalPrintItems(updatedItems);
  };

  const handleAddCustomItem = () => {
    if (!customDesc.trim()) {
      toast.error('يرجى إدخال وصف البند');
      return;
    }
    if (customQty <= 0) {
      toast.error('يرجى إدخال كمية صحيحة');
      return;
    }
    if (customPrice <= 0) {
      toast.error('يرجى إدخال سعر صحيح');
      return;
    }

    const customItem: PrintItem = {
      size: customDesc,
      quantity: customQty,
      faces: 1,
      totalFaces: customQty,
      area: 1,
      pricePerMeter: customPrice,
      totalArea: customQty,
      totalPrice: customQty * customPrice,
      sortOrder: 9999,
      width: 0,
      height: 0,
      isCustomItem: true,
      customDescription: customDesc
    };

    setLocalPrintItems([...localPrintItems, customItem]);
    setCustomDesc('');
    setCustomQty(1);
    setCustomPrice(0);
    toast.success('تم إضافة البند المخصص');
  };

  const handlePrint = async (isPrinterCopyParam: boolean = false) => {
    if (localPrintItems.length === 0) {
      toast.error('لا توجد عناصر للطباعة');
      return;
    }

    if (isThemeLoading) {
      toast.error('جاري تحميل إعدادات الطباعة...');
      return;
    }

    try {
      const isPrinterCopy = Boolean(isPrinterCopyParam);
      
      // ✅ استخدام Print Engine الموحد
      await printWithEngine({
        invoiceNumber: invoiceNumber,
        invoiceDate: invoiceDate,
        customerName: customerName,
        customerId: customerId || undefined,
        customerPhone: customerPhone,
        contractNumbers: selectedContracts,
        items: localPrintItems.map(item => ({
          size: item.isCustomItem ? (item.customDescription || item.size) : item.size,
          quantity: item.quantity,
          faces: item.faces,
          totalFaces: item.totalFaces,
          area: item.area || (item.width * item.height),
          pricePerMeter: item.pricePerMeter,
          totalArea: item.totalArea,
          totalPrice: item.totalPrice,
          width: item.width,
          height: item.height,
        })),
        currency: currency,
        discount: discount,
        discountType: discountType,
        discountAmount: discountAmount,
        accountDeduction: accountDeduction,
        subtotal: moneySubtotal,
        totalAmount: isPrinterCopy ? facesTotal : total,
        notes: showNotes ? notes : undefined,
        paymentMethod: localPaymentMethod,
        printerForDisplay: isPrinterCopy,
        includedInContract: includedInContract,
      });

    } catch (error) {
      console.error('Error in print invoice:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير الفاتورة للطباعة: ${errorMessage}`);
    }
  };

  const handleSave = async () => {
    if (localPrintItems.length === 0) {
      toast.error('لا توجد عناصر للحفظ');
      return;
    }

    // التحقق من أن المجموع ليس صفر
    if (total <= 0) {
      toast.error('لا يمكن حفظ فاتورة بمبلغ يساوي صفر أو أقل');
      return;
    }

    // contract_number is required by DB
    if (!selectedContracts || selectedContracts.length === 0) {
      toast.error('يرجى اختيار عقد واحد على الأقل لحفظ الفاتورة');
      return;
    }

    try {
      // Use computed subtotal/discount/total from component state
      const subtotalValue = Number(moneySubtotal) || 0;
      const discountAmountValue = Number(discountAmount) || 0;
      const totalValue = Number(total) || 0;

      const firstContractNumber = Number(selectedContracts[0]);
      if (isNaN(firstContractNumber)) {
        toast.error('رقم العقد المختار غير صالح.');
        return;
      }

      // Ensure invoice number exists
      if (!invoiceNumber) {
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        setInvoiceNumber(`INV-${timestamp}${randomSuffix}`);
      }

      // ✅ جلب اسم المطبعة من قائمة المطابع
      const selectedPrinter = printers.find(p => p.id === selectedPrinterId);
      const printerName = selectedPrinter?.name || 'غير محدد';

      const payload: any = {
        contract_number: firstContractNumber,
        invoice_number: invoiceNumber || `INV-${Date.now()}`,
        customer_id: customerId ?? null,
        customer_name: customerName ?? null,
        printer_name: printerName, // ✅ اسم المطبعة الفعلي
        printer_id: selectedPrinterId || null, // ✅ معرف المطبعة
        invoice_date: invoiceDate || new Date().toISOString().slice(0,10),
        subtotal: subtotalValue,
        discount: Number(discount) || 0,
        discount_type: discountType === 'percentage' ? 'percentage' : 'fixed',
        discount_amount: discountAmountValue,
        account_deduction: Number(accountDeduction) || 0,
        total: totalValue,
        total_amount: totalValue,
        items: localPrintItems, // stored in jsonb column
        print_items: JSON.stringify(localPrintItems),
        contract_numbers: selectedContracts && selectedContracts.length > 0 ? selectedContracts.join(',') : null,
        notes: notes || '',
        currency_code: currency?.code || null,
        currency_symbol: currency?.symbol || null,
        include_account_balance: includeAccountBalance ? true : false,
        invoice_type: (invoiceType === 'print_only' ? 'print' : invoiceType === 'print_install' ? 'print_install' : 'install'),
        payment_method: localPaymentMethod || null,
        included_in_contract: includedInContract, // ✅ مضمنة في العقد
        updated_at: new Date().toISOString()
      };

      // ✅ FIXED: إذا كان هناك initialInvoice، نقوم بعملية UPDATE بدلاً من INSERT
      if (initialInvoice && initialInvoice.id) {
        const { data, error } = await supabase
          .from('printed_invoices')
          .update(payload)
          .eq('id', initialInvoice.id)
          .select();

        if (error) {
          console.error('Failed to update printed invoice:', error);
          const errMsg = (error && (error.message || error.code)) ? `${error.message || error.code}` : JSON.stringify(error);
          toast.error(`فشل تحديث الفاتورة: ${errMsg}`);
          return;
        }

        toast.success('تم تحديث الفاتورة بنجاح');
        onSaveInvoice();
      } else {
        // إنشاء فاتورة جديدة
        payload.created_at = new Date().toISOString();
        
        const { data, error } = await supabase.from('printed_invoices').insert(payload).select();

        if (error) {
          console.error('Failed to save printed invoice:', error);
          const errMsg = (error && (error.message || error.code)) ? `${error.message || error.code}` : JSON.stringify(error);
          toast.error(`فشل حفظ الفاتورة: ${errMsg}`);
          return;
        }

        // ✅ إنشاء مهمة طباعة تلقائياً
        if (data && data[0]) {
          const invoice = data[0];
          
          // حساب المساحة والتكلفة الإجمالية
          const totalArea = localPrintItems.reduce((sum, item) => sum + (item.totalArea || 0), 0);
          const totalCost = totalValue; // ✅ استخدام totalValue المعرف

          // إنشاء مهمة الطباعة
          const { data: taskData, error: taskError } = await supabase
            .from('print_tasks')
            .insert({
              invoice_id: invoice.id,
              contract_id: selectedContracts[0] ? parseInt(selectedContracts[0]) : null,
              customer_id: customerId,
              customer_name: customerName,
              printer_id: selectedPrinterId || null,
              status: 'pending',
              total_area: totalArea,
              total_cost: totalCost,
              price_per_meter: totalArea > 0 ? totalCost / totalArea : 0,
              priority: 'normal',
            })
            .select()
            .single();

          if (taskError) {
            console.error('Failed to create print task:', taskError);
          } else if (taskData) {
            // إنشاء بنود مهمة الطباعة
            const taskItems = localPrintItems.map(item => ({
              task_id: taskData.id,
              billboard_id: null,
              description: item.customDescription || `${item.size} - ${item.quantity} قطعة`,
              width: item.width || null,
              height: item.height || null,
              area: item.area || null,
              quantity: item.quantity,
              unit_cost: item.pricePerMeter,
              total_cost: item.totalPrice,
              status: 'pending',
            }));

            const { error: itemsError } = await supabase
              .from('print_task_items')
              .insert(taskItems);

            if (itemsError) {
              console.error('Failed to create print task items:', itemsError);
            } else {
              console.log('✅ تم إنشاء مهمة الطباعة بنجاح');
            }
          }
        }

        toast.success('تم حفظ الفاتورة وإنشاء مهمة الطباعة بنجاح');
        onSaveInvoice();
      }
    } catch (e: any) {
      console.error('Error saving printed invoice:', e);
      const message = e?.message || String(e);
      toast.error(`خطأ أثناء حفظ الفاتورة: ${message}`);
    }
  };

  // ✅ دالة تحميل PDF
  const handleDownloadPDF = async (forPrinter: boolean = false) => {
    if (localPrintItems.length === 0) {
      toast.error('لا توجد عناصر لإنشاء PDF');
      return;
    }

    try {
      toast.info('جاري إنشاء ملف PDF...');
      
      const isPrinterCopy = Boolean(forPrinter);
      const currentDate = new Date(invoiceDate);
      const dateFormatted = currentDate.toISOString().slice(0, 10).replace(/-/g, '_');
      const customerNameForFile = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
      const invoiceTypeCode = invoiceType === 'print_only' ? 'طباعة' : invoiceType === 'print_install' ? 'طباعة_وتركيب' : 'تركيب';
      const fileName = `فاتورة_${invoiceTypeCode}_${customerNameForFile}_${dateFormatted}`;

      // استخدام دالة generateModernPrintInvoiceHTML التي تستخدم القوالب المحفوظة (async)
      const htmlContent = await generateModernPrintInvoiceHTML({
        invoiceNumber: invoiceNumber,
        invoiceType: invoiceType === 'print_only' ? 'طباعة' : invoiceType === 'print_install' ? 'طباعة وتركيب' : 'تركيب',
        invoiceDate: invoiceDate,
        customerName: customerName,
        items: localPrintItems.map(item => ({
          size: item.isCustomItem ? (item.customDescription || item.size) : item.size,
          quantity: item.quantity,
          faces: item.faces,
          totalFaces: item.totalFaces,
          width: item.width,
          height: item.height,
          area: item.area || (item.width * item.height),
          pricePerMeter: item.pricePerMeter,
          totalPrice: item.totalPrice
        })),
        totalAmount: isPrinterCopy ? facesTotal : total,
        notes: notes,
        hidePrices: isPrinterCopy,
        showNotes: showNotes
      });

      // إنشاء عنصر مؤقت
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '210mm';
      tempDiv.style.top = '0';
      document.body.appendChild(tempDiv);

      // إعدادات PDF
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `${fileName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 794 // عرض A4 بالبكسل
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait',
          compress: true
        }
      };

      // توليد وتحميل PDF
      await html2pdf().set(opt).from(tempDiv).save();
      
      // تنظيف
      document.body.removeChild(tempDiv);
      
      toast.success('تم تحميل ملف PDF بنجاح');
    } catch (error) {
      console.error('خطأ في توليد PDF:', error);
      toast.error('فشل في إنشاء ملف PDF');
    }
  };

  const InvoicePreview = () => (
    <div className="bg-background text-foreground p-6 rounded-lg border border-border shadow-card w-full" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-primary">
        <div className="text-right">
          <img src="/logofares.svg" alt="شعار الشركة" className="max-w-[200px] h-auto mb-3" />
        </div>
        <div className="text-left" dir="ltr">
          <h1 className="text-3xl font-bold text-primary mb-3">INVOICE</h1>
          <div className="text-sm text-muted-foreground">
            رقم الفاتورة: {invoiceNumber}<br />
            التاريخ: {new Date(invoiceDate).toLocaleDateString('ar-LY')}<br />
            العمل  : {currency.name}
          </div>
        </div>
      </div>

      {/* Customer Info */}
      <div className="expenses-preview-item mb-6 p-4 border-r-4 border-primary">
        <h3 className="expenses-preview-label mb-3 text-lg">بيانات العميل</h3>
        <div className="text-sm space-y-1">
          <div><strong>الاسم:</strong> {customerName}</div>
          <div><strong>العقود المرتبطة:</strong> {selectedContracts.join(', ')}</div>
          <div><strong>تاريخ الفاتورة:</strong> {new Date(invoiceDate).toLocaleDateString('ar-LY')}</div>
          {localPaymentMethod && <div><strong>طريقة الدفع:</strong> {localPaymentMethod}</div>}
        </div>
      </div>

      {/* Items Table */}
      {localPrintItems.length > 0 && (
        <div className="mb-6">
          <h3 className="expenses-preview-label mb-4 text-lg">تفاصيل الطباعة:</h3>
          <div className="expenses-table-container overflow-x-auto">
            <table className="w-full border-collapse border border-border text-sm">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="border border-border p-3 text-center font-bold">المقاس</th>
                  <th className="border border-border p-3 text-center font-bold">عدد اللوحات</th>
                  <th className="border border-border p-3 text-center font-bold">أوجه/لوحة</th>
                  <th className="border border-border p-3 text-center font-bold">إجمالي الأوجه</th>
                  <th className="border border-border p-3 text-center font-bold">الأبعاد (م)</th>
                  <th className="border border-border p-3 text-center font-bold">المساحة/الوجه</th>
                  <th className="border border-border p-3 text-center font-bold">سعر المتر ({currency.symbol})</th>
                  <th className="border border-border p-3 text-center font-bold">الإجمالي ({currency.symbol})</th>
                </tr>
              </thead>
              <tbody>
                {localPrintItems.map((item, index) => {
                  const pricePerMeterVal = Number(item.pricePerMeter) || 0;
                  const itemTotalPriceVal = Number(item.totalPrice) || ((Number(item.width) || 0) * (Number(item.height) || 0) * (Number(item.totalFaces) || 0) * pricePerMeterVal);
                  return (
                    <tr key={index} className={index % 2 === 0 ? 'bg-card/50' : 'bg-background'}>
                      <td className="border border-border p-3 text-center font-medium">{item.width} × {item.height} م</td>
                      <td className="border border-border p-3 text-center">{formatArabicNumber(item.quantity)}</td>
                      <td className="border border-border p-3 text-center">{formatArabicNumber(item.faces)}</td>
                      <td className="border border-border p-3 text-center font-medium">{formatArabicNumber(item.totalFaces)}</td>
                      <td className="border border-border p-3 text-center">{item.width} × {item.height}</td>
                      <td className="border border-border p-3 text-center">{(Number(item.area) || 0).toFixed(2)} م²</td>
                      <td className="border border-border p-3 text-center">{formatArabicNumber(pricePerMeterVal)} {currency.symbol}</td>
                      <td className="border border-border p-3 text-center font-medium">{formatArabicNumber(itemTotalPriceVal)} {currency.symbol}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totals */}
      {localPrintItems.length > 0 && (
        <div className="border-t-2 border-primary pt-6">
          <div className="flex justify-end">
            <div className="w-[400px]">
              <div className="flex justify-between py-2 text-sm">
                <span>المجموع الفرعي:</span>
                <span className="expenses-amount-calculated font-bold">{formatArabicNumber(moneySubtotal)} {currency.symbol}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between py-2 text-sm text-green-400">
                  <span>خصم ({discountType === 'percentage' ? `${discount}%` : `${formatArabicNumber(discount)} ${currency.symbol}`}):</span>
                  <span className="font-bold">- {formatArabicNumber(discountAmount)} {currency.symbol}</span>
                </div>
              )}

              {accountDeduction > 0 && (
                <div className="flex justify-between py-2 text-sm text-blue-400">
                  <span>خصم من رصيد الحساب:</span>
                  <span className="font-bold">- {formatArabicNumber(accountDeduction)} {currency.symbol}</span>
                </div>
              )}

              <div className="flex justify-between py-4 text-xl font-bold bg-primary text-primary-foreground px-6 rounded-lg mt-4">
                <span>الإجمالي النهائي:</span>
                <span className="text-primary-glow">{formatArabicNumber(total)} {currency.symbol}</span>
              </div>

            </div>
          </div>
        </div>
      )}

      {showNotes && notes && (
        <div className="mt-6 p-4 bg-accent/20 border border-accent rounded-lg">
          <strong className="text-sm">ملاحظات:</strong> <span className="text-sm">{notes}</span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-muted-foreground border-t border-border pt-4">
        شكراً لتعاملكم معنا | Thank you for your business<br />
        هذه فاتورة إلكترونية ولا تحتاج إلى ختم أو توقيع
      </div>
    </div>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div 
        className="bg-background border border-border rounded-lg shadow-lg w-[96vw] max-h-[96vh] flex flex-col"
        dir="rtl"
      >
        {/* Header */}
        <div className="border-b border-border pb-4 px-6 pt-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="expenses-preview-title flex items-center gap-3 text-xl font-bold text-primary">
              <Receipt className="h-6 w-6" />
              فاتورة طباعة عصرية
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Tabs */}
          <div className="expenses-actions mt-4 gap-4">
            <Button
              variant={activeTab === 'setup' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('setup')}
              className="expenses-action-btn text-sm px-4 py-2"
            >
              <Settings className="h-4 w-4" />
              الإعداد
            </Button>
            <Button
              variant={activeTab === 'preview' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('preview')}
              className="expenses-action-btn text-sm px-4 py-2"
            >
              <Eye className="h-4 w-4" />
              معاينة
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          {activeTab === 'setup' ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 py-4">
              {/* Left Panel - Configuration */}
              <div className="space-y-6">
                {/* Invoice Settings */}
                <Card className="expenses-preview-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="expenses-preview-label flex items-center gap-3 text-lg">
                      <FileText className="h-5 w-5" />
                      إعدادات الفاتورة
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="expenses-form-grid gap-4">
                      <div>
                        <label className="expenses-form-label mb-2 block text-sm">رقم الفاتورة</label>
                        <Input
                          value={invoiceNumber}
                          readOnly
                          className="text-right text-sm p-3 h-10 bg-muted cursor-not-allowed"
                          title="رقم الفاتورة يتم توليده تلقائياً"
                        />
                        <p className="text-xs text-muted-foreground mt-1">يتم توليد رقم الفاتورة تلقائياً</p>
                      </div>
                      <div>
                        <label className="expenses-form-label mb-2 block text-sm">التاريخ</label>
                        <Input
                          type="date"
                          value={invoiceDate}
                          onChange={(e) => setInvoiceDate(e.target.value)}
                          className="text-sm p-3 h-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="expenses-form-label mb-2 block text-sm">العملة</label>
                      <select
                        value={currency.code}
                        onChange={(e) => setCurrency(CURRENCIES.find(c => c.code === e.target.value) || CURRENCIES[0])}
                        className="w-full p-3 h-10 border border-border rounded-md text-right bg-input text-foreground text-sm"
                      >
                        {CURRENCIES.map(curr => (
                          <option key={curr.code} value={curr.code}>
                            {curr.name} ({curr.symbol})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="expenses-form-label mb-2 block text-sm">طريقة الدفع</label>
                      <select
                        value={localPaymentMethod}
                        onChange={(e) => setLocalPaymentMethod(e.target.value)}
                        className="w-full p-3 h-10 border border-border rounded-md text-right bg-input text-foreground text-sm"
                      >
                        <option value="نقدي">نقدي</option>
                        <option value="بنكي">بنكي</option>
                        <option value="شيك">شيك</option>
                        <option value="تحويل">تحويل</option>
                        <option value="آجل">آجل</option>
                      </select>
                    </div>

                    <div>
                      <label className="expenses-form-label mb-2 block text-sm">نوع الفاتورة</label>
                      <select
                        value={invoiceType}
                        onChange={(e) => setInvoiceType(e.target.value as any)}
                        className="w-full p-3 h-10 border border-border rounded-md text-right bg-input text-foreground text-sm"
                      >
                        <option value="print_only">طباعة فقط</option>
                        <option value="print_install">طباعة وتركيب</option>
                        <option value="install_only">تركيب فقط</option>
                      </select>
                    </div>

                    <div>
                      <label className="expenses-form-label mb-2 block text-sm">المطبعة</label>
                      <select
                        value={selectedPrinterId}
                        onChange={(e) => setSelectedPrinterId(e.target.value)}
                        className="w-full p-3 h-10 border border-border rounded-md text-right bg-input text-foreground text-sm"
                      >
                        <option value="">اختر المطبعة...</option>
                        {printers.map((printer) => (
                          <option key={printer.id} value={printer.id}>
                            {printer.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="expenses-form-label mb-2 block text-sm">ملاحظات</label>
                      <Input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="ملاحظات إضافية..."
                        className="text-right text-sm p-3 h-10"
                      />
                    </div>

                    {/* ✅ خيار إظهار/إخفاء الملاحظات في الطباعة */}
                    <div className="flex items-center space-x-2 space-x-reverse pt-2">
                      <Checkbox
                        id="show-notes"
                        checked={showNotes}
                        onCheckedChange={(checked) => setShowNotes(checked as boolean)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="show-notes" className="text-sm cursor-pointer">
                        إظهار الملاحظات في الفاتورة المطبوعة
                      </label>
                    </div>

                    {/* ✅ خيار مضمنة في العقد */}
                    <div className="flex items-center space-x-2 space-x-reverse pt-2 p-3 bg-accent/20 border border-accent rounded-lg">
                      <Checkbox
                        id="included-in-contract"
                        checked={includedInContract}
                        onCheckedChange={(checked) => setIncludedInContract(checked as boolean)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <label htmlFor="included-in-contract" className="text-sm cursor-pointer font-medium">
                          فاتورة مضمنة في العقد
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">
                          عند التفعيل: لن تُحتسب في إجمالي الديون (مرتبطة بالعقد فقط للتوثيق)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contract Selection */}
                <Card className="expenses-preview-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="expenses-preview-label text-lg">اختيار العقود</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {contracts.map((contract) => (
                        <div
                          key={contract.Contract_Number}
                          className="flex items-center space-x-3 space-x-reverse p-3 border border-border rounded-lg hover:bg-card/50 cursor-pointer transition-colors"
                          onClick={(e) => handleRowClick(contract.Contract_Number, e)}
                        >
                          <Checkbox
                            checked={selectedContracts.includes(contract.Contract_Number)}
                            onCheckedChange={() => handleContractToggle(contract.Contract_Number)}
                            className="w-4 h-4"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1">
                            <div className="expenses-contract-number text-sm">رقم العقد {contract.Contract_Number}</div>
                            <div className="expenses-preview-text text-xs">{contract['Ad Type']}</div>
                          </div>
                          <Badge variant="outline" className="border-primary text-primary text-xs px-2 py-1">
                            {formatArabicNumber(contract['Total'])} د.ل
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        💡 انقر على أي صف لاختيار العقد، أو انقر على المربع للتحديد المباشر
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Discount & Account Balance */}
                <Card className="expenses-preview-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="expenses-preview-label text-lg">خصومات ورصيد</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="expenses-form-label mb-2 block text-sm">قيمة الخصم</label>
                        <Input
                          type="number"
                          value={discount}
                          onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                          className="text-right text-sm p-3 h-10"
                        />
                      </div>
                      <div>
                        <label className="expenses-form-label mb-2 block text-sm">النوع</label>
                        <select
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                          className="w-full p-3 h-10 border border-border rounded-md bg-input text-foreground text-sm"
                        >
                          <option value="percentage">%</option>
                          <option value="fixed">ثابت</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="expenses-form-label mb-2 block text-sm">
                          خصم من رصيد حساب الزبون
                          <span className="text-xs text-muted-foreground mr-2">
                            (الرصيد المتاح: {formatArabicNumber(accountPayments)} {currency.symbol})
                          </span>
                        </label>
                        <Input
                          type="number"
                          value={accountDeduction}
                          onChange={(e) => {
                            const value = Number(e.target.value) || 0;
                            // منع إدخال قيمة أكبر من الرصيد المتاح
                            if (value <= accountPayments) {
                              setAccountDeduction(value);
                            } else {
                              toast.error(`لا يمكن خصم أكثر من الرصيد المتاح (${formatArabicNumber(accountPayments)} ${currency.symbol})`);
                            }
                          }}
                          max={accountPayments}
                          placeholder="0"
                          className="text-right text-sm p-3 h-10"
                        />
                        {accountDeduction > 0 && (
                          <p className="text-xs text-success mt-1">
                            ✓ سيتم خصم {formatArabicNumber(accountDeduction)} {currency.symbol} من رصيد الحساب
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Panel - Items */}
              <div className="space-y-6">
                {/* إضافة بند مخصص */}
                <Card className="expenses-preview-card border-2 border-primary/30 bg-primary/5">
                  <CardHeader className="pb-4">
                    <CardTitle className="expenses-preview-label flex items-center gap-3 text-lg">
                      <Plus className="h-5 w-5" />
                      إضافة بند مخصص
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="expenses-form-label mb-2 block text-sm">البيان / الوصف</label>
                      <Input
                        value={customDesc}
                        onChange={(e) => setCustomDesc(e.target.value)}
                        placeholder="مثال: طباعة إعلان خاص، تصميم شعار، إلخ..."
                        className="text-right text-sm p-3 h-10"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="expenses-form-label mb-2 block text-sm">الكمية</label>
                        <Input
                          type="number"
                          min="1"
                          value={customQty}
                          onChange={(e) => setCustomQty(Number(e.target.value) || 1)}
                          className="text-center text-sm p-3 h-10"
                        />
                      </div>
                      <div>
                        <label className="expenses-form-label mb-2 block text-sm">السعر ({currency.symbol})</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={customPrice}
                          onChange={(e) => setCustomPrice(Number(e.target.value) || 0)}
                          className="text-center text-sm p-3 h-10"
                        />
                      </div>
                    </div>
                    {customDesc && customQty > 0 && customPrice > 0 && (
                      <div className="p-3 bg-success/10 border border-success/30 rounded-lg">
                        <p className="text-sm text-success">
                          إجمالي البند: {formatArabicNumber(customQty * customPrice)} {currency.symbol}
                        </p>
                      </div>
                    )}
                    <Button
                      onClick={handleAddCustomItem}
                      className="w-full bg-primary hover:bg-primary/90 gap-2"
                      size="sm"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة البند للفاتورة
                    </Button>
                  </CardContent>
                </Card>

                <Card className="expenses-preview-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="expenses-preview-label flex items-center gap-3 text-lg">
                      <Calculator className="h-5 w-5" />
                      عناصر الفاتورة ({localPrintItems.length})
                      {localPrintItems.length > 0 && (
                        <span className="text-sm font-normal text-muted-foreground">
                          - المجموع: {formatArabicNumber(moneySubtotal)} {currency.symbol}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedContracts.length === 0 ? (
                      <div className="expenses-empty-state py-12">
                        <Calculator className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">لا توجد عقود محددة</p>
                        <p className="text-sm">  رجى اختيار العقود أولاً لعرض عناصر الطباعة</p>
                      </div>
                    ) : localPrintItems.length === 0 ? (
                      <div className="expenses-empty-state py-12">
                        <Calculator className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">لا توجد عناصر للطباعة</p>
                        <p className="text-sm">لم يتم العثور على لوحات مرتبطة بالعقود المحددة</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {localPrintItems.map((item, index) => (
                          <div key={index} className={`border border-border rounded-lg p-4 ${item.isCustomItem ? 'bg-primary/5 border-primary/30' : 'bg-card/50'}`}>
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                {item.isCustomItem && (
                                  <Badge variant="secondary" className="text-xs">بند مخصص</Badge>
                                )}
                                <h4 className="expenses-preview-label text-lg">
                                  {item.isCustomItem ? item.customDescription : item.size}
                                </h4>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(index)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            {item.isCustomItem ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs text-muted-foreground mb-2">الكمية</label>
                                    <Input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const qty = Number(e.target.value) || 1;
                                        handlePrintItemUpdate(index, 'quantity', qty);
                                      }}
                                      className="h-9 text-center text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-muted-foreground mb-2">السعر</label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.pricePerMeter}
                                      onChange={(e) => {
                                        const price = Number(e.target.value) || 0;
                                        handlePrintItemUpdate(index, 'pricePerMeter', price);
                                      }}
                                      className="h-9 text-center text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="p-3 bg-muted rounded-lg">
                                  <div className="flex justify-between text-sm">
                                    <span>الإجمالي:</span>
                                    <span className="font-bold">{formatArabicNumber(item.totalPrice)} {currency.symbol}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                  <div>
                                    <label className="block text-xs text-muted-foreground mb-2">العرض (م)</label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.width}
                                      onChange={(e) => handlePrintItemUpdate(index, 'width', Number(e.target.value) || 0)}
                                      className="h-9 text-center text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-muted-foreground mb-2">الارتفاع (م)</label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.height}
                                      onChange={(e) => handlePrintItemUpdate(index, 'height', Number(e.target.value) || 0)}
                                      className="h-9 text-center text-sm"
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                            
                            {!item.isCustomItem && (
                              <>
                                <div className="expenses-form-grid gap-4">
                                  <div>
                                    <label className="block text-xs text-muted-foreground mb-2">عدد اللوحات</label>
                                    <Input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => handlePrintItemUpdate(index, 'quantity', Number(e.target.value) || 0)}
                                      className="h-9 text-center text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-muted-foreground mb-2">إجمالي الأوجه</label>
                                    <Input
                                      type="number"
                                      value={item.totalFaces}
                                      onChange={(e) => handlePrintItemUpdate(index, 'totalFaces', Number(e.target.value) || 0)}
                                      className="h-9 text-center text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-muted-foreground mb-2">سعر المتر</label>
                                    <Input
                                      type="number"
                                      value={item.pricePerMeter}
                                      onChange={(e) => handlePrintItemUpdate(index, 'pricePerMeter', Number(e.target.value) || 0)}
                                      className="h-9 text-center text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-muted-foreground mb-2">الإجمالي</label>
                                    <div className="h-9 bg-muted rounded flex items-center justify-center text-sm font-medium expenses-amount-calculated">
                                      {formatArabicNumber(item.totalPrice)} {currency.symbol}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="mt-3 text-xs text-muted-foreground">
                                  المساحة: {item.width} × {item.height} = {(item.area || 0).toFixed(2)} م² | 
                                  الحساب: {(item.area || 0).toFixed(2)} × {item.totalFaces} × {item.pricePerMeter} = {formatArabicNumber(item.totalPrice)}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Summary */}
                {localPrintItems.length > 0 && (
                  <Card className="expenses-preview-card">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>المجموع الفرعي:</span>
                          <span className="expenses-amount-calculated font-bold">{formatArabicNumber(moneySubtotal)} {currency.symbol}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-sm stat-green">
                            <span>الخصم:</span>
                            <span className="font-bold">- {formatArabicNumber(discountAmount)} {currency.symbol}</span>
                          </div>
                        )}
                        {includeAccountBalance && accountPayments > 0 && (
                          <div className="flex justify-between text-sm stat-blue">
                            <span>رصيد الحساب:</span>
                            <span className="font-bold">- {formatArabicNumber(accountPayments)} {currency.symbol}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>الإجمالي:</span>
                          <span className="text-primary">{formatArabicNumber(total)} {currency.symbol}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4">
              <InvoicePreview />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-border pt-4 pb-4 px-6 flex justify-between flex-shrink-0">
          <div className="expenses-actions">
            <Button variant="outline" onClick={onClose} className="text-sm px-6 py-2">
              إغلاق
            </Button>
          </div>
          
          <div className="expenses-actions gap-4">
            {customerPhone && (
              <SendInvoiceWhatsApp
                customerName={customerName}
                customerPhone={customerPhone}
                invoiceNumber={invoiceNumber}
                invoiceType="invoice"
              />
            )}
            <Button
              variant="outline"
              onClick={handleSave}
              className="expenses-action-btn text-sm px-6 py-2"
              disabled={localPrintItems.length === 0}
            >
              <Save className="h-4 w-4" />
              حفظ في الحساب
            </Button>
            <Button
              onClick={() => handlePrint(false)}
              className="expenses-action-btn bg-gradient-to-r from-primary to-primary-glow text-sm px-6 py-2"
              disabled={localPrintItems.length === 0}
            >
              <Printer className="h-4 w-4" />
              طباعة (مع الأسعار)
            </Button>
            
            <Button
              onClick={() => handleDownloadPDF(false)}
              variant="outline"
              className="expenses-action-btn text-sm px-6 py-2 border-primary text-primary hover:bg-primary/10"
              disabled={localPrintItems.length === 0}
            >
              <Download className="h-4 w-4" />
              تحميل PDF
            </Button>

            <Button
              onClick={() => handlePrint(true)}
              variant="outline"
              className="expenses-action-btn text-sm px-6 py-2"
              disabled={localPrintItems.length === 0}
            >
              <Printer className="h-4 w-4" />
              للطابعة (أوجه فقط)
            </Button>
            
            <Button
              onClick={() => handleDownloadPDF(true)}
              variant="outline"
              className="expenses-action-btn text-sm px-6 py-2"
              disabled={localPrintItems.length === 0}
            >
              <Download className="h-4 w-4" />
              PDF (أوجه فقط)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
