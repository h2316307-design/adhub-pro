import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useSendWhatsApp } from "@/hooks/useSendWhatsApp";
import { useSendTextly } from "@/hooks/useSendTextly";
import { useAccountStatementPDF } from "@/hooks/useAccountStatementPDF";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Share2, FileText } from "lucide-react";
import { toast } from "sonner";

interface SendAccountStatementDialogProps {
  customerName: string;
  customerPhone?: string;
  accountStatementHTML?: string;
}

export function SendAccountStatementDialog({
  customerName,
  customerPhone,
  accountStatementHTML,
}: SendAccountStatementDialogProps) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<'whatsapp-web' | 'textly'>('textly');
  const [sendAsPDF, setSendAsPDF] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [message, setMessage] = useState(
    `مرحباً ${customerName},\n\nنود إرسال كشف الحساب إليك.\n\nشكراً لك.`
  );

  // Always use the latest customerPhone prop
  const phoneNumber = customerPhone || '';

  const { sendMessage: sendWhatsApp, loading: whatsappLoading } = useSendWhatsApp();
  const { sendMessage: sendTextly, sendDocument, loading: textlyLoading } = useSendTextly();
  const { generatePDF, loading: pdfLoading } = useAccountStatementPDF();

  const loading = whatsappLoading || textlyLoading || pdfLoading;

  const handleSend = async () => {
    if (!phoneNumber) {
      toast.error('رقم الهاتف مطلوب');
      return;
    }

    try {
      let success = false;

      // إذا كان الإرسال كـ PDF
      if (sendAsPDF) {
        if (platform === 'whatsapp-web') {
          toast.error('إرسال PDF يتطلب استخدام Textly API');
          return;
        }

        // استخراج customerId من URL أو استخدام customerName
        const urlParams = new URLSearchParams(window.location.search);
        const customerId = urlParams.get('id') || '';

        toast.info('جاري إنشاء ملف PDF...');
        
        // توليد PDF
        const pdfBase64 = await generatePDF({
          customerId,
          customerName,
        });

        if (!pdfBase64 || pdfBase64.length < 100) {
          throw new Error('فشل في إنشاء ملف PDF صالح');
        }

        // تحضير الرسالة مع الملخص إذا كان مطلوباً
        let finalMessage = message;
        if (includeSummary) {
          // ✅ نحمل البيانات مباشرة لحساب الملخص
          try {
            let contractsData: any[] = [];
            let paymentsData: any[] = [];

            if (customerId) {
              const { data: contracts } = await supabase
                .from('Contract')
                .select('Total')
                .eq('customer_id', customerId);
              contractsData = contracts || [];

              const { data: payments } = await supabase
                .from('customer_payments')
                .select('amount, entry_type')
                .eq('customer_id', customerId);
              paymentsData = payments || [];
            }

            const totalDebits = contractsData.reduce((sum, c) => sum + (Number(c.Total) || 0), 0);
            const totalCredits = paymentsData
              .filter(p => p.entry_type === 'receipt')
              .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const balance = totalDebits - totalCredits;

            finalMessage += `\n\n📊 ملخص الحساب:\n`;
            finalMessage += `• إجمالي المدين: ${totalDebits.toLocaleString()} د.ل\n`;
            finalMessage += `• إجمالي الدائن: ${totalCredits.toLocaleString()} د.ل\n`;
            finalMessage += `• الرصيد النهائي: ${balance.toLocaleString()} د.ل`;
          } catch (error) {
            console.warn('فشل في حساب الملخص:', error);
          }
        }

        console.log('📤 إرسال PDF، الحجم:', pdfBase64.length);

        // إرسال PDF عبر Textly
        success = await sendDocument({
          phone: phoneNumber,
          caption: finalMessage,
          fileName: `كشف_حساب_${customerName}.pdf`,
          mimeType: 'application/pdf',
          base64Content: pdfBase64,
        });
      } else {
        // إرسال رسالة نصية فقط
        if (platform === 'whatsapp-web') {
          success = await sendWhatsApp({ phone: phoneNumber, message });
        } else if (platform === 'textly') {
          success = await sendTextly({ phone: phoneNumber, message });
        }
      }

      if (success) {
        toast.success('تم إرسال كشف الحساب بنجاح');
        setOpen(false);
      }
    } catch (error: any) {
      console.error('Error sending statement:', error);
      toast.error('فشل في إرسال كشف الحساب: ' + (error.message || 'خطأ غير معروف'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          إرسال كشف الحساب
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إرسال كشف الحساب</DialogTitle>
          <DialogDescription>
            اختر طريقة الإرسال وأدخل رقم الهاتف
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>طريقة الإرسال</Label>
            <RadioGroup
              value={platform}
              onValueChange={(value) => setPlatform(value as 'whatsapp-web' | 'textly')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="textly" id="textly" />
                <Label htmlFor="textly" className="flex items-center gap-2 cursor-pointer">
                  <Send className="h-4 w-4" />
                  Textly API (موصى به)
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="whatsapp-web" id="ws-web" />
                <Label htmlFor="ws-web" className="flex items-center gap-2 cursor-pointer">
                  <MessageSquare className="h-4 w-4" />
                  واتساب ويب
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">رقم الهاتف</Label>
            <Input
              id="phone"
              placeholder="+218912345678"
              value={phoneNumber}
              readOnly
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">الرسالة</Label>
            <Textarea
              id="message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2 space-x-reverse p-4 bg-muted rounded-lg">
              <Checkbox
                id="send-pdf"
                checked={sendAsPDF}
                onCheckedChange={(checked) => setSendAsPDF(checked as boolean)}
              />
              <Label htmlFor="send-pdf" className="flex items-center gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                إرسال كشف الحساب كملف PDF
              </Label>
            </div>

            {sendAsPDF && (
              <div className="flex items-center space-x-2 space-x-reverse p-4 bg-primary/5 rounded-lg border border-primary/20">
                <Checkbox
                  id="include-summary"
                  checked={includeSummary}
                  onCheckedChange={(checked) => setIncludeSummary(checked as boolean)}
                />
                <Label htmlFor="include-summary" className="flex items-center gap-2 cursor-pointer text-sm">
                  <FileText className="h-4 w-4" />
                  إضافة الملخص الكتابي مع الملف
                </Label>
              </div>
            )}
          </div>

          {sendAsPDF && platform === 'whatsapp-web' && (
            <div className="text-sm text-amber-600 p-3 bg-amber-50 rounded-lg">
              ⚠️ إرسال ملفات PDF يتطلب استخدام Textly API
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSend} disabled={loading} className="flex-1">
              {loading ? 'جاري الإرسال...' : 'إرسال'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="flex-1"
            >
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
