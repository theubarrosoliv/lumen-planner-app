import { initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";
import { isEmbeddedPreview } from "@/lib/runtimeEnv";
import { isMobileDevice } from "@/lib/deviceDetect";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
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

export const firebaseVapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
