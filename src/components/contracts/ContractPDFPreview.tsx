import React from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { Printer, X } from 'lucide-react';

interface ContractPDFPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  html: string;
}

export function ContractPDFPreview({ open, onOpenChange, title, html }: ContractPDFPreviewProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background">
        <div className="flex flex-col h-[95vh]">
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-card to-muted/50">
            <h3 className="text-lg font-bold">{title}</h3>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="bg-gradient-to-r from-primary to-primary-glow"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4 ml-2" />
                طباعة
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-muted/30 p-4">
            <div className="mx-auto bg-white shadow-2xl rounded-lg overflow-hidden" style={{ width: '210mm', minHeight: '297mm' }}>
              <iframe
                srcDoc={html}
                className="w-full border-0"
                style={{ height: '297mm' }}
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}
