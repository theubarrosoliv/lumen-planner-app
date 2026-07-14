/**
 * Real device/platform detection for gating push notifications — distinct
 * from `useIsMobile()` (src/hooks/use-mobile.tsx), which is a viewport-width
 * check for responsive layout and would wrongly treat a narrowed desktop
 * browser window as "mobile".
 */

type NavigatorWithUAData = Navigator & {
  userAgentData?: { mobile?: boolean; platform?: string };
};

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS 13+ spoofs a desktop Mac UA, but reports multi-touch.
  return /Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1;
}

export function isMobileDevice(): boolean {
  const nav = navigator as NavigatorWithUAData;
  if (typeof nav.userAgentData?.mobile === "boolean") return nav.userAgentData.mobile;
  if (isIOS()) return true;
  return /Android/.test(navigator.userAgent);
}

/** True when running as an installed PWA (standalone display mode). */
export function isStandalonePWA(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}
