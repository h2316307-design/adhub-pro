import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MultiSelect from '@/components/ui/multi-select';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as UIDialog from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Printer, Edit2, Trash2, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function normalize(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const num = Number(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(num) ? null : num;
}

type MonthKeyAll = 'شهر واحد' | '2 أشهر' | '3 أشهر' | '6 أشهر' | 'سنة كاملة' | 'يوم واحد';

const MONTH_OPTIONS = [
  { key: 'شهر واحد', label: 'شهرياً', months: 1, dbColumn: 'one_month' },
  { key: '2 أشهر', label: 'كل شهرين', months: 2, dbColumn: '2_months' },
  { key: '3 أشهر', label: 'كل 3 أشهر', months: 3, dbColumn: '3_months' },
  { key: '6 أشهر', label: 'كل 6 أشهر', months: 6, dbColumn: '6_months' },
  { key: 'سنة كاملة', label: 'سنوي', months: 12, dbColumn: 'full_year' },
  { key: 'يوم واحد', label: 'يومي', months: 0, dbColumn: 'one_day' },
] as const;

type MonthKey = typeof MONTH_OPTIONS[number]['key'];

const PRIMARY_CUSTOMERS: string[] = ['عادي', 'مسوق', 'شركات'];
const PRIMARY_SENTINEL = '__primary__';

interface BillboardLevel {
  id: number;
  level_code: string;
  level_name: string;
  description: string | null;
  created_at: string;
}

interface PricingCategory {
  id: number;
  name: string;
  level: string;
  created_at: string;
}

interface PricingData {
  id: number;
  size: string;
  billboard_level: string;
  customer_category: string;
  one_month: number;
  '2_months': number;
  '3_months': number;
  '6_months': number;
  full_year: number;
  one_day: number;
}

interface SizeData {
  id: number;
  name: string;
  level?: string; // جعل level اختياري لأنه قد لا يكون موجود
}

export default function PricingList() {
  // البيانات من قاعدة البيانات
  const [levels, setLevels] = useState<BillboardLevel[]>([]);
  const [categories, setCategories] = useState<PricingCategory[]>([]);
  const [pricingData, setPricingData] = useState<PricingData[]>([]);
  const [sizesData, setSizesData] = useState<SizeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // استخراج المستويات المتاحة - أولوية للبيانات الموجودة في الجداول
  const allLevels = useMemo(() => {
    const levelSet = new Set<string>();
    
    // استخراج من المقاسات والفئات والأسعار (البيانات الموجودة فعلاً)
    if (sizesData.length > 0 && sizesData[0].level) {
      sizesData.forEach(s => s.level && levelSet.add(s.level));
    }
    categories.forEach(c => levelSet.add(c.level));
    pricingData.forEach(p => levelSet.add(p.billboard_level));
    
    // إضافة من جدول المستويات إذا كان متاحاً
    levels.forEach(l => levelSet.add(l.level_code));
    
    const result = Array.from(levelSet).sort();
    console.log('📊 المستويات المتاحة:', result);
    return result;
  }, [levels, sizesData, categories, pricingData]);

  const [selectedLevel, setSelectedLevel] = useState<string>('A');
  const [selectedMonthKey, setSelectedMonthKey] = useState<MonthKey>('شهر واحد');
  const [sizeFilter, setSizeFilter] = useState<string[]>([]);
  const [otherCustomer, setOtherCustomer] = useState<string>(PRIMARY_SENTINEL);

  const [editing, setEditing] = useState<{ size: string; customer: string; month: MonthKeyAll } | null>(null);

  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addSizeOpen, setAddSizeOpen] = useState(false);
  const [selectedNewSize, setSelectedNewSize] = useState('');
  const [newSizeName, setNewSizeName] = useState(''); // إضافة حقل لإدخال مقاس جديد
  const [addLevelOpen, setAddLevelOpen] = useState(false);
  const [newLevelCode, setNewLevelCode] = useState('');
  const [newLevelName, setNewLevelName] = useState('');
  const [deleteLevelOpen, setDeleteLevelOpen] = useState(false);
  const [deletingLevel, setDeletingLevel] = useState<string | null>(null);

  // إضافة حالات حذف المقاس
  const [deleteSizeOpen, setDeleteSizeOpen] = useState(false);
  const [deletingSize, setDeletingSize] = useState<string | null>(null);

  const [printOpen, setPrintOpen] = useState(false);
  const [printCategory, setPrintCategory] = useState<string>(PRIMARY_SENTINEL);

  // حالات التعديل والحذف
  const [editCatOpen, setEditCatOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PricingCategory | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [deleteCatOpen, setDeleteCatOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<PricingCategory | null>(null);

  // تحميل البيانات من قاعدة البيانات
  const loadData = async () => {
    try {
      setLoading(true);
      setConnectionError(null);

      console.log('🔄 بدء تحميل البيانات من قاعدة البيانات...');

      // اختبار الاتصال بقاعدة البيانات أولاً
      const { data: testData, error: testError } = await supabase
        .from('billboard_levels')
        .select('count', { count: 'exact', head: true });

      if (testError) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', testError);
        setConnectionError(`خطأ في الاتصال: ${testError.message}`);
        return;
      }

      console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');

      // تحميل المستويات من جدول billboard_levels
      console.log('📊 تحميل المستويات...');
      const { data: levelsData, error: levelsError } = await supabase
        .from('billboard_levels')
        .select('*')
        .order('level_code');

      if (levelsError) {
        console.error('❌ خطأ في تحميل المستويات:', levelsError);
        console.log('⚠️ سيتم استخراج المستويات من البيانات الموجودة');
      } else {
        console.log('✅ تم تحميل المستويات:', levelsData?.length || 0, 'مستوى');
        if (levelsData && levelsData.length > 0) {
          console.table(levelsData);
        }
        setLevels(levelsData || []);
      }

      // تحميل الفئات من جدول pricing_categories
      console.log('📋 تحميل الفئات...');
      const { data: categoriesData, error: catError } = await supabase
        .from('pricing_categories')
        .select('*')
        .order('level, name');

      if (catError) {
        console.error('❌ خطأ في تحميل الفئات:', catError);
        toast.error(`فشل في تحميل الفئات: ${catError.message}`);
      } else {
        console.log('✅ تم تحميل الفئات:', categoriesData?.length || 0, 'فئة');
        if (categoriesData && categoriesData.length > 0) {
          console.table(categoriesData);
        }
        setCategories(categoriesData || []);
      }

      // محاولة تحميل المقاسات من جدول sizes (إذا كان موجود)
      console.log('📏 محاولة تحميل المقاسات...');
      const { data: sizesData, error: sizesError } = await supabase
        .from('sizes')
        .select('*')
        .order('name');

      if (sizesError) {
        console.error('❌ خطأ في تحميل المقاسات من جدول sizes:', sizesError);
        console.log('⚠️ سيتم استخراج المقاسات من جدول الأسعار');
        setSizesData([]);
      } else {
        console.log('✅ تم تحميل المقاسات:', sizesData?.length || 0, 'مقاس');
        setSizesData(sizesData || []);
      }

      // تحميل بيانات الأسعار
      console.log('💰 تحميل الأسعار...');
      const { data: pricingData, error: pricingError } = await supabase
        .from('pricing')
        .select('*')
        .order('billboard_level, customer_category, size');

      if (pricingError) {
        console.error('❌ خطأ في تحميل الأسعار:', pricingError);
        toast.error(`فشل في تحميل الأسعار: ${pricingError.message}`);
      } else {
        console.log('✅ تم تحميل الأسعار:', pricingData?.length || 0, 'سعر');
        setPricingData(pricingData || []);
      }

      console.log('🎉 تم الانتهاء من تحميل جميع البيانات');

    } catch (error) {
      console.error('💥 خطأ عام في الاتصال بقاعدة البيانات:', error);
      setConnectionError(`خطأ عام: ${error}`);
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // تحميل البيانات عند بدء التشغيل
  useEffect(() => {
    loadData();
  }, []);

  // تحديث المستوى المحدد عند تحميل البيانات
  useEffect(() => {
    if (allLevels.length > 0 && !allLevels.includes(selectedLevel)) {
      setSelectedLevel(allLevels[0]);
      console.log('🔄 تم تغيير المستوى المحدد إلى:', allLevels[0]);
    }
  }, [allLevels, selectedLevel]);

  // إضافة مستوى جديد
  const addNewLevel = async () => {
    const levelCode = newLevelCode.trim().toUpperCase();
    const levelName = newLevelName.trim();
    
    if (!levelCode || !levelName) {
      toast.error('يرجى إدخال كود واسم المستوى');
      return;
    }

    if (allLevels.includes(levelCode)) {
      toast.error('هذا المستوى موجود بالفعل');
      return;
    }

    try {
      // إضافة المستوى الجديد إلى جدول billboard_levels
      const { error: levelError } = await supabase
        .from('billboard_levels')
        .insert([{ 
          level_code: levelCode, 
          level_name: levelName,
          description: `مستوى ${levelName}`
        }]);

      if (levelError) {
        console.error('خطأ في إضافة المستوى:', levelError);
        toast.error('حدث خطأ في إضافة المستوى');
        return;
      }

      // إضافة فئة أساسية للمستوى الجديد
      const { error: catError } = await supabase
        .from('pricing_categories')
        .insert([{ name: 'المدينة', level: levelCode }]);

      if (catError) {
        console.error('خطأ في إضافة الفئة:', catError);
      }

      // إعادة تحميل البيانات
      await loadData();
      
      setSelectedLevel(levelCode);
      setAddLevelOpen(false);
      setNewLevelCode('');
      setNewLevelName('');
      toast.success(`تم إضافة المستوى ${levelCode} بنجاح`);
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // حذف مستوى
  const deleteLevel = async () => {
    if (!deletingLevel) return;

    try {
      // حذف جميع الأسعار للمستوى
      const { error: pricingError } = await supabase
        .from('pricing')
        .delete()
        .eq('billboard_level', deletingLevel);

      if (pricingError) {
        console.error('خطأ في حذف الأسعار:', pricingError);
      }

      // حذف جميع الفئات للمستوى
      const { error: catError } = await supabase
        .from('pricing_categories')
        .delete()
        .eq('level', deletingLevel);

      if (catError) {
        console.error('خطأ في حذف الفئات:', catError);
      }

      // حذف المستوى من جدول billboard_levels إذا كان موجوداً
      const levelObj = levels.find(l => l.level_code === deletingLevel);
      if (levelObj) {
        const { error: levelError } = await supabase
          .from('billboard_levels')
          .delete()
          .eq('id', levelObj.id);

        if (levelError) {
          console.error('خطأ في حذف المستوى:', levelError);
        }
      }

      // إعادة تحميل البيانات
      await loadData();

      // تغيير المستوى المحدد إذا كان المحذوف
      if (selectedLevel === deletingLevel) {
        setSelectedLevel(allLevels.find(l => l !== deletingLevel) || 'A');
      }

      setDeleteLevelOpen(false);
      setDeletingLevel(null);
      toast.success(`تم حذف المستوى ${deletingLevel} بنجاح`);
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // دالة حذف المقاس من قائمة الأسعار
  const deleteSize = async () => {
    if (!deletingSize) return;

    try {
      console.log('🗑️ بدء حذف المقاس من قائمة الأسعار...');
      console.log('📏 المقاس المحدد للحذف:', deletingSize);
      console.log('📊 المستوى المحدد:', selectedLevel);

      // حذف جميع الأسعار للمقاس في المستوى المحدد
      const { error } = await supabase
        .from('pricing')
        .delete()
        .eq('size', deletingSize)
        .eq('billboard_level', selectedLevel);

      if (error) {
        console.error('❌ خطأ في حذف المقاس من قائمة الأسعار:', error);
        toast.error(`حدث خطأ في حذف المقاس: ${error.message}`);
        return;
      }

      console.log('✅ تم حذف المقاس من قائمة الأسعار بنجاح');

      // إعادة تحميل البيانات
      await loadData();
      
      setDeleteSizeOpen(false);
      setDeletingSize(null);
      toast.success(`تم حذف المقاس ${deletingSize} من قائمة الأسعار بنجاح`);
    } catch (error) {
      console.error('💥 خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  const saveNewCategory = async () => {
    const name = newCatName.trim();
    if (!name) {
      toast.error('يرجى إدخال اسم الفئة');
      return;
    }
    
    if (PRIMARY_CUSTOMERS.includes(name)) { 
      toast.error('لا يمكن استخدام اسم فئة أساسية');
      return; 
    }

    try {
      // التحقق من وجود الفئة بالفعل
      const { data: existing } = await supabase
        .from('pricing_categories')
        .select('id')
        .eq('name', name)
        .eq('level', selectedLevel)
        .maybeSingle();

      if (existing) {
        toast.error(`الفئة "${name}" موجودة بالفعل في المستوى ${selectedLevel}`);
        return;
      }

      // حفظ في قاعدة البيانات
      const { error } = await supabase
        .from('pricing_categories')
        .insert([{ name, level: selectedLevel }]);

      if (error) {
        console.error('خطأ في حفظ الفئة:', error);
        if (error.code === '23505') {
          toast.error(`الفئة "${name}" موجودة بالفعل في المستوى ${selectedLevel}`);
        } else {
          toast.error(`حدث خطأ في حفظ الفئة: ${error.message}`);
        }
        return;
      }

      // إعادة تحميل البيانات
      await loadData();
      
      setOtherCustomer(name);
      setAddCatOpen(false);
      setNewCatName('');
      toast.success(`تم إضافة الفئة "${name}" بنجاح`);
    } catch (error: any) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error(`حدث خطأ: ${error?.message || 'خطأ غير معروف'}`);
    }
  };

  // إصلاح دالة حفظ مقاس جديد - إضافة إلى جدول الأسعار
  const saveNewSize = async () => {
    let sz = selectedNewSize.trim() || newSizeName.trim();
    if (!sz) {
      toast.error('يرجى اختيار مقاس أو إدخال مقاس جديد');
      return;
    }

    try {
      console.log('🔄 بدء إضافة المقاس إلى قائمة الأسعار...');
      console.log('📏 المقاس المحدد:', sz);
      console.log('📊 المستوى المحدد:', selectedLevel);

      // الحصول على جميع الفئات للمستوى المحدد (إزالة التكرار)
      const levelCategories = categories.filter(c => c.level === selectedLevel);
      const allCustomerCategories = Array.from(new Set([...PRIMARY_CUSTOMERS, ...levelCategories.map(c => c.name)]));

      console.log('👥 الفئات المتاحة:', allCustomerCategories);

      // التحقق من السجلات الموجودة
      const { data: existingPricing } = await supabase
        .from('pricing')
        .select('customer_category')
        .eq('size', sz)
        .eq('billboard_level', selectedLevel);

      const existingCategories = new Set(existingPricing?.map(p => p.customer_category) || []);
      
      // فقط الفئات التي لا توجد بالفعل
      const newCategories = allCustomerCategories.filter(cat => !existingCategories.has(cat));

      if (newCategories.length === 0) {
        toast.error('هذا المقاس موجود بالفعل لجميع الفئات في هذا المستوى');
        return;
      }

      console.log('➕ الفئات الجديدة للإضافة:', newCategories.length);

      // إنشاء سجلات أسعار للمقاس الجديد للفئات الجديدة فقط
      const pricingInserts = newCategories.map(category => ({
        size: sz,
        billboard_level: selectedLevel,
        customer_category: category,
        one_month: 0,
        '2_months': 0,
        '3_months': 0,
        '6_months': 0,
        full_year: 0,
        one_day: 0
      }));

      console.log('💰 إدراج أسعار جديدة:', pricingInserts.length, 'سجل');

      const { data, error } = await supabase
        .from('pricing')
        .upsert(pricingInserts, {
          onConflict: 'size,billboard_level,customer_category'
        })
        .select();

      if (error) {
        console.error('❌ خطأ في إضافة الأسعار:', error);
        toast.error(`حدث خطأ في إضافة المقاس: ${error.message}`);
        return;
      }

      console.log('✅ تم إضافة الأسعار بنجاح:', data?.length, 'سجل');

      // إعادة تحميل البيانات
      await loadData();
      
      setAddSizeOpen(false);
      setSelectedNewSize('');
      setNewSizeName('');
      toast.success(`تم إضافة المقاس ${sz} إلى قائمة الأسعار بنجاح`);
    } catch (error) {
      console.error('💥 خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // تعديل فئة موجودة
  const updateCategory = async () => {
    if (!editingCategory || !editCatName.trim()) return;

    const newName = editCatName.trim();
    
    if (PRIMARY_CUSTOMERS.includes(newName)) {
      toast.error('لا يمكن استخدام اسم فئة أساسية');
      return;
    }

    try {
      const { error } = await supabase
        .from('pricing_categories')
        .update({ name: newName })
        .eq('id', editingCategory.id);

      if (error) {
        console.error('خطأ في تحديث الفئة:', error);
        toast.error('حدث خطأ في تحديث الفئة');
        return;
      }

      // إعادة تحميل البيانات
      await loadData();

      // إذا كانت الفئة المحددة هي المحررة، قم بتحديثها
      if (otherCustomer === editingCategory.name) {
        setOtherCustomer(newName);
      }

      setEditCatOpen(false);
      setEditingCategory(null);
      setEditCatName('');
      toast.success('تم تحديث الفئة بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // حذف فئة
  const deleteCategory = async () => {
    if (!deletingCategory) return;

    try {
      // حذف الأسعار المرتبطة بالفئة أولاً
      const { error: pricingError } = await supabase
        .from('pricing')
        .delete()
        .eq('customer_category', deletingCategory.name);

      if (pricingError) {
        console.error('خطأ في حذف الأسعار المرتبطة:', pricingError);
      }

      // حذف الفئة
      const { error } = await supabase
        .from('pricing_categories')
        .delete()
        .eq('id', deletingCategory.id);

      if (error) {
        console.error('خطأ في حذف الفئة:', error);
        toast.error('حدث خطأ في حذف الفئة');
        return;
      }

      // إعادة تحميل البيانات
      await loadData();

      // إذا كانت الفئة المحذوفة محددة، قم بإعادة تعيينها للأساسية
      if (otherCustomer === deletingCategory.name) {
        setOtherCustomer(PRIMARY_SENTINEL);
      }

      setDeleteCatOpen(false);
      setDeletingCategory(null);
      toast.success('تم حذف الفئة بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // فتح نافذة التعديل
  const openEditCategory = (categoryName: string) => {
    const category = categories.find(c => c.name === categoryName);
    if (category) {
      setEditingCategory(category);
      setEditCatName(category.name);
      setEditCatOpen(true);
    }
  };

  // فتح نافذة الحذف
  const openDeleteCategory = (categoryName: string) => {
    const category = categories.find(c => c.name === categoryName);
    if (category) {
      setDeletingCategory(category);
      setDeleteCatOpen(true);
    }
  };

  // الحصول على المقاسات للمستوى المحدد مع الترتيب حسب sort_order
  const sizesForLevel = useMemo(() => {
    // الحصول على المقاسات من جدول الأسعار للمستوى المحدد
    const levelSizes = Array.from(new Set(
      pricingData
        .filter(p => p.billboard_level === selectedLevel)
        .map(p => p.size)
    ));
    
    // إنشاء خريطة لـ sort_order من جدول sizes
    const sizeOrderMap = new Map<string, number>();
    sizesData.forEach(s => {
      sizeOrderMap.set(s.name, s.id || 999); // استخدام id كـ sort_order افتراضي
    });
    
    // ترتيب المقاسات حسب sort_order
    const sortedSizes = levelSizes.sort((a, b) => {
      const orderA = sizeOrderMap.get(a) ?? 999;
      const orderB = sizeOrderMap.get(b) ?? 999;
      return orderA - orderB;
    });
    
    return sizeFilter.length ? sortedSizes.filter(s => sizeFilter.includes(s)) : sortedSizes;
  }, [selectedLevel, sizeFilter, pricingData, sizesData]);

  // الحصول على جميع المقاسات من جدول الأسعار
  const allSizes = useMemo(() => {
    return Array.from(new Set(pricingData.map(p => p.size)));
  }, [pricingData]);

  // الحصول على المقاسات المتاحة للإضافة - من جميع المقاسات الموجودة في النظام
  const availableSizesForLevel = useMemo(() => {
    console.log('🔍 بدء حساب المقاسات المتاحة للمستوى:', selectedLevel);
    
    // المقاسات الموجودة في قائمة الأسعار للمستوى الحالي
    const currentLevelSizes = Array.from(new Set(
      pricingData
        .filter(p => p.billboard_level === selectedLevel)
        .map(p => p.size)
    ));
    
    console.log('📊 المقاسات الموجودة في قائمة الأسعار للمستوى', selectedLevel, ':', currentLevelSizes);
    
    // جميع المقاسات الموجودة في النظام (من جدول الأسعار + جدول sizes)
    const allAvailableSizes = Array.from(new Set([
      ...pricingData.map(p => p.size),
      ...sizesData.map(s => s.name) // إضافة المقاسات من جدول sizes
    ]));
    
    console.log('📏 جميع المقاسات الموجودة في النظام:', allAvailableSizes);
    
    // المقاسات غير الموجودة في قائمة الأسعار للمستوى الحالي
    const availableSizes = allAvailableSizes.filter(size => !currentLevelSizes.includes(size));
    
    console.log('✅ المقاسات المتاحة للإضافة:', availableSizes);
    
    return availableSizes;
  }, [pricingData, sizesData, selectedLevel]);

  // عرض فئات المستوى المحدد فقط
  const otherCategories = useMemo(() => {
    console.log('🔍 جميع الفئات المحملة:', categories);
    console.log('📊 المستوى المحدد:', selectedLevel);
    
    // تصفية الفئات حسب المستوى المحدد
    const levelCategories = categories
      .filter(c => c.level === selectedLevel)
      .map(c => c.name);
    
    // إزالة التكرار
    const uniqueCategories = Array.from(new Set(levelCategories));
    
    console.log('📋 الفئات المتاحة للمستوى', selectedLevel, ':', uniqueCategories);
    return uniqueCategories;
  }, [categories, selectedLevel]);

  const getVal = (size: string, customer: string, month: MonthKeyAll): number | null => {
    // البحث في قاعدة البيانات
    const dbRow = pricingData.find(p => 
      p.size === size && 
      p.billboard_level === selectedLevel && 
      p.customer_category === customer
    );
    
    if (dbRow) {
      const monthOption = MONTH_OPTIONS.find(m => m.key === month);
      if (monthOption) {
        const value = (dbRow as any)[monthOption.dbColumn];
        return normalize(value);
      }
    }
    
    return null;
  };

  const setVal = async (size: string, customer: string, month: MonthKeyAll, value: number | null) => {
    try {
      const monthOption = MONTH_OPTIONS.find(m => m.key === month);
      if (!monthOption) return;

      // البحث عن السجل الموجود
      const existingRow = pricingData.find(p => 
        p.size === size && 
        p.billboard_level === selectedLevel && 
        p.customer_category === customer
      );

      const updateData = {
        [monthOption.dbColumn]: value || 0
      };

      if (existingRow) {
        // تحديث السجل الموجود
        const { error } = await supabase
          .from('pricing')
          .update(updateData)
          .eq('id', existingRow.id);

        if (error) {
          console.error('خطأ في تحديث السعر:', error);
          toast.error(`حدث خطأ في تحديث السعر: ${error.message}`);
          return;
        }

        // تحديث البيانات المحلية
        setPricingData(prev => prev.map(p => 
          p.id === existingRow.id 
            ? { ...p, ...updateData }
            : p
        ));
      } else {
        // إنشاء سجل جديد
        const newRow = {
          size,
          billboard_level: selectedLevel,
          customer_category: customer,
          one_month: monthOption.dbColumn === 'one_month' ? (value || 0) : 0,
          '2_months': monthOption.dbColumn === '2_months' ? (value || 0) : 0,
          '3_months': monthOption.dbColumn === '3_months' ? (value || 0) : 0,
          '6_months': monthOption.dbColumn === '6_months' ? (value || 0) : 0,
          full_year: monthOption.dbColumn === 'full_year' ? (value || 0) : 0,
          one_day: monthOption.dbColumn === 'one_day' ? (value || 0) : 0
        };

        const { data, error } = await supabase
          .from('pricing')
          .insert([newRow])
          .select()
          .single();

        if (error) {
          console.error('خطأ في إضافة السعر:', error);
          toast.error(`حدث خطأ في إضافة السعر: ${error.message}`);
          return;
        }

        // إضافة السجل الجديد للبيانات المحلية
        setPricingData(prev => [...prev, data]);
      }

      toast.success('تم حفظ السعر بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  const priceFor = (size: string, customer: string): string => {
    const v = getVal(size, customer, selectedMonthKey);
    return v == null ? '—' : `${v.toLocaleString()} د.ل`;
  };

  const buildPrintHtml = (cat: string) => {
    const cats = cat === PRIMARY_SENTINEL ? PRIMARY_CUSTOMERS : [cat];
    const today = new Date().toLocaleDateString('ar-LY');
    const selectedLevelName = levels.find(l => l.level_code === selectedLevel)?.level_name || selectedLevel;
    
    // إنشاء جداول لكل فترة
    const allMonthTables = MONTH_OPTIONS.map(monthOpt => {
      const rows = sizesForLevel.map(size => {
        const cols = cats.map(c => {
          const v = getVal(size, c, monthOpt.key);
          return v == null ? '—' : `${Number(v).toLocaleString('ar-LY')} د.ل`;
        }).join('</td><td class="price-cell">');
        return `<tr><td class="size-cell">${size}</td><td class="price-cell">${cols}</td></tr>`;
      }).join('');

      const headCols = cats.map(c=>`<th class="price-cell">${c}</th>`).join('');

      return `
        <div class="period-section">
          <div class="period-header">
            <div class="period-icon">📅</div>
            <h3 class="period-title">${monthOpt.label}</h3>
          </div>
          <table class="price-table">
            <thead>
              <tr><th class="size-cell">المقاس</th>${headCols}</tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>قائمة الأسعار - ${selectedLevelName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    body {
      font-family: 'Cairo', 'Tajawal', system-ui, sans-serif;
      color: #1a202c;
      background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
      padding: 20mm;
      line-height: 1.6;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%);
      padding: 35px 45px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 4px solid #1e40af;
      position: relative;
      overflow: hidden;
    }

    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
      border-radius: 50%;
    }

    .header-content {
      flex: 1;
      position: relative;
      z-index: 1;
    }

    .title {
      font-weight: 900;
      font-size: 34px;
      color: #ffffff;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }

    .subtitle {
      font-size: 18px;
      color: #dbeafe;
      font-weight: 600;
    }

    .header-info {
      text-align: left;
      background: rgba(255, 255, 255, 0.15);
      padding: 18px 28px;
      border-radius: 14px;
      backdrop-filter: blur(10px);
      position: relative;
      z-index: 1;
    }

    .date {
      font-size: 16px;
      color: #ffffff;
      font-weight: 700;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .level-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.95);
      color: #1e40af;
      padding: 8px 20px;
      border-radius: 24px;
      font-weight: 800;
      font-size: 15px;
      margin-top: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .content {
      padding: 45px;
    }

    .period-section {
      margin-bottom: 45px;
      page-break-inside: avoid;
      background: #ffffff;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    .period-section:last-child {
      margin-bottom: 0;
    }

    .period-header {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-right: 6px solid #3b82f6;
      padding: 20px 26px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .period-icon {
      font-size: 26px;
      line-height: 1;
    }

    .period-title {
      font-weight: 800;
      font-size: 24px;
      color: #1e293b;
      letter-spacing: -0.3px;
    }

    .price-table {
      width: 100%;
      border-collapse: collapse;
    }

    thead tr {
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    }

    th {
      padding: 18px 14px;
      text-align: center;
      font-weight: 800;
      font-size: 16px;
      color: #ffffff;
      border: 1px solid #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .size-cell {
      text-align: right;
      width: 140px;
    }

    thead .size-cell {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    }

    tbody tr {
      transition: all 0.2s ease;
    }

    tbody tr:nth-child(odd) {
      background: #ffffff;
    }

    tbody tr:nth-child(even) {
      background: #f8fafc;
    }

    tbody tr:hover {
      background: #eff6ff;
      transform: scale(1.005);
    }

    td {
      padding: 16px 14px;
      text-align: center;
      font-size: 15px;
      color: #475569;
      border: 1px solid #e2e8f0;
      font-weight: 600;
    }

    tbody .size-cell {
      font-weight: 800;
      text-align: right;
      background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
      color: #1e293b;
      font-size: 16px;
      border-left: 3px solid #3b82f6;
    }

    .price-cell {
      font-weight: 700;
      color: #1e40af;
      font-family: 'Cairo', monospace;
    }

    .footer {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 28px 45px;
      text-align: center;
      border-top: 3px solid #e2e8f0;
      margin-top: 25px;
    }

    .footer-text {
      font-size: 15px;
      color: #475569;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .footer-note {
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
    }

    .print-btn {
      padding: 16px 36px;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: #ffffff;
      border: none;
      border-radius: 12px;
      font-weight: 800;
      cursor: pointer;
      font-size: 17px;
      font-family: 'Cairo', sans-serif;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
      transition: all 0.3s ease;
      margin-top: 20px;
    }

    .print-btn:hover {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(59, 130, 246, 0.45);
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .container {
        box-shadow: none;
        border-radius: 0;
      }
      .print-btn {
        display: none;
      }
      .period-section {
        page-break-inside: avoid;
      }
      tbody tr:hover {
        transform: none;
      }
      @page {
        size: A4 portrait;
        margin: 12mm;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-content">
        <div class="title">📋 قائمة الأسعار</div>
        <div class="subtitle">أسعار الإيجار حسب المقاسات والفترات</div>
      </div>
      <div class="header-info">
        <div class="date">
          <span>📅</span>
          <span>${today}</span>
        </div>
        <div class="level-badge">المستوى ${selectedLevelName}</div>
      </div>
    </div>
    
    <div class="content">
      ${allMonthTables}
    </div>

    <div class="footer">
      <div class="footer-text">تم إنشاء هذه القائمة تلقائياً من نظام إدارة اللوحات الإعلانية</div>
      <div class="footer-note">هذه الأسعار قابلة للتغيير دون إشعار مسبق</div>
      <button class="print-btn" onclick="window.print()">🖨️ طباعة القائمة</button>
    </div>
  </div>
</body>
</html>`;
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(buildPrintHtml(printCategory));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  if (loading) {
    return (
      <div className="expenses-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل البيانات من قاعدة البيانات...</p>
          <p className="text-xs text-muted-foreground mt-2">يرجى فتح وحدة التحكم (F12) لمراقبة عملية التحميل</p>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-4">⚠️ خطأ في الاتصال بقاعدة البيانات</div>
          <p className="text-muted-foreground mb-4">{connectionError}</p>
          <Button onClick={loadData} variant="outline">
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  if (allLevels.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-yellow-600 text-lg mb-4">📊 لا توجد مستويات متاحة</div>
          <p className="text-muted-foreground mb-4">لم يتم العثور على أي مستويات في قاعدة البيانات</p>
          <Button onClick={() => setAddLevelOpen(true)} className="mr-2">
            إضافة مستوى جديد
          </Button>
          <Button onClick={loadData} variant="outline">
            إعادة تحميل البيانات
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="expenses-container">
      <Card className="bg-gradient-to-br from-card to-primary/10 border-0 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-primary">قائمة الأسعار</CardTitle>
              <p className="text-muted-foreground text-sm">
                إدارة أسعار اللوحات الإعلانية حسب المستوى والفئة
                <span className="ml-2 text-xs text-primary/70">
                  ({levels.length} مستوى، {categories.length} فئة، {allSizes.length} مقاس)
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {MONTH_OPTIONS.map(opt => (
                <button
                  key={`m-${opt.key}`}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all duration-200 ${selectedMonthKey === opt.key ? 'bg-primary text-primary-foreground border-primary shadow-lg' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                  onClick={() => setSelectedMonthKey(opt.key)}
                >
                  {opt.months === 1 ? 'شهرياً' : opt.months === 0 ? 'يومي' : opt.label}
                </button>
              ))}
              <div className="mx-3 h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Select value={otherCustomer} onValueChange={setOtherCustomer}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="فئة أخرى" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PRIMARY_SENTINEL}>الأساسية (عادي/مسوق/شركات)</SelectItem>
                    {otherCategories.map((c, index) => (
                      <SelectItem key={`cat-all-${index}-${c}`} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {otherCustomer !== PRIMARY_SENTINEL && otherCategories.includes(otherCustomer) && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditCategory(otherCustomer)}
                      title="تعديل الفئة"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => openDeleteCategory(otherCustomer)}
                      title="حذف الفئة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <Button variant="outline" className="ml-2" onClick={() => setAddCatOpen(true)}>إضافة فئة</Button>
              <Button variant="outline" onClick={() => setAddSizeOpen(true)}>إضافة مقاس</Button>
              <Button className="ml-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setPrintOpen(true)}>
                <Printer className="h-4 w-4 ml-2" /> طباعة الأسعار
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-50/20 to-primary/10 border border-primary/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold rounded-lg px-3 py-1 shadow-lg">
                مستوى {levels.find(l => l.level_code === selectedLevel)?.level_name || selectedLevel}
              </span>
              <span className="text-sm text-muted-foreground">
                أسعار الأحجام حسب فئة العميل ({sizesForLevel.length} مقاس، {otherCategories.length} فئة إضافية)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {allLevels.map((lvl, index) => (
                <button
                  key={`lvl-${index}-${lvl}`}
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all duration-200 ${lvl === selectedLevel ? 'bg-primary text-primary-foreground border-primary shadow-lg' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                  title={levels.find(l => l.level_code === lvl)?.level_name || lvl}
                >
                  {lvl}
                </button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddLevelOpen(true)}
                title="إضافة مستوى جديد"
                className="text-green-600 hover:text-green-700"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDeletingLevel(selectedLevel);
                  setDeleteLevelOpen(true);
                }}
                title="حذف المستوى"
                className="text-red-500 hover:text-red-700"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MultiSelect 
              options={allSizes.map((s, index) => ({ label: s, value: s }))} 
              value={sizeFilter} 
              onChange={setSizeFilter} 
              placeholder="تصفية الأحجام" 
            />
          </div>

          <div className="expenses-table-container">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="bg-muted/20 border-b border-border/30">
                  {(otherCustomer === PRIMARY_SENTINEL ? PRIMARY_CUSTOMERS : [otherCustomer]).map((c, index) => (
                    <th key={`head-${index}-${c}`} className="p-3 font-medium text-primary">{c}</th>
                  ))}
                  <th className="p-3 text-center w-32 bg-muted/20 font-medium text-primary">الحجم</th>
                </tr>
              </thead>
              <tbody>
                {sizesForLevel.map((size, sizeIndex) => (
                  <tr key={`size-${sizeIndex}-${size}`} className="border-b border-border/20 hover:bg-background/50">
                    {(otherCustomer === PRIMARY_SENTINEL ? PRIMARY_CUSTOMERS : [otherCustomer]).map((c, customerIndex) => {
                      const isEditing = editing && editing.size === size && editing.customer === c && editing.month === selectedMonthKey;
                      const current = getVal(size, c, selectedMonthKey);
                      return (
                        <td key={`col-${sizeIndex}-${customerIndex}-${c}`} className="p-3">
                          {isEditing ? (
                            <input
                              autoFocus
                              type="number"
                              className="w-24 rounded-md border px-2 py-1 bg-background"
                              defaultValue={current ?? ''}
                              onBlur={(e) => { 
                                const v = e.target.value.trim(); 
                                setVal(size, c, selectedMonthKey, v === '' ? null : Number(v)); 
                                setEditing(null); 
                              }}
                              onKeyDown={(e) => { 
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); 
                                if (e.key === 'Escape') setEditing(null); 
                              }}
                            />
                          ) : (
                            <button 
                              className="text-right w-full text-foreground hover:bg-muted/50 rounded px-2 py-1" 
                              onClick={() => setEditing({ size, customer: c, month: selectedMonthKey })}
                            >
                              {priceFor(size, c)}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-3 text-center font-semibold bg-muted/20">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-primary font-bold">{size}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 hover:text-red-700 p-1 h-6 w-6"
                          onClick={() => {
                            setDeletingSize(size);
                            setDeleteSizeOpen(true);
                          }}
                          title="حذف المقاس من قائمة الأسعار"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* نافذة إضافة مستوى جديد */}
      <UIDialog.Dialog open={addLevelOpen} onOpenChange={setAddLevelOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة مستوى جديد</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              أدخل كود واسم المستوى الجديد
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="expenses-dialog-form">
            <div>
              <label className="expenses-form-label">كود المستوى</label>
              <Input 
                placeholder="مثال: C, D, E" 
                value={newLevelCode} 
                onChange={e=>setNewLevelCode(e.target.value)}
                maxLength={2}
              />
            </div>
            <div>
              <label className="expenses-form-label">اسم المستوى</label>
              <Input 
                placeholder="مثال: ممتاز، جيد، عادي" 
                value={newLevelName} 
                onChange={e=>setNewLevelName(e.target.value)}
              />
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setAddLevelOpen(false)}>إلغاء</Button>
            <Button onClick={addNewLevel} disabled={!newLevelCode.trim() || !newLevelName.trim()}>إضافة</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة حذف المستوى */}
      <UIDialog.Dialog open={deleteLevelOpen} onOpenChange={setDeleteLevelOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تأكيد حذف المستوى</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              هذا الإجراء لا يمكن التراجع عنه
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              هل أنت متأكد من حذف المستوى <strong>"{deletingLevel}"</strong>؟ 
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                ⚠️ تحذير: سيتم حذف جميع المقاسات والأسعار والفئات المرتبطة بهذا المستوى نهائياً ولا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setDeleteLevelOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={deleteLevel}>حذف نهائياً</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة حذف المقاس */}
      <UIDialog.Dialog open={deleteSizeOpen} onOpenChange={setDeleteSizeOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تأكيد حذف المقاس</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              هذا الإجراء لا يمكن التراجع عنه
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              هل أنت متأكد من حذف المقاس <strong>"{deletingSize}"</strong> من قائمة الأسعار للمستوى <strong>"{selectedLevel}"</strong>؟ 
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                ⚠️ تحذير: سيتم حذف جميع الأسعار المرتبطة بهذا المقاس في هذا المستوى نهائياً ولا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setDeleteSizeOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={deleteSize}>حذف نهائياً</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة الطباعة */}
      <UIDialog.Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>طباعة الأسعار</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              اختر الفئة التي تريد طباعة أسعارها
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="grid gap-3">
            <Select value={printCategory} onValueChange={setPrintCategory}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الفئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PRIMARY_SENTINEL}>الأساسية (عادي/مسوق/شركات)</SelectItem>
                {otherCategories.map((c, index) => (
                  <SelectItem key={`print-${index}-${c}`} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setPrintOpen(false)}>إلغاء</Button>
            <Button onClick={handlePrint}>طباعة</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة إضافة فئة جديدة */}
      <UIDialog.Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة فئة جديدة</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              أدخل اسم الفئة الجديدة التي تريد إضافتها للمستوى {selectedLevel}
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <Input placeholder="اسم الفئة (مثال: المدينة)" value={newCatName} onChange={e=>setNewCatName(e.target.value)} />
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setAddCatOpen(false)}>إلغاء</Button>
            <Button onClick={saveNewCategory}>حفظ</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة تعديل الفئة */}
      <UIDialog.Dialog open={editCatOpen} onOpenChange={setEditCatOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تعديل الفئة</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              قم بتعديل اسم الفئة المحددة
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="expenses-dialog-form">
            <div>
              <label className="expenses-form-label">الاسم الحالي: {editingCategory?.name}</label>
            </div>
            <Input 
              placeholder="اسم الفئة الجديد" 
              value={editCatName} 
              onChange={e=>setEditCatName(e.target.value)}
              autoFocus
            />
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setEditCatOpen(false)}>إلغاء</Button>
            <Button onClick={updateCategory} disabled={!editCatName.trim()}>تحديث</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة تأكيد الحذف */}
      <UIDialog.Dialog open={deleteCatOpen} onOpenChange={setDeleteCatOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تأكيد الحذف</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              هذا الإجراء لا يمكن التراجع عنه
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              هل أنت متأكد من حذف الفئة <strong>"{deletingCategory?.name}"</strong>؟ 
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                ⚠️ تحذير: سيتم حذف جميع الأسعار المرتبطة بهذه الفئة نهائياً ولا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setDeleteCatOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={deleteCategory}>حذف نهائياً</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة إضافة مقاس - محدثة للعمل مع جدول الأسعار */}
      <UIDialog.Dialog open={addSizeOpen} onOpenChange={setAddSizeOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة مقاس جديد</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              اختر مقاس موجود أو أدخل مقاس جديد لإضافته للمستوى {selectedLevel}
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="expenses-dialog-form space-y-4">
            <div>
              <label className="expenses-form-label">اختر من المقاسات الموجودة</label>
              {availableSizesForLevel.length > 0 ? (
                <Select value={selectedNewSize} onValueChange={setSelectedNewSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر مقاس من المقاسات المتاحة" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSizesForLevel.map((size, index) => (
                      <SelectItem key={`available-size-${index}`} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">جميع المقاسات الموجودة في النظام مضافة بالفعل لهذا المستوى</p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border"></div>
              <span className="text-xs text-muted-foreground">أو</span>
              <div className="flex-1 h-px bg-border"></div>
            </div>
            
            <div>
              <label className="expenses-form-label">أدخل مقاس جديد</label>
              <Input 
                placeholder="مثال: 15x6, 9x4, إلخ..." 
                value={newSizeName} 
                onChange={e=>setNewSizeName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                سيتم إضافة هذا المقاس الجديد لجميع المستويات في النظام
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>{setAddSizeOpen(false); setSelectedNewSize(''); setNewSizeName('');}}>إلغاء</Button>
            <Button 
              onClick={saveNewSize} 
              disabled={!selectedNewSize.trim() && !newSizeName.trim()}
            >
              حفظ
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>
    </div>
  );
}