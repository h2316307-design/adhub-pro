import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Clock, DollarSign, FileText } from 'lucide-react';
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

  const printOverdueNotice = (payment: OverdueInstallment) => {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>إشعار تأخير دفعة - عقد ${payment.contractNumber}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
          
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body {
            font-family: 'Noto Sans Arabic', Arial, sans-serif;
            direction: rtl;
            background: white;
            padding: 30mm;
            font-size: 14px;
            line-height: 1.6;
          }
          
          .notice-container {
            max-width: 170mm;
            margin: 0 auto;
            border: 3px solid #dc2626;
            border-radius: 10px;
            padding: 30px;
          }
          
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #dc2626;
            padding-bottom: 20px;
          }
          
          .header h1 {
            font-size: 28px;
            color: #dc2626;
            margin-bottom: 10px;
          }
          
          .header .subtitle {
            font-size: 16px;
            color: #666;
          }
          
          .notice-content {
            background: #fef2f2;
            padding: 25px;
            border-radius: 8px;
            border: 2px solid #fee2e2;
            margin-bottom: 25px;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            padding: 12px;
            background: white;
            border-radius: 5px;
          }
          
          .info-row strong {
            color: #7f1d1d;
            font-weight: bold;
          }
          
          .amount-highlight {
            background: #dc2626;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px;
            font-size: 20px;
            font-weight: bold;
            margin: 20px 0;
          }
          
          .warning-box {
            background: #fef3c7;
            border: 2px solid #f59e0b;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: center;
          }
          
          .warning-box strong {
            color: #92400e;
            font-size: 16px;
          }
          
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          
          @media print {
            body { padding: 0; }
            .notice-container { border: 3px solid #dc2626; }
          }
        </style>
      </head>
      <body>
        <div class="notice-container">
          <div class="header">
            <h1>⚠️ إشعار تأخير دفعة</h1>
            <div class="subtitle">تذكير بدفعة متأخرة</div>
          </div>
          
          <div class="notice-content">
            <div class="info-row">
              <strong>رقم العقد:</strong>
              <span>${payment.contractNumber}</span>
            </div>
            
            <div class="info-row">
              <strong>اسم العميل:</strong>
              <span>${payment.customerName}</span>
            </div>
            
            <div class="info-row">
              <strong>تاريخ الاستحقاق:</strong>
              <span>${new Date(payment.dueDate).toLocaleDateString('ar-LY')}</span>
            </div>
            
            <div class="info-row">
              <strong>عدد أيام التأخير:</strong>
              <span style="color: #dc2626; font-weight: bold;">${payment.daysOverdue} يوم</span>
            </div>
            
            <div class="info-row">
              <strong>وصف الدفعة:</strong>
              <span>${payment.description}</span>
            </div>
          </div>
          
          <div class="amount-highlight">
            المبلغ المستحق: ${payment.installmentAmount.toLocaleString('ar-LY')} د.ل
          </div>
          
          <div class="warning-box">
            <strong>⚠️ تنبيه هام</strong><br>
            يرجى سداد المبلغ المستحق في أقرب وقت ممكن لتجنب أي إجراءات قانونية
          </div>
          
          <div class="footer">
            <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-LY')} - ${new Date().toLocaleTimeString('ar-LY')}</p>
            <p>هذا إشعار رسمي صادر من نظام إدارة العقود</p>
          </div>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      toast.error('يرجى السماح بالنوافذ المنبثقة للطباعة');
    }
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
                      {payment.installmentAmount.toLocaleString('ar-LY')} د.ل
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