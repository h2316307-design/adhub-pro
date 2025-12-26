import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ContractRow, PaymentRow } from './BillingTypes';
import { FileText, CreditCard, Calendar, Clock, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';

interface ContractSectionProps {
  contracts: ContractRow[];
  payments: PaymentRow[];
  onBulkPayment?: (selectedContracts: number[]) => void;
  onAddPayment?: (contractNumber: number) => void;
  selectedContracts?: Set<number>;
  onSelectedContractsChange?: (selected: Set<number>) => void;
  onDistributePayment?: () => void;
}

export function ContractSection({ 
  contracts, 
  payments, 
  onBulkPayment, 
  onAddPayment,
  selectedContracts: externalSelectedContracts,
  onSelectedContractsChange,
  onDistributePayment
}: ContractSectionProps) {
  const [internalSelectedContracts, setInternalSelectedContracts] = useState<Set<number>>(new Set());
  
  const selectedContracts = externalSelectedContracts ?? internalSelectedContracts;
  const setSelectedContracts = onSelectedContractsChange ?? setInternalSelectedContracts;

  const toggleContract = (contractNumber: number) => {
    const newSelected = new Set(selectedContracts);
    if (newSelected.has(contractNumber)) {
      newSelected.delete(contractNumber);
    } else {
      newSelected.add(contractNumber);
    }
    setSelectedContracts(newSelected);
  };

  const toggleAll = () => {
    if (selectedContracts.size === contracts.length) {
      setSelectedContracts(new Set());
    } else {
      setSelectedContracts(new Set(contracts.map(c => Number(c.Contract_Number))));
    }
  };

  const handleBulkPayment = () => {
    if (onBulkPayment && selectedContracts.size > 0) {
      onBulkPayment(Array.from(selectedContracts));
    }
  };

  // حساب الإحصائيات
  const totalContractValue = contracts.reduce((sum, c) => sum + (Number((c as any)['Total'] ?? c['Total Rent'] ?? 0) || 0), 0);
  const totalPaidValue = contracts.reduce((sum, contract) => {
    const contractPayments = payments
      .filter(p => {
        const paymentContractNum = String(p.contract_number || '');
        const contractNum = String(contract.Contract_Number || '');
        const isMatch = paymentContractNum === contractNum;
        const isValidPaymentType = p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment';
        return isMatch && isValidPaymentType;
      })
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return sum + contractPayments;
  }, 0);
  const totalRemaining = Math.max(0, totalContractValue - totalPaidValue);
  const activeContracts = contracts.filter(c => {
    const endDate = c['End Date'] ? new Date(c['End Date']) : null;
    return endDate && new Date() <= endDate;
  }).length;

  return (
    <div className="container mx-auto px-6 mb-6">
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white py-5">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-white">العقود</CardTitle>
                <p className="text-white/70 text-sm mt-0.5">{contracts.length} عقد • {activeContracts} نشط</p>
              </div>
            </div>
            
            {/* إحصائيات سريعة */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-center">
                <p className="text-white/60 text-xs">الإجمالي</p>
                <p className="text-lg font-bold text-white">{totalContractValue.toLocaleString('ar-LY')}</p>
              </div>
              <div className="text-center">
                <p className="text-white/60 text-xs">المدفوع</p>
                <p className="text-lg font-bold text-emerald-400">{totalPaidValue.toLocaleString('ar-LY')}</p>
              </div>
              <div className="text-center">
                <p className="text-white/60 text-xs">المتبقي</p>
                <p className="text-lg font-bold text-rose-400">{totalRemaining.toLocaleString('ar-LY')}</p>
              </div>
            </div>

            {selectedContracts.size > 0 && (
              <div className="flex gap-2">
                <Button 
                  onClick={handleBulkPayment}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-md"
                  size="sm"
                >
                  <CreditCard className="h-4 w-4 ml-2" />
                  دفع جماعي ({selectedContracts.size})
                </Button>
                {onDistributePayment && (
                  <Button 
                    onClick={onDistributePayment}
                    className="bg-blue-500 hover:bg-blue-600 text-white shadow-md"
                    size="sm"
                  >
                    توزيع دفعة ({selectedContracts.size})
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {contracts.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-right font-bold w-12">
                      <Checkbox 
                        checked={selectedContracts.size === contracts.length && contracts.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="text-right font-bold">رقم العقد</TableHead>
                    <TableHead className="text-right font-bold">نوع الإعلان</TableHead>
                    <TableHead className="text-right font-bold text-center">اللوحات</TableHead>
                    <TableHead className="text-right font-bold">الفترة</TableHead>
                    <TableHead className="text-right font-bold">الحالة</TableHead>
                    <TableHead className="text-right font-bold">القيمة</TableHead>
                    <TableHead className="text-right font-bold">المدفوع</TableHead>
                    <TableHead className="text-right font-bold">المتبقي</TableHead>
                    <TableHead className="text-right font-bold">نسبة السداد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map(contract => {
                    const contractPayments = payments
                      .filter(p => {
                        const paymentContractNum = String(p.contract_number || '');
                        const contractNum = String(contract.Contract_Number || '');
                        const isMatch = paymentContractNum === contractNum;
                        const isValidPaymentType = p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment';
                        return isMatch && isValidPaymentType;
                      })
                      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
                    
                    const contractTotal = Number((contract as any)['Total'] ?? contract['Total Rent'] ?? 0) || 0;
                    const contractRemaining = Math.max(0, contractTotal - contractPayments);
                    const isPaid = contractRemaining === 0 && contractTotal > 0;
                    const paymentPercentage = contractTotal > 0 ? Math.round((contractPayments / contractTotal) * 100) : 0;
                    
                    const today = new Date();
                    const endDate = contract['End Date'] ? new Date(contract['End Date']) : null;
                    const startDate = contract['Contract Date'] ? new Date(contract['Contract Date']) : null;
                    const isActive = endDate && today <= endDate;
                    
                    return (
                      <TableRow 
                        key={String(contract.Contract_Number)} 
                        className={`group transition-all duration-200 ${
                          selectedContracts.has(Number(contract.Contract_Number)) 
                            ? 'bg-primary/5' 
                            : 'hover:bg-accent/50'
                        }`}
                      >
                        <TableCell className="py-4">
                          <Checkbox 
                            checked={selectedContracts.has(Number(contract.Contract_Number))}
                            onCheckedChange={() => toggleContract(Number(contract.Contract_Number))}
                          />
                        </TableCell>
                        <TableCell className="font-bold text-primary py-4">
                          #{String(contract.Contract_Number || '')}
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant="outline" className="font-medium">
                            {contract['Ad Type'] || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">
                            {contract.billboards_count || 0}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col gap-0.5 text-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{startDate ? startDate.toLocaleDateString('ar-LY') : '—'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{endDate ? endDate.toLocaleDateString('ar-LY') : '—'}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge className={`text-xs ${
                            isActive 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          }`} variant="outline">
                            {isActive ? (
                              <><CheckCircle2 className="h-3 w-3 ml-1" />ساري</>
                            ) : (
                              <><AlertCircle className="h-3 w-3 ml-1" />منتهي</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="font-bold text-foreground">{contractTotal.toLocaleString('ar-LY')}</span>
                          <span className="text-xs text-muted-foreground mr-1">د.ل</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{contractPayments.toLocaleString('ar-LY')}</span>
                          <span className="text-xs text-muted-foreground mr-1">د.ل</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className={`font-bold ${contractRemaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {contractRemaining.toLocaleString('ar-LY')}
                          </span>
                          <span className="text-xs text-muted-foreground mr-1">د.ل</span>
                        </TableCell>
                        <TableCell className="py-4 min-w-[120px]">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${
                                isPaid ? 'text-emerald-600' : 
                                paymentPercentage >= 50 ? 'text-amber-600' : 'text-rose-600'
                              }`}>
                                {paymentPercentage}%
                              </span>
                              {isPaid && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                            </div>
                            <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isPaid ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                                  paymentPercentage >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                                  'bg-gradient-to-r from-rose-500 to-rose-400'
                                }`}
                                style={{ width: `${Math.min(100, paymentPercentage)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">لا توجد عقود</p>
              <p className="text-sm">لم يتم العثور على عقود لهذا العميل</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
