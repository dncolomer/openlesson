export const TAP_LINK_MIN_MINUTES = 1;
export const TAP_LINK_MAX_MINUTES = 120;
export const TAP_LINK_DEFAULT_MINUTES = 15;

export const TAP_POST_SESSION_MODES = [
  "redirect_workspace",
  "show_results",
  "redirect_url",
] as const;

export type TapPostSessionMode = (typeof TAP_POST_SESSION_MODES)[number];

export const TAP_PARTICIPANT_TYPES = ["anonymous", "guest", "user"] as const;

export type TapParticipantType = (typeof TAP_PARTICIPANT_TYPES)[number];

export interface CreateTapLinkInput {
  minutes?: unknown;
  participant_type?: unknown;
  guest_email?: unknown;
  guest_user_id?: unknown;
  user_id?: unknown;
  post_session?: unknown;
  redirect_url?: unknown;
  completion_webhook_url?: unknown;
}

export function normalizeTapLinkMinutes(value: unknown, fallback = TAP_LINK_DEFAULT_MINUTES): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), TAP_LINK_MIN_MINUTES), TAP_LINK_MAX_MINUTES);
}

export function normalizeTapPostSession(value: unknown): TapPostSessionMode {
  const raw = typeof value === "string" ? value.trim() : "";
  if ((TAP_POST_SESSION_MODES as readonly string[]).includes(raw)) {
    return raw as TapPostSessionMode;
  }
  return "redirect_workspace";
}

export function normalizeTapParticipantType(value: unknown): TapParticipantType | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if ((TAP_PARTICIPANT_TYPES as readonly string[]).includes(raw)) {
    return raw as TapParticipantType;
  }
  return null;
}

export function normalizeRedirectUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeWebhookUrl(value: unknown): string | null {
  return normalizeRedirectUrl(value);
}

export function resolveTapParticipantType(input: CreateTapLinkInput): TapParticipantType | null {
  const explicit = normalizeTapParticipantType(input.participant_type);
  if (explicit) return explicit;

  const guestEmail = typeof input.guest_email === "string" ? input.guest_email.trim() : "";
  const guestUserId = typeof input.guest_user_id === "string" ? input.guest_user_id.trim() : "";
  const userId = typeof input.user_id === "string" ? input.user_id.trim() : "";

  if (userId) return "user";
  if (guestUserId || guestEmail) return "guest";
  return null;
}