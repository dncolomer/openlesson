"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Block } from "@/components/workspace-view/types";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { afterClonePaste, type CloneArmState } from "@/lib/clone-block";
import { buildUpdateBlockPayload } from "@/lib/block-starter-flag";
import {
  parseWorkspacePracticeOptions,
  serializeBlockPracticeOptions,
  type BlockPracticeOptions,
} from "@/lib/block-practice-options";
import {
  parseBlockCreatorEffects,
  serializeBlockCreatorEffects,
  type BlockCreatorEffects,
} from "@/lib/block-creator-effects";
import { parseBlockLocalContext, type BlockLocalContextInput } from "@/lib/prompt-workspace-context";
import {
  normalizeUnusableCells,
  type UnusableCell,
} from "@/lib/map-ground-rules";
import { normalizeWorkspaceDags, type WorkspaceDagRecord } from "@/lib/workspace-dags";
import { nextWorkspaceMapSelection, type WorkspaceMapSelection } from "@/lib/workspace-map-selection";
import { postWorkspaceGridOp } from "@/lib/workspace-grid-ops-client";
import type { WorkspaceAddTargetCell } from "@/lib/workspace-right-pane";
import { DEFAULT_MODEL } from "@/lib/xai-models";
import type { ClusterMapJob } from "@/components/workspace-view/types";
import { buildSkillGridLayout, getWeightedNeighborhood } from "@/lib/block-skill-grid";

export function useWorkspaceAuthoring(input: {
  workspaceId: string;
  isOwner: boolean;
  ayclToken?: string;
  locale: string;
  nodes: Block[];
  setNodes: Dispatch<SetStateAction<Block[]>>;
  applyMapSelectionResult: (next: WorkspaceMapSelection) => void;
  setCloneArm: Dispatch<SetStateAction<CloneArmState>>;
  setIsAddingBlock: Dispatch<SetStateAction<boolean>>;
  setClusterMapJob: Dispatch<SetStateAction<ClusterMapJob>>;
  setUnusableCells: Dispatch<SetStateAction<UnusableCell[]>>;
  setWorkspaceDags: Dispatch<SetStateAction<WorkspaceDagRecord[]>>;
  setMapGroundBusy: Dispatch<SetStateAction<boolean>>;
  refreshNodes: () => void;
}) {
  const {
    workspaceId,
    isOwner,
    ayclToken,
    locale,
    nodes,
    setNodes,
    applyMapSelectionResult,
    setCloneArm,
    setIsAddingBlock,
    setClusterMapJob,
    setUnusableCells,
    setWorkspaceDags,
    setMapGroundBusy,
    refreshNodes,
  } = input;
  const router = { push() {} };

  const withAycl = useCallback(
    <T extends Record<string, unknown>>(body: T): T & { ayclToken?: string } =>
      ayclToken ? { ...body, ayclToken } : body,
    [ayclToken],
  );

  const runGridOp = useCallback(
    async (payload: Record<string, unknown> & { op: string }) => {
      return postWorkspaceGridOp({
        workspaceId,
        ayclToken,
        locale,
        ...payload,
      } as import("@/lib/workspace-grid-ops-client").WorkspaceGridOpsRequestInput);
    },
    [ayclToken, locale, workspaceId],
  );

  const gridOpsFetch = useCallback(
    async (_url: string, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body || "{}")) as Record<string, unknown> & {
        op: string;
      };
      const result = await runGridOp(parsed);
      return new Response(JSON.stringify(result.data), {
        status: result.status,
        headers: { "Content-Type": "application/json" },
      });
    },
    [runGridOp],
  );

  const handleClonePaste = useCallback(
    async (sourceBlockId: string, target: { row: number; col: number }) => {
      if (!workspaceId || !isOwner) return;
      try {
        const response = await gridOpsFetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            withAycl({
              workspaceId,
              op: "clone_block",
              sourceBlockId,
              row: target.row,
              col: target.col,
            }),
          ),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorMessageFromBody(errorData, "Failed to clone block"),
          );
        }
        const data = await response.json();
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        setCloneArm(afterClonePaste());
        applyMapSelectionResult(nextWorkspaceMapSelection({ type: "clear" }));
      } catch (err) {
        console.error("[clone_block]", err);
        // Stay armed so user can try another empty cell.
      }
    },
    [applyMapSelectionResult, isOwner, refreshNodes, router, withAycl, workspaceId],
  );

  const handleCombineBlocks = useCallback(
    async (input: { blockIds: string[]; prompt?: string }) => {
      if (!workspaceId || !isOwner) return;
      setIsAddingBlock(true);
      try {
        const response = await gridOpsFetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "merge",
            blockIds: input.blockIds,
            prompt: input.prompt,
            locale,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(data, "Failed to combine blocks"));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        applyMapSelectionResult(nextWorkspaceMapSelection({ type: "clear" }));
      } finally {
        setIsAddingBlock(false);
      }
    },
    [applyMapSelectionResult, isOwner, locale, refreshNodes, router, workspaceId],
  );

  const handleSplitBlock = useCallback(
    async (input: { blockId: string; prompt?: string }) => {
      if (!workspaceId || !isOwner) return;
      setIsAddingBlock(true);
      try {
        const response = await gridOpsFetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "split",
            blockIds: [input.blockId],
            prompt: input.prompt,
            locale,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(data, "Failed to split block"));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        applyMapSelectionResult(nextWorkspaceMapSelection({ type: "clear" }));
      } finally {
        setIsAddingBlock(false);
      }
    },
    [applyMapSelectionResult, isOwner, locale, refreshNodes, router, workspaceId],
  );

  const handleSubmitGenerateShape = useCallback(
    async (payload: {
      prompt: string;
      cells: WorkspaceAddTargetCell[];
      contextSourceKeys?: string[];
      isStart?: boolean;
    }) => {
      if (!workspaceId || !isOwner) return;
      const nodesById = new Map(nodes.map((node) => [node.id, node]));
      const { placements } = buildSkillGridLayout(nodes);
      const anchor = payload.cells[0]
        ? { row: payload.cells[0].row, col: payload.cells[0].col }
        : null;
      const weightedNeighbors = anchor
        ? getWeightedNeighborhood(anchor, placements, nodesById)
        : [];
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;
      setIsAddingBlock(true);
      try {
        const response = await gridOpsFetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "generate_shape",
            prompt: payload.prompt,
            cells: payload.cells,
            weightedNeighbors,
            model,
            locale,
            ...(payload.contextSourceKeys?.length
              ? { contextSourceKeys: payload.contextSourceKeys }
              : {}),
            is_start: Boolean(payload.isStart),
          }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorMessageFromBody(errorData, "Failed to generate block"));
        }
        const data = await response.json();
        if (data.updatedNodes?.length > 0) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        applyMapSelectionResult(nextWorkspaceMapSelection({ type: "clear" }));
      } finally {
        setIsAddingBlock(false);
      }
    },
    [isOwner, locale, nodes, refreshNodes, router, workspaceId],
  );

  const postMapGround = useCallback(
    async (payload: Record<string, unknown>) => {
      setMapGroundBusy(true);
      try {
        const res = await fetch("/api/workspace/map-ground", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, ...payload, ...(ayclToken ? { ayclToken } : {}) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(errorMessageFromBody(data, "Map ground update failed"));
        }
        if (Array.isArray(data.unusableCells)) {
          setUnusableCells(normalizeUnusableCells(data.unusableCells));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        return data;
      } finally {
        setMapGroundBusy(false);
      }
    },
    [workspaceId],
  );

  const handleSetLockUntil = useCallback(
    async (blockId: string, prerequisiteIds: string[]) => {
      await postMapGround({
        op: "set_lock_until",
        blockId,
        prerequisiteIds,
      });
    },
    [postMapGround],
  );

  const handleToggleUnusable = useCallback(
    async (row: number, col: number) => {
      await postMapGround({ op: "toggle_unusable", row, col });
    },
    [postMapGround],
  );

  /** Left toolbar + multi-select ground authoring (primary creator path). */
  const handleMapGround = useCallback(
    async (payload: {
      op: "set_lock_until" | "set_unusable_cells";
      blockId?: string;
      prerequisiteIds?: string[];
      unusableCells?: Array<{ row: number; col: number }>;
    }) => {
      if (payload.op === "set_lock_until" && payload.blockId) {
        await postMapGround({
          op: "set_lock_until",
          blockId: payload.blockId,
          prerequisiteIds: payload.prerequisiteIds || [],
        });
        return;
      }
      if (payload.op === "set_unusable_cells") {
        await postMapGround({
          op: "set_unusable_cells",
          unusableCells: payload.unusableCells || [],
        });
      }
    },
    [postMapGround],
  );

  const handleSaveLocalContext = useCallback(
    async (blockId: string, localContext: BlockLocalContextInput) => {
      await postMapGround({
        op: "set_local_context",
        blockId,
        localContext,
      });
    },
    [postMapGround],
  );

  /** Update title/description/starter/practice limits from the Edit drawer. */
  const handleUpdateBlock = useCallback(
    async (input: {
      blockId: string;
      title: string;
      description: string;
      isStart?: boolean;
      practiceOptions?: BlockPracticeOptions;
    }) => {
      if (!workspaceId || !isOwner) return;
      setIsAddingBlock(true);
      try {
        const fields = buildUpdateBlockPayload({
          blockId: input.blockId,
          title: input.title,
          description: input.description,
          isStart: input.isStart,
          includeIsStart: input.isStart !== undefined,
        });
        const response = await gridOpsFetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "update_block",
            ...fields,
            ...(input.practiceOptions
              ? {
                  practice_options: serializeBlockPracticeOptions(
                    input.practiceOptions,
                  ),
                }
              : {}),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(data, "Failed to update block"));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map(
              (n: Block & {
                local_context?: unknown;
                practice_options?: unknown;
                creator_effects?: unknown;
              }) => ({
                ...n,
                local_context: parseBlockLocalContext(n.local_context),
                practice_options: parseWorkspacePracticeOptions(
                  n.practice_options,
                  { ayclClone: Boolean(ayclToken) },
                ),
                creator_effects: parseBlockCreatorEffects(n.creator_effects, {
                  selfBlockId: n.id,
                }),
              }),
            ),
          );
        }
      } finally {
        setIsAddingBlock(false);
      }
    },
    [ayclToken, isOwner, refreshNodes, router, workspaceId],
  );

  /** Persist combinable Dynamic / Generator effects. */
  const handleSaveCreatorEffects = useCallback(
    async (input: { blockId: string; effects: BlockCreatorEffects }) => {
      if (!workspaceId || !isOwner) return;
      const block = nodes.find((n) => n.id === input.blockId);
      if (!block) throw new Error("Block not found");
      setIsAddingBlock(true);
      try {
        const response = await gridOpsFetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "update_block",
            blockId: input.blockId,
            title: block.title,
            description: block.description || "",
            creator_effects: serializeBlockCreatorEffects(input.effects, {
              selfBlockId: input.blockId,
            }),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(data, "Failed to save block effects"));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map(
              (n: Block & {
                local_context?: unknown;
                practice_options?: unknown;
                creator_effects?: unknown;
              }) => ({
                ...n,
                local_context: parseBlockLocalContext(n.local_context),
                practice_options: parseWorkspacePracticeOptions(
                  n.practice_options,
                  { ayclClone: Boolean(ayclToken) },
                ),
                creator_effects: parseBlockCreatorEffects(n.creator_effects, {
                  selfBlockId: n.id,
                }),
              }),
            ),
          );
        }
      } finally {
        setIsAddingBlock(false);
      }
    },
    [ayclToken, isOwner, nodes, refreshNodes, router, workspaceId],
  );

  /** Delete block from the Edit drawer; clears selection after. */
  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      if (!workspaceId || !isOwner) return;
      setIsAddingBlock(true);
      try {
        const response = await gridOpsFetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "delete_block",
            blockId,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(data, "Failed to delete block"));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        applyMapSelectionResult(nextWorkspaceMapSelection({ type: "clear" }));
      } finally {
        setIsAddingBlock(false);
      }
    },
    [isOwner, refreshNodes, router, workspaceId],
  );

  /** Multi-select batch delete (combine pane Delete drawer). */
  const handleDeleteBlocks = useCallback(
    async (input: { blockIds: string[] }) => {
      if (!workspaceId || !isOwner) return;
      const ids = (input.blockIds || []).map((id) => String(id || "").trim()).filter(Boolean);
      if (ids.length === 0) return;
      setIsAddingBlock(true);
      try {
        const response = await gridOpsFetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "delete_blocks",
            blockIds: ids,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(data, "Failed to delete blocks"));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        applyMapSelectionResult(nextWorkspaceMapSelection({ type: "clear" }));
      } finally {
        setIsAddingBlock(false);
      }
    },
    [isOwner, refreshNodes, router, workspaceId],
  );

  /** Multi-select Cluster blocks → absolute relocate (positions only). */
  const handleClusterBlocks = useCallback(
    async (input: {
      blockIds: string[];
      placements: Array<{
        id: string;
        position_x: number;
        position_y: number;
      }>;
      clusterCount: number;
      separation?: number;
      prompt?: string;
    }) => {
      if (!workspaceId) {
        throw new Error("Workspace required to cluster blocks");
      }
      if (!isOwner) {
        throw new Error("Only the workspace owner can cluster blocks");
      }
      if (!input.placements?.length) {
        throw new Error("No placements to apply");
      }
      setIsAddingBlock(true);
      setClusterMapJob({
        active: true,
        progress: 0.7,
        label: "Saving cluster positions…",
      });
      try {
        const response = await gridOpsFetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "relocate",
            placements: input.placements,
            blockIds: input.blockIds,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(data, "Failed to cluster blocks"));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        // Drop residual multi-select / empty / detail chrome after cluster.
        applyMapSelectionResult(nextWorkspaceMapSelection({ type: "clear" }));
        setClusterMapJob({
          active: true,
          progress: 1,
          label: "Clusters updated",
        });
      } finally {
        setIsAddingBlock(false);
      }
    },
    [applyMapSelectionResult, ayclToken, isOwner, refreshNodes, router, workspaceId],
  );

  const handleClusterProgress = useCallback(
    (
      job: {
        active: boolean;
        progress: number;
        label: string;
      } | null,
    ) => {
      setClusterMapJob(job);
    },
    [],
  );

  /** Multi-select DAG Apply / tab edit → next_block_ids + register created DAG. */
  const handleApplyDag = useCallback(
    async (input: {
      blockIds: string[];
      dagDraft: {
        blockIds: string[];
        edges: Array<{ from: string; to: string; kind: "next" | "lock" }>;
      };
      /** When set, updates an existing created-DAG (DAGs tab edit). */
      dagId?: string;
    }) => {
      if (!workspaceId) {
        throw new Error("Workspace required to apply DAG");
      }
      if (!isOwner) {
        throw new Error("Only the workspace owner can apply or edit DAGs");
      }
      setIsAddingBlock(true);
      try {
        const response = await gridOpsFetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "apply_dag",
            blockIds: input.blockIds,
            dagDraft: input.dagDraft,
            ...(input.dagId ? { dagId: input.dagId } : {}),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(data, "Failed to apply DAG"));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        if (data.workspaceDags !== undefined) {
          setWorkspaceDags(normalizeWorkspaceDags(data.workspaceDags));
        }
      } finally {
        setIsAddingBlock(false);
      }
    },
    [isOwner, refreshNodes, router, workspaceId],
  );

  /** Creator DAGs tab — delete record + clear within-DAG next links. */
  const handleDeleteDag = useCallback(
    async (input: { dagId: string }) => {
      if (!input.dagId) {
        throw new Error("dagId required to delete DAG");
      }
      if (!workspaceId) {
        throw new Error("Workspace required to delete DAG");
      }
      if (!isOwner) {
        throw new Error("Only the workspace owner can delete DAGs");
      }
      setIsAddingBlock(true);
      try {
        const response = await gridOpsFetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "delete_dag",
            dagId: input.dagId,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(data, "Failed to delete DAG"));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        if (data.workspaceDags !== undefined) {
          setWorkspaceDags(normalizeWorkspaceDags(data.workspaceDags));
        } else {
          setWorkspaceDags((prev) => prev.filter((d) => d.id !== input.dagId));
        }
      } finally {
        setIsAddingBlock(false);
      }
    },
    [isOwner, refreshNodes, router, workspaceId],
  );


  return {
    withAycl,
    runGridOp,
    gridOpsFetch,
    handleClonePaste,
    handleCombineBlocks,
    handleSplitBlock,
    handleSubmitGenerateShape,
    handleUpdateBlock,
    handleSaveCreatorEffects,
    handleDeleteBlock,
    handleDeleteBlocks,
    handleClusterBlocks,
    handleClusterProgress,
    handleApplyDag,
    handleDeleteDag,
    postMapGround,
    handleSetLockUntil,
    handleToggleUnusable,
    handleMapGround,
    handleSaveLocalContext,
  };
}
