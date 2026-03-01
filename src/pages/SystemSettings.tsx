import { useState, useEffect } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, Link as LinkIcon, ImageIcon, Eye, EyeOff, ArrowLeftRight } from 'lucide-react';
import { clearImageUploadCache, type ImageUploadProvider } from '@/services/imageUploadService';

export default function SystemSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [imgbbApiKey, setImgbbApiKey] = useState('');
  const [freeimageApiKey, setFreeimageApiKey] = useState('');
  const [postimgApiKey, setPostimgApiKey] = useState('');
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState('dclm0wcn2');
  const [cloudinaryApiKey, setCloudinaryApiKey] = useState('341787562248646');
  const [imageProvider, setImageProvider] = useState<ImageUploadProvider>('imgbb');
  const [showImgbbKey, setShowImgbbKey] = useState(false);
  const [showFreeimageKey, setShowFreeimageKey] = useState(false);
  const [showPostimgKey, setShowPostimgKey] = useState(false);
  const [showCloudinaryKey, setShowCloudinaryKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .in('setting_key', ['google_sheets_url', 'google_maps_url', 'imgbb_api_key', 'freeimage_api_key', 'postimg_api_key', 'image_upload_provider', 'cloudinary_cloud_name', 'cloudinary_api_key']);

      if (error) throw error;

      data?.forEach(setting => {
        if (setting.setting_key === 'google_sheets_url') setGoogleSheetsUrl(setting.setting_value || '');
        else if (setting.setting_key === 'google_maps_url') setGoogleMapsUrl(setting.setting_value || '');
        else if (setting.setting_key === 'imgbb_api_key') setImgbbApiKey(setting.setting_value || '');
        else if (setting.setting_key === 'freeimage_api_key') setFreeimageApiKey(setting.setting_value || '');
        else if (setting.setting_key === 'postimg_api_key') setPostimgApiKey(setting.setting_value || '');
        else if (setting.setting_key === 'cloudinary_cloud_name') setCloudinaryCloudName(setting.setting_value || 'dclm0wcn2');
        else if (setting.setting_key === 'cloudinary_api_key') setCloudinaryApiKey(setting.setting_value || '341787562248646');
        else if (setting.setting_key === 'image_upload_provider') setImageProvider((setting.setting_value as ImageUploadProvider) || 'imgbb');
      });
    } catch (error: any) {
      console.error('خطأ في تحميل الإعدادات:', error);
      toast({ title: 'خطأ', description: 'فشل تحميل الإعدادات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const settings = [
        { key: 'google_sheets_url', value: googleSheetsUrl },
        { key: 'google_maps_url', value: googleMapsUrl },
        { key: 'imgbb_api_key', value: imgbbApiKey },
        { key: 'freeimage_api_key', value: freeimageApiKey },
        { key: 'postimg_api_key', value: postimgApiKey },
        { key: 'cloudinary_cloud_name', value: cloudinaryCloudName },
        { key: 'cloudinary_api_key', value: cloudinaryApiKey },
        { key: 'image_upload_provider', value: imageProvider },
      ];

      for (const s of settings) {
        const { error } = await supabase
          .from('system_settings')
          .upsert({ setting_key: s.key, setting_value: s.value }, { onConflict: 'setting_key' });
        if (error) throw error;
      }

      clearImageUploadCache();

      toast({ title: 'تم الحفظ', description: 'تم حفظ الإعدادات بنجاح' });
    } catch (error: any) {
      console.error('خطأ في حفظ الإعدادات:', error);
      toast({ title: 'خطأ', description: 'فشل حفظ الإعدادات', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">إعدادات النظام</h1>
        <p className="text-muted-foreground mt-2">إدارة روابط المزامنة والخرائط ومفاتيح API</p>
      </div>

      {/* Image Upload Provider Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            إعدادات رفع الصور
          </CardTitle>
          <CardDescription>اختر خدمة رفع الصور وأدخل مفتاح API الخاص بها</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Toggle */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">خدمة رفع الصور المستخدمة</Label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <button
                type="button"
                onClick={() => setImageProvider('supabase_storage')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  imageProvider === 'supabase_storage'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="text-lg font-bold">Supabase</span>
                <span className="text-xs text-muted-foreground text-center">تخزين داخلي (مُوصى به)</span>
                {imageProvider === 'supabase_storage' && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setImageProvider('cloudinary')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  imageProvider === 'cloudinary'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="text-lg font-bold">Cloudinary</span>
                <span className="text-xs text-muted-foreground text-center">cloudinary.com</span>
                {imageProvider === 'cloudinary' && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setImageProvider('imgbb')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  imageProvider === 'imgbb'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="text-lg font-bold">imgbb</span>
                <span className="text-xs text-muted-foreground text-center">api.imgbb.com</span>
                {imageProvider === 'imgbb' && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setImageProvider('freeimage')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  imageProvider === 'freeimage'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="text-lg font-bold">Freeimage.host</span>
                <span className="text-xs text-muted-foreground text-center">freeimage.host/api</span>
                {imageProvider === 'freeimage' && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setImageProvider('postimg')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  imageProvider === 'postimg'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="text-lg font-bold">PostImages</span>
                <span className="text-xs text-muted-foreground text-center">postimages.org</span>
                {imageProvider === 'postimg' && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </button>
            </div>
          </div>

          {/* imgbb API Key */}
          <div className={`space-y-2 p-4 rounded-lg border ${imageProvider === 'imgbb' ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            <Label htmlFor="imgbb-api-key" className="flex items-center gap-2">
              مفتاح imgbb API
              {imageProvider === 'imgbb' && <span className="text-xs text-primary">(الخدمة النشطة)</span>}
            </Label>
            <div className="flex gap-2">
              <Input
                id="imgbb-api-key"
                type={showImgbbKey ? 'text' : 'password'}
                value={imgbbApiKey}
                onChange={(e) => setImgbbApiKey(e.target.value)}
                placeholder="أدخل مفتاح imgbb API..."
                dir="ltr"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowImgbbKey(!showImgbbKey)}>
                {showImgbbKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              احصل على مفتاح API من{' '}
              <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">api.imgbb.com</a>
            </p>
          </div>

          {/* Freeimage API Key */}
          <div className={`space-y-2 p-4 rounded-lg border ${imageProvider === 'freeimage' ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            <Label htmlFor="freeimage-api-key" className="flex items-center gap-2">
              مفتاح Freeimage.host API
              {imageProvider === 'freeimage' && <span className="text-xs text-primary">(الخدمة النشطة)</span>}
            </Label>
            <div className="flex gap-2">
              <Input
                id="freeimage-api-key"
                type={showFreeimageKey ? 'text' : 'password'}
                value={freeimageApiKey}
                onChange={(e) => setFreeimageApiKey(e.target.value)}
                placeholder="أدخل مفتاح Freeimage.host API..."
                dir="ltr"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowFreeimageKey(!showFreeimageKey)}>
                {showFreeimageKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              احصل على مفتاح API من{' '}
              <a href="https://freeimage.host/page/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">freeimage.host</a>
            </p>
          </div>

          {/* PostImages API Key */}
          <div className={`space-y-2 p-4 rounded-lg border ${imageProvider === 'postimg' ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            <Label htmlFor="postimg-api-key" className="flex items-center gap-2">
              مفتاح PostImages API
              {imageProvider === 'postimg' && <span className="text-xs text-primary">(الخدمة النشطة)</span>}
            </Label>
            <div className="flex gap-2">
              <Input
                id="postimg-api-key"
                type={showPostimgKey ? 'text' : 'password'}
                value={postimgApiKey}
                onChange={(e) => setPostimgApiKey(e.target.value)}
                placeholder="أدخل مفتاح PostImages API..."
                dir="ltr"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowPostimgKey(!showPostimgKey)}>
                {showPostimgKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              احصل على مفتاح API من{' '}
              <a href="https://postimages.org/login/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">postimages.org</a>
              {' '}(يتطلب حساب مسجّل)
            </p>
          </div>

          {/* Cloudinary Settings */}
          <div className={`space-y-4 p-4 rounded-lg border ${imageProvider === 'cloudinary' ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            <Label className="flex items-center gap-2">
              Cloudinary
              {imageProvider === 'cloudinary' && <span className="text-xs text-primary">(الخدمة النشطة)</span>}
            </Label>
            <div className="space-y-2">
              <Label htmlFor="cloudinary-cloud-name">Cloud Name</Label>
              <Input
                id="cloudinary-cloud-name"
                value={cloudinaryCloudName}
                onChange={(e) => setCloudinaryCloudName(e.target.value)}
                placeholder="مثال: dclm0wcn2"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cloudinary-api-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="cloudinary-api-key"
                  type={showCloudinaryKey ? 'text' : 'password'}
                  value={cloudinaryApiKey}
                  onChange={(e) => setCloudinaryApiKey(e.target.value)}
                  placeholder="أدخل مفتاح Cloudinary API Key..."
                  dir="ltr"
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowCloudinaryKey(!showCloudinaryKey)}>
                  {showCloudinaryKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              API Secret مخزّن بأمان في Supabase Secrets. إدارة الحساب من{' '}
              <a href="https://console.cloudinary.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Cloudinary Console</a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sync Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            روابط المزامنة
          </CardTitle>
          <CardDescription>تعديل روابط Google Sheets و Google Maps للمزامنة التلقائية</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="google-sheets">رابط Google Sheets</Label>
            <Input id="google-sheets" type="url" value={googleSheetsUrl} onChange={(e) => setGoogleSheetsUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/..." dir="ltr" />
            <p className="text-sm text-muted-foreground">رابط ملف Google Sheets الذي يحتوي على بيانات اللوحات الإعلانية</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="google-maps">رابط Google Maps</Label>
            <Input id="google-maps" type="url" value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} placeholder="https://www.google.com/maps/..." dir="ltr" />
            <p className="text-sm text-muted-foreground">رابط خريطة Google Maps لعرض مواقع اللوحات</p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري الحفظ...</>
          ) : (
            <><Save className="ml-2 h-4 w-4" />حفظ جميع الإعدادات</>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ملاحظات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• يمكنك التبديل بين imgbb و Freeimage.host و PostImages في أي وقت</p>
          <p>• تأكد من إدخال مفتاح API للخدمة المختارة قبل رفع الصور</p>
          <p>• جميع أماكن رفع الصور في النظام ستستخدم الخدمة المختارة تلقائياً</p>
          <p>• رابط Google Sheets يجب أن يكون مفتوحاً للجميع أو مشاركاً مع التطبيق</p>
        </CardContent>
      </Card>
    </div>
  );
}
