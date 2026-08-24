/**
 * Public Snapshot share — mint a token for one eval_run_history row and
 * project that frozen report onto a Snapshot landing view-model.
 *
 * Public read is token-keyed. Unpublished snapshots are not in the share
 * store, so looking them up (or any garbage token) returns no payload.
 * Tests use the memory backend; the app uses the Supabase admin backend
 * so eval_run_history RLS is never opened to anonymous visitors.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createPrivateToken, hashPrivateToken } from "@/lib/private-token";
import { normalizeEvaluatedGoals, type EvaluatedGoal } from "@/lib/pow-api/goals";
import { getEvalRunHistoryById } from "@/lib/pow-api/eval-run-history-store";
import {
  LWM_CLIENT_LABELS,
} from "@/lib/pow-api/lwm-snapshot-interpretability";
import {
  normalizePerformanceGapAnalysis,
  type PerformanceGapItem,
  type PerformanceMarkerScore,
  type VerticalScoreReport,
} from "@/lib/pow-api/performance-report";

export const SNAPSHOT_SHARE_PUBLIC_PATH = "/snapshot";

export const SNAPSHOT_LANDING_SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "goals", label: "Goals" },
  { id: "summary", label: "Summary" },
  { id: "markers", label: "Markers" },
  { id: "strengths", label: "Strengths" },
  { id: "gaps", label: "Gaps" },
  { id: "next_steps", label: "Next steps" },
  { id: "details", label: "Details" },
] as const;

export type SnapshotLandingSectionId =
  (typeof SNAPSHOT_LANDING_SECTIONS)[number]["id"];

export type SnapshotLandingMarker = {
  id: string;
  label: string;
  score: number;
  rationale: string;
};

export type SnapshotLandingGoal = EvaluatedGoal;

export type SnapshotLandingGap = {
  title: string;
  proof_of_work: string;
  severity: string;
  suggested_repair: string;
};

export type SnapshotLandingView = {
  snapshot_id: string;
  workspace_id: string;
  ran_at: string | null;
  source: string | null;
  skill_score: number;
  authenticity_score: number | null;
  skill_label: string;
  authenticity_label: string;
  profile: { markers: SnapshotLandingMarker[] };
  goals: {
    evaluated_goals: SnapshotLandingGoal[];
    workspace_goal: string;
  };
  summary: {
    text: string;
    growth_areas: string[];
    suggestions: string[];
  };
  markers: SnapshotLandingMarker[];
  strengths: string[];
  gaps: {
    summary: string;
    items: SnapshotLandingGap[];
  };
  next_steps: {
    directions: string[];
    events: string[];
  };
  details: {
    source: string | null;
    ran_at: string | null;
    confidence: string | null;
    ghc_confidence: string | null;
    temporal_summary: string | null;
  };
};

export type SnapshotShareSnapshot = {
  id: string;
  workspace_id: string;
  report: unknown;
  ran_at: string | null;
  source: string | null;
  score: number;
  ghc_score: number | null;
  workspace_goal: string | null;
  evaluated_goals?: unknown;
};

export type SnapshotShareRow = {
  token: string;
  snapshot_id: string;
  workspace_id: string;
};

export type SnapshotShareBackend = {
  getShareByToken(token: string): Promise<SnapshotShareRow | null>;
  getShareBySnapshotId(snapshotId: string): Promise<SnapshotShareRow | null>;
  insertShare(row: SnapshotShareRow): Promise<void>;
  getSnapshot(snapshotId: string): Promise<SnapshotShareSnapshot | null>;
};

export type GenerateSnapshotShareResult =
  | {
      ok: true;
      token: string;
      url: string;
      path: string;
      landing: SnapshotLandingView;
    }
  | { ok: false; code: "snapshot_not_found" };

export function normalizeSnapshotShareToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createSnapshotShareToken(): string {
  return createPrivateToken();
}

export function hashSnapshotShareToken(token: string): string {
  return hashPrivateToken(token);
}

export function snapshotSharePublicPath(token: string): string {
  const normalized = normalizeSnapshotShareToken(token);
  if (!normalized) return SNAPSHOT_SHARE_PUBLIC_PATH;
  return `${SNAPSHOT_SHARE_PUBLIC_PATH}/${encodeURIComponent(normalized)}`;
}

export function buildSnapshotShareUrl(origin: string, token: string): string {
  const base = String(origin || "").replace(/\/$/, "");
  return `${base}${snapshotSharePublicPath(token)}`;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function asReport(raw: unknown): VerticalScoreReport | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as VerticalScoreReport;
}

function projectMarkers(raw: unknown): SnapshotLandingMarker[] {
  if (!Array.isArray(raw)) return [];
  const out: SnapshotLandingMarker[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Partial<PerformanceMarkerScore>;
    const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : "";
    const label =
      typeof rec.label === "string" && rec.label.trim() ? rec.label.trim() : "";
    const score = Number(rec.score);
    if (!id || !label || !Number.isFinite(score)) continue;
    out.push({
      id,
      label,
      score: Math.max(0, Math.min(100, Math.round(score))),
      rationale:
        typeof rec.rationale === "string" && rec.rationale.trim()
          ? rec.rationale.trim()
          : "",
    });
  }
  return out;
}

function projectGaps(items: PerformanceGapItem[]): SnapshotLandingGap[] {
  return items.map((gap) => ({
    title: gap.title,
    proof_of_work: gap.proof_of_work,
    severity: gap.severity,
    suggested_repair: gap.suggested_repair,
  }));
}

export function projectSnapshotLandingView(input: {
  snapshot: SnapshotShareSnapshot;
}): SnapshotLandingView {
  const report = asReport(input.snapshot.report);
  const markers = projectMarkers(report?.marker_scores);
  const evaluatedFromReport = normalizeEvaluatedGoals(report?.evaluated_goals);
  const evaluatedFromRow = normalizeEvaluatedGoals(input.snapshot.evaluated_goals);
  const evaluated_goals =
    evaluatedFromRow.length > 0 ? evaluatedFromRow : evaluatedFromReport;
  const gapAnalysis = normalizePerformanceGapAnalysis(report?.gap_analysis ?? null);
  const workspaceGoal =
    (typeof report?.workspace_goal === "string" && report.workspace_goal.trim()
      ? report.workspace_goal.trim()
      : "") ||
    (typeof input.snapshot.workspace_goal === "string" &&
    input.snapshot.workspace_goal.trim()
      ? input.snapshot.workspace_goal.trim()
      : "");
  const skill = Number.isFinite(input.snapshot.score)
    ? Math.max(0, Math.min(100, Math.round(input.snapshot.score)))
    : Number.isFinite(Number(report?.score))
      ? Math.max(0, Math.min(100, Math.round(Number(report?.score))))
      : 0;
  const authenticity =
    input.snapshot.ghc_score != null && Number.isFinite(input.snapshot.ghc_score)
      ? Math.max(0, Math.min(100, Math.round(input.snapshot.ghc_score)))
      : report?.ghc_score != null && Number.isFinite(Number(report.ghc_score))
        ? Math.max(0, Math.min(100, Math.round(Number(report.ghc_score))))
        : null;

  return {
    snapshot_id: input.snapshot.id,
    workspace_id: input.snapshot.workspace_id,
    ran_at: input.snapshot.ran_at,
    source: input.snapshot.source,
    skill_score: skill,
    authenticity_score: authenticity,
    skill_label: LWM_CLIENT_LABELS.primary_score_short,
    authenticity_label: LWM_CLIENT_LABELS.ghc_score_short,
    profile: { markers },
    goals: {
      evaluated_goals,
      workspace_goal: workspaceGoal,
    },
    summary: {
      text:
        typeof report?.summary === "string" && report.summary.trim()
          ? report.summary.trim()
          : "",
      growth_areas: asStringList(report?.growth_areas),
      suggestions: asStringList(report?.suggestions),
    },
    markers,
    strengths: asStringList(report?.strengths),
    gaps: {
      summary: gapAnalysis.summary,
      items: projectGaps(gapAnalysis.gaps),
    },
    next_steps: {
      directions: gapAnalysis.next_steps.directions,
      events: gapAnalysis.next_steps.events,
    },
    details: {
      source: input.snapshot.source,
      ran_at: input.snapshot.ran_at,
      confidence:
        typeof report?.confidence === "string" && report.confidence.trim()
          ? report.confidence.trim()
          : null,
      ghc_confidence:
        typeof report?.ghc_confidence === "string" && report.ghc_confidence.trim()
          ? report.ghc_confidence.trim()
          : null,
      temporal_summary:
        typeof report?.temporal_summary === "string" &&
        report.temporal_summary.trim()
          ? report.temporal_summary.trim()
          : null,
    },
  };
}

export function classifySnapshotShareLookup(
  record: SnapshotShareRow | null,
): "found" | "missing" {
  return record && normalizeSnapshotShareToken(record.token) ? "found" : "missing";
}

export async function generateSnapshotShare(
  backend: SnapshotShareBackend,
  input: {
    snapshotId: string;
    origin: string;
    createToken?: () => string;
  },
): Promise<GenerateSnapshotShareResult> {
  const snapshotId = String(input.snapshotId || "").trim();
  if (!snapshotId) return { ok: false, code: "snapshot_not_found" };

  const snapshot = await backend.getSnapshot(snapshotId);
  if (!snapshot) return { ok: false, code: "snapshot_not_found" };

  const existing = await backend.getShareBySnapshotId(snapshotId);
  const token = existing?.token
    ? existing.token
    : (input.createToken ?? createSnapshotShareToken)();
  if (!existing) {
    await backend.insertShare({
      token,
      snapshot_id: snapshot.id,
      workspace_id: snapshot.workspace_id,
    });
  }

  const landing = projectSnapshotLandingView({ snapshot });
  const path = snapshotSharePublicPath(token);
  return {
    ok: true,
    token,
    path,
    url: buildSnapshotShareUrl(input.origin, token),
    landing,
  };
}

export async function lookupSnapshotShare(
  backend: SnapshotShareBackend,
  token: unknown,
): Promise<SnapshotLandingView | null> {
  const normalized = normalizeSnapshotShareToken(token);
  if (!normalized) return null;
  const share = await backend.getShareByToken(normalized);
  if (classifySnapshotShareLookup(share) !== "found" || !share) return null;
  const snapshot = await backend.getSnapshot(share.snapshot_id);
  if (!snapshot) return null;
  return projectSnapshotLandingView({ snapshot });
}

export type MemorySnapshotSeed = {
  id: string;
  workspaceId: string;
  report: unknown;
  ranAt?: string | null;
  source?: string | null;
  score?: number;
  ghcScore?: number | null;
  workspaceGoal?: string | null;
  evaluatedGoals?: unknown;
};

export function createMemorySnapshotShareBackend(
  seeds: MemorySnapshotSeed[] = [],
): SnapshotShareBackend {
  const snapshots = new Map<string, SnapshotShareSnapshot>();
  const byToken = new Map<string, SnapshotShareRow>();
  const bySnapshotId = new Map<string, SnapshotShareRow>();

  for (const seed of seeds) {
    const report = asReport(seed.report);
    snapshots.set(seed.id, {
      id: seed.id,
      workspace_id: seed.workspaceId,
      report: seed.report,
      ran_at: seed.ranAt ?? null,
      source: seed.source ?? null,
      score:
        seed.score != null && Number.isFinite(seed.score)
          ? seed.score
          : Number(report?.score) || 0,
      ghc_score:
        seed.ghcScore != null && Number.isFinite(seed.ghcScore)
          ? seed.ghcScore
          : report?.ghc_score != null && Number.isFinite(Number(report.ghc_score))
            ? Number(report.ghc_score)
            : null,
      workspace_goal: seed.workspaceGoal ?? report?.workspace_goal ?? null,
      evaluated_goals: seed.evaluatedGoals ?? report?.evaluated_goals,
    });
  }

  return {
    async getShareByToken(token) {
      const normalized = normalizeSnapshotShareToken(token);
      if (!normalized) return null;
      return byToken.get(normalized) ?? null;
    },
    async getShareBySnapshotId(snapshotId) {
      return bySnapshotId.get(snapshotId) ?? null;
    },
    async insertShare(row) {
      byToken.set(row.token, row);
      bySnapshotId.set(row.snapshot_id, row);
    },
    async getSnapshot(snapshotId) {
      return snapshots.get(snapshotId) ?? null;
    },
  };
}

export function createSupabaseSnapshotShareBackend(
  supabase: SupabaseClient,
): SnapshotShareBackend {
  return {
    async getShareByToken(token) {
      const normalized = normalizeSnapshotShareToken(token);
      if (!normalized) return null;
      const { data, error } = await supabase
        .from("eval_run_snapshot_shares")
        .select("share_token, eval_run_history_id, workspace_id")
        .eq("share_token", normalized)
        .maybeSingle();
      if (error || !data) return null;
      const shareToken =
        typeof data.share_token === "string" ? data.share_token : "";
      const snapshotId =
        typeof data.eval_run_history_id === "string"
          ? data.eval_run_history_id
          : "";
      const workspaceId =
        typeof data.workspace_id === "string" ? data.workspace_id : "";
      if (!shareToken || !snapshotId) return null;
      return {
        token: shareToken,
        snapshot_id: snapshotId,
        workspace_id: workspaceId,
      };
    },
    async getShareBySnapshotId(snapshotId) {
      const id = String(snapshotId || "").trim();
      if (!id) return null;
      const { data, error } = await supabase
        .from("eval_run_snapshot_shares")
        .select("share_token, eval_run_history_id, workspace_id")
        .eq("eval_run_history_id", id)
        .maybeSingle();
      if (error || !data) return null;
      const shareToken =
        typeof data.share_token === "string" ? data.share_token : "";
      const rowSnapshotId =
        typeof data.eval_run_history_id === "string"
          ? data.eval_run_history_id
          : "";
      const workspaceId =
        typeof data.workspace_id === "string" ? data.workspace_id : "";
      if (!shareToken || !rowSnapshotId) return null;
      return {
        token: shareToken,
        snapshot_id: rowSnapshotId,
        workspace_id: workspaceId,
      };
    },
    async insertShare(row) {
      const { error } = await supabase.from("eval_run_snapshot_shares").insert({
        eval_run_history_id: row.snapshot_id,
        workspace_id: row.workspace_id,
        share_token: row.token,
      });
      if (error) {
        throw new Error(error.message || "Failed to persist snapshot share");
      }
    },
    async getSnapshot(snapshotId) {
      const row = await getEvalRunHistoryById(supabase, snapshotId);
      if (!row) return null;
      return {
        id: row.id,
        workspace_id: row.workspace_id,
        report: row.report,
        ran_at: row.ran_at,
        source: row.source,
        score: row.score,
        ghc_score: row.ghc_score,
        workspace_goal: row.workspace_goal,
        evaluated_goals: row.evaluated_goals,
      };
    },
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listHtml(items: string[], empty: string): string {
  if (items.length === 0) {
    return `<p class="empty">${escapeHtml(empty)}</p>`;
  }
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

/** Public landing HTML (same sections as Learning Profiles detail). */
export function renderSnapshotLandingHtml(view: SnapshotLandingView): string {
  const ran =
    view.ran_at && Number.isFinite(Date.parse(view.ran_at))
      ? new Date(view.ran_at).toISOString()
      : view.ran_at || "";
  const profileBody =
    view.profile.markers.length > 0
      ? `<ul class="markers">${view.profile.markers
          .map(
            (m) =>
              `<li><strong>${escapeHtml(m.label)}</strong> ${m.score}${
                m.rationale ? ` — ${escapeHtml(m.rationale)}` : ""
              }</li>`,
          )
          .join("")}</ul>`
      : `<p class="empty">No spider markers on this snapshot.</p>`;
  const goalsBody =
    view.goals.evaluated_goals.length > 0
      ? `<ul>${view.goals.evaluated_goals
          .map(
            (g) =>
              `<li><span class="scope">${escapeHtml(g.scope)}</span> ${escapeHtml(g.text)}</li>`,
          )
          .join("")}</ul>`
      : view.goals.workspace_goal
        ? `<p>${escapeHtml(view.goals.workspace_goal)}</p>`
        : `<p class="empty">No goals recorded on this snapshot.</p>`;
  const summaryBits: string[] = [];
  if (view.summary.text) {
    summaryBits.push(`<p>${escapeHtml(view.summary.text)}</p>`);
  } else {
    summaryBits.push(`<p class="empty">No summary on this snapshot.</p>`);
  }
  if (view.summary.growth_areas.length > 0) {
    summaryBits.push(
      `<h3>Growth areas</h3>${listHtml(view.summary.growth_areas, "")}`,
    );
  }
  if (view.summary.suggestions.length > 0) {
    summaryBits.push(
      `<h3>Suggestions</h3>${listHtml(view.summary.suggestions, "")}`,
    );
  }
  const markersBody =
    view.markers.length > 0
      ? `<ul class="markers">${view.markers
          .map(
            (m) =>
              `<li><strong>${escapeHtml(m.label)}</strong> ${m.score}${
                m.rationale ? ` — ${escapeHtml(m.rationale)}` : ""
              }</li>`,
          )
          .join("")}</ul>`
      : `<p class="empty">No markers on this snapshot.</p>`;
  const gapsBody =
    view.gaps.items.length > 0
      ? `${view.gaps.summary ? `<p>${escapeHtml(view.gaps.summary)}</p>` : ""}<ul>${view.gaps.items
          .map(
            (g) =>
              `<li><strong>${escapeHtml(g.title)}</strong>${
                g.proof_of_work ? ` — ${escapeHtml(g.proof_of_work)}` : ""
              }${
                g.suggested_repair
                  ? ` Repair: ${escapeHtml(g.suggested_repair)}`
                  : ""
              }</li>`,
          )
          .join("")}</ul>`
      : `<p class="empty">${escapeHtml(view.gaps.summary || "No gaps identified.")}</p>`;
  const nextBits: string[] = [];
  if (view.next_steps.directions.length === 0 && view.next_steps.events.length === 0) {
    nextBits.push(`<p class="empty">No next steps on this snapshot.</p>`);
  } else {
    if (view.next_steps.directions.length > 0) {
      nextBits.push(
        `<h3>Directions</h3>${listHtml(view.next_steps.directions, "")}`,
      );
    }
    if (view.next_steps.events.length > 0) {
      nextBits.push(`<h3>Events</h3>${listHtml(view.next_steps.events, "")}`);
    }
  }
  const detailBits: string[] = [];
  if (view.details.source) {
    detailBits.push(`<p>Source: ${escapeHtml(view.details.source)}</p>`);
  }
  if (ran) detailBits.push(`<p>Ran at: ${escapeHtml(ran)}</p>`);
  if (view.details.confidence) {
    detailBits.push(`<p>Confidence: ${escapeHtml(view.details.confidence)}</p>`);
  }
  if (view.details.ghc_confidence) {
    detailBits.push(
      `<p>Authenticity confidence: ${escapeHtml(view.details.ghc_confidence)}</p>`,
    );
  }
  if (view.details.temporal_summary) {
    detailBits.push(`<p>${escapeHtml(view.details.temporal_summary)}</p>`);
  }
  if (detailBits.length === 0) {
    detailBits.push(`<p class="empty">No extra evidence metadata.</p>`);
  }

  const sections: Record<SnapshotLandingSectionId, string> = {
    profile: profileBody,
    goals: goalsBody,
    summary: summaryBits.join(""),
    markers: markersBody,
    strengths: listHtml(view.strengths, "No strengths listed."),
    gaps: gapsBody,
    next_steps: nextBits.join(""),
    details: detailBits.join(""),
  };

  const sectionHtml = SNAPSHOT_LANDING_SECTIONS.map(
    (section) =>
      `<section id="snapshot-${section.id}" data-snapshot-landing-section="${section.id}">
        <h2>${escapeHtml(section.label)}</h2>
        ${sections[section.id]}
      </section>`,
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Learning snapshot</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; min-height: 100vh; background: #0a0a0a; color: #ededed;
      font-family: system-ui, -apple-system, sans-serif; }
    main { max-width: 52rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    .eyebrow { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #737373; }
    h1 { font-size: 1.75rem; margin: 0.4rem 0 1.25rem; }
    .scores { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 2rem; }
    .score { min-width: 7rem; background: #fff; color: #0a0a0a; padding: 0.85rem 1rem; }
    .score p { margin: 0; font-size: 11px; color: #525252; }
    .score strong { display: block; font-size: 2rem; font-variant-numeric: tabular-nums; }
    section { border-top: 1px solid #262626; padding: 1.25rem 0; min-height: 4rem; }
    h2 { font-size: 1.05rem; margin: 0 0 0.65rem; }
    h3 { font-size: 0.8rem; color: #a3a3a3; margin: 0.8rem 0 0.35rem; }
    p, li { font-size: 0.95rem; line-height: 1.55; color: #d4d4d4; }
    ul { margin: 0; padding-left: 1.15rem; }
    .empty { color: #737373; }
    .scope { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #737373; }
  </style>
</head>
<body>
  <main data-snapshot-landing data-snapshot-id="${escapeHtml(view.snapshot_id)}">
    <p class="eyebrow">Public snapshot</p>
    <h1>Learning snapshot</h1>
    <div class="scores" data-snapshot-landing-scores>
      <div class="score" data-snapshot-skill-score>
        <p>${escapeHtml(view.skill_label)}</p>
        <strong>${view.skill_score}</strong>
      </div>
      <div class="score" data-snapshot-authenticity-score>
        <p>${escapeHtml(view.authenticity_label)}</p>
        <strong>${view.authenticity_score != null ? view.authenticity_score : "—"}</strong>
      </div>
    </div>
    ${sectionHtml}
  </main>
</body>
</html>`;
}

export function renderSnapshotMissingHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Snapshot not found</title>
  <style>
    body { margin: 0; min-height: 100vh; background: #0a0a0a; color: #a3a3a3;
      font-family: system-ui, sans-serif; display: grid; place-items: center; }
    main { max-width: 28rem; padding: 2rem; text-align: center; }
    h1 { color: #ededed; font-size: 1.25rem; }
  </style>
</head>
<body>
  <main data-snapshot-landing data-snapshot-landing-missing>
    <h1>Snapshot not found</h1>
    <p>This public link is invalid or was never published.</p>
  </main>
</body>
</html>`;
}
