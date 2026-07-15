/** Client-safe All-You-Can-Learn helpers (no server imports). */

export const AYCL_PRICE_CENTS = 1999;

export const AYCL_PRICE_LABEL = "$19.99";

export const AYCL_TOKEN_STORAGE_KEY = "aycl_pending_access_token";

export function buildAyclAccessUrl(baseUrl: string, accessToken: string): string {
  return `${baseUrl.replace(/\/$/, "")}/learn/${accessToken}`;
}