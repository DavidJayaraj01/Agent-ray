import { create } from 'zustand';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import axios from 'axios';

export type UserRole = 'buyer' | 'merchant' | 'admin';

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
  signInWithGoogle: () => Promise<UserProfile>;
  signInWithDemoRole: (role: UserRole) => Promise<UserProfile>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  initAuthListener: () => () => void;
}

export const useAuthStore = create<AuthState>((setStore, getStore) => ({
  user: null,
  firebaseUser: null,
  idToken: null,
  loading: false,
  initialized: true,
  error: null,

  signInWithGoogle: async () => {
    setStore({ loading: true, error: null });
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const idToken = await fbUser.getIdToken();

      // Resolve profile securely via FastAPI Backend (Admin SDK)
      let profile: UserProfile;
      try {
        const resp = await axios.post(
          '/api/auth/register',
          {},
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        profile = {
          uid: resp.data.uid,
          email: resp.data.email,
          displayName: resp.data.display_name || fbUser.displayName || 'User',
          photoURL: fbUser.photoURL || '',
          role: (resp.data.role as UserRole) || 'buyer',
          merchantId: resp.data.merchant_id ?? null,
          createdAt: new Date().toISOString(),
        };
      } catch (backendErr) {
        console.warn('Backend profile resolution fallback:', backendErr);
        // Safe fallback if backend is momentarily unreachable
        profile = {
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || 'User',
          photoURL: fbUser.photoURL || '',
          role: 'buyer',
          merchantId: null,
          createdAt: new Date().toISOString(),
        };
      }

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
      if (err?.code === 'auth/configuration-not-found') {
        errMsg =
          'Firebase Auth is not enabled yet in your Firebase Console! Please go to Firebase Console → Authentication → "Get Started" → Sign-in method → enable Google.';
      }
      setStore({ loading: false, error: errMsg });
      throw new Error(errMsg);
    }
  },

  // 1-Click Fast Demo Login for instant evaluation
  signInWithDemoRole: async (role: UserRole) => {
    setStore({ loading: true, error: null });

    const demoProfiles: Record<UserRole, UserProfile> = {
      buyer: {
        uid: 'demo_buyer_user_101',
        email: 'buyer.agentready@gmail.com',
        displayName: 'Aarav Sharma (Buyer)',
        photoURL: '',
        role: 'buyer',
        merchantId: null,
        createdAt: new Date().toISOString(),
      },
      merchant: {
        uid: 'demo_merchant_user_202',
        email: 'merchant.sportgear@gmail.com',
        displayName: 'SportGear Pro (Merchant)',
        photoURL: '',
        role: 'merchant',
        merchantId: 1,
        createdAt: new Date().toISOString(),
      },
      admin: {
        uid: 'demo_admin_user_303',
        email: 'admin.platform@agentready.ai',
        displayName: 'Admin Operator',
        photoURL: '',
        role: 'admin',
        merchantId: null,
        createdAt: new Date().toISOString(),
      },
    };

    const profile = demoProfiles[role];
    setStore({
      user: profile,
      firebaseUser: null,
      idToken: `demo_token_${role}`,
      loading: false,
      initialized: true,
    });

    return profile;
  },

  signOutUser: async () => {
    setStore({ loading: true });
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
        const profile: UserProfile = {
          uid: resp.data.uid,
          email: resp.data.email,
          displayName: resp.data.display_name || firebaseUser.displayName || '',
          photoURL: firebaseUser.photoURL || '',
          role: (resp.data.role as UserRole) || 'buyer',
          merchantId: resp.data.merchant_id ?? null,
        };
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
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          // Resolve role from backend server
          let profile: UserProfile;
          try {
            const resp = await axios.get('/api/auth/me', {
              headers: { Authorization: `Bearer ${idToken}` },
            });
            profile = {
              uid: resp.data.uid,
              email: resp.data.email,
              displayName: resp.data.display_name || fbUser.displayName || 'User',
              photoURL: fbUser.photoURL || '',
              role: (resp.data.role as UserRole) || 'buyer',
              merchantId: resp.data.merchant_id ?? null,
            };
          } catch {
            profile = {
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || 'User',
              photoURL: fbUser.photoURL || '',
              role: 'buyer',
              merchantId: null,
            };
          }

          setStore({
            user: profile,
            firebaseUser: fbUser,
            idToken,
            loading: false,
            initialized: true,
          });
        } catch (err: any) {
          console.error('Auth state resolution error:', err);
        }
      }
    });

    return unsubscribe;
  },
}));
