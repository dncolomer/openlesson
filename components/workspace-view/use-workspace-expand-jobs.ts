"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Block } from "@/components/workspace-view/types";
import {
  applyAddExpandJobProgress,
  createAddExpandJob,
  createAddExpandJobId,
  mergeActiveExpandJobPreviews,
  patchAddExpandJob,
  removeAddExpandJob,
  runAddExpandCreateLoop,
  snapshotAddExpandSlots,
  upsertAddExpandJob,
  type AddExpandJob,
} from "@/lib/add-block-range-density";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { buildBridgeKnowledgePrompt } from "@/lib/bridge-blocks";
import { buildSkillGridLayout, getWeightedNeighborhood } from "@/lib/block-skill-grid";
import { parseBlockPracticeOptions } from "@/lib/block-practice-options";
import { parseBlockCreatorEffects } from "@/lib/block-creator-effects";
import { parseBlockLocalContext } from "@/lib/prompt-workspace-context";
import {
  buildExpandFromSourceSlotPrompt,
  type ExpandSourceIdentity,
} from "@/lib/expand-block-from-source";
import { buildRabbitHoleExpandSlotPrompt } from "@/lib/rabbit-hole-expand";
import type { WorkspaceAddBlockSubmitOpts } from "@/components/WorkspaceAddBlockPane";
import type { WorkspaceExpandBlockSubmitOpts } from "@/components/WorkspaceExpandBlockPane";
import type { WorkspaceAddTargetCell } from "@/lib/workspace-right-pane";
import { nextWorkspaceMapSelection, type WorkspaceMapSelection } from "@/lib/workspace-map-selection";
import { createDisarmedCloneState } from "@/lib/clone-block";
import { DEFAULT_MODEL } from "@/lib/xai-models";

export function useWorkspaceExpandJobs(input: {
  workspaceId: string;
  isOwner: boolean;
  ayclToken?: string;
  locale: string;
  nodesRef: MutableRefObject<Block[]>;
  setNodes: Dispatch<SetStateAction<Block[]>>;
  setExpandJobs: Dispatch<SetStateAction<AddExpandJob[]>>;
  setAddExpandPreviewCells: Dispatch<SetStateAction<Array<{ row: number; col: number }> | null>>;
  expandAbortRef: MutableRefObject<Map<string, boolean>>;
  expandJobSeqRef: MutableRefObject<number>;
  applyMapSelectionResult: (next: WorkspaceMapSelection) => void;
  setCloneArm: Dispatch<SetStateAction<import("@/lib/clone-block").CloneArmState>>;
  refreshNodes: () => void;
}) {
  const {
    workspaceId,
    isOwner,
    ayclToken,
    locale,
    nodesRef,
    setNodes,
    setExpandJobs,
    setAddExpandPreviewCells,
    expandAbortRef,
    expandJobSeqRef,
    applyMapSelectionResult,
    setCloneArm,
    refreshNodes,
  } = input;
  const router = { push() {} };

  const handleExpandFromSourceBlock = useCallback(
    async (
      source: ExpandSourceIdentity,
      opts: WorkspaceExpandBlockSubmitOpts,
    ) => {
      if (!workspaceId || !isOwner) return;
      const slots = (opts.frozenSlots || []).map((c) => ({
        row: c.row,
        col: c.col,
      }));
      if (slots.length === 0) return;
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;
      const baseLabel =
        String(source.title || "").trim() || "Expand block";
      expandJobSeqRef.current += 1;
      const jobId = createAddExpandJobId(
        `expand-src-${Date.now()}-${expandJobSeqRef.current}`,
      );
      const job = createAddExpandJob({
        id: jobId,
        frozenSlots: slots,
        label: `Expand: ${baseLabel}`,
      });
      expandAbortRef.current.set(jobId, false);
      setExpandJobs((prev) => {
        const next = upsertAddExpandJob(prev, job);
        const merged = mergeActiveExpandJobPreviews(next);
        setAddExpandPreviewCells(merged.length ? merged : null);
        return next;
      });
      // Free selection chrome; job continues under minimap.
      setCloneArm(createDisarmedCloneState());

      void (async () => {
        try {
          const result = await runAddExpandCreateLoop({
            frozenSlots: slots,
            isAborted: () => expandAbortRef.current.get(jobId) === true,
            onProgress: (progress) => {
              setExpandJobs((prev) => {
                const next = applyAddExpandJobProgress(prev, jobId, progress);
                const merged = mergeActiveExpandJobPreviews(next);
                setAddExpandPreviewCells(merged.length ? merged : null);
                return next;
              });
            },
            createSlot: async (slot, i) => {
              const lastNodes = nodesRef.current;
              const nodesById = new Map(lastNodes.map((node) => [node.id, node]));
              const { placements } = buildSkillGridLayout(lastNodes);
              const weightedNeighbors = getWeightedNeighborhood(
                { row: slot.row, col: slot.col },
                placements,
                nodesById,
              );
              const candidate = opts.candidatePrompts?.[i];
              const userGuidance = opts.userGuidance;
              const slotPrompt =
                candidate && String(candidate).trim()
                  ? buildRabbitHoleExpandSlotPrompt({
                      source,
                      candidate: String(candidate).trim(),
                      slot,
                      slotIndex: i,
                      totalSlots: slots.length,
                      userGuidance,
                    })
                  : buildExpandFromSourceSlotPrompt({
                      source,
                      slot,
                      slotIndex: i,
                      totalSlots: slots.length,
                      userGuidance,
                    });
              const response = await fetch("/api/workspace/add-block-at-slot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workspaceId,
                  row: slot.row,
                  col: slot.col,
                  prompt: slotPrompt,
                  weightedNeighbors,
                  model,
                  locale,
                  ...(ayclToken ? { ayclToken } : {}),
                }),
              });
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorMessageFromBody(errorData, `Failed to expand block at (${slot.row}, ${slot.col})`),
                );
              }
              const data = await response.json();
              if (data.updatedNodes?.length > 0) {
                const nextNodes = data.updatedNodes.map(
                  (n: Block & { local_context?: unknown }) => ({
                    ...n,
                    local_context: parseBlockLocalContext(n.local_context),
                  }),
                );
                nodesRef.current = nextNodes;
                setNodes(nextNodes);
              }
            },
          });
          setExpandJobs((prev) =>
            applyAddExpandJobProgress(
              prev,
              jobId,
              { completed: result.completed, total: result.total },
              { stopped: result.stopped },
            ),
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to expand block";
          setExpandJobs((prev) =>
            patchAddExpandJob(prev, jobId, {
              status: "error",
              error: message,
            }),
          );
        } finally {
          expandAbortRef.current.delete(jobId);
          window.setTimeout(() => {
            setExpandJobs((prev) => {
              const next = removeAddExpandJob(prev, jobId);
              const merged = mergeActiveExpandJobPreviews(next);
              setAddExpandPreviewCells(merged.length ? merged : null);
              return next;
            });
          }, 1800);
        }
      })();
    },
    [ayclToken, isOwner, locale, refreshNodes, router, workspaceId],
  );

  // AYCL: reload plan/blocks via token API (no cookie session required).
  const handleSubmitAddBlock = useCallback(
    async (
      prompt: string,
      position: WorkspaceAddTargetCell,
      opts?: WorkspaceAddBlockSubmitOpts,
    ) => {
      if (!workspaceId || !isOwner) return;
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;
      // Frozen ordered slots (center first) — never re-sample from live occupancy.
      const slots: WorkspaceAddTargetCell[] =
        opts?.frozenSlots && opts.frozenSlots.length > 0
          ? opts.frozenSlots.map((c) => ({ row: c.row, col: c.col }))
          : snapshotAddExpandSlots({
              center: position,
              selected: [
                position,
                ...((opts?.expandCells || []).filter(
                  (c) => !(c.row === position.row && c.col === position.col),
                )),
              ],
            });
      if (slots.length === 0) return;

      expandJobSeqRef.current += 1;
      const jobId = createAddExpandJobId(
        `${Date.now()}-${expandJobSeqRef.current}`,
      );
      const job = createAddExpandJob({
        id: jobId,
        frozenSlots: slots,
        label: prompt,
      });
      expandAbortRef.current.set(jobId, false);
      setExpandJobs((prev) => {
        const next = upsertAddExpandJob(prev, job);
        const merged = mergeActiveExpandJobPreviews(next);
        setAddExpandPreviewCells(merged.length ? merged : null);
        return next;
      });

      // Free the Add pane / map immediately — job runs in the background.
      applyMapSelectionResult(nextWorkspaceMapSelection({ type: "clear" }));
      // Do NOT set isAddingBlock: multi-create must not lock map interaction.

      void (async () => {
        try {
          const result = await runAddExpandCreateLoop({
            frozenSlots: slots,
            isAborted: () => expandAbortRef.current.get(jobId) === true,
            onProgress: (progress) => {
              setExpandJobs((prev) => {
                const next = applyAddExpandJobProgress(prev, jobId, progress);
                const merged = mergeActiveExpandJobPreviews(next);
                setAddExpandPreviewCells(merged.length ? merged : null);
                return next;
              });
            },
            createSlot: async (slot, i) => {
              const lastNodes = nodesRef.current;
              const nodesById = new Map(lastNodes.map((node) => [node.id, node]));
              const { placements } = buildSkillGridLayout(lastNodes);
              const weightedNeighbors = getWeightedNeighborhood(
                { row: slot.row, col: slot.col },
                placements,
                nodesById,
              );
              const slotPrompt =
                i === 0
                  ? prompt
                  : `${prompt}\n\n(Place a distinct neighboring 1×1 block at row ${slot.row}, col ${slot.col} — different subtopic, same overall theme.)`;
              const response = await fetch("/api/workspace/add-block-at-slot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workspaceId,
                  row: slot.row,
                  col: slot.col,
                  prompt: slotPrompt,
                  weightedNeighbors,
                  model,
                  locale,
                  // Author starter flag (default false; API also starts empty maps).
                  is_start: Boolean(opts?.isStart),
                  ...(opts?.contextSourceKeys?.length
                    ? { contextSourceKeys: opts.contextSourceKeys }
                    : {}),
                  ...(ayclToken ? { ayclToken } : {}),
                }),
              });
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorMessageFromBody(errorData, `Failed to add block at (${slot.row}, ${slot.col})`),
                );
              }
              const data = await response.json();
              if (data.updatedNodes?.length > 0) {
                const nextNodes = data.updatedNodes.map(
                  (n: Block & {
                    local_context?: unknown;
                    practice_options?: unknown;
                    creator_effects?: unknown;
                  }) => ({
                    ...n,
                    local_context: parseBlockLocalContext(n.local_context),
                    practice_options: parseBlockPracticeOptions(
                      n.practice_options,
                    ),
                    creator_effects: parseBlockCreatorEffects(
                      n.creator_effects,
                      { selfBlockId: n.id },
                    ),
                  }),
                );
                nodesRef.current = nextNodes;
                setNodes(nextNodes);
              }
            },
          });
          setExpandJobs((prev) =>
            applyAddExpandJobProgress(
              prev,
              jobId,
              { completed: result.completed, total: result.total },
              { stopped: result.stopped },
            ),
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to add blocks";
          setExpandJobs((prev) =>
            patchAddExpandJob(prev, jobId, {
              status: "error",
              error: message,
            }),
          );
        } finally {
          expandAbortRef.current.delete(jobId);
          // Drop finished job chrome after a short beat so users see 100% / Stopped.
          window.setTimeout(() => {
            setExpandJobs((prev) => {
              const next = removeAddExpandJob(prev, jobId);
              const merged = mergeActiveExpandJobPreviews(next);
              setAddExpandPreviewCells(merged.length ? merged : null);
              return next;
            });
          }, 1800);
        }
      })();
    },
    [applyMapSelectionResult, isOwner, locale, refreshNodes, router, workspaceId],
  );

  /**
   * Multi-select Bridge Blocks: enqueue corridor slots into the same background
   * expand-job loop (progress/stop/click-lock) with forced knowledge-bridge prompts.
   */
  const handleGenerateBridge = useCallback(
    async (input: {
      blockIds: string[];
      density: number;
      width?: number;
      userPrompt?: string;
      frozenSlots: Array<{ row: number; col: number }>;
      blockTitles: string[];
    }) => {
      if (!workspaceId || !isOwner) return;
      const slots = (input.frozenSlots || []).map((c) => ({
        row: c.row,
        col: c.col,
      }));
      if (slots.length === 0) return;
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;
      expandJobSeqRef.current += 1;
      const jobId = createAddExpandJobId(
        `bridge-${Date.now()}-${expandJobSeqRef.current}`,
      );
      const job = createAddExpandJob({
        id: jobId,
        frozenSlots: slots,
        label: `Bridge: ${(input.blockTitles || []).slice(0, 2).join(" ↔ ") || "topics"}`,
      });
      expandAbortRef.current.set(jobId, false);
      setExpandJobs((prev) => {
        const next = upsertAddExpandJob(prev, job);
        const merged = mergeActiveExpandJobPreviews(next);
        setAddExpandPreviewCells(merged.length ? merged : null);
        return next;
      });
      // Free multi-select surface; job continues under minimap.
      applyMapSelectionResult(nextWorkspaceMapSelection({ type: "clear" }));

      void (async () => {
        try {
          const result = await runAddExpandCreateLoop({
            frozenSlots: slots,
            isAborted: () => expandAbortRef.current.get(jobId) === true,
            onProgress: (progress) => {
              setExpandJobs((prev) => {
                const next = applyAddExpandJobProgress(prev, jobId, progress);
                const merged = mergeActiveExpandJobPreviews(next);
                setAddExpandPreviewCells(merged.length ? merged : null);
                return next;
              });
            },
            createSlot: async (slot, i) => {
              const lastNodes = nodesRef.current;
              const nodesById = new Map(lastNodes.map((node) => [node.id, node]));
              const { placements } = buildSkillGridLayout(lastNodes);
              const weightedNeighbors = getWeightedNeighborhood(
                { row: slot.row, col: slot.col },
                placements,
                nodesById,
              );
              const slotPrompt = buildBridgeKnowledgePrompt({
                blockTitles: input.blockTitles,
                userGuidance: input.userPrompt,
                slotIndex: i,
                totalSlots: slots.length,
                cell: slot,
              });
              const response = await fetch("/api/workspace/add-block-at-slot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workspaceId,
                  row: slot.row,
                  col: slot.col,
                  prompt: slotPrompt,
                  weightedNeighbors,
                  model,
                  locale,
                  intent: "bridge",
                  ...(ayclToken ? { ayclToken } : {}),
                }),
              });
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorMessageFromBody(errorData, `Failed to add bridge block at (${slot.row}, ${slot.col})`),
                );
              }
              const data = await response.json();
              if (data.updatedNodes?.length > 0) {
                const nextNodes = data.updatedNodes.map(
                  (n: Block & { local_context?: unknown }) => ({
                    ...n,
                    local_context: parseBlockLocalContext(n.local_context),
                  }),
                );
                nodesRef.current = nextNodes;
                setNodes(nextNodes);
              }
            },
          });
          setExpandJobs((prev) =>
            applyAddExpandJobProgress(
              prev,
              jobId,
              { completed: result.completed, total: result.total },
              { stopped: result.stopped },
            ),
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to generate bridge";
          setExpandJobs((prev) =>
            patchAddExpandJob(prev, jobId, {
              status: "error",
              error: message,
            }),
          );
        } finally {
          expandAbortRef.current.delete(jobId);
          window.setTimeout(() => {
            setExpandJobs((prev) => {
              const next = removeAddExpandJob(prev, jobId);
              const merged = mergeActiveExpandJobPreviews(next);
              setAddExpandPreviewCells(merged.length ? merged : null);
              return next;
            });
          }, 1800);
        }
      })();
    },
    [applyMapSelectionResult, isOwner, locale, refreshNodes, router, workspaceId],
  );


  return {
    handleExpandFromSourceBlock,
    handleSubmitAddBlock,
    handleGenerateBridge,
  };
}
