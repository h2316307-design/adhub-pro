import { generateModernInvoiceHTML, ModernInvoiceData } from './ModernInvoiceTemplate';

export { generateModernInvoiceHTML };

// Modern print invoice generator used by ModernPrintInvoiceDialog
export interface ModernPrintInvoiceData {
  invoiceNumber: string;
  invoiceType: string;
  invoiceDate: string;
  customerName: string;
  items: Array<{
    size: string;
    quantity: number | string;
    faces: number | string;
    totalFaces: number | string;
    width?: number | string;
    height?: number | string;
    area?: number | string;
    pricePerMeter?: number | string;
    totalPrice?: number | string;
  }>;
  totalAmount: number;
  notes?: string;
  printerName?: string;
  hidePrices?: boolean;
  showNotes?: boolean; // ✅ خيار إظهار/إخفاء الملاحظات
}

export const generateModernPrintInvoiceHTML = (data: ModernPrintInvoiceData): string => {
  const fontBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const fileName = `فاتورة ${data.invoiceType}_${(data.customerName||'').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g,'_')}`;
  const FIXED_ROWS = 10;
  const displayItems = [...(data.items || [])];
  while (displayItems.length < FIXED_ROWS) {
    displayItems.push({ size: '', quantity: '', faces: '', totalFaces: '', width: '', height: '', area: '', pricePerMeter: '', totalPrice: '' } as any);
  }

  const rowsHtml = displayItems.map(item => {
    if (data.hidePrices) {
      return `
      <tr>
        <td style="padding:8px">${item.size || ''}</td>
        <td style="padding:8px">${item.quantity ?? ''}</td>
        <td style="padding:8px">${item.faces ?? ''}</td>
        <td style="padding:8px">${item.totalFaces ?? ''}</td>
        <td style="padding:8px">${item.width ?? ''} × ${item.height ?? ''}</td>
        <td style="padding:8px">${Number(item.area || 0).toFixed(2)} م²</td>
      </tr>
    `;
    }
    return `
    <tr>
      <td style="padding:8px">${item.size || ''}</td>
      <td style="padding:8px">${item.quantity ?? ''}</td>
      <td style="padding:8px">${item.faces ?? ''}</td>
      <td style="padding:8px">${item.totalFaces ?? ''}</td>
      <td style="padding:8px">${item.width ?? ''} × ${item.height ?? ''}</td>
      <td style="padding:8px">${Number(item.area || 0).toFixed(2)} م²</td>
      <td style="padding:8px">${(Number(item.pricePerMeter || 0)).toLocaleString('ar-LY')}</td>
      <td style="padding:8px">${(Number(item.totalPrice || 0)).toLocaleString('ar-LY')} د.ل</td>
    </tr>
  `;
  }).join('');

  // Full header + footer to match the dialog preview
  const html = `<!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName}</title>
    <style>
      /* Fonts */
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap');
      @font-face { font-family: 'Doran'; src: url('${fontBaseUrl}/Doran-Bold.otf') format('opentype'); font-weight: 700; }
      @font-face { font-family: 'Doran'; src: url('${fontBaseUrl}/Doran-Regular.otf') format('opentype'); font-weight: 400; }

      :root{
        --bg: #ffffff;
        --muted: #f8fafc;
        --primary: #0b5d7a;
        --primary-foreground: #ffffff;
        --border: #e6eef2;
        --card: #f1f8fb;
        --text: #111827;
      }

      html,body{height:100%;margin:0;padding:0;background:var(--bg);color:var(--text);font-family:Manrope, 'Doran', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif}
      .container{max-width:1000px;margin:12px auto;padding:18px;background:var(--bg);border:1px solid var(--border);border-radius:10px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
      .logo img{max-width:200px;height:auto}
      .company{font-size:13px;color:#4b5563;text-align:left}
      .title{font-size:28px;color:var(--primary);font-weight:700;text-align:left}
      .customer-info{background:var(--muted);padding:12px;border-radius:6px;margin:12px 0;border-right:4px solid var(--primary)}

      table{width:100%;border-collapse:collapse;margin-top:12px;background:transparent}
      thead th{background:var(--primary);color:var(--primary-foreground);padding:10px 8px;text-align:center;font-weight:700}
      tbody td{border:1px solid var(--border);padding:10px;text-align:center;vertical-align:middle}
      tbody tr:nth-child(even){background:#fbfcfd}

      .num, .quantity{font-variant-numeric:tabular-nums;font-weight:600}
      .totals{margin-top:16px;display:flex;justify-content:flex-end}
      .totals .box{width:360px;padding:12px;background:var(--card);border-radius:6px}
      .notes{margin-top:12px;color:#374151}
      .footer{margin-top:28px;border-top:1px dashed var(--border);padding-top:12px;text-align:center;color:#6b7280;font-size:12px}

      /* responsive print tweaks */
      @media print{
        html,body{background:white}
        .container{margin:0;padding:8mm;border:none;border-radius:0}
        thead th{color:#fff}
        @page{size:A4;margin:10mm}
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="right" style="text-align:right">
          <div class="logo"><img src="/logofares.svg" alt="logo"/></div>
        </div>
        <div class="left" style="text-align:left">
          <div class="title">فاتورة ${data.invoiceType}</div>
          <div class="company">طرابلس – طريق المطار، حي الزهور<br/>هاتف: 0912612255</div>
        </div>
      </div>

      <div class="customer-info">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div><strong>العميل:</strong> ${data.customerName || ''}</div>
          <div style="direction:ltr">التاريخ: ${new Date(data.invoiceDate).toLocaleDateString('ar-LY')}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>المقاس</th>
            <th>عدد اللوحات</th>
            <th>أوجه/لوحة</th>
            <th>إجمالي الأوجه</th>
            <th>الأبعاد (م)</th>
            <th>المساحة/الوجه</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      ${data.hidePrices ? `
      <div class="totals">
        <div class="box">
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px">
            <div>إجمالي الأوجه:</div>
            <div style="direction:ltr">${Number(data.totalAmount || 0).toLocaleString('ar-LY')} وحدة</div>
          </div>
        </div>
      </div>
      ` : `
      <div class="totals">
        <div class="box">
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px">
            <div>المجموع الإجمالي:</div>
            <div style="direction:ltr">${data.totalAmount.toLocaleString('ar-LY')} د.ل</div>
          </div>
          <div style="margin-top:8px">المبلغ بالكلمات: ${data.totalAmount ? numberToArabicWords(Number(data.totalAmount)) : ''} ${data.totalAmount ? 'د.ل' : ''}</div>
        </div>
      </div>
      `}

      ${(data.showNotes !== false && data.notes) ? `<div class="notes">${data.notes}</div>` : ''}

      <div class="footer">شكراً لتعاملكم معنا | Thank you for your business<br/>هذه فاتورة إلكترونية ولا تحتاج إلى ختم أو توقيع</div>
    </div>
    <script>window.onload=function(){window.print();}</script>
  </body>
  </html>`;

  return html;
};

// Helper function to convert number to Arabic words (re-exported for convenience)
export const numberToArabicWords = (num: number): string => {
  if (num === 0) return 'صفر';
  
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one > 0 ? ' و' + ones[one] : '');
  }
  if (num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    return ones[hundred] + ' مائة' + (remainder > 0 ? ' و' + numberToArabicWords(remainder) : '');
  }
  if (num < 1000000) {
    const thousand = Math.floor(num / 1000);
    const remainder = num % 1000;
    return numberToArabicWords(thousand) + ' ألف' + (remainder > 0 ? ' و' + numberToArabicWords(remainder) : '');
  }
  
  return num.toString(); // Fallback for very large numbers
};

// Generate invoice with modern template
// Generate purchase invoice HTML (for مشتريات)
export interface PurchaseInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  invoiceName?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  discount?: number;
  totalAmount: number;
  notes?: string;
}

export const generatePurchaseInvoiceHTML = (data: PurchaseInvoiceData): string => {
  const fontBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const FIXED_ROWS = 10;
  const displayItems = [...(data.items || [])];
  while (displayItems.length < FIXED_ROWS) {
    displayItems.push({ description: '', quantity: 0, unitPrice: 0, total: 0 } as any);
  }

  const subtotal = (data.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const discount = data.discount || 0;

  const rowsHtml = displayItems.map((item, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#f8f9fa' : '#ffffff'}">
      <td style="padding:14px;text-align:right;border:1px solid #e0e0e0;font-size:14px">${item.description || ''}</td>
      <td style="padding:14px;text-align:center;border:1px solid #e0e0e0;font-size:14px;font-weight:600">${item.quantity || ''}</td>
      <td style="padding:14px;text-align:center;border:1px solid #e0e0e0;font-size:14px;font-weight:600">${item.unitPrice ? (Number(item.unitPrice)).toLocaleString('ar-LY') : ''}</td>
      <td style="padding:14px;text-align:center;border:1px solid #e0e0e0;font-size:14px;font-weight:700">${item.total ? (Number(item.total)).toLocaleString('ar-LY') + ' د.ل' : ''}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة مشتريات - ${data.invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Cairo', 'Tajawal', Arial, sans-serif;
      background: #f5f5f5;
      padding: 8px;
      color: #1a1a1a;
      line-height: 1.3;
    }
    
    .invoice-container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e0e0e0;
      position: relative;
    }
    
    /* Header Section */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 15px 30px 10px;
      border-bottom: 2px solid #1a1a1a;
    }
    
    .header-right {
      text-align: right;
      flex: 1;
    }
    
    .invoice-title {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 3px;
    }
    
    .invoice-meta {
      font-size: 11px;
      color: #666;
      line-height: 1.4;
    }
    
    .header-center {
      flex: 1;
      text-align: center;
      padding: 0 15px;
    }
    
    .logo-circle {
      width: 70px;
      height: 70px;
      margin: 0 auto 5px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .logo-circle img {
      width: 90%;
      height: 90%;
      object-fit: contain;
    }
    
    .company-name {
      font-size: 13px;
      font-weight: 700;
      color: #1a1a1a;
      margin-top: 3px;
    }
    
    .header-left {
      text-align: left;
      flex: 1;
      font-size: 10px;
      color: #666;
      line-height: 1.4;
    }
    
    /* Info Box */
    .info-box {
      background: #f8f9fa;
      padding: 10px 20px;
      margin: 0 30px 10px;
      border: 1px solid #e0e0e0;
      border-right: 3px solid #d4af37;
    }
    
    .info-title {
      font-size: 13px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid #d4af37;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 12px;
    }
    
    .info-label {
      color: #666;
      font-weight: 600;
    }
    
    .info-value {
      color: #1a1a1a;
      font-weight: 700;
    }
    
    /* Table */
    .items-table {
      width: calc(100% - 60px);
      margin: 10px 30px;
      border-collapse: collapse;
      border: 1px solid #e0e0e0;
    }
    
    .items-table thead {
      background: #1a1a1a;
      color: #ffffff;
    }
    
    .items-table thead th {
      padding: 8px 6px;
      text-align: center;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid #333;
    }
    
    .items-table tbody td {
      padding: 6px;
      border: 1px solid #e0e0e0;
      font-size: 11px;
    }
    
    /* Total Section */
    .total-section {
      margin: 10px 30px 10px;
    }

    .summary-table {
      width: 100%;
      max-width: 350px;
      margin-left: auto;
      border-collapse: collapse;
    }

    .summary-table tr {
      border-bottom: 1px solid #e0e0e0;
    }

    .summary-table td {
      padding: 6px 10px;
      font-size: 12px;
    }

    .summary-table td:first-child {
      text-align: right;
      color: #666;
      font-weight: 600;
    }

    .summary-table td:last-child {
      text-align: left;
      font-weight: 700;
      color: #1a1a1a;
    }

    .summary-table tr.discount-row td {
      color: #e74c3c;
      font-weight: 700;
    }

    .summary-table tr.total-row {
      background: #1a1a1a;
      color: #ffffff;
      font-weight: 800;
      border-bottom: none;
    }

    .summary-table tr.total-row td {
      padding: 10px;
      font-size: 14px;
      color: #d4af37;
      border-top: 3px solid #1a1a1a !important;
    }
    
    .total-label {
      font-size: 16px;
      color: #666;
      font-weight: 600;
    }
    
    /* Notes */
    .notes-section {
      margin: 10px 30px;
      padding: 8px;
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 11px;
      color: #666;
    }
    
    /* Footer */
    .footer {
      margin-top: 15px;
      padding: 10px 30px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      font-size: 10px;
      color: #999;
    }
    
    @media print {
      body { background: white; padding: 0; }
      .invoice-container { border: none; box-shadow: none; }
      @page { size: A4; margin: 5mm; }
      
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .logo-circle { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%) !important; }
      .info-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #f8f9fa !important; border-right: 4px solid #d4af37 !important; }
      .info-title { -webkit-print-color-adjust: exact; print-color-adjust: exact; border-bottom: 2px solid #d4af37 !important; }
      .items-table thead { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #1a1a1a !important; color: #ffffff !important; }
      .items-table thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #1a1a1a !important; color: #ffffff !important; }
      .items-table tbody tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #f8f9fa !important; }
      .summary-table tr.total-row { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #1a1a1a !important; }
      .summary-table tr.total-row td { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #d4af37 !important; }
      .summary-table tr.discount-row td { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #e74c3c !important; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <div class="header-right">
        <div class="invoice-title">${data.invoiceName || 'فاتورة قطع'}</div>
        <div class="invoice-meta">
          رقم الفاتورة: ${data.invoiceNumber}<br/>
          التاريخ: ${new Date(data.invoiceDate).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })}
        </div>
      </div>
      
      <div class="header-center">
        <div class="logo-circle">
          <img src="/logofares.svglogofares.svg" alt="شعار" />
        </div>
        <div class="company-name">AL FARES AL DAHABI</div>
      </div>
      
      <div class="header-left">
        طرابلس - طريق المطار، حي الزهور<br/>
        هاتف: 0912612255
      </div>
    </div>
    
    <!-- Info Box -->
    <div class="info-box">
      <div class="info-title">البيانات </div>
      <div class="info-row">
        <span class="info-label">العميل:</span>
        <span class="info-value">${data.customerName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">طريقة الدفع نقدي:</span>
        <span class="info-value">نقدي</span>
      </div>
    </div>
    
    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:40%">البيان</th>
          <th style="width:15%">الكمية</th>
          <th style="width:20%">الفئة</th>
          <th style="width:25%">السعر الاجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    
    <!-- Total Section -->
    <div class="total-section">
      <table class="summary-table">
        <tbody>
          <tr>
            <td>إجمالي الكمية:</td>
            <td>${(data.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} قطعة</td>
          </tr>
          <tr>
            <td>المجموع الفرعي:</td>
            <td>د.ل ${subtotal.toLocaleString('ar-LY')}</td>
          </tr>
          ${discount > 0 ? `
          <tr class="discount-row">
            <td>التخفيض:</td>
            <td>- د.ل ${discount.toLocaleString('ar-LY')}</td>
          </tr>
          ` : ''}
          <tr class="total-row">
            <td style="border-top: 3px solid #1a1a1a;">الإجمالي النهائي:</td>
            <td style="border-top: 3px solid #1a1a1a;">د.ل ${data.totalAmount.toLocaleString('ar-LY')}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Notes -->
    ${data.notes ? `<div class="notes-section">ملاحظات: ${data.notes}</div>` : ''}
    
    <!-- Footer -->
    <div class="footer">
      Thank you for your business | شكراً لتعاملكم معنا<br/>
      عنوان الورقة الصفحية: به الاستعمال إعارة بضاعة أوراق عمل ب أو بارتش
    </div>
  </div>
  
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;
};

// Generate sales invoice with same design
export const generateSalesInvoiceHTML = (data: PurchaseInvoiceData): string => {
  const html = generatePurchaseInvoiceHTML(data);
  // Replace "فاتورة قطع" and "فاتورة مشتريات" with "فاتورة مبيعات" if no custom invoice name
  if (!data.invoiceName) {
    return html
      .replace(/فاتورة قطع/g, 'فاتورة مبيعات')
      .replace(/فاتورة مشتريات/g, 'فاتورة مبيعات');
  }
  return html;
};

export const generateInvoiceHTML = (invoiceData: ModernInvoiceData): string => {
  return generateModernInvoiceHTML(invoiceData);
};
