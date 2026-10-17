import { ILE_SESSION_UNSAVED_EXIT_META_KEY } from "@/lib/ile-session-name";

export const DASHBOARD_PLAY_KINDS = ["learn", "verify", "calibrate"] as const;
export type DashboardPlayKind = (typeof DASHBOARD_PLAY_KINDS)[number];

export const DASHBOARD_PLAY_KIND_META_KEY = "play_kind";
export const DASHBOARD_PLAY_DISPOSABLE_META_KEY = "disposable";
export const DASHBOARD_HOME_RECENT_LIMIT = 3;
export const DASHBOARD_PLAY_START_PATH = "/api/play/start";
export const DASHBOARD_PLAY_CALIBRATE_QUESTIONS_PATH = "/api/play/calibrate-questions";
export const DASHBOARD_PLAY_PROMPT_MAX = 400;

export type DashboardPlayTopic = {
  discipline: string;
  prompt: string;
};

/** One prompt per discipline so Home can sample a mixed set. */
export const DASHBOARD_PLAY_TOPIC_POOL: readonly DashboardPlayTopic[] = [
  { discipline: "Mathematics", prompt: "Fourier series on the circle" },
  { discipline: "Physics", prompt: "The second law of thermodynamics" },
  { discipline: "Biology", prompt: "How CRISPR edits a genome" },
  { discipline: "Computer science", prompt: "What a Merkle tree actually commits to" },
  { discipline: "Economics", prompt: "Adverse selection in insurance markets" },
  { discipline: "Philosophy", prompt: "Gettier cases and knowledge as justified true belief" },
  { discipline: "History", prompt: "Why the Peace of Westphalia still matters" },
  { discipline: "Chemistry", prompt: "Why carbon forms so many stable compounds" },
  { discipline: "Law", prompt: "What strict scrutiny is asking a court to do" },
  { discipline: "Music", prompt: "How a cadence tells you a phrase has landed" },
];

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

export function pickDashboardPlayTopics(
  count = 4,
  random: () => number = Math.random,
): DashboardPlayTopic[] {
  const n = Math.max(0, Math.min(count, DASHBOARD_PLAY_TOPIC_POOL.length));
  const pool = [...DASHBOARD_PLAY_TOPIC_POOL];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = pool[i];
    pool[i] = pool[j]!;
    pool[j] = swap!;
  }
  return pool.slice(0, n);
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
