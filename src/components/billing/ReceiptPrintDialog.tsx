import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Printer, X, Receipt } from 'lucide-react';

interface ReceiptPrintDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payment: any;
  customerName: string;
}

// ✅ العملات المدعومة
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', writtenName: 'دولار أمريكي' },
  { code: 'EUR', name: 'يورو', symbol: '€', writtenName: 'يورو' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£', writtenName: 'جنيه إسترليني' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', writtenName: 'ريال سعودي' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', writtenName: 'درهم إماراتي' },
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

export default function ReceiptPrintDialog({ open, onOpenChange, payment, customerName }: ReceiptPrintDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCollectionDetails, setShowCollectionDetails] = useState(false);
  const [customerData, setCustomerData] = useState<{
    name: string;
    company: string | null;
    phone: string | null;
  } | null>(null);

  // ✅ الحصول على معلومات العملة
  const getCurrencyInfo = () => {
    const currencyCode = payment?.currency || 'LYD';
    const currency = CURRENCIES.find(c => c.code === currencyCode);
    return {
      code: currencyCode,
      symbol: currency?.symbol || 'د.ل',
      name: currency?.name || 'دينار ليبي',
      writtenName: currency?.writtenName || 'دينار ليبي'
    };
  };

  // ✅ تحميل بيانات العميل
  const loadCustomerData = async () => {
    try {
      const customerId = payment?.customer_id;
      
      if (customerId) {
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
      
      // استخدام اسم العميل المرسل
      setCustomerData({
        name: customerName,
        company: null,
        phone: null
      });
      
    } catch (error) {
      console.error('Error loading customer data:', error);
      setCustomerData({
        name: customerName,
        company: null,
        phone: null
      });
    }
  };

  useEffect(() => {
    if (open && payment) {
      loadCustomerData();
    }
  }, [open, payment]);

  // ✅ حساب المتبقي من الديون في وقت الدفعة (وليس الوقت الحالي)
  const calculateRemainingBalance = async () => {
    try {
      const customerId = payment?.customer_id;
      if (!customerId) return null;

      // تاريخ الدفعة الحالية
      const paymentDate = payment?.paid_at ? new Date(payment.paid_at) : new Date();

      // جميع الدفعات حتى تاريخ هذه الدفعة (بما فيها)
      const { data: allPayments } = await supabase
        .from('customer_payments')
        .select('*')
        .eq('customer_id', customerId)
        .lte('paid_at', paymentDate.toISOString());

      // العقود
      const { data: contracts } = await supabase
        .from('Contract')
        .select('Contract_Number, Total')
        .eq('customer_id', customerId);

      // فواتير المبيعات حتى تاريخ الدفعة
      const { data: salesInvoices } = await supabase
        .from('sales_invoices')
        .select('total_amount, invoice_date')
        .eq('customer_id', customerId)
        .lte('invoice_date', paymentDate.toISOString().split('T')[0]);

      // فواتير الطباعة حتى تاريخ الدفعة
      const { data: printedInvoices } = await supabase
        .from('printed_invoices')
        .select('total_amount, print_cost, invoice_date')
        .eq('customer_id', customerId)
        .lte('invoice_date', paymentDate.toISOString().split('T')[0]);

      // الخصومات النشطة حتى تاريخ الدفعة
      const { data: discounts } = await supabase
        .from('customer_general_discounts')
        .select('discount_value, applied_date')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .lte('applied_date', paymentDate.toISOString().split('T')[0]);
      const totalDiscounts = (discounts || []).reduce((sum, d: any) => sum + (Number(d.discount_value) || 0), 0);

      // المشتريات حتى تاريخ الدفعة
      const { data: purchaseInvoices } = await supabase
        .from('purchase_invoices')
        .select('total_amount, used_as_payment, purchase_date')
        .eq('customer_id', customerId)
        .lte('purchase_date', paymentDate.toISOString().split('T')[0]);

      // استخدام الدالة الموحدة
      const { calculateTotalRemainingDebt } = await import('./BillingUtils');
      const remainingBalance = calculateTotalRemainingDebt(
        (contracts || []) as any[],
        (allPayments || []) as any[],
        salesInvoices || [],
        printedInvoices || [],
        purchaseInvoices || [],
        totalDiscounts
      );

      return {
        remainingBalance
      };
    } catch (error) {
      console.error('Error calculating general debt:', error);
      return null;
    }
  };

  // ✅ طباعة الإيصال
  const handlePrintReceipt = async () => {
    if (!payment || !customerData) {
      toast.error('لا توجد بيانات دفعة أو عميل للطباعة');
      return;
    }

    setIsGenerating(true);
    
    try {
      // فحص النوافذ المنبثقة
      const testWindow = window.open('', '_blank', 'width=1,height=1');
      if (!testWindow || testWindow.closed || typeof testWindow.closed === 'undefined') {
        toast.error('يرجى السماح بالنوافذ المنبثقة في المتصفح لتمكين الطباعة');
        setIsGenerating(false);
        return;
      }
      testWindow.close();

      // حساب الرصيد المتبقي
      const balanceInfo = await calculateRemainingBalance();

      const currencyInfo = getCurrencyInfo();
      const receiptDate = new Date().toLocaleDateString('ar-LY');
      const receiptNumber = `REC-${Date.now()}`;
      
      // تنسيق تاريخ الدفعة
      const paymentDate = payment.paid_at 
        ? new Date(payment.paid_at).toLocaleDateString('ar-LY')
        : receiptDate;

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>إيصال استلام رقم ${receiptNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            html, body {
              width: 210mm;
              height: 297mm;
              font-family: 'Noto Sans Arabic', Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: white;
              color: #000;
              font-size: 11px;
              line-height: 1.3;
              overflow: hidden;
            }
            
            .receipt-container {
              width: 210mm;
              height: 297mm;
              padding: 12mm;
              display: flex;
              flex-direction: column;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 20px;
              border-bottom: 2px solid #000;
              padding-bottom: 15px;
            }
            
            .receipt-info {
              text-align: left;
              direction: ltr;
              order: 2;
            }
            
            .receipt-title {
              font-size: 24px;
              font-weight: bold;
              color: #000;
              margin-bottom: 8px;
            }
            
            .receipt-details {
              font-size: 11px;
              color: #666;
              line-height: 1.5;
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
              padding: 15px;
              border-radius: 0;
              margin-bottom: 18px;
              border-right: 4px solid #000;
            }
            
            .customer-title {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 8px;
              color: #000;
            }
            
            .customer-details {
              font-size: 12px;
              line-height: 1.5;
            }
            
            .payment-details {
              background: #f8f9fa;
              padding: 18px;
              border-radius: 8px;
              margin-bottom: 18px;
              border: 2px solid #000;
            }
            
            .payment-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 12px;
              color: #000;
              text-align: center;
            }
            
            .payment-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              font-size: 12px;
            }
            
            .payment-info div {
              padding: 8px;
              background: white;
              border-radius: 4px;
              border: 1px solid #ddd;
            }
            
            .payment-info strong {
              color: #000;
              font-weight: bold;
            }
            
            .amount-section {
              margin-top: 18px;
              border-top: 2px solid #000;
              padding-top: 15px;
            }
            
            .amount-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 12px 0;
              font-size: 20px;
              font-weight: bold;
              background: #000;
              color: white;
              padding: 18px;
              border-radius: 0;
              margin-top: 12px;
            }
            
            .currency {
              font-weight: bold;
              color: #FFD700;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
            }
            
            .amount-words {
              margin-top: 12px;
              font-size: 12px;
              color: #666;
              text-align: center;
              font-style: italic;
            }
            
            .footer {
              margin-top: auto;
              text-align: center;
              font-size: 11px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }
            
            .signature-section {
              margin-top: 25px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            
            .signature-box {
              text-align: center;
              border-top: 2px solid #000;
              padding-top: 8px;
              min-width: 120px;
            }
            
            .signature-name {
              margin-top: 8px;
              font-size: 12px;
              color: #666;
              font-weight: normal;
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
              
              .receipt-container {
                width: 210mm !important;
                height: 297mm !important;
                padding: 12mm !important;
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
          <div class="receipt-container">
            <div class="header">
              <div class="company-info">
                <img src="/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
                <div class="company-details">
                  طرابلس – طريق المطار، حي الزهور<br>
                  هاتف: 0912612255
                </div>
              </div>
              
              <div class="receipt-info">
                <div class="receipt-title">إيصال استلام</div>
                <div class="receipt-details">
                  رقم الإيصال: ${receiptNumber}<br>
                  التاريخ: ${receiptDate}<br>
                  العملة: ${currencyInfo.name}
                </div>
              </div>
            </div>
            
            <div class="payment-details">
              <div class="payment-title">بيانات عملية التحصيل والتسليم</div>
              <div class="payment-info">
                ${showCollectionDetails ? `
                <div>
                  <strong>المحصل (المستلم من الزبون):</strong><br>
                  ${payment.collector_name || 'غير محدد'}
                </div>
                <div>
                  <strong>المسلم له (المدير):</strong><br>
                  ${payment.receiver_name || 'غير محدد'}
                </div>
                <div>
                  <strong>مكان التسليم:</strong><br>
                  ${payment.delivery_location || 'غير محدد'}
                </div>
                <div>
                  <strong>نوع الدفع:</strong><br>
                  ${payment.method || 'نقدي'}
                </div>
                ` : `
                <div>
                  <strong>طريقة الدفع:</strong><br>
                  ${payment.method || 'نقدي'}
                </div>
                `}
              </div>
            </div>
            
            <div class="customer-info">
              <div class="customer-title">بيانات العميل</div>
              <div class="customer-details">
                <strong>الاسم:</strong> ${customerData.name}<br>
                ${customerData.company ? `<strong>الشركة:</strong> ${customerData.company}<br>` : ''}
                ${customerData.phone ? `<strong>الهاتف:</strong> ${customerData.phone}<br>` : ''}
              </div>
            </div>
            
            <div class="payment-details">
              <div class="payment-title">تفاصيل الدفعة</div>
              <div class="payment-info">
                <div>
                  <strong>تاريخ الدفعة:</strong><br>
                  ${paymentDate}
                </div>
                <div>
                  <strong>رقم العقد:</strong><br>
                  ${payment.contract_number || 'غير محدد'}
                </div>
                ${payment.reference ? `
                <div>
                  <strong>المرجع / رقم الشيك:</strong><br>
                  ${payment.reference}
                </div>
                ` : ''}
                ${payment.notes ? `
                <div style="grid-column: 1 / -1;">
                  <strong>ملاحظات:</strong><br>
                  ${payment.notes}
                </div>
                ` : ''}
              </div>
            </div>
            
            <div class="amount-section">
              <div class="amount-row">
                <span>المبلغ المستلم:</span>
                <span class="currency">${currencyInfo.symbol} ${formatArabicNumber(payment.amount || 0)}</span>
              </div>
              
              ${balanceInfo ? `
              <div class="amount-row" style="background: ${balanceInfo.remainingBalance > 0 ? '#7f1d1d' : '#065f46'}; margin-top: 15px;">
                <span>المتبقي من إجمالي الديون:</span>
                <span class="currency">${currencyInfo.symbol} ${formatArabicNumber(Math.abs(balanceInfo.remainingBalance))}${balanceInfo.remainingBalance < 0 ? ' (رصيد دائن)' : balanceInfo.remainingBalance === 0 ? ' (مسدد بالكامل)' : ''}</span>
              </div>
              ` : ''}
              
              <div class="amount-words">
                المبلغ بالكلمات: ${formatArabicNumber(payment.amount || 0)} ${currencyInfo.writtenName}
              </div>
            </div>
            
            <div class="signature-section">
              <div class="signature-box">
                <div>توقيع المستلم</div>
                <div class="signature-name">${customerData.name}</div>
              </div>
              <div class="signature-box">
                <div>توقيع المسلم</div>
                <div class="signature-name">شركة فارس للدعاية والإعلان</div>
              </div>
            </div>
            
            <div class="footer">
              شكراً لتعاملكم معنا | Thank you for your business<br>
              هذا إيصال إلكتروني ولا يحتاج إلى ختم أو توقيع إضافي
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

      // فتح نافذة الطباعة
      const windowFeatures = 'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no';
      const printWindow = window.open('', '_blank', windowFeatures);

      if (!printWindow) {
        throw new Error('فشل في فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح والسماح بالنوافذ المنبثقة.');
      }

      printWindow.document.title = `إيصال_استلام_${customerData.name}_${receiptNumber}`;
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      toast.success(`تم فتح الإيصال للطباعة بنجاح بعملة ${currencyInfo.name}!`);
      onOpenChange(false);

    } catch (error) {
      console.error('Error in handlePrintReceipt:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير الإيصال للطباعة: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const currencyInfo = getCurrencyInfo();

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="expenses-dialog-content">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            طباعة إيصال الاستلام
          </UIDialog.DialogTitle>
          <UIDialog.DialogClose className="absolute left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">إغلاق</span>
          </UIDialog.DialogClose>
        </UIDialog.DialogHeader>
        
        <div className="space-y-6">
          {isGenerating ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-semibold">جاري تحضير الإيصال للطباعة...</p>
              <p className="text-sm text-gray-600 mt-2">يتم تحميل بيانات العميل وتحضير التخطيط</p>
            </div>
          ) : (
            <>
              {/* معلومات العملة */}
              <div className="bg-gradient-to-br from-card to-primary/10 p-4 rounded-lg border border-primary/30">
                <div className="flex items-center gap-3">
                  <div className="text-2xl text-primary">{currencyInfo.symbol}</div>
                  <div>
                    <div className="font-semibold text-primary">عملة الدفعة: {currencyInfo.name}</div>
                    <div className="text-sm text-muted-foreground">
                      المبلغ سيظهر بكلمة "{currencyInfo.writtenName}" في الإيصال المطبوع
                    </div>
                  </div>
                </div>
              </div>

              {/* معاينة بيانات الإيصال */}
              <div className="bg-card/80 backdrop-blur-sm p-4 rounded-lg border border-primary/20">
                <h3 className="font-semibold mb-2 text-primary">معاينة بيانات الإيصال:</h3>
                <div className="text-sm space-y-1">
                  <p><strong>العميل:</strong> {customerData?.name || 'غير محدد'}</p>
                  {customerData?.company && (
                    <p><strong>الشركة:</strong> {customerData.company}</p>
                  )}
                  {customerData?.phone && (
                    <p><strong>الهاتف:</strong> {customerData.phone}</p>
                  )}
                  <p><strong>المبلغ:</strong> {formatArabicNumber(payment?.amount || 0)} {currencyInfo.symbol}</p>
                  <p><strong>طريقة الدفع:</strong> {payment?.method || 'نقدي'}</p>
                  <p><strong>تاريخ الدفعة:</strong> {payment?.paid_at 
                    ? new Date(payment.paid_at).toLocaleDateString('ar-LY')
                    : new Date().toLocaleDateString('ar-LY')}</p>
                  {payment?.contract_id && (
                    <p><strong>رقم العقد:</strong> {payment.contract_id}</p>
                  )}
                  {payment?.notes && (
                    <p><strong>ملاحظات:</strong> {payment.notes}</p>
                  )}
                </div>
              </div>

              {/* خيار إظهار بيانات التحصيل */}
              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                <input
                  type="checkbox"
                  id="showCollectionDetails"
                  checked={showCollectionDetails}
                  onChange={(e) => setShowCollectionDetails(e.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
                <label htmlFor="showCollectionDetails" className="cursor-pointer text-sm">
                  إظهار بيانات التحصيل عبر الوسيط (المحصل، المستلم، مكان التسليم)
                </label>
              </div>

              {/* أزرار العمليات */}
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="border-primary/30 hover:bg-primary/10"
                >
                  إغلاق
                </Button>
                <Button 
                  onClick={handlePrintReceipt}
                  className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
                  disabled={isGenerating}
                >
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة الإيصال
                </Button>
              </div>
            </>
          )}
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}