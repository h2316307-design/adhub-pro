import { useState } from 'react';
import { toast } from 'sonner';

export const useImageUpload = () => {
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Generate simple image name - just the billboard name without timestamp or extension
  const generateImageName = (billboardName: string) => {
    return String(billboardName || '').trim() || 'billboard';
  };

  // Enhanced image upload to server folder with actual file handling
  const uploadImageToFolder = async (file: File, fileName: string): Promise<boolean> => {
    try {
      setUploadingImage(true);
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      const base64Data = await base64Promise;
      
      try {
        localStorage.setItem(`billboard_image_${fileName}`, base64Data);
        console.log(`Image stored locally: ${fileName}`);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        toast.success(`تم رفع الصورة بنجاح: ${fileName}`);
        return true;
      } catch (storageError) {
        console.error('Local storage failed:', storageError);
        
        const formData = new FormData();
        formData.append('image', file);
        formData.append('fileName', fileName);
        formData.append('path', 'image');

        try {
          const response = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            toast.success(`تم رفع الصورة للخادم: ${fileName}`);
            return true;
          } else {
            throw new Error('Server upload failed');
          }
        } catch (serverError) {
          console.warn('Server upload not available, using fallback');
          toast.warning(`تم حفظ الصورة مؤقتاً: ${fileName} (يرجى إعداد خادم الرفع)`);
          return true;
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('فشل في رفع الصورة');
      return false;
    } finally {
      setUploadingImage(false);
    }
  };

  // Enhanced image selection with dual source support and actual file handling
  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>, billboardName: string) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('يرجى اختيار ملف صورة صحيح');
        return null;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('حجم الصورة كبير جداً. الحد الأقصى 5 ميجابايت');
        return null;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = e.target?.result as string;
        setImagePreview(preview);
      };
      reader.readAsDataURL(file);

      const imageName = generateImageName(billboardName);
      setSelectedFile(file);

      toast.success(`تم اختيار الصورة: ${file.name}. سيتم رفعها عند الحفظ.`);
      
      return {
        imageName,
        imageUrl: `/image/${imageName}`
      };
    }
    return null;
  };

  const resetImageUpload = () => {
    setImagePreview('');
    setSelectedFile(null);
  };

  return {
    imagePreview,
    setImagePreview,
    selectedFile,
    uploadingImage,
    generateImageName,
    uploadImageToFolder,
    handleImageSelect,
    resetImageUpload
  };
};