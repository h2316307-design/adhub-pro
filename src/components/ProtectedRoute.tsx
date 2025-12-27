import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requiredPermission?: string;
}

export const ProtectedRoute = ({ children, requireAdmin = false, requiredPermission }: ProtectedRouteProps) => {
  const { user, loading, isAdmin, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // المدير يمكنه الوصول لكل شيء
  if (isAdmin) {
    return <>{children}</>;
  }

  // إذا كانت الصفحة تتطلب مدير فقط ولا يوجد صلاحية محددة
  if (requireAdmin && !requiredPermission) {
    // إذا كان المستخدم لديه أي صلاحيات، اسمح له بالدخول لمنطقة الإدارة
    if ((location.pathname === '/admin' || location.pathname === '/dashboard') && (user.permissions?.length ?? 0) > 0) {
      return <>{children}</>;
    }

    // تحقق من الصلاحيات بناءً على المسار
    const pathPermissionMap: Record<string, string> = {
      '/dashboard': 'dashboard',
      '/admin': 'dashboard',
      '/admin/billboards': 'billboards',
      '/admin/contracts': 'contracts',
      '/admin/customers': 'customers',
      '/admin/customer-billing': 'customer_billing',
      '/admin/reports': 'reports',
      '/admin/tasks': 'tasks',
      '/admin/installation-tasks': 'installation_tasks',
      '/admin/print-tasks': 'print_tasks',
      '/admin/expenses': 'expenses',
      '/admin/expense-management': 'expenses',
      '/admin/salaries': 'salaries',
      '/admin/custody-management': 'custody',
      '/admin/settings': 'settings',
      '/admin/users': 'users',
      '/admin/roles': 'roles',
      '/admin/pricing': 'pricing',
      '/admin/offers': 'offers',
    };

    // 1) تطابق كامل للمسار
    const exactPerm = pathPermissionMap[location.pathname];
    if (exactPerm && hasPermission(exactPerm)) {
      return <>{children}</>;
    }

    // 2) تطابق بادئة (الأطول أولاً) مع تجنب سماح /admin لكل الصفحات
    const prefixMatch = Object.entries(pathPermissionMap)
      .filter(([path]) => path !== '/admin' && path !== '/dashboard')
      .filter(([path]) => location.pathname.startsWith(path + '/'))
      .sort((a, b) => b[0].length - a[0].length)[0];

    if (prefixMatch && hasPermission(prefixMatch[1])) {
      return <>{children}</>;
    }

    return <Navigate to="/" replace />;
  }

  // إذا كانت هناك صلاحية محددة مطلوبة
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};