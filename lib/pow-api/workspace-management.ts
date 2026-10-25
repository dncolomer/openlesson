/**
 * Workspace management core — create/edit Learning workspaces, map/contents,
 * workspace settings, and account settings. Shared by REST and MCP.
 * Agent create is Learning (`standard`) only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { insertGeneratedWorkspaceBlocks } from "@/lib/insert-workspace-blocks";
import { parseLearningModelSize, type LearningModelSize } from "@/lib/learning-model";
import {
  AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE,
  parseWorkspaceKind,
  WORKSPACE_KIND_CALIBRATION,
  WORKSPACE_KIND_KNOWLEDGE_REGION,
  WORKSPACE_KIND_STANDARD,
  type WorkspaceKind,
} from "@/lib/workspace-kind";
import { normalizeGeneratedWorkspaceBlocks } from "@/lib/workspace-spatial-create";
import { listAgentWorkspaces } from "./agent-workspace-ops";
import { createAgentWorkspace } from "./create-agent-workspace";
import { normalizeWorkspaceGoal } from "./conversion-goal";
import type { AuthContext } from "./types";
import { canAccessAgentWorkspace } from "./workspace-access";

export { AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE };

export type AgentWorkspaceProduct = "learning" | "verification" | "calibration";

export function agentWorkspaceProduct(kind: unknown): AgentWorkspaceProduct {
  const parsed = parseWorkspaceKind(kind);
  if (parsed === WORKSPACE_KIND_KNOWLEDGE_REGION) return "verification";
  if (parsed === WORKSPACE_KIND_CALIBRATION) return "calibration";
  return "learning";
}

const AGENT_REFUSED_CREATE_KIND_ALIASES = new Set([
  "verification",
  "knowledge_region",
  "knowledge-region",
  "knowledgeregion",
  "calibration",
  "calibrate",
  "calibration_workspace",
]);

/** Agent create accepts Learning only (`learning` / `standard`). Flow kinds throw. */
export function parseAgentWorkspaceKind(value: unknown): WorkspaceKind {
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && AGENT_REFUSED_CREATE_KIND_ALIASES.has(trimmed)) {
      throw new Error(AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE);
    }
  }
  return WORKSPACE_KIND_STANDARD;
}

const WORKSPACE_SELECT =
  "id, title, root_topic, description, notes, workspace_goal, status, workspace_kind, learning_model_size, is_public, created_at, updated_at, user_id, organization_id, guest_user_id";

export type WorkspaceSettingsPatch = {
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  workspace_goal?: string | null;
  root_topic?: string | null;
  learning_model_size?: LearningModelSize | number | null;
  is_public?: boolean | null;
};

export type WorkspaceBlockPatch = {
  id?: string;
  title: string;
  description?: string;
  is_start?: boolean;
  next?: string[];
  position_x?: number;
  position_y?: number;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" ? value.trim() : undefined;
}

async function resolveOwnerUserId(
  supabase: SupabaseClient,
  auth: AuthContext,
): Promise<string | null> {
  if (auth.user_id) return auth.user_id;
  if (!auth.organization_id) return null;
  const { data: orgAdmin } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", auth.organization_id)
    .eq("is_org_admin", true)
    .limit(1)
    .maybeSingle();
  return orgAdmin?.id || null;
}

export async function loadManagedWorkspace(
  supabase: SupabaseClient,
  auth: AuthContext,
  workspaceId: string,
) {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(WORKSPACE_SELECT)
    .eq("id", workspaceId)
    .single();
  if (error || !workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return null;
  }
  return workspace;
}

export function presentManagedWorkspace(row: Record<string, unknown>) {
  const kind = parseWorkspaceKind(row.workspace_kind);
  return {
    id: row.id,
    title: row.title ?? null,
    root_topic: row.root_topic ?? null,
    description: row.description ?? null,
    notes: row.notes ?? null,
    workspace_goal: row.workspace_goal ?? null,
    status: row.status ?? null,
    workspace_kind: kind,
    product: agentWorkspaceProduct(kind),
    learning_model_size: parseLearningModelSize(row.learning_model_size),
    is_public: Boolean(row.is_public),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    settings: {
      title: row.title ?? null,
      description: row.description ?? null,
      notes: row.notes ?? null,
      workspace_goal: row.workspace_goal ?? null,
      root_topic: row.root_topic ?? null,
      learning_model_size: parseLearningModelSize(row.learning_model_size),
      is_public: Boolean(row.is_public),
    },
  };
}

function parseBlocks(value: unknown): WorkspaceBlockPatch[] {
  if (!Array.isArray(value)) return [];
  const out: WorkspaceBlockPatch[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    const title = text(row.title);
    if (!title) continue;
    const next = Array.isArray(row.next)
      ? row.next.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
      : Array.isArray(row.next_block_ids)
        ? row.next_block_ids.filter(
            (id): id is string => typeof id === "string" && Boolean(id.trim()),
          )
        : undefined;
    out.push({
      id: text(row.id) || undefined,
      title,
      description: text(row.description),
      is_start: row.is_start === true,
      next,
      position_x: typeof row.position_x === "number" ? row.position_x : undefined,
      position_y: typeof row.position_y === "number" ? row.position_y : undefined,
    });
  }
  return out;
}

export async function listManagedWorkspaces(
  supabase: SupabaseClient,
  auth: AuthContext,
  input: { status?: string | null; limit?: unknown; offset?: unknown } = {},
) {
  const payload = await listAgentWorkspaces(supabase, auth, input);
  return {
    workspaces: (payload.workspaces || []).map((row) =>
      presentManagedWorkspace(row as Record<string, unknown>),
    ),
    pagination: payload.pagination,
  };
}

export async function createManagedWorkspace(
  supabase: SupabaseClient,
  auth: AuthContext,
  body: Record<string, unknown>,
) {
  const kind = parseAgentWorkspaceKind(body.kind ?? body.workspace_kind ?? body.product);
  const title = text(body.title);
  const description = text(body.description);
  const notes = text(body.notes);
  const initialPrompt = text(body.initial_prompt ?? body.prompt);
  const blocks = parseBlocks(body.blocks ?? body.map);
  const workspaceGoal =
    body.workspace_goal === undefined
      ? undefined
      : body.workspace_goal === null
        ? null
        : normalizeWorkspaceGoal(body.workspace_goal);
  const catalogSize =
    body.learning_model_size === undefined
      ? undefined
      : parseLearningModelSize(body.learning_model_size);

  const wantsGeneration = Boolean(initialPrompt) && !title && blocks.length === 0;

  if (wantsGeneration) {
    const generated = await createAgentWorkspace(supabase, auth, body);
    const workspaceId = String(
      (generated as { workspace?: { id?: string } }).workspace?.id || "",
    );
    if (workspaceId) {
      await supabase
        .from("workspaces")
        .update({
          workspace_kind: kind,
          ...(catalogSize ? { learning_model_size: catalogSize } : {}),
          ...(title ? { title } : {}),
          ...(description ? { description } : {}),
          ...(workspaceGoal !== undefined ? { workspace_goal: workspaceGoal } : {}),
        })
        .eq("id", workspaceId);
    }
    const loaded = workspaceId ? await loadManagedWorkspace(supabase, auth, workspaceId) : null;
    const listedBlocks = workspaceId
      ? await listWorkspaceBlocks(supabase, workspaceId)
      : (generated as { blocks?: unknown[] }).blocks || [];
    return {
      workspace: loaded
        ? presentManagedWorkspace(loaded as Record<string, unknown>)
        : presentManagedWorkspace({
            ...(generated as { workspace: Record<string, unknown> }).workspace,
            workspace_kind: kind,
          }),
      blocks: listedBlocks,
    };
  }

  const ownerUserId = await resolveOwnerUserId(supabase, auth);
  if (!ownerUserId) {
    throw new Error("No user available to own this workspace");
  }

  const workspaceTitle = title || "Learning workspace";
  const insertRow: Record<string, unknown> = {
    user_id: ownerUserId,
    organization_id: auth.organization_id,
    guest_user_id: auth.guest_user_id,
    title: workspaceTitle,
    root_topic: text(body.root_topic) || initialPrompt.slice(0, 160) || workspaceTitle,
    status: "active",
    source_type: "topic",
    notes: notes || initialPrompt || null,
    description: description || null,
    workspace_goal: workspaceGoal ?? null,
    workspace_kind: kind,
    is_agent_workspace: true,
    evaluation_mode: "semantic",
  };
  if (catalogSize) insertRow.learning_model_size = catalogSize;
  if (body.is_public === true) insertRow.is_public = true;

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert(insertRow)
    .select(WORKSPACE_SELECT)
    .single();

  if (error || !workspace) {
    throw new Error(error?.message || "Failed to create workspace");
  }

  let insertedBlocks: Record<string, unknown>[] = [];
  if (blocks.length) {
    const normalized = normalizeGeneratedWorkspaceBlocks(
      blocks.map((block, index) => ({
        id: block.id || `b${index + 1}`,
        title: block.title,
        description: block.description || "",
        is_start: block.is_start,
        next: block.next,
        position_x: block.position_x,
        position_y: block.position_y,
      })),
    );
    await insertGeneratedWorkspaceBlocks(supabase, workspace.id, normalized);
    insertedBlocks = await listWorkspaceBlocks(supabase, workspace.id);
  }

  return {
    workspace: presentManagedWorkspace(workspace as Record<string, unknown>),
    blocks: insertedBlocks,
  };
}

export async function listWorkspaceBlocks(supabase: SupabaseClient, workspaceId: string) {
  const { data: blocks, error } = await supabase
    .from("blocks")
    .select(
      "id, title, description, is_start, next_block_ids, status, position_x, position_y, created_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return blocks || [];
}

function settingsPatchFromBody(body: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const title = optionalText(body.title);
  if (title !== undefined) patch.title = title;
  const description = optionalText(body.description);
  if (description !== undefined) patch.description = description;
  const notes = optionalText(body.notes);
  if (notes !== undefined) patch.notes = notes;
  const rootTopic = optionalText(body.root_topic);
  if (rootTopic !== undefined) patch.root_topic = rootTopic;
  if ("workspace_goal" in body) {
    patch.workspace_goal =
      body.workspace_goal === null ? null : normalizeWorkspaceGoal(body.workspace_goal);
  }
  if ("learning_model_size" in body) {
    patch.learning_model_size = parseLearningModelSize(body.learning_model_size);
  }
  if (typeof body.is_public === "boolean") patch.is_public = body.is_public;
  const nested =
    body.settings && typeof body.settings === "object" && !Array.isArray(body.settings)
      ? settingsPatchFromBody(body.settings as Record<string, unknown>)
      : {};
  return { ...nested, ...patch };
}

export async function updateManagedWorkspace(
  supabase: SupabaseClient,
  auth: AuthContext,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const existing = await loadManagedWorkspace(supabase, auth, workspaceId);
  if (!existing) return null;

  const settingsPatch = settingsPatchFromBody(body);
  if (Object.keys(settingsPatch).length) {
    const { error } = await supabase
      .from("workspaces")
      .update(settingsPatch)
      .eq("id", workspaceId);
    if (error) throw new Error(error.message);
  }

  const blocks = parseBlocks(body.blocks ?? body.map);
  if (blocks.length) {
    await replaceWorkspaceBlocks(supabase, workspaceId, blocks);
  }

  const loaded = await loadManagedWorkspace(supabase, auth, workspaceId);
  return {
    workspace: presentManagedWorkspace((loaded || existing) as Record<string, unknown>),
    blocks: await listWorkspaceBlocks(supabase, workspaceId),
  };
}

export async function replaceWorkspaceBlocks(
  supabase: SupabaseClient,
  workspaceId: string,
  blocks: WorkspaceBlockPatch[],
) {
  const existing = await listWorkspaceBlocks(supabase, workspaceId);
  const existingIds = new Set(
    existing.map((row) => String((row as { id?: string }).id || "")).filter(Boolean),
  );
  const incomingIds = new Set(blocks.map((block) => block.id).filter(Boolean) as string[]);

  for (const id of existingIds) {
    if (!incomingIds.has(id)) {
      await supabase.from("blocks").delete().eq("id", id).eq("workspace_id", workspaceId);
    }
  }

  const localRefs = blocks.map((block, index) => ({
    id: block.id || `b${index + 1}`,
    title: block.title,
    description: block.description || "",
    is_start: block.is_start,
    next: block.next,
    position_x: block.position_x,
    position_y: block.position_y,
  }));

  const toInsert = localRefs.filter((block) => !existingIds.has(block.id));
  const toUpdate = localRefs.filter((block) => existingIds.has(block.id));

  if (toInsert.length) {
    await insertGeneratedWorkspaceBlocks(
      supabase,
      workspaceId,
      normalizeGeneratedWorkspaceBlocks(toInsert),
    );
  }

  for (const block of toUpdate) {
    await supabase
      .from("blocks")
      .update({
        title: block.title,
        description: block.description || "",
        is_start: block.is_start === true,
        next_block_ids: block.next || [],
        ...(block.position_x !== undefined ? { position_x: block.position_x } : {}),
        ...(block.position_y !== undefined ? { position_y: block.position_y } : {}),
      })
      .eq("id", block.id)
      .eq("workspace_id", workspaceId);
  }
}

export async function getAccountSettings(supabase: SupabaseClient, auth: AuthContext) {
  let profile: Record<string, unknown> | null = null;
  if (auth.user_id) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, organization_id, is_org_admin, plan")
      .eq("id", auth.user_id)
      .maybeSingle();
    profile = (data as Record<string, unknown> | null) ?? null;
  }
  return {
    user_id: auth.user_id,
    guest_user_id: auth.guest_user_id,
    organization_id: auth.organization_id || profile?.organization_id || null,
    is_org_admin: auth.is_org_admin,
    key_id: auth.key_id,
    scopes: auth.scopes,
    username: profile?.username ?? null,
    display_name: profile?.username ?? null,
    plan: profile?.plan ?? null,
  };
}

export async function updateAccountSettings(
  supabase: SupabaseClient,
  auth: AuthContext,
  body: Record<string, unknown>,
) {
  if (!auth.user_id) {
    throw new Error("Account settings require a member API key.");
  }
  const patch: Record<string, unknown> = {};
  const username = optionalText(body.username ?? body.display_name);
  if (username !== undefined) patch.username = username;
  if (Object.keys(patch).length) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", auth.user_id);
    if (error) throw new Error(error.message);
  }
  return getAccountSettings(supabase, auth);
}

export { listAgentWorkspaces };
