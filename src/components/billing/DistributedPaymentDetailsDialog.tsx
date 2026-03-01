import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText, Trash2, Edit, UserCheck, Wallet, AlertCircle } from "lucide-react";
import { PaymentRow } from "./BillingTypes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import IntermediaryReceiptPrintDialog from "./IntermediaryReceiptPrintDialog";
import { ConvertToCustodyDialog } from "./ConvertToCustodyDialog";
import { useUnifiedReceiptPrint } from "./UnifiedReceiptPrint";

interface CustodyInfo {
  id: string;
  employee_name: string;
  account_number: string;
  initial_amount: number;
  current_balance: number;
  status: string;
}

interface EmployeeAdvanceInfo {
  id: string;
  employee_name: string;
  amount: number;
  reason: string;
  status: string;
  request_date: string;
}

interface WithdrawalInfo {
  id: number;
  receiver_name: string;
  amount: number;
  date: string;
  notes: string;
  method: string;
}

interface DistributedPaymentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupedPayments: PaymentRow[];
  totalAmount: number;
  onPrintCombined: () => void;
  onPrintIndividual: (payment: PaymentRow) => void;
  onDelete: () => void;
  onEdit?: () => void;
  customerName: string;
}

export function DistributedPaymentDetailsDialog({
  open,
  onOpenChange,
  groupedPayments,
  totalAmount,
  onPrintCombined,
  onPrintIndividual,
  onDelete,
  onEdit,
  customerName,
}: DistributedPaymentDetailsDialogProps) {
  const [viaIntermediary, setViaIntermediary] = useState(false);
  const [collectorName, setCollectorName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('نقدي');
  const [notes, setNotes] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [intermediaryPrintOpen, setIntermediaryPrintOpen] = useState(false);
  const [custodyDialogOpen, setCustodyDialogOpen] = useState(false);
  const [custodyInfo, setCustodyInfo] = useState<CustodyInfo[]>([]);
  const [employeeAdvances, setEmployeeAdvances] = useState<EmployeeAdvanceInfo[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalInfo[]>([]);
  const [loadingCustody, setLoadingCustody] = useState(false);
  const [showIntermediaryInReceipt, setShowIntermediaryInReceipt] = useState(true);

  // ✅ استخدام Hook الطباعة الموحد
  const { print: printReceipt, isPrinting } = useUnifiedReceiptPrint();

  // تحميل معلومات العهدة المرتبطة بالدفعة
  const loadCustodyInfo = async (distributedPaymentId: string) => {
    setLoadingCustody(true);
    try {
      const { data, error } = await supabase
        .from('custody_accounts')
        .select(`
          id,
          account_number,
          initial_amount,
          current_balance,
          status,
          employee:employees(name)
        `)
        .eq('source_payment_id', distributedPaymentId);

      if (error) throw error;
      
      setCustodyInfo((data || []).map((c: any) => ({
        id: c.id,
        employee_name: c.employee?.name || '-',
        account_number: c.account_number,
        initial_amount: c.initial_amount,
        current_balance: c.current_balance,
        status: c.status
      })));
    } catch (error) {
      console.error('Error loading custody info:', error);
      setCustodyInfo([]);
    } finally {
      setLoadingCustody(false);
    }
  };

  // تحميل معلومات السلف المرتبطة بالدفعة
  const loadEmployeeAdvances = async (distributedPaymentId: string) => {
    try {
      const { data, error } = await supabase
        .from('employee_advances')
        .select(`
          id,
          amount,
          reason,
          status,
          request_date,
          employee:employees(name)
        `)
        .eq('distributed_payment_id', distributedPaymentId);

      if (error) throw error;
      
      setEmployeeAdvances((data || []).map((a: any) => ({
        id: a.id,
        employee_name: a.employee?.name || '-',
        amount: a.amount,
        reason: a.reason,
        status: a.status,
        request_date: a.request_date
      })));
    } catch (error) {
      console.error('Error loading employee advances:', error);
      setEmployeeAdvances([]);
    }
  };

  // تحميل معلومات السحوبات من الرصيد
  const loadWithdrawals = async (distributedPaymentId: string) => {
    try {
      const { data, error } = await supabase
        .from('expenses_withdrawals')
        .select('id, receiver_name, amount, date, notes, method')
        .eq('distributed_payment_id', distributedPaymentId);

      if (error) throw error;
      
      setWithdrawals((data || []).map((w: any) => ({
        id: w.id,
        receiver_name: w.receiver_name || '-',
        amount: w.amount,
        date: w.date,
        notes: w.notes,
        method: w.method
      })));
    } catch (error) {
      console.error('Error loading withdrawals:', error);
      setWithdrawals([]);
    }
  };

  useEffect(() => {
    if (open && groupedPayments.length > 0) {
      const firstPayment = groupedPayments[0];
      setViaIntermediary(firstPayment.collected_via_intermediary || false);
      setCollectorName(firstPayment.collector_name || '');
      setReceiverName(firstPayment.receiver_name || '');
      setDeliveryLocation(firstPayment.delivery_location || '');
      setPaymentMethod(firstPayment.method || 'نقدي');
      setNotes(firstPayment.notes || '');
      setCollectionDate(firstPayment.collection_date || '');
      
      // تحميل معلومات العهدة والسلف والسحوبات
      if (firstPayment.distributed_payment_id) {
        loadCustodyInfo(firstPayment.distributed_payment_id);
        loadEmployeeAdvances(firstPayment.distributed_payment_id);
        loadWithdrawals(firstPayment.distributed_payment_id);
      }
    } else {
      setCustodyInfo([]);
      setEmployeeAdvances([]);
      setWithdrawals([]);
    }
  }, [open, groupedPayments]);

  if (groupedPayments.length === 0) return null;

  const firstPayment = groupedPayments[0];
  const paymentDate = firstPayment.paid_at 
    ? new Date(firstPayment.paid_at).toLocaleDateString('ar-LY') 
    : '—';

  const handleSaveIntermediaryData = async () => {
    setSaving(true);
    try {
      const distributedPaymentId = firstPayment.distributed_payment_id;
      if (!distributedPaymentId) {
        toast.error('معرف الدفعة غير موجود');
        setSaving(false);
        return;
      }

      if (!viaIntermediary) {
        // Clear intermediary data
        const { error } = await supabase
          .from('customer_payments')
          .update({
            collected_via_intermediary: false,
            collector_name: null,
            receiver_name: null,
            delivery_location: null,
            collection_date: null,
            intermediary_commission: null,
            commission_notes: null,
          })
          .eq('distributed_payment_id', distributedPaymentId);

        if (error) throw error;
        toast.success('تم إلغاء تفعيل الوسيط بنجاح');

        // Reload the data to reflect changes
        window.location.reload();
        return;
      }

      // Validate
      if (!collectorName.trim() || !receiverName.trim() || !deliveryLocation.trim() || !collectionDate) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('customer_payments')
        .update({
          collected_via_intermediary: true,
          collector_name: collectorName.trim(),
          receiver_name: receiverName.trim(),
          delivery_location: deliveryLocation.trim(),
          collection_date: collectionDate,
          method: paymentMethod,
          notes: notes.trim() || null
        })
        .eq('distributed_payment_id', distributedPaymentId);

      if (error) throw error;
      toast.success('تم حفظ بيانات الوسيط بنجاح');
      
      // Reload the data to reflect changes
      window.location.reload();
    } catch (error: any) {
      console.error('Error saving intermediary data:', error);
      toast.error('حدث خطأ أثناء حفظ البيانات: ' + (error.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" dir="rtl">
        <DialogHeader className="border-b pb-4 flex-shrink-0">
          <DialogTitle className="text-xl font-bold text-primary">
            تفاصيل الدفعة الموزعة
          </DialogTitle>
          <div className="text-sm text-muted-foreground mt-2 space-y-1">
            <div>
              المعرف: <span className="font-semibold text-foreground">{firstPayment.distributed_payment_id}</span>
            </div>
            <div>
              التاريخ: <span className="font-semibold text-foreground">{paymentDate}</span>
            </div>
            <div>
              طريقة الدفع: <span className="font-semibold text-foreground">{firstPayment.method}</span>
            </div>
            {firstPayment.reference && (
              <div>
                المرجع: <span className="font-semibold text-foreground">{firstPayment.reference}</span>
              </div>
            )}
            {firstPayment.source_bank && (
              <div>
                المصرف المحول منه: <span className="font-semibold text-foreground">{firstPayment.source_bank}</span>
              </div>
            )}
            {firstPayment.destination_bank && (
              <div>
                المصرف المحول إليه: <span className="font-semibold text-foreground">{firstPayment.destination_bank}</span>
              </div>
            )}
            {firstPayment.transfer_reference && (
              <div>
                رقم العملية التحويلية: <span className="font-semibold text-foreground">{firstPayment.transfer_reference}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pt-4">
          {/* ملخص المبلغ والعمولات */}
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <div className="text-sm text-muted-foreground mb-1">المبلغ الإجمالي</div>
              <div className="text-3xl font-bold text-primary">
                {totalAmount.toLocaleString('ar-LY')} د.ل
              </div>
            </div>
            
            {/* عرض العمولات إذا كانت موجودة */}
            {firstPayment.collected_via_intermediary && (
              <div className="p-4 rounded-lg bg-muted/50 border border-muted space-y-2">
                <div className="font-semibold text-foreground mb-2">تفاصيل العمولات</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                    <span className="font-semibold">{totalAmount.toLocaleString('ar-LY')} د.ل</span>
                  </div>
                  {firstPayment.intermediary_commission > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>عمولة الوسيط:</span>
                      <span className="font-semibold">-{(Number(firstPayment.intermediary_commission) || 0).toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  )}
                  {firstPayment.transfer_fee > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>عمولة التحويل:</span>
                      <span className="font-semibold">-{(Number(firstPayment.transfer_fee) || 0).toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-muted-foreground/20 text-base font-bold text-primary">
                    <span>الصافي:</span>
                    <span>
                      {(totalAmount - (Number(firstPayment.intermediary_commission) || 0) - (Number(firstPayment.transfer_fee) || 0)).toLocaleString('ar-LY')} د.ل
                    </span>
                  </div>
                  {firstPayment.commission_notes && (
                    <div className="pt-2 border-t border-muted-foreground/20 mt-2">
                      <span className="text-muted-foreground">ملاحظات العمولات: </span>
                      <span className="text-foreground">{firstPayment.commission_notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* عرض معلومات العهدة المرتبطة */}
          {custodyInfo.length > 0 && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
                <Wallet className="h-5 w-5" />
                هذه الدفعة محولة إلى عهدة مالية
              </div>
              <div className="space-y-2">
                {custodyInfo.map((custody) => (
                  <div key={custody.id} className="p-3 bg-white dark:bg-background rounded-lg border border-amber-200 dark:border-amber-700">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold">{custody.employee_name}</span>
                        <span className="text-muted-foreground mx-2">|</span>
                        <span className="text-sm text-muted-foreground">{custody.account_number}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={custody.status === 'active' ? 'default' : 'secondary'}>
                          {custody.status === 'active' ? 'نشط' : 'مغلق'}
                        </Badge>
                        <span className="font-bold text-primary">
                          {custody.current_balance.toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-700">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const printContent = `
                            <!DOCTYPE html>
                            <html dir="rtl" lang="ar">
                            <head>
                              <meta charset="UTF-8">
                              <title>إيصال استلام عهدة</title>
                              <style>
                                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
                                * { margin: 0; padding: 0; box-sizing: border-box; }
                                @page { size: A4 portrait; margin: 0; }
                                html, body { 
                                  width: 210mm; 
                                  height: 297mm;
                                  font-family: 'Noto Sans Arabic', Arial, sans-serif; 
                                  direction: rtl; 
                                  text-align: right;
                                  background: white; 
                                  color: #000; 
                                  font-size: 10px;
                                  line-height: 1.2;
                                  overflow: hidden;
                                }
                                .receipt-container {
                                  width: 210mm;
                                  height: 297mm;
                                  padding: 10mm;
                                  display: flex;
                                  flex-direction: column;
                                }
                                .header {
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: flex-start;
                                  margin-bottom: 15px;
                                  border-bottom: 2px solid #000;
                                  padding-bottom: 12px;
                                }
                                .receipt-info { text-align: left; direction: ltr; order: 2; }
                                .receipt-title { font-size: 18px; font-weight: bold; color: #000; margin-bottom: 6px; }
                                .receipt-details { font-size: 10px; color: #666; line-height: 1.4; }
                                .company-info { display: flex; flex-direction: column; align-items: flex-end; text-align: right; order: 1; }
                                .company-logo { max-width: 300px; height: auto; object-fit: contain; margin-bottom: 4px; display: block; }
                                .company-details { font-size: 10px; color: #666; line-height: 1.4; }
                                .customer-info {
                                  background: #f8f9fa;
                                  padding: 10px;
                                  border-radius: 0;
                                  margin-bottom: 12px;
                                  border-right: 3px solid #000;
                                }
                                .customer-title { font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #000; }
                                .customer-details { font-size: 10px; line-height: 1.4; }
                                .amount-section {
                                  margin-top: 12px;
                                  border-top: 2px solid #000;
                                  padding-top: 10px;
                                }
                                .amount-row {
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: center;
                                  padding: 12px;
                                  font-size: 16px;
                                  font-weight: bold;
                                  background: #000;
                                  color: white;
                                  margin-top: 8px;
                                }
                                .currency { font-weight: bold; color: #FFD700; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
                                .amount-words {
                                  margin-top: 8px;
                                  font-size: 10px;
                                  color: #666;
                                  text-align: center;
                                  font-style: italic;
                                }
                                .signature-section {
                                  margin-top: 15px;
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: flex-end;
                                }
                                .signature-box {
                                  text-align: center;
                                  border-top: 1px solid #000;
                                  padding-top: 6px;
                                  min-width: 100px;
                                }
                                .signature-name { margin-top: 6px; font-size: 10px; color: #666; }
                                .footer {
                                  margin-top: auto;
                                  text-align: center;
                                  font-size: 9px;
                                  color: #666;
                                  border-top: 1px solid #ddd;
                                  padding-top: 10px;
                                }
                                @media print {
                                  html, body { 
                                    width: 210mm !important; 
                                    height: 297mm !important; 
                                    margin: 0 !important; 
                                    padding: 0 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                    color-adjust: exact !important;
                                  }
                                  .receipt-container { 
                                    width: 210mm !important; 
                                    height: 297mm !important; 
                                    padding: 10mm !important;
                                  }
                                  .amount-row {
                                    background: #000 !important;
                                    color: white !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  .currency {
                                    color: #FFD700 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  .customer-info {
                                    background: #f8f9fa !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  @page { size: A4 portrait; margin: 0 !important; }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="receipt-container">
                                <div class="header">
                                  <div class="company-info">
                                    <img src="/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
                                  </div>
                                  <div class="receipt-info">
                                    <div class="receipt-title">إيصال استلام عهدة مالية</div>
                                    <div class="receipt-details">
                                      رقم الحساب: ${custody.account_number}<br>
                                      التاريخ: ${new Date().toLocaleDateString('ar-LY')}
                                    </div>
                                  </div>
                                </div>
                                
                                <div class="customer-info">
                                  <div class="customer-title">بيانات العميل</div>
                                  <div class="customer-details">
                                    <strong>الاسم:</strong> ${customerName}
                                  </div>
                                </div>
                                
                                <div class="customer-info">
                                  <div class="customer-title">المستلم</div>
                                  <div class="customer-details">
                                    <strong>اسم المستلم:</strong> ${custody.employee_name}<br>
                                    <strong>الحالة:</strong> ${custody.status === 'active' ? 'نشط' : 'مغلق'}
                                  </div>
                                </div>
                                
                                <div class="amount-section">
                                  <div class="amount-row">
                                    <span>المبلغ المستلم:</span>
                                    <span class="currency">د.ل ${custody.current_balance.toLocaleString('ar-LY')}</span>
                                  </div>
                                  <div class="amount-words">
                                    المبلغ بالكلمات: ${custody.current_balance.toLocaleString('ar-LY')} دينار ليبي
                                  </div>
                                </div>
                                
                                <div class="signature-section">
                                  <div class="signature-box">
                                    <div>توقيع الدافع</div>
                                    <div class="signature-name">${customerName}</div>
                                  </div>
                                  <div class="signature-box">
                                    <div>توقيع المستلم</div>
                                    <div class="signature-name">${custody.employee_name}</div>
                                  </div>
                                </div>
                                
                                <div class="footer">
                                  شكراً لتعاملكم معنا | Thank you for your business<br>
                                  هذا إيصال إلكتروني ولا يحتاج إلى ختم أو توقيع إضافي
                                </div>
                              </div>
                              <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
                            </body>
                            </html>
                          `;
                          const printWindow = window.open('', '_blank');
                          if (printWindow) {
                            printWindow.document.write(printContent);
                            printWindow.document.close();
                          }
                        }}
                        className="gap-2 text-amber-700 border-amber-400 hover:bg-amber-100"
                      >
                        <Printer className="h-4 w-4" />
                        طباعة إيصال استلام العهدة
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                يمكنك إدارة العهد من صفحة إدارة العهد المالية
              </p>
            </div>
          )}

          {/* عرض معلومات السلف المرتبطة بالموظفين */}
          {employeeAdvances.length > 0 && (
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-300 dark:border-green-800 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-400">
                <UserCheck className="h-5 w-5" />
                تم تسليم جزء من الدفعة للموظفين
              </div>
              <div className="space-y-2">
                {employeeAdvances.map((advance) => (
                  <div key={advance.id} className="p-3 bg-white dark:bg-background rounded-lg border border-green-200 dark:border-green-700">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <span className="font-semibold text-lg">{advance.employee_name}</span>
                        <p className="text-sm text-muted-foreground">{advance.reason}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={advance.status === 'approved' ? 'default' : 'secondary'}>
                          {advance.status === 'approved' ? 'مُسلّم' : advance.status}
                        </Badge>
                        <span className="font-bold text-green-600 text-lg">
                          {Number(advance.amount).toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-green-200 dark:border-green-700">
                      <span className="text-xs text-muted-foreground">
                        تاريخ التسليم: {new Date(advance.request_date).toLocaleDateString('ar-LY')}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // طباعة إيصال الموظف بنفس تنسيق العهدة
                          const printContent = `
                            <!DOCTYPE html>
                            <html dir="rtl" lang="ar">
                            <head>
                              <meta charset="UTF-8">
                              <title>إيصال تسليم مبلغ للموظف</title>
                              <style>
                                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
                                * { margin: 0; padding: 0; box-sizing: border-box; }
                                @page { size: A4 portrait; margin: 0; }
                                html, body { 
                                  width: 210mm; 
                                  height: 297mm;
                                  font-family: 'Noto Sans Arabic', Arial, sans-serif; 
                                  direction: rtl; 
                                  text-align: right;
                                  background: white; 
                                  color: #000; 
                                  font-size: 10px;
                                  line-height: 1.2;
                                  overflow: hidden;
                                }
                                .receipt-container {
                                  width: 210mm;
                                  height: 297mm;
                                  padding: 10mm;
                                  display: flex;
                                  flex-direction: column;
                                }
                                .header {
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: flex-start;
                                  margin-bottom: 15px;
                                  border-bottom: 2px solid #16a34a;
                                  padding-bottom: 12px;
                                }
                                .receipt-info { text-align: left; direction: ltr; order: 2; }
                                .receipt-title { font-size: 18px; font-weight: bold; color: #16a34a; margin-bottom: 6px; }
                                .receipt-details { font-size: 10px; color: #666; line-height: 1.4; }
                                .company-info { display: flex; flex-direction: column; align-items: flex-end; text-align: right; order: 1; }
                                .company-logo { max-width: 300px; height: auto; object-fit: contain; margin-bottom: 4px; display: block; }
                                .company-details { font-size: 10px; color: #666; line-height: 1.4; }
                                .customer-info {
                                  background: #f0fdf4;
                                  padding: 10px;
                                  border-radius: 0;
                                  margin-bottom: 12px;
                                  border-right: 3px solid #16a34a;
                                }
                                .customer-title { font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #16a34a; }
                                .customer-details { font-size: 10px; line-height: 1.4; }
                                .amount-section {
                                  margin-top: 12px;
                                  border-top: 2px solid #16a34a;
                                  padding-top: 10px;
                                }
                                .amount-row {
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: center;
                                  padding: 12px;
                                  font-size: 16px;
                                  font-weight: bold;
                                  background: #16a34a;
                                  color: white;
                                  margin-top: 8px;
                                }
                                .currency { font-weight: bold; color: #FFD700; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
                                .amount-words {
                                  margin-top: 8px;
                                  font-size: 10px;
                                  color: #666;
                                  text-align: center;
                                  font-style: italic;
                                }
                                .signature-section {
                                  margin-top: 15px;
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: flex-end;
                                }
                                .signature-box {
                                  text-align: center;
                                  border-top: 1px solid #000;
                                  padding-top: 6px;
                                  min-width: 100px;
                                }
                                .signature-name { margin-top: 6px; font-size: 10px; color: #666; }
                                .footer {
                                  margin-top: auto;
                                  text-align: center;
                                  font-size: 9px;
                                  color: #666;
                                  border-top: 1px solid #ddd;
                                  padding-top: 10px;
                                }
                                @media print {
                                  html, body { 
                                    width: 210mm !important; 
                                    height: 297mm !important; 
                                    margin: 0 !important; 
                                    padding: 0 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                    color-adjust: exact !important;
                                  }
                                  .receipt-container { 
                                    width: 210mm !important; 
                                    height: 297mm !important; 
                                    padding: 10mm !important;
                                  }
                                  .amount-row {
                                    background: #16a34a !important;
                                    color: white !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  .currency {
                                    color: #FFD700 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  .customer-info {
                                    background: #f0fdf4 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  @page { size: A4 portrait; margin: 0 !important; }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="receipt-container">
                                <div class="header">
                                  <div class="company-info">
                                    <img src="/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
                                  </div>
                                  <div class="receipt-info">
                                    <div class="receipt-title">إيصال تسليم مبلغ للموظف</div>
                                    <div class="receipt-details">
                                      التاريخ: ${new Date(advance.request_date).toLocaleDateString('ar-LY')}
                                    </div>
                                  </div>
                                </div>
                                
                                <div class="customer-info">
                                  <div class="customer-title">بيانات العميل</div>
                                  <div class="customer-details">
                                    <strong>الاسم:</strong> ${customerName}
                                  </div>
                                </div>
                                
                                <div class="customer-info">
                                  <div class="customer-title">المستلم</div>
                                  <div class="customer-details">
                                    <strong>اسم المستلم:</strong> ${advance.employee_name}<br>
                                    <strong>السبب:</strong> ${advance.reason || 'دفعة من الزبون'}<br>
                                    <strong>الحالة:</strong> ${advance.status === 'approved' ? 'مُسلّم' : advance.status}
                                  </div>
                                </div>
                                
                                <div class="amount-section">
                                  <div class="amount-row">
                                    <span>المبلغ المستلم:</span>
                                    <span class="currency">د.ل ${Number(advance.amount).toLocaleString('ar-LY')}</span>
                                  </div>
                                  <div class="amount-words">
                                    المبلغ بالكلمات: ${Number(advance.amount).toLocaleString('ar-LY')} دينار ليبي
                                  </div>
                                </div>
                                
                                <div class="signature-section">
                                  <div class="signature-box">
                                    <div>توقيع الدافع</div>
                                    <div class="signature-name">${customerName}</div>
                                  </div>
                                  <div class="signature-box">
                                    <div>توقيع المستلم</div>
                                    <div class="signature-name">${advance.employee_name}</div>
                                  </div>
                                </div>
                                
                                <div class="footer">
                                  شكراً لتعاملكم معنا | Thank you for your business<br>
                                  هذا إيصال إلكتروني ولا يحتاج إلى ختم أو توقيع إضافي
                                </div>
                              </div>
                              <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
                            </body>
                            </html>
                          `;
                          const printWindow = window.open('', '_blank');
                          if (printWindow) {
                            printWindow.document.write(printContent);
                            printWindow.document.close();
                          }
                        }}
                        className="gap-1 text-green-600 border-green-300 hover:bg-green-100"
                      >
                        <Printer className="h-4 w-4" />
                        طباعة إيصال
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* عرض معلومات السحوبات من الرصيد */}
          {withdrawals.length > 0 && (
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-800 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-400">
                <Wallet className="h-5 w-5" />
                تم سحب جزء من الدفعة من رصيد الموظفين
              </div>
              <div className="space-y-2">
                {withdrawals.map((withdrawal) => (
                  <div key={withdrawal.id} className="p-3 bg-white dark:bg-background rounded-lg border border-blue-200 dark:border-blue-700">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <span className="font-semibold text-lg">{withdrawal.receiver_name}</span>
                        <p className="text-sm text-muted-foreground">{withdrawal.notes}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="default" className="bg-blue-600">
                          {withdrawal.method || 'نقدي'}
                        </Badge>
                        <span className="font-bold text-blue-600 text-lg">
                          {Number(withdrawal.amount).toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                      <span className="text-xs text-muted-foreground">
                        تاريخ السحب: {withdrawal.date ? new Date(withdrawal.date).toLocaleDateString('ar-LY') : '—'}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const printContent = `
                            <!DOCTYPE html>
                            <html dir="rtl" lang="ar">
                            <head>
                              <meta charset="UTF-8">
                              <title>إيصال سحب من رصيد الموظف</title>
                              <style>
                                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
                                * { margin: 0; padding: 0; box-sizing: border-box; }
                                @page { size: A4 portrait; margin: 0; }
                                html, body { 
                                  width: 210mm; 
                                  height: 297mm;
                                  font-family: 'Noto Sans Arabic', Arial, sans-serif; 
                                  direction: rtl; 
                                  text-align: right;
                                  background: white; 
                                  color: #000; 
                                  font-size: 10px;
                                  line-height: 1.2;
                                  overflow: hidden;
                                }
                                .receipt-container {
                                  width: 210mm;
                                  height: 297mm;
                                  padding: 10mm;
                                  display: flex;
                                  flex-direction: column;
                                }
                                .header {
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: flex-start;
                                  margin-bottom: 15px;
                                  border-bottom: 2px solid #2563eb;
                                  padding-bottom: 12px;
                                }
                                .receipt-info { text-align: left; direction: ltr; order: 2; }
                                .receipt-title { font-size: 18px; font-weight: bold; color: #2563eb; margin-bottom: 6px; }
                                .receipt-details { font-size: 10px; color: #666; line-height: 1.4; }
                                .company-info { display: flex; flex-direction: column; align-items: flex-end; text-align: right; order: 1; }
                                .company-logo { max-width: 300px; height: auto; object-fit: contain; margin-bottom: 4px; display: block; }
                                .company-details { font-size: 10px; color: #666; line-height: 1.4; }
                                .customer-info {
                                  background: #eff6ff;
                                  padding: 10px;
                                  border-radius: 0;
                                  margin-bottom: 12px;
                                  border-right: 3px solid #2563eb;
                                }
                                .customer-title { font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #2563eb; }
                                .customer-details { font-size: 10px; line-height: 1.4; }
                                .amount-section {
                                  margin-top: 12px;
                                  border-top: 2px solid #2563eb;
                                  padding-top: 10px;
                                }
                                .amount-row {
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: center;
                                  padding: 12px;
                                  font-size: 16px;
                                  font-weight: bold;
                                  background: #2563eb;
                                  color: white;
                                  margin-top: 8px;
                                }
                                .currency { font-weight: bold; color: #FFD700; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
                                .amount-words {
                                  margin-top: 8px;
                                  font-size: 10px;
                                  color: #666;
                                  text-align: center;
                                  font-style: italic;
                                }
                                .signature-section {
                                  margin-top: 15px;
                                  display: flex;
                                  justify-content: space-between;
                                  align-items: flex-end;
                                }
                                .signature-box {
                                  text-align: center;
                                  border-top: 1px solid #000;
                                  padding-top: 6px;
                                  min-width: 100px;
                                }
                                .signature-name { margin-top: 6px; font-size: 10px; color: #666; }
                                .footer {
                                  margin-top: auto;
                                  text-align: center;
                                  font-size: 9px;
                                  color: #666;
                                  border-top: 1px solid #ddd;
                                  padding-top: 10px;
                                }
                                @media print {
                                  html, body { 
                                    width: 210mm !important; 
                                    height: 297mm !important; 
                                    margin: 0 !important; 
                                    padding: 0 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                    color-adjust: exact !important;
                                  }
                                  .receipt-container { 
                                    width: 210mm !important; 
                                    height: 297mm !important; 
                                    padding: 10mm !important;
                                  }
                                  .amount-row {
                                    background: #2563eb !important;
                                    color: white !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  .currency {
                                    color: #FFD700 !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  .customer-info {
                                    background: #eff6ff !important;
                                    -webkit-print-color-adjust: exact !important;
                                    print-color-adjust: exact !important;
                                  }
                                  @page { size: A4 portrait; margin: 0 !important; }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="receipt-container">
                                <div class="header">
                                  <div class="company-info">
                                    <img src="/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
                                  </div>
                                  <div class="receipt-info">
                                    <div class="receipt-title">إيصال سحب من رصيد الموظف</div>
                                    <div class="receipt-details">
                                      التاريخ: ${withdrawal.date ? new Date(withdrawal.date).toLocaleDateString('ar-LY') : new Date().toLocaleDateString('ar-LY')}
                                    </div>
                                  </div>
                                </div>
                                
                                <div class="customer-info">
                                  <div class="customer-title">بيانات العميل</div>
                                  <div class="customer-details">
                                    <strong>الاسم:</strong> ${customerName}
                                  </div>
                                </div>
                                
                                <div class="customer-info">
                                  <div class="customer-title">المستلم</div>
                                  <div class="customer-details">
                                    <strong>اسم المستلم:</strong> ${withdrawal.receiver_name}<br>
                                    <strong>طريقة الدفع:</strong> ${withdrawal.method || 'نقدي'}<br>
                                    <strong>ملاحظات:</strong> ${withdrawal.notes || '—'}
                                  </div>
                                </div>
                                
                                <div class="amount-section">
                                  <div class="amount-row">
                                    <span>المبلغ المستلم:</span>
                                    <span class="currency">د.ل ${Number(withdrawal.amount).toLocaleString('ar-LY')}</span>
                                  </div>
                                  <div class="amount-words">
                                    المبلغ بالكلمات: ${Number(withdrawal.amount).toLocaleString('ar-LY')} دينار ليبي
                                  </div>
                                </div>
                                
                                <div class="signature-section">
                                  <div class="signature-box">
                                    <div>توقيع الدافع</div>
                                    <div class="signature-name">${customerName}</div>
                                  </div>
                                  <div class="signature-box">
                                    <div>توقيع المستلم</div>
                                    <div class="signature-name">${withdrawal.receiver_name}</div>
                                  </div>
                                </div>
                                
                                <div class="footer">
                                  شكراً لتعاملكم معنا | Thank you for your business<br>
                                  هذا إيصال إلكتروني ولا يحتاج إلى ختم أو توقيع إضافي
                                </div>
                              </div>
                              <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
                            </body>
                            </html>
                          `;
                          const printWindow = window.open('', '_blank');
                          if (printWindow) {
                            printWindow.document.write(printContent);
                            printWindow.document.close();
                          }
                        }}
                        className="gap-1 text-blue-600 border-blue-300 hover:bg-blue-100"
                      >
                        <Printer className="h-4 w-4" />
                        طباعة إيصال
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* جدول المدفوعات */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المرجع</TableHead>
                  <TableHead className="text-right">البيان</TableHead>
                  <TableHead className="text-right">المبلغ المدفوع</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedPayments.map((payment) => {
                  // تحديد نوع الدفعة
                  const getPaymentInfo = () => {
                    if (payment.composite_task_id) {
                      const taskTypeLabels: { [key: string]: string } = {
                        'طباعة_تركيب': 'طباعة وتركيب',
                        'طباعة_قص_تركيب': 'طباعة وقص وتركيب',
                        'installation': 'تركيب',
                        'print': 'طباعة'
                      };
                      return {
                        reference: 'مهمة مجمعة',
                        description: taskTypeLabels[payment.notes?.match(/نوع:\s*(\S+)/)?.[1] || ''] || 'مهمة مجمعة',
                        icon: '🔧'
                      };
                    }
                    if (payment.sales_invoice_id) {
                      return {
                        reference: 'فاتورة مبيعات',
                        description: payment.notes || 'مبيعات',
                        icon: '🧾'
                      };
                    }
                    if (payment.printed_invoice_id) {
                      return {
                        reference: 'فاتورة طباعة',
                        description: payment.notes || 'طباعة',
                        icon: '🖨️'
                      };
                    }
                    // Default: عقد
                    return {
                      reference: `عقد رقم ${payment.contract_number}`,
                      description: 'لوحة إعلانية',
                      icon: '📄'
                    };
                  };
                  
                  const paymentInfo = getPaymentInfo();
                  
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="font-semibold text-lg">
                        <span className="ml-2">{paymentInfo.icon}</span>
                        {paymentInfo.reference}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {paymentInfo.description}
                      </TableCell>
                      <TableCell className="font-bold text-green-600 text-lg">
                        {(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onPrintIndividual(payment)}
                          className="gap-2"
                        >
                          <Printer className="h-4 w-4" />
                          طباعة إيصال
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* قسم الوسيط المحصل - يظهر فقط إذا كان مفعلاً في البيانات */}
          {firstPayment.collected_via_intermediary && (
            <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10">
              <div className="flex items-center gap-2 mb-4">
                <UserCheck className="h-5 w-5 text-primary" />
                <span className="text-base font-bold text-primary">
                  القبض عن طريق وسيط
                </span>
              </div>

              <div className="space-y-3 text-sm">
                {firstPayment.collector_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المحصل (المستلم من الزبون):</span>
                    <span className="font-semibold">{firstPayment.collector_name}</span>
                  </div>
                )}
                {firstPayment.receiver_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المسلم له:</span>
                    <span className="font-semibold">{firstPayment.receiver_name}</span>
                  </div>
                )}
                {firstPayment.delivery_location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">مكان التسليم:</span>
                    <span className="font-semibold">{firstPayment.delivery_location}</span>
                  </div>
                )}
                {firstPayment.collection_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تاريخ القبض:</span>
                    <span className="font-semibold">{new Date(firstPayment.collection_date).toLocaleDateString('ar-LY')}</span>
                  </div>
                )}
                {firstPayment.notes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ملاحظات:</span>
                    <span className="font-semibold">{firstPayment.notes}</span>
                  </div>
                )}
              </div>

              {/* زر طباعة إيصال الوسيط */}
              {firstPayment.collector_name && firstPayment.receiver_name && firstPayment.delivery_location && (
                <div className="mt-4 pt-3 border-t">
                  <Button
                    onClick={() => setIntermediaryPrintOpen(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
                    size="sm"
                  >
                    <Printer className="h-4 w-4" />
                    طباعة إيصال الوسيط
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* لا يظهر أي شيء إذا لم يكن الوسيط مفعلاً - يمكن تفعيله من خلال وضع التعديل فقط */}

          {/* قسم تحويل إلى عهدة - منفصل */}
          {custodyInfo.length === 0 && (
            <div className="border rounded-lg p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-amber-600" />
                  <span className="text-base font-bold text-amber-700 dark:text-amber-400">
                    تحويل إلى عهدة مالية
                  </span>
                </div>
                <Button
                  onClick={() => setCustodyDialogOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 gap-2"
                  size="sm"
                >
                  <Wallet className="h-4 w-4" />
                  تحويل لعهدة (اختيار موظفين)
                </Button>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                يمكنك تحويل هذه الدفعة إلى عهدة مالية وتوزيعها على موظف أو أكثر
              </p>
            </div>
          )}
        </div>

        {/* أزرار الطباعة والحذف والتعديل - ثابتة في الأسفل */}
        <div className="flex-shrink-0 space-y-4 pt-4 border-t bg-background">
            {/* خيار إظهار الوسيط في الإيصال */}
            {(custodyInfo.length > 0 || employeeAdvances.length > 0 || withdrawals.length > 0) && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Checkbox
                  id="showIntermediaryInReceipt"
                  checked={showIntermediaryInReceipt}
                  onCheckedChange={(checked) => setShowIntermediaryInReceipt(checked as boolean)}
                />
                <Label htmlFor="showIntermediaryInReceipt" className="cursor-pointer flex items-center gap-2 text-sm font-medium">
                  <UserCheck className="h-4 w-4 text-primary" />
                  إظهار معلومات الوسيط (العهدة/الموظف) في الإيصال الموحد
                </Label>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button
                onClick={async () => {
                  // ✅ استخدام نظام الطباعة الموحد الجديد (مثل كشف الحساب)
                  const firstPaymentData = groupedPayments[0];
                  
                  // جلب بيانات العميل
                  let customerData = { id: '', name: customerName, company: '', phone: '' };
                  if (firstPaymentData.customer_id) {
                    const { data } = await supabase
                      .from('customers')
                      .select('id, name, company, phone')
                      .eq('id', firstPaymentData.customer_id)
                      .single();
                    if (data) customerData = data;
                  }

                  // جلب بيانات العقود (مرة واحدة) لإظهار نوع الإعلان + المتبقي لكل عقد
                  const contractNumbers = Array.from(new Set(
                    groupedPayments
                      .map(p => p.contract_number)
                      .filter(Boolean)
                      .map(v => Number(v))
                      .filter(n => !Number.isNaN(n))
                  ));

                  const contractMap: Record<number, any> = {};
                  if (contractNumbers.length > 0) {
                    const { data: contractsData, error: contractsError } = await supabase
                      .from('Contract')
                      .select('Contract_Number, "Ad Type", Total, "Total Paid"')
                      .in('Contract_Number', contractNumbers);
                    if (contractsError) throw contractsError;
                    
                    // جلب المدفوعات لهذه العقود لحساب المتبقي الصحيح
                    const { data: allPayments } = await supabase
                      .from('customer_payments')
                      .select('contract_number, amount, entry_type')
                      .in('contract_number', contractNumbers);
                    
                    // حساب إجمالي المدفوع لكل عقد
                    const paidByContract: Record<number, number> = {};
                    (allPayments || []).forEach((p: any) => {
                      const cn = Number(p.contract_number);
                      if (!paidByContract[cn]) paidByContract[cn] = 0;
                      if (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment') {
                        paidByContract[cn] += Number(p.amount) || 0;
                      }
                    });
                    
                    (contractsData || []).forEach((c: any) => {
                      const cn = c.Contract_Number;
                      const total = Number(c.Total) || 0;
                      const paid = paidByContract[cn] || 0;
                      const remaining = Math.max(0, total - paid);
                      contractMap[cn] = { ...c, calculatedRemaining: remaining, calculatedPaid: paid };
                    });
                  }

                  // ✅ جلب بيانات المهام المجمعة وفواتير المبيعات
                  const compositeTaskIds = groupedPayments
                    .filter(p => p.composite_task_id)
                    .map(p => p.composite_task_id as string);
                  
                  const salesInvoiceIds = groupedPayments
                    .filter(p => p.sales_invoice_id)
                    .map(p => p.sales_invoice_id as string);

                  const printedInvoiceIds = groupedPayments
                    .filter(p => p.printed_invoice_id)
                    .map(p => p.printed_invoice_id as string);
                  
                  // جلب بيانات المهام المجمعة
                  const compositeTaskMap: Record<string, any> = {};
                  if (compositeTaskIds.length > 0) {
                    const { data: tasksData } = await supabase
                      .from('composite_tasks')
                      .select('id, task_type, customer_total, paid_amount, installation_task_id, print_task_id, cutout_task_id')
                      .in('id', compositeTaskIds);
                    (tasksData || []).forEach((t: any) => {
                      const remaining = (Number(t.customer_total) || 0) - (Number(t.paid_amount) || 0);
                      compositeTaskMap[t.id] = { ...t, calculatedRemaining: Math.max(0, remaining) };
                    });
                  }
                  
                  // جلب بيانات فواتير المبيعات
                  const salesInvoiceMap: Record<string, any> = {};
                  if (salesInvoiceIds.length > 0) {
                    const { data: invoicesData } = await supabase
                      .from('sales_invoices')
                      .select('id, invoice_number, invoice_name, total_amount, paid_amount, notes')
                      .in('id', salesInvoiceIds);
                    (invoicesData || []).forEach((i: any) => {
                      const remaining = (Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0);
                      salesInvoiceMap[i.id] = { ...i, calculatedRemaining: Math.max(0, remaining) };
                    });
                  }

                  // جلب بيانات فواتير الطباعة
                  const printedInvoiceMap: Record<string, any> = {};
                  if (printedInvoiceIds.length > 0) {
                    const { data: invoicesData } = await supabase
                      .from('printed_invoices')
                      .select('id, invoice_number, total_amount, paid_amount, notes')
                      .in('id', printedInvoiceIds);
                    (invoicesData || []).forEach((i: any) => {
                      const remaining = (Number(i.total_amount) || 0) - (Number(i.paid_amount) || 0);
                      printedInvoiceMap[i.id] = { ...i, calculatedRemaining: Math.max(0, remaining) };
                    });
                  }

                  const distributedContracts = groupedPayments.map((p) => {
                    // تحديد نوع الدفعة
                    if (p.composite_task_id) {
                      const task = compositeTaskMap[p.composite_task_id];
                      // بناء وصف المهمة بناءً على المكونات الفعلية
                      const components: string[] = [];
                      if (task?.print_task_id) components.push('طباعة');
                      if (task?.cutout_task_id) components.push('قص');
                      if (task?.installation_task_id) components.push('تركيب');
                      const taskDescription = components.length > 0 ? components.join(' + ') : 'مهمة مجمعة';
                      
                      return {
                        contractNumber: '—',
                        adType: taskDescription,
                        amount: Number(p.amount) || 0,
                        total: task?.customer_total ?? null,
                        totalPaid: task?.paid_amount ?? null,
                        remaining: task?.calculatedRemaining ?? null,
                        entityType: 'composite_task' as const,
                        compositeTaskType: taskDescription,
                      };
                    }
                    
                    if (p.sales_invoice_id) {
                      const invoice = salesInvoiceMap[p.sales_invoice_id];
                      return {
                        contractNumber: invoice?.invoice_number || '—',
                        adType: invoice?.invoice_name || invoice?.notes || 'مبيعات',
                        amount: Number(p.amount) || 0,
                        total: invoice?.total_amount ?? null,
                        totalPaid: invoice?.paid_amount ?? null,
                        remaining: invoice?.calculatedRemaining ?? null,
                        entityType: 'sales_invoice' as const,
                      };
                    }

                    if (p.printed_invoice_id) {
                      const invoice = printedInvoiceMap[p.printed_invoice_id];
                      return {
                        contractNumber: invoice?.invoice_number || '—',
                        adType: invoice?.notes || 'طباعة',
                        amount: Number(p.amount) || 0,
                        total: invoice?.total_amount ?? null,
                        totalPaid: invoice?.paid_amount ?? null,
                        remaining: invoice?.calculatedRemaining ?? null,
                        entityType: 'printed_invoice' as const,
                      };
                    }
                    
                    // Default: عقد
                    const cn = p.contract_number ? Number(p.contract_number) : null;
                    const c = cn ? contractMap[cn] : null;
                    return {
                      contractNumber: String(p.contract_number || '—'),
                      adType: c?.['Ad Type'] || 'لوحة إعلانية',
                      amount: Number(p.amount) || 0,
                      total: c?.Total ?? null,
                      totalPaid: c?.calculatedPaid ?? null,
                      remaining: c?.calculatedRemaining ?? null,
                      entityType: 'contract' as const,
                    };
                  });

                  // ✅ حساب المتبقي الإجمالي للعميل (بدون إيجارات الصديقة)
                  let remainingDebt: number | undefined = undefined;
                  
                  if (customerData.id) {
                    // استخدام نفس منطق SummaryCards مع تصفية بتاريخ الدفعة
                    const { calculateTotalRemainingDebtExcludingFriendRentals } = await import('./BillingUtils');
                    
                    // ✅ تاريخ الدفعة لتصفية البيانات حتى وقت الدفعة فقط
                    const paymentDate = firstPaymentData.paid_at || new Date().toISOString();
                    const paymentDateOnly = paymentDate.split('T')[0];
                    
                    // جلب البيانات مع تصفية بتاريخ الدفعة
                    const [contractsRes, paymentsRes, salesRes, printedRes, purchaseRes, discountsRes, compositeRes] = await Promise.all([
                      supabase.from('Contract').select('*').eq('customer_id', customerData.id),
                      supabase.from('customer_payments').select('*').eq('customer_id', customerData.id).lte('paid_at', paymentDate),
                      supabase.from('sales_invoices').select('*').eq('customer_id', customerData.id).lte('invoice_date', paymentDateOnly),
                      supabase.from('printed_invoices').select('*').eq('customer_id', customerData.id).lte('invoice_date', paymentDateOnly),
                      supabase.from('purchase_invoices').select('*').eq('customer_id', customerData.id).lte('purchase_date', paymentDateOnly),
                      supabase.from('customer_general_discounts').select('*').eq('customer_id', customerData.id).eq('status', 'active').lte('applied_date', paymentDateOnly),
                      supabase.from('composite_tasks').select('*').eq('customer_id', customerData.id)
                    ]);
                    
                    const contracts = contractsRes.data || [];
                    const payments = paymentsRes.data || [];
                    const salesInvoices = salesRes.data || [];
                    const printedInvoices = printedRes.data || [];
                    const purchaseInvoices = purchaseRes.data || [];
                    const discounts = discountsRes.data || [];
                    const compositeTasks = compositeRes.data || [];
                    
                    // حساب إجمالي الخصومات
                    const totalDiscounts = discounts.reduce((sum, d) => sum + (Number(d.discount_value) || 0), 0);
                    
                    // حساب إيجارات الصديقة
                    let totalFriendRentals = 0;
                    contracts.forEach((contract: any) => {
                      if (contract.friend_rental_data && Array.isArray(contract.friend_rental_data)) {
                        contract.friend_rental_data.forEach((rental: any) => {
                          totalFriendRentals += Number(rental.friendRentalCost) || 0;
                        });
                      }
                    });
                    
                    // استخدام الدالة الموحدة
                    remainingDebt = calculateTotalRemainingDebtExcludingFriendRentals(
                      contracts as any[],
                      payments as any[],
                      salesInvoices,
                      printedInvoices,
                      purchaseInvoices,
                      totalDiscounts,
                      compositeTasks,
                      totalFriendRentals
                    );
                  } else if (typeof firstPaymentData.remaining_debt === 'number') {
                    remainingDebt = firstPaymentData.remaining_debt;
                  }

                  await printReceipt({
                    payment: {
                      id: firstPaymentData.id,
                      amount: totalAmount,
                      paid_at: firstPaymentData.paid_at,
                      method: firstPaymentData.method || 'نقدي',
                      reference: firstPaymentData.reference || undefined,
                      notes: firstPaymentData.notes || undefined,
                      contract_number: null,
                      collector_name: firstPaymentData.collector_name || undefined,
                      receiver_name: firstPaymentData.receiver_name || undefined,
                      delivery_location: firstPaymentData.delivery_location || undefined,
                      source_bank: firstPaymentData.source_bank || undefined,
                      destination_bank: firstPaymentData.destination_bank || undefined,
                      transfer_reference: firstPaymentData.transfer_reference || undefined,
                      distributed_payment_id: firstPaymentData.distributed_payment_id || undefined,
                    },
                    customerData: {
                      id: customerData.id,
                      name: customerData.name,
                      company: customerData.company || undefined,
                      phone: customerData.phone || undefined,
                    },
                    currency: {
                      code: 'LYD',
                      symbol: 'د.ل',
                      name: 'دينار ليبي',
                      writtenName: 'دينار ليبي',
                    },
                    distributedContracts,
                    ...(typeof remainingDebt === 'number'
                      ? { balanceInfo: { remainingBalance: remainingDebt, totalPaid: 0 } }
                      : {}),
                  });
                }}
                className="flex-1 bg-primary hover:bg-primary/90 gap-2"
                size="lg"
              >
                <FileText className="h-5 w-5" />
                طباعة إيصال موحد
              </Button>
              {onEdit && (
                <Button
                  onClick={() => {
                    onEdit();
                    onOpenChange(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                  size="lg"
                >
                  <Edit className="h-5 w-5" />
                  تعديل الدفعة
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm(`هل أنت متأكد من حذف هذه الدفعة الموزعة على ${groupedPayments.length} عقود؟`)) {
                    onDelete();
                    onOpenChange(false);
                  }
                }}
                className="gap-2"
                size="lg"
              >
                <Trash2 className="h-5 w-5" />
                حذف الدفعة
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                size="lg"
              >
                إغلاق
              </Button>
            </div>
          </div>

        {/* Dialog for Intermediary Receipt */}
        <IntermediaryReceiptPrintDialog
          open={intermediaryPrintOpen}
          onOpenChange={setIntermediaryPrintOpen}
          groupedPayments={groupedPayments}
          totalAmount={totalAmount}
          customerName={customerName}
        />

        {/* Dialog for Converting to Custody */}
        <ConvertToCustodyDialog
          open={custodyDialogOpen}
          onOpenChange={setCustodyDialogOpen}
          groupedPayments={groupedPayments}
          totalAmount={totalAmount}
          distributedPaymentId={firstPayment.distributed_payment_id || ''}
          onSuccess={() => {
            toast.success('تم التحويل إلى عهدة بنجاح - يمكنك مراجعتها في صفحة العهد المالية');
            // إعادة تحميل معلومات العهدة
            if (firstPayment.distributed_payment_id) {
              loadCustodyInfo(firstPayment.distributed_payment_id);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
