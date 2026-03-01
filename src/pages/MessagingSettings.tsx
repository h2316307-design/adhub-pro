import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Send, Smartphone, Phone, Trash2, Plus, MessageCircle } from "lucide-react";
import { WhatsAppConnectionManager } from "@/components/messaging/WhatsAppConnectionManager";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MessagingSettings {
  id?: string;
  platform: 'whatsapp' | 'telegram';
  api_key?: string;
  api_secret?: string;
  phone_number?: string;
  bot_token?: string;
  is_active: boolean;
}

interface ManagementPhone {
  id: string;
  phone_number: string;
  label?: string;
  is_active: boolean;
}

export default function MessagingSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [whatsappSettings, setWhatsappSettings] = useState<MessagingSettings>({
    platform: 'whatsapp',
    is_active: false,
  });
  const [telegramSettings, setTelegramSettings] = useState<MessagingSettings>({
    platform: 'telegram',
    is_active: false,
  });
  const [textlyApiKey, setTextlyApiKey] = useState('');
  const [textlyActive, setTextlyActive] = useState(false);
  
  // Management Phones State
  const [managementPhones, setManagementPhones] = useState<ManagementPhone[]>([]);
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneLabel, setNewPhoneLabel] = useState('');
  const [loadingPhones, setLoadingPhones] = useState(false);

  useEffect(() => {
    loadSettings();
    loadManagementPhones();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('messaging_api_settings')
        .select('*');

      if (error) throw error;

      if (data) {
        const whatsapp = data.find(s => s.platform === 'whatsapp');
        const telegram = data.find(s => s.platform === 'telegram');
        const textly = data.find(s => s.platform === 'textly');

        if (whatsapp) {
          setWhatsappSettings(whatsapp as MessagingSettings);
        }
        if (telegram) {
          setTelegramSettings(telegram as MessagingSettings);
        }
        if (textly) {
          setTextlyApiKey(textly.api_key || '');
          setTextlyActive(textly.is_active || false);
        }
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      toast({
        title: "خطأ",
        description: "فشل تحميل الإعدادات",
        variant: "destructive",
      });
    }
  };

  const saveSettings = async (settings: MessagingSettings) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('messaging_api_settings')
        .upsert(settings, {
          onConflict: 'platform',
        });

      if (error) throw error;

      toast({
        title: "نجح",
        description: "تم حفظ الإعدادات بنجاح",
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "خطأ",
        description: "فشل حفظ الإعدادات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Management Phones Functions
  const loadManagementPhones = async () => {
    try {
      const { data, error } = await supabase
        .from('management_phones')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setManagementPhones(data || []);
    } catch (error: any) {
      console.error('Error loading management phones:', error);
      toast({
        title: "خطأ",
        description: "فشل تحميل أرقام الإدارة",
        variant: "destructive",
      });
    }
  };

  const addManagementPhone = async () => {
    if (!newPhone.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال رقم الهاتف",
        variant: "destructive",
      });
      return;
    }

    setLoadingPhones(true);
    try {
      const { error } = await supabase
        .from('management_phones')
        .insert({
          phone_number: newPhone.trim(),
          label: newPhoneLabel.trim() || null,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "نجح",
        description: "تم إضافة الرقم بنجاح",
      });

      setNewPhone('');
      setNewPhoneLabel('');
      loadManagementPhones();
    } catch (error: any) {
      console.error('Error adding phone:', error);
      toast({
        title: "خطأ",
        description: "فشل إضافة الرقم",
        variant: "destructive",
      });
    } finally {
      setLoadingPhones(false);
    }
  };

  const deleteManagementPhone = async (id: string) => {
    setLoadingPhones(true);
    try {
      const { error } = await supabase
        .from('management_phones')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "نجح",
        description: "تم حذف الرقم بنجاح",
      });

      loadManagementPhones();
    } catch (error: any) {
      console.error('Error deleting phone:', error);
      toast({
        title: "خطأ",
        description: "فشل حذف الرقم",
        variant: "destructive",
      });
    } finally {
      setLoadingPhones(false);
    }
  };

  const saveTextlySettings = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('messaging_api_settings')
        .upsert({
          platform: 'textly',
          api_key: textlyApiKey,
          is_active: textlyActive,
        }, {
          onConflict: 'platform',
        });

      if (error) throw error;

      toast({
        title: "نجح",
        description: "تم حفظ إعدادات Textly بنجاح",
      });
    } catch (error: any) {
      console.error('Error saving Textly settings:', error);
      toast({
        title: "خطأ",
        description: "فشل حفظ إعدادات Textly",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">إعدادات المراسلات</h1>
          <p className="text-muted-foreground mt-2">
            إدارة إعدادات API للواتساب والتليجرام
          </p>
        </div>

        <Tabs defaultValue="textly" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="textly" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Textly API
            </TabsTrigger>
            <TabsTrigger value="whatsapp-web" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              واتساب Web
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              واتساب API
            </TabsTrigger>
            <TabsTrigger value="telegram" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              تليجرام
            </TabsTrigger>
            <TabsTrigger value="management-phones" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              أرقام الإدارة
            </TabsTrigger>
          </TabsList>

          <TabsContent value="textly">
            <Card>
              <CardHeader>
                <CardTitle>إعدادات Textly</CardTitle>
                <CardDescription>
                  قم بإدخال مفتاح API الخاص بـ Textly للإرسال عبر واتساب
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="textly-active">تفعيل Textly</Label>
                  <Switch
                    id="textly-active"
                    checked={textlyActive}
                    onCheckedChange={setTextlyActive}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="textly-api-key">مفتاح API</Label>
                  <Input
                    id="textly-api-key"
                    type="password"
                    placeholder="أدخل مفتاح Textly API"
                    value={textlyApiKey}
                    onChange={(e) => setTextlyApiKey(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    يمكنك الحصول على المفتاح من لوحة تحكم Textly
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    ملاحظة مهمة
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Textly API يوفر إرسال رسائل واتساب بشكل موثوق وسريع دون الحاجة لاتصال دائم بالواتساب Web
                  </p>
                </div>

                <Button
                  onClick={saveTextlySettings}
                  disabled={loading}
                  className="w-full"
                >
                  حفظ إعدادات Textly
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp-web">
            <WhatsAppConnectionManager />
          </TabsContent>

          <TabsContent value="whatsapp">
            <Card>
              <CardHeader>
                <CardTitle>إعدادات واتساب</CardTitle>
                <CardDescription>
                  قم بإدخال معلومات API الخاصة بواتساب (مثل Twilio أو WhatsApp Business API)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="whatsapp-active">تفعيل واتساب</Label>
                  <Switch
                    id="whatsapp-active"
                    checked={whatsappSettings.is_active}
                    onCheckedChange={(checked) =>
                      setWhatsappSettings({ ...whatsappSettings, is_active: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp-api-key">مفتاح API</Label>
                  <Input
                    id="whatsapp-api-key"
                    type="password"
                    placeholder="أدخل مفتاح API"
                    value={whatsappSettings.api_key || ''}
                    onChange={(e) =>
                      setWhatsappSettings({ ...whatsappSettings, api_key: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp-api-secret">سر API</Label>
                  <Input
                    id="whatsapp-api-secret"
                    type="password"
                    placeholder="أدخل سر API"
                    value={whatsappSettings.api_secret || ''}
                    onChange={(e) =>
                      setWhatsappSettings({ ...whatsappSettings, api_secret: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp-phone">رقم الهاتف</Label>
                  <Input
                    id="whatsapp-phone"
                    placeholder="+218912345678"
                    value={whatsappSettings.phone_number || ''}
                    onChange={(e) =>
                      setWhatsappSettings({ ...whatsappSettings, phone_number: e.target.value })
                    }
                  />
                </div>

                <Button
                  onClick={() => saveSettings(whatsappSettings)}
                  disabled={loading}
                  className="w-full"
                >
                  حفظ إعدادات واتساب
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="telegram">
            <Card>
              <CardHeader>
                <CardTitle>إعدادات تليجرام</CardTitle>
                <CardDescription>
                  قم بإدخال معلومات البوت الخاص بتليجرام
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="telegram-active">تفعيل تليجرام</Label>
                  <Switch
                    id="telegram-active"
                    checked={telegramSettings.is_active}
                    onCheckedChange={(checked) =>
                      setTelegramSettings({ ...telegramSettings, is_active: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram-bot-token">رمز البوت (Bot Token)</Label>
                  <Input
                    id="telegram-bot-token"
                    type="password"
                    placeholder="أدخل رمز البوت"
                    value={telegramSettings.bot_token || ''}
                    onChange={(e) =>
                      setTelegramSettings({ ...telegramSettings, bot_token: e.target.value })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    يمكنك الحصول على الرمز من @BotFather على تليجرام
                  </p>
                </div>

                <Button
                  onClick={() => saveSettings(telegramSettings)}
                  disabled={loading}
                  className="w-full"
                >
                  حفظ إعدادات تليجرام
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="management-phones">
            <Card>
              <CardHeader>
                <CardTitle>أرقام الإدارة</CardTitle>
                <CardDescription>
                  إدارة أرقام هواتف الإدارة للإرسال الجماعي
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add New Phone Form */}
                <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    إضافة رقم جديد
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="new-phone">رقم الهاتف</Label>
                      <Input
                        id="new-phone"
                        placeholder="0912345678"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone-label">التسمية (اختياري)</Label>
                      <Input
                        id="phone-label"
                        placeholder="مثال: المدير العام"
                        value={newPhoneLabel}
                        onChange={(e) => setNewPhoneLabel(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={addManagementPhone}
                    disabled={loadingPhones || !newPhone.trim()}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 ml-2" />
                    إضافة الرقم
                  </Button>
                </div>

                {/* Phones List */}
                <div className="space-y-2">
                  <h4 className="font-semibold">الأرقام المضافة ({managementPhones.length})</h4>
                  {managementPhones.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>لا توجد أرقام مضافة</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>رقم الهاتف</TableHead>
                            <TableHead>التسمية</TableHead>
                            <TableHead className="text-left">الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {managementPhones.map((phone) => (
                            <TableRow key={phone.id}>
                              <TableCell className="font-mono" dir="ltr">
                                {phone.phone_number}
                              </TableCell>
                              <TableCell>
                                {phone.label || '-'}
                              </TableCell>
                              <TableCell className="text-left">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteManagementPhone(phone.id)}
                                  disabled={loadingPhones}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
