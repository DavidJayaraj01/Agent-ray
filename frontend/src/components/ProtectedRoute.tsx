import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
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
}

export function RequireRole({
  role,
  children,
}: RequireRoleProps) {
  const { user, loading, initialized } = useAuthStore();

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

  // Merchant has full access to merchant sections
  if (user.role === 'merchant') {
    return <>{children}</>;
  }

  const allowedRoles = Array.isArray(role) ? role : [role];
  const hasRole = allowedRoles.includes(user.role);

  if (!hasRole) {
    return <AccessDenied currentRole={user.role} requiredRole={role} />;
  }

  return <>{children}</>;
}

function AccessDenied({
  currentRole,
  requiredRole,
}: {
  currentRole: string;
  requiredRole: UserRole | UserRole[];
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
          This section requires a {roleDisplay} account. You are currently authenticated as a {currentRole}.
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
          <button
            onClick={() => useAuthStore.getState().switchRole('merchant')}
            className="btn-3d-primary w-full sm:w-auto px-6 py-2.5 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>⚡</span>
            <span>Switch to Merchant Mode</span>
          </button>
        )}
        <Link
          to="/shop"
          className="w-full sm:w-auto px-5 py-2.5 bg-surface-alt hover:bg-surface text-text text-xs font-semibold rounded-full border border-border transition-colors text-center"
        >
          Return to AI Shop
        </Link>
      </div>
    </div>
  );
}

