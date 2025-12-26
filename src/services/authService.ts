import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

// Input validation schemas - تدعم البريد الإلكتروني أو اسم المستخدم
const loginSchema = z.object({
  emailOrUsername: z.string().trim().min(1, 'يرجى إدخال البريد الإلكتروني أو اسم المستخدم').max(255, 'القيمة طويلة جداً'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل').max(100, 'كلمة المرور طويلة جداً'),
});

const registerSchema = z.object({
  email: z.string().trim().email('صيغة البريد الإلكتروني غير صحيحة').max(255, 'البريد الإلكتروني طويل جداً'),
  password: z.string()
    .min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل')
    .max(100, 'كلمة المرور طويلة جداً'),
  name: z.string().trim().min(1, 'الاسم مطلوب').max(100, 'الاسم طويل جداً'),
  username: z.string().trim().min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل').max(50, 'اسم المستخدم طويل جداً').optional(),
  phone: z.string().trim().max(20, 'رقم الهاتف طويل جداً').optional(),
  company: z.string().trim().max(100, 'اسم الشركة طويل جداً').optional(),
});

export interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  role: 'admin' | 'user';
  phone?: string;
  company?: string;
  pricingCategory?: string | null;
  allowedCustomers?: string[] | null;
  approved?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  permissions?: string[];
}

export interface LoginCredentials {
  email: string; // يمكن أن يكون بريد إلكتروني أو اسم مستخدم
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  username?: string;
  phone?: string;
  company?: string;
}

// تسجيل الدخول باستخدام Supabase Auth - يدعم البريد الإلكتروني أو اسم المستخدم
export const loginUser = async (credentials: LoginCredentials): Promise<{ user: User | null; error: string | null }> => {
  try {
    // Validate input
    const validation = loginSchema.safeParse({ 
      emailOrUsername: credentials.email, 
      password: credentials.password 
    });
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return { user: null, error: firstError.message };
    }

    const { emailOrUsername, password } = validation.data;
    let email = emailOrUsername;

    // التحقق إذا كان المدخل اسم مستخدم وليس بريد إلكتروني
    if (!emailOrUsername.includes('@')) {
      // البحث عن البريد الإلكتروني باستخدام اسم المستخدم
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', emailOrUsername)
        .maybeSingle();

      if (profileError || !profileData?.email) {
        return { user: null, error: 'اسم المستخدم غير موجود' };
      }
      email = profileData.email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      return { user: null, error: 'البريد الإلكتروني/اسم المستخدم أو كلمة المرور غير صحيحة' };
    }

    if (!data.user) {
      return { user: null, error: 'حدث خطأ أثناء تسجيل الدخول' };
    }

    // جلب بيانات المستخدم من profiles و user_roles
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .maybeSingle();

    // التحقق من موافقة الأدمن - تجاهل إذا لم يكن هناك profile بعد
    if (profileData) {
      if (profileData.status === 'pending') {
        await supabase.auth.signOut();
        return { user: null, error: 'حسابك قيد المراجعة. يرجى انتظار موافقة المدير.' };
      }

      if (profileData.status === 'rejected') {
        await supabase.auth.signOut();
        return { user: null, error: 'تم رفض حسابك. يرجى التواصل مع الإدارة.' };
      }
      
      // إذا كان الـ profile موجود ولم يتم الموافقة عليه بعد
      if (profileData.approved === false && profileData.status !== 'approved') {
        await supabase.auth.signOut();
        return { user: null, error: 'حسابك قيد المراجعة. يرجى انتظار موافقة المدير.' };
      }
    }

    // جلب الصلاحيات
    const { data: permissionsData } = await supabase
      .from('user_permissions')
      .select('permission')
      .eq('user_id', data.user.id);

    const user: User = {
      id: data.user.id,
      email: data.user.email || '',
      name: profileData?.name || '',
      username: profileData?.username || undefined,
      role: roleData?.role === 'admin' ? 'admin' : 'user',
      phone: profileData?.phone || undefined,
      company: profileData?.company || undefined,
      approved: profileData?.approved,
      status: profileData?.status as 'pending' | 'approved' | 'rejected',
      permissions: permissionsData?.map(p => p.permission) || [],
    };

    return { user, error: null };
  } catch (error: any) {
    console.error('Login error:', error);
    return { user: null, error: error.message || 'حدث خطأ أثناء تسجيل الدخول' };
  }
};

// تسجيل مستخدم جديد باستخدام Supabase Auth
export const registerUser = async (userData: RegisterData): Promise<{ user: User | null; error: string | null }> => {
  try {
    // Validate input
    const validation = registerSchema.safeParse(userData);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return { user: null, error: firstError.message };
    }

    const validatedData = validation.data;

    // التحقق من عدم وجود اسم المستخدم مسبقاً
    if (validatedData.username) {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', validatedData.username)
        .maybeSingle();
      
      if (existingUser) {
        return { user: null, error: 'اسم المستخدم مستخدم بالفعل' };
      }
    }

    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: validatedData.name,
          username: validatedData.username,
          phone: validatedData.phone,
          company: validatedData.company,
        }
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return { user: null, error: 'البريد الإلكتروني مستخدم بالفعل' };
      }
      return { user: null, error: error.message || 'حدث خطأ أثناء التسجيل' };
    }

    if (!data.user) {
      return { user: null, error: 'حدث خطأ أثناء إنشاء الحساب' };
    }

    // انتظار قصير لضمان تنفيذ triggers
    await new Promise(resolve => setTimeout(resolve, 500));

    // جلب بيانات المستخدم من profiles و user_roles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .maybeSingle();

    // إنشاء دور افتراضي إذا لم يكن موجوداً
    if (!roleData) {
      await supabase
        .from('user_roles')
        .insert({ user_id: data.user.id, role: 'user' });
    }

    // تحديث اسم المستخدم إذا تم توفيره
    if (validatedData.username && profileData) {
      await supabase
        .from('profiles')
        .update({ username: validatedData.username })
        .eq('id', data.user.id);
    }

    const user: User = {
      id: data.user.id,
      email: data.user.email || '',
      name: profileData?.name || userData.name,
      username: validatedData.username || profileData?.username,
      role: roleData?.role === 'admin' ? 'admin' : 'user',
      phone: profileData?.phone || userData.phone,
      company: profileData?.company || userData.company,
    };

    return { user, error: null };
  } catch (error: any) {
    console.error('Registration error:', error);
    return { user: null, error: error.message || 'حدث خطأ أثناء التسجيل' };
  }
};

// تسجيل الخروج
export const logoutUser = async (): Promise<void> => {
  await supabase.auth.signOut();
};

// الحصول على المستخدم الحالي
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    // جلب الصلاحيات
    const { data: permissionsData } = await supabase
      .from('user_permissions')
      .select('permission')
      .eq('user_id', user.id);

    return {
      id: user.id,
      email: user.email || '',
      name: profileData?.name || '',
      username: profileData?.username || undefined,
      role: roleData?.role === 'admin' ? 'admin' : 'user',
      phone: profileData?.phone || undefined,
      company: profileData?.company || undefined,
      approved: profileData?.approved,
      status: profileData?.status as 'pending' | 'approved' | 'rejected',
      permissions: permissionsData?.map(p => p.permission) || [],
    };
  } catch {
    return null;
  }
};

// التحقق من صلاحية المدير
export const isAdmin = (user: User | null): boolean => {
  return user?.role === 'admin';
};
