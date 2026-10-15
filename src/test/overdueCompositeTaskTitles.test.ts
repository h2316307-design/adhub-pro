import { describe, it, expect } from 'vitest';

function resolveCompositeInvoiceTitle(ct: {
  customer_print_cost?: number;
  customer_installation_cost?: number;
  customer_cutout_cost?: number;
  task_type?: string;
  installation_task_id?: string | null;
  print_task_id?: string | null;
  cutout_task_id?: string | null;
  reinstallation_number?: number | null;
  realInstallTotal?: number | null;
}): { invoiceTitle: string; serviceLabel: string } {
  const printCost = Number(ct.customer_print_cost) || 0;
  const installCost = ct.realInstallTotal !== null && ct.realInstallTotal !== undefined
    ? ct.realInstallTotal
    : (Number(ct.customer_installation_cost) || 0);
  const cutoutCost = Number(ct.customer_cutout_cost) || 0;

  const hasPrint = printCost > 0 || !!ct.print_task_id || ct.task_type === 'print' || ct.task_type === 'installation_print' || ct.task_type === 'installation_print_cutout' || ct.task_type === 'print_cutout';
  const hasInstall = installCost > 0 || !!ct.installation_task_id || ct.task_type === 'installation' || ct.task_type === 'new_installation' || ct.task_type === 'reinstallation' || ct.task_type === 'installation_print' || ct.task_type === 'installation_print_cutout' || ct.task_type === 'installation_cutout';
  const hasCutout = cutoutCost > 0 || !!ct.cutout_task_id || ct.task_type === 'cutout' || ct.task_type === 'installation_print_cutout' || ct.task_type === 'installation_cutout' || ct.task_type === 'print_cutout';
  const isReinstall = ct.task_type === 'reinstallation' || (Number(ct.reinstallation_number || 0) > 0);

  let invoiceTitle = 'فاتورة تركيب';
  let serviceLabel = 'تركيب';

  if (hasPrint && hasInstall) {
    if (hasCutout) {
      invoiceTitle = 'فاتورة طباعة وتركيب وقص';
      serviceLabel = 'طباعة وتركيب وقص';
    } else {
      invoiceTitle = 'فاتورة طباعة وتركيب';
      serviceLabel = 'طباعة وتركيب';
    }
  } else if (hasInstall && !hasPrint) {
    if (hasCutout) {
      invoiceTitle = isReinstall ? 'فاتورة إعادة تركيب وقص' : 'فاتورة تركيب وقص';
      serviceLabel = isReinstall ? 'إعادة تركيب وقص' : 'تركيب وقص';
    } else {
      invoiceTitle = isReinstall ? 'فاتورة إعادة تركيب' : 'فاتورة تركيب';
      serviceLabel = isReinstall ? 'إعادة تركيب' : 'تركيب';
    }
  } else if (hasPrint && !hasInstall) {
    if (hasCutout) {
      invoiceTitle = 'فاتورة طباعة وقص';
      serviceLabel = 'طباعة وقص';
    } else {
      invoiceTitle = 'فاتورة طباعة';
      serviceLabel = 'طباعة';
    }
  } else if (hasCutout) {
    invoiceTitle = 'فاتورة قص مجسمات';
    serviceLabel = 'قص مجسمات';
  } else {
    invoiceTitle = isReinstall ? 'فاتورة إعادة تركيب' : 'فاتورة تركيب';
    serviceLabel = isReinstall ? 'إعادة تركيب' : 'تركيب';
  }

  return { invoiceTitle, serviceLabel };
}

function formatCustomerOverdueMessage(customer: {
  customerName: string;
  totalOverdue: number;
  invoices: Array<{
    type: 'printed' | 'sales' | 'composite';
    invoiceTitle?: string;
    invoiceNumber?: string;
    contractNumber?: string | null;
    adType?: string;
    createdAt: string;
    daysOverdue: number;
    amount: number;
  }>;
}): string {
  let invoiceDetails = '';
  customer.invoices.forEach((inv, index) => {
    const dateStr = '15/4/2026';
    let typeName = '';
    const details: string[] = [];

    if (inv.type === 'printed') {
      typeName = 'فاتورة طباعة';
      if (inv.contractNumber) details.push(`عقد #${inv.contractNumber}`);
    } else if (inv.type === 'sales') {
      typeName = 'فاتورة مبيعات';
      if (inv.invoiceNumber) details.push(`رقم ${inv.invoiceNumber}`);
    } else if (inv.type === 'composite') {
      typeName = inv.invoiceTitle || 'فاتورة خدمات';
      if (inv.invoiceNumber) details.push(`${inv.invoiceNumber}`);
      if (inv.contractNumber) details.push(`عقد #${inv.contractNumber}`);
    }

    if (inv.adType) {
      details.push(`نوع الإعلان: ${inv.adType}`);
    }

    const detailsStr = details.length ? ` (${details.join(' - ')})` : '';
    invoiceDetails += `${index + 1}. ${typeName}${detailsStr}:\n`;
    invoiceDetails += `   - تاريخ الإصدار: ${dateStr}\n`;
    invoiceDetails += `   - أيام التأخير: ${inv.daysOverdue} يوم\n`;
    invoiceDetails += `   - المبلغ المطلوب: ${inv.amount.toLocaleString('en-US')} د.ل\n\n`;
  });

  return `السلام عليكم ورحمة الله وبركاته\n\nالسيد/ ${customer.customerName} المحترم،\n\nنود تذكيركم بمتأخرات الحساب والفواتير غير المسددة طرفكم بقيمة إجمالية قدرها (${customer.totalOverdue.toLocaleString('en-US')} د.ل) وتفصيلها كالتالي:\n\n${invoiceDetails}نرجو التكرم بالمبادرة بسداد المبالغ المستحقة في أقرب وقت.\n\nشكراً لحسن تعاونكم.`;
}

describe('Overdue Composite Task Invoice Titles & Alert Formatting', () => {
  it('resolves installation tasks correctly to "فاتورة تركيب" when installation_task_id is set', () => {
    // أمر تركيب حتى وإن لم تكن التكاليف مسجلة بالتفصيل كطباعة
    const task122 = resolveCompositeInvoiceTitle({
      installation_task_id: 'inst-122',
      customer_installation_cost: 9120,
      customer_print_cost: 0,
      task_type: 'new_installation',
    });
    expect(task122.invoiceTitle).toBe('فاتورة تركيب');

    const task335 = resolveCompositeInvoiceTitle({
      installation_task_id: 'inst-335',
      customer_installation_cost: 7200,
      customer_print_cost: 0,
      task_type: 'new_installation',
    });
    expect(task335.invoiceTitle).toBe('فاتورة تركيب');
  });

  it('correctly resolves both Pepsi tasks 122 and 335 as "فاتورة تركيب"', () => {
    const t1 = resolveCompositeInvoiceTitle({
      installation_task_id: 'inst-122',
      customer_installation_cost: 9120,
      customer_print_cost: 0,
    });
    const t2 = resolveCompositeInvoiceTitle({
      installation_task_id: 'inst-335',
      customer_installation_cost: 7200,
      customer_print_cost: 0,
    });

    expect(t1.invoiceTitle).toBe('فاتورة تركيب');
    expect(t2.invoiceTitle).toBe('فاتورة تركيب');

    const message = formatCustomerOverdueMessage({
      customerName: 'هشام بن زاهية',
      totalOverdue: 16320,
      invoices: [
        {
          type: 'composite',
          invoiceTitle: t1.invoiceTitle,
          invoiceNumber: 'مهمة #122',
          contractNumber: '1197',
          adType: 'بيبسي',
          createdAt: '2026-04-15',
          daysOverdue: 180,
          amount: 9120,
        },
        {
          type: 'composite',
          invoiceTitle: t2.invoiceTitle,
          invoiceNumber: 'مهمة #335',
          contractNumber: '1197',
          adType: 'بيبسي',
          createdAt: '2026-09-14',
          daysOverdue: 29,
          amount: 7200,
        },
      ],
    });

    expect(message).not.toContain('مجمعة');
    expect(message).toContain('1. فاتورة تركيب (مهمة #122 - عقد #1197 - نوع الإعلان: بيبسي):');
    expect(message).toContain('2. فاتورة تركيب (مهمة #335 - عقد #1197 - نوع الإعلان: بيبسي):');
  });

  it('resolves print-only tasks to "فاتورة طباعة"', () => {
    const result = resolveCompositeInvoiceTitle({
      print_task_id: 'pt-1',
      customer_print_cost: 5000,
      customer_installation_cost: 0,
      customer_cutout_cost: 0,
    });
    expect(result.invoiceTitle).toBe('فاتورة طباعة');
    expect(result.serviceLabel).toBe('طباعة');
  });

  it('resolves reinstallation tasks to "فاتورة إعادة تركيب"', () => {
    const reinstall = resolveCompositeInvoiceTitle({
      installation_task_id: 'inst-re',
      task_type: 'reinstallation',
      customer_installation_cost: 1500,
    });
    expect(reinstall.invoiceTitle).toBe('فاتورة إعادة تركيب');
  });
});
