/**
 * ReceiptPrint - إيصال الاستلام الموحد
 * ✅ تستخدم القاعدة الموحدة (unifiedInvoiceBase) + fetchPrintSettingsForInvoice
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { generateReceiptHTML } from '@/lib/receiptGenerator';
import type { ReceiptData } from '@/lib/receiptGenerator';

export type { ReceiptData };

export async function printReceipt(data: ReceiptData): Promise<void> {
  const html = await generateReceiptHTML(data);
  const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
  showPrintPreview(html, `إيصال ${data.receiptNumber}${(data as any).receiptName ? ' - ' + (data as any).receiptName : ''}`);
  toast.success('تم فتح الإيصال للطباعة بنجاح!');
}

export function useReceiptPrint() {
  const [isPrinting, setIsPrinting] = useState(false);

  const print = async (data: ReceiptData) => {
    setIsPrinting(true);
    try {
      await printReceipt(data);
    } catch (error) {
      console.error('Error printing receipt:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return { print, isPrinting, isLoading: false };
}
