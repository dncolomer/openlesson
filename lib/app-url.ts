import type { NextRequest } from "next/server";

export const DEFAULT_APP_ORIGIN = "https://uncertain.systems";

/** Canonical public origin for checkout redirects, Connect return URLs, TAP links, etc. */
export function getAppOrigin(req?: NextRequest | Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (req && "nextUrl" in req) return req.nextUrl.origin;
  if (req) return new URL(req.url).origin;
  return DEFAULT_APP_ORIGIN;
}