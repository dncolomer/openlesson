"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildLearnerDagView,
  type LearnerDagView,
} from "@/lib/workspace-mode";
import {
  learnerLocalDagDrawerRelevant,
  seedLearnerLocalDagDraft,
} from "@/lib/learner-local-dag";
import {
  WorkspaceRightPaneDrawer,
  WorkspaceRightPaneDrawerGroup,
} from "@/components/WorkspaceRightPaneDrawer";
import {
  BlockDetailCard,
  type ProductLaunchOptions,
} from "@/components/BlockDetailCard";
import { MultiBlockDagCanvas } from "@/components/MultiBlockDagCanvas";
import type { ProductLaunchTarget } from "@/lib/product-intent";
import {
  parseWorkspacePracticeOptions,
  type BlockPracticeOptions,
} from "@/lib/block-practice-options";
import {
  isDynamicEffectEnabled,
  parseBlockCreatorEffects,
  type BlockCreatorEffects,
} from "@/lib/block-creator-effects";
import { START_NEW_SESSION_LABEL } from "@/lib/block-previous-sessions";
import { applyLearnerDrawerRequest } from "@/lib/block-circular-menu";
import { LEARNER_WORK_DRAWER_TITLE } from "@/lib/insights";

export type LearnerBlockRef = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  is_start?: boolean | null;
  planning_prompt?: string | null;
  practice_options?: BlockPracticeOptions | unknown | null;
  creator_effects?: BlockCreatorEffects | unknown | null;
  lock_until_block_ids?: string[] | null;
  next_block_ids?: string[] | null;
  position_x?: number | null;
  position_y?: number | null;
};

/**
 * Learner-only right pane: practice launch (Calibrate / Learn / Verify)
 * and optional dependency drawers. Not mounted in Creator mode.
 *
 * Creator effects (combinable):
 * - Dynamic: “?” until generated; unlock-after deps
 * - Generator: map spark-highlights empty targets
 */
export function WorkspaceLearnerBlockPane({
  block,
  blocks,
  workspaceId,
  ayclToken,
  locked = false,
  requestedDrawerId = null,
  requestedDrawerNonce = null,
  onLaunchIntent,
  onSavePlanningPrompt,
  onDynamicGenerated: _onDynamicGenerated,
}: {
  block: LearnerBlockRef;
  blocks: readonly LearnerBlockRef[];
  workspaceId: string;
  ayclToken?: string;
  locale?: string;
  /** Stable learner key for sessionStorage (user id / aycl / guest). */
  learnerUserKey?: string | null;
  locked?: boolean;
  requestedDrawerId?: string | null;
  requestedDrawerNonce?: number | null;
  onLaunchIntent?: (
    target: ProductLaunchTarget,
    options?: ProductLaunchOptions,
  ) => void | Promise<void>;
  onSavePlanningPrompt?: (prompt: string) => void | Promise<void>;
  /** Host refresh after effect generation mutates blocks. */
  onBlocksUpdated?: (nodes: unknown[]) => void;
  onDynamicGenerated?: (blockId: string) => void;
}) {
  const effects = useMemo(
    () =>
      parseBlockCreatorEffects(block.creator_effects, {
        selfBlockId: block.id,
      }),
    [block.creator_effects, block.id],
  );
  const isDynamic = isDynamicEffectEnabled(effects);

  const dag: LearnerDagView = useMemo(
    () =>
      buildLearnerDagView({
        blockId: block.id,
        blocks,
      }),
    [block.id, blocks],
  );

  const localDagDraft = useMemo(
    () => seedLearnerLocalDagDraft(block.id, blocks),
    [block.id, blocks],
  );

  const showLocalDagDrawer = useMemo(
    () => learnerLocalDagDrawerRelevant(block.id, blocks),
    [block.id, blocks],
  );

  /** Dynamic unlock-after deps (not DAG edges). */
  const dynamicUnlockDeps = useMemo(() => {
    if (!isDynamic) return [];
    const byId = new Map(blocks.map((b) => [String(b.id), b] as const));
    return effects.dynamic.unlockAfterBlockIds.map((id) => {
      const b = byId.get(id);
      const st = String(b?.status || "").toLowerCase();
      return {
        id,
        title: String(b?.title || id).trim() || id,
        completed: st === "completed" || st === "done",
      };
    });
  }, [blocks, effects.dynamic.unlockAfterBlockIds, isDynamic]);

  const showDynamicUnlockDrawer =
    isDynamic && dynamicUnlockDeps.length > 0;

  const localDagCanvasBlocks = useMemo(
    () =>
      localDagDraft.blockIds.map((id) => {
        const b = blocks.find((x) => x.id === id);
        return {
          id,
          title: b?.title || "Untitled",
          position_x: b?.position_x ?? null,
          position_y: b?.position_y ?? null,
        };
      }),
    [localDagDraft.blockIds, blocks],
  );

  const [isStarting, setIsStarting] = useState(false);
  const [openDrawerId, setOpenDrawerId] = useState<string | null>("practice");
  const [planningPrompt, setPlanningPrompt] = useState(
    () => String(block.planning_prompt || ""),
  );
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);

  useEffect(() => {
    setPlanningPrompt(String(block.planning_prompt || ""));
  }, [block.id, block.planning_prompt]);

  const savePrompt = useCallback(async () => {
    if (!onSavePlanningPrompt) return;
    const next = planningPrompt.trim();
    const prev = String(block.planning_prompt || "").trim();
    if (next === prev) return;
    setSavingPrompt(true);
    setPromptSaved(false);
    try {
      await onSavePlanningPrompt(planningPrompt);
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save planning prompt:", err);
    } finally {
      setSavingPrompt(false);
    }
  }, [block.planning_prompt, onSavePlanningPrompt, planningPrompt]);

  const handleLaunch = async (
    target: ProductLaunchTarget,
    options?: ProductLaunchOptions,
  ) => {
    if (locked || !onLaunchIntent || isStarting) return;
    setIsStarting(true);
    try {
      await savePrompt();
      await onLaunchIntent(target, options);
    } finally {
      setIsStarting(false);
    }
  };

  // Note: map uses "?" for pending dynamic; pane keeps a readable label.
  const displayTitle = isDynamic
    ? String(block.title || "").trim() || "Dynamic block"
    : String(block.title || "").trim() || "Block";
  const isCompleted =
    String(block.status || "").toLowerCase() === "completed" ||
    String(block.status || "").toLowerCase() === "done";
  const isInProgress =
    String(block.status || "").toLowerCase() === "in_progress";
  const progressRing = isCompleted
    ? "completed"
    : isInProgress
      ? "in_progress"
      : "neutral";

  const promptSection = (
    <div data-customize-session data-learner-customize-session>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Customize the session
        </span>
        <span className="text-[10px] text-neutral-500">
          {savingPrompt ? "Saving…" : null}
          {!savingPrompt && promptSaved ? (
            <span className="text-neutral-300">Saved</span>
          ) : null}
        </span>
      </div>
      <textarea
        data-learner-planning-prompt
        value={planningPrompt}
        onChange={(e) => setPlanningPrompt(e.target.value)}
        onBlur={() => void savePrompt()}
        placeholder="Optional instructions for this practice session…"
        disabled={locked || isStarting}
        rows={3}
        className="w-full resize-none rounded-none border border-neutral-700/60 bg-neutral-950/70 px-2.5 py-2 text-xs leading-relaxed text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
      />
    </div>
  );

  const defaultOpenId =
    (locked && showDynamicUnlockDrawer) || (locked && showLocalDagDrawer)
      ? showDynamicUnlockDrawer
        ? "dynamic_unlock"
        : "dependencies"
      : "practice";

  useEffect(() => {
    setOpenDrawerId(
      applyLearnerDrawerRequest({
        defaultOpenId,
        requestedId: requestedDrawerId,
        requestedNonce: requestedDrawerNonce,
      }),
    );
  }, [defaultOpenId, block.id, requestedDrawerId, requestedDrawerNonce]);

  return (
    <WorkspaceRightPaneDrawerGroup
      defaultOpenId={defaultOpenId}
      openId={openDrawerId}
      onOpenIdChange={setOpenDrawerId}
      data-workspace-right-pane="learner_practice"
      data-learner-block-pane
      data-learner-block-id={block.id}
      data-workspace-id={workspaceId}
      data-learner-effect-dynamic={isDynamic ? "true" : "false"}
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-neutral-950/95"
    >
      {/* Work — launch only */}
      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="practice"
        title={LEARNER_WORK_DRAWER_TITLE}
        defaultExpanded={
          !(locked && (showDynamicUnlockDrawer || showLocalDagDrawer))
        }
        bodyClassName="space-y-3"
      >
        <div data-learner-practice-body className="space-y-3">
          {locked ? (
            <p
              className="rounded-none border border-rose-500/35 bg-rose-950/30 px-2.5 py-2 text-[11px] text-rose-100/90"
              data-learner-block-locked
            >
              {showDynamicUnlockDrawer
                ? "Locked until every Dynamic unlock block is Done."
                : "Locked until prerequisites are done. See Dependencies for the local path graph."}
            </p>
          ) : null}

          {isDynamic ? (
            <p
              className="rounded-none border border-white/20 bg-white/5 px-2.5 py-2 text-[11px] text-neutral-200"
              data-learner-dynamic-hint
            >
              Dynamic block — unlocks when selected blocks are Done, then
              content is generated from what you have learned so far.
            </p>
          ) : null}

          <div data-learner-explore-drill data-learner-launch-card>
            <BlockDetailCard
              layout="horizontal"
              title={displayTitle}
              description={block.description || undefined}
              progressRing={progressRing}
              isStart={Boolean(block.is_start)}
              isStarting={isStarting}
              isLocked={locked}
              showActions={Boolean(onLaunchIntent) && !locked}
              allowTimed
              practiceOptions={parseWorkspacePracticeOptions(
                block.practice_options,
                { ayclClone: Boolean(ayclToken) },
              )}
              onLaunchIntent={(target, options) => {
                void handleLaunch(target, options);
              }}
              ileStartLabel={START_NEW_SESSION_LABEL}
              promptSection={promptSection}
            />
          </div>
        </div>
      </WorkspaceRightPaneDrawer>

      {/* Dynamic unlock-after deps (not DAG edges) */}
      {showDynamicUnlockDrawer ? (
        <WorkspaceRightPaneDrawer
          variant="section"
          drawerId="dynamic_unlock"
          title="Unlock after"
          defaultExpanded={locked}
          bodyClassName="space-y-3"
          surfaceDataAttr="data-learner-dynamic-unlock-drawer"
        >
          <div data-learner-dynamic-unlock className="space-y-2">
            <ul className="space-y-1" data-learner-dynamic-unlock-deps>
              {dynamicUnlockDeps.map((p) => (
                <li
                  key={p.id}
                  data-learner-dynamic-unlock-dep={p.id}
                  className="flex items-center justify-between gap-2 text-[11px] text-neutral-300"
                >
                  <span className="truncate">{p.title}</span>
                  {p.completed ? (
                    <span className="shrink-0 text-emerald-400/90">Done</span>
                  ) : (
                    <span className="shrink-0 text-rose-300/90">Required</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </WorkspaceRightPaneDrawer>
      ) : null}

      {/* Dependencies — local DAG mini canvas (Learner-only; not editable) */}
      {showLocalDagDrawer ? (
        <WorkspaceRightPaneDrawer
          variant="section"
          drawerId="dependencies"
          title="Dependencies"
          defaultExpanded={locked && !showDynamicUnlockDrawer}
          bodyClassName="space-y-3"
          surfaceDataAttr="data-learner-dag-drawer"
        >
          <div
            data-learner-local-dag
            data-learner-dag
            data-learner-dag-participates={dag.participates ? "true" : "false"}
            data-learner-dag-edge-count={localDagDraft.edges.length}
            className="space-y-2"
          >
            <MultiBlockDagCanvas
              blocks={localDagCanvasBlocks}
              draft={localDagDraft}
              readOnly
            />
            {dag.prerequisites.length > 0 ? (
              <ul
                className="space-y-1 border-t border-white/10 pt-2"
                data-learner-dag-prereqs
              >
                {dag.prerequisites.map((p) => (
                  <li
                    key={p.id}
                    data-learner-dag-prereq={p.id}
                    className="flex items-center justify-between gap-2 text-[11px] text-neutral-300"
                  >
                    <span className="truncate">{p.title}</span>
                    {p.completed ? (
                      <span className="shrink-0 text-emerald-400/90">Done</span>
                    ) : (
                      <span className="shrink-0 text-rose-300/90">Required</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </WorkspaceRightPaneDrawer>
      ) : null}
    </WorkspaceRightPaneDrawerGroup>
  );
}
