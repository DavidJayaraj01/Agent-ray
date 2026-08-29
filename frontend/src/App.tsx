import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUIStore } from './stores/uiStore';
import { fetchFirebaseStatus } from './api/client';
import rayLogo from './assets/ray-logo.png';
import Landing from './pages/Landing';
import MerchantOnboarding from './pages/MerchantOnboarding';
import ManifestReview from './pages/ManifestReview';
import MerchantDashboard from './pages/MerchantDashboard';
import PolicySettings from './pages/PolicySettings';
import BuyerSearch from './pages/BuyerSearch';
import NegotiationCheckout from './pages/NegotiationCheckout';
import Receipt from './pages/Receipt';
import AuditLog from './pages/AuditLog';

function FloatingNavbar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isActive = (path: string) => location.pathname === path;
  
  // Automatically close mobile menu when route changes
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const { data: fbStatus } = useQuery({
    queryKey: ['firebaseStatus'],
    queryFn: fetchFirebaseStatus,
    refetchInterval: 30000,
  });

  const navLinks = [
    { path: '/', label: 'Marketplace' },
    { path: '/shop', label: 'AI Shop' },
    { path: '/merchant/new', label: 'List Store' },
    { path: '/admin/audit', label: 'Audit Trail' },
  ];

  return (
    <header className="sticky top-2 sm:top-4 z-50 px-3 sm:px-6 pointer-events-none">
      <div className="max-w-6xl mx-auto pointer-events-auto">
        <nav className="rounded-2xl sm:rounded-full bg-white/95 backdrop-blur-md border border-border shadow-sm px-4 sm:px-6 py-2.5 flex items-center justify-between transition-all">
          {/* Brandmark */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center shadow-xs bg-white border border-border/60 p-0.5">
              <img src={rayLogo} alt="AgentReady Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-semibold text-base text-text tracking-tight group-hover:text-primary transition-colors">
                AgentReady
              </span>
              <span className="text-[9px] sm:text-[10px] text-text-secondary font-medium tracking-wide">
                FINTECH PLATFORM
              </span>
            </div>
          </Link>

          {/* Desktop Center Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={`px-3.5 py-1.5 text-xs rounded-full font-medium transition-all ${
                  isActive(path)
                    ? 'bg-light-blue text-primary font-semibold'
                    : 'text-text-secondary hover:text-text hover:bg-surface-alt'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Right Section: Firebase Status & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {fbStatus?.connected ? (
              <div
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs cursor-default"
                title={`Firebase: Connected\nProject: ${fbStatus.project_id}\nClient: ${fbStatus.client_email}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="hidden sm:inline text-text-secondary text-[11px]">Firebase:</span>
                <span className="font-semibold text-[10px] sm:text-[11px] max-w-[80px] sm:max-w-none truncate">
                  {fbStatus.project_id}
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200"
                title={fbStatus?.error || 'Firebase connecting...'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                <span className="text-[10px] sm:text-[11px]">Firebase</span>
              </div>
            )}

            <Link
              to="/shop"
              className="hidden sm:inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-medium transition-colors shadow-xs"
            >
              Launch Shop
            </Link>

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-text-secondary hover:text-text hover:bg-surface-alt focus:outline-none transition-colors"
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
          </div>
        </nav>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 p-4 bg-white/95 backdrop-blur-md rounded-2xl border border-border shadow-lg space-y-2 animate-fadeIn">
            <div className="grid grid-cols-1 gap-1">
              {navLinks.map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                    isActive(path)
                      ? 'bg-light-blue text-primary font-semibold'
                      : 'text-text hover:bg-surface-alt'
                  }`}
                >
                  <span>{label}</span>
                  {isActive(path) && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </Link>
              ))}
            </div>

            <div className="pt-3 border-t border-border/80 flex items-center justify-between gap-3">
              <Link
                to="/shop"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-center text-xs font-semibold shadow-xs transition-colors"
              >
                Launch AI Shop ⚡
              </Link>
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
  return (
    <div className="min-h-screen bg-surface flex flex-col text-text selection:bg-light-blue selection:text-primary">
      <FloatingNavbar />
      <Toasts />
      <main className="flex-1 w-full overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/merchant/new" element={<MerchantOnboarding />} />
          <Route path="/merchant/:id/manifest" element={<ManifestReview />} />
          <Route path="/merchant/:id/dashboard" element={<MerchantDashboard />} />
          <Route path="/merchant/:id/policy" element={<PolicySettings />} />
          <Route path="/shop" element={<BuyerSearch />} />
          <Route path="/shop/negotiate/:productId" element={<NegotiationCheckout />} />
          <Route path="/shop/receipt/:orderId" element={<Receipt />} />
          <Route path="/admin/audit" element={<AuditLog />} />
        </Routes>
      </main>

      {/* Clean Minimal Developer Footer */}
      <footer className="border-t border-border mt-16 sm:mt-20 py-8 bg-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-secondary text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="font-semibold text-text">AgentReady</span>
            <span>—</span>
            <span>Autonomous Commerce Readiness Platform</span>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4 sm:gap-6 text-text-tertiary">
            <span>Powered by Razorpay Test API</span>
            <span className="hidden sm:inline">·</span>
            <span>SQLite + Local LLM</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
