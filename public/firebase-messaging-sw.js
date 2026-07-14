/* eslint-disable no-undef */
// Static service worker for Firebase Cloud Messaging background push.
// Served verbatim from the public root (not processed by Vite), so it can't
// import the app's TS config — fill in the same values as your .env's
// VITE_FIREBASE_* vars below. These are public client identifiers, safe here.
//
// This SW is separate from the vite-plugin-pwa-generated one (which handles
// offline caching). It only listens for background push messages and does
// not intercept fetch/navigation, so the two coexist without conflict.

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "__VITE_FIREBASE_API_KEY__",
  authDomain: "__VITE_FIREBASE_AUTH_DOMAIN__",
  projectId: "__VITE_FIREBASE_PROJECT_ID__",
  storageBucket: "__VITE_FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__VITE_FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__VITE_FIREBASE_APP_ID__",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  const link = payload.fcm_options?.link ?? payload.data?.link ?? "/";
  self.registration.showNotification(title ?? "Lumen", {
    body: body ?? "",
    icon: "/icon-192.png",
    data: { link },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? "/";
  event.waitUntil(clients.openWindow(link));
});
