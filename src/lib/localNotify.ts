import { isMobileDevice, isIOS, isStandalonePWA } from "./deviceDetect";

/**
 * Fires an instant local notification (no backend round-trip) for events
 * that happen while the app is open and foregrounded — e.g. completing the
 * last milestone of a goal. Requires permission already granted via the
 * push opt-in flow (src/hooks/use-push-notifications.tsx); no-ops otherwise.
 */
export function notifyLocal(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  if (!isMobileDevice()) return;
  if (isIOS() && !isStandalonePWA()) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icon-192.png" });
  } catch {
    /* ignore: some browsers throw if shown from a non-visible tab */
  }
}
