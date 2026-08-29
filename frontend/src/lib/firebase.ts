/**
 * Firebase SDK Initialization — shared across Auth + RTDB.
 *
 * Reuses the same "agent-ray" Firebase project that the backend already
 * connects to via the Admin SDK. Config values come from Vite env vars
 * with hardcoded fallbacks to ensure zero startup breakage.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDn0iZb4-HKTSQy-ekCLjy_tA27O2rjcP8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'agent-ray.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'agent-ray',
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    'https://agent-ray-default-rtdb.asia-southeast1.firebasedatabase.app',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'agent-ray.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '68548329694',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:68548329694:web:7add06f31183d46b8dc24f',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const rtdb = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();
