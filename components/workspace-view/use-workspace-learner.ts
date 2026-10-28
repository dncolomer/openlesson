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
  dynamicGeneratedStorageKey,
} from "@/lib/block-creator-effects";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import type { ProductLaunchTarget } from "@/lib/product-intent";
import {
  recordMapItemWorkedOn,
  resolveMapSelfProgressScope,
} from "@/lib/map-self-progress";
import {
  buildLearnerLaunchBody,
  buildLearnerPromptSaveBody,
  WORKSPACE_LEARNER_LAUNCH_PATH,
  WORKSPACE_LEARNER_PROMPT_PATH,
} from "@/lib/workspace-learner-writes";
import { mapBlockLaunch } from "@/lib/block-kind";
export function useWorkspaceLearner(input: {
  workspaceId: string;
  ayclToken?: string;
  currentUserId: string | null;
  locale: string;
  learnerActivity: boolean;
  nodes: Block[];
  setNodes: Dispatch<SetStateAction<Block[]>>;
  router: AppRouterInstance;
}) {
  const {
    workspaceId,
    ayclToken,
    currentUserId,
    locale,
    learnerActivity,
    nodes,
    setNodes,
    router,
  } = input;

  /** Learner dynamic blocks that have been generated this session. */
  const [dynamicGeneratedIds, setDynamicGeneratedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const mapNodesWithEffects = useCallback(
    (raw: WorkspaceBlockApiNode[]) =>
      mapWorkspaceNodes(raw, { ayclClone: Boolean(ayclToken) }),
    [ayclToken],
  );

  /**
   * Run effect generation (dynamic unlock / generator empty-cell spawn).
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
    if (!workspaceId || !learnerActivity) return;
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
  }, [workspaceId, learnerActivity, currentUserId, ayclToken, nodes.length]);

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
      const linked = mapBlockLaunch(block.map_block);
      if (linked.action === "none") return;
      if (linked.action === "calibrate" || linked.action === "verify") {
        router.push(linked.href);
        return;
      }
      if (options?.verification) {
        const params = new URLSearchParams({
          blockId: block.id,
          session: "verification",
        });
        if (
          typeof options?.minutes === "number" &&
          Number.isFinite(options.minutes) &&
          options.minutes > 0
        ) {
          params.set("minutes", String(Math.trunc(options.minutes)));
        }
        if (block.session_id) params.set("sessionId", block.session_id);
        router.push(`/workspace/${workspaceId}/verify?${params.toString()}`);
        return;
      }
      // Same product intent map as SessionItem / BlockDetailCard.
      if (target.product === "ile") {
        const ileMode = "learning";
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
          throw new Error(errorMessageFromBody(launchData, "Failed to launch Learn"));
        }
        router.push(`/session?id=${launchData.sessionId}`);
        return;
      }
      if (target.interaction_kind !== "scout") return;
      const params = new URLSearchParams({
        blockId: block.id,
      });
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
      router.push(`/workspace/${workspaceId}/calibrate?${params.toString()}`);
    },
    [ayclToken, currentUserId, router, workspaceId],
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
  };
}
