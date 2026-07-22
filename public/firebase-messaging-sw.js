/* eslint-disable no-undef */
// Static service worker for Firebase Cloud Messaging background push.
// Served verbatim from the public root (not processed by Vite).
//
// This SW is separate from the vite-plugin-pwa-generated one (which handles
// offline caching). It only listens for background push messages and does
// not intercept fetch/navigation, so the two coexist without conflict.
//
// Deliberately does NOT use firebase-messaging-compat's onBackgroundMessage.
// That SDK adds parsing/indirection before invoking our display code, and on
// iOS Safari's Web Push implementation that extra latency is enough to blow
// past its strict "call showNotification() promptly" requirement — when that
// happens, Safari silently substitutes its own generic fallback notification
// (just the app name, no body), which is exactly the "notification only says
// 'Lumen Planner' with no message" bug. Handling the raw 'push' event
// ourselves, synchronously and with no SDK in between, is the standard fix.
// The FCM message this pairs with is a plain data payload (see
// supabase/functions/send-notifications/fcm.ts) shaped as
// `{ data: { title, body, link } }`, which is exactly `event.data.json().data`
// here.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const data = payload.data ?? {};
  const title = data.title || "Lumen";
  const body = data.body || "";
  const link = data.link || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      data: { link },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? "/";
  event.waitUntil(clients.openWindow(link));
});
