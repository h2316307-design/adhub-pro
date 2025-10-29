import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Edit, Printer, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import type { Report } from '@/pages/Reports';
import type { ReportItem } from './ReportItemsManager';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ReportViewProps {
  report: Report | null;
  onClose: () => void;
  onEdit: (report: Report) => void;
  onPrint?: (report: Report) => void;
  onDeleted?: () => void;
}

export function ReportView({ report, onClose, onEdit, onPrint, onDeleted }: ReportViewProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['report-items', report?.id],
    queryFn: async () => {
      if (!report?.id) return [];
      const { data, error } = await supabase
        .from('report_items')
        .select('*')
        .eq('report_id', report.id)
        .order('order_index');
      
      if (error) throw error;
      return data as ReportItem[];
    },
    enabled: !!report?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!report?.id) return;
      
      // حذف بنود التقرير أولاً
      const { error: itemsError } = await supabase
        .from('report_items')
        .delete()
        .eq('report_id', report.id);
      
      if (itemsError) throw itemsError;
      
      // ثم حذف التقرير
      const { error: reportError } = await supabase
        .from('reports')
        .delete()
        .eq('id', report.id);
      
      if (reportError) throw reportError;
    },
    onSuccess: () => {
      toast.success('تم حذف التقرير بنجاح');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      onClose();
      onDeleted?.();
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('حدث خطأ أثناء حذف التقرير');
    },
  });

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handlePrint = () => {
    // إخفاء الأزرار والعناصر غير المطلوبة في الطباعة
    const printContent = document.querySelector('.print-content');
    if (printContent) {
      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        printWindow.document.write('<html dir="rtl"><head><title>تقرير - ' + report?.title + '</title>');
        printWindow.document.write('<style>');
        printWindow.document.write(`
          body { 
            font-family: 'Arial', sans-serif; 
            padding: 40px; 
            direction: rtl;
            text-align: right;
          }
          .header { 
            border-bottom: 3px solid #333; 
            padding-bottom: 20px; 
            margin-bottom: 30px;
          }
          .header h1 { 
            font-size: 28px; 
            margin: 0 0 10px 0;
            color: #333;
          }
          .header .meta { 
            color: #666; 
            font-size: 14px;
          }
          .summary { 
            background: #f5f5f5; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 30px;
          }
          .summary h3 {
            margin-top: 0;
            color: #333;
          }
          .items h3 { 
            font-size: 20px; 
            margin-bottom: 20px;
            color: #333;
          }
          .item { 
            border: 1px solid #ddd; 
            padding: 20px; 
            margin-bottom: 15px; 
            border-radius: 8px;
            page-break-inside: avoid;
          }
          .item-number { 
            display: inline-block;
            width: 35px; 
            height: 35px; 
            background: #333; 
            color: white; 
            text-align: center; 
            line-height: 35px; 
            border-radius: 50%; 
            margin-left: 15px;
            font-weight: bold;
          }
          .item h4 { 
            display: inline-block;
            margin: 0 0 10px 0; 
            font-size: 18px;
            color: #333;
          }
          .item p { 
            margin: 5px 0; 
            color: #555;
          }
          .item strong { 
            color: #333; 
          }
          @media print {
            body { margin: 0; padding: 20px; }
          }
        `);
        printWindow.document.write('</style></head><body>');
        printWindow.document.write(printContent.innerHTML);
        printWindow.document.write('</body></html>');
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
    <>
      <Dialog open={!!report} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{report.title}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(report)}>
                  <Edit className="h-4 w-4 ml-2" />
                  تعديل
                </Button>
                <Button variant="outline" size="sm" onClick={() => onPrint?.(report)}>
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 ml-2" />
                  حذف
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

        <div className="space-y-4">
          {/* محتوى للطباعة */}
          <div className="print-content" style={{ display: 'none' }}>
            <div className="header">
              <h1>{report.title}</h1>
              <div className="meta">
                <p>التاريخ: {format(new Date(report.report_date), 'PPP', { locale: ar })}</p>
                <p>نوع التقرير: {report.report_type === 'daily' ? 'يومي' : report.report_type === 'weekly' ? 'أسبوعي' : 'شهري'}</p>
              </div>
            </div>

            {report.summary && (
              <div className="summary">
                <h3>الملخص</h3>
                <p>{report.summary}</p>
              </div>
            )}

            <div className="items">
              <h3>بنود التقرير</h3>
              {items.map((item, index) => (
                <div key={item.id} className="item">
                  <span className="item-number">{index + 1}</span>
                  <h4>{item.title}</h4>
                  {item.description && <p>{item.description}</p>}
                  {item.status && <p><strong>الحالة:</strong> {item.status}</p>}
                  {item.notes && <p><strong>ملاحظات:</strong> {item.notes}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* محتوى للعرض */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {format(new Date(report.report_date), 'PPP', { locale: ar })}
              </p>
              <p className="text-sm text-muted-foreground">
                نوع التقرير: {report.report_type === 'daily' ? 'يومي' : report.report_type === 'weekly' ? 'أسبوعي' : 'شهري'}
              </p>
            </div>
          </div>

          {report.summary && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">الملخص</h3>
              <p className="text-sm">{report.summary}</p>
            </Card>
          )}

          <div>
            <h3 className="font-semibold mb-3">بنود التقرير</h3>
            <div className="space-y-3">
              {items.map((item, index) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{item.title}</h4>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                      )}
                      {item.status && (
                        <p className="text-sm"><strong>الحالة:</strong> {item.status}</p>
                      )}
                      {item.notes && (
                        <p className="text-sm"><strong>ملاحظات:</strong> {item.notes}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف التقرير</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا التقرير؟ سيتم حذف جميع البنود المرتبطة به. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}