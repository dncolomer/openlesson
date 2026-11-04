/**
 * Publish-time play-copy data access: private by default; author may share Path,
 * optionally full proof of work, and optionally read access to crafted insights.
 * Shown on Home map details and AYCL landing.
 */

import { billedUserIdForSession } from "@/lib/credits/ledger";
import { dashboardPlayHref, isDashboardPlaySession } from "@/lib/dashboard-play";
import type { FlowPowRow } from "@/lib/flow-embedding";
import {
  sessionBranchModelFromUnknown,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import { verificationQuestionStartingPrompt } from "@/lib/verification-flow";
import { isPlayCopyWorkspace } from "@/lib/workspace-play-copy";

export const MAP_PLAY_DATA_ACCESS_MODES = ["private", "path", "pow"] as const;
export type MapPlayDataAccessMode = (typeof MAP_PLAY_DATA_ACCESS_MODES)[number];

export const PLAY_PATH_CONTRIBUTION_SOURCE = "play_path";
export const PLAY_POW_CONTRIBUTION_SOURCE = "play_pow";

export const MAP_PLAY_INSIGHTS_SHARE_LABEL = "Shares crafted insights with the author";
export const MAP_PLAY_INSIGHTS_SHARE_DETAIL =
  "Sessions you run on a play copy also let the author read insights you craft.";

export type MapPlayDataAccessFlags = {
  playSharePath: boolean;
  playSharePow: boolean;
  playShareInsights: boolean;
};

export type MapPlayDataAccessView = MapPlayDataAccessFlags & {
  mode: MapPlayDataAccessMode;
  label: string;
  detail: string;
};

export function parseMapPlayDataAccessFlags(row: {
  play_share_path?: unknown;
  play_share_pow?: unknown;
  play_share_insights?: unknown;
  playSharePath?: unknown;
  playSharePow?: unknown;
  playShareInsights?: unknown;
} | null | undefined): MapPlayDataAccessFlags {
  const sharePath = Boolean(row?.playSharePath ?? row?.play_share_path);
  const sharePow = sharePath && Boolean(row?.playSharePow ?? row?.play_share_pow);
  const shareInsights = Boolean(row?.playShareInsights ?? row?.play_share_insights);
  return { playSharePath: sharePath, playSharePow: sharePow, playShareInsights: shareInsights };
}

export function mapPlayDataAccessMode(
  flags: MapPlayDataAccessFlags,
): MapPlayDataAccessMode {
  if (flags.playSharePow) return "pow";
  if (flags.playSharePath) return "path";
  return "private";
}

export function mapPlayDataAccessLabel(mode: MapPlayDataAccessMode): string {
  if (mode === "pow") return "Shares Path and proof of work with the author";
  if (mode === "path") return "Shares Path with the author";
  return "Play copies keep your work private";
}

export function mapPlayDataAccessDetail(mode: MapPlayDataAccessMode): string {
  if (mode === "pow") {
    return "Sessions you run on a play copy also send Path embeddings and proof of work to the author.";
  }
  if (mode === "path") {
    return "Sessions you run on a play copy also send Path embeddings to the author. Transcripts stay private.";
  }
  return "Sessions you run on a play copy stay on your copy. The author does not see them.";
}

function mapPlayDataAccessShareParts(flags: MapPlayDataAccessFlags): string[] {
  const parts: string[] = [];
  if (flags.playSharePow) {
    parts.push("Path", "proof of work");
  } else if (flags.playSharePath) {
    parts.push("Path");
  }
  if (flags.playShareInsights) parts.push("crafted insights");
  return parts;
}

function joinShareList(parts: readonly string[]): string {
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function mapPlayDataAccessLabelFromFlags(flags: MapPlayDataAccessFlags): string {
  const parts = mapPlayDataAccessShareParts(flags);
  if (!parts.length) return mapPlayDataAccessLabel("private");
  return `Shares ${joinShareList(parts)} with the author`;
}

export function mapPlayDataAccessDetailFromFlags(flags: MapPlayDataAccessFlags): string {
  const mode = mapPlayDataAccessMode(flags);
  if (!flags.playShareInsights) return mapPlayDataAccessDetail(mode);
  if (mode === "pow") {
    return "Sessions you run on a play copy also send Path embeddings and proof of work to the author, and the author can read insights you craft.";
  }
  if (mode === "path") {
    return "Sessions you run on a play copy also send Path embeddings to the author, and the author can read insights you craft. Transcripts stay private.";
  }
  return MAP_PLAY_INSIGHTS_SHARE_DETAIL;
}

export function presentMapPlayDataAccess(
  row?: Parameters<typeof parseMapPlayDataAccessFlags>[0],
): MapPlayDataAccessView {
  const flags = parseMapPlayDataAccessFlags(row);
  const mode = mapPlayDataAccessMode(flags);
  return {
    ...flags,
    mode,
    label: mapPlayDataAccessLabelFromFlags(flags),
    detail: mapPlayDataAccessDetailFromFlags(flags),
  };
}

export function persistMapPlayDataAccessUpdates(input: {
  playSharePath?: unknown;
  playSharePow?: unknown;
  playShareInsights?: unknown;
}): Partial<Record<"play_share_path" | "play_share_pow" | "play_share_insights", boolean>> {
  const updates: Partial<
    Record<"play_share_path" | "play_share_pow" | "play_share_insights", boolean>
  > = {};
  if (input.playSharePath !== undefined) {
    updates.play_share_path = Boolean(input.playSharePath);
  }
  if (input.playSharePow !== undefined) {
    updates.play_share_pow = Boolean(input.playSharePow);
  }
  if (input.playShareInsights !== undefined) {
    updates.play_share_insights = Boolean(input.playShareInsights);
  }
  if (updates.play_share_pow && updates.play_share_path === false) {
    updates.play_share_pow = false;
  }
  if (updates.play_share_pow && updates.play_share_path === undefined) {
    updates.play_share_path = true;
  }
  return updates;
}

export function authorMayListPlayCopyInsights(input: {
  viewerUserId: string;
  sourceOwnerUserId: string;
  flags: MapPlayDataAccessFlags;
}): boolean {
  if (!input.flags.playShareInsights) return false;
  const viewer = String(input.viewerUserId || "").trim();
  const owner = String(input.sourceOwnerUserId || "").trim();
  return Boolean(viewer && viewer === owner);
}

export function includeAuthorPlayCopyInsight(input: {
  viewerUserId: string;
  sourceOwnerUserId: string;
  flags: MapPlayDataAccessFlags;
  insightWorkspaceId?: string | null;
  copyWorkspaceIds: readonly string[];
}): boolean {
  if (!authorMayListPlayCopyInsights(input)) return false;
  const workspaceId = String(input.insightWorkspaceId || "").trim();
  if (!workspaceId) return false;
  return input.copyWorkspaceIds.some((id) => String(id || "").trim() === workspaceId);
}

export function mergeInsightRowsById<T extends { id?: unknown }>(
  own: readonly T[],
  extra: readonly T[],
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const row of [...own, ...extra]) {
    const id = String(row.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(row);
  }
  return merged;
}

export function authorMayReadPlayCopyInsight(input: {
  viewerUserId?: string | null;
  insight: {
    user_id?: string | null;
    workspace_id?: string | null;
    archived_at?: string | null;
  };
  copyWorkspace: {
    is_play_copy?: boolean | null;
    original_workspace_id?: string | null;
  } | null;
  sourceWorkspace: {
    user_id?: string | null;
    play_share_insights?: unknown;
    playShareInsights?: unknown;
  } | null;
}): boolean {
  if (input.insight.archived_at) return false;
  const viewer = String(input.viewerUserId || "").trim();
  if (!viewer) return false;
  if (!isPlayCopyWorkspace(input.copyWorkspace)) return false;
  const insightWorkspaceId = String(input.insight.workspace_id || "").trim();
  const originalId = String(input.copyWorkspace?.original_workspace_id || "").trim();
  if (!insightWorkspaceId || !originalId) return false;
  return includeAuthorPlayCopyInsight({
    viewerUserId: viewer,
    sourceOwnerUserId: String(input.sourceWorkspace?.user_id || ""),
    flags: parseMapPlayDataAccessFlags(input.sourceWorkspace),
    insightWorkspaceId,
    copyWorkspaceIds: [insightWorkspaceId],
  });
}

export function flowRunSurfaceForWorkspace(row: {
  is_play_copy?: boolean | null;
  ayclToken?: string | null;
} | null | undefined): "play_copy" | "invite" {
  if (isPlayCopyWorkspace(row)) return "play_copy";
  if (String(row?.ayclToken || "").trim()) return "play_copy";
  return "invite";
}

export function playCopyFlowSessionInsert(input: {
  flowKind: "solve" | "calibrate" | "verify";
  flowId: string;
  runnerUserId: string;
  copyWorkspaceId: string;
  blockId?: string | null;
  topic: string;
  publicToken: string;
  questions?: unknown;
}): {
  user_id: string;
  workspace_id: string;
  billedUserId: string;
  identity: string;
  metadata: Record<string, unknown>;
  row: Record<string, unknown>;
  hrefForSession: (sessionId: string) => string;
} {
  const runnerUserId = String(input.runnerUserId || "").trim();
  const copyWorkspaceId = String(input.copyWorkspaceId || "").trim();
  const flowId = String(input.flowId || "").trim();
  const billedUserId = billedUserIdForSession({
    runnerUserId,
    ownerUserId: runnerUserId,
  });
  const identity = `play:${runnerUserId}`;
  const metadata: Record<string, unknown> = {
    title: input.topic,
    workspace_id: copyWorkspaceId,
    play_copy: true,
    identity,
  };
  if (input.flowKind === "solve") metadata.solve_flow_id = flowId;
  if (input.flowKind === "calibrate") metadata.calibrate_flow_id = flowId;
  if (input.flowKind === "verify") metadata.verify_flow_id = flowId;
  const blockId = String(input.blockId || "").trim();
  if (blockId) metadata.block_id = blockId;
  if (Array.isArray(input.questions)) metadata.questions = input.questions;
  const token = String(input.publicToken || "").trim();
  const kindColumn =
    input.flowKind === "solve"
      ? "solve_flow_id"
      : input.flowKind === "calibrate"
        ? "calibrate_flow_id"
        : "verify_flow_id";
  return {
    user_id: runnerUserId,
    workspace_id: copyWorkspaceId,
    billedUserId,
    identity,
    metadata,
    row: {
      kind: input.flowKind,
      problem: input.topic,
      status: "pending",
      user_id: runnerUserId,
      workspace_id: copyWorkspaceId,
      [kindColumn]: flowId,
      identity,
      result:
        input.flowKind === "calibrate"
          ? null
          : input.flowKind === "verify"
            ? {
                kind: "verify",
                projectedPolicy: null,
                knowledgeRegionId: null,
                answers: [],
              }
            : { kind: "solve", projectedPolicy: null },
      metadata,
    },
    hrefForSession: (sessionId: string) =>
      playCopyFlowSessionHref({
        flowKind: input.flowKind,
        publicToken: token,
        copyWorkspaceId,
        sessionId,
      }),
  };
}

export function playCopyFlowSessionHref(input: {
  flowKind: "solve" | "calibrate" | "verify";
  publicToken: string;
  copyWorkspaceId: string;
  sessionId: string;
}): string {
  const sessionId = String(input.sessionId || "").trim();
  if (input.flowKind === "calibrate" || input.flowKind === "verify") {
    return dashboardPlayHref(input.flowKind, sessionId);
  }
  const token = encodeURIComponent(String(input.publicToken || "").trim());
  return `/session?id=${encodeURIComponent(sessionId)}&solve=${token}`;
}

export function isPlayCopyRunMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>).play_copy === true;
}

export function playCopyIdRunnerAcceptsMetadata(metadata: unknown): boolean {
  return isPlayCopyRunMetadata(metadata) || isDashboardPlaySession(metadata);
}

export function playCopySessionQuestions(metadata: unknown): unknown[] {
  if (!isPlayCopyRunMetadata(metadata)) return [];
  const questions = (metadata as Record<string, unknown>).questions;
  return Array.isArray(questions) ? questions : [];
}

export function playCopyRunContextFromSession(session: {
  id?: unknown;
  metadata?: unknown;
}): {
  flowKind: "solve" | "calibrate" | "verify";
  copyWorkspaceId: string;
  flowId: string;
  sessionId: string;
  identity: string | null;
} | null {
  if (!isPlayCopyRunMetadata(session.metadata)) return null;
  const meta = session.metadata as Record<string, unknown>;
  const sessionId = String(session.id || "").trim();
  const copyWorkspaceId = String(meta.workspace_id || "").trim();
  if (!sessionId || !copyWorkspaceId) return null;
  const solveId = String(meta.solve_flow_id || "").trim();
  const calibrateId = String(meta.calibrate_flow_id || "").trim();
  const verifyId = String(meta.verify_flow_id || "").trim();
  const flowKind = solveId ? "solve" : calibrateId ? "calibrate" : verifyId ? "verify" : null;
  if (!flowKind) return null;
  return {
    flowKind,
    copyWorkspaceId,
    flowId: solveId || calibrateId || verifyId,
    sessionId,
    identity: String(meta.identity || "").trim() || null,
  };
}

export function playCopyPlayerUserIdFromIdentity(identity: string | null | undefined): string {
  const value = String(identity || "").trim();
  return value.startsWith("play:") ? value.slice("play:".length) : "";
}

export function playCopyCompletedEmbeddingInput(input: {
  flowKind: "calibrate" | "verify";
  copyWorkspaceId: string;
  playerUserId?: string | null;
  flowId: string;
  sessionId: string;
  identity?: string | null;
  source?: string | null;
  model?: unknown;
  sequence?: readonly string[] | null;
  pow?: readonly FlowPowRow[] | null;
}): {
  workspaceId: string;
  ownerUserId: string;
  flowKind: "calibrate" | "verify";
  flowId: string;
  runId: string;
  identity: string | null;
  source: string;
  model: SessionBranchModel | null;
  sequence: readonly string[] | null;
  pow: FlowPowRow[];
  sessionId: string;
} {
  const playerUserId =
    String(input.playerUserId || "").trim() ||
    playCopyPlayerUserIdFromIdentity(input.identity);
  const identity =
    String(input.identity || "").trim() || (playerUserId ? `play:${playerUserId}` : null);
  return {
    workspaceId: String(input.copyWorkspaceId || "").trim(),
    ownerUserId: playerUserId,
    flowKind: input.flowKind,
    flowId: String(input.flowId || "").trim(),
    runId: String(input.sessionId || "").trim(),
    identity,
    source: String(input.source || "play_copy").trim() || "play_copy",
    model: sessionBranchModelFromUnknown(input.model),
    sequence: input.flowKind === "calibrate" ? null : input.sequence ?? null,
    pow: Array.isArray(input.pow) ? [...input.pow] : [],
    sessionId: String(input.sessionId || "").trim(),
  };
}

export function playCopyVerifyEmbeddingFromProof(input: {
  session: { id?: unknown; metadata?: unknown };
  prompt: string;
  policy?: { model?: unknown; sequence?: unknown } | null;
}): ReturnType<typeof playCopyCompletedEmbeddingInput> | null {
  const ctx = playCopyRunContextFromSession(input.session);
  if (!ctx || ctx.flowKind !== "verify") return null;
  const sequence = Array.isArray(input.policy?.sequence)
    ? input.policy!.sequence.map((item) => String(item))
    : [];
  const prompt = String(input.prompt || "").trim();
  return playCopyCompletedEmbeddingInput({
    flowKind: "verify",
    copyWorkspaceId: ctx.copyWorkspaceId,
    flowId: ctx.flowId,
    sessionId: ctx.sessionId,
    identity: ctx.identity,
    source: "runner",
    model: input.policy?.model ?? null,
    sequence,
    pow: [
      { type: "speech", tool_name: "runner", timestamp_ms: 1, payload: prompt },
      ...sequence.map((action, index) => ({
        type: "tool" as const,
        tool_name: "session_policy",
        tool_action: action,
        timestamp_ms: index + 2,
      })),
    ],
  });
}

export function playCopyCalibrateEmbeddingFromSounding(input: {
  session: { id?: unknown; metadata?: unknown };
  model?: unknown;
  metadata: Record<string, unknown>;
}): ReturnType<typeof playCopyCompletedEmbeddingInput> | null {
  const ctx = playCopyRunContextFromSession(input.session);
  if (!ctx || ctx.flowKind !== "calibrate") return null;
  const payload = JSON.stringify(input.metadata);
  return playCopyCompletedEmbeddingInput({
    flowKind: "calibrate",
    copyWorkspaceId: ctx.copyWorkspaceId,
    flowId: ctx.flowId,
    sessionId: ctx.sessionId,
    identity: ctx.identity,
    source: "sounding",
    model: input.model ?? null,
    sequence: null,
    pow: [
      {
        type: "tool",
        tool_name: "probe",
        tool_action: "sounding",
        timestamp_ms: 1,
        payload,
        metadata: input.metadata,
      },
    ],
  });
}

export function playCopyVerifyStartingTopics(input: {
  prompt: string;
  questions?: unknown;
}): Array<{
  id: string;
  title: string;
  subtitle: string;
  openingQuestion: string;
}> {
  const prompt = String(input.prompt || "").trim() || "This topic";
  const questions = Array.isArray(input.questions) ? input.questions : [];
  const cards: Array<{
    id: string;
    title: string;
    subtitle: string;
    openingQuestion: string;
  }> = [];
  for (const item of questions) {
    let id = "";
    let text = "";
    if (typeof item === "string") {
      text = item.trim();
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      const row = item as { id?: unknown; text?: unknown; title?: unknown };
      text = String(row.text || row.title || "").trim();
      id = String(row.id || "").trim();
    }
    const opening = verificationQuestionStartingPrompt({ text: text || prompt });
    if (!opening) continue;
    cards.push({
      id: id || opening,
      title: text || prompt,
      subtitle: "Play session",
      openingQuestion: opening,
    });
  }
  if (cards.length) return cards;
  const opening = verificationQuestionStartingPrompt({ text: prompt });
  return [
    {
      id: "play",
      title: prompt,
      subtitle: "Play session",
      openingQuestion: opening,
    },
  ];
}

export function inviteFlowSessionOwner(input: {
  flowOwnerUserId: string;
  runnerUserId?: string | null;
}): { user_id: string; billedUserId: string; workspace_id: null } {
  const ownerUserId = String(input.flowOwnerUserId || "").trim();
  const billedUserId = billedUserIdForSession({
    runnerUserId: input.runnerUserId,
    ownerUserId,
  });
  return { user_id: ownerUserId, billedUserId, workspace_id: null };
}

export function includeAuthorStudioEmbedding(input: {
  viewerUserId: string;
  embedding: {
    owner_user_id?: string | null;
    source?: string | null;
    user_id?: string | null;
  };
}): boolean {
  const viewer = String(input.viewerUserId || "").trim();
  if (!viewer) return false;
  const owner = String(
    input.embedding.owner_user_id || input.embedding.user_id || "",
  ).trim();
  if (owner && owner !== viewer) return false;
  return true;
}

export function authorContributionSource(flags: MapPlayDataAccessFlags): string | null {
  if (flags.playSharePow) return PLAY_POW_CONTRIBUTION_SOURCE;
  if (flags.playSharePath) return PLAY_PATH_CONTRIBUTION_SOURCE;
  return null;
}

export function shouldContributePlayCopyToAuthor(input: {
  flags: MapPlayDataAccessFlags;
  playerUserId: string;
  authorUserId: string;
}): boolean {
  if (!authorContributionSource(input.flags)) return false;
  const player = String(input.playerUserId || "").trim();
  const author = String(input.authorUserId || "").trim();
  if (!player || !author) return false;
  return player !== author;
}

export function playCopyContributionEmbeddingInput(input: {
  flags: MapPlayDataAccessFlags;
  playerUserId: string;
  authorUserId: string;
  flowKind: "solve" | "calibrate" | "verify" | "learn";
  flowId: string;
  runId: string;
  identity?: string | null;
  raw: unknown;
}): {
  ownerUserId: string;
  flowKind: "solve" | "calibrate" | "verify" | "learn";
  flowId: string;
  runId: string;
  identity: string | null;
  source: string;
  raw: unknown;
} | null {
  if (
    !shouldContributePlayCopyToAuthor({
      flags: input.flags,
      playerUserId: input.playerUserId,
      authorUserId: input.authorUserId,
    })
  ) {
    return null;
  }
  const source = authorContributionSource(input.flags);
  if (!source) return null;
  const authorUserId = String(input.authorUserId || "").trim();
  let raw = input.raw;
  if (
    source === PLAY_PATH_CONTRIBUTION_SOURCE &&
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw)
  ) {
    raw = { ...(raw as Record<string, unknown>), pow: [] };
  }
  return {
    ownerUserId: authorUserId,
    flowKind: input.flowKind,
    flowId: String(input.flowId || "").trim(),
    runId: String(input.runId || "").trim(),
    identity: String(input.identity || "").trim() || null,
    source,
    raw,
  };
}
