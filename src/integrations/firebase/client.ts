import { initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";
import { isEmbeddedPreview } from "@/lib/runtimeEnv";
import { isMobileDevice } from "@/lib/deviceDetect";

/**
 * Trims whitespace/newlines and strips accidental wrapping quotes — guards
 * against the classic "pasted the .env value including the surrounding
 * quotes into a dashboard env var field" mistake, which silently corrupts
 * the VAPID key (browser rejects it with "must contain a valid P-256
 * public key") without any indication of why.
 */
function sanitizeEnvValue(v: string | undefined): string | undefined {
  if (!v) return v;
  const trimmed = v.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;
  return unquoted;
}

const firebaseConfig = {
  apiKey: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_APP_ID),
};

let app: FirebaseApp | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;

function hasFirebaseConfig(): boolean {
  return Object.values(firebaseConfig).every((v) => typeof v === "string" && v.length > 0);
}

/**
 * Lazily creates the Firebase Messaging instance, guarded so it never
 * initializes in the Lovable preview iframe, on desktop, or without config —
 * mirrors the guard rails already used for the PWA service worker in
 * src/main.tsx.
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (isEmbeddedPreview() || !isMobileDevice() || !hasFirebaseConfig()) return null;
  if (!(await isSupported())) return null;

  if (!messagingPromise) {
    messagingPromise = (async () => {
      app = app ?? initializeApp(firebaseConfig);
      return getMessaging(app);
    })();
  }
  return messagingPromise;
}

export const firebaseVapidKey = sanitizeEnvValue(import.meta.env.VITE_FIREBASE_VAPID_KEY);
