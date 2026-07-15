import { useCallback, useEffect, useState } from "react";
import { getToken } from "firebase/messaging";
import { toast } from "sonner";
import { getFirebaseMessaging, firebaseVapidKey } from "@/integrations/firebase/client";
import { isEmbeddedPreview } from "@/lib/runtimeEnv";
import { isMobileDevice, isIOS, isStandalonePWA } from "@/lib/deviceDetect";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";

export type PushStatus =
  | "unsupported"
  | "ios-needs-install"
  | "idle"
  | "denied"
  | "granted";

export type TokenStatus = "idle" | "registering" | "saved" | "error";

/**
 * The Firebase push SW MUST live at its own scope, not the root "/" — the
 * PWA (Workbox) service worker already owns "/" and re-registers itself every
 * 60s (autoUpdate + registration.update()). Two workers can't share a scope,
 * so registering the FCM worker at "/" would let the PWA worker clobber it,
 * silently killing the push subscription (getToken succeeds, but no
 * notification ever arrives). This is the exact scope Firebase uses by default
 * when it self-registers the SW, and it stays under "/" so no
 * Service-Worker-Allowed header is needed.
 */
const FCM_SW_SCOPE = "/firebase-cloud-messaging-push-scope";

const DEVICE_ID_KEY = "lumen-device-id";

/**
 * Stable per-installation identifier, persisted in localStorage. FCM tokens
 * rotate over time (and did on every SW re-registration during past scope
 * migrations); without a device-stable key, every rotation inserted a new
 * fcm_tokens row instead of replacing the old one, so a single phone
 * accumulated multiple still-valid tokens and got every push N times over.
 * Deduping the upsert on (user_id, device_id) instead of (user_id, token)
 * makes a rotated token overwrite its device's row.
 */
function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function computeBaseStatus(): PushStatus | null {
  if (isEmbeddedPreview() || !isMobileDevice()) return "unsupported";
  if (isIOS() && !isStandalonePWA()) return "ios-needs-install";
  if (typeof Notification === "undefined") return "unsupported";
  return null;
}

/**
 * A valid VAPID public key is a base64url-encoded uncompressed P-256 EC
 * point: exactly 65 bytes, first byte 0x04. Checking this ourselves turns
 * "applicationServerKey must contain a valid P-256 public key" (which gives
 * no hint about *why*) into a message that names the actual problem —
 * usually a mismatched/truncated env var, or quotes pasted along with the
 * value into a dashboard field.
 */
function vapidKeyError(key: string): string | null {
  try {
    const b64 = key.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bytes = atob(padded);
    if (bytes.length !== 65) {
      return `VAPID key com tamanho inválido (${bytes.length} bytes, esperado 65) — confira se o valor de VITE_FIREBASE_VAPID_KEY está completo e sem aspas/espaços extras.`;
    }
    if (bytes.charCodeAt(0) !== 0x04) {
      return "VAPID key não começa com o prefixo esperado (0x04) — confira se é a chave pública ('Web Push certificate') e não outra.";
    }
    return null;
  } catch {
    return "VAPID key não é base64url válido — confira o valor de VITE_FIREBASE_VAPID_KEY.";
  }
}

/** Resolves once the given registration has an active worker — getToken()
 * can fail or hang if called against a still-installing worker, which is
 * exactly the state a brand-new (never-before-registered) SW is in. */
async function waitForActive(registration: ServiceWorkerRegistration): Promise<void> {
  if (registration.active) return;
  const worker = registration.installing ?? registration.waiting;
  if (!worker || worker.state === "activated") return;
  await new Promise<void>((resolve) => {
    const handleChange = () => {
      if (worker.state === "activated") {
        worker.removeEventListener("statechange", handleChange);
        resolve();
      }
    };
    worker.addEventListener("statechange", handleChange);
    // The worker may have reached "activated" between the check above and
    // attaching the listener — statechange would then never fire again and
    // this promise would hang forever, leaving tokenStatus stuck on
    // "registering". Re-check once synchronously to close that race.
    if (worker.state === "activated") {
      worker.removeEventListener("statechange", handleChange);
      resolve();
    }
  });
}

export function usePushNotifications() {
  const userId = useAppStore((s) => s.currentUserId);
  const [status, setStatus] = useState<PushStatus>(() => {
    const base = computeBaseStatus();
    if (base) return base;
    return Notification.permission === "granted"
      ? "granted"
      : Notification.permission === "denied"
        ? "denied"
        : "idle";
  });
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("idle");
  const [tokenError, setTokenError] = useState<string | null>(null);

  const registerToken = useCallback(async () => {
    if (!userId) return;
    setTokenStatus("registering");
    setTokenError(null);
    try {
      const messaging = await getFirebaseMessaging();
      if (!messaging) throw new Error("Firebase Messaging indisponível neste navegador.");
      if (!firebaseVapidKey) throw new Error("VAPID key não configurada (VITE_FIREBASE_VAPID_KEY).");
      const vapidError = vapidKeyError(firebaseVapidKey);
      if (vapidError) throw new Error(vapidError);

      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: FCM_SW_SCOPE,
      });
      await waitForActive(registration);

      const token = await getToken(messaging, {
        vapidKey: firebaseVapidKey,
        serviceWorkerRegistration: registration,
      });
      if (!token) throw new Error("getToken() não retornou um token.");

      const { error } = await supabase.from("fcm_tokens").upsert(
        {
          user_id: userId,
          device_id: getDeviceId(),
          token,
          platform: isIOS() ? "ios" : "android",
          user_agent: navigator.userAgent,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_id" },
      );
      if (error) throw error;

      setTokenStatus("saved");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn("push token registration failed", e);
      setTokenStatus("error");
      setTokenError(message);
      toast.error("Falha ao registrar notificações", { description: message });
    }
  }, [userId]);

  const enable = useCallback(async () => {
    const base = computeBaseStatus();
    if (base) {
      setStatus(base);
      return;
    }
    const permission = await Notification.requestPermission();
    setStatus(permission === "granted" ? "granted" : permission === "denied" ? "denied" : "idle");
    if (permission === "granted") await registerToken();
  }, [registerToken]);

  // Re-register on foreground so a rotated FCM token doesn't go stale.
  useEffect(() => {
    if (status !== "granted") return;
    registerToken();
    const onVisible = () => {
      if (document.visibilityState === "visible") registerToken();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [status, registerToken]);

  return { status, enable, tokenStatus, tokenError };
}
