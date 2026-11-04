/**
 * Live Unsys seed for a shared flow definition. Play copies read the author's
 * current seed via flow_id. They never use a seed copied onto the copy block
 * and never substitute a generated default when the definition seed exists.
 */

import { normalizeMapBlock } from "@/lib/block-kind";
import { studentSessionModelFromAuthorSeed } from "@/lib/author-unsys-model";
import type { SessionBranchModel } from "@/lib/session-branch-model";

export type DefinitionUnsysSeedBlock = {
  id?: unknown;
  workspace_id?: unknown;
  map_block?: unknown;
  answers_model_seed?: unknown;
};

export function definitionUnsysSeedFromBlocks(input: {
  flowId: string;
  definitionWorkspaceId?: string | null;
  flowSeed?: unknown;
  blocks?: readonly DefinitionUnsysSeedBlock[] | null;
  copyBlockId?: string | null;
}): unknown | null {
  const fromFlow = studentSessionModelFromAuthorSeed(input.flowSeed);
  if (fromFlow) return input.flowSeed;
  const flowId = String(input.flowId || "").trim();
  if (!flowId) return null;
  const definitionWorkspaceId = String(input.definitionWorkspaceId || "").trim();
  const copyBlockId = String(input.copyBlockId || "").trim();
  for (const block of input.blocks || []) {
    const blockId = String(block.id || "").trim();
    if (copyBlockId && blockId === copyBlockId) continue;
    const workspaceId = String(block.workspace_id || "").trim();
    if (definitionWorkspaceId && workspaceId && workspaceId !== definitionWorkspaceId) {
      continue;
    }
    const linked = normalizeMapBlock(block.map_block);
    if (String(linked.flowId || "").trim() !== flowId) continue;
    if (studentSessionModelFromAuthorSeed(block.answers_model_seed)) {
      return block.answers_model_seed;
    }
  }
  return null;
}

export function studentModelFromDefinitionSeed(raw: unknown): SessionBranchModel | null {
  return studentSessionModelFromAuthorSeed(raw);
}

export function shouldGenerateUnsysField(definitionSeed: unknown): boolean {
  return !studentSessionModelFromAuthorSeed(definitionSeed);
}
