/**
 * Pure helpers for “notify me when my Map of Knowledge location is ready”.
 */

/** User-facing copy when Find yourself resolves a link but the subject is not on the public map yet. */
export const MAP_NOT_ON_MAP_MESSAGE =
  "If you have already finished the session, it can take a while to appear on the map. We run periodic snapshots of practice data, so your location may lag until the next pass. Leave your email and we will notify you when your map location is ready.";

export type MapReadyNotifyRequestLike = {
  id: string;
  email: string;
  guest_user_id: string;
  workspace_id: string;
  notified_at?: string | null;
};

/** Normalize + validate email for notify registration. */
export function normalizeNotifyEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  // Practical RFC-ish check (not full RFC5322).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function isValidNotifyEmail(value: unknown): boolean {
  return normalizeNotifyEmail(value) !== null;
}

/**
 * Whether a pending notify request should fire given subject presence on the map
 * (same readiness as successful Find yourself).
 */
export function shouldNotifyMapReadyRequest(
  request: Pick<MapReadyNotifyRequestLike, "notified_at" | "email" | "guest_user_id" | "workspace_id">,
  subjectPresentOnMap: boolean,
): boolean {
  if (!subjectPresentOnMap) return false;
  if (request.notified_at) return false;
  if (!normalizeNotifyEmail(request.email)) return false;
  if (!String(request.guest_user_id || "").trim()) return false;
  if (!String(request.workspace_id || "").trim()) return false;
  return true;
}

/** Build outbound email content for a ready map location. */
export function buildMapReadyNotifyEmail(input: {
  email: string;
  mapUrl: string;
  workspaceTitle?: string | null;
}): { to: string; subject: string; text: string; html: string } {
  const to = normalizeNotifyEmail(input.email) || String(input.email || "").trim();
  const mapUrl = (input.mapUrl || "").trim() || "https://uncertain.systems/map-of-knowledge";
  const ws =
    typeof input.workspaceTitle === "string" && input.workspaceTitle.trim()
      ? input.workspaceTitle.trim()
      : "your public workspace";
  const subject = "Your Map of Knowledge location is ready";
  const text = [
    "Your practice snapshot is ready on the Map of Knowledge.",
    "",
    `Workspace: ${ws}`,
    "",
    "Open Find yourself on the map and paste your saved session link to focus on your location:",
    mapUrl,
    "",
    "— Uncertain Systems",
  ].join("\n");
  const html = `
    <p>Your practice snapshot is ready on the <strong>Map of Knowledge</strong>.</p>
    <p>Workspace: ${escapeHtml(ws)}</p>
    <p>
      Open <strong>Find yourself</strong> on the map and paste your saved session link to focus on your location:<br/>
      <a href="${escapeHtml(mapUrl)}">${escapeHtml(mapUrl)}</a>
    </p>
    <p>— Uncertain Systems</p>
  `.trim();
  return { to, subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Register payload validation (pure). */
export function validateMapReadyNotifyRegistration(input: {
  email: unknown;
  guest_user_id: unknown;
  workspace_id: unknown;
}):
  | { ok: true; email: string; guest_user_id: string; workspace_id: string }
  | { ok: false; error: string; code: "invalid_email" | "missing_identity" } {
  const email = normalizeNotifyEmail(input.email);
  if (!email) {
    return { ok: false, error: "Enter a valid email address.", code: "invalid_email" };
  }
  const guest = typeof input.guest_user_id === "string" ? input.guest_user_id.trim() : "";
  const ws = typeof input.workspace_id === "string" ? input.workspace_id.trim() : "";
  if (!guest || !ws) {
    return {
      ok: false,
      error: "Resolve your placement link first so we know who to notify.",
      code: "missing_identity",
    };
  }
  return { ok: true, email, guest_user_id: guest, workspace_id: ws };
}
