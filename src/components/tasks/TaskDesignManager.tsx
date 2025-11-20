import { useState } from 'react';
import { Plus, Pencil, Trash2, Eye, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface TaskDesign {
  id: string;
  task_id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url?: string;
  design_order: number;
}

interface TaskDesignManagerProps {
  taskId: string;
  designs: TaskDesign[];
  onDesignsUpdate: () => void;
}

export function TaskDesignManager({ taskId, designs, onDesignsUpdate }: TaskDesignManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDesign, setEditingDesign] = useState<TaskDesign | null>(null);
  const [designName, setDesignName] = useState('');
  const [designFaceAUrl, setDesignFaceAUrl] = useState('');
  const [designFaceBUrl, setDesignFaceBUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDesign, setPreviewDesign] = useState<TaskDesign | null>(null);

  const handleSaveDesign = async () => {
    if (!designName.trim()) {
      toast.error('يرجى إدخال اسم التصميم');
      return;
    }

    if (!designFaceAUrl.trim()) {
      toast.error('يرجى إدخال رابط تصميم الوجه الأمامي على الأقل');
      return;
    }

    setSaving(true);
    try {
      if (editingDesign) {
        // Update existing design
        const { error } = await supabase
          .from('task_designs')
          .update({
            design_name: designName,
            design_face_a_url: designFaceAUrl,
            design_face_b_url: designFaceBUrl || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingDesign.id);

        if (error) {
          console.error('Update error details:', error);
          throw error;
        }
        toast.success('تم تحديث التصميم بنجاح');
      } else {
        // Create new design
        const { data, error } = await supabase
          .from('task_designs')
          .insert({
            task_id: taskId,
            design_name: designName,
            design_face_a_url: designFaceAUrl,
            design_face_b_url: designFaceBUrl || null,
            design_order: designs.length
          })
          .select();

        if (error) {
          console.error('Insert error details:', error);
          throw error;
        }
        console.log('✅ Design added successfully:', data);
        toast.success('تم إضافة التصميم بنجاح');
      }

      // إعادة تحميل التصاميم فوراً قبل إغلاق النافذة
      console.log('🔄 Triggering designs update...');
      
      // إغلاق النافذة ثم إعادة التحميل لضمان التحديث
      setDialogOpen(false);
      resetForm();
      
      // إعادة تحميل البيانات بعد إغلاق النافذة
      setTimeout(() => {
        onDesignsUpdate();
      }, 100);
    } catch (error: any) {
      console.error('❌ Error saving design:', error);
      toast.error('فشل في حفظ التصميم: ' + (error.message || 'خطأ غير معروف'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDesign = async (designId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا التصميم؟')) return;

    try {
      const { error } = await supabase
        .from('task_designs')
        .delete()
        .eq('id', designId);

      if (error) throw error;
      toast.success('تم حذف التصميم بنجاح');
      
      // إعادة التحميل بعد الحذف
      setTimeout(() => {
        onDesignsUpdate();
      }, 100);
    } catch (error) {
      console.error('Error deleting design:', error);
      toast.error('فشل في حذف التصميم');
    }
  };

  const resetForm = () => {
    setDesignName('');
    setDesignFaceAUrl('');
    setDesignFaceBUrl('');
    setEditingDesign(null);
  };

  const openEditDialog = (design: TaskDesign) => {
    setEditingDesign(design);
    setDesignName(design.design_name);
    setDesignFaceAUrl(design.design_face_a_url);
    setDesignFaceBUrl(design.design_face_b_url || '');
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">التصاميم المضافة</h3>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              إضافة تصميم
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingDesign ? 'تعديل التصميم' : 'إضافة تصميم جديد'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="designName">اسم التصميم</Label>
                <Input
                  id="designName"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="مثال: تصميم شركة ABC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="designFaceA">رابط تصميم الوجه الأمامي (A) *</Label>
                <Input
                  id="designFaceA"
                  value={designFaceAUrl}
                  onChange={(e) => setDesignFaceAUrl(e.target.value)}
                  placeholder="https://..."
                  dir="ltr"
                />
                {designFaceAUrl && (
                  <>
                    <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary/20 bg-muted">
                      <img
                        src={designFaceAUrl}
                        alt="معاينة الوجه الأمامي"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder.svg';
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(designFaceAUrl, '_blank')}
                      className="w-full gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      فتح في نافذة جديدة
                    </Button>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="designFaceB">رابط تصميم الوجه الخلفي (B)</Label>
                <Input
                  id="designFaceB"
                  value={designFaceBUrl}
                  onChange={(e) => setDesignFaceBUrl(e.target.value)}
                  placeholder="https://... (اختياري)"
                  dir="ltr"
                />
                {designFaceBUrl && (
                  <>
                    <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary/20 bg-muted">
                      <img
                        src={designFaceBUrl}
                        alt="معاينة الوجه الخلفي"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder.svg';
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(designFaceBUrl, '_blank')}
                      className="w-full gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      فتح في نافذة جديدة
                    </Button>
                  </>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSaveDesign}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  disabled={saving}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {designs.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">لم يتم إضافة تصاميم بعد</p>
          <p className="text-sm text-muted-foreground mt-1">
            أضف تصاميم لتسهيل عملية التركيب
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {designs.map((design) => (
            <Card key={design.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm truncate flex-1">
                    {design.design_name}
                  </h4>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewDesign(design)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(design)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteDesign(design.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground text-center">الوجه الأمامي (A)</p>
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden border">
                      <img
                        src={design.design_face_a_url}
                        alt="الوجه الأمامي"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder.svg';
                        }}
                      />
                    </div>
                  </div>
                  {design.design_face_b_url && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground text-center">الوجه الخلفي (B)</p>
                      <div className="aspect-video bg-muted rounded-lg overflow-hidden border">
                        <img
                          src={design.design_face_b_url}
                          alt="الوجه الخلفي"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/placeholder.svg';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewDesign} onOpenChange={(open) => !open && setPreviewDesign(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewDesign?.design_name}</DialogTitle>
          </DialogHeader>
          {previewDesign && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">تصميم الوجه الأمامي (A)</h4>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden border-2">
                  <img
                    src={previewDesign.design_face_a_url}
                    alt="الوجه الأمامي"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(previewDesign.design_face_a_url, '_blank')}
                  className="w-full gap-2"
                >
                  <Eye className="w-4 h-4" />
                  فتح في نافذة جديدة
                </Button>
              </div>
              {previewDesign.design_face_b_url && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">تصميم الوجه الخلفي (B)</h4>
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden border-2">
                    <img
                      src={previewDesign.design_face_b_url}
                      alt="الوجه الخلفي"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/placeholder.svg';
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(previewDesign.design_face_b_url!, '_blank')}
                    className="w-full gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    فتح في نافذة جديدة
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
