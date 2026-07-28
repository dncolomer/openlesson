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

/** Session UX kind — independent of facilitator `mode` ("curious"). */
export const TAP_INTERACTION_KINDS = ["conversational", "exercise"] as const;

export type TapInteractionKind = (typeof TAP_INTERACTION_KINDS)[number];

export const TAP_INTERACTION_KIND_DEFAULT: TapInteractionKind = "conversational";

export interface CreateTapLinkInput {
  minutes?: unknown;
  participant_type?: unknown;
  guest_email?: unknown;
  guest_user_id?: unknown;
  user_id?: unknown;
  post_session?: unknown;
  redirect_url?: unknown;
  completion_webhook_url?: unknown;
  /** private (default) | public — stable open URL for public links */
  access_mode?: unknown;
  accessMode?: unknown;
  /** Shorthand: true → public */
  public?: unknown;
  /** When true (default), guest UI shows End Session. */
  show_end_session?: unknown;
  showEndSession?: unknown;
  allow_end_session?: unknown;
  allowEndSession?: unknown;
  /** conversational (default) | exercise — UI shell for the TAP run */
  interaction_kind?: unknown;
  interactionKind?: unknown;
  /** Shorthand checkbox: true → exercise */
  exercise?: unknown;
  is_exercise?: unknown;
  isExercise?: unknown;
}

/**
 * Whether the guest session UI should show an End Session control.
 * Default **true** (yes) when omitted or unrecognized.
 */
export function normalizeShowEndSession(value: unknown): boolean {
  if (value === false || value === 0) return false;
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const raw = value.trim().toLowerCase();
    if (raw === "false" || raw === "0" || raw === "no" || raw === "off") return false;
    if (raw === "true" || raw === "1" || raw === "yes" || raw === "on") return true;
  }
  return true;
}

/** Resolve show_end_session from create body keys (snake/camel). Default true. */
export function resolveShowEndSessionFromBody(body: CreateTapLinkInput | Record<string, unknown>): boolean {
  const record = body as Record<string, unknown>;
  if ("show_end_session" in record) return normalizeShowEndSession(record.show_end_session);
  if ("showEndSession" in record) return normalizeShowEndSession(record.showEndSession);
  if ("allow_end_session" in record) return normalizeShowEndSession(record.allow_end_session);
  if ("allowEndSession" in record) return normalizeShowEndSession(record.allowEndSession);
  return true;
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

/** True for loopback, link-local, private RFC1918, and cloud metadata hosts. */
export function isBlockedWebhookHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");

  if (
    host === "localhost" ||
    host === "metadata.google.internal" ||
    host.endsWith(".localhost") ||
    host === "metadata" ||
    host === "0.0.0.0" ||
    host === "::" ||
    host === "::1"
  ) {
    return true;
  }

  // IPv4
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const parts = ipv4.slice(1).map((p) => Number(p));
    if (parts.some((n) => n > 255)) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  // IPv6 loopback / ULA / link-local
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
    return true;
  }

  return false;
}

/**
 * Normalize completion webhook URLs. Rejects non-http(s) and private/link-local targets (SSRF).
 */
export function normalizeWebhookUrl(value: unknown): string | null {
  const normalized = normalizeRedirectUrl(value);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    if (isBlockedWebhookHost(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
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

/**
 * Normalize TAP interaction kind. Invalid / empty → conversational (legacy default).
 */
export function normalizeTapInteractionKind(
  value: unknown,
  fallback: TapInteractionKind = TAP_INTERACTION_KIND_DEFAULT,
): TapInteractionKind {
  if (value === true || value === 1) return "exercise";
  if (value === false || value === 0) return "conversational";
  if (typeof value === "string") {
    const raw = value.trim().toLowerCase();
    if (raw === "exercise" || raw === "solo" || raw === "prompt") return "exercise";
    if (raw === "conversational" || raw === "dialogue" || raw === "chat" || raw === "conversation") {
      return "conversational";
    }
    if (raw === "true" || raw === "1" || raw === "yes" || raw === "on") return "exercise";
    if (raw === "false" || raw === "0" || raw === "no" || raw === "off") return "conversational";
  }
  return fallback;
}

/** Resolve interaction_kind from create body keys (snake/camel + exercise checkbox). */
export function resolveTapInteractionKindFromBody(
  body: CreateTapLinkInput | Record<string, unknown>,
): TapInteractionKind {
  const record = body as Record<string, unknown>;
  if ("interaction_kind" in record) return normalizeTapInteractionKind(record.interaction_kind);
  if ("interactionKind" in record) return normalizeTapInteractionKind(record.interactionKind);
  if ("exercise" in record) return normalizeTapInteractionKind(record.exercise);
  if ("is_exercise" in record) return normalizeTapInteractionKind(record.is_exercise);
  if ("isExercise" in record) return normalizeTapInteractionKind(record.isExercise);
  return TAP_INTERACTION_KIND_DEFAULT;
}
