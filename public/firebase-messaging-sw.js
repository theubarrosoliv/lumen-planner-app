/* eslint-disable no-undef */
// Static service worker for Firebase Cloud Messaging background push.
// Served verbatim from the public root (not processed by Vite).
//
// This SW is separate from the vite-plugin-pwa-generated one (which handles
// offline caching). It only listens for background push messages and does
// not intercept fetch/navigation, so the two coexist without conflict.
//
// Deliberately does NOT load firebase-messaging-compat. That SDK's service
// worker AUTO-DISPLAYS any message that carries a "notification" block AND
// still calls onBackgroundMessage — so every push showed up twice. Handling
// the raw 'push' event ourselves means exactly one notification is shown, no
// matter what the payload contains. The server (see
// supabase/functions/send-notifications/fcm.ts) sends both a "notification"
// block (required for reliable delivery on iOS Safari Web Push) and a "data"
// block (carries the click link, plus title/body as a fallback). We read
// whichever is present so a notification is never blank.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const n = payload.notification || {};
  const d = payload.data || {};
  const title = n.title || d.title || "Lumen";
  const body = n.body || d.body || "";
  const link = d.link || (payload.fcm_options && payload.fcm_options.link) || "/";

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
