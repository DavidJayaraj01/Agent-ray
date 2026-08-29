import { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useUIStore } from './stores/uiStore';
import { useAuthStore } from './stores/authStore';
import { RequireAuth, RequireRole } from './components/ProtectedRoute';
import Landing from './pages/Landing';
import ManifestReview from './pages/ManifestReview';
import MerchantDashboard from './pages/MerchantDashboard';
import BuyerSearch from './pages/BuyerSearch';
import NegotiationCheckout from './pages/NegotiationCheckout';
import PolicySettings from './pages/PolicySettings';
import AgentReadyCertificate from './pages/AgentReadyCertificate';
import AuditLog from './pages/AuditLog';
import GrowthDashboard from './pages/GrowthDashboard';

import VoiceAssistant from './pages/VoiceAssistant';
import Receipt from './pages/Receipt';
import Login from './pages/Login';
import MerchantApply from './pages/MerchantApply';
import MerchantApprovals from './pages/MerchantApprovals';
import MerchantOnboarding from './pages/MerchantOnboarding';
import MyOrders from './pages/MyOrders';
import rayLogo from './assets/ray-logo.png';

/* ─── 3D FLOATING GLASS NAVBAR (Unified for Buyer & Merchant) ─── */
function FloatingNavbar() {
  const { user, signOutUser } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Close menus on route change
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  }, [location.pathname]);

  // Compute navigation links based on user role (Buyer vs Merchant)
  let navLinks: { path: string; label: string }[] = [];

  if (!user) {
    navLinks = [];
  } else if (user.role === 'merchant') {
    const mId = user.merchantId || 1;
    navLinks = [
      { path: `/merchant/${mId}/dashboard`, label: 'Dashboard' },
      { path: `/merchant/${mId}/manifest`, label: 'Manifest' },
      { path: `/merchant/${mId}/policy`, label: 'Policy' },
      { path: `/merchant/${mId}/growth`, label: 'Growth' },
      { path: `/merchant/${mId}/approvals`, label: 'Approvals' },
      { path: `/merchant/${mId}/audit`, label: 'Audit Trail' },
      { path: `/merchant/${mId}/certificate`, label: 'Badge' },
      { path: '/shop', label: 'AI Shop' },
    ];
  } else {
    // Default: Authenticated Buyer
    navLinks = [
      { path: '/shop', label: 'AI Shop' },
      { path: '/shop/orders', label: 'My Orders' },
      { path: '/voice', label: '🎙️ Voice AI' },
      { path: '/merchant/apply', label: 'List Store' },
    ];
  }

  const handleSignOut = async () => {
    await signOutUser();
    navigate('/login');
  };

  const homePath = user
    ? user.role === 'merchant'
      ? `/merchant/${user.merchantId || 1}/dashboard`
      : '/shop'
    : '/';

  return (
    <header className="sticky top-2 sm:top-4 z-50 px-3 sm:px-6 pointer-events-none">
      <div className="max-w-7xl mx-auto pointer-events-auto">
        <nav className="glass-navbar-3d rounded-2xl sm:rounded-full px-4 sm:px-8 py-2.5 flex items-center justify-between transition-all">


          {/* 3D Brandmark */}
          <Link to={homePath} className="flex items-center gap-2.5 group shrink-0">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden flex items-center justify-center shadow-md ring-2 ring-white/90 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all duration-300 shrink-0 bg-white">
              <img src={rayLogo} alt="AgentReady Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-base text-slate-900 tracking-tight group-hover:text-primary transition-colors">
                AgentReady
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold tracking-wider">
                FINTECH PLATFORM
              </span>
            </div>
          </Link>

          {/* Desktop Center Navigation Links */}
          {navLinks.length > 0 && (
            <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100/70 backdrop-blur-md rounded-full border border-slate-200/60 shadow-inner">
              {navLinks.map((link) => {
                const isActive =
                  location.pathname === link.path ||
                  (link.path.startsWith('/merchant') && location.pathname.includes(link.path.split('/')[3] || ''));
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`relative px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-300 ${
                      isActive
                        ? 'text-white font-bold shadow-md shadow-blue-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-primary transition-all duration-300 -z-10 shadow-xs animate-fadeIn" />
                    )}
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Right Action & User Profile Pill */}
          <div className="flex items-center gap-2">
            {!user ? (
              <Link
                to="/login"
                className="btn-3d-primary inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl sm:rounded-full text-white text-xs font-bold shadow-md cursor-pointer"
              >
                <span>Sign In</span>
                <span>⚡</span>
              </Link>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-white/80 hover:bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="relative w-7 h-7 rounded-full overflow-hidden ring-1 ring-slate-300 shrink-0 bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="Profile"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span>{user.displayName?.charAt(0) || user.role.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="hidden sm:flex flex-col text-left leading-tight pr-1">
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[90px]">
                      {user.displayName?.split(' ')[0] || 'User'}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold uppercase tracking-wider ${
                        user.role === 'merchant'
                          ? 'text-emerald-700'
                          : 'text-primary'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <svg
                    className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-transform ${
                      userDropdownOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Profile Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 p-2 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/90 shadow-2xl z-50 animate-fadeIn text-left space-y-1">
                    <div className="p-2.5 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900">{user.displayName || 'User'}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 uppercase">
                        <span>ROLE: {user.role}</span>
                      </div>
                    </div>

                    {user.role === 'buyer' && (
                      <Link
                        to="/merchant/apply"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-primary transition-colors"
                      >
                        <span>🚀</span>
                        <span>Apply for Merchant Store</span>
                      </Link>
                    )}

                    {user.role === 'merchant' && (
                      <>
                        <Link
                          to={`/merchant/${user.merchantId || 1}/dashboard`}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <span>📊</span>
                          <span>Merchant Dashboard</span>
                        </Link>
                        <Link
                          to={`/merchant/${user.merchantId || 1}/audit`}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <span>📜</span>
                          <span>Audit Trail & Records</span>
                        </Link>
                      </>
                    )}

                    {user.role === 'buyer' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await useAuthStore.getState().switchRole('merchant');
                          setUserDropdownOpen(false);
                          navigate('/merchant/1/dashboard');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left cursor-pointer"
                      >
                        <span>🏬</span>
                        <span>Switch to Merchant Mode</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await useAuthStore.getState().switchRole('buyer');
                          setUserDropdownOpen(false);
                          navigate('/shop');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors text-left cursor-pointer"
                      >
                        <span>🛍️</span>
                        <span>Switch to Buyer Mode</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                    >
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* Mobile Hamburger Toggle */}
            {navLinks.length > 0 && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                aria-label="Toggle Menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            )}
          </div>
        </nav>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && navLinks.length > 0 && (
          <div className="md:hidden mt-2 p-3 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-xl pointer-events-auto space-y-1 animate-fadeIn">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`block px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  location.pathname === link.path
                    ? 'bg-primary text-white font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

/* ─── TOAST NOTIFICATIONS ─── */
function Toasts() {
  const { toasts, removeToast } = useUIStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto px-4 py-3 rounded-2xl text-xs font-semibold shadow-xl border backdrop-blur-md flex items-center justify-between gap-3 animate-slideUp ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/30'
              : toast.type === 'error'
              ? 'bg-rose-950/90 text-rose-100 border-rose-500/30'
              : 'bg-slate-900/90 text-slate-100 border-slate-700/50'
          }`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="text-white/60 hover:text-white transition-colors cursor-pointer text-sm"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const initAuthListener = useAuthStore((s) => s.initAuthListener);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const unsub = initAuthListener();
    return unsub;
  }, [initAuthListener]);

  return (
    <div className="min-h-screen bg-surface flex flex-col text-text selection:bg-light-blue selection:text-primary">
      <FloatingNavbar />
      <Toasts />
      <main className="flex-1 w-full overflow-x-hidden">
        <Routes>
          {/* Public / Entry Routes */}
          <Route
            path="/"
            element={
              user ? (
                <Navigate
                  to={
                    user.role === 'merchant'
                      ? `/merchant/${user.merchantId || 1}/dashboard`
                      : '/shop'
                  }
                  replace
                />
              ) : (
                <Landing />
              )
            }
          />
          <Route path="/login" element={<Login />} />

          {/* Authenticated Buyer Routes */}
          <Route
            path="/shop"
            element={
              <RequireAuth>
                <BuyerSearch />
              </RequireAuth>
            }
          />
          <Route
            path="/voice"
            element={
              <RequireAuth>
                <VoiceAssistant />
              </RequireAuth>
            }
          />
          <Route
            path="/shop/negotiate/:productId"
            element={
              <RequireAuth>
                <NegotiationCheckout />
              </RequireAuth>
            }
          />
          <Route
            path="/shop/receipt/:orderId"
            element={
              <RequireAuth>
                <Receipt />
              </RequireAuth>
            }
          />
          <Route
            path="/shop/orders"
            element={
              <RequireAuth>
                <MyOrders />
              </RequireAuth>
            }
          />
          <Route
            path="/merchant/apply"
            element={
              <RequireAuth>
                <MerchantApply />
              </RequireAuth>
            }
          />
          <Route
            path="/merchant/new"
            element={
              <RequireAuth>
                <MerchantOnboarding />
              </RequireAuth>
            }
          />

          {/* Merchant Routes (Full feature suite: Dashboard, Manifest, Policy, Growth, Approvals, Audit, Badge) */}
          <Route
            path="/merchant/:id/manifest"
            element={
              <RequireRole role="merchant">
                <ManifestReview />
              </RequireRole>
            }
          />
          <Route
            path="/merchant/:id/dashboard"
            element={
              <RequireRole role="merchant">
                <MerchantDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/merchant/:id/policy"
            element={
              <RequireRole role="merchant">
                <PolicySettings />
              </RequireRole>
            }
          />
          <Route
            path="/merchant/:id/growth"
            element={
              <RequireRole role="merchant">
                <GrowthDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/merchant/:id/approvals"
            element={
              <RequireRole role="merchant">
                <MerchantApprovals />
              </RequireRole>
            }
          />
          <Route
            path="/merchant/:id/audit"
            element={
              <RequireRole role="merchant">
                <AuditLog />
              </RequireRole>
            }
          />

          <Route
            path="/merchant/:id/certificate"
            element={
              <RequireRole role="merchant">
                <AgentReadyCertificate />
              </RequireRole>
            }
          />

          {/* Redirects for legacy admin links */}
          <Route path="/admin/approvals" element={<Navigate to="/merchant/1/approvals" replace />} />
          <Route path="/admin/audit" element={<Navigate to="/merchant/1/audit" replace />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Modern Minimal 3D Footer */}
      <footer className="border-t border-border bg-white/70 backdrop-blur-md py-6 sm:py-8 text-center text-xs text-text-secondary mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full overflow-hidden shadow-xs ring-1 ring-slate-200">
              <img src={rayLogo} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-semibold text-text">AgentReady</span>
            <span>&mdash;</span>
            <span>Autonomous Commerce Readiness Platform</span>
          </div>
          <div className="flex items-center gap-4 text-text-tertiary text-[11px]">
            <span>Powered by Razorpay Test API</span>
            <span>&middot;</span>
            <span>Firebase Auth & RTDB</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

