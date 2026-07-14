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
  if (!worker) return;
  await new Promise<void>((resolve) => {
    const handleChange = () => {
      if (worker.state === "activated") {
        worker.removeEventListener("statechange", handleChange);
        resolve();
      }
    };
    worker.addEventListener("statechange", handleChange);
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

      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      await waitForActive(registration);

      const token = await getToken(messaging, {
        vapidKey: firebaseVapidKey,
        serviceWorkerRegistration: registration,
      });
      if (!token) throw new Error("getToken() não retornou um token.");

      const { error } = await supabase.from("fcm_tokens").upsert(
        {
          user_id: userId,
          token,
          platform: isIOS() ? "ios" : "android",
          user_agent: navigator.userAgent,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" },
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
