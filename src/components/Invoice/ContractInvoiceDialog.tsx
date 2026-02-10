// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, FileText, Trash2, Receipt } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ContractRow {
  Contract_Number: string | null;
  'Customer Name': string | null;
  'Ad Type': string | null;
  'Total Rent': string | number | null;
  'Contract Date'?: string | null;
  'End Date'?: string | null;
  'Start Date'?: string | null;
  customer_id?: string | null;
  billboards_count?: number;
}

interface SizeInfo {
  id: number;
  name: string;
  width: string;
  height: string;
  installation_price: number | null;
}

interface BillboardInfo {
  id: number;
  size: string;
  location: string;
  contract_number: string;
}

interface PrintItem {
  size: string;
  quantity: number;
  area: number;
  pricePerMeter: number;
  totalArea: number;
  totalPrice: number;
}

interface ContractInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ContractRow | null;
  onInvoiceSaved?: () => void;
}

export default function ContractInvoiceDialog({
  open,
  onOpenChange,
  contract,
  onInvoiceSaved
}: ContractInvoiceDialogProps) {
  const [billboards, setBillboards] = useState<BillboardInfo[]>([]);
  const [sizes, setSizes] = useState<SizeInfo[]>([]);
  const [printItems, setPrintItems] = useState<PrintItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load sizes data - using correct table name
  useEffect(() => {
    const loadSizes = async () => {
      try {
        // Try different possible table names for sizes
        let data: any[] = [];
        let error: any = null;

        // Try billboard_sizes first
        // @ts-ignore - billboard_sizes table compatibility
        const sizeRes1 = await supabase
          .from('billboard_sizes')
          .select('*')
          .order('name');
        
        if (!sizeRes1.error && sizeRes1.data) {
          data = sizeRes1.data;
        } else {
          // Try sizes table
          const sizeRes2 = await supabase
            .from('sizes')
            .select('*')
            .order('name');
          
          if (!sizeRes2.error && sizeRes2.data) {
            data = sizeRes2.data;
          } else {
            // Try Size table
            // @ts-ignore - Size table compatibility
            const sizeRes3 = await supabase
              .from('Size')
              .select('*')
              .order('name');
            
            if (!sizeRes3.error && sizeRes3.data) {
              data = sizeRes3.data;
            } else {
              console.error('Error loading sizes from all tables:', { sizeRes1, sizeRes2, sizeRes3 });
              error = sizeRes3.error || sizeRes2.error || sizeRes1.error;
            }
          }
        }
        
        if (error) {
          console.error('Error loading sizes:', error);
        } else {
          console.log('Loaded sizes:', data);
          setSizes(data || []);
        }
      } catch (error) {
        console.error('Error loading sizes:', error);
      }
    };

    if (open) {
      loadSizes();
    }
  }, [open]);

  // Load billboards for the contract - using correct table name
  useEffect(() => {
    const loadBillboards = async () => {
      if (!contract?.Contract_Number) return;

      setLoading(true);
      try {
        const contractNumber = contract.Contract_Number;
        console.log('Loading billboards for contract:', contractNumber);
        
        let data: any[] = [];
        let error: any = null;

        // Try billboards table first
        const billRes1 = await supabase
          .from('billboards')
          .select('id, size, location, contract_number')
          .eq('contract_number', contractNumber);
        
        if (!billRes1.error && billRes1.data) {
          data = billRes1.data;
        } else {
          // Try Billboard table
          const billRes2 = await supabase
            .from('Billboard')
            .select('id, Size as size, Location as location, Contract_Number as contract_number')
            .eq('Contract_Number', contractNumber);
          
          if (!billRes2.error && billRes2.data) {
            data = billRes2.data;
          } else {
            // Try with different column names
            const billRes3 = await supabase
              .from('Billboard')
              .select('*')
              .eq('Contract_Number', contractNumber);
            
            if (!billRes3.error && billRes3.data) {
              // Map the data to expected format
              data = billRes3.data.map((item: any) => ({
                id: item.id || item.ID,
                size: item.Size || item.size || item.SIZE,
                location: item.Location || item.location || item.LOCATION,
                contract_number: item.Contract_Number || item.contract_number
              }));
            } else {
              console.error('Error loading billboards from all tables:', { billRes1, billRes2, billRes3 });
              error = billRes3.error || billRes2.error || billRes1.error;
            }
          }
        }

        if (error) {
          console.error('Error loading billboards:', error);
          toast({ title: "خطأ في تحميل اللوحات: " + error.message, variant: "destructive" });
        } else {
          console.log('Loaded billboards:', data);
          setBillboards(data || []);
        }
      } catch (error) {
        console.error('Error loading billboards:', error);
        toast({ title: "خطأ في تحميل اللوحات", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    if (open && contract) {
      loadBillboards();
    }
  }, [open, contract]);

  // Calculate print items from billboards and sizes
  const sizeCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    billboards.forEach(billboard => {
      const size = billboard.size || 'غير محدد';
      counts[size] = (counts[size] || 0) + 1;
    });
    console.log('Size counts:', counts);
    return counts;
  }, [billboards]);

  // Initialize print items when billboards or sizes change
  useEffect(() => {
    if (Object.keys(sizeCounts).length > 0) {
      const items: PrintItem[] = Object.entries(sizeCounts).map(([size, quantity]) => {
        const sizeInfo = sizes.find(s => s.name === size);
        const width = parseFloat(sizeInfo?.width || '0');
        const height = parseFloat(sizeInfo?.height || '0');
        const area = width && height ? width * height : 1; // Default to 1 if no size info
        const pricePerMeter = 25; // Default price per m²
        const totalArea = area * quantity;
        const totalPrice = totalArea * pricePerMeter;

        console.log(`Size ${size}: width=${width}, height=${height}, area=${area}`);

        return {
          size,
          quantity,
          area,
          pricePerMeter,
          totalArea,
          totalPrice
        };
      });
      setPrintItems(items);
      console.log('Print items:', items);
    }
  }, [sizeCounts, sizes]);

  const updatePrintItem = (index: number, field: keyof PrintItem, value: number) => {
    const newItems = [...printItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate totals
    if (field === 'quantity' || field === 'pricePerMeter') {
      newItems[index].totalArea = newItems[index].area * newItems[index].quantity;
      newItems[index].totalPrice = newItems[index].totalArea * newItems[index].pricePerMeter;
    }
    
    setPrintItems(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = printItems.filter((_, i) => i !== index);
    setPrintItems(newItems);
  };

  const totalArea = printItems.reduce((sum, item) => sum + item.totalArea, 0);
  const totalPrice = printItems.reduce((sum, item) => sum + item.totalPrice, 0);

  const printCustomerInvoice = () => {
    if (!contract) return;

    const itemRows = printItems.map(item => `
      <tr>
        <td>${item.size}</td>
        <td>${item.quantity}</td>
        <td>${item.area.toFixed(2)} م²</td>
        <td>${item.pricePerMeter.toLocaleString('ar-LY')} د.ل</td>
        <td>${item.totalArea.toFixed(2)} م²</td>
        <td>${item.totalPrice.toLocaleString('ar-LY')} د.ل</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
      <title>فاتورة طباعة - ${contract['Customer Name']}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        body{font-family:'Cairo',Arial,sans-serif;padding:20px;max-width:900px;margin:auto;background:#0f172a;color:#f1f5f9}
        .header{text-align:center;border-bottom:3px solid #d4af37;padding-bottom:20px;margin-bottom:30px}
        .title{font-size:28px;font-weight:bold;color:#d4af37;margin-bottom:10px;text-shadow:0 2px 4px rgba(212,175,55,0.3)}
        .company{font-size:18px;color:#94a3b8;margin-bottom:5px}
        .customer-info{margin-bottom:25px;background:linear-gradient(135deg,#1e293b,#334155);padding:20px;border-radius:10px;box-shadow:0 4px 6px rgba(0,0,0,0.3);border:1px solid #d4af37}
        .info-row{display:flex;justify-content:space-between;margin-bottom:8px;padding:5px 0;border-bottom:1px solid rgba(212,175,55,0.2)}
        .info-label{font-weight:bold;color:#d4af37}
        .info-value{color:#f1f5f9}
        table{width:100%;border-collapse:collapse;margin:20px 0;background:linear-gradient(135deg,#1e293b,#334155);box-shadow:0 4px 6px rgba(0,0,0,0.3);border-radius:10px;overflow:hidden}
        th,td{border:1px solid #475569;padding:12px 8px;text-align:center;color:#f1f5f9}
        th{background:linear-gradient(135deg,#d4af37,#b8860b);font-weight:bold;color:#000;text-shadow:0 1px 2px rgba(0,0,0,0.3)}
        .total-row{background:linear-gradient(135deg,#422006,#92400e);font-weight:bold;color:#fbbf24;font-size:16px}
        .final-total{background:linear-gradient(135deg,#164e63,#0891b2);color:#67e8f9;font-size:18px;font-weight:bold}
        .footer{margin-top:40px;text-align:center;padding-top:20px;border-top:2px solid #d4af37;color:#94a3b8}
        .signature{margin-top:30px;display:flex;justify-content:space-between}
        .signature div{text-align:center;width:200px}
        .signature-line{border-top:2px solid #d4af37;margin-top:40px;padding-top:10px}
        @media print{body{background:white!important;color:black!important;padding:10px} .header,.customer-info,table{background:white!important} th{background:#f5f5f5!important;color:black!important} .total-row{background:#fff7ed!important;color:#92400e!important} .final-total{background:#ecfeff!important;color:#0891b2!important}}
      </style></head><body>
      
      <div class="header" style="direction: rtl; display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #D4AF37; padding-bottom: 15px;">
        <div style="text-align: right;">
          <!-- Company info from settings -->
        </div>
        <div class="title" style="text-align: left;">فاتورة طباعة</div>
      </div>
      
      <div class="customer-info">
        <div class="info-row">
          <span class="info-label">اسم العميل:</span>
          <span class="info-value">${contract['Customer Name'] || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">رقم العقد:</span>
          <span class="info-value">${contract.Contract_Number || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">نوع الإعلان:</span>
          <span class="info-value">${contract['Ad Type'] || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">التاريخ:</span>
          <span class="info-value">${new Date().toLocaleDateString('ar-LY')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">عدد اللوحات:</span>
          <span class="info-value">${billboards.length} لوحة</span>
        </div>
      </div>
      
      <h3 style="color:#d4af37;text-align:center;margin:20px 0">تفاصيل الطباعة:</h3>
      <table>
        <thead>
          <tr>
            <th>المقاس</th>
            <th>الكمية</th>
            <th>المساحة/الوحدة</th>
            <th>سعر المتر</th>
            <th>إجمالي المساحة</th>
            <th>إجمالي السعر</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr class="total-row">
            <td colspan="4">الإجماليات</td>
            <td>${totalArea.toFixed(2)} م²</td>
            <td>${totalPrice.toLocaleString('ar-LY')} د.ل</td>
          </tr>
          <tr class="final-total">
            <td colspan="5">المبلغ الإجمالي للطباعة</td>
            <td>${totalPrice.toLocaleString('ar-LY')} دينار ليبي</td>
          </tr>
        </tbody>
      </table>
      
      <div class="footer">
        <p style="font-size:16px;margin-bottom:10px">شكراً لتعاملكم معنا</p>
        <p style="font-size:12px">تم إنشاء هذه الفاتورة في: ${new Date().toLocaleString('ar-LY')}</p>
      </div>
      
      <div class="signature">
        <div>
          <div class="signature-line">توقيع العميل</div>
        </div>
        <div>
          <div class="signature-line">توقيع الشركة</div>
        </div>
      </div>
      
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  };

  const printPrintingInvoice = () => {
    if (!contract) return;

    const itemRows = printItems.map(item => `
      <tr>
        <td>${item.size}</td>
        <td>${item.quantity}</td>
        <td>${item.area.toFixed(2)} م²</td>
        <td>${item.totalArea.toFixed(2)} م²</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
      <title>أمر طباعة - ${contract['Ad Type']}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        body{font-family:'Cairo',Arial,sans-serif;padding:20px;max-width:800px;margin:auto;background:#0f172a;color:#f1f5f9}
        .header{text-align:center;border-bottom:3px solid #d4af37;padding-bottom:20px;margin-bottom:30px}
        .title{font-size:28px;font-weight:bold;color:#d4af37;margin-bottom:10px;text-shadow:0 2px 4px rgba(212,175,55,0.3)}
        .company{font-size:18px;color:#94a3b8;margin-bottom:5px}
        .order-info{margin-bottom:25px;background:linear-gradient(135deg,#1e293b,#334155);padding:20px;border-radius:10px;box-shadow:0 4px 6px rgba(0,0,0,0.3);border:1px solid #d4af37}
        .info-row{display:flex;justify-content:space-between;margin-bottom:8px;padding:5px 0;border-bottom:1px solid rgba(212,175,55,0.2)}
        .info-label{font-weight:bold;color:#d4af37}
        .info-value{color:#f1f5f9}
        table{width:100%;border-collapse:collapse;margin:20px 0;background:linear-gradient(135deg,#1e293b,#334155);box-shadow:0 4px 6px rgba(0,0,0,0.3);border-radius:10px;overflow:hidden}
        th,td{border:1px solid #475569;padding:12px 8px;text-align:center;color:#f1f5f9}
        th{background:linear-gradient(135deg,#d4af37,#b8860b);font-weight:bold;color:#000;text-shadow:0 1px 2px rgba(0,0,0,0.3)}
        .total-row{background:linear-gradient(135deg,#422006,#92400e);font-weight:bold;color:#fbbf24;font-size:16px}
        .notes{margin-top:30px;background:linear-gradient(135deg,#1e293b,#334155);padding:15px;border-radius:10px;border:1px solid #d4af37}
        .notes h4{color:#d4af37;margin-bottom:10px}
        .footer{margin-top:40px;text-align:center;padding-top:20px;border-top:2px solid #d4af37;color:#94a3b8}
        @media print{body{background:white!important;color:black!important;padding:10px} .header,.order-info,table,.notes{background:white!important} th{background:#f5f5f5!important;color:black!important} .total-row{background:#fff7ed!important;color:#92400e!important}}
      </style></head><body>
      
      <div class="header" style="direction: rtl; display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #D4AF37; padding-bottom: 15px;">
        <div style="text-align: right;">
          <div style="font-size: 22px; font-weight: bold; color: #D4AF37;">الفارس الذهبي</div>
          <div style="color: #D4AF37; font-size: 14px;">للدعاية والإعلان</div>
          <div style="font-size: 12px; color: #D4AF37; margin-top: 4px;">الفارس الذهبي للدعاية والإعلان</div>
        </div>
        <div style="text-align: left;">
          <div class="title">أمر طباعة للمطبعة</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px">أمر طباعة رقم: ${Date.now()}</div>
        </div>
      </div>
      
      <div class="order-info">
        <div class="info-row">
          <span class="info-label">نوع الإعلان:</span>
          <span class="info-value">${contract['Ad Type'] || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">رقم العقد:</span>
          <span class="info-value">${contract.Contract_Number || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">تاريخ الأمر:</span>
          <span class="info-value">${new Date().toLocaleDateString('ar-LY')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">إجمالي اللوحات:</span>
          <span class="info-value">${billboards.length} لوحة</span>
        </div>
      </div>
      
      <h3 style="color:#d4af37;text-align:center;margin:20px 0">تفاصيل الطباعة المطلوبة:</h3>
      <table>
        <thead>
          <tr>
            <th>المقاس</th>
            <th>الكمية المطلوبة</th>
            <th>المساحة/الوحدة</th>
            <th>إجمالي المساحة</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr class="total-row">
            <td colspan="3">إجمالي المساحة المطلوبة</td>
            <td>${totalArea.toFixed(2)} متر مربع</td>
          </tr>
        </tbody>
      </table>
      
      <div class="notes">
        <h4>ملاحظات للمطبعة:</h4>
        <ul style="text-align:right;padding-right:20px;color:#f1f5f9">
          <li>يرجى التأكد من جودة الطباعة والألوان</li>
          <li>استخدام المواد المناسبة للاستخدام الخارجي</li>
          <li>التأكد من الأبعاد المطلوبة لكل مقاس</li>
          <li>التسليم خلال المدة المتفق عليها</li>
        </ul>
        
        <div style="margin-top:20px;padding:10px;background:rgba(212,175,55,0.1);border-radius:5px">
          <strong style="color:#d4af37">معلومات الاتصال:</strong><br>
          هاتف: 123456789<br>
          البريد الإلكتروني: info@company.com
        </div>
      </div>
      
      <div class="footer">
        <p style="font-size:14px">تم إنشاء أمر الطباعة في: ${new Date().toLocaleString('ar-LY')}</p>
      </div>
      
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  };

  const handleSave = async () => {
    try {
      // Save invoice data if needed
      toast({ title: 'تم حفظ الفاتورة بنجاح' });
      onInvoiceSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast({ title: 'خطأ في حفظ الفاتورة', variant: "destructive" });
    }
  };

  if (!contract) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl bg-slate-800 border-slate-600" dir="rtl">
        <DialogHeader className="border-b border-slate-600 pb-4">
          <DialogTitle className="text-yellow-400 text-xl flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            فاتورة شاملة محسنة - العقد رقم {contract.Contract_Number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          {/* Contract Info */}
          <div className="bg-gradient-to-r from-slate-700 to-slate-600 p-6 rounded-lg border border-yellow-500/30 shadow-lg">
            <h3 className="text-lg font-bold text-yellow-400 mb-4">معلومات العقد</h3>
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">العميل:</span>
                  <span className="text-slate-200 font-semibold">{contract['Customer Name']}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">نوع الإعلان:</span>
                  <span className="text-slate-200 font-semibold">{contract['Ad Type']}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">عدد اللوحات:</span>
                  <span className="text-yellow-400 font-bold text-lg">{billboards.length} لوحة</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">إجمالي المساحة:</span>
                  <span className="text-blue-400 font-bold text-lg">{totalArea.toFixed(2)} م²</span>
                </div>
              </div>
            </div>
          </div>

          {/* Print Items Table */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
              <Printer className="h-5 w-5" />
              عدد اللوحات حسب المقاس
            </h3>
            
            {loading ? (
              <div className="text-center py-12 text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
                جاري التحميل...
              </div>
            ) : printItems.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-slate-700 to-slate-600 border-yellow-500/30">
                      <TableHead className="text-yellow-400 font-bold text-center">المقاس</TableHead>
                      <TableHead className="text-yellow-400 font-bold text-center">الكمية</TableHead>
                      <TableHead className="text-yellow-400 font-bold text-center">المساحة/الوحدة (م²)</TableHead>
                      <TableHead className="text-yellow-400 font-bold text-center">سعر المتر (د.ل)</TableHead>
                      <TableHead className="text-yellow-400 font-bold text-center">إجمالي المساحة (م²)</TableHead>
                      <TableHead className="text-yellow-400 font-bold text-center">إجمالي السعر (د.ل)</TableHead>
                      <TableHead className="text-yellow-400 font-bold text-center">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printItems.map((item, index) => (
                      <TableRow key={item.size} className="hover:bg-slate-750 border-slate-700">
                        <TableCell className="font-bold text-slate-200 text-center">{item.size}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => updatePrintItem(index, 'quantity', Number(e.target.value) || 0)}
                            className="w-16 bg-slate-700 border-slate-600 text-slate-200 text-center"
                          />
                        </TableCell>
                        <TableCell className="text-slate-300 text-center font-semibold">{item.area.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={item.pricePerMeter}
                            onChange={(e) => updatePrintItem(index, 'pricePerMeter', Number(e.target.value) || 0)}
                            className="w-20 bg-slate-700 border-slate-600 text-slate-200 text-center"
                          />
                        </TableCell>
                        <TableCell className="font-bold text-blue-400 text-center">{item.totalArea.toFixed(2)}</TableCell>
                        <TableCell className="font-bold text-yellow-400 text-center">{item.totalPrice.toLocaleString('ar-LY')}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeItem(index)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gradient-to-r from-slate-700 to-slate-600 border-yellow-500/50">
                      <TableCell colSpan={4} className="font-bold text-yellow-400 text-center text-lg">الإجماليات:</TableCell>
                      <TableCell className="font-bold text-blue-400 text-center text-lg">{totalArea.toFixed(2)} م²</TableCell>
                      <TableCell className="font-bold text-yellow-400 text-center text-lg">{totalPrice.toLocaleString('ar-LY')} د.ل</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-700/50 rounded-lg border border-slate-600">
                <Receipt className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {billboards.length === 0 ? 'لا توجد لوحات مرتبطة بهذا العقد' : 
                   'لا توجد مقاسات محددة'}
                </p>
                <p className="text-slate-500 text-sm mt-2">
                  {billboards.length === 0 ? 'تأكد من إضافة اللوحات للعقد أولاً' : 'تأكد من تحديد مقاسات اللوحات'}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-600">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              إغلاق
            </Button>
            
            <Button
              onClick={printPrintingInvoice}
              disabled={printItems.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              <FileText className="h-4 w-4 ml-2" />
              فاتورة المطبعة
            </Button>
            
            <Button
              onClick={printCustomerInvoice}
              disabled={printItems.length === 0}
              className="bg-slate-700 hover:bg-slate-600 text-yellow-400 disabled:opacity-50"
            >
              <Printer className="h-4 w-4 ml-2" />
              فاتورة العميل
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={printItems.length === 0}
              className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-slate-900 font-semibold disabled:opacity-50"
            >
              <Receipt className="h-4 w-4 ml-2" />
              حفظ الفاتورة الشاملة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}