/**
 * Timed TAPBench session helper (not a public mint API).
 *
 * TAP/ILE mint stay on workspace APIs. TAPBench keys/tasks mint on /tapbench.
 * This helper still persists/resolves existing timed session tokens.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext, ErrorCode } from "./types";
import { createdByApiKeyId } from "./auth";
import { canAccessAgentWorkspace } from "./workspace-access";
import { loadWorkspacePromptContext } from "./load-workspace-prompt-context";
import {
  generateTapbenchExercise,
  type GenerateTapbenchExerciseInput,
} from "./tapbench-exercise-generate";
import {
  listTapbenchLinksPersisted,
  mintTapbenchLinkPersisted,
} from "./tapbench-store";
import {
  normalizeTapbenchDurationSeconds,
  type TapbenchLinkStatus,
} from "./tapbench";
import {
  knowledgeLinkMintDeniedMessage,
  workspaceAllowsKnowledgeLinkMint,
} from "@/lib/workspace-kind";

export class CreateTapbenchLinkError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ErrorCode,
  ) {
    super(message);
    this.name = "CreateTapbenchLinkError";
  }
}

/** Public body fields (snake_case preferred; camelCase accepted). */
export type CreateTapbenchLinkInput = Record<string, unknown> & {
  block_id?: unknown;
  blockId?: unknown;
  duration_seconds?: unknown;
  durationSeconds?: unknown;
  minutes?: unknown;
  exercise?: unknown;
  exercise_text?: unknown;
  exerciseText?: unknown;
};

export interface CreateTapbenchLinkOptions {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  /** When omitted/null, the link scopes to the entire workspace. */
  blockId?: string | null;
  body?: CreateTapbenchLinkInput;
  baseUrl: string;
  /** Inject exercise generation (tests / skip live xAI). */
  generateExercise?: (
    input: GenerateTapbenchExerciseInput,
  ) => Promise<{ exercise: string; source: "explicit" | "llm" }>;
  /** Inject now for tests. */
  nowMs?: number;
  /**
   * When true, skip canAccessAgentWorkspace (caller already authorized via
   * guardWorkspaceRoute / equivalent session checks).
   */
  skipAccessCheck?: boolean;
  /**
   * Inject workspace prompt context (tests). When provided, skips
   * loadWorkspacePromptContext.
   */
  promptContext?: Awaited<ReturnType<typeof loadWorkspacePromptContext>>;
}

export interface CreatedTapbenchLink {
  id: string;
  workspace_id: string;
  block_id: string | null;
  status: TapbenchLinkStatus | string;
  exercise: string;
  duration_seconds: number;
  expires_at: string;
  remaining_ms: number;
  created_at: string;
  public_token: string;
  /** Same as public_token — session bearer for Stash/Submit. */
  session_token: string;
  url: string;
  guest_user_id: string | null;
  exercise_source: "explicit" | "llm";
}

export function parseTapbenchLinkBody(body: CreateTapbenchLinkInput | null | undefined): {
  blockId: string | null;
  durationSeconds: number;
  exerciseText: string | null;
} {
  const raw = body && typeof body === "object" ? body : {};
  const blockFromBody =
    typeof raw.block_id === "string" && raw.block_id.trim()
      ? raw.block_id.trim()
      : typeof raw.blockId === "string" && raw.blockId.trim()
        ? raw.blockId.trim()
        : null;

  const rawDuration =
    raw.duration_seconds ??
    raw.durationSeconds ??
    (raw.minutes != null ? Number(raw.minutes) * 60 : undefined);
  const durationSeconds = normalizeTapbenchDurationSeconds(rawDuration);

  const exerciseText =
    typeof raw.exercise === "string"
      ? raw.exercise
      : typeof raw.exercise_text === "string"
        ? raw.exercise_text
        : typeof raw.exerciseText === "string"
          ? raw.exerciseText
          : null;

  return { blockId: blockFromBody, durationSeconds, exerciseText };
}

/**
 * Mint a TAPBench link for a workspace (optional block). Shared by agent REST/MCP
 * and the browser UI route.
 */
export async function createWorkspaceTapbenchLink(
  options: CreateTapbenchLinkOptions,
): Promise<CreatedTapbenchLink> {
  const { supabase, auth, workspaceId, baseUrl } = options;
  const body = options.body ?? {};
  const parsed = parseTapbenchLinkBody(body);
  const blockId =
    typeof options.blockId === "string" && options.blockId.trim()
      ? options.blockId.trim()
      : parsed.blockId;
  const durationSeconds = parsed.durationSeconds;
  const explicitExercise = parsed.exerciseText;

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, guest_user_id, title, workspace_goal, root_topic, workspace_kind")
    .eq("id", workspaceId)
    .single();

  if (workspaceError || !workspace) {
    throw new CreateTapbenchLinkError("Workspace not found", 404, "workspace_not_found");
  }

  if (!options.skipAccessCheck && !canAccessAgentWorkspace(auth, workspace)) {
    throw new CreateTapbenchLinkError("Workspace not found", 404, "workspace_not_found");
  }

  if (!workspaceAllowsKnowledgeLinkMint(workspace.workspace_kind)) {
    throw new CreateTapbenchLinkError(knowledgeLinkMintDeniedMessage(), 403, "forbidden");
  }

  if (blockId) {
    const { data: block, error: blockError } = await supabase
      .from("blocks")
      .select("id")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (blockError || !block) {
      throw new CreateTapbenchLinkError("Block not found", 404, "block_not_found");
    }
  }

  const ownerUserId = auth.user_id || workspace.user_id;
  if (!ownerUserId) {
    throw new CreateTapbenchLinkError("Workspace owner is missing", 500, "internal_error");
  }

  // Full prompt context for exercise authoring (same as UI mint).
  const promptCtx =
    options.promptContext !== undefined
      ? options.promptContext
      : await loadWorkspacePromptContext(supabase, workspaceId, {
          focusedBlockId: blockId,
        });

  if (!promptCtx) {
    throw new CreateTapbenchLinkError("Workspace not found", 404, "workspace_not_found");
  }

  if (blockId && !promptCtx.blocks.some((b) => b.id === blockId)) {
    throw new CreateTapbenchLinkError("Block not found", 404, "block_not_found");
  }

  const generate = options.generateExercise ?? generateTapbenchExercise;
  let generated: { exercise: string; source: "explicit" | "llm" };
  try {
    generated = await generate({
      workspaceTitle: promptCtx.workspaceTitle ?? workspace.title,
      workspaceGoal: promptCtx.workspaceGoal ?? workspace.workspace_goal,
      rootTopic: promptCtx.rootTopic ?? workspace.root_topic,
      workspaceDescription: promptCtx.workspaceDescription,
      notes: promptCtx.notes,
      blockTitle: promptCtx.focusedBlockTitle,
      blockDescription: promptCtx.focusedBlockDescription,
      exerciseText: explicitExercise,
      files: promptCtx.files,
      externalResources: promptCtx.externalResources,
      blocks: promptCtx.blocks,
      focusedBlockId: promptCtx.focusedBlockId,
      blockLocalContext: promptCtx.blockLocalContext,
      unusableCells: promptCtx.unusableCells,
      durationSeconds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate exercise";
    throw new CreateTapbenchLinkError(message, 500, "internal_error");
  }

  const minted = await mintTapbenchLinkPersisted({
    supabase,
    baseUrl,
    organizationId: auth.organization_id ?? workspace.organization_id ?? null,
    createdByApiKeyId: createdByApiKeyId(auth),
    input: {
      workspaceId,
      blockId,
      durationSeconds,
      workspaceTitle: workspace.title,
      workspaceGoal: workspace.workspace_goal,
      rootTopic: workspace.root_topic,
      blockTitle: promptCtx.focusedBlockTitle,
      blockDescription: promptCtx.focusedBlockDescription,
      exerciseText: generated.exercise,
      createdBy: ownerUserId,
      nowMs: options.nowMs,
    },
  });

  return {
    id: minted.link.id,
    workspace_id: minted.link.workspace_id,
    block_id: minted.link.block_id,
    status: minted.link.status,
    exercise: minted.exercise,
    duration_seconds: minted.duration_seconds,
    expires_at: minted.expires_at,
    remaining_ms: minted.remaining_ms,
    created_at: minted.link.created_at,
    public_token: minted.session_token,
    session_token: minted.session_token,
    url: minted.url,
    guest_user_id: minted.link.guest_user_id,
    exercise_source: generated.source,
  };
}

/**
 * List TAPBench links for a workspace (session store / existing tokens).
 */
export async function listWorkspaceTapbenchLinks(options: {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  baseUrl: string;
  nowMs?: number;
}): Promise<{
  workspace_id: string;
  tapbench_links: Awaited<ReturnType<typeof listTapbenchLinksPersisted>>;
}> {
  const { supabase, auth, workspaceId, baseUrl } = options;

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, guest_user_id")
    .eq("id", workspaceId)
    .single();

  if (error || !workspace) {
    throw new CreateTapbenchLinkError("Workspace not found", 404, "workspace_not_found");
  }
  if (!canAccessAgentWorkspace(auth, workspace)) {
    throw new CreateTapbenchLinkError("Workspace not found", 404, "workspace_not_found");
  }

  const links = await listTapbenchLinksPersisted(
    supabase,
    workspaceId,
    baseUrl,
    options.nowMs,
  );

  return { workspace_id: workspaceId, tapbench_links: links };
}
