import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface ContractRow {
  'Contract_Number': number;
  'Customer Name': string;
  'Total': number;
  'End Date': string;
  'Contract Date': string;
}

interface UnpaidContractsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: ContractRow[];
  getContractPayments: (contractNumber: number) => number;
  getContractRemaining: (contract: ContractRow) => number;
}

export function UnpaidContractsDialog({
  open,
  onOpenChange,
  contracts,
  getContractPayments,
  getContractRemaining
}: UnpaidContractsDialogProps) {
  // فلترة العقود غير المسددة والمسدد جزء منها
  const unpaidContracts = contracts
    .map(contract => {
      const total = Number(contract.Total) || 0;
      const paid = getContractPayments(contract.Contract_Number);
      const remaining = getContractRemaining(contract);
      const paidPercentage = total > 0 ? (paid / total) * 100 : 0;
      
      return {
        ...contract,
        total,
        paid,
        remaining,
        paidPercentage,
        status: remaining === 0 ? 'paid' : paidPercentage > 0 ? 'partial' : 'unpaid'
      };
    })
    .filter(contract => contract.status !== 'paid') // إزالة العقود المسددة بالكامل
    .sort((a, b) => b.remaining - a.remaining); // ترتيب حسب المبلغ المتبقي (الأكبر أولاً)

  const totalUnpaid = unpaidContracts.reduce((sum, contract) => sum + contract.remaining, 0);
  const partiallyPaid = unpaidContracts.filter(c => c.status === 'partial').length;
  const fullyUnpaid = unpaidContracts.filter(c => c.status === 'unpaid').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-red-500" />
            كشف العقود غير المسددة
          </DialogTitle>
        </DialogHeader>

        {/* ملخص سريع */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">إجمالي المتبقي</p>
                <p className="text-3xl font-bold text-red-600">
                  {totalUnpaid.toLocaleString('ar-LY')} د.ل
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">عقود مسدد جزء منها</p>
                <p className="text-3xl font-bold text-orange-600">
                  {partiallyPaid}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">عقود غير مسددة</p>
                <p className="text-3xl font-bold text-slate-600">
                  {fullyUnpaid}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* قائمة العقود */}
        <div className="space-y-3">
          {unpaidContracts.length === 0 ? (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="py-8">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-green-700">
                    تم تسديد جميع العقود بالكامل 🎉
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            unpaidContracts.map((contract) => (
              <Card 
                key={contract.Contract_Number}
                className={`border-r-4 ${
                  contract.status === 'unpaid' 
                    ? 'border-r-red-500 bg-red-50/30' 
                    : 'border-r-orange-500 bg-orange-50/30'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* معلومات العقد */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-slate-800">
                          عقد رقم {contract.Contract_Number}
                        </h3>
                        <Badge 
                          variant={contract.status === 'unpaid' ? 'destructive' : 'secondary'}
                          className={contract.status === 'unpaid' ? '' : 'bg-orange-500 text-white'}
                        >
                          {contract.status === 'unpaid' ? (
                            <>
                              <AlertCircle className="h-3 w-3 ml-1" />
                              غير مسدد
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3 ml-1" />
                              مسدد جزئياً ({contract.paidPercentage.toFixed(0)}%)
                            </>
                          )}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">تاريخ العقد:</span>
                          <span className="font-medium mr-2">
                            {contract['Contract Date'] ? new Date(contract['Contract Date']).toLocaleDateString('ar-LY') : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">تاريخ الانتهاء:</span>
                          <span className="font-medium mr-2">
                            {contract['End Date'] ? new Date(contract['End Date']).toLocaleDateString('ar-LY') : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* المبالغ */}
                    <div className="text-left space-y-1">
                      <div>
                        <p className="text-xs text-muted-foreground">إجمالي العقد</p>
                        <p className="text-lg font-semibold">
                          {contract.total.toLocaleString('ar-LY')} د.ل
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-green-600">المدفوع</p>
                        <p className="text-lg font-semibold text-green-600">
                          {contract.paid.toLocaleString('ar-LY')} د.ل
                        </p>
                      </div>
                      <div className="pt-1 border-t">
                        <p className="text-xs text-red-600">المتبقي</p>
                        <p className="text-2xl font-bold text-red-600">
                          {contract.remaining.toLocaleString('ar-LY')} د.ل
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* شريط التقدم */}
                  {contract.paidPercentage > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>نسبة السداد</span>
                        <span>{contract.paidPercentage.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all"
                          style={{ width: `${Math.min(contract.paidPercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* زر الإغلاق */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
