"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ProductLaunchOptions } from "@/components/BlockDetailCard";
import {
  mapWorkspaceNodes,
  type Block,
  type WorkspaceBlockApiNode,
} from "@/components/workspace-view/types";
import {
  dynamicBlocksUnlockedAfterDone,
  dynamicGeneratedStorageKey,
  generatorTargetCellsAfterDone,
} from "@/lib/block-creator-effects";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import type { ProductLaunchTarget } from "@/lib/product-intent";
import {
  recordMapItemWorkedOn,
  resolveMapSelfProgressScope,
} from "@/lib/map-self-progress";
import type { UnusableCell } from "@/lib/map-ground-rules";
import type { MapGroundBlockRef } from "@/lib/map-ground-rules";
import {
  blocksUnlockedAfterDone,
  parseLearnerPowSummaryFromApi,
  type LearnerDoneProgressPhase,
  type LearnerPowSummary,
} from "@/lib/workspace-learner-done";
import {
  buildLearnerLaunchBody,
  buildLearnerPromptSaveBody,
  WORKSPACE_LEARNER_LAUNCH_PATH,
  WORKSPACE_LEARNER_PROMPT_PATH,
} from "@/lib/workspace-learner-writes";
import type { WorkspaceInteractionMode } from "@/lib/workspace-mode";

export function useWorkspaceLearner(input: {
  workspaceId: string;
  ayclToken?: string;
  currentUserId: string | null;
  locale: string;
  interactionMode: WorkspaceInteractionMode;
  nodes: Block[];
  setNodes: Dispatch<SetStateAction<Block[]>>;
  unusableCells: UnusableCell[];
  router: AppRouterInstance;
}) {
  const {
    workspaceId,
    ayclToken,
    currentUserId,
    locale,
    interactionMode,
    nodes,
    setNodes,
    unusableCells,
    router,
  } = input;

  /** Learner dynamic blocks that have been generated this session. */
  const [dynamicGeneratedIds, setDynamicGeneratedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const mapNodesWithEffects = useCallback(
    (raw: WorkspaceBlockApiNode[]) => mapWorkspaceNodes(raw),
    [],
  );

  /**
   * Run effect generation (dynamic unlock / generator empty-cell spawn).
   * Returns ok + error so Mark Done can await Generator and surface failures.
   */
  const runBlockEffectGenerate = useCallback(
    async (payload: {
      mode: "dynamic" | "generator_cell";
      blockId?: string;
      generatorBlockId?: string;
      row?: number;
      col?: number;
    }): Promise<{ ok: boolean; error?: string }> => {
      if (!workspaceId) {
        return { ok: false, error: "Missing workspace" };
      }
      const res = await fetch("/api/workspace/block-effect-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          ...(ayclToken ? { ayclToken } : {}),
          mode: payload.mode,
          blockId: payload.blockId,
          generatorBlockId: payload.generatorBlockId,
          row: payload.row,
          col: payload.col,
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = errorMessageFromBody(
          data,
          `Effect generate failed (${res.status})`,
        );
        console.warn("[effect-generate]", err);
        return { ok: false, error: err };
      }
      if (Array.isArray(data.updatedNodes)) {
        setNodes(mapNodesWithEffects(data.updatedNodes));
      }
      if (payload.mode === "dynamic" && payload.blockId) {
        setDynamicGeneratedIds((prev) => {
          const next = new Set(prev);
          next.add(payload.blockId!);
          return next;
        });
        try {
          const key = dynamicGeneratedStorageKey({
            workspaceId,
            blockId: payload.blockId,
            userKey: currentUserId || ayclToken || "local",
          });
          window.sessionStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
      }
      return { ok: true };
    },
    [ayclToken, currentUserId, locale, mapNodesWithEffects, setNodes, workspaceId],
  );

  // Must stay above loading/error early returns (Rules of Hooks).
  // Hydrate dynamic-generated flags from sessionStorage for map "?" labels.
  // Must stay above loading/error early returns (Rules of Hooks).
  useEffect(() => {
    if (!workspaceId || interactionMode !== "learner") return;
    const userKey = currentUserId || ayclToken || "local";
    const next = new Set<string>();
    for (const n of nodes) {
      try {
        const key = dynamicGeneratedStorageKey({
          workspaceId,
          blockId: n.id,
          userKey,
        });
        if (window.sessionStorage.getItem(key) === "1") {
          next.add(n.id);
        }
      } catch {
        /* ignore */
      }
    }
    setDynamicGeneratedIds(next);
  }, [workspaceId, interactionMode, currentUserId, ayclToken, nodes.length]);

  const handleBlocksUpdated = useCallback(
    (raw: unknown[]) => {
      if (Array.isArray(raw)) {
        setNodes(mapNodesWithEffects(raw as WorkspaceBlockApiNode[]));
      }
    },
    [mapNodesWithEffects, setNodes],
  );

  const handleDynamicGenerated = useCallback((blockId: string) => {
    setDynamicGeneratedIds((prev) => {
      const next = new Set(prev);
      next.add(blockId);
      return next;
    });
  }, []);

  const handleSavePlanningPrompt = useCallback(
    async (blockId: string, prompt: string) => {
      await fetch(WORKSPACE_LEARNER_PROMPT_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildLearnerPromptSaveBody({
            workspaceId,
            blockId,
            planningPrompt: prompt,
            ayclToken,
          }),
        ),
      });
      setNodes((prev) =>
        prev.map((n) =>
          n.id === blockId
            ? { ...n, planning_prompt: prompt.trim() || undefined }
            : n,
        ),
      );
    },
    [ayclToken, setNodes, workspaceId],
  );

  const handleLaunchIntent = useCallback(
    async (
      block: Block,
      target: ProductLaunchTarget,
      options?: ProductLaunchOptions,
    ) => {
      const progressScope = resolveMapSelfProgressScope({
        userId: currentUserId || ayclToken || "local",
        kind: "workspace",
        scopeId: workspaceId,
      });
      if (progressScope) {
        recordMapItemWorkedOn(progressScope, block.id);
      }
      // Same product intent map as SessionItem / BlockDetailCard.
      if (target.product === "ile") {
        const ileMode =
          target.session_mode === "project" ? "project" : "learning";
        const launchRes = await fetch(WORKSPACE_LEARNER_LAUNCH_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildLearnerLaunchBody({
              workspaceId,
              blockId: block.id,
              sessionMode: ileMode,
              ayclToken,
            }),
          ),
        });
        const launchData = await launchRes.json().catch(() => ({}));
        if (!launchRes.ok || !launchData.sessionId) {
          throw new Error(errorMessageFromBody(launchData, "Failed to launch ILE"));
        }
        router.push(`/session?id=${launchData.sessionId}`);
        return;
      }
      // TAP timed explore / drill
      const params = new URLSearchParams({
        blockId: block.id,
      });
      if (target.interaction_kind === "exercise") {
        params.set("interactionKind", "exercise");
      }
      if (
        typeof options?.minutes === "number" &&
        Number.isFinite(options.minutes) &&
        options.minutes > 0
      ) {
        params.set("minutes", String(Math.trunc(options.minutes)));
      }
      if (block.session_id) {
        params.set("sessionId", block.session_id);
      }
      router.push(`/workspace/${workspaceId}/tap?${params.toString()}`);
    },
    [ayclToken, currentUserId, router, workspaceId],
  );

  const handleFetchPowSummary = useCallback(
    async (blockId: string): Promise<LearnerPowSummary> => {
      try {
        // PoW for this block + logged-in user (Progress drawer).
        const qs = new URLSearchParams({
          workspaceId,
          subjectKey: "me",
          quality: "all",
          blockId,
        });
        const res = await fetch(
          `/api/workspace/proof-of-work-stats?${qs.toString()}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            powCount: 0,
            notes: errorMessageFromBody(data, "Failed to load PoW stats"),
          } satisfies LearnerPowSummary;
        }
        return parseLearnerPowSummaryFromApi(data);
      } catch {
        return { powCount: 0, notes: "PoW stats request failed" };
      }
    },
    [workspaceId],
  );

  const handleMarkDone = useCallback(
    async ({
      blockId,
      status,
      onPhase,
    }: {
      blockId: string;
      status: string;
      onPhase?: (phase: LearnerDoneProgressPhase) => void;
    }) => {
      const report = (phase: LearnerDoneProgressPhase) => {
        onPhase?.(phase);
      };

      // 1) Persist status via map-ground (await success) — always allowed
      // regardless of PoW recommendation (force Mark Done).
      report("marking_done");
      const groundRes = await fetch("/api/workspace/map-ground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          ...(ayclToken ? { ayclToken } : {}),
          op: "set_block_status",
          blockId,
          status,
        }),
      });
      const groundData = await groundRes.json().catch(() => ({}));
      if (!groundRes.ok) {
        throw new Error(
          errorMessageFromBody(groundData, "Failed to mark block done"),
        );
      }

      const before = nodes.map((n) => ({
        id: n.id,
        title: n.title,
        status: n.status,
        lock_until_block_ids: n.lock_until_block_ids,
        creator_effects: n.creator_effects,
        position_x: n.position_x,
        position_y: n.position_y,
      }));
      const { unlockedIds } = blocksUnlockedAfterDone({
        completedBlockId: blockId,
        blocks: before as MapGroundBlockRef[],
      });

      // Prefer server nodes (with status) but keep client-parsed effects.
      if (Array.isArray(groundData.updatedNodes)) {
        setNodes(mapNodesWithEffects(groundData.updatedNodes as WorkspaceBlockApiNode[]));
      } else {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === blockId ? { ...n, status: "completed" } : n,
          ),
        );
      }

      // Blocks for effect resolution: mark completed in the snapshot
      // we use (do not wait for React state).
      const blocksForEffects = before.map((n) =>
        n.id === blockId ? { ...n, status: "completed" } : n,
      );

      // 2) Generator / Dynamic effects immediately after status save.
      // Do NOT wait on LWM snapshot first — that can hang for minutes
      // and previously blocked generator spawn entirely.
      report("applying_unlocks");
      const effectErrors: string[] = [];

      const genCells = generatorTargetCellsAfterDone({
        completedBlockId: blockId,
        blocks: blocksForEffects,
        unusableKeys: unusableCells.map((c) => `${c.row}:${c.col}`),
      });
      for (const cell of genCells) {
        const result = await runBlockEffectGenerate({
          mode: "generator_cell",
          generatorBlockId: blockId,
          row: cell.row,
          col: cell.col,
        });
        if (!result.ok) {
          effectErrors.push(
            result.error || `Generator failed at (${cell.row},${cell.col})`,
          );
        }
      }

      const dynamicIds = dynamicBlocksUnlockedAfterDone({
        completedBlockId: blockId,
        blocks: blocksForEffects,
      });
      for (const dynId of dynamicIds) {
        const result = await runBlockEffectGenerate({
          mode: "dynamic",
          blockId: dynId,
        });
        if (!result.ok) {
          effectErrors.push(
            result.error || `Dynamic generate failed for ${dynId}`,
          );
        }
      }

      // 3) Soft LWM snapshot (non-blocking after soft timeout)
      report("snapshot_lwm");
      try {
        const snapAbort = new AbortController();
        const snapTimer = window.setTimeout(() => snapAbort.abort(), 12_000);
        const snapRes = await fetch(`/api/workspaces/${workspaceId}/snapshot-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId }),
          signal: snapAbort.signal,
        }).catch(() => null);
        window.clearTimeout(snapTimer);
        if (snapRes && !snapRes.ok && snapRes.status >= 500) {
          console.warn("[learner-done] snapshot-all failed", snapRes.status);
        }
      } catch {
        /* snapshot is best-effort after Done */
      }

      if (effectErrors.length) {
        throw new Error(
          `Marked done, but generation failed: ${effectErrors[0]}`,
        );
      }
      return {
        unlockedIds,
        generatedCells: genCells.length,
        dynamicGenerated: dynamicIds.length,
      };
    },
    [
      ayclToken,
      mapNodesWithEffects,
      nodes,
      runBlockEffectGenerate,
      setNodes,
      unusableCells,
      workspaceId,
    ],
  );

  return {
    dynamicGeneratedIds,
    setDynamicGeneratedIds,
    mapNodesWithEffects,
    runBlockEffectGenerate,
    handleBlocksUpdated,
    handleDynamicGenerated,
    handleSavePlanningPrompt,
    handleLaunchIntent,
    handleFetchPowSummary,
    handleMarkDone,
  };
}
