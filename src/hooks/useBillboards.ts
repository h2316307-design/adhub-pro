import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Billboard } from '@/types';
import { fetchAllBillboards } from '@/services/supabaseService';

export const useBillboards = () => {
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBillboards = async () => {
    try {
      const data = await fetchAllBillboards();
      setBillboards(data as any);
      console.log('Loaded billboards (with fallbacks):', data.length);
    } catch (error) {
      console.error('خطأ في تحميل اللوحات:', (error as any)?.message || JSON.stringify(error));
      setBillboards([] as any);
    }
  };

  // ✅ إنشاء نافذة تأكيد مخصصة بنمط النظام
  const showSystemConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // إنشاء عنصر النافذة المنبثقة
      const overlay = document.createElement('div');
      overlay.className = 'custom-confirm-overlay';
      
      const dialog = document.createElement('div');
      dialog.className = 'custom-confirm-dialog';
      
      dialog.innerHTML = `
        <div class="system-dialog-header">
          <h3 class="system-dialog-title">${title}</h3>
        </div>
        <div class="system-dialog-content">
          <p style="white-space: pre-line; line-height: 1.6; margin-bottom: 20px;">${message}</p>
          <div class="system-dialog-buttons">
            <button class="system-btn-secondary" id="cancel-btn">إلغاء</button>
            <button class="system-btn-primary" id="confirm-btn">حذف</button>
          </div>
        </div>
      `;
      
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      
      const cleanup = () => {
        document.body.removeChild(overlay);
        document.body.style.overflow = 'unset';
      };
      
      const confirmBtn = dialog.querySelector('#confirm-btn');
      const cancelBtn = dialog.querySelector('#cancel-btn');
      
      confirmBtn?.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });
      
      cancelBtn?.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
      
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(false);
        }
      });
      
      // إضافة دعم مفتاح Escape
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup();
          resolve(false);
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    });
  };

  const deleteBillboard = async (billboardId: number) => {
    try {
      // ✅ التحقق من وجود المعرف أولاً
      if (!billboardId) {
        toast.error('معرف اللوحة مفقود');
        return false;
      }

      // ✅ تحسين رسالة التأكيد
      const billboard = billboards.find(b => (b.ID || (b as any).id) == billboardId);
      const billboardName = billboard?.Billboard_Name || `اللوحة رقم ${billboardId}`;
      
      const confirmed = await showSystemConfirm(
        'تأكيد حذف اللوحة',
        `هل تريد حذف "${billboardName}"؟\n\nتحذير: هذا الإجراء لا يمكن التراجع عنه!`
      );
      
      if (!confirmed) {
        return false;
      }
      
      // ✅ التأكد من صحة المعرف وتحويله
      const id = Number(billboardId);
      if (!id || isNaN(id) || id <= 0) {
        toast.error('معرف اللوحة غير صحيح');
        console.error('❌ Invalid billboard ID:', billboardId);
        return false;
      }

      console.log('🗑️ Attempting to delete billboard with ID:', id);
      
      // ✅ استخدام RPC function للحذف الآمن
      const { data, error } = await supabase.rpc('safe_delete_billboard', {
        input_billboard_id: id
      }) as any;
      
      if (error) {
        console.error('❌ Delete error:', error);
        
        // ✅ معالجة أفضل للأخطاء
        if (error.code === '23503') {
          toast.error('لا يمكن حذف هذه اللوحة لأنها مرتبطة بعقود أو بيانات أخرى');
        } else if (error.code === '42703') {
          toast.error('خطأ في بنية قاعدة البيانات - يرجى الاتصال بالدعم الفني');
        } else if (error.code === 'PGRST116') {
          toast.error('لا توجد لوحة بهذا المعرف');
        } else if (error.message?.includes('WHERE')) {
          toast.error('خطأ في استعلام قاعدة البيانات - يرجى المحاولة مرة أخرى');
        } else if (error.message?.includes('function delete_billboard_safe')) {
          // Fallback to direct delete if RPC function doesn't exist
          return await deleteBillboardDirect(id, billboardName);
        } else {
          toast.error(`فشل في حذف اللوحة: ${error.message}`);
        }
        return false;
      }
      
      console.log('✅ Billboard deleted successfully via RPC');
      toast.success(`تم حذف "${billboardName}" بنجاح`);
      await loadBillboards();
      return true;
    } catch (error: any) {
      console.error('❌ Delete billboard error:', error);
      // Fallback to direct delete
      const id = Number(billboardId);
      const billboard = billboards.find(b => (b.ID || (b as any).id) == billboardId);
      const billboardName = billboard?.Billboard_Name || `اللوحة رقم ${billboardId}`;
      return await deleteBillboardDirect(id, billboardName);
    }
  };

  // ✅ Fallback direct delete method
  const deleteBillboardDirect = async (id: number, billboardName: string) => {
    try {
      console.log('🔄 Trying direct delete method for ID:', id);
      
      // Method 1: Try with exact match
      const { error: deleteError, count } = await supabase
        .from('billboards')
        .delete({ count: 'exact' })
        .match({ ID: id });
      
      if (!deleteError) {
        if (count === 0) {
          toast.error('لم يتم العثور على اللوحة المطلوب حذفها');
          return false;
        }
        console.log('✅ Billboard deleted successfully via direct method, count:', count);
        toast.success(`تم حذف "${billboardName}" بنجاح`);
        await loadBillboards();
        return true;
      }
      
      console.error('❌ Direct delete failed:', deleteError);
      toast.error(`فشل في حذف اللوحة: ${deleteError.message}`);
      return false;
    } catch (error: any) {
      console.error('❌ Direct delete error:', error);
      toast.error(error?.message || 'فشل في حذف اللوحة');
      return false;
    }
  };

  useEffect(() => {
    loadBillboards();
  }, []);

  return {
    billboards,
    loading,
    setLoading,
    loadBillboards,
    deleteBillboard
  };
};