import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Printer, Loader2, X, Ruler } from 'lucide-react';
import { 
  SharedInvoiceSettings, 
  IndividualInvoiceSettings, 
  AllInvoiceSettings,
  DEFAULT_SHARED_SETTINGS, 
  DEFAULT_INDIVIDUAL_SETTINGS,
  INVOICE_TEMPLATES,
  InvoiceTemplateType
} from '@/types/invoice-templates';

// Use the same key as PrintDesignNew page
const UNIFIED_SETTINGS_KEY = 'unified_invoice_templates_settings';

interface SizeItem {
  sizeName: string;
  widthMeters: number;
  heightMeters: number;
  facesCount: number;
  quantity: number;
  areaPerFace: number;
  totalArea: number;
}

interface SizesInvoicePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboards: any[];
  customerName: string;
  contractNumbers: string[];
}

const DEFAULT_SIZES_INVOICE_SETTINGS = {
  title: 'كشف المقاسات',
  subtitle: 'SIZES STATEMENT',
  showSingleFaceSeparately: true,
  showAreaPerFace: true,
  showTotalArea: true,
  showFacesCount: true,
  showDimensions: true,
  groupByFaces: true,
};

export function SizesInvoicePrintDialog({
  open,
  onOpenChange,
  billboards,
  customerName,
  contractNumbers,
}: SizesInvoicePrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shared, setShared] = useState<SharedInvoiceSettings>(DEFAULT_SHARED_SETTINGS);
  const [individual, setIndividual] = useState<IndividualInvoiceSettings>(DEFAULT_INDIVIDUAL_SETTINGS);
  const [sizesSettings, setSizesSettings] = useState(DEFAULT_SIZES_INVOICE_SETTINGS);
  const [sizesData, setSizesData] = useState<Record<string, { width: number; height: number }>>({});

  // Load all settings from the SAME source as PrintDesignNew
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load unified settings (same as PrintDesignNew page)
        const { data: unifiedData } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', UNIFIED_SETTINGS_KEY)
          .maybeSingle();

        if (unifiedData?.setting_value) {
          const allSettings: AllInvoiceSettings = JSON.parse(unifiedData.setting_value);
          
          // Set shared settings
          if (allSettings.shared) {
            setShared({ ...DEFAULT_SHARED_SETTINGS, ...allSettings.shared });
          }
          
          // Set individual settings for sizes_invoice type
          if (allSettings.individual && allSettings.individual['sizes_invoice']) {
            setIndividual({ ...DEFAULT_INDIVIDUAL_SETTINGS, ...allSettings.individual['sizes_invoice'] });
          }
        }

        // Load actual sizes from sizes table
        const { data: sizesTableData } = await supabase
          .from('sizes')
          .select('name, width, height');

        if (sizesTableData) {
          const sizesMap: Record<string, { width: number; height: number }> = {};
          sizesTableData.forEach((s: any) => {
            sizesMap[s.name] = { width: s.width || 0, height: s.height || 0 };
          });
          setSizesData(sizesMap);
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

  // Calculate sizes summary
  const sizesSummary = useMemo(() => {
    const singleFaceItems: SizeItem[] = [];
    const multiFaceItems: SizeItem[] = [];
    const sizeCountMap: Record<string, { count: number; faces: number }> = {};

    billboards.forEach((b) => {
      const sizeName = b.Size || b.size || '';
      const facesCount = Number(b.Faces_Count || b.faces_count || b.Faces || b.faces || 1);
      
      const key = `${sizeName}_${facesCount}`;
      if (!sizeCountMap[key]) {
        sizeCountMap[key] = { count: 0, faces: facesCount };
      }
      sizeCountMap[key].count++;
    });

    Object.entries(sizeCountMap).forEach(([key, data]) => {
      const [sizeName] = key.split('_');
      const sizeInfo = sizesData[sizeName] || { width: 0, height: 0 };
      const areaPerFace = sizeInfo.width * sizeInfo.height;
      const totalArea = areaPerFace * data.faces * data.count;

      const item: SizeItem = {
        sizeName,
        widthMeters: sizeInfo.width,
        heightMeters: sizeInfo.height,
        facesCount: data.faces,
        quantity: data.count,
        areaPerFace,
        totalArea,
      };

      if (data.faces === 1) {
        singleFaceItems.push(item);
      } else {
        multiFaceItems.push(item);
      }
    });

    singleFaceItems.sort((a, b) => b.quantity - a.quantity);
    multiFaceItems.sort((a, b) => b.quantity - a.quantity);

    return { singleFaceItems, multiFaceItems };
  }, [billboards, sizesData]);

  const totalArea = useMemo(() => {
    const allItems = [...sizesSummary.singleFaceItems, ...sizesSummary.multiFaceItems];
    return allItems.reduce((sum, item) => sum + item.totalArea, 0);
  }, [sizesSummary]);

  const totalBillboards = useMemo(() => {
    const allItems = [...sizesSummary.singleFaceItems, ...sizesSummary.multiFaceItems];
    return allItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [sizesSummary]);

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
        <title>كشف المقاسات - ${customerName}</title>
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
            width: 210mm;
            min-height: 297mm;
            padding: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm;
            background: #ffffff;
            position: relative;
          }
          
          table { 
            border-collapse: collapse; 
            page-break-inside: avoid;
          }
          
          tr { 
            page-break-inside: avoid; 
          }
          
          th, td { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          
          /* Prevent totals section from breaking */
          .totals-section {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          /* Keep section headers with their content */
          .section-header {
            page-break-after: avoid;
            break-after: avoid;
          }
          
          @media print {
            @page { 
              size: A4; 
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
    
    // Wait for fonts and styles to load before printing
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 800);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
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
  const accentColor = individual.accentColor || '#f5f5f5';

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
  const subtotalBg = individual.subtotalBgColor || '#f0f0f0';
  const subtotalText = individual.subtotalTextColor || '#333333';
  const totalBg = individual.totalBgColor || '#D4AF37';
  const totalText = individual.totalTextColor || '#ffffff';

  // Notes colors
  const notesBg = individual.notesBgColor || '#fffbeb';
  const notesText = individual.notesTextColor || '#92400e';
  const notesBorder = individual.notesBorderColor || '#fbbf24';

  // Font sizes
  const titleFontSize = individual.titleFontSize || 24;
  const headerFontSize = individual.headerFontSize || 14;
  const bodyFontSize = individual.bodyFontSize || 12;

  const renderTable = (items: SizeItem[], title: string, isLastTable: boolean = false) => {
    if (items.length === 0) return null;
    
    const tableTotal = items.reduce((sum, item) => sum + item.totalArea, 0);
    const tableQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    
    // Calculate column count for colspan
    let colCount = 3; // Base: #, المقاس, الكمية
    if (sizesSettings.showDimensions) colCount += 2;
    if (sizesSettings.showFacesCount) colCount += 1;
    if (sizesSettings.showAreaPerFace) colCount += 1;
    if (sizesSettings.showTotalArea) colCount += 1;

    return (
      <div style={{ marginBottom: isLastTable ? '0' : '20px', pageBreakInside: 'avoid' }}>
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
          }}>{title}</span>
          <span style={{
            fontSize: `${bodyFontSize}px`,
            color: tableText,
            opacity: 0.7,
            marginRight: 'auto',
          }}>({tableQuantity} لوحة)</span>
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
              <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '6%' }}>#</th>
              <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '18%' }}>المقاس</th>
              {sizesSettings.showDimensions && (
                <>
                  <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '12%' }}>العرض (م)</th>
                  <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '12%' }}>الارتفاع (م)</th>
                </>
              )}
              {sizesSettings.showFacesCount && <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '10%' }}>الأوجه</th>}
              <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '10%' }}>الكمية</th>
              {sizesSettings.showAreaPerFace && <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '14%' }}>م² / وجه</th>}
              {sizesSettings.showTotalArea && <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '18%' }}>الإجمالي م²</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={{ 
                backgroundColor: hexToRgba(idx % 2 === 0 ? tableRowEven : tableRowOdd, tableRowOpacity * 100),
              }}>
                <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText }}>{idx + 1}</td>
                <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontWeight: '600' }}>
                  {item.sizeName}
                </td>
                {sizesSettings.showDimensions && (
                  <>
                    <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontFamily: 'Manrope, sans-serif' }}>
                      {item.widthMeters.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontFamily: 'Manrope, sans-serif' }}>
                      {item.heightMeters.toFixed(2)}
                    </td>
                  </>
                )}
                {sizesSettings.showFacesCount && (
                  <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      backgroundColor: item.facesCount === 1 ? '#e0f2fe' : `${primaryColor}20`,
                      color: item.facesCount === 1 ? '#0369a1' : primaryColor,
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 'bold',
                      fontSize: `${bodyFontSize - 1}px`,
                    }}>{item.facesCount}</span>
                  </td>
                )}
                <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontFamily: 'Manrope, sans-serif', fontWeight: 'bold' }}>
                  {item.quantity}
                </td>
                {sizesSettings.showAreaPerFace && (
                  <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontFamily: 'Manrope, sans-serif' }}>
                    {item.areaPerFace.toFixed(2)}
                  </td>
                )}
                {sizesSettings.showTotalArea && (
                  <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: primaryColor, fontWeight: 'bold', fontFamily: 'Manrope, sans-serif' }}>
                    {item.totalArea.toFixed(2)}
                  </td>
                )}
              </tr>
            ))}
            {/* Subtotal Row */}
            <tr style={{ backgroundColor: subtotalBg }}>
              <td colSpan={sizesSettings.showDimensions ? (sizesSettings.showFacesCount ? 5 : 4) : (sizesSettings.showFacesCount ? 3 : 2)} 
                  style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 'bold', color: subtotalText, border: `1px solid ${tableBorder}` }}>
                إجمالي القسم
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: subtotalText, border: `1px solid ${tableBorder}`, fontFamily: 'Manrope, sans-serif' }}>
                {tableQuantity}
              </td>
              {sizesSettings.showAreaPerFace && <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}` }}></td>}
              {sizesSettings.showTotalArea && (
                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: subtotalText, border: `1px solid ${tableBorder}`, fontFamily: 'Manrope, sans-serif' }}>
                  {tableTotal.toFixed(2)} م²
                </td>
              )}
            </tr>
            
            {/* Grand Total Row - only on last table */}
            {isLastTable && individual.showTotalsSection && sizesSettings.showTotalArea && (
              <tr style={{ backgroundColor: totalBg }}>
                <td colSpan={colCount - 1} 
                    style={{ 
                      padding: '14px 12px', 
                      textAlign: 'left', 
                      fontWeight: 'bold', 
                      color: totalText, 
                      border: `1px solid ${tableBorder}`,
                      fontSize: `${headerFontSize}px`,
                    }}>
                  الإجمالي الكلي ({totalBillboards} لوحة)
                </td>
                <td style={{ 
                  padding: '14px 12px', 
                  textAlign: 'center', 
                  fontWeight: 'bold', 
                  color: totalText, 
                  border: `1px solid ${tableBorder}`, 
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: `${headerFontSize + 2}px`,
                }}>
                  {totalArea.toFixed(2)} م²
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Helper function for rgba conversion - matching UnifiedInvoicePreview
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

  // Helper for text alignment
  const getTextAlign = (alignment: string | undefined): 'right' | 'center' | 'left' => {
    return (alignment || 'right') as 'right' | 'center' | 'left';
  };

  const getFlexJustify = (alignment: string | undefined): string => {
    switch (alignment) {
      case 'left': return 'flex-start';
      case 'center': return 'center';
      case 'right': 
      default: return 'flex-end';
    }
  };

  // Header rendering - العناوين يمين والشعار يسار
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
        {/* Logo Side - Left */}
        <div style={{ 
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start',
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
                {sizesSettings.subtitle || 'SIZES STATEMENT'}
              </h1>
              <div style={{ fontSize: '12px', color: customerText, marginTop: '8px', lineHeight: 1.6, textAlign: 'right' }}>
                التاريخ: <span style={{ fontFamily: 'Manrope, sans-serif' }}>{new Date().toLocaleDateString('ar-LY')}</span><br/>
                أرقام العقود: <span style={{ fontFamily: 'Manrope, sans-serif' }}>{contractNumbers.join(' - ')}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Customer section from individual settings
  const renderCustomerSection = () => {
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
              العميل
            </div>
            <div style={{
              fontSize: `${titleFontSize - 4}px`,
              fontWeight: 'bold',
              color: customerTitle,
            }}>
              {customerName}
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
                {totalBillboards}
              </div>
              <div style={{ fontSize: `${bodyFontSize}px`, color: customerText, opacity: 0.7 }}>لوحة</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: `${titleFontSize + 4}px`,
                fontWeight: 'bold',
                color: primaryColor,
                fontFamily: 'Manrope, sans-serif',
              }}>
                {contractNumbers.length}
              </div>
              <div style={{ fontSize: `${bodyFontSize}px`, color: customerText, opacity: 0.7 }}>عقد</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Totals section - MATCHING UnifiedInvoicePreview exactly
  const renderTotalsSection = () => {
    if (!individual.showTotalsSection || !sizesSettings.showTotalArea) return null;

    return (
      <div 
        className="totals-section"
        style={{
          background: `linear-gradient(135deg, ${totalBg}, ${totalBg}dd)`,
          padding: '20px',
          textAlign: 'center',
          marginTop: '20px',
          borderRadius: '8px',
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
        }}>
        <div style={{ 
          fontSize: `${bodyFontSize}px`, 
          color: totalText, 
          opacity: 0.9, 
          marginBottom: '6px' 
        }}>
          إجمالي المساحة الكلية
        </div>
        <div style={{ 
          fontSize: `${titleFontSize + 8}px`, 
          fontWeight: 'bold', 
          color: totalText, 
          fontFamily: 'Manrope, sans-serif' 
        }}>
          {totalArea.toFixed(2)}
          <span style={{ fontSize: `${headerFontSize}px`, marginRight: '8px' }}>متر مربع</span>
        </div>
      </div>
    );
  };

  // Footer from shared settings - MATCHING UnifiedInvoicePreview exactly
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
      <DialogContent className="max-w-5xl max-h-[95vh] p-0">
        <DialogHeader className="p-4 border-b bg-gradient-to-l from-primary/5 to-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Ruler className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">كشف المقاسات</DialogTitle>
                <p className="text-sm text-muted-foreground">{customerName} - {contractNumbers.length} عقد</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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

        <ScrollArea className="flex-1 max-h-[calc(95vh-80px)]">
          <div className="p-6 flex justify-center bg-muted/30">
            <div
              ref={printRef}
              className="bg-white shadow-2xl"
              style={{
                width: '210mm',
                minHeight: '297mm',
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

                  {/* Customer Section */}
                  {renderCustomerSection()}

                  {/* Tables */}
                  {sizesSettings.showSingleFaceSeparately ? (
                    <>
                      {sizesSummary.singleFaceItems.length > 0 ? (
                        <>
                          {renderTable(sizesSummary.multiFaceItems, 'لوحات متعددة الأوجه', false)}
                          {renderTable(sizesSummary.singleFaceItems, 'لوحات وجه واحد', true)}
                        </>
                      ) : (
                        renderTable(sizesSummary.multiFaceItems, 'لوحات متعددة الأوجه', true)
                      )}
                    </>
                  ) : (
                    renderTable(
                      [...sizesSummary.multiFaceItems, ...sizesSummary.singleFaceItems],
                      'جميع المقاسات',
                      true
                    )
                  )}
                </div>
                
                {/* Footer */}
                {renderFooter()}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
