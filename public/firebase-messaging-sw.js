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
  apiKey: "AIzaSyB53glLKq2PHOMu8fRFfv_Cbs5WJ8ec4WA",
  authDomain: "lumen-planner.firebaseapp.com",
  projectId: "lumen-planner",
  storageBucket: "lumen-planner.firebasestorage.app",
  messagingSenderId: "847241440586",
  appId: "1:847241440586:web:dde329f24a70e99e3425b3",
});

const messaging = firebase.messaging();

// The server sends a data-only message (no top-level "notification" field)
// specifically so this is the ONLY place a notification gets shown — a
// message with "notification" makes the Firebase compat SW auto-display it
// in addition to calling this handler, doubling every push. Read title/body/
// link from payload.data (all FCM data values arrive as strings).
messaging.onBackgroundMessage((payload) => {
  const { title, body, link } = payload.data ?? {};
  self.registration.showNotification(title ?? "Lumen", {
    body: body ?? "",
    icon: "/icon-192.png",
    data: { link: link ?? "/" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? "/";
  event.waitUntil(clients.openWindow(link));
});
