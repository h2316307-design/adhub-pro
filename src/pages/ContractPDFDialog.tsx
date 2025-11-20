import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Printer, X, Download, Eye, Send } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { saveHtmlAsPdf } from '@/utils/pdfHelpers';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';
interface ContractPDFDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: any;
}

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
  if (isNaN(num) || num === null || num === undefined) return '0';
  
  // Convert to string and handle decimal places
  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Add thousands separator (comma) to integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Return with decimal part if exists
  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  }
  
  return formattedInteger;
};

export default function ContractPDFDialog({ open, onOpenChange, contract }: ContractPDFDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [printMode, setPrintMode] = useState<'auto' | 'manual'>('auto');
  const [customerData, setCustomerData] = useState<{
    name: string;
    company: string | null;
    phone: string | null;
  } | null>(null);
  // دالة لجلب بيانات المقاسات من جدول sizes
  const [sizesData, setSizesData] = useState<any[]>([]);
  
  // ✅ NEW: Preview states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHTML, setPreviewHTML] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  
  // WhatsApp sending
  const { sendMessage, loading: sendingWhatsApp } = useSendWhatsApp();

  const loadSizesData = async () => {
    try {
      const { data, error } = await supabase
        .from('sizes')
        .select('*');
      if (!error && Array.isArray(data)) {
        setSizesData(data);
      }
    } catch (error) {
      console.error('Error loading sizes data:', error);
    }
  };

  useEffect(() => {
    if (open) {
      loadSizesData();
    }
  }, [open]);

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

  // ✅ REFACTORED: Get discount information from contract
  const getDiscountInfo = () => {
    const discount = contract?.Discount || contract?.discount || 0;
    const currencyInfo = getCurrencyInfo();
    
    if (!discount || discount === 0) {
      return null; // No discount
    }
    
    // Check if discount is percentage (contains % or is between 0-100 and looks like percentage)
    const discountStr = String(discount);
    const isPercentage = discountStr.includes('%') || (Number(discount) > 0 && Number(discount) <= 100 && !discountStr.includes('.'));
    
    if (isPercentage) {
      const percentValue = Number(discountStr.replace('%', ''));
      return {
        type: 'percentage',
        value: percentValue,
        display: `${formatArabicNumber(percentValue)}%`,
        text: `${formatArabicNumber(percentValue)}%` // ✅ FIXED: Remove duplicate "خصم" word
      };
    } else {
      const fixedValue = Number(discount);
      return {
        type: 'fixed',
        value: fixedValue,
        display: `${formatArabicNumber(fixedValue)} ${currencyInfo.symbol}`,
        text: `${formatArabicNumber(fixedValue)} ${currencyInfo.writtenName}` // ✅ FIXED: Remove duplicate "خصم" word
      };
    }
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
        company: null,
        phone: null
      });
      
    } catch (error) {
      console.error('Error loading customer data:', error);
      // Use contract data as fallback
      setCustomerData({
        name: contract?.customer_name || contract?.['Customer Name'] || '',
        company: null,
        phone: null
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
    
    // ✅ CORRECTED: Use final total (rental + installation) for display
    const finalTotal = contract?.Total || contract?.total_cost || 0;
    const rentalCost = contract?.rent_cost || contract?.['Total Rent'] || 0;
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

  // ✅ REFACTORED: Get billboards data from various sources
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

    return billboardsToShow;
  };

  // ✅ REFACTORED: Get billboard prices from contract
  const getBillboardPrices = () => {
    let billboardPrices = {};
    if (contract?.billboard_prices) {
      try {
        const pricesData = typeof contract.billboard_prices === 'string' 
          ? JSON.parse(contract.billboard_prices) 
          : contract.billboard_prices;
        
        if (Array.isArray(pricesData)) {
          billboardPrices = pricesData.reduce((acc, item) => {
            acc[item.billboardId] = item.contractPrice;
            return acc;
          }, {});
          console.log('✅ Loaded billboard prices from billboard_prices column:', billboardPrices);
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
      ${discountInfo ? `
        <div class="total-row"><span>المجموع الفرعي:</span><span><span class="num">${formatArabicNumber(subtotal)}</span> ${currencyInfo.symbol}</span></div>
        <div class="total-row"><span>خصم (${discountInfo.display}):</span><span>- <span class="num">${formatArabicNumber(discountAmount)}</span> ${currencyInfo.symbol}</span></div>
      ` : ''}
      <div class="total-row grand-total"><span>المجموع الإجمالي:</span><span><span class="num">${formatArabicNumber(grandTotal)}</span> ${currencyInfo.symbol}</span></div>
      <div style="margin-top: 15px; text-align: center;">المبلغ بالكلمات: ${formatArabicNumber(grandTotal)} ${currencyInfo.writtenName}${discountInfo ? `<br><small style="color: #28a745;">* تم تطبيق خصم ${discountInfo.text}</small>` : ''}${printCostEnabled ? '<br><small style="color: #28a745;">* الأسعار شاملة تكلفة الطباعة</small>' : '<br><small>* الأسعار غير شاملة تكلفة الطباعة</small>'}</div>
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

  // ✅ REFACTORED: Invoice printing function with discount support (NO INSTALLATION COST)
  const handlePrintInvoice = async () => {
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
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();

      // Get billboards data and pricing
      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();
      const { groupedBillboards, subtotal: billboardSubtotal } = calculateBillboardPricing(billboardsToShow, billboardPrices);

      // ✅ REMOVED: Installation cost section as requested
      let subtotal = billboardSubtotal;

      // ✅ FIXED: Calculate discount amount and grand total
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

      // ✅ FIXED: Prepare display items for table (NO discount in table, NO installation cost)
      const FIXED_ROWS = 10;
      const displayItems = [...groupedBillboards];
      
      // Fill remaining rows with empty data
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

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>فاتورة العقد ${contract?.id}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            html, body {
              width: 210mm;
              height: 297mm;
              font-family: 'Doran', 'Noto Sans Arabic', Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: white;
              color: #000;
              font-size: 12px;
              line-height: 1.4;
              overflow: hidden;
            }
            
            .invoice-container {
              width: 210mm;
              height: 297mm;
              padding: 15mm;
              display: flex;
              flex-direction: column;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 30px;
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
            }
            
            .invoice-info {
              text-align: left;
              direction: ltr;
              order: 2;
            }
            
            .invoice-title {
              font-size: 28px;
              font-weight: bold;
              color: #000;
              margin-bottom: 10px;
            }
            
            .invoice-details {
              font-size: 12px;
              color: #666;
              line-height: 1.6;
            }
            
            .company-info {
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              text-align: right;
              order: 1;
            }
            
            .company-logo {
              max-width: 400px;
              height: auto;
              object-fit: contain;
              margin-bottom: 5px;
              display: block;
              margin-right: 0;
            }
            
            .company-details {
              font-size: 12px;
              color: #666;
              line-height: 1.6;
              font-weight: 400;
              text-align: right;
            }
            
            .customer-info {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 0;
              margin-bottom: 25px;
              border-right: 4px solid #000;
            }
            
            .customer-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #000;
            }
            
            .customer-details {
              font-size: 13px;
              line-height: 1.6;
            }
            
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
              table-layout: fixed;
            }
            
            .items-table th {
              background: #000;
              color: white;
              padding: 12px 8px;
              text-align: center;
              font-weight: bold;
              border: 1px solid #000;
              font-size: 12px;
              height: 40px;
            }
            
            .items-table td {
              padding: 10px 8px;
              text-align: center;
              border: 1px solid #ddd;
              font-size: 11px;
              vertical-align: middle;
              height: 35px;
            }
            
            .items-table tbody tr:nth-child(even) {
              background: #f8f9fa;
            }
            
            .items-table tbody tr:hover {
              background: #e9ecef;
            }
            
            .items-table tbody tr.empty-row {
              background: white;
            }
            
            .items-table tbody tr.empty-row:nth-child(even) {
              background: #f8f9fa;
            }
            
            .total-section {
              margin-top: auto;
              border-top: 2px solid #000;
              padding-top: 20px;
            }
            
            .total-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 8px 0;
              font-size: 14px;
            }
            
            /* Use Manrope for numeric monetary values and make currency symbol plain black on the right */
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

            /* Gold styling for the grand total number */
            .grand-num {
              color: #FFD700;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
              font-weight: 800;
            }

            /* Ensure currency symbol is visible on dark grand-total background */
            .total-row.grand-total .currency {
              color: #fff !important;
              margin-left: 6px;
              font-weight: 700;
            }
            
            .total-row.subtotal {
              font-size: 16px;
              font-weight: bold;
              border-bottom: 1px solid #ddd;
              margin-bottom: 10px;
            }

            .total-row.discount {
              font-size: 16px;
              font-weight: bold;
              color: #28a745;
              margin-bottom: 10px;
            }
            
            .total-row.grand-total {
              font-size: 20px;
              font-weight: bold;
              background: #000;
              color: white;
              padding: 20px 25px;
              border-radius: 0;
              margin-top: 15px;
              border: none;
            }
            
            .currency {
              font-weight: bold;
              color: #030303ff;
            }
            
            .footer {
              margin-top: 25px;
              text-align: center;
              font-size: 11px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }
            
            @media print {
              html, body {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                color-adjust: exact;
              }
              
              .invoice-container {
                width: 210mm !important;
                height: 297mm !important;
                padding: 15mm !important;
              }
              
              @page {
                size: A4 portrait;
                margin: 0 !important;
                padding: 0 !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <div class="company-info">
                <img src="/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
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
                      <td>${isEmpty ? '' : (typeof item.unitPrice === 'number' ? `<span style="direction:ltr;display:inline-block;"><span class=\"num\">${formatArabicNumber(item.unitPrice)}</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>` : item.unitPrice)}</td>
                      <td>${isEmpty ? '' : (typeof item.totalPrice === 'number' ? `<span style="direction:ltr;display:inline-block;"><span class=\"num\">${formatArabicNumber(item.totalPrice)}</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>` : item.totalPrice)}</td>
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
          
          <script>
            window.addEventListener('load', function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 500);
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

      toast.success(`تم فتح فاتورة العقد للطباعة بنجاح بعملة ${currencyInfo.name}!`);
      
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
      const year = new Date().getFullYear();
      const currencyInfo = getCurrencyInfo();
      const discountInfo = getDiscountInfo();

      // Extract all contract data automatically (NO INSTALLATION COST)
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
        companyName: 'شركة الفارس الذهبي للدعاية والإعلان',
        phoneNumber: '0912612255',
        payments: paymentInstallments,
        currencyInfo: currencyInfo,
        discountInfo: discountInfo
      };

      // Get billboards data
      const billboardsToShow = await getBillboardsData();
      const billboardPrices = getBillboardPrices();

      const norm = (b: any) => {
        const id = String(b.ID ?? b.id ?? b.code ?? '');
        
        // Enhanced image handling - use dual source system
        const imageName = b.image_name || b.Image_Name;
        const imageUrl = b.Image_URL || b.image || b.billboard_image || b.imageUrl || b.img;
        const image = imageName ? `/image/${imageName}` : (imageUrl || '');
        
        const municipality = String(b.Municipality ?? b.municipality ?? b.city ?? '');
        const district = String(b.District ?? b.district ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.landmark ?? '');
        const size = String(b.Size ?? b.size ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b.Faces_Count ?? b.faces_count ?? '1');
        
        // ✅ ENHANCED: Use historical price from billboard_prices column if available with currency
        let price = '';
        const historicalPrice = billboardPrices[id];
        if (historicalPrice !== undefined && historicalPrice !== null) {
          const num = Number(historicalPrice);
          if (!isNaN(num) && num > 0) {
            price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">${formatArabicNumber(num)}</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>`;
          } else {
            price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">0</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>`;
          }
          console.log(`✅ Using historical price for billboard ${id}: ${price}`);
        } else {
          // Fallback to current billboard price
          const priceVal = b.Price ?? b.price ?? b.rent ?? b.Rent_Price ?? b.rent_cost ?? b['Total Rent'] ?? 0;
          if (priceVal !== undefined && priceVal !== null && String(priceVal) !== '' && priceVal !== 0) {
            const num = typeof priceVal === 'number' ? priceVal : Number(priceVal);
            if (!isNaN(num) && num > 0) {
              price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">${formatArabicNumber(num)}</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>`;
            } else {
              price = String(priceVal);
            }
          } else {
            price = `<span style="direction:ltr;display:inline-block;"><span class=\"num\">0</span> <span class=\"currency\">${currencyInfo.symbol}</span></span>`;
          }
          console.log(`⚠️ Using fallback price for billboard ${id}: ${price}`);
        }

        let rent_end_date = '';
        if (b.end_date || b['End Date']) {
          try {
            rent_end_date = new Date(b.end_date || b['End Date']).toLocaleDateString('ar-LY');
          } catch (e) {
            rent_end_date = contractDetails.endDate;
          }
        } else {
          rent_end_date = contractDetails.endDate;
        }

        // باقي الحقول
        let coords: string = String(b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? '');
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude;
          const lng = b.Longitude ?? b.lng ?? b.longitude;
          if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : (b.GPS_Link || '');
        const name = String(b.Billboard_Name ?? b.name ?? b.code ?? id);

        return { id, name, image, municipality, district, landmark, size, faces, price, rent_end_date, mapLink };
      };

      // ربط كل لوحة بمقاسها وترتيب اللوحات حسب sort_order
      const normalized = billboardsToShow.map(norm);
      // ربط كل لوحة ببيانات المقاس
      const normalizedWithSizeRank = normalized.map((billboard) => {
        // ابحث عن المقاس المناسب من sizesData
        const sizeObj = sizesData.find(sz => sz.name === billboard.size);
        return {
          ...billboard,
          sort_order: sizeObj ? sizeObj.sort_order ?? 999 : 999,
        };
      });
      // ترتيب اللوحات حسب sort_order للمقاس
      const sortedBillboards = normalizedWithSizeRank.sort((a, b) => a.sort_order - b.sort_order);
      const ROWS_PER_PAGE = 12;
      const tablePagesHtml = sortedBillboards.length
        ? sortedBillboards
            .reduce((acc: any[][], r, i) => {
              const p = Math.floor(i / ROWS_PER_PAGE);
              (acc[p] ||= []).push(r);
              return acc;
            }, [])
            .map((pageRows) => `
              <div class="template-container page">
                <img src="/bgc2.svg" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load bgc2.svg')" />
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                  <col style="width:18.235mm" />
                  <col style="width:20.915mm" />
                  <col style="width:14.741mm" />
                  <col style="width:14.741mm" />
                  <col style="width:35.889mm" />
                  <col style="width:12.778mm" />
                  <col style="width:16.207mm" />
                  <col style="width:14.798mm" />
                  <col style="width:19.462mm" />
                  <col style="width:15.667mm" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-name" style="background-color: #E8CC64;">${r.name || r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" onerror="this.style.display='none'" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td><span class="num">${r.faces}</span></td>
                            <td>${r.price}</td>
                            <td>${r.rent_end_date}</td>
                            <td class="qr-code-cell">${r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener" style="display:block;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(r.mapLink)}" alt="QR Code" style="width:14mm;height:12mm;object-fit:contain;" /></a>` : ''}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `)
            .join('')
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

      // ✅ NEW: Generate concise payment summary for البند الخامس with written currency name
      let paymentsHtml = '';
      if (contractData.payments.length > 0) {
        const finalTotalAmount = contract?.Total || contract?.total_cost || 0;
        const installationEnabled = contract?.installation_enabled !== false && contract?.installation_enabled !== 0 && contract?.installation_enabled !== 'false';
        const installationText = installationEnabled ? 'مع التركيب' : 'غير شامل التركيب';
        const printCostText = printCostEnabled ? 'شاملة تكاليف الطباعة' : 'غير شاملة تكاليف الطباعة';
        const discountText = discountInfo ? ` بعد خصم ${discountInfo.text}` : '';
        
        // ✅ Build concise payment summary
        let paymentSummary = '';
        
        if (contractData.payments.length === 1) {
          // Single payment
          const payment = contractData.payments[0];
          const dueDateText = payment.dueDate ? ` بتاريخ ${payment.dueDate}` : '';
          paymentSummary = `دفعة واحدة: ${payment.amount} ${payment.currencyWrittenName}${dueDateText}`;
        } else {
          // Multiple payments - check if recurring pattern exists
          const firstPayment = contractData.payments[0];
          const recurringPayments = contractData.payments.slice(1);
          
          // Check if all recurring payments have same amount
          const recurringAmount = recurringPayments[0]?.amount || '';
          const allSameAmount = recurringPayments.every(p => p.amount === recurringAmount);
          
          // Check if all recurring payments have same type
          const recurringType = recurringPayments[0]?.paymentType || '';
          const allSameType = recurringPayments.every(p => p.paymentType === recurringType);
          
          if (allSameAmount && allSameType && recurringPayments.length > 0) {
            // Concise format for recurring payments
            const firstDueDateText = firstPayment.dueDate ? ` بتاريخ ${firstPayment.dueDate}` : '';
            const firstRecurringDate = recurringPayments[0]?.dueDate || '';
            const lastRecurringDate = recurringPayments[recurringPayments.length - 1]?.dueDate || '';
            
            paymentSummary = `الدفعة الأولى: ${firstPayment.amount} ${firstPayment.currencyWrittenName}${firstDueDateText}`;
            
            if (recurringPayments.length === 1) {
              const secondDueDateText = firstRecurringDate ? ` بتاريخ ${firstRecurringDate}` : '';
              paymentSummary += `، ودفعة ثانية: ${recurringAmount} ${firstPayment.currencyWrittenName}${secondDueDateText}`;
            } else {
              const startDateText = firstRecurringDate ? ` تبدأ من ${firstRecurringDate}` : '';
              const endDateText = lastRecurringDate ? ` حتى ${lastRecurringDate}` : '';
              paymentSummary += `، بعدها يتم السداد ${recurringType} بمقدار ${recurringAmount} ${firstPayment.currencyWrittenName}${startDateText}${endDateText} (${recurringPayments.length} دفعات)`;
            }
          } else {
            // Non-uniform payments - show first and last only
            const firstDueDateText = firstPayment.dueDate ? ` بتاريخ ${firstPayment.dueDate}` : '';
            const lastPayment = contractData.payments[contractData.payments.length - 1];
            const lastDueDateText = lastPayment.dueDate ? ` بتاريخ ${lastPayment.dueDate}` : '';
            
            paymentSummary = `${contractData.payments.length} دفعات: الأولى ${firstPayment.amount} ${firstPayment.currencyWrittenName}${firstDueDateText}، والأخيرة${lastDueDateText}`;
          }
        }
        
        paymentsHtml = `إجمالي قيمة العقد ${formatArabicNumber(finalTotalAmount)} ${currencyInfo.writtenName} (${installationText}، ${printCostText})${discountText} مقسمة كالتالي: ${paymentSummary}`;
      } else {
        // Fallback for contracts without installments
        const finalTotalAmount = contract?.Total || contract?.total_cost || 0;
        const installationEnabled = contract?.installation_enabled !== false && contract?.installation_enabled !== 0 && contract?.installation_enabled !== 'false';
        const installationText = installationEnabled ? 'مع التركيب' : 'غير شامل التركيب';
        const printCostText = printCostEnabled ? 'شاملة تكاليف الطباعة' : 'غير شاملة تكاليف الطباعة';
        const discountText = discountInfo ? ` بعد خصم ${discountInfo.text}` : '';
        paymentsHtml = `قيمة العقد ${formatArabicNumber(finalTotalAmount)} ${currencyInfo.writtenName} (${installationText}، ${printCostText})${discountText}`;
      }

      // ✅ UPDATED: Generate enhanced PDF title with contract number, ad type, and currency
      const pdfTitle = `عقد ${contractData.contractNumber} - ${contractData.adType} - ${contractData.customerName} (${currencyInfo.name})`;

      // ✅ FIXED: Enhanced HTML content with proper A4 dimensions and layout
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

            /* ✅ FIXED: Proper A4 page setup */
            * { 
              margin: 0 !important; 
              padding: 0 !important; 
              box-sizing: border-box; 
            }
            
            html, body { 
              width: 210mm !important; 
              min-height: 297mm !important; 
              font-family: 'Noto Sans Arabic', 'Doran', 'Arial Unicode MS', Arial, sans-serif; 
              direction: rtl; 
              text-align: right; 
              background: white; 
              color: #000; 
              font-size: 14px;
              line-height: 1.6;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: optimizeLegibility;
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
              page-break-after: always; 
              page-break-inside: avoid;
            }

            /* Enhanced table styling */
            .table-area { 
              position: absolute; 
              top: 63.53mm; 
              left: calc(105mm - 92.1235mm); 
              width: 184.247mm; 
              z-index: 20; 
            }
            
            .btable { 
              width: 100%; 
              border-collapse: collapse; 
              border-spacing: 0; 
              font-size: 8px; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
              table-layout: fixed; 
              border: 0.2mm solid #000; 
            }
            
            .btable tr { 
              height: 13.818mm; 
            }
            
            .btable td { 
              border: 0.2mm solid #000; 
              padding: 0 1mm; 
              vertical-align: middle; 
              text-align: center; 
              background: transparent; 
              color: #000; 
              white-space: normal; 
              word-break: break-word; 
              overflow: hidden; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
            }
            
            /* ✅ تباين الصفوف - رمادي وأبيض */
            .btable tr:nth-child(even) td:not(.c-name) {
              background: #dddddd !important;
            }
            
            .btable tr:nth-child(odd) td:not(.c-name) {
              background: white !important;
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

            /* ✅ FIXED: البند الخامس - positioned correctly with better font rendering */
            .clause-five-text {
              position: absolute;
              left: 20mm;
              right: 13mm;
              top: 193mm;
              z-index: 15;
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif;
              font-size: 13px;
              font-weight: 500;
              color: #000;
              text-align: right;
              direction: rtl;
              line-height: 1.6;
              padding: 2px;
              word-wrap: break-word;
              overflow-wrap: break-word;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: optimizeLegibility;
            }

            /* ✅ FIXED: البند السادس - positioned correctly with better font rendering */
            .clause-six-text {
              position: absolute;
              left: 20mm;
              right: 13mm;
              top: 212mm;
              z-index: 15;
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif;
              font-size: 13px;
              font-weight: 500;
              color: #000;
              text-align: right;
              direction: rtl;
              line-height: 1.6;
              padding: 2px;
              word-wrap: break-word;
              overflow-wrap: break-word;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: optimizeLegibility;
            }

            /* ✅ FIXED: Bold styling for clause headers only */
            .clause-header {
              font-weight: 800 !important;
            }

            /* ✅ FIXED: Normal font weight for rest of the text */
            .clause-content {
              font-weight: 400 !important;
            }

            /* ✅ FIXED: CSS positioning for right-aligned Arabic text */
            .right-aligned-text {
              position: absolute;
              right: 13mm;
              z-index: 15;
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif;
              color: #000;
              text-align: right;
              direction: rtl;
              unicode-bidi: bidi-override;
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
          <div id="loadingMessage" class="loading-message">جاري تحميل العقد...</div>
          
          <div class="template-container page">
            <img src="/bgc1.svg" alt="عقد إيجار لوحات إعلانية" class="template-image" 
                 onerror="console.warn('Failed to load contract template image')" />
            <svg class="overlay-svg" viewBox="0 0 2480 3508" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
              <text x="1750" y="700" font-family="Doran, sans-serif" font-weight="bold" font-size="62" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">عقد إيجار مواقع إعلانية رقم: ${contractData.contractNumber} سنة ${contractData.year}</text>
              <text x="440" y="700" font-family="Doran, sans-serif" font-weight="bold" font-size="62" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">التاريخ: ${contractData.startDate}</text>
              
              <text x="2220" y="1140" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">الطرف الأول:</text>
              <text x="1500" y="1140" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">شركة الفارس الذهبي للدعاية والإعلان، طرابلس – طريق المطار، حي الزهور.</text>
              <text x="1960" y="1200" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">يمثلها السيد جمال أحمد زحيل (المدير العام).</text>
              
              <text x="2250" y="1550" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">المقدمة:</text>
              <text x="1290" y="1550" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">نظرًا لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية:</text>
              <text x="2240" y="1650" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الأول:</text>
              <text x="1190" y="1650" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">يلتزم الطرف الثاني بتجهيز التصميم في أسرع وقت وأي تأخير يعتبر مسؤوليته، وتبدأ مدة العقد من التاريخ</text>
              <text x="2095" y="1725" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">المذكور في المادة السادسة.</text>
              <text x="2230" y="1825" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الثاني:</text>
              <text x="1170" y="1825" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">يلتزم الطرف الأول بتعبئة وتركيب التصاميم بدقة على المساحات المتفق عليها وفق الجدول المرفق، ويتحمل</text>
<text x="1370" y="1900" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
يتحمل الطرف الثاني تكاليف التغيير الناتجة عن الأحوال الجوية الشديدة مثل الأعاصير والعواصف القوية أو الحوادث الطارئة.
</text>

<text x="2230" y="1975" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
البند الثالث:
</text>

<text x="1080" y="1975" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
في حال وقوع ظروف قاهرة تؤثر على إحدى المساحات الإعلانية، يتم نقل الإعلان إلى موقع بديل، ويتحمل الطرف الأول تكلفة النقل ،
</text>

<text x="1250" y="2050" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">

 ويجوز للطرف الثاني المشاركة بجزء من التكاليف حسب الاتفاق، ويتولى الطرف الأول الحصول على الموافقات اللازمة من الجهات ذات العلاقة.
</text>

              <text x="2235" y="2150" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الرابع:</text>
              <text x="1190" y="2150" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">لايجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول، الذي يحتفظ بحق</text>
              <text x="1530" y="2225" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">استغلال المساحات في المناسبات الوطنية والانتخابات مع تعويض الطرف الثاني بفترة بديلة.</text>
              
              <text x="2220" y="2760" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند السابع:</text>
              <text x="1150" y="2760" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">في حال حدوث خلاف بين الطرفين يتم حلّه وديًا، وإذا تعذر ذلك يُعين طرفان محاميان لتسوية النزاع بقرار نهائي</text>
              <text x="2200" y="2820" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">وملزم للطرفين.</text>
            </svg>
            
            <!-- ✅ FIXED: نوع الإعلان with CSS positioning -->
            <div class="right-aligned-text" style="top: 74mm; font-size: 16px; font-weight: bold;">
              نوع الإعلان: ${contractData.adType}
            </div>
            
            <!-- ✅ FIXED: الطرف الثاني with CSS positioning -->
            <div class="right-aligned-text" style="top: 114mm; font-size: 13px; font-weight: bold;">
              الطرف الثاني: ${contractData.customerCompany || contractData.customerName}.
            </div>
            
            <!-- ✅ FIXED: يمثلها with CSS positioning -->
            <div class="right-aligned-text" style="top: 118mm; font-size: 12px;">
              يمثلها السيد ${contractData.customerName} .  رقم الهاتف :( ${contractData.customerPhone || 'غير محدد'})
            </div>
            
            <!-- ✅ FIXED: البند الخامس with print cost status, written currency name, and discount (no duplicate "خصم", NO installation cost) -->
            <div class="clause-five-text">
              <span class="clause-header">البند الخامس :</span> <span class="clause-content">${paymentsHtml}، وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.</span>
            </div>
            
            <!-- ✅ FIXED: البند السادس -->
            <div class="clause-six-text">
              <span class="clause-header">البند السادس:</span> <span class="clause-content">  مدة العقد ${contractData.duration} يومًا تبدأ من ${contractData.startDate} وتنتهي في ${contractData.endDate}، 
    ويجوز تجديده برضى الطرفين قبل انتهائه بمدة لا تقل عن 15 يومًا وفق شروط يتم الاتفاق عليها. 
    تُمنح للطرف الأول فترة لا تتجاوز 15 يومًا من تاريخ بدء العقد لتركيب اللوحات، 
    وفي حال تأخر التركيب عن هذه المدة، يتم تعويض الطرف الثاني عن فترة التأخير بما يعادل المدة التي تأخر فيها التنفيذ..</span>
            </div>
          </div>

          ${tablePagesHtml}

          <script>
            // Enhanced JavaScript with better error handling
            let printAttempts = 0;
            const maxPrintAttempts = 3;
            
            function hideLoadingMessage() {
              const loading = document.getElementById('loadingMessage');
              if (loading) {
                loading.style.display = 'none';
              }
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
                if (printAttempts < maxPrintAttempts) {
                  setTimeout(attemptPrint, 1000);
                }
              }
            }
            
            // Wait for all resources to load
            window.addEventListener('load', function() {
              hideLoadingMessage();
              setTimeout(attemptPrint, 1200);
            });
            
            // Fallback if load event doesn't fire
            setTimeout(function() {
              hideLoadingMessage();
              if (printAttempts === 0) {
                attemptPrint();
              }
            }, 3000);
            
            // Handle image load errors
            document.addEventListener('DOMContentLoaded', function() {
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
      <div><strong>نوع الإعلان:</strong> ${contractData.adType}</div>
      <div><strong>الطرف الثاني:</strong> ${contractData.customerCompany || contractData.customerName}</div>
      <div><strong>يمثلها السيد:</strong> ${contractData.customerName}</div>
      <div><strong>رقم الهاتف:</strong> ${contractData.customerPhone || 'غير محدد'}</div>
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
      ${paymentsHtml}، وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.
      ${printCostText ? `<br><small>(الأسعار ${printCostText})</small>` : ''}
      ${discountText ? `<br><small>${discountText}</small>` : ''}
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
      const year = new Date().getFullYear();
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
        companyName: 'شركة الفارس الذهبي للدعاية والإعلان',
        phoneNumber: '0912612255',
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
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b.Faces_Count ?? b.faces_count ?? '1');
        
        let price = '';
        const historicalPrice = billboardPrices[id];
        if (historicalPrice !== undefined && historicalPrice !== null) {
          const num = Number(historicalPrice);
          if (!isNaN(num) && num > 0) {
            price = `<span style="direction:ltr;display:inline-block;"><span class="num">${formatArabicNumber(num)}</span> <span class="currency">${currencyInfo.symbol}</span></span>`;
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

        let rent_end_date = '';
        if (b.end_date || b['End Date']) {
          try {
            rent_end_date = new Date(b.end_date || b['End Date']).toLocaleDateString('ar-LY');
          } catch (e) {
            rent_end_date = contractDetails.endDate;
          }
        } else {
          rent_end_date = contractDetails.endDate;
        }

        let coords: string = String(b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? '');
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude;
          const lng = b.Longitude ?? b.lng ?? b.longitude;
          if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : (b.GPS_Link || '');
        const name = String(b.Billboard_Name ?? b.name ?? b.code ?? id);

        return { id, name, image, municipality, district, landmark, size, faces, price, rent_end_date, mapLink };
      };

      const normalized = billboardsToShow.map(norm);
      const normalizedWithSizeRank = normalized.map((billboard) => {
        const sizeObj = sizesData.find(sz => sz.name === billboard.size);
        return {
          ...billboard,
          sort_order: sizeObj ? sizeObj.sort_order ?? 999 : 999,
        };
      });
      
      const sortedBillboards = normalizedWithSizeRank.sort((a, b) => a.sort_order - b.sort_order);
      const ROWS_PER_PAGE = 12;
      const tablePagesHtml = sortedBillboards.length
        ? sortedBillboards
            .reduce((acc: any[][], r, i) => {
              const p = Math.floor(i / ROWS_PER_PAGE);
              (acc[p] ||= []).push(r);
              return acc;
            }, [])
            .map((pageRows) => `
              <div class="template-container page">
                <img src="/bgc2.svg" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load bgc2.svg')" />
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                  <col style="width:18.235mm" />
                  <col style="width:20.915mm" />
                  <col style="width:14.741mm" />
                  <col style="width:14.741mm" />
                  <col style="width:35.889mm" />
                  <col style="width:12.778mm" />
                  <col style="width:16.207mm" />
                  <col style="width:14.798mm" />
                  <col style="width:19.462mm" />
                  <col style="width:15.667mm" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-name" style="background-color: #E8CC64;">${r.name || r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" onerror="this.style.display='none'" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td><span class="num">${r.faces}</span></td>
                            <td>${r.price}</td>
                            <td>${r.rent_end_date}</td>
                            <td class="qr-code-cell">${r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener" style="display:block;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(r.mapLink)}" alt="QR Code" style="width:14mm;height:12mm;object-fit:contain;" /></a>` : ''}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
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

      let paymentsHtml = '';
      if (contractData.payments.length > 0) {
        const finalTotalAmount = contract?.Total || contract?.total_cost || 0;
        const installationEnabled = contract?.installation_enabled !== false && contract?.installation_enabled !== 0 && contract?.installation_enabled !== 'false';
        const installationText = installationEnabled ? 'مع التركيب' : 'غير شامل التركيب';
        const printCostText = printCostEnabled ? 'شاملة تكاليف الطباعة' : 'غير شاملة تكاليف الطباعة';
        const discountText = discountInfo ? ` بعد خصم ${discountInfo.text}` : '';
        
        paymentsHtml = `إجمالي قيمة العقد ${formatArabicNumber(finalTotalAmount)} ${currencyInfo.writtenName} (${installationText}، ${printCostText})${discountText}`;
      } else {
        const finalTotalAmount = contract?.Total || contract?.total_cost || 0;
        paymentsHtml = `قيمة العقد ${formatArabicNumber(finalTotalAmount)} ${currencyInfo.writtenName}`;
      }

      // ✅ نفس HTML الذي يستخدمه handlePrintContract (كامل مع كل البنود والخلفية الصحيحة)
      const pdfTitle = `عقد ${contractData.contractNumber} - ${contractData.adType} - ${contractData.customerName} (${currencyInfo.name})`;

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
              top: 63.53mm; 
              left: calc(105mm - 92.1235mm); 
              width: 184.247mm; 
              z-index: 20; 
            }
            
            .btable { 
              width: 100%; 
              border-collapse: collapse; 
              border-spacing: 0; 
              font-size: 8px; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
              table-layout: fixed; 
              border: 0.2mm solid #000; 
            }
            
            .btable tr { 
              height: 13.818mm; 
            }
            
            .btable td { 
              border: 0.2mm solid #000; 
              padding: 0 1mm; 
              vertical-align: middle; 
              text-align: center; 
              background: transparent; 
              color: #000; 
              white-space: normal; 
              word-break: break-word; 
              overflow: hidden; 
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif; 
            }
            
            .btable tr:nth-child(even) td:not(.c-name) {
              background: #dddddd !important;
            }
            
            .btable tr:nth-child(odd) td:not(.c-name) {
              background: white !important;
            }
            
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

            .clause-five-text {
              position: absolute;
              left: 20mm;
              right: 13mm;
              top: 193mm;
              z-index: 15;
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif;
              font-size: 13px;
              font-weight: 500;
              color: #000;
              text-align: right;
              direction: rtl;
              line-height: 1.6;
              padding: 2px;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }

            .clause-six-text {
              position: absolute;
              left: 20mm;
              right: 13mm;
              top: 212mm;
              z-index: 15;
              font-family: 'Doran', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif;
              font-size: 13px;
              font-weight: 500;
              color: #000;
              text-align: right;
              direction: rtl;
              line-height: 1.6;
              padding: 2px;
              word-wrap: break-word;
              overflow-wrap: break-word;
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
            <img src="/bgc1.svg" alt="عقد إيجار لوحات إعلانية" class="template-image" 
                 onerror="console.warn('Failed to load contract template image')" />
            <svg class="overlay-svg" viewBox="0 0 2480 3508" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
              <text x="1750" y="700" font-family="Doran, sans-serif" font-weight="bold" font-size="62" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">عقد إيجار مواقع إعلانية رقم: ${contractData.contractNumber} سنة ${contractData.year}</text>
              <text x="440" y="700" font-family="Doran, sans-serif" font-weight="bold" font-size="62" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">التاريخ: ${contractData.startDate}</text>
              
              <text x="2220" y="1140" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">الطرف الأول:</text>
              <text x="1500" y="1140" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">شركة الفارس الذهبي للدعاية والإعلان، طرابلس – طريق المطار، حي الزهور.</text>
              <text x="1960" y="1200" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">يمثلها السيد جمال أحمد زحيل (المدير العام).</text>
              
              <text x="2250" y="1550" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">المقدمة:</text>
              <text x="1290" y="1550" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">نظرًا لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية:</text>
              <text x="2240" y="1650" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الأول:</text>
              <text x="1190" y="1650" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">يلتزم الطرف الثاني بتجهيز التصميم في أسرع وقت وأي تأخير يعتبر مسؤوليته، وتبدأ مدة العقد من التاريخ</text>
              <text x="2095" y="1725" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">المذكور في المادة السادسة.</text>
              <text x="2230" y="1825" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الثاني:</text>
              <text x="1170" y="1825" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">يلتزم الطرف الأول بتعبئة وتركيب التصاميم بدقة على المساحات المتفق عليها وفق الجدول المرفق، ويتحمل</text>
<text x="1850" y="1900" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
يتحمل الطرف الأخير تكاليف التغيير الناتجة عن الأحوال الجوية الشديدة مثل الأعاصير والعواصف القوية أو الحوادث الطارئة.
</text>

<text x="2225" y="1975" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
البند الثالث:
</text>

<text x="1240" y="1975" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">
في حال وقوع ظروف قاهرة تؤثر على إحدى المساحات الإعلانية، يتم نقل الإعلان إلى موقع بديل، ويتحمل الطرف الأول تكلفة النقل، 
ويجوز للطرف الثاني المشاركة بجزء من التكاليف حسب الاتفاق بين الطرفين.
</text>
              <text x="1890" y="2050" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">الحصول على الموافقات اللازمة من الجهات ذات العلاقة.</text>
              <text x="2235" y="2150" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الرابع:</text>
              <text x="1190" y="2150" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">لايجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول، الذي يحتفظ بحق</text>
              <text x="1530" y="2225" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">استغلال المساحات في المناسبات الوطنية والانتخابات مع تعويض الطرف الثاني بفترة بديلة.</text>
              
              <text x="2220" y="2760" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند السابع:</text>
              <text x="1150" y="2760" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">في حال حدوث خلاف بين الطرفين يتم حلّه وديًا، وإذا تعذر ذلك يُعين طرفان محاميان لتسوية النزاع بقرار نهائي</text>
              <text x="2200" y="2820" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">وملزم للطرفين.</text>
            </svg>
            
            <div class="right-aligned-text" style="top: 74mm; font-size: 16px; font-weight: bold;">
              نوع الإعلان: ${contractData.adType}
            </div>
            
            <div class="right-aligned-text" style="top: 114mm; font-size: 13px; font-weight: bold;">
              الطرف الثاني: ${contractData.customerCompany || contractData.customerName}.
            </div>
            
            <div class="right-aligned-text" style="top: 118mm; font-size: 12px;">
              يمثلها السيد ${contractData.customerName} .  رقم الهاتف :( ${contractData.customerPhone || 'غير محدد'})
            </div>
            
            <div class="clause-five-text">
              <span class="clause-header">البند الخامس :</span> <span class="clause-content">${paymentsHtml}، وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.</span>
            </div>
            
<div class="clause-six-text">
  <span class="clause-header">البند السادس:</span>
  <span class="clause-content">
    مدة العقد ${contractData.duration} يومًا تبدأ من ${contractData.startDate} وتنتهي في ${contractData.endDate}، 
    ويجوز تجديده برضى الطرفين قبل انتهائه بمدة لا تقل عن 15 يومًا وفق شروط يتم الاتفاق عليها.  
    تمنح للطرف الأول فترة لا تتجاوز 15 يومًا من تاريخ بدء العقد لتركيب اللوحات، 
    وفي حال تأخر التركيب عن هذه المدة، يتم تعويض الطرف الثاني عن فترة التأخير بما يعادل المدة التي تأخر فيها التنفيذ.
  </span>
</div>
            </div>
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


  const contractDetails = calculateContractDetails();
  const paymentInstallments = getPaymentInstallments();
  const currencyInfo = getCurrencyInfo();
  const discountInfo = getDiscountInfo();

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="expenses-dialog-content">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle>طباعة العقد مع نظام العملات المتعددة</UIDialog.DialogTitle>
          <UIDialog.DialogClose className="absolute left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">إغلاق</span>
          </UIDialog.DialogClose>
        </UIDialog.DialogHeader>
        
  {/* Inline preview fonts: Doran for Arabic body, Manrope for numeric fields */}
  <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap'); .num { font-family: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial !important; font-variant-numeric: tabular-nums; font-weight:700; direction:ltr; display:inline-block; text-align:left;} .currency { font-family: 'Doran', 'Noto Sans Arabic', Arial, sans-serif !important; color:#000; font-weight:700; margin-left:6px; display:inline-block;} .preview-arabic { font-family: 'Doran', 'Noto Sans Arabic', Arial, sans-serif !important; }`}</style>
  <div className="space-y-6">
          {isGenerating ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-semibold">جاري تحضير العقد للطباعة...</p>
              <p className="text-sm text-gray-600 mt-2">يتم تحميل بيانات العميل وتحضير التخطيط مع الدفعات</p>
            </div>
          ) : (
            <>
              {/* ✅ UPDATED: Better color scheme */}
              <div className="bg-gradient-to-br from-card to-primary/10 p-4 rounded-lg border border-primary/30">
                <div className="flex items-center gap-3">
                  <div className="text-2xl text-primary">{currencyInfo.symbol}</div>
                  <div>
                    <div className="font-semibold text-primary">عملة العقد: {currencyInfo.name}</div>
                    <div className="text-sm text-muted-foreground">
                      جميع المبالغ ستظهر بكلمة "{currencyInfo.writtenName}" في العقد المطبوع
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-card/80 backdrop-blur-sm p-4 rounded-lg border border-primary/20">
                <h3 className="font-semibold mb-2 text-primary">معاينة بيانات العقد:</h3>
                <div className="text-sm space-y-1">
                  <p><strong>رقم العقد:</strong> {contract?.id || contract?.Contract_Number || 'غير محدد'}</p>
                  <p><strong>العميل:</strong> {customerData?.name || 'غير محدد'}</p>
                  {customerData?.company && (
                    <p><strong>الشركة:</strong> {customerData.company}</p>
                  )}
                  {customerData?.phone && (
                    <p><strong>الهاتف:</strong> {customerData.phone}</p>
                  )}
                  <div className="flex justify-between py-4 text-xl font-bold bg-primary text-primary-foreground px-6 rounded-lg mt-4">
                    <span>المجموع الإجمالي:</span>
                    <span className="text-primary-glow"><span style={{direction:'ltr', display:'inline-block'}}><span className="grand-num">{contractDetails.finalTotal}</span> <span className="currency">{currencyInfo.symbol}</span></span></span>
                  </div>
                  <p className="preview-arabic mt-3"><strong>سعر الإيجار:</strong> <span style={{direction:'ltr', display:'inline-block'}}><span className="num">{contractDetails.rentalCost}</span> <span className="currency">{currencyInfo.symbol}</span></span></p>
                  {/* ✅ REMOVED: Installation cost display as requested */}
                  {/* ✅ FIXED: Show discount if exists (no duplicate "خصم") */}
                  {discountInfo && (
                    <p><strong>الخصم:</strong> 
                      <span className="ml-2 px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                        {discountInfo.text}
                      </span>
                    </p>
                  )}
                  {/* ✅ FIXED: Show print cost status correctly - read from database */}
                  <p><strong>تكلفة الطباعة:</strong> 
                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
                      (contract?.print_cost_enabled === true || contract?.print_cost_enabled === 1 || contract?.print_cost_enabled === "true" || contract?.print_cost_enabled === "1")
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {(contract?.print_cost_enabled === true || contract?.print_cost_enabled === 1 || contract?.print_cost_enabled === "true" || contract?.print_cost_enabled === "1") ? 'مفعلة' : 'غير مفعلة'}
                    </span>
                  </p>
                  {/* ✅ NEW: Show installation status */}
                  <p><strong>تكلفة التركيب:</strong> 
                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
                      (contract?.installation_enabled === true || contract?.installation_enabled === 1 || contract?.installation_enabled === "true" || contract?.installation_enabled === "1")
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {(contract?.installation_enabled === true || contract?.installation_enabled === 1 || contract?.installation_enabled === "true" || contract?.installation_enabled === "1") ? 'مفعلة' : 'غير مفعلة'}
                    </span>
                  </p>
                  <p><strong>مدة العقد:</strong> {contractDetails.duration} يوم</p>
                  <p><strong>تاريخ البداية:</strong> {contractDetails.startDate}</p>
                  <p><strong>تاريخ النهاية:</strong> {contractDetails.endDate}</p>
                  {paymentInstallments.length > 0 && (
                    <div>
                      <strong>الدفعات ({paymentInstallments.length}):</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {paymentInstallments.map((payment, index) => (
                          <li key={index} className="text-xs">
                            {payment.description}: {payment.amount} {payment.currencyWrittenName}
                            {payment.dueDate && <span className="text-muted-foreground"> - استحقاق: {payment.dueDate}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* ✅ FIXED: Print cost status indicator with NO WHITE BACKGROUND */}
              <div className={`p-4 rounded-lg border shadow-md ${
                (contract?.print_cost_enabled === true || contract?.print_cost_enabled === 1 || contract?.print_cost_enabled === "true" || contract?.print_cost_enabled === "1")
                  ? 'bg-gradient-to-br from-card to-primary/10 border-primary/30' 
                  : 'bg-gradient-to-br from-card to-muted/20 border-muted/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full shadow-sm ${
                    (contract?.print_cost_enabled === true || contract?.print_cost_enabled === 1 || contract?.print_cost_enabled === "true" || contract?.print_cost_enabled === "1") ? 'bg-primary' : 'bg-muted-foreground'
                  }`}></div>
                  <span className="font-medium text-sm text-foreground">
                    العقد سيطبع مع النص: "{(contract?.print_cost_enabled === true || contract?.print_cost_enabled === 1 || contract?.print_cost_enabled === "true" || contract?.print_cost_enabled === "1") ? 'شاملة تكاليف الطباعة' : 'غير شاملة تكاليف الطباعة'}"
                  </span>
                </div>
                {(contract?.print_cost_enabled === true || contract?.print_cost_enabled === 1 || contract?.print_cost_enabled === "true" || contract?.print_cost_enabled === "1") && contract?.print_price_per_meter && (
                  <p className="text-xs text-muted-foreground mt-2 mr-7">
                    سعر متر الطباعة: <span style={{direction:'ltr', display:'inline-block'}}><span className="num">{contract.print_price_per_meter}</span> <span className="currency">{currencyInfo.symbol}</span></span>
                  </p>
                )}
                {/* ✅ FIXED: Show discount info if exists (no duplicate "خصم") */}
                {discountInfo && (
                  <p className="text-xs text-primary mt-2 mr-7">
                    ✅ سيتم تطبيق خصم {discountInfo.text} في العقد والفاتورة
                  </p>
                )}
              </div>

              {/* ✅ NEW: Installation cost status indicator */}
              <div className={`p-4 rounded-lg border shadow-md ${
                (contract?.installation_enabled === true || contract?.installation_enabled === 1 || contract?.installation_enabled === "true" || contract?.installation_enabled === "1")
                  ? 'bg-gradient-to-br from-card to-primary/10 border-primary/30' 
                  : 'bg-gradient-to-br from-card to-muted/20 border-muted/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full shadow-sm ${
                    (contract?.installation_enabled === true || contract?.installation_enabled === 1 || contract?.installation_enabled === "true" || contract?.installation_enabled === "1") ? 'bg-primary' : 'bg-muted-foreground'
                  }`}></div>
                  <span className="font-medium text-sm text-foreground">
                    {(contract?.installation_enabled === true || contract?.installation_enabled === 1 || contract?.installation_enabled === "true" || contract?.installation_enabled === "1") 
                      ? 'التركيب مفعل ومشمول في العقد' 
                      : 'العقد سيطبع مع النص: "غير شامل التركيب"'}
                  </span>
                </div>
                {(contract?.installation_enabled === true || contract?.installation_enabled === 1 || contract?.installation_enabled === "true" || contract?.installation_enabled === "1") && contract?.installation_cost && (
                  <p className="text-xs text-muted-foreground mt-2 mr-7">
                    تكلفة التركيب: <span style={{direction:'ltr', display:'inline-block'}}><span className="num">{formatArabicNumber(Number(contract.installation_cost))}</span> <span className="currency">{currencyInfo.symbol}</span></span>
                  </p>
                )}
              </div>

              {/* Print mode selection */}
              <div className="bg-gradient-to-br from-card to-primary/10 p-4 rounded-lg border border-primary/30">
                <h4 className="font-medium mb-3 text-primary">خيارات الطباعة:</h4>
                <div className="space-y-3">
                    <label className="flex items-center space-x-3 space-x-reverse cursor-pointer">
                    <input 
                      type="radio" 
                      name="printMode" 
                      value="auto" 
                      checked={printMode === 'auto'} 
                      onChange={(e) => setPrintMode(e.target.value as 'auto')}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm">طباعة تلقائية (يفتح نافذة الطباعة مباشرة)</span>
                  </label>
                  <label className="flex items-center space-x-3 space-x-reverse cursor-pointer">
                    <input 
                      type="radio" 
                      name="printMode" 
                      value="manual" 
                      checked={printMode === 'manual'} 
                      onChange={(e) => setPrintMode(e.target.value as 'manual')}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm">طباعة يدوية (معاينة أولاً)</span>
                  </label>
                </div>
              </div>

              {/* ✅ FIXED: Button section with clear labels and preview buttons */}
              <div className="flex flex-col gap-3">
                {/* Invoice buttons - separate row */}
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button 
                    onClick={handlePrintInvoice}
                    className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary text-primary-foreground flex-1 shadow-lg hover:shadow-xl transition-all duration-300"
                    disabled={isGenerating || sendingWhatsApp}
                  >
                    <Printer className="h-4 w-4 ml-2" />
                    طباعة فاتورة العقد
                  </Button>
                  
                  <Button 
                    onClick={handlePreviewInvoice}
                    variant="outline"
                    className="border-primary/30 hover:bg-primary/10"
                    disabled={isGenerating || sendingWhatsApp}
                  >
                    <Eye className="h-4 w-4 ml-2" />
                    معاينة الفاتورة
                  </Button>
                  
                  <Button 
                    onClick={handleDownloadInvoicePDF}
                    variant="outline"
                    className="border-primary/30 hover:bg-primary/10"
                    disabled={isGenerating || sendingWhatsApp}
                  >
                    <Download className="h-4 w-4 ml-2" />
                    {isGenerating ? 'جاري التحميل...' : 'تحميل فاتورة PDF'}
                  </Button>
                  
                  <Button 
                    onClick={handleSendInvoiceWhatsApp}
                    variant="outline"
                    className="border-primary/30 hover:bg-primary/10"
                    disabled={isGenerating || sendingWhatsApp || !customerData?.phone}
                    title={!customerData?.phone ? 'لا يوجد رقم هاتف للزبون' : 'إرسال الفاتورة عبر واتساب'}
                  >
                    <Send className="h-4 w-4 ml-2" />
                    إرسال فاتورة
                  </Button>
                </div>
                
                {/* Contract buttons row */}
                <div className="flex gap-2 justify-end flex-wrap">
                  <Button 
                    variant="outline" 
                    onClick={() => onOpenChange(false)}
                    className="border-primary/30 hover:bg-primary/10"
                  >
                    إغلاق
                  </Button>
                  <Button 
                    onClick={handlePrintContract}
                    className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
                    disabled={isGenerating || sendingWhatsApp}
                  >
                    <Printer className="h-4 w-4 ml-2" />
                    {printMode === 'auto' ? 'طباعة العقد' : 'معاينة العقد'}
                  </Button>
                  
                  <Button 
                    onClick={handlePreviewContract}
                    variant="outline"
                    className="border-primary/30 hover:bg-primary/10"
                    disabled={isGenerating || sendingWhatsApp}
                  >
                    <Eye className="h-4 w-4 ml-2" />
                    معاينة العقد
                  </Button>
                  
                  <Button 
                    onClick={handleDownloadContractPDF}
                    variant="outline"
                    className="border-primary/30 hover:bg-primary/10"
                    disabled={isGenerating || sendingWhatsApp}
                  >
                    <Download className="h-4 w-4 ml-2" />
                    {isGenerating ? 'جاري التحميل...' : 'تحميل عقد PDF'}
                  </Button>
                  
                  <Button 
                    onClick={handleSendContractWhatsApp}
                    variant="outline"
                    className="border-primary/30 hover:bg-primary/10"
                    disabled={isGenerating || sendingWhatsApp || !customerData?.phone}
                    title={!customerData?.phone ? 'لا يوجد رقم هاتف للزبون' : 'إرسال العقد عبر واتساب'}
                  >
                    <Send className="h-4 w-4 ml-2" />
                    إرسال عقد
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </UIDialog.DialogContent>

      {/* ✅ NEW: Preview Dialog */}
      <UIDialog.Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <UIDialog.DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <div className="flex flex-col h-[95vh]">
            <div className="flex items-center justify-between p-4 border-b bg-card">
              <h3 className="text-lg font-bold">{previewTitle}</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(previewHTML);
                      printWindow.document.close();
                      printWindow.focus();
                      printWindow.print();
                    }
                  }}
                >
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-muted p-4">
              <div className="mx-auto bg-white shadow-2xl" style={{ width: '210mm', minHeight: '297mm' }}>
                <iframe
                  srcDoc={previewHTML}
                  className="w-full border-0"
                  style={{ height: '297mm' }}
                  title="PDF Preview"
                />
              </div>
            </div>
          </div>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>
    </UIDialog.Dialog>
  );
}