import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useRef } from 'react';
import type { Report } from '@/pages/Reports';
import type { ReportItem } from './ReportItemsManager';

interface ReportPrintDialogProps {
  report: Report | null;
  reports?: Report[]; // للتقارير المجمعة (أسبوعي/شهري)
  open: boolean;
  onClose: () => void;
}

export function ReportPrintDialog({ report, reports, open, onClose }: ReportPrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  
  const isGroupedReport = reports && reports.length > 0;

  const { data: items = [] } = useQuery({
    queryKey: ['report-items', report?.id],
    queryFn: async () => {
      if (!report?.id || report.id === 'grouped') return [];
      const { data, error } = await supabase
        .from('report_items')
        .select('*')
        .eq('report_id', report.id)
        .order('order_index');
      
      if (error) throw error;
      return data as ReportItem[];
    },
    enabled: !!report?.id && open && report?.id !== 'grouped',
  });

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${report?.title || 'تقرير'}</title>
            <style>
              @page { size: A4; margin: 15mm; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; }
              .container { max-width: 210mm; margin: 0 auto; padding: 20px; background: white; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
              .header h1 { font-size: 28px; color: #1e40af; margin-bottom: 10px; }
              .header p { color: #64748b; font-size: 14px; }
              .section { margin: 25px 0; padding: 15px; border-radius: 8px; background: #f8fafc; }
              .section-title { font-size: 18px; font-weight: bold; color: #1e40af; margin-bottom: 15px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
              .item-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
              .item-row:last-child { border-bottom: none; }
              .item-label { font-weight: 600; color: #475569; }
              .item-value { color: #0f172a; }
              .footer { margin-top: 40px; text-align: center; padding-top: 20px; border-top: 2px solid #e2e8f0; color: #64748b; font-size: 12px; }
              .daily-report { margin: 20px 0; padding: 20px; border: 2px solid #e2e8f0; border-radius: 8px; }
              .daily-report h3 { font-size: 20px; color: #1e40af; margin-bottom: 10px; }
              @media print {
                body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                .no-print { display: none !important; }
                .page-break { page-break-before: always; }
              }
            </style>
          </head>
          <body>
            ${printRef.current.innerHTML}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  };

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-end gap-2 mb-4 no-print">
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            طباعة التقرير
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div ref={printRef} className="space-y-6" dir="rtl">
          {/* Header Section */}
          <div className="header text-center border-b-4 border-primary pb-6 mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">{report.title}</h1>
            <p className="text-muted-foreground">
              {report.report_type === 'daily' && 'تقرير يومي'}
              {report.report_type === 'weekly' && 'تقرير أسبوعي'}
              {report.report_type === 'monthly' && 'تقرير شهري'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {report.start_date && report.end_date 
                ? `من ${format(new Date(report.start_date), 'PPP', { locale: ar })} إلى ${format(new Date(report.end_date), 'PPP', { locale: ar })}`
                : format(new Date(report.report_date), 'PPP', { locale: ar })
              }
            </p>
          </div>

          {/* Summary Section */}
          {report.summary && (
            <div className="section bg-accent/10 p-6 rounded-lg">
              <h3 className="section-title">الملخص</h3>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{report.summary}</p>
            </div>
          )}

          {/* Report Items (for single daily reports) */}
          {!isGroupedReport && items && items.length > 0 && (
            <div className="section">
              <h3 className="section-title">بنود التقرير</h3>
              <div className="space-y-3">
                {items.map((item: any) => (
                  <div key={item.id} className="p-4 bg-card border rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="item-row">
                        <span className="item-label">العنوان:</span>
                        <span className="item-value font-medium">{item.title}</span>
                      </div>
                      {item.category && (
                        <div className="item-row">
                          <span className="item-label">التصنيف:</span>
                          <span className="item-value">{item.category}</span>
                        </div>
                      )}
                    </div>
                    {item.description && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    )}
                    {item.amount && (
                      <div className="mt-2">
                        <span className="text-sm font-semibold text-primary">
                          المبلغ: {Number(item.amount).toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grouped Reports (Weekly/Monthly) */}
          {isGroupedReport && reports && (
            <div className="section">
              <h3 className="section-title">
                {report.report_type === 'weekly' ? 'التقارير اليومية للأسبوع' : 'التقارير اليومية للشهر'}
              </h3>
              <div className="space-y-6">
                {reports.map((dailyReport, index) => (
                  <div key={dailyReport.id} className={`daily-report ${index > 0 ? 'page-break' : ''}`}>
                    <div className="p-5 bg-card border-2 rounded-lg">
                      <h4 className="text-lg font-bold mb-3 text-primary">
                        {dailyReport.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        {format(new Date(dailyReport.report_date), 'PPP', { locale: ar })}
                      </p>
                      {dailyReport.summary && (
                        <div className="bg-accent/5 p-4 rounded mb-4">
                          <p className="text-sm whitespace-pre-wrap">{dailyReport.summary}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="footer mt-10 pt-6 border-t-2 text-center text-sm text-muted-foreground">
            <p>تم إنشاء التقرير في: {format(new Date(report.created_at), 'PPP', { locale: ar })}</p>
            <p className="mt-2">نظام إدارة اللوحات الإعلانية</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
