import { CompactSign, compactVerify } from "jose";
import { LTI_LAUNCH_COOKIE, type LtiLaunchSession } from "@/lib/lti/session";

const COOKIE_MAX_AGE = 60 * 60 * 12;

function cookieSecret(): Uint8Array {
  const raw =
    process.env.LTI_COOKIE_SECRET ||
    process.env.ORG_SECRETS_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "lti-dev-cookie-secret";
  return new TextEncoder().encode(raw);
}

export async function encodeLaunchCookie(session: LtiLaunchSession): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(session));
  return new CompactSign(bytes).setProtectedHeader({ alg: "HS256" }).sign(cookieSecret());
}

export async function decodeLaunchCookie(token: string): Promise<LtiLaunchSession | null> {
  const value = String(token || "").trim();
  if (!value) return null;
  try {
    const { payload } = await compactVerify(value, cookieSecret());
    const session = JSON.parse(new TextDecoder().decode(payload)) as LtiLaunchSession;
    if (!session || typeof session !== "object") return null;
    if (!String(session.identity || "").trim()) return null;
    return session;
  } catch {
    return null;
  }
}

export function launchCookieOptions() {
  return {
    name: LTI_LAUNCH_COOKIE,
    httpOnly: true,
    sameSite: "none" as const,
    secure: true,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}
