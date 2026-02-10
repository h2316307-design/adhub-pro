export interface ModernInvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  totalAmount: number;
  totalInWords: string;
  notes?: string;
}

export const generateModernInvoiceHTML = (data: ModernInvoiceData): string => {
  const itemRows = data.items.map(item => `
    <tr class="item-row">
      <td class="item-desc">${item.description}</td>
      <td class="item-qty">${item.quantity}</td>
      <td class="item-price">${item.unitPrice.toLocaleString('ar-LY')} د.ل</td>
      <td class="item-total">${item.total.toLocaleString('ar-LY')} د.ل</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة مبيعات - ${data.invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Cairo', 'Tajawal', Arial, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      min-height: 100vh;
      padding: 20px;
      color: #181616;
      line-height: 1.6;
    }
    
    .invoice-container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
      border: 2px solid #d4ab3f;
      overflow: hidden;
      position: relative;
    }
    
    .invoice-container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: linear-gradient(90deg, #d4ab3f, #dcb345, #d4ab3f);
    }
    
    .header {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      padding: 50px 40px 40px;
      text-align: center;
      border-bottom: 5px solid #d4ab3f;
      position: relative;
    }

    .company-logo {
      width: 120px;
      height: 120px;
      margin: 0 auto 25px;
      background: linear-gradient(135deg, #d4ab3f 0%, #dcb345 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      font-weight: bold;
      color: #ffffff;
      box-shadow: 0 10px 30px rgba(212, 171, 63, 0.4);
      border: 4px solid #ffffff;
    }

    .company-name {
      font-size: 38px;
      font-weight: 700;
      color: #181616;
      margin-bottom: 25px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
      letter-spacing: 1px;
    }

    .invoice-title {
      font-size: 30px;
      font-weight: 700;
      color: #ffffff;
      background: #000000;
      padding: 18px 50px;
      border-radius: 12px;
      display: inline-block;
      border: 3px solid #d4ab3f;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }
    
    .content {
      padding: 40px;
    }
    
    .invoice-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 40px;
    }
    
    .info-section {
      background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
      padding: 30px;
      border-radius: 15px;
      border: 3px solid #d4ab3f;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
    }

    .info-section h3 {
      font-size: 22px;
      font-weight: 700;
      color: #000000;
      background: #d4ab3f;
      margin: -30px -30px 20px -30px;
      padding: 15px 30px;
      border-radius: 12px 12px 0 0;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 0;
      border-bottom: 2px solid #f1f1f1;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-label {
      font-weight: 600;
      color: #495057;
      font-size: 17px;
    }

    .info-value {
      font-weight: 700;
      color: #181616;
      font-size: 17px;
      background: #fff7ed;
      padding: 8px 20px;
      border-radius: 8px;
      border: 2px solid #d4ab3f;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
      background: #ffffff;
      border-radius: 15px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    }
    
    .table-header {
      background: #000000;
      color: #ffffff;
      font-weight: 700;
      font-size: 16px;
    }

    .table-header th {
      padding: 20px 15px;
      text-align: center;
      border-right: 1px solid rgba(255, 255, 255, 0.2);
    }

    .table-header th:last-child {
      border-right: none;
    }
    
    .item-row {
      border-bottom: 2px solid #e9ecef;
      transition: all 0.3s ease;
    }

    .item-row:hover {
      background: #f8f9fa;
      transform: scale(1.01);
    }

    .item-row:last-child {
      border-bottom: none;
    }

    .item-row td {
      padding: 20px 15px;
      text-align: center;
      font-size: 16px;
      color: #181616;
    }

    .item-desc {
      text-align: right !important;
      font-weight: 600;
      color: #000000;
    }

    .item-qty, .item-price, .item-total {
      font-weight: 700;
      background: #f8f9fa;
    }
    
    .total-section {
      background: #000000;
      padding: 35px 40px;
      border-radius: 12px;
      text-align: center;
      margin: 30px 0;
      border: 3px solid #d4ab3f;
      position: relative;
    }

    .total-label {
      font-size: 22px;
      color: #ffffff;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .total-value {
      font-size: 48px;
      font-weight: 800;
      color: #d4ab3f;
      margin-bottom: 8px;
      text-shadow: 2px 2px 4px rgba(212, 171, 63, 0.3);
    }

    .currency-label {
      font-size: 20px;
      color: #ffffff;
      font-weight: 600;
      margin-bottom: 15px;
    }

    .total-words {
      font-size: 18px;
      color: #ffffff;
      font-weight: 500;
      font-style: italic;
      padding-top: 15px;
      border-top: 1px solid rgba(212, 171, 63, 0.3);
    }
    
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 50px;
      padding-top: 40px;
      border-top: 5px solid #d4ab3f;
    }

    .signature-box {
      text-align: center;
      padding: 35px;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border-radius: 15px;
      border: 3px solid #d4ab3f;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
    }

    .signature-label {
      font-size: 20px;
      font-weight: 700;
      color: #000000;
      background: #d4ab3f;
      padding: 12px 25px;
      border-radius: 10px;
      margin-bottom: 60px;
      display: inline-block;
    }

    .signature-line {
      border-top: 3px solid #d4ab3f;
      margin-top: 60px;
      padding-top: 15px;
      font-size: 17px;
      font-weight: 600;
      color: #495057;
    }
    
    .footer {
      background: linear-gradient(135deg, #181616 0%, #000000 100%);
      padding: 35px;
      text-align: center;
      border-top: 5px solid #d4ab3f;
    }

    .footer-text {
      font-size: 20px;
      font-weight: 700;
      color: #d4ab3f;
      margin-bottom: 15px;
    }

    .print-date {
      font-size: 15px;
      color: #ffffff;
      font-weight: 500;
    }

    .decorative-border {
      height: 5px;
      background: linear-gradient(90deg, #d4ab3f, #dcb345, #d4ab3f);
      margin: 25px 0;
      border-radius: 5px;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .invoice-container {
        box-shadow: none;
        border: 2px solid #333;
      }
      
      .header {
        background: #f5f5f5;
      }
      
      .company-name {
        color: #333;
      }
      
      .invoice-title {
        color: #ffffff;
        background: #000000;
        border: 3px solid #d4ab3f;
      }

      .info-section {
        background: #ffffff;
        border: 3px solid #d4ab3f;
      }

      .info-section h3 {
        color: #000000;
        background: #d4ab3f;
      }

      .info-value {
        background: #fff7ed;
        border: 2px solid #d4ab3f;
      }
      
      .table-header {
        background: #333 !important;
        color: white !important;
      }
      
      .total-section {
        background: #000000;
        border: 3px solid #d4ab3f;
      }

      .total-label, .currency-label, .total-words {
        color: #ffffff;
      }

      .total-value {
        color: #d4ab3f;
      }
      
      .signature-box {
        background: #ffffff;
        border: 3px solid #d4ab3f;
      }

      .signature-label {
        color: #000000;
        background: #d4ab3f;
      }

      .signature-line {
        border-top: 3px solid #d4ab3f;
      }

      .footer {
        background: #000000;
        border-top: 5px solid #d4ab3f;
      }

      .footer-text {
        color: #d4ab3f;
      }

      .print-date {
        color: #ffffff;
      }
    }
  </style>
</head>
  <body>
    <div class="invoice-container">
      <div class="header" style="direction: rtl; display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #D4AF37; padding-bottom: 15px;">
        <div style="text-align: right; display: flex; align-items: center; gap: 12px;">
          <div class="company-logo" style="background: #D4AF37; color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold;">ف</div>
          <!-- بدون أي نصوص ثابتة: يتم التحكم في الهيدر من القالب الموحد فقط -->
        </div>
        <div class="invoice-title" style="text-align: left; font-size: 24px; font-weight: bold; color: #B8860B;">فاتورة مبيعات</div>
      </div>

    
    <div class="content">
      <div class="invoice-info">
        <div class="info-section">
          <h3>بيانات الفاتورة</h3>
          <div class="info-row">
            <span class="info-label">رقم الفاتورة:</span>
            <span class="info-value">${data.invoiceNumber}</span>
          </div>
          <div class="info-row">
            <span class="info-label">التاريخ:</span>
            <span class="info-value">${data.date}</span>
          </div>
        </div>
        
        <div class="info-section">
          <h3>المطلوب من السادة</h3>
          <div class="info-row">
            <span class="info-label">اسم العميل:</span>
            <span class="info-value">${data.customerName}</span>
          </div>
        </div>
      </div>
      
      <div class="decorative-border"></div>
      
      <table class="items-table">
        <thead class="table-header">
          <tr>
            <th style="width: 40%;">البيان</th>
            <th style="width: 15%;">الكمية</th>
            <th style="width: 20%;">سعر الوحدة</th>
            <th style="width: 25%;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
      
      <div class="total-section">
        <div class="total-label">الإجمالي النهائي</div>
        <div class="total-value">${data.totalAmount.toLocaleString('ar-LY')} د.ل</div>
        <div class="currency-label">دينار ليبي</div>
        <div class="total-words">${data.totalInWords}</div>
      </div>
      
      ${data.notes ? `
      <div class="info-section">
        <h3>ملاحظات</h3>
        <div style="color: #181616; font-size: 16px; line-height: 1.6;">
          ${data.notes}
        </div>
      </div>
      ` : ''}
      
      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-label">توقيع العميل</div>
          <div class="signature-line">التوقيع</div>
        </div>
        <div class="signature-box">
          <div class="signature-label">الختم</div>
          <div class="signature-line">ختم الشركة</div>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <div class="footer-text">شكراً لتعاملكم معنا</div>
      <div class="print-date">تاريخ الطباعة: ${new Date().toLocaleString('ar-LY')}</div>
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