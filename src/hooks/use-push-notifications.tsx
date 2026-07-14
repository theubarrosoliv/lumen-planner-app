import { useCallback, useEffect, useState } from "react";
import { getToken } from "firebase/messaging";
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

function computeBaseStatus(): PushStatus | null {
  if (isEmbeddedPreview() || !isMobileDevice()) return "unsupported";
  if (isIOS() && !isStandalonePWA()) return "ios-needs-install";
  if (typeof Notification === "undefined") return "unsupported";
  return null;
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

  const registerToken = useCallback(async () => {
    if (!userId) return;
    const messaging = await getFirebaseMessaging();
    if (!messaging || !firebaseVapidKey) return;
    try {
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const token = await getToken(messaging, {
        vapidKey: firebaseVapidKey,
        serviceWorkerRegistration: registration,
      });
      if (!token) return;
      await supabase.from("fcm_tokens").upsert(
        {
          user_id: userId,
          token,
          platform: isIOS() ? "ios" : "android",
          user_agent: navigator.userAgent,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" },
      );
    } catch (e) {
      console.warn("push token registration failed", e);
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

  return { status, enable };
}
