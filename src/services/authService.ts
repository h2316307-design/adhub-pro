import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

// Input validation schemas
const loginSchema = z.object({
  email: z.string().trim().email('Invalid email format').max(255, 'Email too long'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password too long'),
});

const registerSchema = z.object({
  email: z.string().trim().email('Invalid email format').max(255, 'Email too long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  phone: z.string().trim().max(20, 'Phone number too long').optional(),
  company: z.string().trim().max(100, 'Company name too long').optional(),
});

export interface User {
  id: string;
  email: string;
  name: string;
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
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  company?: string;
}

// تسجيل الدخول باستخدام Supabase Auth
export const loginUser = async (credentials: LoginCredentials): Promise<{ user: User | null; error: string | null }> => {
  try {
    // Validate input
    const validation = loginSchema.safeParse(credentials);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return { user: null, error: firstError.message };
    }

    const validatedData = validation.data;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    if (error) {
      return { user: null, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
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

    // التحقق من موافقة الأدمن
    if (profileData?.status === 'pending' || !profileData?.approved) {
      await supabase.auth.signOut();
      return { user: null, error: 'حسابك قيد المراجعة. يرجى انتظار موافقة المدير.' };
    }

    if (profileData?.status === 'rejected') {
      await supabase.auth.signOut();
      return { user: null, error: 'تم رفض حسابك. يرجى التواصل مع الإدارة.' };
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
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: validatedData.name,
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

    const user: User = {
      id: data.user.id,
      email: data.user.email || '',
      name: profileData?.name || userData.name,
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
