import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Image, Plus, Check, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';

interface PrintBackground {
  id: string;
  name: string;
  url: string;
  thumbnail_url?: string;
  category: string;
  is_default: boolean;
  usage_count: number;
}

interface BackgroundSelectorProps {
  value: string;
  onChange: (url: string) => void;
  compact?: boolean;
}

export function BackgroundSelector({ value, onChange, compact = false }: BackgroundSelectorProps) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // جلب الخلفيات
  const { data: backgrounds = [], isLoading } = useQuery({
    queryKey: ['print-backgrounds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('print_backgrounds')
        .select('*')
        .order('usage_count', { ascending: false });
      if (error) throw error;
      return (data || []) as PrintBackground[];
    },
  });

  // إضافة خلفية جديدة
  const addMutation = useMutation({
    mutationFn: async ({ name, url }: { name: string; url: string }) => {
      const { error } = await supabase
        .from('print_backgrounds')
        .insert({ name, url });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-backgrounds'] });
      toast.success('تم إضافة الخلفية');
      setShowAddDialog(false);
      setNewName('');
      setNewUrl('');
    },
    onError: () => {
      toast.error('فشل إضافة الخلفية');
    },
  });

  // حذف خلفية
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('print_backgrounds')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-backgrounds'] });
      toast.success('تم حذف الخلفية');
    },
  });

  // تحديث عداد الاستخدام
  const updateUsage = async (id: string) => {
    await supabase
      .from('print_backgrounds')
      .update({ usage_count: backgrounds.find(b => b.id === id)?.usage_count || 0 + 1 })
      .eq('id', id);
  };

  const handleSelect = (bg: PrintBackground) => {
    onChange(bg.url);
    updateUsage(bg.id);
  };

  const currentBg = backgrounds.find(b => b.url === value);

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <Image className="h-3 w-3" />
            <span className="text-xs truncate max-w-[100px]">
              {currentBg?.name || 'اختر خلفية'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2" align="start" dir="rtl">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">الخلفيات</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-3 w-3 ml-1" />
                إضافة
              </Button>
            </div>
            
            <ScrollArea className="h-[200px]">
              <div className="grid grid-cols-3 gap-2">
                {/* خيار بدون خلفية */}
                <button
                  onClick={() => onChange('')}
                  className={`aspect-[210/297] rounded border-2 flex items-center justify-center text-xs text-muted-foreground hover:bg-muted/50 ${
                    !value ? 'border-primary bg-primary/10' : 'border-dashed border-border'
                  }`}
                >
                  بدون
                </button>
                
                {backgrounds.map((bg) => (
                  <div
                    key={bg.id}
                    onClick={() => handleSelect(bg)}
                    className={`aspect-[210/297] rounded border-2 overflow-hidden relative group cursor-pointer ${
                      value === bg.url ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                    }`}
                  >
                    <img 
                      src={bg.thumbnail_url || bg.url} 
                      alt={bg.name}
                      className="w-full h-full object-cover"
                    />
                    {value === bg.url && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    {!bg.is_default && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(bg.id);
                        }}
                        className="absolute top-1 left-1 p-1 bg-destructive/80 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Trash2 className="h-2.5 w-2.5 text-destructive-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          
          {/* نافذة إضافة خلفية */}
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة خلفية جديدة</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>الاسم</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="مثال: خلفية زرقاء"
                  />
                </div>
                <ImageUploadZone
                  value={newUrl}
                  onChange={(url) => setNewUrl(url)}
                  imageName={`bg-${newName || 'background'}`}
                  label="رفع صورة الخلفية"
                  showUrlInput={true}
                  showPreview={true}
                  previewHeight="h-28"
                  dropZoneHeight="h-20"
                />
                <Button
                  onClick={() => addMutation.mutate({ name: newName, url: newUrl })}
                  disabled={!newName || !newUrl || addMutation.isPending}
                  className="w-full"
                >
                  {addMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'إضافة'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </PopoverContent>
      </Popover>
    );
  }

  // النسخة الكاملة
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">خلفية الطباعة</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-3 w-3 ml-1" />
          إضافة خلفية
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <ScrollArea className="h-[150px]">
          <div className="grid grid-cols-4 gap-2">
            {/* خيار بدون خلفية */}
            <button
              onClick={() => onChange('')}
              className={`aspect-[210/297] rounded border-2 flex items-center justify-center text-xs text-muted-foreground hover:bg-muted/50 ${
                !value ? 'border-primary bg-primary/10' : 'border-dashed border-border'
              }`}
            >
              بدون خلفية
            </button>
            
            {backgrounds.map((bg) => (
              <div
                key={bg.id}
                onClick={() => handleSelect(bg)}
                className={`aspect-[210/297] rounded border-2 overflow-hidden relative group cursor-pointer ${
                  value === bg.url ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                }`}
                title={bg.name}
              >
                <img 
                  src={bg.thumbnail_url || bg.url} 
                  alt={bg.name}
                  className="w-full h-full object-cover"
                />
                {value === bg.url && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate">
                  {bg.name}
                </div>
                {!bg.is_default && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(bg.id);
                    }}
                    className="absolute top-1 left-1 p-1 bg-destructive/80 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3 text-destructive-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* نافذة إضافة خلفية */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة خلفية جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>الاسم</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: خلفية زرقاء"
              />
            </div>
            <ImageUploadZone
              value={newUrl}
              onChange={(url) => setNewUrl(url)}
              imageName={`bg-${newName || 'background'}`}
              label="رفع صورة الخلفية"
              showUrlInput={true}
              showPreview={true}
              previewHeight="h-28"
              dropZoneHeight="h-20"
            />
            <Button
              onClick={() => addMutation.mutate({ name: newName, url: newUrl })}
              disabled={!newName || !newUrl || addMutation.isPending}
              className="w-full"
            >
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'إضافة'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
