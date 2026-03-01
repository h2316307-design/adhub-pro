import React, { useState, useRef, useCallback } from 'react';
import { Upload, Loader2, Link as LinkIcon, ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { uploadToImgbb } from '@/services/imgbbService';

interface ImageUploadZoneProps {
  /** Current image URL (for preview) */
  value?: string;
  /** Called with the uploaded/pasted image URL */
  onChange: (url: string) => void;
  /** Name used for imgbb upload naming */
  imageName?: string;
  /** Show URL input field */
  showUrlInput?: boolean;
  /** Placeholder for URL input */
  urlPlaceholder?: string;
  /** Label text */
  label?: string;
  /** Height of the drop zone */
  dropZoneHeight?: string;
  /** Show image preview */
  showPreview?: boolean;
  /** Preview height */
  previewHeight?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class for the container */
  className?: string;
}

export function ImageUploadZone({
  value,
  onChange,
  imageName = 'image',
  showUrlInput = true,
  urlPlaceholder = 'https://example.com/image.jpg',
  label = 'رفع صورة أو لصق (Ctrl+V)',
  dropZoneHeight = 'h-24',
  showPreview = true,
  previewHeight = 'h-32',
  disabled = false,
  className = '',
}: ImageUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useRef(`img-upload-${Math.random().toString(36).slice(2, 8)}`).current;

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صحيح');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن لا يتجاوز 10MB');
      return;
    }

    setUploading(true);
    try {
      const imageUrl = await uploadToImgbb(file, imageName);
      onChange(imageUrl);
      toast.success('تم رفع الصورة بنجاح');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('فشل رفع الصورة. تأكد من إعداد مفتاح API في الإعدادات.');
    } finally {
      setUploading(false);
    }
  }, [imageName, onChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (disabled || uploading) return;
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) await handleUpload(file);
          return;
        }
      }
    }
    // Check for pasted URL
    const text = e.clipboardData?.getData('text');
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      e.preventDefault();
      onChange(text.trim());
      toast.success('تم لصق رابط الصورة');
    }
  };

  return (
    <div className={`space-y-3 ${className}`} onPaste={handlePaste} tabIndex={0}>
      {/* Drop zone */}
      <div>
        {label && <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          id={inputId}
          onChange={handleFileSelect}
          disabled={disabled || uploading}
        />
        <div
          onClick={() => !(disabled || uploading) && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center ${dropZoneHeight} border-2 border-dashed rounded-lg cursor-pointer transition-all ${
            isDragOver
              ? 'border-primary bg-primary/10 scale-[1.02]'
              : 'border-border hover:bg-accent/50 hover:border-primary/50'
          } ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary mb-1" />
              <span className="text-xs text-muted-foreground">جاري الرفع...</span>
            </>
          ) : isDragOver ? (
            <>
              <Upload className="h-6 w-6 text-primary mb-1 animate-bounce" />
              <span className="text-xs text-primary font-medium">أفلت الصورة هنا</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">اسحب أو انقر أو الصق</span>
            </>
          )}
        </div>
      </div>

      {/* URL input */}
      {showUrlInput && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">أو رابط خارجي للصورة</Label>
          <div className="relative">
            <LinkIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={urlPlaceholder}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="text-sm h-9 font-mono pr-8"
              dir="ltr"
              disabled={disabled || uploading}
            />
          </div>
        </div>
      )}

      {/* Preview */}
      {showPreview && (
        <div className="flex items-center justify-center">
          {value ? (
            <div className={`w-full ${previewHeight} bg-muted rounded-lg overflow-hidden border border-border`}>
              <img
                src={value}
                alt="معاينة"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
              />
            </div>
          ) : (
            <div className={`w-full ${previewHeight} bg-muted/30 rounded-lg border-2 border-dashed border-border flex items-center justify-center`}>
              <div className="flex flex-col items-center gap-1">
                <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground">معاينة الصورة</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
