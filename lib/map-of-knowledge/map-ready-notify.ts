/**
 * Pure helpers for Map of Knowledge newsletter email capture (Find yourself not-on-map).
 * No transactional “notify when snapshot ready” send — emails are newsletter leads for export.
 */

/** User-facing copy when Find yourself resolves a link but the subject is not on the public map yet. */
export const MAP_NOT_ON_MAP_MESSAGE =
  "If you have already finished the session, it can take a while to appear on the map. We run periodic snapshots of practice data, so your location may lag until the next pass. Leave your email below for the Uncertain Systems newsletter — we share product updates periodically (including map tips).";

/** Disclaimer shown next to the email field. */
export const MAP_NEWSLETTER_SUBSCRIBE_NOTE =
  "By adding your email you are subscribing to the Uncertain Systems newsletter.";

export const MAP_NEWSLETTER_SUCCESS_MESSAGE =
  "Thanks — you're on the Uncertain Systems newsletter list. Keep your session link for Find yourself once your location appears.";

/** Normalize + validate email for newsletter registration. */
export function normalizeNotifyEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function isValidNotifyEmail(value: unknown): boolean {
  return normalizeNotifyEmail(value) !== null;
}

/** Register payload validation (email only — newsletter lead). */
export function validateMapNewsletterRegistration(input: {
  email: unknown;
}):
  | { ok: true; email: string }
  | { ok: false; error: string; code: "invalid_email" } {
  const email = normalizeNotifyEmail(input.email);
  if (!email) {
    return { ok: false, error: "Enter a valid email address.", code: "invalid_email" };
  }
  return { ok: true, email };
}

/** @deprecated Use validateMapNewsletterRegistration — kept for call-site clarity. */
export function validateMapReadyNotifyRegistration(input: {
  email: unknown;
  guest_user_id?: unknown;
  workspace_id?: unknown;
}):
  | { ok: true; email: string; guest_user_id: string; workspace_id: string }
  | { ok: false; error: string; code: "invalid_email" | "missing_identity" } {
  const emailOnly = validateMapNewsletterRegistration(input);
  if (!emailOnly.ok) return emailOnly;
  // Guest/workspace optional for newsletter; empty strings when absent.
  const guest =
    typeof input.guest_user_id === "string" ? input.guest_user_id.trim() : "";
  const ws = typeof input.workspace_id === "string" ? input.workspace_id.trim() : "";
  return {
    ok: true,
    email: emailOnly.email,
    guest_user_id: guest,
    workspace_id: ws,
  };
}
