import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ContractRow, PaymentRow } from './BillingTypes';

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

  return (
    <Card className="expenses-preview-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="expenses-preview-title">العقود ({contracts.length})</CardTitle>
        {selectedContracts.size > 0 && (
          <div className="flex gap-2">
            <Button 
              onClick={handleBulkPayment}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            >
              دفع جماعي ({selectedContracts.size})
            </Button>
            {onDistributePayment && (
              <Button 
                onClick={onDistributePayment}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              >
                توزيع دفعة ({selectedContracts.size})
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {contracts.length ? (
          <div className="expenses-table-container">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary text-primary-foreground">
                  <TableHead className="text-right text-primary-foreground w-12">
                    <Checkbox 
                      checked={selectedContracts.size === contracts.length && contracts.length > 0}
                      onCheckedChange={toggleAll}
                      className="border-primary-foreground"
                    />
                  </TableHead>
                  <TableHead className="text-right text-primary-foreground">رقم العقد</TableHead>
                  <TableHead className="text-right text-primary-foreground">نوع الإعلان</TableHead>
                  <TableHead className="text-right text-primary-foreground">عدد اللوحات</TableHead>
                  <TableHead className="text-right text-primary-foreground">تاريخ البداية</TableHead>
                  <TableHead className="text-right text-primary-foreground">تاريخ النهاية</TableHead>
                  <TableHead className="text-right text-primary-foreground">الحالة</TableHead>
                  <TableHead className="text-right text-primary-foreground">القيمة الإجمالية</TableHead>
                  <TableHead className="text-right text-primary-foreground">المدفوع للعقد</TableHead>
                  <TableHead className="text-right text-primary-foreground">المتبقي</TableHead>
                  <TableHead className="text-right text-primary-foreground">حالة الدفع</TableHead>
                  <TableHead className="text-right text-primary-foreground">إجراءات</TableHead>
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
                  const isPartiallyPaid = contractPayments > 0 && contractRemaining > 0;
                  const paymentPercentage = contractTotal > 0 ? Math.round((contractPayments / contractTotal) * 100) : 0;
                  
                  const today = new Date();
                  const endDate = contract['End Date'] ? new Date(contract['End Date']) : null;
                  const isActive = endDate && today <= endDate;
                  
                  // حساب تاريخ آخر دفعة لهذا العقد
                  const lastPayment = payments
                    .filter(p => {
                      const paymentContractNum = String(p.contract_number || '');
                      const contractNum = String(contract.Contract_Number || '');
                      const isMatch = paymentContractNum === contractNum;
                      const isValidPaymentType = p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment';
                      return isMatch && isValidPaymentType;
                    })
                    .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())[0];
                  
                  return (
                    <TableRow key={String(contract.Contract_Number)} className="hover:bg-card/50">
                      <TableCell>
                        <Checkbox 
                          checked={selectedContracts.has(Number(contract.Contract_Number))}
                          onCheckedChange={() => toggleContract(Number(contract.Contract_Number))}
                        />
                      </TableCell>
                      <TableCell className="expenses-contract-number">
                        {String(contract.Contract_Number || '')}
                      </TableCell>
                      <TableCell>{contract['Ad Type'] || '—'}</TableCell>
                      <TableCell className="font-semibold text-primary">
                        {contract.billboards_count || 0}
                      </TableCell>
                      <TableCell>
                        {contract['Contract Date'] 
                          ? new Date(contract['Contract Date']).toLocaleDateString('ar-LY') 
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {contract['End Date'] 
                          ? new Date(contract['End Date']).toLocaleDateString('ar-LY') 
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          isActive 
                            ? 'bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-400 border border-green-500/30' 
                            : 'bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-400 border border-red-500/30'
                        }`}>
                          {isActive ? 'ساري' : 'منتهي'}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold expenses-amount-calculated">
                        {contractTotal.toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="stat-green font-medium">
                        {contractPayments.toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className={contractRemaining > 0 ? 'stat-red font-semibold' : 'stat-green font-medium'}>
                        {contractRemaining.toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          <span className={`px-2 py-1 rounded text-center font-semibold ${
                            isPaid 
                              ? 'bg-green-500/20 text-green-400' 
                              : isPartiallyPaid
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {isPaid ? 'مدفوع' : isPartiallyPaid ? `مدفوع جزئياً (${paymentPercentage}%)` : 'غير مدفوع'}
                          </span>
                          {lastPayment && (
                            <span className="text-muted-foreground">
                              آخر دفعة: {new Date(lastPayment.paid_at).toLocaleDateString('ar-LY')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {/* تم إزالة زر إضافة دفعة */}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="expenses-empty-state text-center py-8">لا توجد عقود</div>
        )}
      </CardContent>
    </Card>
  );
}