/**
 * Who may ask xAI to prepare a session field.
 * Learn uses the owned session. Workspace Calibrate and Verification use the
 * TAP session. A public flow token is enough when there is no session row.
 */

import { ileBlockSessionFrame } from "@/lib/ile-canvas-session";

export type SessionBranchPrepareInput = {
  enabled?: boolean;
  chapterTitle?: string | null;
  chapterBrief?: string | null;
  sessionId?: string | null;
  tapSessionId?: string | null;
  workspaceId?: string | null;
  blockId?: string | null;
  privateToken?: string | null;
  ileToken?: string | null;
  ayclToken?: string | null;
  calibrationToken?: string | null;
  verificationToken?: string | null;
  entryQueryParams?: Record<string, string | string[]> | null;
  /** Client-only. A new chapter refetches even when the title text matches. */
  scope?: string | null;
};

export type SessionBranchPreparePlan =
  | { kind: "none" }
  | { kind: "missing-material" }
  | {
      kind: "calibration";
      token: string;
      chapterTitle: string;
      chapterBrief: string;
    }
  | {
      kind: "verification";
      token: string;
      chapterTitle: string;
      chapterBrief: string;
    }
  | {
      kind: "learn";
      sessionId: string;
      ileToken: string;
      ayclToken: string;
      blockId: string;
      workspaceId: string;
      chapterTitle: string;
      chapterBrief: string;
    }
  | {
      kind: "workspace";
      workspaceId: string;
      sessionId: string;
      tapSessionId: string;
      privateToken: string;
      blockId: string;
      entryQueryParams: Record<string, string | string[]>;
      chapterTitle: string;
      chapterBrief: string;
    };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Block id the author seed is stored on. Direct id, or session metadata. */
export function sessionPrepareBlockId(raw: unknown): string {
  if (typeof raw === "string") return text(raw);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const row = raw as {
    blockId?: unknown;
    block_id?: unknown;
    focus_block_id?: unknown;
    metadata?: unknown;
  };
  return (
    text(row.blockId) ||
    text(row.block_id) ||
    text(row.focus_block_id) ||
    (row.metadata && row.metadata !== raw ? sessionPrepareBlockId(row.metadata) : "")
  );
}

/** Workspace id from a prepare input or session metadata. */
export function sessionPrepareWorkspaceId(raw: unknown): string {
  if (typeof raw === "string") return text(raw);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const row = raw as {
    workspaceId?: unknown;
    workspace_id?: unknown;
    metadata?: unknown;
  };
  return (
    text(row.workspaceId) ||
    text(row.workspace_id) ||
    (row.metadata && row.metadata !== raw ? sessionPrepareWorkspaceId(row.metadata) : "")
  );
}

function stableParams(
  params: Record<string, string | string[]> | null | undefined,
): Record<string, string | string[]> {
  if (!params) return {};
  const out: Record<string, string | string[]> = {};
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
    else if (Array.isArray(value)) {
      const items = value.map((item) => String(item).trim()).filter(Boolean);
      if (items.length) out[key] = items;
    }
  }
  return out;
}

export function planSessionBranchPrepare(
  input: SessionBranchPrepareInput | null | undefined,
): SessionBranchPreparePlan {
  if (!input || input.enabled === false) return { kind: "none" };
  const chapterTitle = text(input.chapterTitle);
  const chapterBrief = text(input.chapterBrief);
  if (!chapterTitle && !chapterBrief) return { kind: "missing-material" };

  const sessionId = text(input.sessionId);
  const tapSessionId = text(input.tapSessionId);
  const workspaceId = text(input.workspaceId) || sessionPrepareWorkspaceId(input);
  const privateToken = text(input.privateToken);
  const calibrationToken = text(input.calibrationToken);
  const verificationToken = text(input.verificationToken);
  const material = { chapterTitle, chapterBrief };
  const blockId = sessionPrepareBlockId(input.blockId) || sessionPrepareBlockId(input);
  // Owned Learn keeps the session route even when metadata has a workspace id.
  // TAP / guest links still use the workspace path.
  const ownedLearn = Boolean(sessionId) && !tapSessionId && !privateToken;

  // A real workspace or guest link wins over a flow token.
  // A public flow has no workspace. Its local canvas id is not a TAP session row.
  if ((workspaceId || privateToken) && !ownedLearn) {
    return {
      kind: "workspace",
      workspaceId,
      sessionId,
      tapSessionId,
      privateToken,
      blockId,
      entryQueryParams: stableParams(input.entryQueryParams),
      ...material,
    };
  }

  if (calibrationToken) return { kind: "calibration", token: calibrationToken, ...material };
  if (verificationToken) return { kind: "verification", token: verificationToken, ...material };

  if (sessionId) {
    return {
      kind: "learn",
      sessionId,
      ileToken: text(input.ileToken),
      ayclToken: text(input.ayclToken),
      blockId,
      workspaceId,
      ...material,
    };
  }

  if (tapSessionId) {
    return {
      kind: "workspace",
      workspaceId,
      sessionId,
      tapSessionId,
      privateToken,
      blockId,
      entryQueryParams: stableParams(input.entryQueryParams),
      ...material,
    };
  }

  return { kind: "none" };
}

/** JSON body for POST /api/ile/session-branch-model. Null when the call should wait. */
export function sessionBranchPrepareRequest(
  plan: SessionBranchPreparePlan,
): Record<string, unknown> | null {
  if (plan.kind === "none" || plan.kind === "missing-material") return null;
  const body: Record<string, unknown> = {
    chapterTitle: plan.chapterTitle,
    chapterBrief: plan.chapterBrief,
  };
  if (plan.kind === "calibration") body.calibrationToken = plan.token;
  else if (plan.kind === "verification") body.verificationToken = plan.token;
  else if (plan.kind === "learn") {
    body.sessionId = plan.sessionId;
    if (plan.ileToken) body.ileToken = plan.ileToken;
    if (plan.ayclToken) body.ayclToken = plan.ayclToken;
    if (plan.blockId) body.blockId = plan.blockId;
    if (plan.workspaceId) body.workspaceId = plan.workspaceId;
  } else {
    if (plan.workspaceId) body.workspaceId = plan.workspaceId;
    if (plan.sessionId) body.sessionId = plan.sessionId;
    if (plan.tapSessionId) body.tapSessionId = plan.tapSessionId;
    if (plan.privateToken) body.privateToken = plan.privateToken;
    if (plan.blockId) body.blockId = plan.blockId;
    if (Object.keys(plan.entryQueryParams).length) body.entryQueryParams = plan.entryQueryParams;
  }
  return body;
}

/** Block the opening should load an author seed from, if any. */
export function authorSeedBlockIdFromPreparePlan(
  plan: SessionBranchPreparePlan,
): string {
  if (plan.kind === "learn" || plan.kind === "workspace") return plan.blockId || "";
  return "";
}

export function authorSeedSessionIdFromPreparePlan(
  plan: SessionBranchPreparePlan,
): string {
  if (plan.kind === "learn") return plan.sessionId;
  if (plan.kind === "workspace") return plan.sessionId;
  return "";
}

function uniqueLines(parts: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    const line = typeof part === "string" ? part.trim() : "";
    if (line && !out.includes(line)) out.push(line);
  }
  return out;
}

/**
 * The first Learn chapter, in the same words the live canvas sends.
 * A missing frame waits. It does not invent a different title.
 */
export function learnSessionFieldInput(input: {
  sessionId?: string | null;
  problem?: string | null;
  plan?: {
    steps?: readonly { id?: string | null; description?: string | null }[] | null;
    currentStepIndex?: number | null;
  } | null;
  ileToken?: string | null;
  ayclToken?: string | null;
  fallbackTitle?: string | null;
  blockId?: string | null;
  workspaceId?: string | null;
  metadata?: unknown;
}): SessionBranchPrepareInput | null {
  const sessionId = text(input.sessionId);
  const frame = ileBlockSessionFrame(input.plan);
  if (!sessionId || !frame) return null;
  const step = input.plan?.steps?.[frame.index];
  const description = text(step?.description);
  const problem = text(input.problem);
  const prompt = text(frame.prompt);
  const chapterTitle = description || problem || prompt || text(input.fallbackTitle);
  if (!chapterTitle) return null;
  return {
    enabled: true,
    sessionId,
    chapterTitle,
    chapterBrief: uniqueLines([problem, description, prompt]).join("\n\n"),
    ileToken: text(input.ileToken),
    ayclToken: text(input.ayclToken),
    scope: text(step?.id) || frame.id,
    blockId:
      sessionPrepareBlockId(input.blockId) || sessionPrepareBlockId(input.metadata),
    workspaceId:
      sessionPrepareWorkspaceId(input.workspaceId) ||
      sessionPrepareWorkspaceId(input.metadata),
  };
}

/** Workspace and public Calibrate. Question lines are the ones on the live board. */
export function calibrateFieldPrepareInput(input: {
  topicText?: string | null;
  topicId?: string | null;
  questions?: readonly { text?: string | null }[] | null;
  sessionId?: string | null;
  tapSessionId?: string | null;
  workspaceId?: string | null;
  blockId?: string | null;
  privateToken?: string | null;
  calibrationToken?: string | null;
  entryQueryParams?: Record<string, string | string[]> | null;
}): SessionBranchPrepareInput {
  const chapterTitle = text(input.topicText) || "This topic";
  return {
    enabled: true,
    chapterTitle,
    chapterBrief: uniqueLines([
      chapterTitle,
      ...(input.questions ?? []).map((question) => question?.text),
    ]).join("\n\n"),
    sessionId: input.sessionId,
    tapSessionId: input.tapSessionId,
    workspaceId: input.workspaceId,
    blockId: input.blockId,
    privateToken: input.privateToken,
    calibrationToken: input.calibrationToken,
    entryQueryParams: input.entryQueryParams,
    scope: text(input.topicId) || "topic",
  };
}

/** Verification topic, in the same words the live boundary sends. */
export function verificationFieldPrepareInput(input: {
  workspaceTitle?: string | null;
  topics?: readonly { id?: string | null; title?: string | null; openingQuestion?: string | null }[] | null;
  topicId?: string | null;
  sessionId?: string | null;
  tapSessionId?: string | null;
  workspaceId?: string | null;
  blockId?: string | null;
  privateToken?: string | null;
  verificationToken?: string | null;
  entryQueryParams?: Record<string, string | string[]> | null;
}): SessionBranchPrepareInput {
  const topicId = text(input.topicId);
  const topic = (input.topics ?? []).find((row) => text(row?.id) === topicId);
  const chapterTitle = text(topic?.title) || text(input.workspaceTitle) || "This topic";
  return {
    enabled: true,
    chapterTitle,
    chapterBrief: uniqueLines([input.workspaceTitle, topic?.title, topic?.openingQuestion]).join("\n\n"),
    sessionId: input.sessionId,
    tapSessionId: input.tapSessionId,
    workspaceId: input.workspaceId,
    blockId: input.blockId,
    privateToken: input.privateToken,
    verificationToken: input.verificationToken,
    entryQueryParams: input.entryQueryParams,
    scope: topicId || "topic",
  };
}
