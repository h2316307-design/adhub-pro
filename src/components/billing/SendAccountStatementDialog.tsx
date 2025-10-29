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
import { useSendWhatsApp } from "@/hooks/useSendWhatsApp";
import { useSendTextly } from "@/hooks/useSendTextly";
import { MessageSquare, Send, Share2 } from "lucide-react";

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
  const [platform, setPlatform] = useState<'whatsapp-web' | 'textly'>('whatsapp-web');
  const [phoneNumber, setPhoneNumber] = useState(customerPhone || '');
  const [message, setMessage] = useState(
    `مرحباً ${customerName},\n\nنود إرسال كشف الحساب إليك.\n\nشكراً لك.`
  );

  const { sendMessage: sendWhatsApp, loading: whatsappLoading } = useSendWhatsApp();
  const { sendMessage: sendTextly, loading: textlyLoading } = useSendTextly();

  const loading = whatsappLoading || textlyLoading;

  const handleSend = async () => {
    if (!phoneNumber) {
      return;
    }

    let success = false;

    if (platform === 'whatsapp-web') {
      success = await sendWhatsApp({ phone: phoneNumber, message });
    } else if (platform === 'textly') {
      success = await sendTextly({ phone: phoneNumber, message });
    }

    if (success) {
      setOpen(false);
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
                <RadioGroupItem value="whatsapp-web" id="ws-web" />
                <Label htmlFor="ws-web" className="flex items-center gap-2 cursor-pointer">
                  <MessageSquare className="h-4 w-4" />
                  واتساب ويب
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="textly" id="textly" />
                <Label htmlFor="textly" className="flex items-center gap-2 cursor-pointer">
                  <Send className="h-4 w-4" />
                  Textly API
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
              onChange={(e) => setPhoneNumber(e.target.value)}
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

          <div className="flex gap-2">
            <Button onClick={handleSend} disabled={loading} className="flex-1">
              إرسال
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
