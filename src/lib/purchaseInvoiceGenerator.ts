/**
 * Unified Purchase Invoice HTML Generator
 * يستخدم نفس القاعدة الموحدة كفاتورة العقد
 */

import { resolveInvoiceStyles, formatNum, wrapInDocument, generateCustomerHTML } from './unifiedInvoiceBase';
import { numberToArabicWords } from '@/lib/printUtils';

export interface PurchaseInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceName?: string;
  supplierName: string;
  supplierId?: string;
  supplierPhone?: string;
  supplierCompany?: string;
  billboardImage?: string;
  billboardName?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    total: number;
    durationMonths?: number;
    image_url?: string;
  }>;
  discount?: number;
  totalAmount: number;
  notes?: string;
  autoPrint?: boolean;
}

export async function generatePurchaseInvoiceHTML(data: PurchaseInvoiceData): Promise<string> {
  const t = await resolveInvoiceStyles('purchase_invoice', {
    titleAr: data.invoiceName || 'فاتورة مشتريات',
    titleEn: 'PURCHASE INVOICE',
  });

  const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
  const discount = data.discount || 0;
  const hasDuration = data.items.some(item => item.durationMonths != null);

  const rowsHtml = data.items.map((item, idx) => {
    const imgUrl = item.image_url || ((data.items.length === 1 && data.billboardImage) ? data.billboardImage : null);
    return `
    <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">
      <td>${idx + 1}</td>
      <td style="text-align:right;font-weight:600;">
        <div style="display:flex;align-items:center;gap:10px;flex-direction:row-reverse;">
          ${imgUrl ? `<img src="${imgUrl}" alt="" style="width:80px;height:55px;object-fit:cover;border-radius:6px;border:1px solid #ddd;flex-shrink:0;" />` : ''}
          <span>${item.description || ''}</span>
        </div>
      </td>
      ${hasDuration ? `<td><span class="num">${item.durationMonths || 0}</span> شهر</td>` : ''}
      <td><span class="num">${item.quantity || 0}</span> ${item.unit || ''}</td>
      <td><span class="num">${formatNum(item.unitPrice)}</span> د.ل</td>
      <td style="color:${t.primaryColor};font-weight:bold;"><span class="num">${formatNum(item.total)}</span> د.ل</td>
    </tr>
  `;
  }).join('');

  const colCount = hasDuration ? 6 : 5;

  const bodyContent = `

    <table class="items-table">
      <thead>
        <tr>
          <th style="width:6%">#</th>
          <th style="width:${hasDuration ? '34%' : '40%'}">الوصف</th>
          ${hasDuration ? '<th style="width:12%">المدة (أشهر)</th>' : ''}
          <th style="width:12%">الكمية</th>
          <th style="width:17%">سعر الوحدة</th>
          <th style="width:19%">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="subtotal-row">
          <td colspan="${colCount - 1}" style="text-align:left;">المجموع الفرعي</td>
          <td><span class="num">${formatNum(subtotal)}</span> د.ل</td>
        </tr>
        ${discount > 0 ? `
        <tr class="subtotal-row" style="color:#28a745;">
          <td colspan="${colCount - 1}" style="text-align:left;">الخصم</td>
          <td style="color:#28a745;">- <span class="num">${formatNum(discount)}</span> د.ل</td>
        </tr>
        ` : ''}
        <tr class="grand-total-row">
          <td colspan="${colCount - 1}" class="totals-label">الإجمالي النهائي</td>
          <td class="totals-value"><span class="num">${formatNum(data.totalAmount)}</span> د.ل</td>
        </tr>
      </tbody>
    </table>

    <div class="notes-section">
      المبلغ بالكلمات: ${numberToArabicWords(data.totalAmount)} دينار ليبي فقط لا غير
      ${data.notes ? `<br><br><strong>ملاحظات:</strong> ${data.notes}` : ''}
    </div>
  `;

  const customerHtml = generateCustomerHTML(t, {
    label: 'المورد',
    name: data.supplierName || 'غير محدد',
    company: data.supplierCompany,
    phone: data.supplierPhone,
    extraInfo: data.invoiceName ? `<div style="margin-top:6px;font-size:14px;color:${t.customerText};opacity:0.85;">${data.invoiceName}</div>` : '',
    statsCards: `
      <div class="stat-card">
        <div class="stat-value">${data.items.length}</div>
        <div class="stat-label">صنف</div>
      </div>
    `,
  });

  return wrapInDocument(t, {
    title: `فاتورة مشتريات - ${data.supplierName}`,
    headerMetaHtml: `
      رقم الفاتورة: <span class="num">${data.invoiceNumber}</span><br/>
      التاريخ: <span class="num">${data.invoiceDate}</span>
    `,
    customerHtml,
    bodyContent,
    autoPrint: data.autoPrint,
  });
}
