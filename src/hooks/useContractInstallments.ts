import { toast } from 'sonner';
import type { Installment } from './useContractForm';

interface UseContractInstallmentsProps {
  installments: Installment[];
  setInstallments: (installments: Installment[]) => void;
  finalTotal: number;
  calculateDueDate: (paymentType: string, index: number) => string;
  startDate: string;
}

export const useContractInstallments = ({
  installments,
  setInstallments,
  finalTotal,
  calculateDueDate,
  startDate
}: UseContractInstallmentsProps) => {

  // Smart distribution with recurring payments and custom intervals
  const distributeWithInterval = (config: {
    firstPayment: number;
    firstPaymentType: 'amount' | 'percent';
    interval: 'month' | '2months' | '3months' | '4months';
    numPayments?: number; // عدد الدفعات المتكررة (اختياري)
    lastPaymentDate?: string; // تاريخ آخر دفعة (اختياري)
    firstPaymentDate?: string; // تاريخ الدفعة الأولى (اختياري)
  }) => {
    if (finalTotal <= 0) {
      toast.warning('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }

    const { firstPayment, firstPaymentType, interval, numPayments, lastPaymentDate, firstPaymentDate } = config;

    // حساب قيمة الدفعة الأولى الفعلية
    let actualFirstPayment = firstPayment;
    if (firstPaymentType === 'percent') {
      actualFirstPayment = Math.round((finalTotal * Math.min(100, Math.max(0, firstPayment)) / 100) * 100) / 100;
    }

    if (actualFirstPayment > finalTotal) {
      toast.warning('الدفعة الأولى أكبر من الإجمالي');
      return;
    }

    if (actualFirstPayment < 0) {
      toast.warning('قيمة الدفعة الأولى لا يمكن أن تكون سالبة');
      return;
    }

    const monthsMap = { month: 1, '2months': 2, '3months': 3, '4months': 4 };
    const intervalMonths = monthsMap[interval];
    const intervalLabel = interval === 'month' ? 'شهري' : interval === '2months' ? 'شهرين' : interval === '3months' ? 'ثلاثة أشهر' : '4 أشهر';
    
    const newInstallments: Installment[] = [];
    
    // تاريخ الدفعة الأولى (أو تاريخ البداية)
    const firstDate = firstPaymentDate || startDate || new Date().toISOString().split('T')[0];
    
    // ✅ FIX: إذا كانت الدفعة الأولى صفر، نبدأ مباشرة بالدفعات المتكررة
    const hasFirstPayment = actualFirstPayment > 0;
    
    if (hasFirstPayment) {
      // إضافة الدفعة الأولى فقط إذا كانت أكبر من صفر
      newInstallments.push({
        amount: actualFirstPayment,
        paymentType: 'عند التوقيع',
        description: 'الدفعة الأولى',
        dueDate: firstDate
      });
    }

    const remaining = finalTotal - actualFirstPayment;

    // إذا لم يتبقى شيء، نكتفي بالدفعة الأولى
    if (remaining <= 0) {
      setInstallments(newInstallments);
      toast.success('تم إنشاء الدفعة الأولى فقط (تغطي المبلغ الكامل)');
      return;
    }

    // حساب عدد الدفعات المتكررة
    let numberOfRecurringPayments: number;
    
    if (numPayments && numPayments > 0) {
      // استخدام العدد المحدد مباشرة
      numberOfRecurringPayments = Math.min(12, Math.max(1, numPayments));
    } else if (lastPaymentDate) {
      // حساب العدد بناءً على تاريخ آخر دفعة
      const start = new Date(firstDate);
      const end = new Date(lastPaymentDate);
      const monthsDiff = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)));
      numberOfRecurringPayments = Math.max(1, Math.floor(monthsDiff / intervalMonths));
    } else {
      // افتراضي: 6 أشهر من الدفعات
      numberOfRecurringPayments = Math.max(1, Math.floor(6 / intervalMonths));
    }

    // حساب قيمة كل دفعة متكررة
    const recurringAmount = Math.round((remaining / numberOfRecurringPayments) * 100) / 100;
    
    // إنشاء الدفعات المتكررة
    let runningTotal = actualFirstPayment;
    for (let i = 0; i < numberOfRecurringPayments; i++) {
      const isLast = i === numberOfRecurringPayments - 1;
      const amount = isLast ? (finalTotal - runningTotal) : recurringAmount;
      
      // ✅ FIX: بدء التواريخ من أول شهر (الشهر 1) وليس من الشهر الثاني
      const monthOffset = hasFirstPayment ? (i + 1) : i;
      const dueDate = new Date(firstDate);
      dueDate.setMonth(dueDate.getMonth() + monthOffset * intervalMonths);
      
      const installmentNumber = hasFirstPayment ? i + 2 : i + 1;
      
      newInstallments.push({
        amount: Math.round(amount * 100) / 100,
        paymentType: intervalLabel,
        description: `الدفعة ${installmentNumber}`,
        dueDate: dueDate.toISOString().split('T')[0]
      });
      
      runningTotal += amount;
    }

    setInstallments(newInstallments);
    
    if (hasFirstPayment) {
      toast.success(`تم توزيع الدفعات: دفعة أولى (${actualFirstPayment.toLocaleString('ar-LY')} د.ل) + ${numberOfRecurringPayments} دفعات متكررة`);
    } else {
      toast.success(`تم توزيع المبلغ على ${numberOfRecurringPayments} دفعات متساوية`);
    }
  };

  // Smart installment distribution (متساوي)
  const distributeEvenly = (count: number) => {
    if (finalTotal <= 0) {
      toast.warning('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }
    
    count = Math.max(1, Math.min(12, Math.floor(count)));
    const even = Math.floor((finalTotal / count) * 100) / 100;
    
    const newInstallments = Array.from({ length: count }).map((_, i) => ({
      amount: i === count - 1 ? Math.round((finalTotal - even * (count - 1)) * 100) / 100 : even,
      paymentType: i === 0 ? 'عند التوقيع' : 'شهري',
      description: i === 0 ? 'دفعة أولى عند التوقيع' : `الدفعة ${i + 1}`,
      dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : 'شهري', i)
    }));
    
    setInstallments(newInstallments);
    toast.success(`تم توزيع المبلغ على ${count} دفعات متساوية بنجاح`);
  };

  // ✅ NEW: Manual/Uneven distribution (غير متساوي)
  const createManualInstallments = (count: number) => {
    if (finalTotal <= 0) {
      toast.warning('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }
    
    count = Math.max(1, Math.min(12, Math.floor(count)));
    
    // إنشاء دفعات فارغة ليقوم المستخدم بملئها يدوياً
    const newInstallments = Array.from({ length: count }).map((_, i) => ({
      amount: 0,
      paymentType: i === 0 ? 'عند التوقيع' : 'شهري',
      description: i === 0 ? 'دفعة أولى عند التوقيع' : `الدفعة ${i + 1}`,
      dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : 'شهري', i)
    }));
    
    setInstallments(newInstallments);
    toast.info(`تم إنشاء ${count} دفعات فارغة - يرجى إدخال المبالغ يدوياً`);
  };

  // Add single installment
  const addInstallment = () => {
    const remainingAmount = finalTotal - installments.reduce((sum, inst) => sum + inst.amount, 0);
    const newInstallment = {
      amount: Math.max(0, remainingAmount),
      paymentType: 'شهري',
      description: `الدفعة ${installments.length + 1}`,
      dueDate: calculateDueDate('شهري', installments.length)
    };
    
    setInstallments([...installments, newInstallment]);
  };

  // Remove installment
  const removeInstallment = (index: number) => {
    setInstallments(installments.filter((_, i) => i !== index));
  };

  // Clear all installments
  const clearAllInstallments = () => {
    setInstallments([]);
    toast.success('تم مسح جميع الدفعات');
  };

  // Validate installments
  const validateInstallments = () => {
    if (installments.length === 0) {
      return { isValid: false, message: 'يرجى إضافة دفعات للعقد' };
    }

    const installmentsTotal = installments.reduce((sum, inst) => sum + inst.amount, 0);
    if (Math.abs(installmentsTotal - finalTotal) > 1) {
      return { isValid: false, message: 'مجموع الدفعات لا يساوي إجمالي العقد' };
    }

    return { isValid: true, message: '' };
  };

  // Get installment summary for display - نسخة محسّنة
  const getInstallmentSummary = () => {
    if (installments.length === 0) return null;
    
    // دفعة واحدة فقط
    if (installments.length === 1) {
      return `دفعة واحدة: ${installments[0].amount.toLocaleString('ar-LY')} د.ل بتاريخ ${installments[0].dueDate}`;
    }

    const first = installments[0];
    const recurring = installments.slice(1);
    
    // التحقق من أن جميع الدفعات المتكررة متساوية
    const recurringAmount = recurring[0]?.amount || 0;
    const allSameAmount = recurring.every(r => Math.abs(r.amount - recurringAmount) < 1);
    
    // التحقق من أن جميع الدفعات لها نفس النوع (الفترة)
    const recurringType = recurring[0]?.paymentType || '';
    const allSameType = recurring.every(r => r.paymentType === recurringType);

    // إذا كانت جميع الدفعات المتكررة متساوية ومن نفس النوع
    if (allSameAmount && allSameType && recurring.length > 0) {
      const firstRecurringDate = recurring[0].dueDate;
      const lastRecurringDate = recurring[recurring.length - 1].dueDate;
      
      let summary = `الدفعة الأولى: ${first.amount.toLocaleString('ar-LY')} د.ل بتاريخ ${first.dueDate}`;
      
      // إضافة معلومات الدفعات المتكررة
      if (recurring.length === 1) {
        summary += `\nدفعة ثانية: ${recurringAmount.toLocaleString('ar-LY')} د.ل بتاريخ ${firstRecurringDate}`;
      } else {
        summary += `\nبعدها يتم السداد ${recurringType} بمقدار ${recurringAmount.toLocaleString('ar-LY')} د.ل`;
        summary += `\nتبدأ من ${firstRecurringDate} حتى ${lastRecurringDate}`;
        summary += ` (${recurring.length} دفعات)`;
      }
      
      return summary;
    }

    // إذا كانت الدفعات غير متساوية أو مختلفة النوع
    return `${installments.length} دفعات: الأولى ${first.amount.toLocaleString('ar-LY')} د.ل بتاريخ ${first.dueDate}، والأخيرة بتاريخ ${installments[installments.length - 1].dueDate}`;
  };

  return {
    distributeEvenly,
    distributeWithInterval,
    createManualInstallments,
    addInstallment,
    removeInstallment,
    clearAllInstallments,
    validateInstallments,
    getInstallmentSummary
  };
};