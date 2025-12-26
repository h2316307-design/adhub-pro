import { 
  SharedInvoiceSettings, 
  IndividualInvoiceSettings, 
  InvoiceTemplateType, 
  INVOICE_TEMPLATES, 
  AlignmentOption,
  INVOICE_TITLES,
  hasSection 
} from '@/types/invoice-templates';
import { RealInvoiceData } from '@/hooks/useRealInvoiceData';

interface Props {
  templateType: InvoiceTemplateType;
  sharedSettings: SharedInvoiceSettings;
  individualSettings: IndividualInvoiceSettings;
  scale?: number;
  realData?: RealInvoiceData | null;
}

const hexToRgba = (hex: string, opacity: number) => {
  if (!hex || hex === 'transparent') return 'transparent';
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
  } catch {
    return hex;
  }
};

const getTextAlign = (alignment: AlignmentOption): 'right' | 'center' | 'left' => {
  return alignment || 'right';
};

const getFlexJustify = (alignment: AlignmentOption): string => {
  switch (alignment) {
    case 'left': return 'flex-start';
    case 'center': return 'center';
    case 'right': 
    default: return 'flex-end';
  }
};

// بيانات تجريبية لكل نوع
const getSampleData = (templateType: InvoiceTemplateType) => {
  const baseData = {
    invoiceNumber: 'INV-1170',
    date: '2025-12-24',
    contractNumber: '1170',
  };

  switch (templateType) {
    case 'contract':
    case 'offer':
      return {
        ...baseData,
        customer: { name: 'علي عمار', company: 'شركة المتحدة', phone: '218101-2012255', period: '1 سبتمبر 2025 إلى 30 نوفمبر 2025' },
        billboards: [
          { id: 1, name: 'لوحة طريق المطار', size: '14x5', faces: 2, location: 'طرابلس', price: 24000 },
        ],
        subtotal: 24000, discount: 5000, total: 19000,
      };
    
    case 'receipt':
    case 'team_payment':
    case 'friend_rental':
      return {
        ...baseData,
        customer: { name: 'علي عمار', company: 'شركة المتحدة', phone: '218101-2012255' },
        payment: { amount: 10000, method: 'نقدي', reference: 'PAY-001', previousBalance: 15000, newBalance: 5000 },
        team: { name: 'فريق التركيب الأول', leader: 'أحمد محمد', members: 3 },
      };
    
    case 'print_invoice':
    case 'print_task':
    case 'cutout_task':
      return {
        ...baseData,
        customer: { name: 'علي عمار', company: 'شركة المتحدة', phone: '218101-2012255' },
        items: [
          { description: 'طباعة فليكس 520 جرام', size: '14x5 متر', qty: 2, unitPrice: 50, total: 7000 },
          { description: 'قص مجسمات', size: '2x1 متر', qty: 5, unitPrice: 200, total: 1000 },
        ],
        subtotal: 8000, discount: 500, total: 7500,
      };
    
    case 'sales_invoice':
    case 'purchase_invoice':
      return {
        ...baseData,
        customer: { name: 'علي عمار', company: 'شركة المتحدة', phone: '218101-2012255' },
        items: [
          { description: 'مادة فليكس', unit: 'متر', qty: 100, unitPrice: 25, total: 2500 },
          { description: 'حبر طباعة', unit: 'لتر', qty: 5, unitPrice: 300, total: 1500 },
        ],
        subtotal: 4000, discount: 0, total: 4000,
      };
    
    case 'custody':
      return {
        ...baseData,
        custodyInfo: { employeeName: 'محمد أحمد', accountNumber: 'CUS-001', initialAmount: 5000, currentBalance: 3500 },
        transactions: [
          { date: '2025-12-20', description: 'صرف مشتريات', debit: 500, credit: 0, balance: 4500 },
          { date: '2025-12-22', description: 'صرف وقود', debit: 1000, credit: 0, balance: 3500 },
        ],
        balance: { total: 5000, spent: 1500, remaining: 3500 },
      };
    
    case 'expenses':
      return {
        ...baseData,
        items: [
          { description: 'وقود سيارة', category: 'مواصلات', qty: 1, unitPrice: 200, total: 200 },
          { description: 'مستلزمات مكتبية', category: 'إدارية', qty: 1, unitPrice: 150, total: 150 },
        ],
        subtotal: 350, discount: 0, total: 350,
      };
    
    case 'installation':
      return {
        ...baseData,
        customer: { name: 'علي عمار', company: 'شركة المتحدة', phone: '218101-2012255' },
        billboards: [
          { id: 1, name: 'لوحة طريق المطار', size: '14x5', faces: 2, location: 'طرابلس', price: 0 },
        ],
        services: [
          { description: 'تركيب لوحة', qty: 1, unitPrice: 500, total: 500 },
          { description: 'رفع اللوحة', qty: 1, unitPrice: 200, total: 200 },
        ],
        team: { name: 'فريق التركيب الأول', leader: 'أحمد محمد', members: 3 },
        subtotal: 700, discount: 0, total: 700,
      };
    
    case 'account_statement':
    case 'overdue_notice':
      return {
        ...baseData,
        customer: { name: 'علي عمار', company: 'شركة المتحدة', phone: '218101-2012255' },
        transactions: [
          { date: '2025-12-01', description: 'فاتورة عقد #1170', debit: 19000, credit: 0, balance: 19000 },
          { date: '2025-12-10', description: 'دفعة نقدية', debit: 0, credit: 10000, balance: 9000 },
          { date: '2025-12-15', description: 'فاتورة طباعة #PT-001', debit: 5000, credit: 0, balance: 14000 },
        ],
        balance: { totalDebit: 24000, totalCredit: 10000, remaining: 14000 },
      };
    
    default:
      return {
        ...baseData,
        customer: { name: 'علي عمار', company: 'شركة المتحدة', phone: '218101-2012255' },
        items: [{ description: 'عنصر تجريبي', qty: 1, unitPrice: 1000, total: 1000 }],
        subtotal: 1000, discount: 0, total: 1000,
      };
  }
};

export function UnifiedInvoicePreview({ templateType, sharedSettings, individualSettings, scale = 0.5, realData }: Props) {
  const template = INVOICE_TEMPLATES.find(t => t.id === templateType);
  // Use real data if provided, otherwise fall back to sample data
  const sampleData = realData || getSampleData(templateType);
  const titles = INVOICE_TITLES[templateType];
  
  const pageMarginTop = sharedSettings.pageMarginTop || 15;
  const pageMarginBottom = sharedSettings.pageMarginBottom || 15;
  const pageMarginLeft = sharedSettings.pageMarginLeft || 15;
  const pageMarginRight = sharedSettings.pageMarginRight || 15;
  const headerMarginBottom = sharedSettings.headerMarginBottom || 20;
  const footerPosition = sharedSettings.footerPosition || 15;
  const contentBottomSpacing = sharedSettings.contentBottomSpacing ?? 25;

  const paperStyle: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm',
    backgroundColor: '#fff',
    fontFamily: sharedSettings.fontFamily,
    transform: `scale(${scale})`,
    transformOrigin: 'top center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: `${pageMarginTop}mm`,
    paddingBottom: `${pageMarginBottom}mm`,
    paddingLeft: `${pageMarginLeft}mm`,
    paddingRight: `${pageMarginRight}mm`,
    direction: 'rtl',
  };

  const backgroundStyle: React.CSSProperties = sharedSettings.backgroundImage ? {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: `url(${sharedSettings.backgroundImage})`,
    backgroundSize: `${sharedSettings.backgroundScale}%`,
    backgroundPosition: `${sharedSettings.backgroundPosX}% ${sharedSettings.backgroundPosY}%`,
    backgroundRepeat: 'no-repeat',
    opacity: sharedSettings.backgroundOpacity / 100,
    pointerEvents: 'none',
    zIndex: 0,
  } : {};

  const renderHeader = () => {
    if (!individualSettings.showHeader) return null;

    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: `${headerMarginBottom}px`,
        paddingBottom: '15px',
        borderBottom: `2px solid ${individualSettings.primaryColor}`,
      }}>
        {/* Invoice Title Side */}
        {sharedSettings.showInvoiceTitle && (
          <div style={{ flex: 1, textAlign: getTextAlign(sharedSettings.invoiceTitleAlignment), direction: 'ltr' }}>
            <h1 style={{ 
              fontSize: `${sharedSettings.invoiceTitleFontSize || 28}px`, fontWeight: 'bold', margin: 0,
              fontFamily: 'Manrope, sans-serif', letterSpacing: '2px',
              color: individualSettings.secondaryColor,
            }}>
              {titles.en}
            </h1>
            <div style={{ fontSize: '11px', color: individualSettings.customerSectionTextColor, marginTop: '8px', lineHeight: 1.6 }}>
              رقم الفاتورة: {sampleData.invoiceNumber}<br/>
              التاريخ: {sampleData.date}<br/>
              {sampleData.contractNumber && <>رقم العقد: {sampleData.contractNumber}</>}
            </div>
          </div>
        )}

        {/* Company Info Side */}
        <div style={{ 
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: sharedSettings.logoPosition === 'left' ? 'flex-start' 
                    : sharedSettings.logoPosition === 'center' ? 'center' : 'flex-end',
          gap: '8px',
        }}>
          {sharedSettings.showLogo && (
            <img src={sharedSettings.logoPath} alt="Logo" 
              style={{ height: `${sharedSettings.logoSize}px`, objectFit: 'contain', flexShrink: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          
          {sharedSettings.showContactInfo && (
            <div style={{ 
              fontSize: `${sharedSettings.contactInfoFontSize || 10}px`, 
              color: individualSettings.customerSectionTextColor, lineHeight: 1.6,
              textAlign: sharedSettings.contactInfoAlignment || 'center',
            }}>
              {sharedSettings.companyAddress && <div>{sharedSettings.companyAddress}</div>}
              {sharedSettings.companyPhone && <div>هاتف: {sharedSettings.companyPhone}</div>}
            </div>
          )}
          
          {sharedSettings.showCompanyInfo && (sharedSettings.showCompanyName || sharedSettings.showCompanySubtitle) && (
            <div style={{ fontSize: '11px', color: individualSettings.customerSectionTextColor, lineHeight: 1.8, textAlign: 'right' }}>
              {sharedSettings.showCompanyName && (
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: individualSettings.primaryColor, marginBottom: '2px' }}>
                  {sharedSettings.companyName}
                </div>
              )}
              {sharedSettings.showCompanySubtitle && (
                <div>{sharedSettings.companySubtitle}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCustomerSection = () => {
    if (!individualSettings.showCustomerSection || !hasSection(templateType, 'customer')) return null;
    const customer = (sampleData as any).customer;
    if (!customer) return null;

    return (
      <div style={{
        backgroundColor: individualSettings.customerSectionBgColor,
        borderRight: `4px solid ${individualSettings.customerSectionBorderColor}`,
        padding: '15px 20px', marginBottom: '20px',
        textAlign: getTextAlign(individualSettings.customerSectionAlignment),
      }}>
        <h3 style={{ fontSize: `${individualSettings.headerFontSize}px`, fontWeight: 'bold', color: individualSettings.customerSectionTitleColor, marginBottom: '10px' }}>
          بيانات العميل
        </h3>
        <div style={{ fontSize: `${individualSettings.bodyFontSize}px`, color: individualSettings.customerSectionTextColor, lineHeight: 1.8 }}>
          <div><strong>الاسم:</strong> {customer.name}</div>
          {customer.company && <div><strong>الشركة:</strong> {customer.company}</div>}
          <div><strong>الهاتف:</strong> {customer.phone}</div>
          {customer.period && <div><strong>مدة العقد:</strong> {customer.period}</div>}
        </div>
      </div>
    );
  };

  const renderBillboardsSection = () => {
    if (!individualSettings.showBillboardsSection || !hasSection(templateType, 'billboards')) return null;
    const billboards = (sampleData as any).billboards;
    if (!billboards) return null;

    return (
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: `${individualSettings.headerFontSize}px`, fontWeight: 'bold', color: individualSettings.billboardsSectionTitleColor, marginBottom: '10px' }}>
          اللوحات الإعلانية
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${individualSettings.bodyFontSize}px` }}>
          <thead>
            <tr style={{ backgroundColor: individualSettings.tableHeaderBgColor }}>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>م</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>اسم اللوحة</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>المقاس</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>الأوجه</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>الموقع</th>
              {templateType !== 'installation' && <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>السعر</th>}
            </tr>
          </thead>
          <tbody>
            {billboards.map((b: any, i: number) => (
              <tr key={i} style={{ backgroundColor: hexToRgba(i % 2 === 0 ? individualSettings.tableRowEvenColor : individualSettings.tableRowOddColor, individualSettings.tableRowOpacity) }}>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{i + 1}</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{b.name}</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{b.size}</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{b.faces}</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{b.location}</td>
                {templateType !== 'installation' && <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor, fontWeight: 'bold' }}>{b.price?.toLocaleString()} د.ل</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderItemsSection = () => {
    if (!individualSettings.showItemsSection || !hasSection(templateType, 'items')) return null;
    const items = (sampleData as any).items;
    if (!items) return null;

    return (
      <div style={{ marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${individualSettings.bodyFontSize}px` }}>
          <thead>
            <tr style={{ backgroundColor: individualSettings.tableHeaderBgColor }}>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', width: '40px' }}>م</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>الوصف</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>الكمية</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>السعر/الوحدة</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>المجموع</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, i: number) => (
              <tr key={i} style={{ backgroundColor: hexToRgba(i % 2 === 0 ? individualSettings.tableRowEvenColor : individualSettings.tableRowOddColor, individualSettings.tableRowOpacity) }}>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{i + 1}</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{item.description}</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{item.qty}</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{item.unitPrice.toLocaleString()} د.ل</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor, fontWeight: 'bold' }}>{item.total.toLocaleString()} د.ل</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderServicesSection = () => {
    if (!individualSettings.showServicesSection || !hasSection(templateType, 'services')) return null;
    const services = (sampleData as any).services;
    if (!services) return null;

    return (
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: `${individualSettings.headerFontSize}px`, fontWeight: 'bold', color: individualSettings.servicesSectionTitleColor, marginBottom: '10px' }}>
          الخدمات
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${individualSettings.bodyFontSize}px` }}>
          <thead>
            <tr style={{ backgroundColor: individualSettings.tableHeaderBgColor }}>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>الخدمة</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>الكمية</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>السعر</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>المجموع</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s: any, i: number) => (
              <tr key={i} style={{ backgroundColor: hexToRgba(i % 2 === 0 ? individualSettings.tableRowEvenColor : individualSettings.tableRowOddColor, individualSettings.tableRowOpacity) }}>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{s.description}</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{s.qty}</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{s.unitPrice.toLocaleString()} د.ل</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor, fontWeight: 'bold' }}>{s.total.toLocaleString()} د.ل</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTransactionsSection = () => {
    if (!individualSettings.showTransactionsSection || !hasSection(templateType, 'transactions')) return null;
    const transactions = (sampleData as any).transactions;
    if (!transactions) return null;

    return (
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: `${individualSettings.headerFontSize}px`, fontWeight: 'bold', color: individualSettings.primaryColor, marginBottom: '10px' }}>
          الحركات المالية
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${individualSettings.bodyFontSize}px` }}>
          <thead>
            <tr style={{ backgroundColor: individualSettings.tableHeaderBgColor }}>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>التاريخ</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>البيان</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>مدين</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>دائن</th>
              <th style={{ padding: '12px 8px', color: individualSettings.tableHeaderTextColor, border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center' }}>الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t: any, i: number) => (
              <tr key={i} style={{ backgroundColor: hexToRgba(i % 2 === 0 ? individualSettings.tableRowEvenColor : individualSettings.tableRowOddColor, individualSettings.tableRowOpacity) }}>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{t.date}</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor }}>{t.description}</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.balanceSummaryNegativeColor }}>{t.debit > 0 ? t.debit.toLocaleString() : '-'}</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.balanceSummaryPositiveColor }}>{t.credit > 0 ? t.credit.toLocaleString() : '-'}</td>
                <td style={{ padding: '12px 8px', border: `1px solid ${individualSettings.tableBorderColor}`, textAlign: 'center', color: individualSettings.tableTextColor, fontWeight: 'bold' }}>{t.balance.toLocaleString()} د.ل</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPaymentInfoSection = () => {
    if (!individualSettings.showPaymentInfoSection || !hasSection(templateType, 'payment_info')) return null;
    const payment = (sampleData as any).payment;
    if (!payment) return null;

    return (
      <div style={{
        backgroundColor: individualSettings.paymentSectionBgColor,
        border: `2px solid ${individualSettings.paymentSectionBorderColor}`,
        borderRadius: '8px', padding: '20px', marginBottom: '20px',
      }}>
        <h3 style={{ fontSize: `${individualSettings.headerFontSize}px`, fontWeight: 'bold', color: individualSettings.paymentSectionTitleColor, marginBottom: '15px' }}>
          معلومات الدفع
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: `${individualSettings.bodyFontSize}px`, color: individualSettings.paymentSectionTextColor }}>
          <div><strong>المبلغ المدفوع:</strong> {payment.amount.toLocaleString()} د.ل</div>
          <div><strong>طريقة الدفع:</strong> {payment.method}</div>
          <div><strong>رقم المرجع:</strong> {payment.reference}</div>
          <div><strong>الرصيد السابق:</strong> {payment.previousBalance.toLocaleString()} د.ل</div>
          <div style={{ gridColumn: 'span 2', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px', color: individualSettings.paymentSectionTitleColor }}>
            الرصيد الجديد: {payment.newBalance.toLocaleString()} د.ل
          </div>
        </div>
      </div>
    );
  };

  const renderCustodyInfoSection = () => {
    if (!individualSettings.showCustodyInfoSection || !hasSection(templateType, 'custody_info')) return null;
    const custodyInfo = (sampleData as any).custodyInfo;
    if (!custodyInfo) return null;

    return (
      <div style={{
        backgroundColor: individualSettings.custodySectionBgColor,
        borderRight: `4px solid ${individualSettings.custodySectionBorderColor}`,
        padding: '15px 20px', marginBottom: '20px',
      }}>
        <h3 style={{ fontSize: `${individualSettings.headerFontSize}px`, fontWeight: 'bold', color: individualSettings.custodySectionTitleColor, marginBottom: '10px' }}>
          معلومات العهدة
        </h3>
        <div style={{ fontSize: `${individualSettings.bodyFontSize}px`, color: individualSettings.custodySectionTextColor, lineHeight: 1.8 }}>
          <div><strong>اسم المستلم:</strong> {custodyInfo.employeeName}</div>
          <div><strong>رقم الحساب:</strong> {custodyInfo.accountNumber}</div>
          <div><strong>المبلغ الأولي:</strong> {custodyInfo.initialAmount.toLocaleString()} د.ل</div>
          <div><strong>الرصيد الحالي:</strong> {custodyInfo.currentBalance.toLocaleString()} د.ل</div>
        </div>
      </div>
    );
  };

  const renderTeamInfoSection = () => {
    if (!individualSettings.showTeamInfoSection || !hasSection(templateType, 'team_info')) return null;
    const team = (sampleData as any).team;
    if (!team) return null;

    return (
      <div style={{
        backgroundColor: individualSettings.teamSectionBgColor,
        borderRight: `4px solid ${individualSettings.teamSectionBorderColor}`,
        padding: '15px 20px', marginBottom: '20px',
      }}>
        <h3 style={{ fontSize: `${individualSettings.headerFontSize}px`, fontWeight: 'bold', color: individualSettings.teamSectionTitleColor, marginBottom: '10px' }}>
          معلومات الفريق
        </h3>
        <div style={{ fontSize: `${individualSettings.bodyFontSize}px`, color: individualSettings.teamSectionTextColor, lineHeight: 1.8 }}>
          <div><strong>اسم الفريق:</strong> {team.name}</div>
          <div><strong>رئيس الفريق:</strong> {team.leader}</div>
          <div><strong>عدد الأعضاء:</strong> {team.members}</div>
        </div>
      </div>
    );
  };

  const renderBalanceSummarySection = () => {
    if (!individualSettings.showBalanceSummarySection || !hasSection(templateType, 'balance_summary')) return null;
    const balance = (sampleData as any).balance;
    if (!balance) return null;

    return (
      <div style={{
        backgroundColor: individualSettings.balanceSummaryBgColor,
        border: `2px solid ${individualSettings.balanceSummaryBorderColor}`,
        borderRadius: '8px', padding: '20px', marginTop: '20px',
      }}>
        <h3 style={{ fontSize: `${individualSettings.headerFontSize}px`, fontWeight: 'bold', color: individualSettings.balanceSummaryTitleColor || individualSettings.primaryColor, marginBottom: '15px', textAlign: 'center' }}>
          ملخص الرصيد
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', fontSize: `${individualSettings.bodyFontSize}px`, color: individualSettings.balanceSummaryTextColor || '#333' }}>
          {balance.totalDebit !== undefined ? (
            <>
              <div>
                <div style={{ color: individualSettings.balanceSummaryNegativeColor, fontSize: '20px', fontWeight: 'bold' }}>{balance.totalDebit.toLocaleString()}</div>
                <div>إجمالي المدين</div>
              </div>
              <div>
                <div style={{ color: individualSettings.balanceSummaryPositiveColor, fontSize: '20px', fontWeight: 'bold' }}>{balance.totalCredit.toLocaleString()}</div>
                <div>إجمالي الدائن</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{balance.total.toLocaleString()}</div>
                <div>إجمالي العهدة</div>
              </div>
              <div>
                <div style={{ color: individualSettings.balanceSummaryNegativeColor, fontSize: '20px', fontWeight: 'bold' }}>{balance.spent.toLocaleString()}</div>
                <div>المصروف</div>
              </div>
            </>
          )}
          <div>
            <div style={{ color: balance.remaining > 0 ? individualSettings.balanceSummaryNegativeColor : individualSettings.balanceSummaryPositiveColor, fontSize: '20px', fontWeight: 'bold' }}>
              {balance.remaining.toLocaleString()}
            </div>
            <div>الرصيد المتبقي</div>
          </div>
        </div>
      </div>
    );
  };

  const renderTotalsSection = () => {
    if (!individualSettings.showTotalsSection || !hasSection(templateType, 'totals')) return null;
    const data = sampleData as any;
    if (data.subtotal === undefined) return null;

    return (
      <div style={{ marginTop: '30px', textAlign: getTextAlign(individualSettings.totalsAlignment) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${individualSettings.notesBorderColor}`, fontSize: `${individualSettings.bodyFontSize}px`, backgroundColor: individualSettings.subtotalBgColor !== 'transparent' ? individualSettings.subtotalBgColor : undefined, color: individualSettings.subtotalTextColor }}>
          <span style={{ fontWeight: 'bold' }}>المجموع الفرعي:</span>
          <span>{data.subtotal.toLocaleString()} د.ل</span>
        </div>
        {data.discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${individualSettings.notesBorderColor}`, fontSize: `${individualSettings.bodyFontSize}px`, color: individualSettings.discountTextColor }}>
            <span>خصم:</span>
            <span>- {data.discount.toLocaleString()} د.ل</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 20px', marginTop: '15px', backgroundColor: individualSettings.totalBgColor, color: individualSettings.totalTextColor, fontSize: `${individualSettings.headerFontSize + 4}px`, fontWeight: 'bold' }}>
          <span>المجموع الإجمالي:</span>
          <span>{data.total.toLocaleString()} د.ل</span>
        </div>
      </div>
    );
  };

  const renderSignaturesSection = () => {
    if (!individualSettings.showSignaturesSection || !hasSection(templateType, 'signatures')) return null;

    return (
      <div style={{
        marginTop: '40px', display: 'flex', justifyContent: 'space-between', padding: '20px 0',
        borderTop: `1px solid ${individualSettings.signaturesSectionBorderColor}`,
      }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ borderBottom: `2px solid ${individualSettings.signatureLineColor}`, width: '120px', margin: '0 auto 10px' }}></div>
          <div style={{ fontSize: `${individualSettings.bodyFontSize}px`, color: individualSettings.signaturesSectionTextColor }}>توقيع العميل</div>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ borderBottom: `2px solid ${individualSettings.signatureLineColor}`, width: '120px', margin: '0 auto 10px' }}></div>
          <div style={{ fontSize: `${individualSettings.bodyFontSize}px`, color: individualSettings.signaturesSectionTextColor }}>توقيع الشركة</div>
        </div>
      </div>
    );
  };

  const renderNotesSection = () => {
    if (!individualSettings.showNotesSection || !hasSection(templateType, 'notes')) return null;

    return (
      <div style={{ 
        marginTop: '20px', padding: '15px',
        backgroundColor: individualSettings.notesBgColor, borderRadius: '4px',
        border: `1px solid ${individualSettings.notesBorderColor}`,
        fontSize: `${individualSettings.bodyFontSize}px`, lineHeight: 1.8,
        color: individualSettings.notesTextColor,
        textAlign: getTextAlign(individualSettings.notesAlignment),
      }}>
        <div><strong>ملاحظات:</strong></div>
        <div style={{ marginTop: '5px' }}>• هذا نموذج معاينة للفاتورة</div>
        <div>• يمكنك تعديل الألوان والإعدادات من القائمة الجانبية</div>
      </div>
    );
  };

  const renderFooter = () => {
    if (!sharedSettings.showFooter) return null;

    return (
      <div style={{
        width: '100%', marginBottom: `${footerPosition}mm`, paddingTop: '10px',
        borderTop: `1px solid ${individualSettings.tableBorderColor}`,
        backgroundColor: sharedSettings.footerBgColor !== 'transparent' ? sharedSettings.footerBgColor : undefined,
        color: sharedSettings.footerTextColor, fontSize: '10px',
        display: 'flex', alignItems: 'center', justifyContent: getFlexJustify(sharedSettings.footerAlignment), gap: '20px',
      }}>
        <span>{sharedSettings.footerText}</span>
        {sharedSettings.showPageNumber && (
          <span style={{
            marginRight: sharedSettings.footerAlignment === 'right' ? 'auto' : 0,
            marginLeft: sharedSettings.footerAlignment === 'left' ? 'auto' : 0,
          }}>
            صفحة 1 من 1
          </span>
        )}
      </div>
    );
  };

  return (
    <div data-print-content style={paperStyle}>
      {sharedSettings.backgroundImage && <div style={backgroundStyle} />}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ flex: 1, paddingBottom: `${contentBottomSpacing}mm` }}>
          {renderHeader()}
          {renderCustomerSection()}
          {renderCustodyInfoSection()}
          {renderBillboardsSection()}
          {renderItemsSection()}
          {renderServicesSection()}
          {renderTransactionsSection()}
          {renderPaymentInfoSection()}
          {renderTeamInfoSection()}
          {renderTotalsSection()}
          {renderBalanceSummarySection()}
          {renderSignaturesSection()}
          {renderNotesSection()}
        </div>
        {renderFooter()}
      </div>
    </div>
  );
}
