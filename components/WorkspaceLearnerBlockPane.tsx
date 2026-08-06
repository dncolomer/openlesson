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
  initialLearnerDoneProgress,
  learnerDoneProgressForPhase,
  learnerDoneStatusValue,
  recommendLearnerDone,
  type LearnerDoneProgress,
  type LearnerDoneProgressPhase,
  type LearnerPowSummary,
} from "@/lib/workspace-learner-done";
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
  parseBlockPracticeOptions,
  type BlockPracticeOptions,
} from "@/lib/block-practice-options";
import {
  isDynamicEffectEnabled,
  parseBlockCreatorEffects,
  type BlockCreatorEffects,
} from "@/lib/block-creator-effects";

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
 * Learner-only right pane:
 * 1) Practice — Explore/Drill launch (timebox + customize session)
 * 2) Progress — PoW for this block + logged-in user, recommendation, Mark as Done
 * Not mounted in Creator mode.
 *
 * Creator effects (combinable):
 * - Dynamic: “?” until generated; unlock-after deps
 * - Generator: map spark-highlights empty targets
 */
export function WorkspaceLearnerBlockPane({
  block,
  blocks,
  workspaceId,
  locked = false,
  onLaunchIntent,
  onSavePlanningPrompt,
  onFetchPowSummary,
  onMarkDone,
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
  onLaunchIntent?: (
    target: ProductLaunchTarget,
    options?: ProductLaunchOptions,
  ) => void | Promise<void>;
  onSavePlanningPrompt?: (prompt: string) => void | Promise<void>;
  /** Load PoW for this block + current user (host scopes API). */
  onFetchPowSummary?: (blockId: string) => Promise<LearnerPowSummary | null>;
  onMarkDone?: (input: {
    blockId: string;
    status: string;
    onPhase?: (phase: LearnerDoneProgressPhase) => void;
  }) => Promise<{
    unlockedIds?: string[];
    generatedCells?: number;
    dynamicGenerated?: number;
  } | void>;
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

  const [progress, setProgress] = useState<LearnerDoneProgress>(
    initialLearnerDoneProgress,
  );
  const [powSummary, setPowSummary] = useState<LearnerPowSummary | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [planningPrompt, setPlanningPrompt] = useState(
    () => String(block.planning_prompt || ""),
  );
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);

  useEffect(() => {
    setPlanningPrompt(String(block.planning_prompt || ""));
  }, [block.id, block.planning_prompt]);

  const runPowCheck = useCallback(async () => {
    setProgress(learnerDoneProgressForPhase("checking_pow"));
    try {
      const summary = onFetchPowSummary
        ? await onFetchPowSummary(block.id)
        : { powCount: 0 };
      setPowSummary(summary);
      const reco = recommendLearnerDone(summary);
      setProgress(
        learnerDoneProgressForPhase("awaiting_user", {
          recommendation: reco.recommendation,
          rationale: reco.rationale,
        }),
      );
    } catch (err) {
      setProgress(
        learnerDoneProgressForPhase("error", {
          error: err instanceof Error ? err.message : "PoW check failed",
        }),
      );
    }
  }, [block.id, onFetchPowSummary]);

  useEffect(() => {
    void runPowCheck();
  }, [block.id, runPowCheck]);

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

  const markDone = async () => {
    // Force Mark Done is always allowed (including when PoW is Not OK or
    // map lock chrome is set) so Generator/Dynamic effects can still fire.
    if (!onMarkDone || isCompleted) return;
    const reco = progress.recommendation;
    const rationale = progress.rationale;
    setProgress(
      learnerDoneProgressForPhase("marking_done", {
        recommendation: reco,
        rationale,
      }),
    );
    try {
      const result = await onMarkDone({
        blockId: block.id,
        status: learnerDoneStatusValue(),
        onPhase: (phase) => {
          setProgress(
            learnerDoneProgressForPhase(phase, {
              recommendation: reco,
              rationale,
            }),
          );
        },
      });
      const unlocked = result?.unlockedIds?.length
        ? ` Unlocked ${result.unlockedIds.length} block(s).`
        : "";
      const generated =
        typeof result?.generatedCells === "number" && result.generatedCells > 0
          ? ` Generated ${result.generatedCells} block(s) from Generator.`
          : "";
      const dyn =
        typeof result?.dynamicGenerated === "number" &&
        result.dynamicGenerated > 0
          ? ` Updated ${result.dynamicGenerated} Dynamic block(s).`
          : "";
      setProgress(
        learnerDoneProgressForPhase("complete", {
          message: `Block marked done.${unlocked}${generated}${dyn}`,
          recommendation: reco,
          rationale,
        }),
      );
      // Refresh PoW summary after mark-done pipeline
      void runPowCheck();
    } catch (err) {
      setProgress(
        learnerDoneProgressForPhase("error", {
          error: err instanceof Error ? err.message : "Mark done failed",
          recommendation: reco,
          rationale,
        }),
      );
    }
  };

  // Note: map uses "?" for pending dynamic; pane keeps a readable label.
  const displayTitle = isDynamic
    ? String(block.title || "").trim() || "Dynamic block"
    : String(block.title || "").trim() || "Block";
  const reco = progress.recommendation;
  const busy =
    progress.phase === "checking_pow" ||
    progress.phase === "marking_done" ||
    progress.phase === "snapshot_lwm" ||
    progress.phase === "applying_unlocks";

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
        className="w-full resize-none rounded border border-neutral-700/60 bg-neutral-950/70 px-2.5 py-2 text-xs leading-relaxed text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
      />
    </div>
  );

  const byType = (powSummary?.byType || []).filter((t) => t.count > 0);
  const recent = powSummary?.recent || [];

  const defaultOpenId =
    (locked && showDynamicUnlockDrawer) || (locked && showLocalDagDrawer)
      ? showDynamicUnlockDrawer
        ? "dynamic_unlock"
        : "dependencies"
      : "practice";

  return (
    <WorkspaceRightPaneDrawerGroup
      defaultOpenId={defaultOpenId}
      data-workspace-right-pane="learner_practice"
      data-learner-block-pane
      data-learner-block-id={block.id}
      data-learner-effect-dynamic={isDynamic ? "true" : "false"}
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-neutral-950/95"
    >
      {/* Practice — launch only */}
      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="practice"
        title="Practice"
        defaultExpanded={
          !(locked && (showDynamicUnlockDrawer || showLocalDagDrawer))
        }
        bodyClassName="space-y-3"
      >
        <div data-learner-practice-body className="space-y-3">
          {locked ? (
            <p
              className="rounded-md border border-rose-500/35 bg-rose-950/30 px-2.5 py-2 text-[11px] text-rose-100/90"
              data-learner-block-locked
            >
              {showDynamicUnlockDrawer
                ? "Locked until every Dynamic unlock block is Done."
                : "Locked until prerequisites are done. See Dependencies for the local path graph."}
            </p>
          ) : null}

          {isDynamic ? (
            <p
              className="rounded-md border border-white/20 bg-white/5 px-2.5 py-2 text-[11px] text-neutral-200"
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
              practiceOptions={parseBlockPracticeOptions(block.practice_options)}
              onLaunchIntent={(target, options) => {
                void handleLaunch(target, options);
              }}
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
            <p className="text-[11px] leading-relaxed text-neutral-400">
              Complete every block below to unlock this Dynamic topic. These
              are not path-graph (DAG) edges.
            </p>
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
            <p className="text-[11px] leading-relaxed text-neutral-400">
              Local path for this block. Map highlights related blocks when you
              select a locked topic.
            </p>
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

      {/* Progress — PoW for this block + you + Mark as Done */}
      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="progress"
        title="Progress"
        defaultExpanded={false}
        bodyClassName="space-y-3"
        surfaceDataAttr="data-learner-progress-drawer"
      >
        <div
          data-learner-progress-pane
          data-learner-done-panel
          className="space-y-3"
        >
          <p className="text-[11px] leading-relaxed text-neutral-400">
            Your proof of work for{" "}
            <span className="text-neutral-200">{displayTitle}</span>
            {isCompleted ? (
              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-emerald-400/90">
                · done
              </span>
            ) : null}
          </p>

          {progress.phase === "checking_pow" ? (
            <p className="text-[11px] text-neutral-500" data-learner-pow-loading>
              Loading your PoW for this block…
            </p>
          ) : null}

          <div
            className="grid grid-cols-2 gap-2"
            data-learner-pow-summary-stats
          >
            <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2">
              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                Your artifacts
              </p>
              <p
                className="mt-0.5 font-mono text-lg text-white"
                data-learner-pow-count
              >
                {powSummary?.powCount ?? "—"}
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2">
              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                Status
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-neutral-200">
                {isCompleted ? "Done" : locked ? "Locked" : "Open"}
              </p>
            </div>
          </div>

          {byType.length > 0 ? (
            <div data-learner-pow-by-type>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                By type
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {byType.map((t) => (
                  <li
                    key={t.type}
                    data-learner-pow-type={t.type}
                    className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-neutral-300"
                  >
                    {t.type} · {t.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {recent.length > 0 ? (
            <div data-learner-pow-recent>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                Recent
              </p>
              <ul className="max-h-36 space-y-1 overflow-y-auto">
                {recent.slice(0, 8).map((r, i) => (
                  <li
                    key={`${r.created_at || i}-${r.type}-${i}`}
                    data-learner-pow-recent-item
                    className="rounded border border-white/10 bg-black/15 px-2 py-1.5 text-[11px] text-neutral-300"
                  >
                    <span className="text-neutral-100">{r.type}</span>
                    {r.tool_name ? (
                      <span className="text-neutral-500"> · {r.tool_name}</span>
                    ) : null}
                    {r.quality ? (
                      <span className="ml-1 text-[9px] uppercase tracking-wide text-neutral-600">
                        {r.quality}
                      </span>
                    ) : null}
                    {r.created_at ? (
                      <span className="mt-0.5 block text-[10px] text-neutral-600">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : powSummary && progress.phase === "awaiting_user" ? (
            <p
              className="text-[11px] text-neutral-600"
              data-learner-pow-empty
            >
              No proof of work for this block yet from your account. Explore or
              Drill first, then return here.
            </p>
          ) : null}

          {progress.phase !== "idle" &&
          progress.phase !== "awaiting_user" &&
          progress.phase !== "complete" &&
          progress.phase !== "checking_pow" ? (
            <div className="space-y-1" data-learner-done-progress>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-white/70 transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                  data-learner-done-progress-bar
                  data-progress-percent={progress.percent}
                  data-progress-phase={progress.phase}
                />
              </div>
              <p className="text-[11px] text-neutral-400">{progress.message}</p>
            </div>
          ) : null}

          {progress.rationale ? (
            <p
              className="text-[11px] leading-snug text-neutral-400"
              data-learner-done-recommendation
              data-recommendation={reco || "unknown"}
            >
              <span
                className={
                  reco === "ok"
                    ? "text-emerald-300"
                    : reco === "not_ok"
                      ? "text-amber-300"
                      : "text-neutral-400"
                }
              >
                {reco === "ok"
                  ? "OK"
                  : reco === "not_ok"
                    ? "Not OK"
                    : "Unknown"}
              </span>
              {" — "}
              {progress.rationale}
            </p>
          ) : null}

          {progress.error ? (
            <p className="text-[11px] text-rose-300" data-learner-done-error>
              {progress.error}
            </p>
          ) : null}

          {progress.phase === "complete" ? (
            <p
              className="text-[11px] text-emerald-300/90"
              data-learner-done-complete
            >
              {progress.message}
            </p>
          ) : null}

          <button
            type="button"
            data-learner-mark-done
            disabled={busy || !onMarkDone || isCompleted}
            onClick={() => void markDone()}
            className="w-full rounded-md bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {busy
              ? "Working…"
              : isCompleted
                ? "Already done"
                : reco === "not_ok" || locked
                  ? "Mark Done anyway"
                  : "Mark as Done"}
          </button>
          <p className="text-[10px] leading-snug text-neutral-600">
            PoW recommendation is advisory only. Mark Done always persists
            status, runs Generator / Dynamic effects, unlocks dependents, and
            refreshes the learning world model in the background.
          </p>

          <p className="sr-only" data-workspace-id={workspaceId}>
            {workspaceId}
          </p>
        </div>
      </WorkspaceRightPaneDrawer>
    </WorkspaceRightPaneDrawerGroup>
  );
}
