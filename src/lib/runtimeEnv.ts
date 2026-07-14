/**
 * True inside the Lovable editor preview / iframe embed. Service workers
 * (both the PWA one and Firebase's) must never run here — they cause stale
 * shells and can't complete permission/subscribe flows inside an iframe.
 */
export function isEmbeddedPreview(): boolean {
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
    (host.endsWith("lovable.app") && host.startsWith("preview--"));

  return isInIframe || isPreviewHost;
}
