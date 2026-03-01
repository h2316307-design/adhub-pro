import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Printer, Loader2, X, History, Table, Settings, Eye } from 'lucide-react';
import { formatGregorianDate } from '@/lib/utils';
import { 
  SharedInvoiceSettings, 
  IndividualInvoiceSettings, 
  AllInvoiceSettings,
  DEFAULT_SHARED_SETTINGS, 
  DEFAULT_INDIVIDUAL_SETTINGS,
} from '@/types/invoice-templates';

// Use the same key as PrintDesignNew page
const UNIFIED_SETTINGS_KEY = 'unified_invoice_templates_settings';

interface HistoryRecord {
  id: string;
  contract_number: number;
  customer_name: string;
  ad_type: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  rent_amount: number;
  discount_amount?: number;
  discount_percentage?: number;
  installation_date: string;
  installation_cost?: number;
  billboard_rent_price?: number;
  total_before_discount?: number;
  design_face_a_url?: string;
  design_face_b_url?: string;
  installed_image_face_a_url?: string;
  installed_image_face_b_url?: string;
  team_name?: string;
  notes?: string;
  print_cost?: number;
  include_installation_in_price?: boolean;
  include_print_in_price?: boolean;
  pricing_category?: string;
  pricing_mode?: string;
}

interface BillboardHistoryPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboardId: number;
  billboardName: string;
  history: HistoryRecord[];
  totalRentals: number;
  totalRevenue: number;
  totalDays: number;
}

export function BillboardHistoryPrintDialog({
  open,
  onOpenChange,
  billboardId,
  billboardName,
  history,
  totalRentals,
  totalRevenue,
  totalDays
}: BillboardHistoryPrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shared, setShared] = useState<SharedInvoiceSettings>(DEFAULT_SHARED_SETTINGS);
  const [individual, setIndividual] = useState<IndividualInvoiceSettings>(DEFAULT_INDIVIDUAL_SETTINGS);

  // Column visibility options
  const [showContractNumber, setShowContractNumber] = useState(true);
  const [showCustomerName, setShowCustomerName] = useState(true);
  const [showAdType, setShowAdType] = useState(true);
  const [showDates, setShowDates] = useState(true);
  const [showDuration, setShowDuration] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showInstallation, setShowInstallation] = useState(true);
  const [showPrint, setShowPrint] = useState(true);
  const [showTeam, setShowTeam] = useState(false);
  const [showInstallationImages, setShowInstallationImages] = useState(true);
  const [showDesignImages, setShowDesignImages] = useState(true);

  // Load settings from the SAME source as SizesInvoicePrintDialog
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        const { data: unifiedData } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', UNIFIED_SETTINGS_KEY)
          .maybeSingle();

        if (unifiedData?.setting_value) {
          const allSettings: AllInvoiceSettings = JSON.parse(unifiedData.setting_value);
          
          if (allSettings.shared) {
            setShared({ ...DEFAULT_SHARED_SETTINGS, ...allSettings.shared });
          }
          
          // Use sizes_invoice settings as base
          if (allSettings.individual && allSettings.individual['sizes_invoice']) {
            setIndividual({ ...DEFAULT_INDIVIDUAL_SETTINGS, ...allSettings.individual['sizes_invoice'] });
          }
        }
      } catch (e) {
        console.error('Error loading settings:', e);
      } finally {
        setIsLoading(false);
      }
    };

    if (open) {
      loadData();
    }
  }, [open]);

  const handlePrint = () => {
    if (!printRef.current) return;

    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('فشل فتح نافذة الطباعة');
      return;
    }

    const fontFamily = shared.fontFamily || 'Doran';
    const pageMarginTop = shared.pageMarginTop || 15;
    const pageMarginBottom = shared.pageMarginBottom || 15;
    const pageMarginLeft = shared.pageMarginLeft || 15;
    const pageMarginRight = shared.pageMarginRight || 15;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير تاريخ اللوحة - ${billboardName}</title>
        <style>
          @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
          @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
          @font-face { font-family: 'Manrope'; src: url('/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
          @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
          
          * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            color-adjust: exact !important; 
          }
          
          html, body { 
            font-family: '${fontFamily}', 'Noto Sans Arabic', Arial, sans-serif;
            direction: rtl;
            background: #ffffff !important;
            color: ${individual.tableTextColor || '#333333'};
          }
          
          .print-container {
            width: 277mm;
            min-height: 190mm;
            padding: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm;
            background: #ffffff;
            position: relative;
          }
          
          table { 
            border-collapse: collapse; 
            page-break-inside: auto;
          }
          
          tr { 
            page-break-inside: avoid; 
          }
          
          th, td { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          
          .totals-section {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          .section-header {
            page-break-after: avoid;
            break-after: avoid;
          }
          
          @media print {
            @page { 
              size: A4 landscape; 
              margin: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm;
            }
            
            * { 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
              color-adjust: exact !important; 
            }
            
            html, body { 
              background: #ffffff !important; 
              width: 100%;
              height: 100%;
            }
            
            .print-container {
              width: 100%;
              min-height: auto;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${printContent}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 800);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // All colors from individual settings
  const primaryColor = individual.primaryColor || '#D4AF37';
  const secondaryColor = individual.secondaryColor || '#1a1a2e';

  // Table colors
  const tableHeaderBg = individual.tableHeaderBgColor || '#D4AF37';
  const tableHeaderText = individual.tableHeaderTextColor || '#ffffff';
  const tableBorder = individual.tableBorderColor || '#D4AF37';
  const tableRowEven = individual.tableRowEvenColor || '#f8f9fa';
  const tableRowOdd = individual.tableRowOddColor || '#ffffff';
  const tableText = individual.tableTextColor || '#333333';
  const tableRowOpacity = (individual.tableRowOpacity || 100) / 100;

  // Customer section colors
  const customerBg = individual.customerSectionBgColor || '#f8f9fa';
  const customerBorder = individual.customerSectionBorderColor || '#D4AF37';
  const customerTitle = individual.customerSectionTitleColor || '#D4AF37';
  const customerText = individual.customerSectionTextColor || '#333333';

  // Totals colors
  const totalBg = individual.totalBgColor || '#D4AF37';
  const totalText = individual.totalTextColor || '#ffffff';

  // Font sizes
  const titleFontSize = individual.titleFontSize || 24;
  const headerFontSize = individual.headerFontSize || 14;
  const bodyFontSize = individual.bodyFontSize || 12;

  // Helper function for rgba conversion
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

  const getFlexJustify = (alignment: string | undefined): string => {
    switch (alignment) {
      case 'left': return 'flex-start';
      case 'center': return 'center';
      case 'right': 
      default: return 'flex-end';
    }
  };

  // Header rendering - same as SizesInvoicePrintDialog
  const renderHeader = () => {
    if (individual.showHeader === false) return null;
    
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: `${shared.headerMarginBottom || 20}px`,
        paddingBottom: '15px',
        borderBottom: `2px solid ${primaryColor}`,
      }}>
        {/* Titles Side - Right */}
        <div style={{ flex: 1, textAlign: 'right' }}>
          {shared.showCompanyInfo && (shared.showCompanyName || shared.showCompanySubtitle) && (
            <div style={{ marginBottom: '8px' }}>
              {shared.showCompanyName && (
                <div style={{ fontWeight: 'bold', fontSize: '16px', color: primaryColor, marginBottom: '2px' }}>
                  {shared.companyName}
                </div>
              )}
              {shared.showCompanySubtitle && (
                <div style={{ fontSize: '12px', color: customerText }}>{shared.companySubtitle}</div>
              )}
            </div>
          )}
          
          {shared.showInvoiceTitle && (
            <div>
              <h1 style={{ 
                fontSize: `${shared.invoiceTitleFontSize || 28}px`, fontWeight: 'bold', margin: 0,
                fontFamily: 'Manrope, sans-serif', letterSpacing: '2px',
                color: secondaryColor,
                textAlign: 'right',
              }}>
                BILLBOARD HISTORY
              </h1>
              <div style={{ fontSize: '12px', color: customerText, marginTop: '8px', lineHeight: 1.6, textAlign: 'right' }}>
                التاريخ: <span style={{ fontFamily: 'Manrope, sans-serif' }}>{new Date().toLocaleDateString('ar-LY')}</span><br/>
                اللوحة: <span>{billboardName}</span>
              </div>
            </div>
          )}
        </div>

        {/* Logo Side - Left */}
        <div style={{ 
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
        }}>
          {shared.showLogo && shared.logoPath && (
            <img src={shared.logoPath} alt="Logo" 
              style={{ height: `${shared.logoSize || 60}px`, objectFit: 'contain', flexShrink: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          
          {shared.showContactInfo && (
            <div style={{ 
              fontSize: `${shared.contactInfoFontSize || 10}px`, 
              color: customerText, lineHeight: 1.6,
              textAlign: 'left',
            }}>
              {shared.companyAddress && <div>{shared.companyAddress}</div>}
              {shared.companyPhone && <div>هاتف: <span style={{ fontFamily: 'Manrope, sans-serif', direction: 'ltr', display: 'inline-block' }}>{shared.companyPhone}</span></div>}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Billboard section with stats
  const renderBillboardSection = () => {
    if (!individual.showCustomerSection) return null;

    return (
      <div style={{
        background: `linear-gradient(135deg, ${customerBg}, #ffffff)`,
        padding: '20px',
        marginBottom: '28px',
        borderRadius: '12px',
        borderRight: `5px solid ${customerBorder}`,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{
              fontSize: `${bodyFontSize}px`,
              color: customerText,
              opacity: 0.7,
              marginBottom: '4px',
            }}>
              تقرير تاريخ اللوحة
            </div>
            <div style={{
              fontSize: `${titleFontSize - 4}px`,
              fontWeight: 'bold',
              color: customerTitle,
            }}>
              {billboardName}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: `${titleFontSize + 4}px`,
                fontWeight: 'bold',
                color: primaryColor,
                fontFamily: 'Manrope, sans-serif',
              }}>
                {totalRentals}
              </div>
              <div style={{ fontSize: `${bodyFontSize}px`, color: customerText, opacity: 0.7 }}>تأجير</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: `${titleFontSize + 4}px`,
                fontWeight: 'bold',
                color: primaryColor,
                fontFamily: 'Manrope, sans-serif',
              }}>
                {totalDays}
              </div>
              <div style={{ fontSize: `${bodyFontSize}px`, color: customerText, opacity: 0.7 }}>يوم</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: `${titleFontSize + 4}px`,
                fontWeight: 'bold',
                color: primaryColor,
                fontFamily: 'Manrope, sans-serif',
              }}>
                {totalRevenue.toLocaleString()}
              </div>
              <div style={{ fontSize: `${bodyFontSize}px`, color: customerText, opacity: 0.7 }}>إيرادات</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Table rendering
  const renderTable = () => {
    return (
      <div style={{ marginBottom: '20px', pageBreakInside: 'auto' }}>
        {/* Section Title */}
        <div 
          className="section-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '10px',
            paddingBottom: '8px',
            borderBottom: `2px solid ${primaryColor}`,
            pageBreakAfter: 'avoid',
          }}>
          <span style={{
            fontSize: `${headerFontSize}px`,
            fontWeight: 'bold',
            color: primaryColor,
          }}>سجل التأجيرات</span>
          <span style={{
            fontSize: `${bodyFontSize}px`,
            color: tableText,
            opacity: 0.7,
            marginRight: 'auto',
          }}>({history.length} سجل)</span>
        </div>

        {/* Table */}
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: `${bodyFontSize}px`,
          pageBreakInside: 'auto',
        }}>
          <thead>
            <tr style={{ backgroundColor: tableHeaderBg }}>
              <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '4%' }}>#</th>
              {showContractNumber && <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>العقد</th>}
              {showCustomerName && <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>الزبون</th>}
              {showAdType && <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>الإعلان</th>}
              {showDates && (
                <>
                  <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>البداية</th>
                  <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>النهاية</th>
                </>
              )}
              {showDuration && <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>المدة</th>}
              {showDiscount && <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>الخصم</th>}
              {showInstallation && <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>التركيب</th>}
              {showPrint && <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>الطباعة</th>}
              {showPrices && <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>المبلغ</th>}
              {showTeam && <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>الفريق</th>}
              {showInstallationImages && <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>صور التركيب</th>}
              {showDesignImages && <th style={{ padding: '10px 6px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center' }}>التصميم</th>}
            </tr>
          </thead>
          <tbody>
            {history.map((record, idx) => {
              const isCurrent = record.id.toString().startsWith('current-');
              const hasInstallationImages = record.installed_image_face_a_url || record.installed_image_face_b_url;
              const hasDesignImages = record.design_face_a_url || record.design_face_b_url;
              
              return (
                <tr key={record.id} style={{ 
                  backgroundColor: isCurrent ? '#dcfce7' : hexToRgba(idx % 2 === 0 ? tableRowEven : tableRowOdd, tableRowOpacity * 100),
                }}>
                  <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText }}>{idx + 1}</td>
                  {showContractNumber && (
                    <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontWeight: '600' }}>
                      {record.contract_number}
                      {isCurrent && (
                        <span style={{
                          display: 'inline-block',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: 'transparent',
                          border: `2px solid ${primaryColor}`,
                          color: primaryColor,
                          fontSize: '8px',
                          fontWeight: 'bold',
                          marginRight: '4px',
                        }}>حالي</span>
                      )}
                    </td>
                  )}
                  {showCustomerName && <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText }}>{record.customer_name || '-'}</td>}
                  {showAdType && <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText }}>{record.ad_type || '-'}</td>}
                  {showDates && (
                    <>
                      <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontFamily: 'Manrope, sans-serif', fontSize: '10px' }}>
                        {formatGregorianDate(record.start_date)}
                      </td>
                      <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontFamily: 'Manrope, sans-serif', fontSize: '10px' }}>
                        {formatGregorianDate(record.end_date)}
                      </td>
                    </>
                  )}
                  {showDuration && (
                    <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '20px',
                        backgroundColor: `${primaryColor}20`,
                        color: primaryColor,
                        fontFamily: 'Manrope, sans-serif',
                        fontWeight: 'bold',
                        fontSize: '10px',
                      }}>{record.duration_days} يوم</span>
                    </td>
                  )}
                  {showDiscount && (
                    <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontFamily: 'Manrope, sans-serif' }}>
                      {record.discount_amount ? Number(record.discount_amount).toLocaleString() : '-'}
                      {record.discount_percentage ? <span style={{ fontSize: '9px', opacity: 0.7 }}><br/>({record.discount_percentage.toFixed(1)}%)</span> : ''}
                    </td>
                  )}
                  {showInstallation && (
                    <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: primaryColor, fontFamily: 'Manrope, sans-serif', fontWeight: 'bold', fontSize: '11px' }}>
                      {record.installation_cost ? Number(record.installation_cost).toLocaleString() : '-'}
                      {record.include_installation_in_price && <span style={{ color: '#10b981', marginRight: '2px' }}>✓</span>}
                    </td>
                  )}
                  {showPrint && (
                    <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontFamily: 'Manrope, sans-serif' }}>
                      {record.print_cost ? Number(record.print_cost).toLocaleString() : '-'}
                      {record.include_print_in_price && <span style={{ color: '#10b981', marginRight: '2px' }}>✓</span>}
                    </td>
                  )}
                  {showPrices && (
                    <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: primaryColor, fontWeight: 'bold', fontFamily: 'Manrope, sans-serif' }}>
                      {Number(record.rent_amount || 0).toLocaleString()}
                    </td>
                  )}
                  {showTeam && <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText }}>{record.team_name || '-'}</td>}
                  {showInstallationImages && (
                    <td style={{ padding: '0', border: `1px solid ${tableBorder}`, textAlign: 'center', verticalAlign: 'middle', height: '100px' }}>
                      {hasInstallationImages ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '4px' }}>
                          {record.installed_image_face_a_url && (
                            <img src={record.installed_image_face_a_url} alt="تركيب أ" style={{ maxWidth: '70px', height: '90px', objectFit: 'contain' }} />
                          )}
                          {record.installed_image_face_b_url && (
                            <img src={record.installed_image_face_b_url} alt="تركيب ب" style={{ maxWidth: '70px', height: '90px', objectFit: 'contain' }} />
                          )}
                        </div>
                      ) : <span style={{ color: '#999', fontSize: '10px' }}>-</span>}
                    </td>
                  )}
                  {showDesignImages && (
                    <td style={{ padding: '0', border: `1px solid ${tableBorder}`, textAlign: 'center', verticalAlign: 'middle', height: '100px' }}>
                      {hasDesignImages ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center', alignItems: 'stretch', height: '100%', padding: '4px' }}>
                          {record.design_face_a_url && (
                            <img src={record.design_face_a_url} alt="تصميم أ" style={{ width: '100%', height: '42px', objectFit: 'contain' }} />
                          )}
                          {record.design_face_b_url && (
                            <img src={record.design_face_b_url} alt="تصميم ب" style={{ width: '100%', height: '42px', objectFit: 'contain' }} />
                          )}
                        </div>
                      ) : <span style={{ color: '#999', fontSize: '10px' }}>-</span>}
                    </td>
                  )}
                </tr>
              );
            })}
            
            {/* Total Row */}
            {individual.showTotalsSection && (
              <tr style={{ backgroundColor: totalBg }}>
                <td colSpan={(showInstallationImages || showDesignImages) ? (showDates ? 9 : 7) : (showDates ? 7 : 5)} 
                    style={{ 
                      padding: '12px 10px', 
                      textAlign: 'left', 
                      fontWeight: 'bold', 
                      color: totalText, 
                      border: `1px solid ${tableBorder}`,
                      fontSize: `${headerFontSize}px`,
                    }}>
                  الإجمالي ({totalRentals} تأجير - {totalDays} يوم)
                </td>
                <td style={{ 
                  padding: '12px 10px', 
                  textAlign: 'center', 
                  fontWeight: 'bold', 
                  color: totalText, 
                  border: `1px solid ${tableBorder}`, 
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: `${headerFontSize + 2}px`,
                }}>
                  {totalRevenue.toLocaleString()}
                </td>
                {showInstallationImages && <td style={{ border: `1px solid ${tableBorder}`, backgroundColor: totalBg }}></td>}
                {showDesignImages && <td style={{ border: `1px solid ${tableBorder}`, backgroundColor: totalBg }}></td>}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Footer from shared settings
  const renderFooter = () => {
    if (!shared.showFooter) return null;

    const footerPosition = shared.footerPosition || 15;

    return (
      <div style={{
        width: '100%', 
        marginBottom: `${footerPosition}mm`, 
        paddingTop: '10px',
        borderTop: `1px solid ${tableBorder}`,
        backgroundColor: shared.footerBgColor !== 'transparent' ? shared.footerBgColor : undefined,
        color: shared.footerTextColor || '#666666', 
        fontSize: '10px',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: getFlexJustify(shared.footerAlignment), 
        gap: '20px',
      }}>
        <span>{shared.footerText}</span>
        {shared.showPageNumber && (
          <span style={{
            marginRight: shared.footerAlignment === 'right' ? 'auto' : 0,
            marginLeft: shared.footerAlignment === 'left' ? 'auto' : 0,
          }}>
            صفحة 1 من 1
          </span>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] p-0">
        <Tabs defaultValue="preview" className="flex flex-col h-full">
          <DialogHeader className="p-4 border-b bg-gradient-to-l from-primary/5 to-background">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <History className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg">تقرير تاريخ اللوحة</DialogTitle>
                  <p className="text-sm text-muted-foreground">{billboardName} - {totalRentals} تأجير</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TabsList className="h-9">
                  <TabsTrigger value="columns" className="text-xs px-3">
                    <Table className="h-3 w-3 ml-1" />
                    الأعمدة
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs px-3">
                    <Eye className="h-3 w-3 ml-1" />
                    معاينة
                  </TabsTrigger>
                </TabsList>
                <Button onClick={handlePrint} className="gap-2">
                  <Printer className="h-4 w-4" />
                  طباعة
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <TabsContent value="columns" className="flex-1 overflow-auto p-4 m-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="showContractNumber" className="text-sm">رقم العقد</Label>
                <Switch id="showContractNumber" checked={showContractNumber} onCheckedChange={setShowContractNumber} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="showCustomerName" className="text-sm">الزبون</Label>
                <Switch id="showCustomerName" checked={showCustomerName} onCheckedChange={setShowCustomerName} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="showAdType" className="text-sm">نوع الإعلان</Label>
                <Switch id="showAdType" checked={showAdType} onCheckedChange={setShowAdType} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="showDates" className="text-sm">التواريخ</Label>
                <Switch id="showDates" checked={showDates} onCheckedChange={setShowDates} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="showDuration" className="text-sm">المدة</Label>
                <Switch id="showDuration" checked={showDuration} onCheckedChange={setShowDuration} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="showPrices" className="text-sm">المبلغ</Label>
                <Switch id="showPrices" checked={showPrices} onCheckedChange={setShowPrices} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="showDiscount" className="text-sm">الخصم</Label>
                <Switch id="showDiscount" checked={showDiscount} onCheckedChange={setShowDiscount} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="showInstallation" className="text-sm">التركيب</Label>
                <Switch id="showInstallation" checked={showInstallation} onCheckedChange={setShowInstallation} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="showPrint" className="text-sm">الطباعة</Label>
                <Switch id="showPrint" checked={showPrint} onCheckedChange={setShowPrint} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="showTeam" className="text-sm">الفريق</Label>
                <Switch id="showTeam" checked={showTeam} onCheckedChange={setShowTeam} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="showInstallationImages" className="text-sm">صور التركيب</Label>
                <Switch id="showInstallationImages" checked={showInstallationImages} onCheckedChange={setShowInstallationImages} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <Label htmlFor="showDesignImages" className="text-sm">صور التصميم</Label>
                <Switch id="showDesignImages" checked={showDesignImages} onCheckedChange={setShowDesignImages} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-auto m-0">
            <ScrollArea className="flex-1 max-h-[calc(95vh-80px)]">
              <div className="p-6 flex justify-center bg-muted/30">
                <div
                  ref={printRef}
                  className="bg-white shadow-2xl"
                  style={{
                    width: '277mm',
                    minHeight: '190mm',
                    backgroundColor: '#fff',
                    fontFamily: `${shared.fontFamily || 'Doran'}, 'Noto Sans Arabic', Arial, sans-serif`,
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    paddingTop: `${shared.pageMarginTop || 15}mm`,
                    paddingBottom: `${shared.pageMarginBottom || 15}mm`,
                    paddingLeft: `${shared.pageMarginLeft || 15}mm`,
                    paddingRight: `${shared.pageMarginRight || 15}mm`,
                    direction: 'rtl',
                    color: tableText,
                  }}
                >
                  {/* Background from shared settings */}
                  {shared.backgroundImage && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundImage: `url(${shared.backgroundImage})`,
                        backgroundSize: `${shared.backgroundScale || 100}%`,
                        backgroundPosition: `${shared.backgroundPosX || 50}% ${shared.backgroundPosY || 50}%`,
                        backgroundRepeat: 'no-repeat',
                        opacity: (shared.backgroundOpacity || 100) / 100,
                        pointerEvents: 'none',
                        zIndex: 0,
                      }}
                    />
                  )}

                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ flex: 1, paddingBottom: `${shared.contentBottomSpacing || 25}mm` }}>
                      {/* Header */}
                      {renderHeader()}

                      {/* Billboard Section */}
                      {renderBillboardSection()}

                      {/* Table */}
                      {renderTable()}
                    </div>
                    
                    {/* Footer */}
                    {renderFooter()}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
