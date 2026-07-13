import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Detect Lovable preview / iframe contexts. Service workers must NEVER run
// here — they cause stale shells inside the editor preview.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host.includes("lovableproject-dev.com") ||
  host.endsWith("lovable.app") && host.startsWith("preview--");

if (isInIframe || isPreviewHost) {
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
  // Production / standalone: register the PWA service worker for offline use.
  window.addEventListener("load", () => {
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        registerSW({ immediate: true });
      })
      .catch(() => {
        /* PWA module unavailable — ignore */
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

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
