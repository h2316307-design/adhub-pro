import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingUp, TrendingDown, Receipt, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface GeneralTransaction {
  id: string;
  paid_at: string;
  amount: number;
  entry_type: 'general_debit' | 'general_credit';
  notes: string | null;
  reference: string | null;
  method: string | null;
}

interface GeneralTransactionsSectionProps {
  transactions: GeneralTransaction[];
  onAddDebit: () => void;
  onAddCredit: () => void;
  onRefresh: () => void;
}

export default function GeneralTransactionsSection({
  transactions,
  onAddDebit,
  onAddCredit,
  onRefresh
}: GeneralTransactionsSectionProps) {
  
  const debits = transactions.filter(t => t.entry_type === 'general_debit');
  const credits = transactions.filter(t => t.entry_type === 'general_credit');
  
  const totalDebits = debits.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalCredits = credits.reduce((sum, t) => sum + Number(t.amount), 0);
  
  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المعاملة؟')) return;
    
    try {
      const { error } = await supabase
        .from('customer_payments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('تم حذف المعاملة بنجاح');
      onRefresh();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('فشل حذف المعاملة');
    }
  };
  
  return (
    <div className="space-y-4">
      {/* ملخص الواردات والصادرات */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              إجمالي الواردات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {totalDebits.toLocaleString('ar-LY')} د.ل
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {debits.length} معاملة
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              إجمالي الصادرات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {totalCredits.toLocaleString('ar-LY')} د.ل
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {credits.length} معاملة
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-primary/10 to-primary-glow/5 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              الصافي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(totalDebits - totalCredits) > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {Math.abs(totalDebits - totalCredits).toLocaleString('ar-LY')} د.ل
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(totalDebits - totalCredits) > 0 ? 'مستحق للعميل' : 'مستحق من العميل'}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* أزرار الإضافة */}
      <div className="flex gap-3">
        <Button
          onClick={onAddDebit}
          className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          إضافة وارد عام
        </Button>
        <Button
          onClick={onAddCredit}
          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          إضافة صادر عام
        </Button>
      </div>
      
      {/* قائمة الواردات */}
      {debits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-400">
              <TrendingUp className="h-5 w-5" />
              الواردات العامة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {debits.map(transaction => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 bg-accent/50 rounded-lg border border-red-500/20"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        وارد عام
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(transaction.paid_at).toLocaleDateString('ar-LY')}
                      </span>
                    </div>
                    <div className="text-sm text-foreground">
                      {transaction.notes || 'بدون ملاحظات'}
                    </div>
                    {transaction.reference && (
                      <div className="text-xs text-muted-foreground mt-1">
                        المرجع: {transaction.reference}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-400">
                        {Number(transaction.amount).toLocaleString('ar-LY')} د.ل
                      </div>
                      {transaction.method && (
                        <div className="text-xs text-muted-foreground">
                          {transaction.method}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(transaction.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* قائمة الصادرات */}
      {credits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-green-400">
              <TrendingDown className="h-5 w-5" />
              الصادرات العامة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {credits.map(transaction => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 bg-accent/50 rounded-lg border border-green-500/20"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        صادر عام
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(transaction.paid_at).toLocaleDateString('ar-LY')}
                      </span>
                    </div>
                    <div className="text-sm text-foreground">
                      {transaction.notes || 'بدون ملاحظات'}
                    </div>
                    {transaction.reference && (
                      <div className="text-xs text-muted-foreground mt-1">
                        المرجع: {transaction.reference}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-400">
                        {Number(transaction.amount).toLocaleString('ar-LY')} د.ل
                      </div>
                      {transaction.method && (
                        <div className="text-xs text-muted-foreground">
                          {transaction.method}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(transaction.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {transactions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              لا توجد معاملات عامة حتى الآن
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              استخدم الأزرار أعلاه لإضافة واردات أو صادرات خارج العقود
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
