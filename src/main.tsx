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
            if (registration) {
              setInterval(() => {
                registration.update().catch(() => {});
              }, 60 * 1000);
            }
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
