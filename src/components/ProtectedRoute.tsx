/**
 * ProtectedRoute - Role-Based Permission Guard
 * 
 * IMPORTANT: Permissions are role-based only. User-level permissions are deprecated.
 * Access is granted based on hasPermission(permissionName) derived from user's role.
 * Do NOT use isAdmin for access control - use hasPermission instead.
 */
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  /** @deprecated Use requiredPermission instead */
  requireAdmin?: boolean;
  requiredPermission?: string;
}

/**
 * Maps route paths to their required permission names.
 * Permission names must match EXACTLY what's stored in the role's permissions array.
 */
const PATH_PERMISSION_MAP: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/admin': 'dashboard',
  '/admin/billboards': 'billboards',
  '/admin/billboard-cleanup': 'billboards',
  '/admin/billboard-maintenance': 'billboards',
  '/admin/shared-billboards': 'billboards',
  '/admin/friend-billboards': 'billboards',
  '/admin/delayed-billboards': 'billboards',
  '/admin/extended-billboards': 'billboards',
  '/admin/contracts': 'contracts',
  '/admin/contracts/new': 'contracts',
  '/admin/contracts/edit': 'contracts',
  '/admin/contracts/view': 'contracts',
  '/admin/customers': 'customers',
  '/admin/customer-billing': 'customers',
  '/admin/customer-merge': 'customers',
  '/admin/overdue-payments': 'customers',
  '/admin/reports': 'reports',
  '/admin/tasks': 'tasks',
  '/admin/installation-tasks': 'installation_tasks',
  '/admin/removal-tasks': 'installation_tasks',
  '/admin/print-tasks': 'print_tasks',
  '/admin/cutout-tasks': 'print_tasks',
  '/admin/composite-tasks': 'tasks',
  '/admin/expenses': 'expenses',
  '/admin/expense-management': 'expenses',
  '/admin/salaries': 'salaries',
  '/admin/employees': 'salaries',
  '/admin/custody-management': 'custody',
  '/admin/settings': 'settings',
  '/admin/system-settings': 'settings',
  '/admin/print-settings': 'settings',
  '/admin/billboard-print-settings': 'settings',
  '/admin/billboard-print-settings-new': 'settings',
  '/admin/quick-print-settings': 'settings',
  '/admin/pdf-template-settings': 'settings',
  '/admin/contract-terms-settings': 'settings',
  '/admin/messaging-settings': 'settings',
  '/admin/currency-settings': 'settings',
  '/admin/database-backup': 'settings',
  '/admin/users': 'users',
  '/admin/roles': 'roles',
  '/admin/pricing': 'pricing',
  '/admin/pricing-factors': 'pricing',
  '/admin/offers': 'offers',
  '/admin/printers': 'printers',
  '/admin/printer-accounts': 'printers',
  '/admin/installation-teams': 'installation_teams',
  '/admin/installation-team-accounts': 'installation_teams',
  '/admin/booking-requests': 'booking_requests',
  '/admin/shared-companies': 'shared_companies',
  '/admin/friend-accounts': 'friend_accounts',
  '/admin/printed-invoices-page': 'invoices',
  '/admin/payments-receipts-page': 'payments',
  '/admin/revenue': 'revenue',
  '/admin/municipality-stickers': 'municipality_stickers',
};

/**
 * Get required permission for a given path.
 * First tries exact match, then prefix match (longest first).
 */
const getRequiredPermission = (pathname: string): string | null => {
  // 1) Exact match
  if (PATH_PERMISSION_MAP[pathname]) {
    return PATH_PERMISSION_MAP[pathname];
  }

  // 2) Prefix match (longest path first, excluding /admin and /dashboard base paths)
  const prefixMatch = Object.entries(PATH_PERMISSION_MAP)
    .filter(([path]) => path !== '/admin' && path !== '/dashboard')
    .filter(([path]) => pathname.startsWith(path + '/') || pathname.startsWith(path))
    .sort((a, b) => b[0].length - a[0].length)[0];

  return prefixMatch ? prefixMatch[1] : null;
};

export const ProtectedRoute = ({ children, requiredPermission }: ProtectedRouteProps) => {
  const { user, loading, hasPermission } = useAuth();
  const location = useLocation();

  // Wait for auth to complete loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not logged in - redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Determine the required permission
  const permission = requiredPermission || getRequiredPermission(location.pathname);

  // If no specific permission required, allow access (authenticated user)
  if (!permission) {
    return <>{children}</>;
  }

  // Check if user has the required permission (role-based)
  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  // User lacks permission - redirect to home
  return <Navigate to="/" replace />;
};