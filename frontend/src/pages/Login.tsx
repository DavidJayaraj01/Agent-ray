import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore, type UserRole } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import rayLogo from '../assets/ray-logo.png';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signInWithGoogle, signInWithDemoRole, loading } = useAuthStore();
  const { addToast } = useUIStore();
  const [signingIn, setSigningIn] = useState(false);
  const [selectedRolePreview, setSelectedRolePreview] = useState<UserRole>('buyer');
  const [configError, setConfigError] = useState<string | null>(null);

  // If already logged in, redirect to origin page or landing page (/)
  useEffect(() => {
    if (user) {
      const from =
        (location.state as any)?.from?.pathname ||
        (user.role === 'merchant' && user.merchantId
          ? `/merchant/${user.merchantId}/dashboard`
          : user.role === 'admin'
          ? '/admin/approvals'
          : '/');
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setConfigError(null);
    try {
      const profile = await signInWithGoogle();
      addToast(`Welcome back, ${profile.displayName}! (${profile.role.toUpperCase()})`, 'success');
      const from =
        (location.state as any)?.from?.pathname ||
        (profile.role === 'merchant' && profile.merchantId
          ? `/merchant/${profile.merchantId}/dashboard`
          : profile.role === 'admin'
          ? '/admin/approvals'
          : '/');
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err?.message?.includes('Firebase Auth is not enabled')) {
        setConfigError(err.message);
      } else if (err?.code !== 'auth/popup-closed-by-user') {
        addToast(err?.message || 'Google sign-in failed. Please try again.', 'error');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleDemoSignIn = async (role: UserRole) => {
    setSigningIn(true);
    try {
      const profile = await signInWithDemoRole(role);
      addToast(`Signed in as ${profile.displayName} (${role.toUpperCase()})`, 'success');
      const dest =
        role === 'merchant' && profile.merchantId
          ? `/merchant/${profile.merchantId}/dashboard`
          : role === 'admin'
          ? '/admin/approvals'
          : '/';
      navigate(dest, { replace: true });
    } catch {
      addToast('Failed to switch demo user', 'error');
    } finally {
      setSigningIn(false);
    }
  };


  return (
    <div className="relative min-h-[90vh] flex items-center justify-center px-4 sm:px-6 py-12 overflow-hidden">
      {/* ─── 3D AMBIENT LIGHTING & FLOATING ORBS ─── */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-500/15 via-indigo-500/10 to-violet-500/15 rounded-full blur-3xl pointer-events-none animate-orb-1" />
      <div className="absolute bottom-10 left-1/4 w-[400px] h-[400px] bg-cyan-400/10 rounded-full blur-3xl pointer-events-none animate-orb-2" />
      <div className="absolute top-1/3 right-1/4 w-[450px] h-[450px] bg-violet-500/10 rounded-full blur-3xl pointer-events-none animate-orb-1" />

      {/* 3D Perspective Grid Floor Overlay */}
      <div className="absolute inset-0 bg-grid-perspective opacity-60 pointer-events-none" />

      {/* ─── MAIN 3D GLASS CONTAINER ─── */}
      <div className="relative z-10 w-full max-w-xl perspective-1000">
        <div className="card-3d rounded-[2.5rem] p-8 sm:p-12 text-center space-y-8 animate-float-3d relative overflow-hidden">
          {/* Top Edge Specular Reflection Shimmer */}
          <div className="absolute -top-24 left-0 right-0 h-48 bg-gradient-to-b from-white/60 to-transparent pointer-events-none rounded-t-[2.5rem]" />

          {/* 3D Brand Badge Header */}
          <div className="flex flex-col items-center gap-4 relative">
            <div className="relative group cursor-pointer">
              {/* Glowing Halo */}
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600 rounded-full blur-md opacity-40 group-hover:opacity-75 transition duration-500 animate-pulse" />

              {/* 3D Avatar Container */}
              <div className="relative w-20 h-20 rounded-full overflow-hidden p-1 bg-white shadow-2xl ring-2 ring-white/90 transform group-hover:scale-105 transition-transform duration-300">
                <img
                  src={rayLogo}
                  alt="AgentReady Logo"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>

              {/* Status Pip */}
              <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-white shadow-md">
                <span className="h-2 w-2 rounded-full bg-white animate-ping" />
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50/80 border border-blue-200/60 shadow-xs backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-bold text-primary tracking-wider uppercase">
                  Firebase OAuth 2.0 & Multi-Tenant RBAC
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                AgentReady{' '}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  Portal
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Autonomous Commerce Readiness & Policy Engine for AI Agents
              </p>
            </div>
          </div>

          {/* ─── 3D INTERACTIVE ROLE CAPABILITIES ─── */}
          <div className="grid grid-cols-3 gap-3 text-left">
            <button
              type="button"
              onClick={() => setSelectedRolePreview('buyer')}
              className={`p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer text-left space-y-1.5 relative overflow-hidden ${
                selectedRolePreview === 'buyer'
                  ? 'bg-gradient-to-b from-blue-50/90 to-indigo-50/50 border-blue-300/80 shadow-md shadow-blue-500/10 transform -translate-y-1'
                  : 'bg-white/70 hover:bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">🛍️</span>
                {selectedRolePreview === 'buyer' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                )}
              </div>
              <div className="text-xs font-bold text-slate-900">Buyer</div>
              <div className="text-[10px] text-slate-500 leading-tight">Instant shop & AI negotiation</div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRolePreview('merchant')}
              className={`p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer text-left space-y-1.5 relative overflow-hidden ${
                selectedRolePreview === 'merchant'
                  ? 'bg-gradient-to-b from-emerald-50/90 to-teal-50/50 border-emerald-300/80 shadow-md shadow-emerald-500/10 transform -translate-y-1'
                  : 'bg-white/70 hover:bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">🏬</span>
                {selectedRolePreview === 'merchant' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                )}
              </div>
              <div className="text-xs font-bold text-slate-900">Merchant</div>
              <div className="text-[10px] text-slate-500 leading-tight">Policy rules & growth engine</div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRolePreview('admin')}
              className={`p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer text-left space-y-1.5 relative overflow-hidden ${
                selectedRolePreview === 'admin'
                  ? 'bg-gradient-to-b from-purple-50/90 to-pink-50/50 border-purple-300/80 shadow-md shadow-purple-500/10 transform -translate-y-1'
                  : 'bg-white/70 hover:bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">🛡️</span>
                {selectedRolePreview === 'admin' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                )}
              </div>
              <div className="text-xs font-bold text-slate-900">Admin</div>
              <div className="text-[10px] text-slate-500 leading-tight">Approvals & live audit log</div>
            </button>
          </div>

          {/* Configuration Hint Alert if Google Auth Not Enabled in Console */}
          {configError && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-left text-xs space-y-2.5 animate-fadeIn">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <span>⚠️</span> 1-Step Setup: Enable Google Provider in Firebase
              </div>
              <p className="text-amber-800 leading-relaxed text-[11px]">
                Firebase requires you to activate the Google Sign-in provider once in your project console:
              </p>
              <div className="pt-1">
                <a
                  href="https://console.firebase.google.com/u/0/project/agent-ray/authentication"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  <span>Open Firebase Authentication Page ↗</span>
                </a>
              </div>
              <p className="text-amber-800 text-[10px] pt-1">
                Click <strong>"Get Started"</strong> → click <strong>Google</strong> → toggle <strong>Enable</strong> → click <strong>Save</strong>.
              </p>
            </div>
          )}

          {/* ─── GOOGLE 3D SIGN-IN BUTTON ─── */}
          <div className="space-y-4 pt-1">
            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn || loading}
              className="group relative w-full py-4 px-6 rounded-2xl bg-white hover:bg-slate-50/90 text-slate-900 font-bold text-sm border border-slate-200/90 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.1),0_1px_3px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1)] hover:shadow-[0_16px_40px_-5px_rgba(37,99,235,0.25),0_2px_6px_rgba(0,0,0,0.08)] transform hover:-translate-y-1 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-3.5 disabled:opacity-60 cursor-pointer"
            >
              {signingIn ? (
                <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              ) : (
                <div className="w-5 h-5 flex items-center justify-center transform group-hover:scale-110 transition-transform duration-200">
                  <svg className="w-full h-full" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
              )}
              <span className="tracking-tight">
                {signingIn ? 'Connecting to Google...' : 'Sign in with Google'}
              </span>
            </button>

            {/* ─── 1-CLICK INSTANT DEMO ROLES (FOR FAST TESTING) ─── */}
            <div className="pt-3 border-t border-slate-200/60 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Instant Evaluation Roles</span>
                <span className="text-[10px] text-primary">1-Click Fast Switch</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoSignIn('buyer')}
                  disabled={signingIn}
                  className="px-3 py-2 rounded-xl bg-blue-50/80 hover:bg-blue-100/90 text-blue-700 text-xs font-bold border border-blue-200/60 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                >
                  <span>🛍️</span>
                  <span>Buyer</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoSignIn('merchant')}
                  disabled={signingIn}
                  className="px-3 py-2 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-700 text-xs font-bold border border-emerald-200/60 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                >
                  <span>🏬</span>
                  <span>Merchant</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoSignIn('admin')}
                  disabled={signingIn}
                  className="px-3 py-2 rounded-xl bg-purple-50/80 hover:bg-purple-100/90 text-purple-700 text-xs font-bold border border-purple-200/60 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                >
                  <span>🛡️</span>
                  <span>Admin</span>
                </button>
              </div>
            </div>

            {/* Micro Badges Footer */}
            <div className="pt-2 flex items-center justify-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Razorpay Test API
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"
                    clipRule="evenodd"
                  />
                </svg>
                Deterministic Policy
              </span>
              <span>·</span>
              <Link to="/shop" className="text-primary hover:underline font-semibold">
                Explore Marketplace →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
