import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BillboardDesignUploaderProps {
  billboardId: number;
  billboardName: string;
  contractNumber: string;
  onDesignUploaded: (billboardId: number, faceType: 'a' | 'b', path: string) => void;
  currentDesignA?: string;
  currentDesignB?: string;
}

export const BillboardDesignUploader: React.FC<BillboardDesignUploaderProps> = ({
  billboardId,
  billboardName,
  contractNumber,
  onDesignUploaded,
  currentDesignA,
  currentDesignB
}) => {
  const [uploadingA, setUploadingA] = useState(false);
  const [uploadingB, setUploadingB] = useState(false);

  const handleFileUpload = async (file: File, faceType: 'a' | 'b') => {
    const setUploading = faceType === 'a' ? setUploadingA : setUploadingB;
    
    try {
      setUploading(true);

      // إنشاء اسم فريد للملف
      const fileExt = file.name.split('.').pop();
      const fileName = `contract-${contractNumber}-billboard-${billboardId}-face-${faceType}.${fileExt}`;
      const filePath = `/images/${fileName}`;

      // محاولة حفظ الملف في public/images
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', filePath);

      try {
        // محاولة الرفع عبر API endpoint
        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const fullPath = `${window.location.origin}${filePath}`;
          
          // حفظ المسار في قاعدة البيانات
          const columnName = faceType === 'a' ? 'design_face_a' : 'design_face_b';
          const { error } = await supabase
            .from('billboards')
            .update({ [columnName]: fullPath })
            .eq('ID', billboardId);

          if (error) throw error;

          onDesignUploaded(billboardId, faceType, fullPath);
          toast.success(`تم رفع تصميم الوجه ${faceType === 'a' ? 'الأمامي' : 'الخلفي'} بنجاح`);
        } else {
          throw new Error('فشل رفع الملف');
        }
      } catch (apiError) {
        // في حالة فشل API، استخدام base64
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64Data = e.target?.result as string;
          
          const columnName = faceType === 'a' ? 'design_face_a' : 'design_face_b';
          const { error } = await supabase
            .from('billboards')
            .update({ [columnName]: base64Data })
            .eq('ID', billboardId);

          if (error) throw error;

          onDesignUploaded(billboardId, faceType, base64Data);
          toast.success(`تم رفع تصميم الوجه ${faceType === 'a' ? 'الأمامي' : 'الخلفي'} (Base64)`);
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error('خطأ في رفع التصميم:', error);
      toast.error('فشل رفع التصميم');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveDesign = async (faceType: 'a' | 'b') => {
    try {
      const columnName = faceType === 'a' ? 'design_face_a' : 'design_face_b';
      const { error } = await supabase
        .from('billboards')
        .update({ [columnName]: null })
        .eq('ID', billboardId);

      if (error) throw error;

      onDesignUploaded(billboardId, faceType, '');
      toast.success(`تم حذف تصميم الوجه ${faceType === 'a' ? 'الأمامي' : 'الخلفي'}`);
    } catch (error) {
      console.error('خطأ في حذف التصميم:', error);
      toast.error('فشل حذف التصميم');
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <h4 className="font-medium mb-3 text-sm">{billboardName}</h4>
      
      <div className="grid grid-cols-2 gap-4">
        {/* الوجه الأمامي */}
        <div>
          <Label className="text-xs mb-2 block">الوجه الأمامي</Label>
          {currentDesignA ? (
            <div className="relative">
              <img 
                src={currentDesignA} 
                alt="الوجه الأمامي" 
                className="w-full h-24 object-cover rounded border"
              />
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="absolute top-1 right-1 h-6 w-6 p-0"
                onClick={() => handleRemoveDesign('a')}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="file"
                id={`design-a-${billboardId}`}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, 'a');
                }}
                disabled={uploadingA}
              />
              <label
                htmlFor={`design-a-${billboardId}`}
                className="flex items-center justify-center h-24 border-2 border-dashed rounded cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                {uploadingA && <span className="mr-2 text-xs">جاري الرفع...</span>}
              </label>
            </div>
          )}
        </div>

        {/* الوجه الخلفي */}
        <div>
          <Label className="text-xs mb-2 block">الوجه الخلفي</Label>
          {currentDesignB ? (
            <div className="relative">
              <img 
                src={currentDesignB} 
                alt="الوجه الخلفي" 
                className="w-full h-24 object-cover rounded border"
              />
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="absolute top-1 right-1 h-6 w-6 p-0"
                onClick={() => handleRemoveDesign('b')}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="file"
                id={`design-b-${billboardId}`}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, 'b');
                }}
                disabled={uploadingB}
              />
              <label
                htmlFor={`design-b-${billboardId}`}
                className="flex items-center justify-center h-24 border-2 border-dashed rounded cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                {uploadingB && <span className="mr-2 text-xs">جاري الرفع...</span>}
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
