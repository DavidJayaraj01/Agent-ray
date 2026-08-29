import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from './stores/uiStore';
import { useAuthStore } from './stores/authStore';
import { RequireAuth, RequireRole } from './components/ProtectedRoute';
import rayLogo from './assets/ray-logo.png';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import MerchantApply from './pages/MerchantApply';
import AdminApprovals from './pages/AdminApprovals';
import MerchantApprovals from './pages/MerchantApprovals';
import MyOrders from './pages/MyOrders';
import MerchantOnboarding from './pages/MerchantOnboarding';
import ManifestReview from './pages/ManifestReview';
import MerchantDashboard from './pages/MerchantDashboard';
import PolicySettings from './pages/PolicySettings';
import BuyerSearch from './pages/BuyerSearch';
import NegotiationCheckout from './pages/NegotiationCheckout';
import Receipt from './pages/Receipt';
import AuditLog from './pages/AuditLog';
import VoiceAssistant from './pages/VoiceAssistant';
import GrowthDashboard from './pages/GrowthDashboard';
import AgentReadyCertificate from './pages/AgentReadyCertificate';

function FloatingNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const { user, signOutUser, loading } = useAuthStore();
  const isActive = (path: string) => location.pathname === path;


  // Close mobile menu on navigate
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  }, [location.pathname]);

  // Compute navigation links based on user role
  let navLinks: { path: string; label: string }[] = [];

  if (!user) {
    navLinks = [];
  } else if (user.role === 'admin') {
    navLinks = [
      { path: '/', label: 'All Merchants' },
      { path: '/admin/approvals', label: '🛡️ Approvals' },
      { path: '/admin/audit', label: 'Audit Trail' },
      { path: '/shop', label: 'AI Shop' },
    ];
  } else if (user.role === 'merchant' && user.merchantId) {
    navLinks = [
      { path: `/merchant/${user.merchantId}/dashboard`, label: 'Dashboard' },
      { path: `/merchant/${user.merchantId}/manifest`, label: 'Manifest' },
      { path: `/merchant/${user.merchantId}/policy`, label: 'Policy' },
      { path: `/merchant/${user.merchantId}/growth`, label: 'Growth' },
      { path: `/merchant/${user.merchantId}/approvals`, label: 'Approvals' },
      { path: `/merchant/${user.merchantId}/certificate`, label: 'Badge' },
      { path: '/shop', label: 'AI Shop' },
    ];
  } else {
    // Default: Authenticated Buyer
    navLinks = [
      { path: '/', label: 'Marketplace' },
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

  return (
    <header className="sticky top-2 sm:top-4 z-50 px-3 sm:px-6 pointer-events-none">
      <div className="max-w-6xl mx-auto pointer-events-auto">
        <nav className="glass-navbar-3d rounded-2xl sm:rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between transition-all">
          {/* 3D Brandmark */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
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

          {/* Desktop Center Navigation Links (Rendered only when authenticated or has links) */}
          {navLinks.length > 0 && (
            <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100/70 backdrop-blur-md rounded-full border border-slate-200/60 shadow-inner">
              {navLinks.map(({ path, label }) => {
                const active = isActive(path);
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`px-3.5 py-1.5 text-xs rounded-full font-bold transition-all duration-200 ${
                      active
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] transform -translate-y-0.5'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          )}


          {/* Right Section: User Profile Chip or 3D Sign In CTA */}
          <div className="flex items-center gap-2 sm:gap-3">
            {loading ? (
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  {user.photoURL && !avatarError ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-300"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[11px] font-extrabold flex items-center justify-center shadow-xs">
                      {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}


                  <div className="hidden sm:flex flex-col text-left leading-none">
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[100px]">
                      {user.displayName?.split(' ')[0]}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold uppercase tracking-wider ${
                        user.role === 'admin'
                          ? 'text-purple-600'
                          : user.role === 'merchant'
                          ? 'text-emerald-600'
                          : 'text-blue-600'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>

                  <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {/* 3D Profile Dropdown */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 p-2.5 card-3d rounded-2xl shadow-2xl space-y-1 animate-fadeIn z-50">
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50 rounded-xl mb-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{user.displayName}</div>
                      <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                      <div className="mt-1.5 inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-white text-slate-700 border border-slate-200 shadow-2xs">
                        Role: {user.role}
                      </div>
                    </div>

                    {user.role === 'buyer' && (
                      <Link
                        to="/merchant/apply"
                        className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:text-primary hover:bg-blue-50/60 rounded-xl transition-colors"
                      >
                        🚀 Apply for Merchant Store
                      </Link>
                    )}

                    {user.role === 'merchant' && user.merchantId && (
                      <Link
                        to={`/merchant/${user.merchantId}/dashboard`}
                        className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/60 rounded-xl transition-colors"
                      >
                        🏬 Store Dashboard
                      </Link>
                    )}

                    {user.role === 'admin' && (
                      <Link
                        to="/admin/approvals"
                        className="block px-3 py-2 text-xs font-semibold text-slate-700 hover:text-purple-700 hover:bg-purple-50/60 rounded-xl transition-colors"
                      >
                        🛡️ Merchant Approvals
                      </Link>
                    )}

                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50/80 rounded-xl transition-colors cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="btn-3d-primary inline-flex items-center justify-center px-4.5 py-1.5 rounded-full text-white text-xs font-bold transition-all"
              >
                Sign In ⚡
              </Link>
            )}

            {/* Mobile Hamburger Button (only shown when nav links exist) */}
            {navLinks.length > 0 && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Toggle navigation menu"
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


        {/* 3D Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 p-4 card-3d rounded-2xl shadow-xl space-y-2 animate-fadeIn">
            <div className="grid grid-cols-1 gap-1">
              {navLinks.map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-between ${
                    isActive(path)
                      ? 'bg-blue-50 text-primary'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{label}</span>
                  {isActive(path) && <span className="w-2 h-2 rounded-full bg-primary" />}
                </Link>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-700 text-center text-xs font-bold border border-rose-200 transition-colors"
                >
                  Sign Out ({user.displayName?.split(' ')[0]})
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-3d-primary w-full py-2.5 rounded-xl text-white text-center text-xs font-bold transition-colors"
                >
                  Sign In with Google
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );

}

function Toasts() {
  const { toasts, removeToast } = useUIStore();
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-4 sm:left-auto right-4 sm:right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm sm:max-w-md">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => removeToast(t.id)}
          className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-xs font-medium cursor-pointer border transition-all ${
            t.type === 'success' ? 'bg-white text-emerald-800 border-emerald-200 shadow-emerald-500/10' :
            t.type === 'error'   ? 'bg-white text-rose-800 border-rose-200 shadow-rose-500/10' :
                                  'bg-white text-text border-border'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const initAuthListener = useAuthStore((s) => s.initAuthListener);

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
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/shop" element={<BuyerSearch />} />
          <Route path="/voice" element={<VoiceAssistant />} />

          {/* Authenticated Buyer Routes */}
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

          {/* Merchant Gated Routes (Requires role: merchant AND owns merchantId) */}
          <Route
            path="/merchant/:id/manifest"
            element={
              <RequireRole role="merchant" checkMerchantOwnership>
                <ManifestReview />
              </RequireRole>
            }
          />
          <Route
            path="/merchant/:id/dashboard"
            element={
              <RequireRole role="merchant" checkMerchantOwnership>
                <MerchantDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/merchant/:id/policy"
            element={
              <RequireRole role="merchant" checkMerchantOwnership>
                <PolicySettings />
              </RequireRole>
            }
          />
          <Route
            path="/merchant/:id/growth"
            element={
              <RequireRole role="merchant" checkMerchantOwnership>
                <GrowthDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/merchant/:id/approvals"
            element={
              <RequireRole role="merchant" checkMerchantOwnership>
                <MerchantApprovals />
              </RequireRole>
            }
          />
          <Route
            path="/merchant/:id/certificate"
            element={
              <RequireRole role="merchant" checkMerchantOwnership>
                <AgentReadyCertificate />
              </RequireRole>
            }
          />

          {/* Admin Gated Routes */}
          <Route
            path="/admin/approvals"
            element={
              <RequireRole role="admin">
                <AdminApprovals />
              </RequireRole>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <RequireRole role="admin">
                <AuditLog />
              </RequireRole>
            }
          />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16 sm:mt-20 py-8 bg-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-secondary text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <img src={rayLogo} alt="AgentReady" className="w-5 h-5 rounded-full object-cover shadow-2xs ring-1 ring-border/50" />
            <span className="font-semibold text-text">AgentReady</span>
            <span>—</span>
            <span>Autonomous Commerce Readiness Platform</span>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4 sm:gap-6 text-text-tertiary">
            <span>Powered by Razorpay Test API</span>
            <span className="hidden sm:inline">·</span>
            <span>Firebase Auth & RTDB</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
