"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  parseBlockLocalContext,
  type PromptBlockInventoryItem,
  type WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";
import { normalizeUnusableCells } from "@/lib/map-ground-rules";
import { isLowQualityTapbenchExercise, looksLikeTopicOverview } from "@/lib/pow-api/tapbench-exercise-quality";
import { CHAPTER_LOAD_DURATION_MS } from "@/components/session/sessionViewHelpers";
import { shouldAllowChapterLoadClick } from "@/lib/chapter-load-control";
import {
  appendIleChapterStep,
  buildSessionPlanStepsUpdate,
  isChapterSlotAvailable,
} from "@/lib/chapter-skill-grid";
import {
  ILE_CHAPTER_COMPLETE_MAX_EXPANSIONS,
  applyChapterCompleteTimExpansionToPlan,
  rejectTimChapterFromPlan,
  revealTimChapterIconOnPlan,
} from "@/lib/ile-tim-chapter-complete";
import type { PredictiveInterruption } from "@/lib/pow-api/predictive-interruption";
import {
  applyIleChapterUndoDone,
  planIleChapterClose,
  resolveIleChapterDoneIndex,
} from "@/lib/ile-chapter-close-review";
import type { IlePowCounterArtifact } from "@/lib/ile-pow-counters";
import { buildIleChapterAddPowToolData, buildIleChapterLoadPowToolData } from "@/lib/ile-chapter-depth";
import {
  buildFollowUpChapterDescription,
  findAdjacentFreeChapterSlot,
  type ChapterFollowUpSuggestion,
} from "@/lib/ile-chapter-follow-ups";
import {
  buildIleChapterDonePowToolData,
  buildIleProjectChapterExercisePrompt,
  emptyIleProjectDualLists,
  frameIleProjectChapterDescription,
  ileProjectThoughtsStorageKey,
  parseIleProjectThoughtsStored,
  serializeIleProjectThoughts,
  type ExerciseDualLists,
  type IleSessionMode,
} from "@/lib/ile-mode";
import { postIleSessionChat } from "@/lib/session-chat-client";
import { playSessionCompleteSound, playStepCompleteSound } from "@/lib/sounds";
import {
  updateSessionPlan,
  type Session,
  type SessionPlan,
  type SessionPlanStep,
  type ToolAction,
} from "@/lib/storage";
import type { IlePromptMaterials } from "@/components/session-view/types";
import type { HeliosTurnMode } from "@/components/thought-ui/ThoughtUi";
import type { ChatMessage } from "@/lib/session-chat-client";

export type SessionMutateInput = {
  session: Session | null;
  sessionRef: { current: Session | null };
  sessionPlanRef: { current: SessionPlan | null };
  setSessionPlan: (plan: SessionPlan | null) => void;
  resolvedSessionMode: IleSessionMode;
  isProjectMode: boolean;
  chapterThoughtsLocked: boolean;
  activeStep: SessionPlanStep | undefined;
  activeChapterKey: string;
  activeChapterIndexRef: { current: number };
  setActiveChapterIndex: (index: number) => void;
  chapterFocusSinceRef: { current: Record<number, number> };
  chapterLoading: boolean;
  setChapterLoading: (v: boolean) => void;
  setChapterLoadingIndex: (v: number | null) => void;
  chapterWorkspaces: Record<string, { chatMessages: ChatMessage[] }>;
  updateChapterWorkspace: (
    key: string,
    update:
      | Partial<{ chatMessages: ChatMessage[] }>
      | ((workspace: { chatMessages: ChatMessage[] }) => Partial<{ chatMessages: ChatMessage[] }>),
  ) => void;
  guestAccessBody: Record<string, unknown>;
  logToolRef: {
    current: ((
      toolName: "session_plan",
      action: ToolAction,
      metadata?: Record<string, unknown>,
    ) => Promise<void> | void) | null;
  };
  t: (key: string) => string;
  tutoringLanguage: string;
  locale: string;
  setHeliosTurnMode: (mode: HeliosTurnMode) => void;
  isRecording: boolean;
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
  setShowPlanCompleteModal: (v: boolean) => void;
  chapterDialoguePrompt: string;
  sessionPowArtifactsRef: { current: IlePowCounterArtifact[] };
  setChapterCloseReview: (review: {
    canClose: boolean;
    reason: string;
  } | null) => void;
};

export function useSessionMutate(input: SessionMutateInput) {
  const {
    session,
    sessionRef,
    sessionPlanRef,
    setSessionPlan,
    resolvedSessionMode,
    isProjectMode,
    chapterThoughtsLocked,
    activeStep,
    activeChapterKey,
    activeChapterIndexRef,
    setActiveChapterIndex,
    chapterFocusSinceRef,
    chapterLoading,
    setChapterLoading,
    setChapterLoadingIndex,
    chapterWorkspaces,
    updateChapterWorkspace,
    guestAccessBody,
    logToolRef,
    t,
    tutoringLanguage,
    locale,
    setHeliosTurnMode,
    isRecording,
    isPaused,
    setIsPaused,
    setShowPlanCompleteModal,
    chapterDialoguePrompt,
    sessionPowArtifactsRef,
    setChapterCloseReview,
  } = input;

  const [chapterFollowUpsById, setChapterFollowUpsById] = useState<
    Record<string, ChapterFollowUpSuggestion[]>
  >({});
  const [chapterFollowUpsLoadingId, setChapterFollowUpsLoadingId] = useState<string | null>(null);
  const [chapterFollowUpsErrorById, setChapterFollowUpsErrorById] = useState<
    Record<string, string>
  >({});
  const followUpsFetchedRef = useRef<Set<string>>(new Set());

/** Workspace materials for ILE Project framer + generate-exercise. */
const [ilePromptMaterials, setIlePromptMaterials] = useState<IlePromptMaterials | null>(null);

useEffect(() => {
  if (!isProjectMode || !session) return;
  const meta = (session.metadata || {}) as Record<string, unknown>;
  const workspaceId =
    typeof meta.workspace_id === "string" && meta.workspace_id.trim()
      ? meta.workspace_id.trim()
      : null;
  if (!workspaceId) return;
  const focusedBlockId =
    typeof meta.block_id === "string" && meta.block_id.trim()
      ? meta.block_id.trim()
      : typeof meta.focus_block_id === "string" && meta.focus_block_id.trim()
        ? meta.focus_block_id.trim()
        : null;
  let cancelled = false;
  const supabase = createClient();
  void (async () => {
    try {
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("id, title, root_topic, workspace_goal, description, notes, unusable_cells")
        .eq("id", workspaceId)
        .maybeSingle();
      if (cancelled || !workspace) return;
      const { data: blockRows } = await supabase
        .from("blocks")
        .select(
          "id, title, description, status, is_start, position_x, position_y, span_w, span_h, shape_cells, next_block_ids, lock_until_block_ids, local_context",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });
      const blocks: PromptBlockInventoryItem[] = (blockRows || []).map((n) => ({
        id: n.id,
        title: String(n.title || ""),
        description: (n as { description?: string | null }).description ?? null,
        status: (n as { status?: string | null }).status ?? null,
        is_start: (n as { is_start?: boolean | null }).is_start ?? null,
        position_x: (n as { position_x?: number | null }).position_x ?? null,
        position_y: (n as { position_y?: number | null }).position_y ?? null,
        span_w: (n as { span_w?: number | null }).span_w ?? null,
        span_h: (n as { span_h?: number | null }).span_h ?? null,
        shape_cells:
          (n as { shape_cells?: Array<{ dr: number; dc: number }> | null }).shape_cells ??
          null,
        next_block_ids: (n as { next_block_ids?: string[] | null }).next_block_ids ?? null,
        lock_until_block_ids:
          (n as { lock_until_block_ids?: string[] | null }).lock_until_block_ids ?? null,
        local_context: parseBlockLocalContext(
          (n as { local_context?: unknown }).local_context,
        ),
      }));
      const focused =
        (focusedBlockId && blocks.find((b) => b.id === focusedBlockId)) || null;
      let files: WorkspaceFileContextItem[] = [];
      try {
        const { data: fileRows } = await supabase
          .from("workspace_files")
          .select("file_name, mime_type")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(12);
        files = (fileRows || [])
          .map((f: { file_name?: string | null; mime_type?: string | null }) => ({
            name: typeof f.file_name === "string" ? f.file_name.trim() : "",
            mime_type: f.mime_type ?? null,
          }))
          .filter((f) => f.name);
      } catch {
        files = [];
      }
      if (cancelled) return;
      setIlePromptMaterials({
        workspaceId,
        workspaceTitle: workspace.title ?? session.problem ?? null,
        workspaceGoal:
          (workspace as { workspace_goal?: string | null }).workspace_goal ?? null,
        rootTopic: workspace.root_topic ?? null,
        notes: (workspace as { notes?: string | null }).notes ?? null,
        files,
        blocks,
        unusableCells: normalizeUnusableCells(
          (workspace as { unusable_cells?: unknown }).unusable_cells,
        ),
        focusedBlockId: focused?.id ?? focusedBlockId,
        blockTitle:
          focused?.title ||
          (typeof meta.block_title === "string" ? meta.block_title : null) ||
          session.problem ||
          null,
        blockDescription: focused?.description ?? null,
        blockLocalContext: focused?.local_context ?? null,
      });
    } catch {
      /* best-effort — pure framer still works with thinner input */
    }
  })();
  return () => {
    cancelled = true;
  };
}, [isProjectMode, session]);

const projectChapterExercisePrompt = useMemo(() => {
  if (!isProjectMode) return chapterDialoguePrompt;
  // Prefer the stored chapter text when it is already a real exercise (LLM-authored).
  // Thin topic wraps still go through the pure framer until upgraded async below.
  // Pass notes/files/blocks/local/unusable when loaded so ILE uses the shared assembler layers.
  return buildIleProjectChapterExercisePrompt({
    chapterDescription: activeStep?.description,
    blockTitle:
      ilePromptMaterials?.blockTitle ||
      (session?.metadata as { block_title?: string } | undefined)?.block_title ||
      session?.problem,
    blockDescription: ilePromptMaterials?.blockDescription,
    workspaceTitle:
      ilePromptMaterials?.workspaceTitle || session?.problem,
    workspaceGoal: ilePromptMaterials?.workspaceGoal,
    notes: ilePromptMaterials?.notes,
    files: ilePromptMaterials?.files,
    blocks: ilePromptMaterials?.blocks,
    focusedBlockId: ilePromptMaterials?.focusedBlockId,
    blockLocalContext: ilePromptMaterials?.blockLocalContext,
    unusableCells: ilePromptMaterials?.unusableCells,
  });
}, [
  isProjectMode,
  chapterDialoguePrompt,
  activeStep?.description,
  session?.metadata,
  session?.problem,
  ilePromptMaterials,
]);

/** LLM-authored exercise override for the active Project Mode chapter (when seed was thin). */
const [llmChapterExerciseById, setLlmChapterExerciseById] = useState<
  Record<string, string>
>({});
const llmChapterInflightRef = useRef<Set<string>>(new Set());

const displayProjectChapterExercise =
  (activeStep?.id && llmChapterExerciseById[activeStep.id]) ||
  projectChapterExercisePrompt;

/** When Project Mode chapter text is still a topic catalog / thin wrap, author a real exercise via LLM. */
useEffect(() => {
  if (!isProjectMode || !session?.id || !activeStep?.id) return;
  const seed = String(activeStep.description || "").trim();
  if (!seed) return;
  if (llmChapterExerciseById[activeStep.id]) return;
  if (llmChapterInflightRef.current.has(activeStep.id)) return;
  const thin =
    looksLikeTopicOverview(seed) ||
    isLowQualityTapbenchExercise(seed, {
      blockTitle:
        (session?.metadata as { block_title?: string } | undefined)?.block_title ||
        session?.problem,
      blockDescription: seed,
      workspaceTitle: session?.problem,
    });
  // Already a solid exercise — keep as-is (session-plan LLM / prior generate).
  if (!thin && seed.length > 80) return;

  const stepId = activeStep.id;
  llmChapterInflightRef.current.add(stepId);
  void (async () => {
    try {
      const res = await fetch("/api/generate-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          workspaceId: ilePromptMaterials?.workspaceId || undefined,
          surface: "ile_project",
          chapterDescription: seed,
          blockTitle:
            ilePromptMaterials?.blockTitle ||
            (session?.metadata as { block_title?: string } | undefined)?.block_title ||
            session?.problem,
          blockDescription: ilePromptMaterials?.blockDescription || undefined,
          workspaceTitle:
            ilePromptMaterials?.workspaceTitle || session?.problem,
          workspaceGoal: ilePromptMaterials?.workspaceGoal || undefined,
          notes: ilePromptMaterials?.notes || undefined,
          files: ilePromptMaterials?.files || undefined,
          blocks: ilePromptMaterials?.blocks || undefined,
          focusedBlockId: ilePromptMaterials?.focusedBlockId || undefined,
          blockLocalContext: ilePromptMaterials?.blockLocalContext || undefined,
          unusableCells: ilePromptMaterials?.unusableCells || undefined,
          ...guestAccessBody,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { exercise?: string };
      const exercise = String(data.exercise || "").trim();
      if (!exercise) return;
      setLlmChapterExerciseById((prev) =>
        prev[stepId] ? prev : { ...prev, [stepId]: exercise },
      );
      // Persist upgraded exercise onto the chapter so reloads stay high quality.
      const plan = sessionPlanRef.current;
      if (plan) {
        const nextSteps = plan.steps.map((s) =>
          s.id === stepId ? { ...s, description: exercise } : s,
        );
        void persistPlanSteps(
          { ...plan, steps: nextSteps },
          {
            toolAction: "chapter_exercise_upgrade",
            toolData: { stepId, source: "generate-exercise" },
          },
        ).catch(() => {});
      }
    } catch {
      /* keep pure framer */
    } finally {
      llmChapterInflightRef.current.delete(stepId);
    }
  })();
}, [
  isProjectMode,
  session?.id,
  session?.problem,
  session?.metadata,
  activeStep?.id,
  activeStep?.description,
  llmChapterExerciseById,
  guestAccessBody,
  ilePromptMaterials,
]);

// Project Mode dual-list thoughts keyed by chapter id (stash + solution).
const [projectThoughtsByChapter, setProjectThoughtsByChapter] = useState<
  Record<string, ExerciseDualLists>
>({});
const projectThoughtsByChapterRef = useRef(projectThoughtsByChapter);
useEffect(() => {
  projectThoughtsByChapterRef.current = projectThoughtsByChapter;
}, [projectThoughtsByChapter]);

const activeProjectChapterId = activeStep?.id ?? activeChapterKey ?? "default";
const activeProjectLists =
  projectThoughtsByChapter[activeProjectChapterId] ?? emptyIleProjectDualLists();

useEffect(() => {
  if (!isProjectMode || !session?.id) return;
  const key = ileProjectThoughtsStorageKey(session.id, activeProjectChapterId);
  try {
    const stored = parseIleProjectThoughtsStored(
      typeof window !== "undefined" ? window.localStorage.getItem(key) : null,
    );
    if (!stored) return;
    setProjectThoughtsByChapter((prev) => ({
      ...prev,
      [activeProjectChapterId]: stored,
    }));
  } catch {
    /* ignore */
  }
}, [activeProjectChapterId, isProjectMode, session?.id]);

useEffect(() => {
  if (!isProjectMode || !session?.id) return;
  const hasContent =
    activeProjectLists.stash.length > 0 || activeProjectLists.submitted.length > 0;
  if (!hasContent) return;
  const key = ileProjectThoughtsStorageKey(session.id, activeProjectChapterId);
  try {
    window.localStorage.setItem(key, serializeIleProjectThoughts(activeProjectLists));
  } catch {
    /* ignore */
  }
}, [activeProjectChapterId, activeProjectLists, isProjectMode, session?.id]);

const handleActiveChapterIndexChange = useCallback((index: number) => {
  const now = Date.now();
  chapterFocusSinceRef.current[index] = now;
  setActiveChapterIndex(index);
  activeChapterIndexRef.current = index;
  const step = sessionPlanRef.current?.steps?.[index];
  void logToolRef.current?.("session_plan", "chapter_focus", {
    stepIndex: index,
    stepId: step?.id,
    stepDescription: step?.description?.slice(0, 120),
  });
}, []);

const persistPlanSteps = useCallback(async (
  updatedPlan: SessionPlan,
  options?: { toolAction?: ToolAction; toolData?: Record<string, unknown> },
) => {
  const payload = buildSessionPlanStepsUpdate(updatedPlan);
  await updateSessionPlan(updatedPlan.id, payload);
  setSessionPlan(updatedPlan);
  sessionPlanRef.current = updatedPlan;
  if (options?.toolAction) {
    void logToolRef.current?.("session_plan", options.toolAction, options.toolData ?? {});
  }
}, []);

const chapterLoadingRef = useRef(chapterLoading);
chapterLoadingRef.current = chapterLoading;

const handleAcceptTimChapter = useCallback(async (stepId: string) => {
  const currentPlan = sessionPlanRef.current;
  if (!currentPlan) return;
  const revealed = revealTimChapterIconOnPlan(currentPlan, stepId);
  if (!revealed.changed) return;
  await persistPlanSteps(revealed.plan, {
    toolAction: "chapter_load",
    toolData: { via: "tim_accept", stepId },
  });
}, [persistPlanSteps]);

const handleRejectTimChapter = useCallback(async (stepId: string) => {
  const currentPlan = sessionPlanRef.current;
  if (!currentPlan) return;
  const rejected = rejectTimChapterFromPlan(currentPlan, stepId);
  if (!rejected.changed) return;
  const activeId = currentPlan.steps[activeChapterIndexRef.current]?.id;
  await persistPlanSteps(rejected.plan);
  if (!activeId) return;
  const nextIdx = rejected.plan.steps.findIndex((row) => row.id === activeId);
  if (nextIdx >= 0) {
    if (nextIdx !== activeChapterIndexRef.current) handleActiveChapterIndexChange(nextIdx);
    return;
  }
  handleActiveChapterIndexChange(rejected.plan.currentStepIndex);
}, [handleActiveChapterIndexChange, persistPlanSteps]);

const handleTimChapterMapExpansion = useCallback(
  async (interruption: PredictiveInterruption) => {
    const currentPlan = sessionPlanRef.current;
    if (!currentPlan) return;
    const makeId = (index: number) =>
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `tim-chapter-${Date.now()}-${index}`;
    const newStepIds = Array.from({ length: ILE_CHAPTER_COMPLETE_MAX_EXPANSIONS }, (_, index) => makeId(index));
    const result = applyChapterCompleteTimExpansionToPlan({
      plan: currentPlan,
      interruption,
      newStepIds,
      sessionMode: resolvedSessionMode,
    });
    if (!result || result.added.length === 0) return;
    let plan = result.plan;
    const added = result.added.map((step) => {
      if (!isProjectMode) return step;
      const framed = frameIleProjectChapterDescription(step.description);
      return framed === step.description ? step : { ...step, description: framed };
    });
    if (isProjectMode) {
      const byId = new Map(added.map((step) => [step.id, step]));
      plan = {
        ...plan,
        steps: plan.steps.map((step) => byId.get(step.id) ?? step),
      };
    }
    const first = added[0];
    await persistPlanSteps(plan, {
      toolAction: "chapter_add",
      toolData: buildIleChapterAddPowToolData({
        stepId: first.id,
        description: first.description,
        position_x: first.position_x ?? 0,
        position_y: first.position_y ?? 0,
        sessionMode: resolvedSessionMode,
        exercise: isProjectMode,
        sourceTopic: first.description,
        via: "tim_chapter_complete",
      }),
    });
    for (const extra of added.slice(1)) {
      void logToolRef.current?.("session_plan", "chapter_add", buildIleChapterAddPowToolData({
        stepId: extra.id,
        description: extra.description,
        position_x: extra.position_x ?? 0,
        position_y: extra.position_y ?? 0,
        sessionMode: resolvedSessionMode,
        exercise: isProjectMode,
        sourceTopic: extra.description,
        via: "tim_chapter_complete",
      }));
    }
  },
  [isProjectMode, persistPlanSteps, resolvedSessionMode],
);

const handleEnsureChapterPositions = useCallback((plan: SessionPlan) => {
  void persistPlanSteps(plan, {
    toolAction: "chapter_position",
    toolData: {
      via: "auto_grid_placement",
      stepCount: plan.steps.length,
    },
  }).catch(() => {});
}, [persistPlanSteps]);

const [chapterReloadNonce, setChapterReloadNonce] = useState(0);

const handleLoadChapter = useCallback(async (index: number) => {
  if (!shouldAllowChapterLoadClick({ chapterLoading: chapterLoadingRef.current })) return;
  const currentPlan = sessionPlanRef.current;
  const step = currentPlan?.steps?.[index];
  if (!currentPlan || !step) return;

  const isReload = index === activeChapterIndexRef.current;
  const toolAction = isReload ? "chapter_reload" : "chapter_load";
  const toolData = buildIleChapterLoadPowToolData({
    stepIndex: index,
    stepId: step.id,
    stepDescription: step.description,
    sessionMode: resolvedSessionMode,
    reload: isReload,
  });

  handleActiveChapterIndexChange(index);

  const showLoading = isReload || CHAPTER_LOAD_DURATION_MS > 0;
  if (showLoading) {
    chapterLoadingRef.current = true;
    setChapterLoading(true);
    setChapterLoadingIndex(index);
  }

  const updatedSteps = currentPlan.steps.map((s, i) => {
    if (i === index && s.status === "pending") return { ...s, status: "in_progress" as const };
    return s;
  });
  const updatedPlan = { ...currentPlan, steps: updatedSteps, currentStepIndex: index };
  try {
    await persistPlanSteps(updatedPlan, { toolAction, toolData });

    if (isReload) {
      setChapterReloadNonce((n) => n + 1);
      if (!isProjectMode && session) {
        setHeliosTurnMode("responding");
        const chapterKey = step.id;
        const placeholderId = `chapter-reload-${Date.now()}`;
        const existingMessages = chapterWorkspaces[chapterKey]?.chatMessages ?? [];
        updateChapterWorkspace(chapterKey, (workspace) => ({
          chatMessages: [
            ...workspace.chatMessages,
            { id: placeholderId, role: "assistant", content: "", pending: true },
          ],
        }));
        try {
          const { ok, data, errorMessage } = await postIleSessionChat({
              problem: session.problem,
              activeStepIndex: index,
              activeStepId: step.id,
              activeStepDescription: step.description,
              sessionPlan: updatedPlan,
              sessionId: session.id,
              tutoringLanguage,
              ...guestAccessBody,
              messages: [
                ...existingMessages.map((m) => ({
                  role: m.role,
                  content: m.content,
                  imageDataUrl: m.imageDataUrl,
                })),
                {
                  role: "user",
                  content: `Reload this chapter and continue coaching from here: ${step.description}`,
                },
              ],
            });
          const content =
            ok && typeof data?.message === "string" && data.message.trim()
              ? data.message.trim()
              : errorMessage || t("heliosChat.errorMessage");
          updateChapterWorkspace(chapterKey, (workspace) => ({
            chatMessages: workspace.chatMessages.map((message) =>
              message.id === placeholderId ? { ...message, content, pending: false } : message,
            ),
          }));
        } catch {
          updateChapterWorkspace(chapterKey, (workspace) => ({
            chatMessages: workspace.chatMessages.map((message) =>
              message.id === placeholderId
                ? { ...message, content: t("heliosChat.errorMessage"), pending: false }
                : message,
            ),
          }));
        } finally {
          setHeliosTurnMode("idle");
        }
      }
    } else if (CHAPTER_LOAD_DURATION_MS > 0) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, CHAPTER_LOAD_DURATION_MS);
      });
    }
  } finally {
    if (showLoading) {
      chapterLoadingRef.current = false;
      setChapterLoading(false);
      setChapterLoadingIndex(null);
    }
  }
}, [
  chapterWorkspaces,
  guestAccessBody,
  handleActiveChapterIndexChange,
  isProjectMode,
  persistPlanSteps,
  resolvedSessionMode,
  session,
  t,
  tutoringLanguage,
  updateChapterWorkspace,
]);

const handleAddChapter = useCallback(async (
  description: string,
  position: { row: number; col: number },
  options?: { keyword?: string | null },
) => {
  const currentPlan = sessionPlanRef.current;
  if (!currentPlan) return;
  const trimmed = description.trim();
  if (!trimmed) return;
  let framed = trimmed;
  let keyword = String(options?.keyword || "").trim() || null;
  // Same as workspace add-block-at-slot: author title/description/keyword together
  // so the map tile is not the first two words of whatever title was picked.
  const sessionId = sessionRef.current?.id || session?.id;
  if (sessionId) {
    try {
      const authored = await fetch("/api/workspace/generate-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          seed: trimmed,
          sessionMode: resolvedSessionMode,
          locale,
          ...guestAccessBody,
        }),
      });
      if (authored.ok) {
        const data = (await authored.json()) as {
          title?: string;
          description?: string;
          keyword?: string;
        };
        const nextDescription = String(data.description || "").trim();
        const nextKeyword = String(data.keyword || "").trim();
        if (nextDescription) framed = nextDescription;
        if (nextKeyword) keyword = nextKeyword;
      }
    } catch {
      /* keep seed; keyword fallback is first 1–2 title words */
    }
  }
  // Project Mode: LLM-author a real longer-horizon exercise (not a topic-list wrap).
  // Keep the generated map keyword even if the exercise text is rewritten.
  if (isProjectMode) {
    try {
      const res = await fetch("/api/generate-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          workspaceId: ilePromptMaterials?.workspaceId || undefined,
          surface: "ile_project",
          chapterDescription: framed,
          seed: framed,
          blockTitle:
            ilePromptMaterials?.blockTitle ||
            (session?.metadata as { block_title?: string } | undefined)?.block_title ||
            session?.problem,
          blockDescription: ilePromptMaterials?.blockDescription || undefined,
          workspaceTitle:
            ilePromptMaterials?.workspaceTitle || session?.problem,
          workspaceGoal: ilePromptMaterials?.workspaceGoal || undefined,
          notes: ilePromptMaterials?.notes || undefined,
          files: ilePromptMaterials?.files || undefined,
          blocks: ilePromptMaterials?.blocks || undefined,
          focusedBlockId: ilePromptMaterials?.focusedBlockId || undefined,
          blockLocalContext: ilePromptMaterials?.blockLocalContext || undefined,
          unusableCells: ilePromptMaterials?.unusableCells || undefined,
          ...guestAccessBody,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { exercise?: string };
        if (data.exercise?.trim()) framed = data.exercise.trim();
        else framed = frameIleProjectChapterDescription(framed);
      } else {
        framed = frameIleProjectChapterDescription(framed);
      }
    } catch {
      framed = frameIleProjectChapterDescription(framed);
    }
  }
  if (!isChapterSlotAvailable(currentPlan, position.row, position.col)) {
    throw new Error("That grid slot is already occupied.");
  }
  const newStepId = crypto.randomUUID();
  const updatedPlan = appendIleChapterStep(currentPlan, {
    id: newStepId,
    description: framed,
    position,
    keyword,
  });
  await persistPlanSteps(updatedPlan, {
    toolAction: "chapter_add",
    toolData: buildIleChapterAddPowToolData({
      stepId: newStepId,
      description: framed,
      position_x: position.col,
      position_y: position.row,
      sessionMode: resolvedSessionMode,
      exercise: isProjectMode,
      sourceTopic: trimmed,
    }),
  });
}, [
  persistPlanSteps,
  isProjectMode,
  resolvedSessionMode,
  session?.id,
  session?.problem,
  session?.metadata,
  guestAccessBody,
  ilePromptMaterials,
  locale,
]);

const handleUpdateChapter = useCallback(async (stepId: string, description: string) => {
  const currentPlan = sessionPlanRef.current;
  if (!currentPlan) return;
  const trimmed = description.trim();
  if (!trimmed) return;
  const updatedSteps = currentPlan.steps.map((step) =>
    step.id === stepId ? { ...step, description: trimmed } : step,
  );
  const updatedPlan = { ...currentPlan, steps: updatedSteps };
  await persistPlanSteps(updatedPlan, {
    toolAction: "chapter_edit",
    toolData: {
      stepId,
      description: trimmed.slice(0, 120),
    },
  });
}, [persistPlanSteps]);

const fetchChapterFollowUps = useCallback(
  async (
    step: SessionPlanStep,
    lists: ExerciseDualLists,
    options?: { force?: boolean },
  ) => {
    if (!session?.id || !isProjectMode) return;
    if (!options?.force && followUpsFetchedRef.current.has(step.id)) return;
    followUpsFetchedRef.current.add(step.id);
    setChapterFollowUpsLoadingId(step.id);
    setChapterFollowUpsErrorById((prev) => {
      const next = { ...prev };
      delete next[step.id];
      return next;
    });
    try {
      const response = await fetch("/api/workspace/suggest-chapter-follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          stepId: step.id,
          chapterDescription: step.description,
          solutionTexts: lists.submitted.map((t) => t.text),
          stashTexts: lists.stash.map((t) => t.text),
          locale,
          ...guestAccessBody,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Failed to generate follow-ups",
        );
      }
      const suggestions = Array.isArray(data.suggestions)
        ? (data.suggestions as ChapterFollowUpSuggestion[]).slice(0, 3)
        : [];
      setChapterFollowUpsById((prev) => ({ ...prev, [step.id]: suggestions }));
      if (suggestions.length === 0) {
        setChapterFollowUpsErrorById((prev) => ({
          ...prev,
          [step.id]: "No follow-up topics returned.",
        }));
      }
    } catch (err) {
      followUpsFetchedRef.current.delete(step.id);
      setChapterFollowUpsErrorById((prev) => ({
        ...prev,
        [step.id]: err instanceof Error ? err.message : "Failed to generate follow-ups",
      }));
    } finally {
      setChapterFollowUpsLoadingId((current) => (current === step.id ? null : current));
    }
  },
  [session?.id, isProjectMode, locale, guestAccessBody],
);

const handleSelectChapterFollowUp = useCallback(
  async (suggestion: ChapterFollowUpSuggestion) => {
    const plan = sessionPlanRef.current;
    if (!plan || !isProjectMode) return;
    const step = plan.steps[activeChapterIndexRef.current];
    if (!step) return;
    // Always place on the closest empty chapter square to the finished chapter.
    const slot = findAdjacentFreeChapterSlot(plan, step);
    // Seed from follow-up; handleAddChapter LLM-authors a real exercise.
    const description = buildFollowUpChapterDescription(suggestion);
    try {
      await handleAddChapter(description, slot, { keyword: suggestion.keyword });
      // Keep section visible: drop the chosen topic, then refresh so finished
      // chapters always have optional follow-ups available.
      setChapterFollowUpsById((prev) => ({
        ...prev,
        [step.id]: (prev[step.id] || []).filter(
          (s) =>
            !(s.title === suggestion.title && s.description === suggestion.description),
        ),
      }));
      const lists =
        projectThoughtsByChapterRef.current[step.id] ?? emptyIleProjectDualLists();
      void fetchChapterFollowUps(step, lists, { force: true });
    } catch (err) {
      setChapterFollowUpsErrorById((prev) => ({
        ...prev,
        [step.id]: err instanceof Error ? err.message : "Could not add chapter",
      }));
    }
  },
  [handleAddChapter, isProjectMode, fetchChapterFollowUps],
);

// Finished Project chapters always show Next adjacent topics — fetch if missing.
useEffect(() => {
  if (!isProjectMode || !activeStep || !chapterThoughtsLocked) return;
  if (chapterFollowUpsLoadingId === activeStep.id) return;
  if ((chapterFollowUpsById[activeStep.id]?.length ?? 0) > 0) return;
  if (chapterFollowUpsErrorById[activeStep.id]) return;
  const lists =
    projectThoughtsByChapterRef.current[activeStep.id] ?? emptyIleProjectDualLists();
  void fetchChapterFollowUps(activeStep, lists, {
    force: !followUpsFetchedRef.current.has(activeStep.id),
  });
}, [
  isProjectMode,
  activeStep,
  chapterThoughtsLocked,
  chapterFollowUpsById,
  chapterFollowUpsErrorById,
  chapterFollowUpsLoadingId,
  fetchChapterFollowUps,
]);

const handleMarkChapterDone = useCallback(async (opts?: { closeOverride?: boolean; stepId?: string | null }) => {
  const currentPlan = sessionPlanRef.current;
  if (!currentPlan?.steps?.length) return false;

  const idx = resolveIleChapterDoneIndex(
    currentPlan.steps,
    activeChapterIndexRef.current,
    opts?.stepId,
  );
  const step = idx >= 0 ? currentPlan.steps[idx] : undefined;
  if (!step || step.status === "completed" || step.status === "skipped") return false;

  const artifacts = sessionPowArtifactsRef.current;
  const planned = planIleChapterClose({
    artifacts,
    chapter: { id: step.id, description: step.description },
    closeOverride: Boolean(opts?.closeOverride),
  });
  if (!planned.close) {
    setChapterCloseReview({
      canClose: planned.review.canClose,
      reason: planned.review.reason,
    });
    return false;
  }
  setChapterCloseReview(null);

  const updatedSteps = currentPlan.steps.map((s, i) =>
    i === idx ? { ...s, status: "completed" as const } : s,
  );
  const updatedPlan = {
    ...currentPlan,
    steps: updatedSteps,
    currentStepIndex: idx,
  };

  const toolData = buildIleChapterDonePowToolData({
    stepIndex: idx,
    stepId: step.id,
    stepDescription: step.description,
    via: "chapter_map_mark_done",
    sessionMode: resolvedSessionMode,
    closeOverride: planned.closeOverride,
    reviewCanClose: planned.review.canClose,
  });

  await persistPlanSteps(updatedPlan, {
    toolAction: "chapter_done",
    toolData,
  });

  playStepCompleteSound();

  if (isProjectMode) {
    const lists =
      projectThoughtsByChapterRef.current[step.id] ?? emptyIleProjectDualLists();
    void fetchChapterFollowUps(step, lists);
  }

  if (updatedSteps.every((s) => s.status === "completed" || s.status === "skipped")) {
    playSessionCompleteSound();
    setTimeout(() => {
      setShowPlanCompleteModal(true);
      if (isRecording && !isPaused) setIsPaused(true);
    }, 1500);
  }
  return true;
}, [
  isPaused,
  isRecording,
  persistPlanSteps,
  isProjectMode,
  resolvedSessionMode,
  fetchChapterFollowUps,
  sessionPowArtifactsRef,
  setChapterCloseReview,
]);

const handleMarkChapterUndone = useCallback(async (stepId: string) => {
  const currentPlan = sessionPlanRef.current;
  if (!currentPlan?.steps?.length) return;
  const undone = applyIleChapterUndoDone(currentPlan.steps, stepId);
  if (!undone.changed) return;
  const updatedPlan = { ...currentPlan, steps: undone.steps };
  await persistPlanSteps(updatedPlan);
}, [persistPlanSteps]);


  return {
    persistPlanSteps,
    handleActiveChapterIndexChange,
    handleEnsureChapterPositions,
    handleLoadChapter,
    handleAcceptTimChapter,
    handleRejectTimChapter,
    handleAddChapter,
    handleUpdateChapter,
    chapterReloadNonce,
    fetchChapterFollowUps,
    handleSelectChapterFollowUp,
    handleMarkChapterDone,
    handleMarkChapterUndone,
    handleTimChapterMapExpansion,
    chapterFollowUpsById,
    chapterFollowUpsLoadingId,
    chapterFollowUpsErrorById,
    ilePromptMaterials,
    displayProjectChapterExercise,
    projectThoughtsByChapter,
    setProjectThoughtsByChapter,
    projectThoughtsByChapterRef,
    activeProjectChapterId,
    activeProjectLists,
  };
}
