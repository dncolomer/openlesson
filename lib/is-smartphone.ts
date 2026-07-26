/**
 * Client-side smartphone detection for TAP / ILE desktop-only gate.
 * Pure helpers are unit-tested; browser checks use navigator + viewport.
 */

/** UA tokens that strongly indicate a phone (not desktop). */
const SMARTPHONE_UA_RE =
  /Android.*Mobile|iPhone|iPod|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini|Mobile.*Firefox|Mobi/i;

/**
 * True when the user-agent looks like a smartphone.
 * Tablets (iPad without "Mobile", large Android tablets) are not blocked by UA alone.
 */
export function isSmartphoneUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || !String(userAgent).trim()) return false;
  return SMARTPHONE_UA_RE.test(String(userAgent));
}

/**
 * True for phone-class viewports (narrow width). Used with UA for resize/orientation.
 * 768 matches existing SessionView mobile breakpoint.
 */
export function isSmartphoneViewport(width: number): boolean {
  return Number.isFinite(width) && width > 0 && width < 768;
}

/**
 * Combined client check: smartphone UA **or** narrow viewport.
 * Call only in the browser (uses window / navigator).
 */
export function isSmartphoneClient(
  options?: {
    userAgent?: string | null;
    width?: number | null;
  },
): boolean {
  if (typeof window === "undefined" && options?.userAgent == null && options?.width == null) {
    return false;
  }
  const ua =
    options?.userAgent ??
    (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const width =
    options?.width ??
    (typeof window !== "undefined" ? window.innerWidth : 0);
  return isSmartphoneUserAgent(ua) || isSmartphoneViewport(width);
}
