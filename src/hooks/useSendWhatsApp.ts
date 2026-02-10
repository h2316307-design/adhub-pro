import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SendWhatsAppParams {
  phone: string;
  message: string;
}

export function useSendWhatsApp() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const formatPhoneNumber = (phone: string): string => {
    // إزالة المسافات والرموز الخاصة
    let formatted = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    
    // إضافة +218 إذا لم يكن موجوداً
    if (!formatted.startsWith('+')) {
      if (formatted.startsWith('218')) {
        formatted = '+' + formatted;
      } else if (formatted.startsWith('0')) {
        formatted = '+218' + formatted.substring(1);
      } else {
        formatted = '+218' + formatted;
      }
    }
    
    return formatted;
  };

  const sendMessage = async ({ phone, message }: SendWhatsAppParams): Promise<boolean> => {
    if (!phone || !message) {
      toast({
        title: "خطأ",
        description: "رقم الهاتف والرسالة مطلوبان",
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phone);

      const { data, error } = await supabase.functions.invoke('whatsapp-service', {
        body: {
          action: 'send',
          phone: formattedPhone,
          message: message
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "تم الإرسال بنجاح",
          description: "تم إرسال الرسالة عبر واتساب",
        });
        return true;
      } else {
        throw new Error(data.message || 'فشل الإرسال');
      }
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error);
      const detail = (error?.context && (error.context.message || error.context.error || error.context.details)) || error?.message;
      toast({
        title: "خطأ في الإرسال",
        description: detail || "تأكد من أن واتساب متصل",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const checkConnection = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-service', {
        body: { action: 'status' }
      });

      if (error) throw error;

      return data.connected || false;
    } catch (error) {
      console.error('Error checking WhatsApp connection:', error);
      return false;
    }
  };

  return {
    sendMessage,
    checkConnection,
    loading
  };
}
