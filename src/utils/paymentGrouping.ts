export interface Installment {
  amount: number;
  description: string;
  paymentType: string;
  dueDate: string;
}

export interface GroupedPayment {
  amount: string;
  count: number;
  paymentType: string;
  startDate: string;
  endDate: string;
  isGrouped: boolean;
  originalInstallments: Installment[];
}

/**
 * Groups repeating payments together for compact display in PDF
 * Shows format like: "3 دفعات × 1,000 د.ل = 3,000 د.ل"
 */
export function groupRepeatingPayments(
  installments: Installment[]
): GroupedPayment[] {
  if (installments.length === 0) return [];

  const groups: GroupedPayment[] = [];
  let i = 0;

  while (i < installments.length) {
    const current = installments[i];
    
    // Check how many consecutive payments have the same amount
    let count = 1;
    while (
      i + count < installments.length &&
      Math.abs(
        Number(current.amount) - Number(installments[i + count].amount)
      ) < 0.01
    ) {
      count++;
    }

    // If we have 2 or more payments with same amount, group them
    if (count >= 2) {
      const groupedPayments = installments.slice(i, i + count);
      groups.push({
        amount: current.amount.toLocaleString('ar-LY'),
        count,
        paymentType: current.paymentType,
        startDate: current.dueDate,
        endDate: groupedPayments[groupedPayments.length - 1].dueDate,
        isGrouped: true,
        originalInstallments: groupedPayments
      });
      i += count;
    } else {
      // Single payment
      groups.push({
        amount: current.amount.toLocaleString('ar-LY'),
        count: 1,
        paymentType: current.paymentType,
        startDate: current.dueDate,
        endDate: current.dueDate,
        isGrouped: false,
        originalInstallments: [current]
      });
      i++;
    }
  }

  return groups;
}

/**
 * Generates a formatted payment summary for PDF display
 * Example: "دفعة أولى: 1,000 د.ل بتاريخ 01/01/2024، ثم 5 د��عات × 1,000 د.ل من 01/02/2024 إلى 01/06/2024"
 */
export function generatePaymentSummaryText(
  installments: Installment[],
  currencyWrittenName: string
): string {
  if (installments.length === 0) return '';

  const groups = groupRepeatingPayments(installments);

  if (groups.length === 1) {
    // Single payment or single group
    const group = groups[0];
    if (group.count === 1) {
      return `دفعة واحدة: ${group.amount} ${currencyWrittenName} بتاريخ ${group.startDate}`;
    } else {
      return `${group.count} دفعات × ${group.amount} ${currencyWrittenName} من ${group.startDate} إلى ${group.endDate}`;
    }
  }

  // Multiple groups
  let summary = '';
  groups.forEach((group, index) => {
    if (index === 0) {
      if (group.isGrouped) {
        summary += `${group.count} دفعات × ${group.amount} ${currencyWrittenName} من ${group.startDate} إلى ${group.endDate}`;
      } else {
        summary += `دفعة أولى: ${group.amount} ${currencyWrittenName} بتاريخ ${group.startDate}`;
      }
    } else {
      if (group.isGrouped) {
        summary += `، ثم ${group.count} دفعات × ${group.amount} ${currencyWrittenName} من ${group.startDate} إلى ${group.endDate}`;
      } else {
        summary += `، ودفعة: ${group.amount} ${currencyWrittenName} بتاريخ ${group.startDate}`;
      }
    }
  });

  return summary;
}

/**
 * Returns a detailed list view for PDF with optional grouping display
 */
export function formatPaymentsList(
  installments: Installment[],
  currencySymbol: string
): string[] {
  const groups = groupRepeatingPayments(installments);
  const lines: string[] = [];

  groups.forEach((group, index) => {
    const number = index + 1;
    if (group.isGrouped) {
      const total = (
        Number(group.amount.replace(/,/g, '')) * group.count
      ).toLocaleString('ar-LY');
      lines.push(
        `${number}. ${group.count} دفعات متساوية ${group.paymentType} × ${group.amount} ${currencySymbol} = ${total} ${currencySymbol} (من ${group.startDate} إلى ${group.endDate})`
      );
    } else {
      lines.push(
        `${number}. ${group.originalInstallments[0].description}: ${group.amount} ${currencySymbol} - ${group.originalInstallments[0].paymentType} - بتاريخ ${group.startDate}`
      );
    }
  });

  return lines;
}
