import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Clock, DollarSign, FileText } from 'lucide-react';
import { formatAmount } from '@/lib/formatUtils';
import { showPrintPreview } from '@/components/print/PrintPreviewDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface OverdueInstallment {
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  installmentAmount: number;
  dueDate: string;
  description: string;
  daysOverdue: number;
}

export function OverduePaymentsAlert() {
  const [overduePayments, setOverduePayments] = useState<OverdueInstallment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverduePayments();
  }, []);

  const loadOverduePayments = async () => {
    try {
      setLoading(true);
      
      // جلب جميع العقود
      const { data: contracts, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", customer_id, installments_data, "Total", "Contract Date"');

      if (error) {
        console.error('Error loading contracts:', error);
        return;
      }

      const today = new Date();
      const overdue: OverdueInstallment[] = [];

      // معالجة كل عقد
      for (const contract of contracts || []) {
        try {
          const contractTotal = Number(contract['Total']) || 0;
          
          // Get total paid for this contract
          const { data: contractPayments } = await supabase
            .from('customer_payments')
            .select('amount')
            .eq('contract_number', contract.Contract_Number);

          const totalContractPaid = contractPayments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
          const remainingTotal = contractTotal - totalContractPaid;

          // Skip if fully paid
          if (remainingTotal <= 0) continue;

          let installments = [];
          
          if (typeof contract.installments_data === 'string') {
            installments = JSON.parse(contract.installments_data);
          } else if (Array.isArray(contract.installments_data)) {
            installments = contract.installments_data;
          }

          // Case 1: Contract has installments
          if (installments.length > 0) {
            // التحقق من كل قسط
            for (const installment of installments) {
              if (installment.dueDate) {
                const dueDate = new Date(installment.dueDate);
                const diffTime = today.getTime() - dueDate.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // إذا تجاوز تاريخ الاستحقاق
                if (diffDays > 0) {
                  // التحقق من أن القسط لم يتم دفعه بالكامل
                  const { data: payments } = await supabase
                    .from('customer_payments')
                    .select('amount')
                    .eq('contract_number', contract.Contract_Number)
                    .gte('paid_at', installment.dueDate);

                  const totalPaid = payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
                  
                  // إذا لم يتم دفع المبلغ بالكامل
                  if (totalPaid < installment.amount) {
                    overdue.push({
                      contractNumber: contract.Contract_Number,
                      customerName: contract['Customer Name'] || 'غير معروف',
                      customerId: contract.customer_id,
                      installmentAmount: installment.amount - totalPaid,
                      dueDate: installment.dueDate,
                      description: installment.description || 'دفعة',
                      daysOverdue: diffDays
                    });
                  }
                }
              }
            }
          } 
          // Case 2: Contract has no installments - due date is 15 days after contract date
          else if (contract['Contract Date']) {
            const contractDate = new Date(contract['Contract Date']);
            const dueDate = new Date(contractDate);
            dueDate.setDate(dueDate.getDate() + 15);
            
            const diffTime = today.getTime() - dueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 0 && remainingTotal > 0) {
              overdue.push({
                contractNumber: contract.Contract_Number,
                customerName: contract['Customer Name'] || 'غير معروف',
                customerId: contract.customer_id,
                installmentAmount: remainingTotal,
                dueDate: dueDate.toISOString(),
                description: 'إجمالي العقد',
                daysOverdue: diffDays
              });
            }
          }
        } catch (e) {
          console.error('Error parsing installments for contract:', contract.Contract_Number, e);
        }
      }

      // ترتيب حسب المبلغ (الأعلى قيمة أولاً) ثم عرض أعلى 5
      overdue.sort((a, b) => b.installmentAmount - a.installmentAmount);
      setOverduePayments(overdue.slice(0, 5));
    } catch (error) {
      console.error('Error loading overdue payments:', error);
      toast.error('خطأ في تحميل الدفعات المتأخرة');
    } finally {
      setLoading(false);
    }
  };

  const printOverdueNotice = async (payment: OverdueInstallment) => {
    const { generateOverdueNoticeHTML } = await import('@/lib/overdueNoticeGenerator');
    const html = await generateOverdueNoticeHTML({
      customerName: payment.customerName,
      contractNumber: payment.contractNumber,
      installmentNumber: 1,
      dueDate: payment.dueDate,
      amount: payment.installmentAmount,
      overdueDays: payment.daysOverdue,
      notes: payment.description,
    });
    showPrintPreview(html, `إشعار تأخير - عقد ${payment.contractNumber}`);
  };

  if (loading) {
    return (
      <Card className="border-warning">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5 animate-spin" />
            <span>جاري تحميل الدفعات المتأخرة...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (overduePayments.length === 0) {
    return (
      <Card className="border-success">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-green-600">
            <DollarSign className="h-5 w-5" />
            <span className="font-medium">لا توجد دفعات متأخرة! جميع الدفعات محدثة.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive bg-gradient-to-br from-destructive/5 to-destructive/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-6 w-6" />
          دفعات متأخرة ({overduePayments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {overduePayments.map((payment, index) => (
            <Card
              key={`${payment.contractNumber}-${index}`}
              className="border-destructive/30 bg-background hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="destructive" className="text-xs">
                      {payment.daysOverdue} يوم
                    </Badge>
                    <span className="font-bold text-foreground">#{payment.contractNumber}</span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="font-semibold text-foreground truncate" title={payment.customerName}>
                      {payment.customerName}
                    </div>
                    <div className="text-destructive font-bold text-lg">
                      {formatAmount(payment.installmentAmount)} د.ل
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(payment.dueDate).toLocaleDateString('ar-LY')}
                    </div>
                    <div className="text-xs text-muted-foreground truncate" title={payment.description}>
                      {payment.description}
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => printOverdueNotice(payment)}
                    className="w-full text-xs"
                  >
                    <FileText className="h-3 w-3 ml-1" />
                    طباعة
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}