import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PaintBucket, Plus, Trash2, Image as ImageIcon, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export interface BillboardDesign {
  billboardId: string;
  billboardName: string;
  billboardImage?: string;
  billboardLocation?: string;
  designFaceA: string;
  designFaceB: string;
  notes?: string;
}

interface Design {
  id: string;
  name: string;
  designFaceA: string;
  designFaceB: string;
  notes?: string;
  billboardIds: string[];
}

interface DesignManagerProps {
  selectedBillboards: Array<{
    id: string;
    name: string;
    Image_URL?: string;
    image?: string;
    Nearest_Landmark?: string;
    nearest_landmark?: string;
  }>;
  designs: BillboardDesign[];
  onChange: (designs: BillboardDesign[]) => void;
  contractId?: string;
}

export function DesignManager({ selectedBillboards, designs, onChange, contractId }: DesignManagerProps) {
  const [showPreview, setShowPreview] = useState<{ url: string; title: string } | null>(null);
  const [groupedDesigns, setGroupedDesigns] = useState<Design[]>([]);
  const [initialized, setInitialized] = useState(false);
  

  useEffect(() => {
    if (!initialized && selectedBillboards.length > 0) {
      if (designs.length === 0) {
        const defaultDesign: Design = {
          id: '1',
          name: 'التصميم الرئيسي',
          designFaceA: '',
          designFaceB: '',
          notes: '',
          billboardIds: selectedBillboards.map(b => b.id)
        };
        setGroupedDesigns([defaultDesign]);
        syncToParent([defaultDesign]);
      } else {
        const groups = convertToGroupedDesigns(designs);
        setGroupedDesigns(groups);
      }
      setInitialized(true);
    }
  }, [selectedBillboards, designs, initialized]);

  const convertToGroupedDesigns = (billboardDesigns: BillboardDesign[]): Design[] => {
    const designMap = new Map<string, Design>();

    billboardDesigns.forEach((bd) => {
      const key = `${bd.designFaceA}|${bd.designFaceB}|${bd.notes || ''}`;

      if (designMap.has(key)) {
        const existing = designMap.get(key)!;
        if (!existing.billboardIds.includes(bd.billboardId)) {
          existing.billboardIds.push(bd.billboardId);
        }
      } else {
        designMap.set(key, {
          id: Math.random().toString(36).substr(2, 9),
          name: `تصميم ${designMap.size + 1}`,
          designFaceA: bd.designFaceA,
          designFaceB: bd.designFaceB,
          notes: bd.notes || '',
          billboardIds: [bd.billboardId]
        });
      }
    });

    return Array.from(designMap.values());
  };

  const syncToParent = (designs: Design[]) => {
    const billboardDesigns: BillboardDesign[] = [];

    designs.forEach(design => {
      design.billboardIds.forEach(billboardId => {
        const billboard = selectedBillboards.find(b => b.id === billboardId);
        if (billboard) {
          billboardDesigns.push({
            billboardId: billboard.id,
            billboardName: billboard.name,
            billboardImage: (billboard as any).Image_URL || (billboard as any).image,
            billboardLocation: (billboard as any).Nearest_Landmark || (billboard as any).nearest_landmark,
            designFaceA: design.designFaceA,
            designFaceB: design.designFaceB,
            notes: design.notes || ''
          });
        }
      });
    });

    onChange(billboardDesigns);
  };


  const addDesign = () => {
    if (selectedBillboards.length === 0) {
      toast.error('يرجى اختيار لوحات أولاً');
      return;
    }

    const newDesign: Design = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: `تصميم ${groupedDesigns.length + 1}`,
      designFaceA: '',
      designFaceB: '',
      notes: '',
      billboardIds: []
    };

    const updated = [...groupedDesigns, newDesign];
    setGroupedDesigns(updated);
    syncToParent(updated);
    toast.success('تم إضافة تصميم جديد');
  };

  const updateDesign = (designId: string, updates: Partial<Design>) => {
    const updated = groupedDesigns.map(d =>
      d.id === designId ? { ...d, ...updates } : d
    );
    setGroupedDesigns(updated);
    syncToParent(updated);
  };

  const removeDesign = (designId: string) => {
    const updated = groupedDesigns.filter(d => d.id !== designId);
    setGroupedDesigns(updated);
    syncToParent(updated);
    toast.success('تم حذف التصميم');
  };

  const toggleBillboard = (designId: string, billboardId: string) => {
    const design = groupedDesigns.find(d => d.id === designId);
    if (!design) return;

    const otherDesign = groupedDesigns.find(d =>
      d.id !== designId && d.billboardIds.includes(billboardId)
    );

    let updatedDesigns: Design[];

    if (design.billboardIds.includes(billboardId)) {
      updatedDesigns = groupedDesigns.map(d =>
        d.id === designId
          ? { ...d, billboardIds: d.billboardIds.filter(id => id !== billboardId) }
          : d
      );
    } else {
      if (otherDesign) {
        updatedDesigns = groupedDesigns.map(d => {
          if (d.id === otherDesign.id) {
            return { ...d, billboardIds: d.billboardIds.filter(id => id !== billboardId) };
          } else if (d.id === designId) {
            return { ...d, billboardIds: [...d.billboardIds, billboardId] };
          }
          return d;
        });
      } else {
        updatedDesigns = groupedDesigns.map(d =>
          d.id === designId
            ? { ...d, billboardIds: [...d.billboardIds, billboardId] }
            : d
        );
      }
    }

    setGroupedDesigns(updatedDesigns);
    syncToParent(updatedDesigns);
  };

  const selectAllBillboards = (designId: string) => {
    updateDesign(designId, {
      billboardIds: selectedBillboards.map(b => b.id)
    });
    toast.success('تم اختيار جميع اللوحات لهذا التصميم');
  };

  const previewImage = (url: string, title: string) => {
    if (!url) {
      toast.error('لا يوجد رابط للمعاينة');
      return;
    }
    setShowPreview({ url, title });
  };

  const [isOpen, setIsOpen] = useState(false); // Collapsed by default

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-card border-border shadow-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <PaintBucket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground">إدارة التصاميم</h3>
                <p className="text-xs text-muted-foreground">
                  {groupedDesigns.length} تصميم مضاف
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {groupedDesigns.length}
              </Badge>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border p-4 flex justify-end">
            <Button
              onClick={addDesign}
              size="sm"
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 ml-2" />
              إضافة تصميم جديد
            </Button>
          </div>
          
          <CardContent className="space-y-4">
        {groupedDesigns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <PaintBucket className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>لا توجد تصاميم مضافة</p>
            <p className="text-sm mt-1">انقر على "إضافة تصميم جديد" لإنشاء تصميم</p>
          </div>
        ) : (
          groupedDesigns.map((design) => (
            <Card key={design.id} className="bg-card/50 border-border">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Input
                      type="text"
                      value={design.name}
                      onChange={(e) => updateDesign(design.id, { name: e.target.value })}
                      className="font-medium text-card-foreground bg-transparent border-0 px-0 focus-visible:ring-0"
                      placeholder="اسم التصميم"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => selectAllBillboards(design.id)}
                      className="text-xs"
                      title="اختيار جميع اللوحات"
                    >
                      <Copy className="h-4 w-4 ml-1" />
                      الكل
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeDesign(design.id)}
                      title="حذف التصميم"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-card-foreground mb-2 block">
                    اللوحات المختارة ({design.billboardIds.length} من {selectedBillboards.length})
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 p-3 bg-muted/30 rounded-lg max-h-64 overflow-y-auto">
                    {selectedBillboards.map((billboard) => {
                      const isChecked = design.billboardIds.includes(billboard.id);
                      const billboardImage = (billboard as any).Image_URL || (billboard as any).image;
                      const billboardLocation = (billboard as any).Nearest_Landmark || (billboard as any).nearest_landmark;
                      
                      return (
                        <div
                          key={billboard.id}
                          onClick={() => toggleBillboard(design.id, billboard.id)}
                          className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:shadow-lg ${
                            isChecked ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="aspect-video w-full bg-muted flex items-center justify-center overflow-hidden">
                            {billboardImage ? (
                              <img
                                src={billboardImage}
                                alt={billboard.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = '/placeholder.svg';
                                }}
                              />
                            ) : (
                              <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                            )}
                          </div>
                          
                          <div className="p-2 bg-card">
                            <div className="flex items-start gap-2">
                              <Checkbox
                                checked={isChecked}
                                className="mt-0.5"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate text-card-foreground">
                                  {billboard.name}
                                </p>
                                {billboardLocation && (
                                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                    📍 {billboardLocation}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {isChecked && (
                            <div className="absolute top-2 right-2">
                              <Badge className="bg-primary text-primary-foreground shadow-lg">
                                ✓
                              </Badge>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-card-foreground mb-2 block">
                      تصميم الوجه الأمامي (A)
                    </Label>
                    <ImageUploadZone
                      value={design.designFaceA}
                      onChange={(url) => updateDesign(design.id, { designFaceA: url })}
                      imageName={`design-${contractId || 'temp'}-${design.id}-face-A`}
                      showUrlInput={true}
                      showPreview={true}
                      previewHeight="h-32"
                      dropZoneHeight="h-20"
                      label="اسحب أو انقر أو الصق تصميم الوجه الأمامي"
                    />
                  </div>

                  <div>
                    <Label className="text-card-foreground mb-2 block">
                      تصميم الوجه الخلفي (B)
                    </Label>
                    <ImageUploadZone
                      value={design.designFaceB}
                      onChange={(url) => updateDesign(design.id, { designFaceB: url })}
                      imageName={`design-${contractId || 'temp'}-${design.id}-face-B`}
                      showUrlInput={true}
                      showPreview={true}
                      previewHeight="h-32"
                      dropZoneHeight="h-20"
                      label="اسحب أو انقر أو الصق تصميم الوجه الخلفي"
                    />
                  </div>

                  <div>
                    <Label className="text-card-foreground mb-2 block">ملاحظات (اختياري)</Label>
                    <Input
                      type="text"
                      value={design.notes || ''}
                      onChange={(e) => updateDesign(design.id, { notes: e.target.value })}
                      placeholder="ملاحظات حول التصميم..."
                      className="bg-input border-border text-foreground"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {showPreview && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowPreview(null)}
          >
            <div className="bg-card rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-medium text-card-foreground">{showPreview.title}</h3>
                <Button size="sm" variant="ghost" onClick={() => setShowPreview(null)}>
                  إغلاق
                </Button>
              </div>
              <div className="p-4">
                <img
                  src={showPreview.url}
                  alt={showPreview.title}
                  className="w-full h-auto"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg';
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {groupedDesigns.length > 0 && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded mt-4">
            <div className="flex items-start gap-2">
              <ImageIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium mb-1">نصائح لإدارة التصاميم:</div>
                <ul className="text-xs space-y-1">
                  <li>• يمكنك إنشاء تصاميم متعددة وتعيين لوحات مختلفة لكل تصميم</li>
                  <li>• استخدم زر "الكل" لتطبيق تصميم على جميع اللوحات مرة واحدة</li>
                  <li>• انقر على كارت اللوحة لتبديل اختيار اللوحة - اللوحات المختارة تظهر بعلامة ✓</li>
                  <li>• يمكنك إدخال رابط التصميم أو رفع ملف من جهازك</li>
                  <li>• الملفات المرفوعة تُحفظ في مجلد public/designs/contract-id/</li>
                  <li>• انقر على الصورة لمعاينة التصميم بحجم كامل</li>
                </ul>
              </div>
            </div>
          </div>
        )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
