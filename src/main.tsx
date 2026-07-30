import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isEmbeddedPreview } from "./lib/runtimeEnv";
import { ErrorBoundary } from "./components/ErrorBoundary";

if (isEmbeddedPreview()) {
  // Strip any previously-installed SW + caches in preview/editor contexts.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) =>
      regs.forEach((r) => r.unregister()),
    );
    if (typeof caches !== "undefined") {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
  }
} else if ("serviceWorker" in navigator) {
  // Production / standalone: register the PWA service worker for offline use,
  // and auto-update it — no manual uninstall/reinstall needed on desktop or mobile.
  window.addEventListener("load", () => {
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        const updateSW = registerSW({
          immediate: true,
          onRegisteredSW(_url, registration) {
            if (!registration) return;
            setInterval(() => {
              registration.update().catch(() => {});
            }, 60 * 1000);
            // iOS home-screen PWAs often "wake" an already-running tab
            // instead of doing a fresh load when reopened from the icon —
            // `load` never refires, so the interval above may not have
            // ticked yet either. Re-check the instant the app is back in
            // the foreground so an update installed while it was backgrounded
            // (or fully suspended) is picked up right away instead of on
            // some later poll.
            const recheck = () => registration.update().catch(() => {});
            document.addEventListener("visibilitychange", () => {
              if (document.visibilityState === "visible") recheck();
            });
            window.addEventListener("pageshow", recheck);
          },
          onNeedRefresh() {
            updateSW(true);
          },
        });
      })
      .catch(() => {
        /* PWA module unavailable — ignore */
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// Fade out the splash screen once the app is mounted. Only shown once per session.
window.requestAnimationFrame(() => {
  const splash = document.getElementById("lumen-splash");
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add("is-hiding");
    try {
      sessionStorage.setItem("lumen-splash-shown", "1");
    } catch {
      /* ignore */
    }
    setTimeout(() => splash.remove(), 600);
  }, 1400);
});
