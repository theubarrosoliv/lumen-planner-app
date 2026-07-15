import { isMobileDevice, isIOS, isStandalonePWA } from "./deviceDetect";
import { isEmbeddedPreview } from "./runtimeEnv";

/**
 * Fires an instant local notification (no backend round-trip) for events
 * that happen while the app is open and foregrounded — e.g. completing a
 * task, habit, goal or project. Requires permission already granted via the
 * push opt-in flow (src/hooks/use-push-notifications.tsx); no-ops otherwise.
 *
 * Shows via the service worker registration rather than `new Notification()`:
 * iOS (16.4+, installed PWA) supports notifications ONLY through
 * ServiceWorkerRegistration.showNotification() — the `Notification`
 * constructor is unavailable there and throws, which is why the old
 * constructor-based version silently never fired on iPhone. The SW path also
 * works on Android/desktop, so it's the single path we use everywhere, with
 * the constructor kept only as a fallback for the (rare) no-SW case.
 */
export async function notifyLocal(title: string, body: string): Promise<void> {
  if (isEmbeddedPreview()) return;
  if (typeof Notification === "undefined") return;
  if (!isMobileDevice()) return;
  if (isIOS() && !isStandalonePWA()) return;
  if (Notification.permission !== "granted") return;
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, { body, icon: "/icon-192.png" });
      return;
    }
    new Notification(title, { body, icon: "/icon-192.png" });
  } catch {
    /* ignore: unsupported, blocked, or shown from a hidden tab */
  }
}
