import { ILE_SESSION_UNSAVED_EXIT_META_KEY } from "@/lib/ile-session-name";

export const DASHBOARD_PLAY_KINDS = ["learn", "verify", "calibrate"] as const;
export type DashboardPlayKind = (typeof DASHBOARD_PLAY_KINDS)[number];

export const DASHBOARD_PLAY_KIND_META_KEY = "play_kind";
export const DASHBOARD_PLAY_DISPOSABLE_META_KEY = "disposable";
export const DASHBOARD_PLAY_START_PATH = "/api/play/start";
export const DASHBOARD_PLAY_CURIOUS_PATH = "/api/play/curious";
export const DASHBOARD_PLAY_CALIBRATE_QUESTIONS_PATH = "/api/play/calibrate-questions";
export const DASHBOARD_PLAY_PROMPT_MAX = 400;
export const DASHBOARD_PLAY_CURIOUS_KIND: DashboardPlayKind = "learn";

export const DASHBOARD_PLAY_CURIOUS_SYSTEM =
  "You invent one specific, surprising topic a curious adult can learn in a short session. Reply with only the topic as one sentence or question. No quotes, labels, numbering, or extra lines.";

export function isDashboardPlayKind(value: unknown): value is DashboardPlayKind {
  return DASHBOARD_PLAY_KINDS.includes(value as DashboardPlayKind);
}

export function parseDashboardPlayKind(value: unknown): DashboardPlayKind | null {
  const kind = String(value || "").trim().toLowerCase();
  return isDashboardPlayKind(kind) ? kind : null;
}

export function normalizeDashboardPlayPrompt(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, DASHBOARD_PLAY_PROMPT_MAX);
}

export function parseCuriousPrompt(raw: unknown): string {
  const firstLine = String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  const stripped = String(firstLine || "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(topic|prompt)\s*:\s*/i, "")
    .trim();
  return normalizeDashboardPlayPrompt(stripped);
}

export function curiousPromptUserMessage(seed: string): string {
  const variety = String(seed || "").trim() || "fresh";
  return `Invent a fresh topic. Variety: ${variety}`;
}

export function dashboardPlayHref(kind: DashboardPlayKind, sessionId: string): string {
  const id = encodeURIComponent(String(sessionId || "").trim());
  if (kind === "learn") return `/session?id=${id}`;
  if (kind === "verify") return `/play/verify?id=${id}`;
  return `/play/calibrate?id=${id}`;
}

export function dashboardPlayKindLabel(kind: DashboardPlayKind): string {
  if (kind === "verify") return "Verification";
  if (kind === "calibrate") return "Calibration";
  return "Learning";
}

export function dashboardPlaySessionMetadata(kind: DashboardPlayKind): Record<string, unknown> {
  return {
    [ILE_SESSION_UNSAVED_EXIT_META_KEY]: true,
    [DASHBOARD_PLAY_DISPOSABLE_META_KEY]: true,
    [DASHBOARD_PLAY_KIND_META_KEY]: kind,
    session_mode: kind === "learn" ? "learning" : kind,
    ile_session_mode: kind === "learn" ? "learning" : kind,
  };
}

export function isDashboardPlaySession(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const rec = metadata as Record<string, unknown>;
  return rec[DASHBOARD_PLAY_DISPOSABLE_META_KEY] === true && isDashboardPlayKind(rec[DASHBOARD_PLAY_KIND_META_KEY]);
}
