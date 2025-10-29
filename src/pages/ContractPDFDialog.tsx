import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Printer, X } from 'lucide-react';

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
              top: 199mm;
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
              top: 217mm;
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
              
              <text x="2250" y="1630" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">المقدمة:</text>
              <text x="1290" y="1630" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">نظرًا لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية:</text>
              <text x="2240" y="1715" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الأول:</text>
              <text x="1190" y="1715" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">يلتزم الطرف الثاني بتجهيز التصميم في أسرع وقت وأي تأخير يعتبر مسؤوليته، وتبدأ مدة العقد من التاريخ</text>
              <text x="2095" y="1775" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">المذكور في المادة السادسة.</text>
              <text x="2230" y="1890" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الثاني:</text>
              <text x="1170" y="1890" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">يلتزم الطرف الأول بتعبئة وتركيب التصاميم بدقة على المساحات المتفق عليها وفق الجدول المرفق، ويتحمل</text>
              <text x="1850" y="1950" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">الأخير تكاليف التغيير الناتجة عن الأحوال الجوية أو الحوادث.</text>
              <text x="2225" y="2065" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الثالث:</text>
              <text x="1240" y="2065" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">في حال وقوع ظروف قاهرة تؤثر على إحدى المساحات، يتم نقل الإعلان إلى موقع بديل، ويتولى الطرف الأول</text>
              <text x="1890" y="2125" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">الحصول على الموافقات اللازمة من الجهات ذات العلاقة.</text>
              <text x="2235" y="2240" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الرابع:</text>
              <text x="1190" y="2240" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">لايجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول، الذي يحتفظ بحق</text>
              <text x="1530" y="2300" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">استغلال المساحات في المناسبات الوطنية والانتخابات مع تعويض الطرف الثاني بفترة بديلة.</text>
              
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
              <span class="clause-header">البند السادس:</span> <span class="clause-content">مدة العقد ${contractData.duration} يومًا تبدأ من ${contractData.startDate} وتنتهي في ${contractData.endDate}، ويجوز تجديده برضى الطرفين قبل انتهائه بمدة لا تقل عن 15 يومًا وفق شروط يتم الاتفاق عليها.</span>
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

              {/* ✅ FIXED: Button section with proper layout */}
              <div className="flex flex-col gap-3">
                {/* Invoice print button - separate row */}
                <div className="flex justify-center">
                  <Button 
                    onClick={handlePrintInvoice}
                    className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary text-primary-foreground w-full shadow-lg hover:shadow-xl transition-all duration-300"
                    disabled={isGenerating}
                  >
                    <Printer className="h-4 w-4 ml-2" />
                    طباعة فاتورة العقد
                  </Button>
                </div>
                
                {/* Original buttons row */}
                <div className="flex gap-2 justify-end">
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
                    disabled={isGenerating}
                  >
                    <Printer className="h-4 w-4 ml-2" />
                    {printMode === 'auto' ? 'طباعة تلقائية' : 'معاينة وطباعة'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}