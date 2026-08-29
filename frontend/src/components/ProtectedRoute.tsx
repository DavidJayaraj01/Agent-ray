import React from 'react';
import { Navigate, useLocation, useParams, Link } from 'react-router-dom';
import { useAuthStore, type UserRole } from '../stores/authStore';

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { user, loading, initialized } = useAuthStore();
  const location = useLocation();

  if (loading || !initialized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs text-text-secondary font-medium">Verifying authorization...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

interface RequireRoleProps {
  role: UserRole | UserRole[];
  children: React.ReactNode;
  checkMerchantOwnership?: boolean;
}

export function RequireRole({
  role,
  children,
  checkMerchantOwnership = false,
}: RequireRoleProps) {
  const { user, loading, initialized } = useAuthStore();
  const { id } = useParams<{ id: string }>();

  if (loading || !initialized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs text-text-secondary font-medium">Checking access privileges...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin has global bypass
  if (user.role === 'admin') {
    return <>{children}</>;
  }

  const allowedRoles = Array.isArray(role) ? role : [role];
  const hasRole = allowedRoles.includes(user.role);

  // If merchant ownership check is enabled, verify user.merchantId === URL param id
  const hasOwnership =
    !checkMerchantOwnership ||
    !id ||
    (user.merchantId !== null && user.merchantId !== undefined && String(user.merchantId) === String(id));

  if (!hasRole || !hasOwnership) {
    return <AccessDenied currentRole={user.role} requiredRole={role} isOwnershipMismatch={!hasOwnership} />;
  }

  return <>{children}</>;
}

function AccessDenied({
  currentRole,
  requiredRole,
  isOwnershipMismatch,
}: {
  currentRole: string;
  requiredRole: UserRole | UserRole[];
  isOwnershipMismatch?: boolean;
}) {
  const roleDisplay = Array.isArray(requiredRole) ? requiredRole.join(' or ') : requiredRole;

  return (
    <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl border border-border shadow-md text-center space-y-5 animate-fadeIn">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl">
        🔒
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-text">Access Restricted</h2>
        <p className="text-xs text-text-secondary max-w-md mx-auto">
          {isOwnershipMismatch
            ? 'You are not authorized to view or manage another merchant’s store.'
            : `This section requires a ${roleDisplay} account. You are currently authenticated as a ${currentRole}.`}
        </p>
      </div>

      <div className="p-4 bg-surface-alt rounded-2xl border border-border/80 text-left text-xs space-y-1.5">
        <div className="flex items-center justify-between text-text-secondary">
          <span>Your Current Role:</span>
          <span className="font-semibold text-text uppercase tracking-wide px-2 py-0.5 bg-white rounded-md border border-border/60">
            {currentRole}
          </span>
        </div>
        <div className="flex items-center justify-between text-text-secondary">
          <span>Required Privilege:</span>
          <span className="font-semibold text-primary uppercase tracking-wide px-2 py-0.5 bg-light-blue rounded-md border border-primary/20">
            {roleDisplay}
          </span>
        </div>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        {currentRole === 'buyer' && (
          <Link
            to="/merchant/apply"
            className="w-full sm:w-auto px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-full shadow-xs transition-colors"
          >
            Apply for Merchant Access ✨
          </Link>
        )}
        <Link
          to="/shop"
          className="w-full sm:w-auto px-5 py-2.5 bg-surface-alt hover:bg-surface text-text text-xs font-semibold rounded-full border border-border transition-colors"
        >
          Return to Marketplace
        </Link>
      </div>
    </div>
  );
}
