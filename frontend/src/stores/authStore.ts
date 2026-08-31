import { create } from 'zustand';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import axios from 'axios';
import { switchUserRole } from '../api/client';

export type UserRole = 'buyer' | 'merchant';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  merchantId?: number | null;
  createdAt?: string;
}

interface AuthState {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  idToken: string | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  signInWithGoogle: (preferredRole?: UserRole, preferredMerchantId?: number) => Promise<UserProfile>;
  signInWithDemoRole: (role: UserRole) => Promise<UserProfile>;
  switchRole: (role: UserRole) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  initAuthListener: () => () => void;
}

const DEMO_PROFILES: Record<UserRole, UserProfile> = {
  buyer: {
    uid: 'demo_buyer_user_101',
    email: 'buyer.agentready@gmail.com',
    displayName: 'David (Buyer)',
    photoURL: '',
    role: 'buyer',
    merchantId: null,
    createdAt: new Date().toISOString(),
  },
  merchant: {
    uid: 'demo_merchant_user_202',
    email: 'merchant.sportgear@gmail.com',
    displayName: 'David (Merchant)',
    photoURL: '',
    role: 'merchant',
    merchantId: 1,
    createdAt: new Date().toISOString(),
  },
};

// Read cached session to eliminate refresh flash
function getInitialSession(): { user: UserProfile | null; idToken: string | null; initialized: boolean } {
  try {
    const demoRole = sessionStorage.getItem('agentready_demo_role') as UserRole | null;
    if (demoRole && DEMO_PROFILES[demoRole]) {
      return {
        user: DEMO_PROFILES[demoRole],
        idToken: `demo_token_${demoRole}`,
        initialized: true,
      };
    }

    const cachedUserJson = localStorage.getItem('agentready_cached_user');
    const cachedToken = localStorage.getItem('agentready_cached_token');
    if (cachedUserJson) {
      const user = JSON.parse(cachedUserJson) as UserProfile;
      return {
        user,
        idToken: cachedToken || null,
        initialized: true,
      };
    }
  } catch (err) {
    console.warn('Failed to parse cached session:', err);
  }

  return {
    user: null,
    idToken: null,
    initialized: false,
  };
}

const initialSession = getInitialSession();

export const useAuthStore = create<AuthState>((setStore, getStore) => ({
  user: initialSession.user,
  firebaseUser: null,
  idToken: initialSession.idToken,
  loading: !initialSession.initialized,
  initialized: initialSession.initialized,
  error: null,

  signInWithGoogle: async (preferredRole: UserRole = 'merchant', preferredMerchantId?: number) => {
    setStore({ loading: true, error: null });
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const idToken = await fbUser.getIdToken();

      // Resolve and elevate profile securely via FastAPI Backend
      let profile: UserProfile;
      try {
        const resp = await axios.post(
          '/api/auth/register',
          {
            preferred_role: preferredRole,
            merchant_id: preferredMerchantId ?? (preferredRole === 'merchant' ? 1 : null),
          },
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        const resolvedRole = (resp.data.role === 'admin' ? 'merchant' : resp.data.role) as UserRole;
        profile = {
          uid: resp.data.uid,
          email: resp.data.email,
          displayName: resp.data.display_name || fbUser.displayName || 'David',
          photoURL: fbUser.photoURL || '',
          role: resolvedRole || preferredRole,
          merchantId: resp.data.merchant_id ?? (preferredRole === 'merchant' ? 1 : null),
          createdAt: new Date().toISOString(),
        };
      } catch (backendErr) {
        console.warn('Backend registration fallback:', backendErr);
        profile = {
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || 'David',
          photoURL: fbUser.photoURL || '',
          role: preferredRole,
          merchantId: preferredRole === 'merchant' ? 1 : null,
          createdAt: new Date().toISOString(),
        };
      }

      sessionStorage.removeItem('agentready_demo_role');
      localStorage.setItem('agentready_cached_user', JSON.stringify(profile));
      localStorage.setItem('agentready_cached_token', idToken);

      setStore({
        user: profile,
        firebaseUser: fbUser,
        idToken,
        loading: false,
        initialized: true,
      });

      return profile;
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      let errMsg = err?.message || 'Failed to sign in with Google';
      if (err?.code === 'auth/configuration-not-found' || err?.code === 'auth/operation-not-allowed') {
        errMsg =
          'Google Sign-in is not enabled in settings yet. Please use the instant 1-Click Role Switch below.';
      }
      setStore({ loading: false, error: errMsg });
      throw new Error(errMsg);
    }
  },

  // 1-Click Fast Role Evaluation
  signInWithDemoRole: async (role: UserRole) => {
    setStore({ loading: true, error: null });

    const profile = DEMO_PROFILES[role];
    sessionStorage.setItem('agentready_demo_role', role);
    localStorage.setItem('agentready_cached_user', JSON.stringify(profile));
    localStorage.setItem('agentready_cached_token', `demo_token_${role}`);

    setStore({
      user: profile,
      firebaseUser: null,
      idToken: `demo_token_${role}`,
      loading: false,
      initialized: true,
    });

    return profile;
  },

  switchRole: async (role: UserRole) => {
    const current = getStore().user;
    const token = getStore().idToken;
    const updatedProfile: UserProfile = {
      ...(current || DEMO_PROFILES[role]),
      role,
      merchantId: role === 'merchant' ? (current?.merchantId || 1) : null,
    };

    localStorage.setItem('agentready_cached_user', JSON.stringify(updatedProfile));
    setStore({ user: updatedProfile });

    try {
      if (token && !token.startsWith('demo_token_')) {
        await switchUserRole(role, 1);
      } else {
        sessionStorage.setItem('agentready_demo_role', role);
      }
    } catch (err) {
      console.warn('Background switchUserRole warning:', err);
    }
  },

  signOutUser: async () => {
    setStore({ loading: true });
    sessionStorage.removeItem('agentready_demo_role');
    localStorage.removeItem('agentready_cached_user');
    localStorage.removeItem('agentready_cached_token');
    try {
      await signOut(auth);
    } catch {
      // Ignore
    }
    setStore({
      user: null,
      firebaseUser: null,
      idToken: null,
      loading: false,
      initialized: true,
    });
  },

  refreshProfile: async () => {
    const { firebaseUser, user } = getStore();
    if (!firebaseUser) return user;

    try {
      const idToken = await firebaseUser.getIdToken(true);
      const resp = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (resp.data) {
        const resolvedRole = (resp.data.role === 'admin' ? 'merchant' : resp.data.role) as UserRole;
        const profile: UserProfile = {
          uid: resp.data.uid,
          email: resp.data.email,
          displayName: resp.data.display_name || firebaseUser.displayName || 'David',
          photoURL: firebaseUser.photoURL || '',
          role: resolvedRole || user?.role || 'merchant',
          merchantId: resp.data.merchant_id ?? 1,
        };
        localStorage.setItem('agentready_cached_user', JSON.stringify(profile));
        localStorage.setItem('agentready_cached_token', idToken);
        setStore({ user: profile, idToken });
        return profile;
      }
    } catch (err) {
      console.warn('Failed to refresh profile from backend:', err);
    }
    return user;
  },

  initAuthListener: () => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      // If user is currently running a demo session, don't overwrite
      if (sessionStorage.getItem('agentready_demo_role')) {
        setStore({ initialized: true, loading: false });
        return;
      }

      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          const cached = getStore().user;
          let profile: UserProfile;
          try {
            const resp = await axios.get('/api/auth/me', {
              headers: { Authorization: `Bearer ${idToken}` },
            });
            const role = (resp.data.role === 'admin' ? 'merchant' : resp.data.role) as UserRole;
            // Preserve merchant role if previously active or if backend returns merchant
            const effectiveRole = (cached?.role === 'merchant' || role === 'merchant') ? 'merchant' : role || 'merchant';
            profile = {
              uid: resp.data.uid,
              email: resp.data.email,
              displayName: resp.data.display_name || fbUser.displayName || 'David',
              photoURL: fbUser.photoURL || '',
              role: effectiveRole,
              merchantId: resp.data.merchant_id ?? 1,
            };
          } catch {
            profile = cached || {
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || 'David',
              photoURL: fbUser.photoURL || '',
              role: 'merchant',
              merchantId: 1,
            };
          }

          localStorage.setItem('agentready_cached_user', JSON.stringify(profile));
          localStorage.setItem('agentready_cached_token', idToken);

          setStore({
            user: profile,
            firebaseUser: fbUser,
            idToken,
            loading: false,
            initialized: true,
          });
        } catch (err: any) {
          console.error('Auth state resolution error:', err);
          setStore({ loading: false, initialized: true });
        }
      } else {
        // No Firebase user signed in
        if (!sessionStorage.getItem('agentready_demo_role')) {
          localStorage.removeItem('agentready_cached_user');
          localStorage.removeItem('agentready_cached_token');
          setStore({
            user: null,
            firebaseUser: null,
            idToken: null,
            loading: false,
            initialized: true,
          });
        } else {
          setStore({ loading: false, initialized: true });
        }
      }
    });

    return unsubscribe;
  },
}));
