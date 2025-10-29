import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calendar, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface OverduePayment {
  customerId: string;
  customerName: string;
  contractNumber: number;
  amount: number;
  daysOverdue: number;
  dueDate: string;
}

export function TopOverduePayments() {
  const [overduePayments, setOverduePayments] = useState<OverduePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadTopOverduePayments();
  }, []);

  const loadTopOverduePayments = async () => {
    setLoading(true);
    try {
      const today = new Date();
      
      // جلب جميع العقود مع الدفعات
      const { data: contracts, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", customer_id, "End Date", Total, "Total Paid"')
        .not('"End Date"', 'is', null);

      if (error) throw error;

      const overdueList: OverduePayment[] = [];

      for (const contract of contracts || []) {
        const endDate = new Date(contract['End Date']);
        const diffTime = today.getTime() - endDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // إذا كان العقد منتهي ولديه رصيد متبقي
        if (diffDays > 0) {
          const total = Number(contract.Total || 0);
          const paid = Number(contract['Total Paid'] || 0);
          const remaining = total - paid;

          if (remaining > 0) {
            overdueList.push({
              customerId: contract.customer_id || '',
              customerName: contract['Customer Name'] || 'غير معروف',
              contractNumber: contract.Contract_Number,
              amount: remaining,
              daysOverdue: diffDays,
              dueDate: contract['End Date']
            });
          }
        }
      }

      // ترتيب حسب الأقدم (أكبر عدد أيام تأخير)
      overdueList.sort((a, b) => b.daysOverdue - a.daysOverdue);

      // أخذ أول 5
      setOverduePayments(overdueList.slice(0, 5));
    } catch (error) {
      console.error('Error loading overdue payments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-red-500/10 to-orange-500/5 border-red-500/20">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            جاري التحميل...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (overduePayments.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
        <CardHeader>
          <CardTitle className="text-green-400 flex items-center gap-2">
            ✅ لا توجد دفعات متأخرة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            جميع العقود مسددة أو ضمن المدة المحددة
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <Card className="bg-gradient-to-br from-red-500/10 to-orange-500/5 border-red-500/20">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-red-500/5 transition-colors">
            <CardTitle className="text-red-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <span>أقدم 5 دفعات متأخرة</span>
                <Badge variant="destructive" className="text-xs">
                  {overduePayments.length}
                </Badge>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {overduePayments.map((payment, index) => (
                <div
                  key={`${payment.customerId}-${payment.contractNumber}`}
                  className="bg-card/50 border border-red-500/30 rounded-lg p-3 hover:bg-card/70 transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/customer-billing?id=${payment.customerId}&name=${encodeURIComponent(payment.customerName)}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="destructive" className="text-xs">
                      {index + 1}. متأخر {payment.daysOverdue} يوم
                    </Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {payment.customerName}
                    </p>
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      عقد #{payment.contractNumber}
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(payment.dueDate).toLocaleDateString('ar-LY')}
                    </div>
                    
                    <div className="flex items-center gap-1 font-bold text-red-400 mt-2">
                      <DollarSign className="h-4 w-4" />
                      {payment.amount.toLocaleString('ar-LY')} د.ل
                    </div>
                  </div>
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full mt-2 text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/admin/customer-billing?id=${payment.customerId}&name=${encodeURIComponent(payment.customerName)}`);
                    }}
                  >
                    عرض الفواتير
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
