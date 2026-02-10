import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, Link as LinkIcon } from 'lucide-react';

export default function SystemSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .in('setting_key', ['google_sheets_url', 'google_maps_url']);

      if (error) throw error;

      data?.forEach(setting => {
        if (setting.setting_key === 'google_sheets_url') {
          setGoogleSheetsUrl(setting.setting_value || '');
        } else if (setting.setting_key === 'google_maps_url') {
          setGoogleMapsUrl(setting.setting_value || '');
        }
      });
    } catch (error: any) {
      console.error('خطأ في تحميل الإعدادات:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل الإعدادات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // تحديث رابط Google Sheets
      const { error: sheetsError } = await supabase
        .from('system_settings')
        .update({ setting_value: googleSheetsUrl })
        .eq('setting_key', 'google_sheets_url');

      if (sheetsError) throw sheetsError;

      // تحديث رابط Google Maps
      const { error: mapsError } = await supabase
        .from('system_settings')
        .update({ setting_value: googleMapsUrl })
        .eq('setting_key', 'google_maps_url');

      if (mapsError) throw mapsError;

      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ الإعدادات بنجاح',
      });
    } catch (error: any) {
      console.error('خطأ في حفظ الإعدادات:', error);
      toast({
        title: 'خطأ',
        description: 'فشل حفظ الإعدادات',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">إعدادات النظام</h1>
          <p className="text-muted-foreground mt-2">
            إدارة روابط المزامنة والخرائط
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              روابط المزامنة
            </CardTitle>
            <CardDescription>
              تعديل روابط Google Sheets و Google Maps للمزامنة التلقائية
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="google-sheets">رابط Google Sheets</Label>
              <Input
                id="google-sheets"
                type="url"
                value={googleSheetsUrl}
                onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/..."
                dir="ltr"
              />
              <p className="text-sm text-muted-foreground">
                رابط ملف Google Sheets الذي يحتوي على بيانات اللوحات الإعلانية
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="google-maps">رابط Google Maps</Label>
              <Input
                id="google-maps"
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://www.google.com/maps/..."
                dir="ltr"
              />
              <p className="text-sm text-muted-foreground">
                رابط خريطة Google Maps لعرض مواقع اللوحات
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save className="ml-2 h-4 w-4" />
                    حفظ الإعدادات
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ملاحظات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• رابط Google Sheets يجب أن يكون مفتوحاً للجميع أو مشاركاً مع التطبيق</p>
            <p>• يمكن استخدام صيغة CSV من Google Sheets للمزامنة السريعة</p>
            <p>• تأكد من أن رابط Google Maps يشير إلى الخريطة الصحيحة</p>
            <p>• سيتم استخدام هذه الروابط في التطبيق لجلب البيانات تلقائياً</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
