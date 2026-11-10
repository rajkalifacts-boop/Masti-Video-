import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  updateProfile,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCpTSbVg9OR6cnu5i4U2Iq40kAZrVBYOx4",
  authDomain: "masti-video-24740.firebaseapp.com",
  projectId: "masti-video-24740",
  storageBucket: "masti-video-24740.firebasestorage.app",
  messagingSenderId: "669297294909",
  appId: "1:669297294909:android:b75d451c103922904db454",
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function syncUserWithMastiBase(firebaseUser: any) {
  try {
    const res = await fetch('https://masti-basen.lovable.app/api/auth/firebase-login', {
      method: 'POST',
      headers: {
        'x-api-key': 'mb_live_rajkali_8789_7b31a6fe89d24643',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email || `${firebaseUser.uid}@masti.in`,
        name: firebaseUser.displayName || 'Masti Creator',
        avatarUrl: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
        username: firebaseUser.email ? firebaseUser.email.split('@')[0] : 'user_' + firebaseUser.uid.substring(0, 6),
      }),
    });
    return await res.json();
  } catch (err) {
    console.warn('[Firebase Auth] MastiBase sync error:', err);
    return null;
  }
}
