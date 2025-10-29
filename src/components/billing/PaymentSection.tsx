import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { PaymentRow } from './BillingTypes';
import { DistributedPaymentDetailsDialog } from './DistributedPaymentDetailsDialog';

interface PaymentSectionProps {
  payments: PaymentRow[];
  onEditReceipt: (payment: PaymentRow) => void;
  onDeleteReceipt: (id: string) => void;
  onPrintReceipt: (payment: PaymentRow) => void;
  onAddDebt: () => void;
  onAddAccountPayment: () => void;
  onAddPurchaseFromCustomer?: () => void;
  onDeleteDistributedPayment?: (distributedPaymentId: string) => void;
  onEditDistributedPayment?: (distributedPaymentId: string, payments: PaymentRow[]) => void;
}

const getPaymentTypeStyle = (entryType: string): string => {
  switch (entryType) {
    case 'receipt':
      return 'payment-type-receipt';
    case 'invoice':
      return 'payment-type-invoice';
    case 'debt':
      return 'payment-type-debt';
    case 'account_payment':
      return 'payment-type-account';
    default:
      return 'payment-type-default';
  }
};

const getPaymentTypeText = (entryType: string): string => {
  switch (entryType) {
    case 'payment':
      return 'دفعة';
    case 'account_payment':
      return 'دفعة حساب';
    case 'receipt':
      return 'إيصال';
    case 'debt':
      return 'دين سابق';
    case 'invoice':
      return 'فاتورة';
    case 'purchase_invoice':
      return 'فاتورة مشتريات';
    case 'sales_invoice':
      return 'فاتورة مبيعات';
    case 'printed_invoice':
      return 'فاتورة طباعة';
    case 'general_debit':
      return 'وارد عام';
    case 'general_credit':
      return 'صادر عام';
    default:
      return entryType || '—';
  }
};

const getPaymentTargetType = (payment: PaymentRow): string => {
  if (payment.contract_number) return 'عقد';
  if (payment.printed_invoice_id) return 'فاتورة طباعة';
  if (payment.sales_invoice_id) return 'فاتورة مبيعات';
  if (payment.purchase_invoice_id) return 'فاتورة مشتريات';
  if (payment.entry_type === 'payment') return 'دفعة';
  if (payment.entry_type === 'account_payment') return 'دفعة حساب';
  if (payment.entry_type === 'debt') return 'دين سابق';
  if (payment.entry_type === 'general_debit') return 'وارد عام';
  if (payment.entry_type === 'general_credit') return 'صادر عام';
  return '—';
};

const getPaymentTargetNumber = (payment: PaymentRow): string => {
  if (payment.contract_number) return `عقد رقم ${payment.contract_number}`;
  if (payment.printed_invoice_id) return `فاتورة طباعة`;
  if (payment.sales_invoice_id) return `فاتورة مبيعات`;
  if (payment.purchase_invoice_id) return `فاتورة مشتريات`;
  if (payment.entry_type === 'account_payment') return 'حساب عام';
  if (payment.entry_type === 'debt') return 'دين سابق';
  return '—';
};

export function PaymentSection({
  payments,
  onEditReceipt,
  onDeleteReceipt,
  onPrintReceipt,
  onAddDebt,
  onAddAccountPayment,
  onAddPurchaseFromCustomer,
  onDeleteDistributedPayment,
  onEditDistributedPayment
}: PaymentSectionProps) {
  const [expandedDistributions, setExpandedDistributions] = useState<Set<string>>(new Set());
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedDistribution, setSelectedDistribution] = useState<PaymentRow[] | null>(null);

  // ✅ تجميع الدفعات الموزعة وفصل الديون السابقة
  const { groupedPayments, individualPayments, previousDebts } = useMemo(() => {
    const grouped = new Map<string, PaymentRow[]>();
    const individual: PaymentRow[] = [];
    const debts: PaymentRow[] = [];

    payments.forEach(payment => {
      if (payment.entry_type === 'debt') {
        debts.push(payment);
      } else if (payment.distributed_payment_id) {
        const existing = grouped.get(payment.distributed_payment_id) || [];
        grouped.set(payment.distributed_payment_id, [...existing, payment]);
      } else {
        individual.push(payment);
      }
    });

    return { groupedPayments: grouped, individualPayments: individual, previousDebts: debts };
  }, [payments]);

  const toggleDistribution = (distributionId: string) => {
    const newExpanded = new Set(expandedDistributions);
    if (newExpanded.has(distributionId)) {
      newExpanded.delete(distributionId);
    } else {
      newExpanded.add(distributionId);
    }
    setExpandedDistributions(newExpanded);
  };

  const handleShowDetails = (distributionPayments: PaymentRow[]) => {
    setSelectedDistribution(distributionPayments);
    setDetailsDialogOpen(true);
  };

  const handlePrintCombined = () => {
    if (!selectedDistribution || selectedDistribution.length === 0) return;
    const firstPayment = selectedDistribution[0];
    const totalAmount = selectedDistribution.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const combinedPayment: PaymentRow = {
      ...firstPayment,
      amount: totalAmount,
      contract_number: null,
      notes: `دفعة موزعة على ${selectedDistribution.length} عقود: ${selectedDistribution.map(p => p.contract_number).join(', ')}`
    };

    onPrintReceipt(combinedPayment);
  };

  const handleDeleteDistributed = () => {
    if (!selectedDistribution || selectedDistribution.length === 0) return;
    const distributedPaymentId = selectedDistribution[0].distributed_payment_id;
    if (distributedPaymentId && onDeleteDistributedPayment) {
      onDeleteDistributedPayment(distributedPaymentId);
    }
  };

  return (
    <>
      {/* قسم الديون السابقة */}
      {previousDebts.length > 0 && (
        <Card className="expenses-preview-card border-red-300 bg-red-50/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="expenses-preview-title text-red-700">الديون السابقة ({previousDebts.length})</span>
              <Badge variant="destructive" className="text-lg">
                {previousDebts.reduce((sum, d) => sum + (Number(d.amount) || 0), 0).toLocaleString('ar-LY')} د.ل
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="expenses-table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم العقد</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previousDebts.map(debt => (
                    <TableRow key={debt.id} className="bg-red-50">
                      <TableCell className="expenses-contract-number font-bold">
                        {debt.contract_number || 'دين عام'}
                      </TableCell>
                      <TableCell className="font-bold text-lg text-red-600">
                        {(Number(debt.amount) || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell>
                        {debt.paid_at ? new Date(debt.paid_at).toLocaleDateString('ar-LY') : '—'}
                      </TableCell>
                      <TableCell>{debt.notes || '—'}</TableCell>
                      <TableCell>
                        <div className="expenses-actions-cell">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => {
                              if (window.confirm('هل تريد تسديد هذا الدين؟')) {
                                onEditReceipt(debt);
                              }
                            }}
                          >
                            تسديد
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEditReceipt(debt)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => onDeleteReceipt(debt.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="expenses-preview-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="expenses-preview-title">الدفعات والإيصالات ({groupedPayments.size + individualPayments.length})</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={onAddDebt}
                className="expenses-action-btn bg-red-600 hover:bg-red-700"
              >
                إضافة دين سابق
              </Button>
              {onAddPurchaseFromCustomer && (
                <Button
                  size="sm"
                  onClick={onAddPurchaseFromCustomer}
                  className="expenses-action-btn bg-purple-600 hover:bg-purple-700"
                >
                  مشتريات من العميل
                </Button>
              )}
              <Button
                size="sm"
                className="expenses-action-btn bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-slate-900 font-semibold"
                onClick={onAddAccountPayment}
              >
                <Plus className="h-4 w-4 ml-1" />
                دفعة على الحساب
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length ? (
            <div className="expenses-table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">نوع المدفوع له</TableHead>
                    <TableHead className="text-right">الرقم</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">طريقة الدفع</TableHead>
                    <TableHead className="text-right">المرجع</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* عرض الدفعات الموزعة المجمعة */}
                  {Array.from(groupedPayments.entries()).map(([distributionId, distributionPayments]) => {
                    const isExpanded = expandedDistributions.has(distributionId);
                    const totalAmount = distributionPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                    const firstPayment = distributionPayments[0];

                    return (
                      <>
                        <TableRow
                          key={`${distributionId}-main`}
                          className="bg-primary/5 hover:bg-primary/10 cursor-pointer"
                          onClick={() => toggleDistribution(distributionId)}
                        >
                          <TableCell className="font-bold" colSpan={2}>
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              <Badge variant="secondary" className="bg-primary/20">
                                دفعة موزعة - {distributionPayments.length} عقود
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={getPaymentTypeStyle('receipt')}>
                              دفعة موزعة
                            </span>
                          </TableCell>
                          <TableCell className="font-bold text-lg text-green-600">
                            {totalAmount.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell>{firstPayment.method || '—'}</TableCell>
                          <TableCell>{firstPayment.reference || '—'}</TableCell>
                          <TableCell>
                            {firstPayment.paid_at ? new Date(firstPayment.paid_at).toLocaleDateString('ar-LY') : '—'}
                          </TableCell>
                          <TableCell>دفعة على عقود متعددة</TableCell>
                          <TableCell>
                            <div className="expenses-actions-cell">
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShowDetails(distributionPayments);
                                }}
                                className="bg-primary hover:bg-primary/90"
                              >
                                عرض التفاصيل
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {isExpanded && distributionPayments.map(payment => (
                          <TableRow key={payment.id} className="bg-accent/30">
                            <TableCell className="expenses-contract-number pr-12">
                              {getPaymentTargetType(payment)}
                            </TableCell>
                            <TableCell>
                              {getPaymentTargetNumber(payment)}
                            </TableCell>
                            <TableCell>
                              <span className={getPaymentTypeStyle(payment.entry_type)}>
                                {getPaymentTypeText(payment.entry_type)}
                              </span>
                            </TableCell>
                            <TableCell className="font-semibold stat-green">
                              {(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل
                            </TableCell>
                            <TableCell>—</TableCell>
                            <TableCell>—</TableCell>
                            <TableCell>—</TableCell>
                            <TableCell>{payment.notes || '—'}</TableCell>
                            <TableCell>
                              <div className="expenses-actions-cell">
                                <Button
                                  size="sm"
                                  onClick={() => onPrintReceipt(payment)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  طباعة
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  })}

                  {/* عرض الدفعات الفردية */}
                  {individualPayments.map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell className="expenses-contract-number">
                        {getPaymentTargetType(payment)}
                      </TableCell>
                      <TableCell>
                        {getPaymentTargetNumber(payment)}
                      </TableCell>
                      <TableCell>
                        <span className={getPaymentTypeStyle(payment.entry_type)}>
                          {getPaymentTypeText(payment.entry_type)}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold stat-green">
                        {(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell>{payment.method || '—'}</TableCell>
                      <TableCell>{payment.reference || '—'}</TableCell>
                      <TableCell>
                        {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('ar-LY') : '—'}
                      </TableCell>
                      <TableCell>{payment.notes || '—'}</TableCell>
                      <TableCell>
                        <div className="expenses-actions-cell">
                          <Button
                            size="sm"
                            onClick={() => onPrintReceipt(payment)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            طباعة إيصال
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEditReceipt(payment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => onDeleteReceipt(payment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="expenses-empty-state text-center py-8">لا توجد دفعات</div>
          )}
        </CardContent>
      </Card>

      {/* Dialog تفاصيل الدفعة الموزعة */}
      {selectedDistribution && (
        <DistributedPaymentDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          groupedPayments={selectedDistribution}
          totalAmount={selectedDistribution.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)}
          onPrintCombined={handlePrintCombined}
          onPrintIndividual={onPrintReceipt}
          onDelete={handleDeleteDistributed}
          onEdit={onEditDistributedPayment ? () => {
            const distributedPaymentId = selectedDistribution[0].distributed_payment_id;
            if (distributedPaymentId) {
              onEditDistributedPayment(distributedPaymentId, selectedDistribution);
            }
          } : undefined}
        />
      )}
    </>
  );
}
