/**
 * Unified Sales Invoice HTML Generator
 * يستخدم نفس القاعدة الموحدة كفاتورة العقد
 */

import { resolveInvoiceStyles, formatNum, wrapInDocument, generateCustomerHTML } from './unifiedInvoiceBase';
import { hexToRgba } from '@/hooks/useInvoiceSettingsSync';
import { numberToArabicWords } from '@/lib/printUtils';

export interface SalesInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceName?: string;
  customerName: string;
  customerId?: string;
  customerPhone?: string;
  customerCompany?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    total: number;
    image_url?: string;
  }>;
  discount?: number;
  totalAmount: number;
  notes?: string;
  autoPrint?: boolean;
}

export async function generateSalesInvoiceHTML(data: SalesInvoiceData): Promise<string> {
  const t = await resolveInvoiceStyles('sales_invoice', {
    titleAr: data.invoiceName || 'فاتورة مبيعات',
    titleEn: 'SALES INVOICE',
  });

  const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
  const discount = data.discount || 0;

  // Items table
  const rowsHtml = data.items.map((item, idx) => {
    const imgUrl = item.image_url || null;
    return `
    <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">
      <td>${idx + 1}</td>
      <td style="text-align:right;font-weight:600;">
        <div style="display:flex;align-items:center;gap:10px;flex-direction:row-reverse;">
          ${imgUrl ? `<img src="${imgUrl}" alt="" style="width:80px;height:55px;object-fit:cover;border-radius:6px;border:1px solid #ddd;flex-shrink:0;" />` : ''}
          <span>${item.description}</span>
        </div>
      </td>
      <td><span class="num">${item.quantity}</span> ${item.unit || ''}</td>
      <td><span class="num">${formatNum(item.unitPrice)}</span> د.ل</td>
      <td style="color:${t.primaryColor};font-weight:bold;"><span class="num">${formatNum(item.total)}</span> د.ل</td>
    </tr>
  `;
  }).join('');

  const bodyContent = `
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:8%">#</th>
          <th style="width:40%">الوصف</th>
          <th style="width:15%">الكمية</th>
          <th style="width:18%">سعر الوحدة</th>
          <th style="width:19%">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="subtotal-row">
          <td colspan="4" style="text-align:left;">المجموع الفرعي</td>
          <td><span class="num">${formatNum(subtotal)}</span> د.ل</td>
        </tr>
        ${discount > 0 ? `
        <tr class="subtotal-row" style="color:#28a745;">
          <td colspan="4" style="text-align:left;">الخصم</td>
          <td style="color:#28a745;">- <span class="num">${formatNum(discount)}</span> د.ل</td>
        </tr>
        ` : ''}
        <tr class="grand-total-row">
          <td colspan="4" class="totals-label">الإجمالي النهائي</td>
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
    label: 'العميل',
    name: data.customerName,
    company: data.customerCompany,
    phone: data.customerPhone,
    extraInfo: data.invoiceName ? `<div style="margin-top:6px;font-size:14px;color:${t.customerText};opacity:0.85;">${data.invoiceName}</div>` : '',
    statsCards: `
      <div class="stat-card">
        <div class="stat-value">${data.items.length}</div>
        <div class="stat-label">صنف</div>
      </div>
    `,
  });

  return wrapInDocument(t, {
    title: `فاتورة مبيعات - ${data.customerName}`,
    headerMetaHtml: `
      رقم الفاتورة: <span class="num">${data.invoiceNumber}</span><br/>
      التاريخ: <span class="num">${data.invoiceDate}</span>
    `,
    customerHtml,
    bodyContent,
    autoPrint: data.autoPrint,
  });
}
