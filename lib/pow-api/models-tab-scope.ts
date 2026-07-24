/**
 * Models tab subject scope: user | user_group | all.
 * Pure helpers for resolving selection → subjects / query params and
 * aggregating multi-subject LWM + trajectory payloads for the UI.
 */

import type { LearningWorldModelV0 } from "@/lib/prompt-kernel/world-model";
import { emptyLearningWorldModel } from "@/lib/prompt-kernel/world-model";
import type { SubjectRef } from "./learning-world-model-store";
import { normalizeSubject } from "./learning-world-model-store";

export type ModelsTabScopeMode = "user" | "user_group" | "all";

export interface ModelsTabSubjectRef {
  user_id?: string | null;
  guest_user_id?: string | null;
}

export interface ModelsTabScopeInput {
  mode: ModelsTabScopeMode;
  /** Caller identity (defaults single-user "me" when mode=user with no target). */
  currentUserId?: string | null;
  /** Single user target when mode=user (org member id). */
  targetUserId?: string | null;
  /** Single guest target when mode=user. */
  targetGuestUserId?: string | null;
  /**
   * Group members when mode=user_group (from multi-select or a custom model cohort).
   * Ignored for user/all.
   */
  groupMembers?: ModelsTabSubjectRef[] | null;
  /** When false, non-self targets are forced back to the current user. */
  canInspectOthers?: boolean;
}

export interface ResolvedModelsTabScope {
  mode: ModelsTabScopeMode;
  /** single = one subject; multi = explicit group members; all = workspace-wide (no subject filter). */
  kind: "single" | "multi" | "all";
  subjects: SubjectRef[];
  /** Request body / query fields for /api/workspace/knowledge-config */
  query: {
    scope: ModelsTabScopeMode;
    /** Unique registered user id (never a me/self token). */
    user_id?: string;
    guest_user_id?: string;
    user_ids?: string;
    guest_user_ids?: string;
  };
  label: string;
}

function cleanId(value?: string | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}

function subjectKey(s: ModelsTabSubjectRef): string {
  const g = cleanId(s.guest_user_id);
  const u = cleanId(s.user_id);
  if (g) return `g:${g}`;
  if (u) return `u:${u}`;
  return "aggregate";
}

/** Deduplicate subject refs; guest wins over user when both present. */
export function dedupeSubjectRefs(subjects: ModelsTabSubjectRef[]): SubjectRef[] {
  const seen = new Set<string>();
  const out: SubjectRef[] = [];
  for (const raw of subjects) {
    const guest = cleanId(raw.guest_user_id);
    const user = cleanId(raw.user_id);
    if (!guest && !user) continue;
    const ref: SubjectRef = guest ? { guest_user_id: guest } : { user_id: user };
    const key = subjectKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

/**
 * Resolve Models tab scope selection into a subject list + API query fields.
 * Non-inspectors always resolve to the current user (single).
 */
export function resolveModelsTabScope(input: ModelsTabScopeInput): ResolvedModelsTabScope {
  const canInspect = Boolean(input.canInspectOthers);
  const me = cleanId(input.currentUserId);

  // Non-inspectors: always self via unique user_id (or empty if unauthenticated).
  if (!canInspect) {
    const subjects: SubjectRef[] = me ? [{ user_id: me }] : [];
    return {
      mode: "user",
      kind: "single",
      subjects,
      query: {
        scope: "user",
        ...(me ? { user_id: me } : {}),
      },
      label: "You",
    };
  }

  if (input.mode === "all") {
    return {
      mode: "all",
      kind: "all",
      subjects: [],
      query: { scope: "all" },
      label: "All subjects",
    };
  }

  if (input.mode === "user_group") {
    const subjects = dedupeSubjectRefs(input.groupMembers || []);
    const userIds = subjects.map((s) => s.user_id).filter(Boolean) as string[];
    const guestIds = subjects.map((s) => s.guest_user_id).filter(Boolean) as string[];
    return {
      mode: "user_group",
      kind: subjects.length === 0 ? "multi" : subjects.length === 1 ? "single" : "multi",
      subjects,
      query: {
        scope: "user_group",
        ...(userIds.length ? { user_ids: userIds.join(",") } : {}),
        ...(guestIds.length ? { guest_user_ids: guestIds.join(",") } : {}),
      },
      label:
        subjects.length === 0
          ? "User group (none selected)"
          : subjects.length === 1
            ? "User group (1 subject)"
            : `User group (${subjects.length} subjects)`,
    };
  }

  // mode === "user"
  const guest = cleanId(input.targetGuestUserId);
  const user = cleanId(input.targetUserId) || me;
  if (guest) {
    return {
      mode: "user",
      kind: "single",
      subjects: [{ guest_user_id: guest }],
      query: {
        scope: "user",
        guest_user_id: guest,
      },
      label: `Guest ${guest.slice(0, 8)}…`,
    };
  }
  if (user) {
    const isSelf = Boolean(me && user === me);
    return {
      mode: "user",
      kind: "single",
      subjects: [{ user_id: user }],
      query: {
        scope: "user",
        user_id: user,
      },
      label: isSelf ? "You" : `User ${user.slice(0, 8)}…`,
    };
  }

  return {
    mode: "user",
    kind: "single",
    subjects: me ? [{ user_id: me }] : [],
    query: {
      scope: "user",
      ...(me ? { user_id: me } : {}),
    },
    label: "You",
  };
}

/**
 * Parse a picker option key (`u:<uuid>` / `g:<uuid>`) into a subject ref.
 */
export function parseSubjectOptionKey(key: string | null | undefined): ModelsTabSubjectRef | null {
  const raw = typeof key === "string" ? key.trim() : "";
  if (!raw) return null;
  if (raw.startsWith("u:")) {
    const id = cleanId(raw.slice(2));
    return id ? { user_id: id } : null;
  }
  if (raw.startsWith("g:")) {
    const id = cleanId(raw.slice(2));
    return id ? { guest_user_id: id } : null;
  }
  // Bare uuid → treat as user
  const bare = cleanId(raw);
  return bare ? { user_id: bare } : null;
}

/**
 * Embeddings multiselect → Models tab scope.
 * 0 selected → self (if any); 1 → single user scope; 2+ → user_group.
 */
export function resolveEmbeddingsSubjectSelection(input: {
  selectedKeys: string[];
  currentUserId?: string | null;
  canInspectOthers?: boolean;
}): ResolvedModelsTabScope {
  const canInspect = Boolean(input.canInspectOthers);
  const me = cleanId(input.currentUserId);
  const keys = Array.isArray(input.selectedKeys) ? input.selectedKeys : [];

  if (!canInspect) {
    return resolveModelsTabScope({
      mode: "user",
      currentUserId: me,
      canInspectOthers: false,
    });
  }

  const members = dedupeSubjectRefs(
    keys.map((k) => parseSubjectOptionKey(k)).filter(Boolean) as ModelsTabSubjectRef[],
  );

  if (members.length === 0) {
    return resolveModelsTabScope({
      mode: "user",
      currentUserId: me,
      targetUserId: me,
      canInspectOthers: true,
    });
  }

  if (members.length === 1) {
    const only = members[0];
    return resolveModelsTabScope({
      mode: "user",
      currentUserId: me,
      targetUserId: only.user_id ?? null,
      targetGuestUserId: only.guest_user_id ?? null,
      canInspectOthers: true,
    });
  }

  return resolveModelsTabScope({
    mode: "user_group",
    currentUserId: me,
    groupMembers: members,
    canInspectOthers: true,
  });
}

/** Stable option key for a subject ref (matches UI `u:` / `g:` keys). */
export function subjectOptionKeyFromRef(s: ModelsTabSubjectRef): string {
  return subjectKey(s);
}

/** Parse comma-separated id lists from request query/body. */
export function parseIdList(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Server-side: turn scope + auth into subjects filter for knowledge-config loads.
 * - user: single subject via resolveEvaluationSubject-style fields
 * - user_group: multi from user_ids / guest_user_ids
 * - all: empty subjects + kind all (caller loads without subject filter)
 */
export function resolveModelsTabScopeFromRequest(options: {
  scope?: string | null;
  /** @deprecated Ignored — use user_id / guest_user_id unique IDs. */
  subject?: string | null;
  user_id?: string | null;
  guest_user_id?: string | null;
  user_ids?: string | null;
  guest_user_ids?: string | null;
  currentUserId: string;
  canInspectOthers: boolean;
}): ResolvedModelsTabScope {
  const raw = (options.scope || "user").trim().toLowerCase();
  const mode: ModelsTabScopeMode =
    raw === "all" ? "all" : raw === "user_group" || raw === "group" ? "user_group" : "user";

  if (mode === "all") {
    return resolveModelsTabScope({
      mode: "all",
      currentUserId: options.currentUserId,
      canInspectOthers: options.canInspectOthers,
    });
  }

  if (mode === "user_group") {
    const users = parseIdList(options.user_ids);
    const guests = parseIdList(options.guest_user_ids);
    const groupMembers: ModelsTabSubjectRef[] = [
      ...users.map((user_id) => ({ user_id })),
      ...guests.map((guest_user_id) => ({ guest_user_id })),
    ];
    return resolveModelsTabScope({
      mode: "user_group",
      currentUserId: options.currentUserId,
      canInspectOthers: options.canInspectOthers,
      groupMembers,
    });
  }

  // Always unique IDs: explicit user_id / guest_user_id, else currentUserId.
  return resolveModelsTabScope({
    mode: "user",
    currentUserId: options.currentUserId,
    canInspectOthers: options.canInspectOthers,
    targetUserId: options.user_id || options.currentUserId,
    targetGuestUserId: options.guest_user_id,
  });
}

export interface AggregateLwmInput {
  workspaceId: string;
  models: LearningWorldModelV0[];
}

/**
 * Aggregate multiple LWMs for group/all display.
 * Unions strengths / appetite / blind spots; averages available score verticals.
 */
export function aggregateLearningWorldModels(input: AggregateLwmInput): LearningWorldModelV0 {
  const base = emptyLearningWorldModel(input.workspaceId);
  if (!input.models.length) return base;

  const strengths = new Set<string>();
  const friction = new Set<string>();
  const wantMore = new Set<string>();
  const saturated = new Set<string>();
  const blindSpots = new Set<string>();
  const pathways = new Set<string>();

  const scoreAcc = {
    verification_score: [] as number[],
    augmentation_score: [] as number[],
    optimization_score: [] as number[],
    ghc_score: [] as number[],
  };

  let latestUpdated = base.updated_at;
  let goalText = "";
  let goalConf = 0;

  for (const m of input.models) {
    for (const s of m.learning_profile?.strengths || []) strengths.add(s);
    for (const s of m.learning_profile?.friction_patterns || []) friction.add(s);
    for (const s of m.evidence_appetite?.want_more || []) wantMore.add(s);
    for (const s of m.evidence_appetite?.saturated || []) saturated.add(s);
    for (const s of m.exploration?.blind_spots || []) blindSpots.add(s);
    for (const s of m.exploration?.pathways_touched || []) pathways.add(s);

    const snap = m.scores_snapshot;
    if (snap?.verification_score != null) scoreAcc.verification_score.push(snap.verification_score);
    if (snap?.augmentation_score != null) scoreAcc.augmentation_score.push(snap.augmentation_score);
    if (snap?.optimization_score != null) scoreAcc.optimization_score.push(snap.optimization_score);
    if (snap?.ghc_score != null) scoreAcc.ghc_score.push(snap.ghc_score);

    if (m.updated_at && m.updated_at > latestUpdated) latestUpdated = m.updated_at;
    if ((m.inferred_goal?.confidence ?? 0) > goalConf && m.inferred_goal?.text) {
      goalText = m.inferred_goal.text;
      goalConf = m.inferred_goal.confidence;
    }
  }

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return {
    ...base,
    updated_at: latestUpdated,
    inferred_goal: {
      text: goalText,
      confidence: goalConf,
      source: "evolved",
    },
    exploration: {
      block_coverage: [],
      pathways_touched: Array.from(pathways),
      blind_spots: Array.from(blindSpots),
    },
    learning_profile: {
      strengths: Array.from(strengths),
      friction_patterns: Array.from(friction),
      preferred_modalities: [],
      temporal_patterns: { avg_dwell_ms: null, idle_bursts: null },
    },
    evidence_appetite: {
      want_more: Array.from(wantMore),
      saturated: Array.from(saturated),
    },
    scores_snapshot: {
      verification_score: avg(scoreAcc.verification_score),
      augmentation_score: avg(scoreAcc.augmentation_score),
      optimization_score: avg(scoreAcc.optimization_score),
      ghc_score: avg(scoreAcc.ghc_score),
    },
  };
}

/** Stable subject key for trajectory point tagging. */
export function modelsTabSubjectKey(subject?: SubjectRef | null): string {
  const n = normalizeSubject(subject);
  if (n.subject_guest_user_id) return `g:${n.subject_guest_user_id}`;
  if (n.subject_user_id) return `u:${n.subject_user_id}`;
  return "aggregate";
}
