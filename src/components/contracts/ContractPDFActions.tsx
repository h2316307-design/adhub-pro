import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, Eye, Send } from 'lucide-react';

interface ContractPDFActionsProps {
  isGenerating: boolean;
  sendingWhatsApp: boolean;
  hasPhone: boolean;
  printMode: 'auto' | 'manual';
  onPrintInvoice: () => void;
  onPreviewInvoice: () => void;
  onDownloadInvoice: () => void;
  onSendInvoiceWhatsApp: () => void;
  onPrintContract: () => void;
  onPreviewContract: () => void;
  onDownloadContract: () => void;
  onSendContractWhatsApp: () => void;
  onUnifiedPrint?: () => void;
}

export function ContractPDFActions({
  isGenerating,
  sendingWhatsApp,
  hasPhone,
  printMode,
  onPrintInvoice,
  onPreviewInvoice,
  onDownloadInvoice,
  onSendInvoiceWhatsApp,
  onPrintContract,
  onPreviewContract,
  onDownloadContract,
  onSendContractWhatsApp,
  onUnifiedPrint,
}: ContractPDFActionsProps) {
  if (isGenerating) return null;

  return (
    <div className="border-t border-border/50 bg-card/50 backdrop-blur-sm p-3">
      <div className="flex flex-col gap-2">
        {/* Invoice Actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14">الفاتورة:</span>
          <div className="flex gap-2 flex-1 flex-wrap">
            <Button 
              onClick={onPrintInvoice}
              size="sm"
              className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-primary-foreground shadow-sm h-8"
              disabled={sendingWhatsApp}
            >
              <Printer className="h-3.5 w-3.5 ml-1.5" />
              طباعة
            </Button>
            <Button 
              onClick={onPreviewInvoice}
              variant="outline"
              size="sm"
              className="h-8"
              disabled={sendingWhatsApp}
            >
              <Eye className="h-3.5 w-3.5 ml-1.5" />
              معاينة
            </Button>
            <Button 
              onClick={onDownloadInvoice}
              variant="outline"
              size="sm"
              className="h-8"
              disabled={sendingWhatsApp}
            >
              <Download className="h-3.5 w-3.5 ml-1.5" />
              PDF
            </Button>
          </div>
        </div>
        
        {/* Contract Actions - Simplified: Use UnifiedPrint as main */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14">العقد:</span>
          <div className="flex gap-2 flex-1 flex-wrap">
            {onUnifiedPrint && (
              <Button 
                onClick={onUnifiedPrint}
                size="sm"
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-90 text-white shadow-sm h-8"
                disabled={sendingWhatsApp}
              >
                <Printer className="h-3.5 w-3.5 ml-1.5" />
                طباعة العقد
              </Button>
            )}
            <Button 
              onClick={onPreviewContract}
              variant="outline"
              size="sm"
              className="h-8"
              disabled={sendingWhatsApp}
            >
              <Eye className="h-3.5 w-3.5 ml-1.5" />
              معاينة
            </Button>
            <Button 
              onClick={onDownloadContract}
              variant="outline"
              size="sm"
              className="h-8"
              disabled={sendingWhatsApp}
            >
              <Download className="h-3.5 w-3.5 ml-1.5" />
              PDF
            </Button>
            {hasPhone && (
              <Button 
                onClick={onSendContractWhatsApp}
                variant="outline"
                size="sm"
                className="h-8"
                disabled={sendingWhatsApp}
              >
                <Send className="h-3.5 w-3.5 ml-1.5" />
                واتساب
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
