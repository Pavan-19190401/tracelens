import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";

export interface FirebaseCredentials {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const DEFAULT_CONFIG: FirebaseCredentials = {
  apiKey: "AIzaSyBFzaiw7zlklsh4AFUB3n_aVhbwu24LD2A",
  authDomain: "llm1-772fa.firebaseapp.com",
  projectId: "llm1-772fa",
  storageBucket: "llm1-772fa.firebasestorage.app",
  messagingSenderId: "192727695140",
  appId: "1:192727695140:web:224a2e4ad202e2e9577db1",
};

export function getFirebaseConfig(): FirebaseCredentials {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("tracelens_firebase_config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.apiKey && parsed.authDomain && parsed.projectId) {
          return parsed;
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || DEFAULT_CONFIG.apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || DEFAULT_CONFIG.authDomain,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || DEFAULT_CONFIG.projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || DEFAULT_CONFIG.storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_CONFIG.messagingSenderId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || DEFAULT_CONFIG.appId,
  };
}

export function isFirebaseConfigured(): boolean {
  const cfg = getFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;
  const cfg = getFirebaseConfig();
  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId) {
    return null;
  }
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(cfg);
    auth = getAuth(app);
    return auth;
  } catch (e) {
    console.warn("Failed to initialize Firebase App:", e);
    return null;
  }
}

export function saveFirebaseConfig(config: FirebaseCredentials): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("tracelens_firebase_config", JSON.stringify(config));
    auth = null;
    app = null;
    getFirebaseAuth();
  }
}

/**
 * Trigger Real Google Sign-in Popup
 */
export async function signInWithGoogle() {
  const currentAuth = getFirebaseAuth();
  if (!currentAuth) {
    throw new Error(
      "REAL_AUTH_REQUIRED: Firebase credentials are required for genuine Google account login."
    );
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(currentAuth, provider);
  return result.user;
}

/**
 * Trigger Real GitHub Sign-in Popup
 */
export async function signInWithGithub() {
  const currentAuth = getFirebaseAuth();
  if (!currentAuth) {
    throw new Error(
      "REAL_AUTH_REQUIRED: Firebase credentials are required for genuine GitHub account login."
    );
  }
  const provider = new GithubAuthProvider();
  const result = await signInWithPopup(currentAuth, provider);
  return result.user;
}

/**
 * Send real SMS verification code to mobile number using Firebase Phone Auth
 */
export async function sendFirebasePhoneOtp(
  phoneNumber: string,
  containerId: string = "recaptcha-container"
): Promise<ConfirmationResult> {
  const currentAuth = getFirebaseAuth();
  if (!currentAuth) {
    throw new Error(
      "REAL_AUTH_REQUIRED: Firebase credentials are required for live carrier SMS OTP delivery."
    );
  }

  // Clear previous verifier if any
  if (typeof window !== "undefined" && (window as any).recaptchaVerifier) {
    try {
      (window as any).recaptchaVerifier.clear();
    } catch {
      // ignore
    }
  }

  const verifier = new RecaptchaVerifier(currentAuth, containerId, {
    size: "invisible",
    callback: () => {
      // reCAPTCHA solved
    },
    "expired-callback": () => {
      console.warn("reCAPTCHA expired. Please try again.");
    },
  });

  if (typeof window !== "undefined") {
    (window as any).recaptchaVerifier = verifier;
  }

  return signInWithPhoneNumber(currentAuth, phoneNumber, verifier);
}
