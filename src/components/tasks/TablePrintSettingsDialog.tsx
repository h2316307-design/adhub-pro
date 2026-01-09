import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Save, RotateCcw, Palette, Image, Table2, FileText, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { TablePrintSettings, TableColumn } from '@/hooks/useTablePrintSettings';

interface TablePrintSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: TablePrintSettings;
  onUpdateSetting: <K extends keyof TablePrintSettings>(key: K, value: TablePrintSettings[K]) => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}

export function TablePrintSettingsDialog({
  open,
  onOpenChange,
  settings,
  onUpdateSetting,
  onSave,
  onReset,
  saving
}: TablePrintSettingsDialogProps) {
  
  // دالة لتحريك عمود للأعلى
  const moveColumnUp = (columnId: string) => {
    const columns = [...settings.columns_order];
    const index = columns.findIndex(c => c.id === columnId);
    if (index > 0) {
      [columns[index], columns[index - 1]] = [columns[index - 1], columns[index]];
      columns.forEach((c, i) => c.order = i);
      onUpdateSetting('columns_order', columns);
    }
  };

  // دالة لتحريك عمود للأسفل
  const moveColumnDown = (columnId: string) => {
    const columns = [...settings.columns_order];
    const index = columns.findIndex(c => c.id === columnId);
    if (index < columns.length - 1) {
      [columns[index], columns[index + 1]] = [columns[index + 1], columns[index]];
      columns.forEach((c, i) => c.order = i);
      onUpdateSetting('columns_order', columns);
    }
  };

  // دالة لتفعيل/تعطيل عمود
  const toggleColumn = (columnId: string, enabled: boolean) => {
    const columns = settings.columns_order.map(c => 
      c.id === columnId ? { ...c, enabled } : c
    );
    onUpdateSetting('columns_order', columns);
  };

  const sortedColumns = [...settings.columns_order].sort((a, b) => a.order - b.order);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-primary" />
            إعدادات طباعة الجدول
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="columns" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="columns" className="flex items-center gap-1">
              <Table2 className="h-4 w-4" />
              الأعمدة
            </TabsTrigger>
            <TabsTrigger value="colors" className="flex items-center gap-1">
              <Palette className="h-4 w-4" />
              الألوان
            </TabsTrigger>
            <TabsTrigger value="images" className="flex items-center gap-1">
              <Image className="h-4 w-4" />
              الصور
            </TabsTrigger>
            <TabsTrigger value="page" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              الصفحة
            </TabsTrigger>
          </TabsList>

          {/* تبويب الأعمدة - ترتيب وتفعيل */}
          <TabsContent value="columns" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border">
              <Label className="font-medium">إخفاء الأعمدة الفارغة تلقائياً</Label>
              <Switch
                checked={settings.auto_hide_empty_columns}
                onCheckedChange={(c) => onUpdateSetting('auto_hide_empty_columns', c)}
              />
            </div>
            
            <Separator />
            
            <p className="text-sm text-muted-foreground">اسحب الأعمدة لإعادة ترتيبها أو استخدم الأسهم:</p>
            
            <div className="space-y-2">
              {sortedColumns.map((column, index) => (
                <div 
                  key={column.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    column.enabled 
                      ? 'bg-background hover:bg-muted/50' 
                      : 'bg-muted/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{column.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveColumnUp(column.id)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveColumnDown(column.id)}
                      disabled={index === sortedColumns.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Switch
                      checked={column.enabled}
                      onCheckedChange={(c) => toggleColumn(column.id, c)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* تبويب الألوان */}
          <TabsContent value="colors" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>لون خلفية العنوان</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.header_bg_color}
                    onChange={(e) => onUpdateSetting('header_bg_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.header_bg_color}
                    onChange={(e) => onUpdateSetting('header_bg_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>لون نص العنوان</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.header_text_color}
                    onChange={(e) => onUpdateSetting('header_text_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.header_text_color}
                    onChange={(e) => onUpdateSetting('header_text_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>لون خلفية الصف</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.row_bg_color}
                    onChange={(e) => onUpdateSetting('row_bg_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.row_bg_color}
                    onChange={(e) => onUpdateSetting('row_bg_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>لون الصف البديل</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.row_alt_bg_color}
                    onChange={(e) => onUpdateSetting('row_alt_bg_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.row_alt_bg_color}
                    onChange={(e) => onUpdateSetting('row_alt_bg_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>لون نص الصف</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.row_text_color}
                    onChange={(e) => onUpdateSetting('row_text_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.row_text_color}
                    onChange={(e) => onUpdateSetting('row_text_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>لون الحدود</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.border_color}
                    onChange={(e) => onUpdateSetting('border_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.border_color}
                    onChange={(e) => onUpdateSetting('border_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <Separator />
            
            <p className="text-sm font-medium text-muted-foreground">لون العمود الأول:</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>لون خلفية العمود الأول</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.first_column_bg_color}
                    onChange={(e) => onUpdateSetting('first_column_bg_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.first_column_bg_color}
                    onChange={(e) => onUpdateSetting('first_column_bg_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>لون نص العمود الأول</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.first_column_text_color}
                    onChange={(e) => onUpdateSetting('first_column_text_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.first_column_text_color}
                    onChange={(e) => onUpdateSetting('first_column_text_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>حجم خط العنوان</Label>
                <Input
                  value={settings.header_font_size}
                  onChange={(e) => onUpdateSetting('header_font_size', e.target.value)}
                  placeholder="11px"
                />
              </div>
              <div className="space-y-2">
                <Label>حجم خط الصف</Label>
                <Input
                  value={settings.row_font_size}
                  onChange={(e) => onUpdateSetting('row_font_size', e.target.value)}
                  placeholder="10px"
                />
              </div>
              <div className="space-y-2">
                <Label>حجم عنوان الجدول</Label>
                <Input
                  value={settings.title_font_size}
                  onChange={(e) => onUpdateSetting('title_font_size', e.target.value)}
                  placeholder="16px"
                />
              </div>
            </div>
          </TabsContent>

          {/* تبويب الصور */}
          <TabsContent value="images" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              حجم الصورة يمثل الحد الأقصى للعرض أو الارتفاع (أيهما أكبر)
            </p>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>حجم صورة اللوحة</Label>
                <Input
                  value={settings.billboard_image_size}
                  onChange={(e) => onUpdateSetting('billboard_image_size', e.target.value)}
                  placeholder="50px"
                />
              </div>
              <div className="space-y-2">
                <Label>حجم صورة التصميم</Label>
                <Input
                  value={settings.design_image_size}
                  onChange={(e) => onUpdateSetting('design_image_size', e.target.value)}
                  placeholder="40px"
                />
              </div>
              <div className="space-y-2">
                <Label>حجم صورة التركيب</Label>
                <Input
                  value={settings.installed_image_size}
                  onChange={(e) => onUpdateSetting('installed_image_size', e.target.value)}
                  placeholder="40px"
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <Label>عرض رمز QR للموقع</Label>
              <Switch
                checked={settings.show_qr_code}
                onCheckedChange={(c) => onUpdateSetting('show_qr_code', c)}
              />
            </div>
          </TabsContent>

          {/* تبويب الصفحة */}
          <TabsContent value="page" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>عنوان الصفحة</Label>
                <Input
                  value={settings.page_title}
                  onChange={(e) => onUpdateSetting('page_title', e.target.value)}
                  placeholder="جدول لوحات العقد"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>عدد الصفوف في كل صفحة</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={settings.rows_per_page}
                    onChange={(e) => onUpdateSetting('rows_per_page', parseInt(e.target.value) || 10)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>اتجاه الصفحة</Label>
                  <Select
                    value={settings.page_orientation}
                    onValueChange={(v) => onUpdateSetting('page_orientation', v as 'portrait' | 'landscape')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="landscape">أفقي (عرضي)</SelectItem>
                      <SelectItem value="portrait">عمودي (طولي)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>هامش الصفحة</Label>
                  <Input
                    value={settings.page_margin}
                    onChange={(e) => onUpdateSetting('page_margin', e.target.value)}
                    placeholder="8mm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>الخط الأساسي</Label>
                <Select
                  value={settings.primary_font}
                  onValueChange={(v) => onUpdateSetting('primary_font', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Doran">Doran</SelectItem>
                    <SelectItem value="Cairo">Cairo</SelectItem>
                    <SelectItem value="Tajawal">Tajawal</SelectItem>
                    <SelectItem value="Arial">Arial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* أزرار التحكم */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onReset} className="flex-1">
            <RotateCcw className="h-4 w-4 ml-2" />
            إعادة تعيين
          </Button>
          <Button onClick={onSave} disabled={saving} className="flex-1">
            <Save className="h-4 w-4 ml-2" />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
