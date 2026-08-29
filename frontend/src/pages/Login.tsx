import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore, type UserRole } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import rayLogo from '../assets/ray-logo.png';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signInWithGoogle, signInWithDemoRole, loading } = useAuthStore();
  const { addToast } = useUIStore();
  const [signingIn, setSigningIn] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('buyer');
  const [configError, setConfigError] = useState<string | null>(null);

  // If already logged in, redirect directly to appropriate dashboard
  useEffect(() => {
    if (user) {
      const from =
        (location.state as any)?.from?.pathname ||
        (user.role === 'merchant'
          ? `/merchant/${user.merchantId || 1}/dashboard`
          : '/shop');
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setConfigError(null);
    try {
      const profile = await signInWithGoogle(selectedRole, selectedRole === 'merchant' ? 1 : undefined);
      addToast(`Welcome, ${profile.displayName}! Signed in as ${profile.role.toUpperCase()}`, 'success');
      const dest =
        profile.role === 'merchant'
          ? `/merchant/${profile.merchantId || 1}/dashboard`
          : '/shop';
      navigate(dest, { replace: true });
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
      addToast(`Active session switched to ${profile.displayName} (${role.toUpperCase()})`, 'success');
      const dest =
        role === 'merchant'
          ? `/merchant/${profile.merchantId || 1}/dashboard`
          : '/shop';
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

      {/* 3D Perspective Grid Floor Overlay */}
      <div className="absolute inset-0 bg-grid-perspective opacity-60 pointer-events-none" />

      {/* ─── MAIN 3D GLASS CONTAINER ─── */}
      <div className="relative z-10 w-full max-w-lg perspective-1000">
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
                  Firebase OAuth 2.0 & Role Selection
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                AgentReady{' '}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  Portal
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Select your account role below, then sign in with Google or switch instantly:
              </p>
            </div>
          </div>

          {/* ─── 3D ROLE SELECTOR (Buyer vs Merchant) ─── */}
          <div className="grid grid-cols-2 gap-3.5 text-left">
            <button
              type="button"
              onClick={() => setSelectedRole('buyer')}
              className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer text-left space-y-2 relative overflow-hidden ${
                selectedRole === 'buyer'
                  ? 'bg-gradient-to-b from-blue-500 to-indigo-600 text-white border-blue-400 shadow-lg shadow-blue-500/30 transform -translate-y-1 ring-2 ring-blue-300/60'
                  : 'bg-white/70 hover:bg-white border-slate-200 text-slate-900 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">🛍️</span>
                {selectedRole === 'buyer' && (
                  <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
                )}
              </div>
              <div>
                <div className={`text-sm font-bold ${selectedRole === 'buyer' ? 'text-white' : 'text-slate-900'}`}>
                  Buyer
                </div>
                <div className={`text-[11px] leading-tight ${selectedRole === 'buyer' ? 'text-blue-100' : 'text-slate-500'}`}>
                  AI Shop, Discovery & Autonomous Checkout
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('merchant')}
              className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer text-left space-y-2 relative overflow-hidden ${
                selectedRole === 'merchant'
                  ? 'bg-gradient-to-b from-emerald-500 to-teal-600 text-white border-emerald-400 shadow-lg shadow-emerald-500/30 transform -translate-y-1 ring-2 ring-emerald-300/60'
                  : 'bg-white/70 hover:bg-white border-slate-200 text-slate-900 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">🏬</span>
                {selectedRole === 'merchant' && (
                  <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
                )}
              </div>
              <div>
                <div className={`text-sm font-bold ${selectedRole === 'merchant' ? 'text-white' : 'text-slate-900'}`}>
                  Merchant & Admin
                </div>
                <div className={`text-[11px] leading-tight ${selectedRole === 'merchant' ? 'text-emerald-100' : 'text-slate-500'}`}>
                  Policy Rules, Approvals & All Audit Logs
                </div>
              </div>
            </button>
          </div>

          {/* Configuration Hint Alert if Google Auth Not Enabled */}
          {configError && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-left text-xs space-y-2.5 animate-fadeIn">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <span>⚠️</span> Enable Google Provider in Firebase Console
              </div>
              <div className="pt-1">
                <a
                  href="https://console.firebase.google.com/u/0/project/agent-ray/authentication"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-3d-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  <span>Open Firebase Console ↗</span>
                </a>
              </div>
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
                {signingIn
                  ? 'Signing in...'
                  : `Sign in with Google as ${selectedRole.toUpperCase()}`}
              </span>
            </button>

            {/* ─── 1-CLICK INSTANT ROLES (FAST EVALUATION) ─── */}
            <div className="pt-3 border-t border-slate-200/60 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Instant 1-Click Role Switch</span>
                <span className="text-[10px] text-primary">Zero Auth Required</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleDemoSignIn('buyer')}
                  disabled={signingIn}
                  className="px-4 py-2.5 rounded-xl bg-blue-50/80 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200/60 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>🛍️</span>
                  <span>Buyer Persona</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoSignIn('merchant')}
                  disabled={signingIn}
                  className="px-4 py-2.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200/60 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>🏬</span>
                  <span>Merchant & Admin Persona</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
