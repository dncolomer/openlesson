/**
 * Pure helpers for the workspace Simulation tab: scope selection + sample
 * generation via the same Explore/Drill builders live practice uses.
 *
 * Scope:
 * - block: samples grounded in one block + shared workspace context
 * - workspace: samples grounded in goal/title/notes + map inventory (no single focus)
 */

import {
  enforceSimulationProbeQuota,
  partitionSimulationProbes,
  SIMULATION_EXERCISE_COUNT,
  SIMULATION_QUESTION_COUNT,
  type SimulationProbe,
} from "@/lib/block-simulation";
import {
  buildGroundedDialogueQuestion,
  buildGroundedExerciseItem,
  buildSimulationSamplesSystemPrompt,
  buildSimulationSamplesUserPrompt,
  isMetaLearningFluff,
  type PracticeExternalLink,
  type PracticeItemContext,
} from "@/lib/practice-item-builders";
import {
  normalizeBlockLocalContext,
  type BlockLocalContextInput,
  type PromptBlockInventoryItem,
  type PromptExternalResourceItem,
  type WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";

export type SimulationSampleScopeKind = "block" | "workspace";

export type SimulationSampleScope =
  | { kind: "block"; blockId: string }
  | { kind: "workspace" };

export type SimulationSampleBlockRef = {
  id: string;
  title?: string | null;
  description?: string | null;
  planning_prompt?: string | null;
  /** Full local_context (notes, local files, global refs, external resource ids). */
  local_context?: BlockLocalContextInput | null;
  is_start?: boolean | null;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  next_block_ids?: string[] | null;
  lock_until_block_ids?: string[] | null;
};

export type SimulationSampleWorkspaceContext = {
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  workspaceGoal?: string | null;
  workspaceDescription?: string | null;
  notes?: string | null;
  locale?: string | null;
  blocks?: readonly SimulationSampleBlockRef[] | null;
  /** Workspace-global files (names + optional excerpts). */
  files?: readonly WorkspaceFileContextItem[] | null;
  /** Workspace external resources / links. */
  externalResources?: readonly PromptExternalResourceItem[] | null;
};

export type SimulationSampleBundle = {
  scope: SimulationSampleScope;
  questions: string[];
  exercises: string[];
  probes: SimulationProbe[];
  /** System prompt text used for LLM path (real Explore/Drill builders). */
  systemPrompt: string;
  /** User prompt text used for LLM path. */
  userPrompt: string;
  /** Practice context fed into pure builders. */
  practiceContext: PracticeItemContext;
};

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize raw request scope. Block scope requires a non-empty blockId.
 * Defaults to workspace when kind is workspace or blockId is omitted/empty
 * with an explicit workspace kind; otherwise block when blockId is present.
 */
export function normalizeSimulationSampleScope(raw: {
  scope?: string | null;
  blockId?: string | null;
  kind?: string | null;
}): SimulationSampleScope | { error: string } {
  const kindRaw = clean(raw.scope || raw.kind).toLowerCase();
  const blockId = clean(raw.blockId);

  if (kindRaw === "workspace" || kindRaw === "entire" || kindRaw === "all") {
    return { kind: "workspace" };
  }

  if (kindRaw === "block" || blockId) {
    if (!blockId) {
      return { error: "blockId is required when scope is block" };
    }
    return { kind: "block", blockId };
  }

  // No kind and no blockId → workspace-wide (tab default for "entire workspace")
  if (!kindRaw && !blockId) {
    return { kind: "workspace" };
  }

  return { error: "Invalid simulation sample scope" };
}

/** True when scope targets a single block. */
export function isBlockSimulationScope(
  scope: SimulationSampleScope,
): scope is { kind: "block"; blockId: string } {
  return scope.kind === "block";
}

/** True when scope is entire workspace (no focused block). */
export function isWorkspaceSimulationScope(
  scope: SimulationSampleScope,
): scope is { kind: "workspace" } {
  return scope.kind === "workspace";
}

function inventoryFromBlocks(
  blocks: readonly SimulationSampleBlockRef[] | null | undefined,
): PromptBlockInventoryItem[] {
  return (blocks || []).map((b) => ({
    id: b.id,
    title: clean(b.title) || "Block",
    description: (b.description as string | null) ?? null,
    is_start: b.is_start ?? null,
    position_x: b.position_x ?? null,
    position_y: b.position_y ?? null,
    span_w: b.span_w ?? null,
    span_h: b.span_h ?? null,
    next_block_ids: b.next_block_ids ?? null,
    lock_until_block_ids: b.lock_until_block_ids ?? null,
    local_context: b.local_context ?? null,
  }));
}

/**
 * Merge workspace files + focused-block local files/global refs into practice files.
 */
export function collectSimulationSampleFiles(
  workspace: SimulationSampleWorkspaceContext,
  focusedBlockId?: string | null,
): Array<{ name: string; excerpt?: string | null }> {
  const out: Array<{ name: string; excerpt?: string | null }> = [];
  const seen = new Set<string>();
  const push = (name: string, excerpt?: string | null) => {
    const n = clean(name);
    if (!n) return;
    const k = n.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ name: n, excerpt: excerpt ?? null });
  };
  for (const f of workspace.files || []) {
    push(String(f?.name || ""), f?.excerpt ?? null);
  }
  if (focusedBlockId) {
    const block = (workspace.blocks || []).find((b) => b.id === focusedBlockId);
    const local = normalizeBlockLocalContext(block?.local_context ?? null);
    for (const f of local.localFiles) {
      push(f.name, f.excerpt ?? null);
    }
    for (const ref of local.globalFileRefs) {
      push(ref, null);
    }
  }
  return out;
}

/**
 * Resolve external links for simulation: all workspace resources, preferring
 * those referenced by the focused block when external_resource_ids are set.
 */
export function collectSimulationSampleExternalLinks(
  workspace: SimulationSampleWorkspaceContext,
  focusedBlockId?: string | null,
): PracticeExternalLink[] {
  const all = [...(workspace.externalResources || [])];
  const byId = new Map(
    all
      .filter((r) => r?.id)
      .map((r) => [String(r.id), r] as const),
  );
  let preferredIds: string[] = [];
  if (focusedBlockId) {
    const block = (workspace.blocks || []).find((b) => b.id === focusedBlockId);
    const local = normalizeBlockLocalContext(block?.local_context ?? null);
    preferredIds = local.externalResourceIds;
  }
  const ordered: PromptExternalResourceItem[] = [];
  const seen = new Set<string>();
  for (const id of preferredIds) {
    const hit = byId.get(id);
    if (hit && !seen.has(id)) {
      seen.add(id);
      ordered.push(hit);
    }
  }
  for (const r of all) {
    const key = String(r.id || r.url || r.title || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ordered.push(r);
  }
  return ordered.map((r) => ({
    title: r.title ?? null,
    url: r.url ?? null,
    description: r.description ?? null,
  }));
}

/**
 * Build PracticeItemContext for the selected scope.
 * Block: focused block identity + substance + workspace fields + files/links.
 * Workspace: workspace goal/title/notes + files/links + map inventory via user prompt.
 */
export function buildSimulationSamplePracticeContext(
  scope: SimulationSampleScope,
  workspace: SimulationSampleWorkspaceContext,
): PracticeItemContext {
  const title =
    clean(workspace.workspaceTitle) || clean(workspace.rootTopic) || "Workspace";
  const goal =
    clean(workspace.workspaceGoal) ||
    clean(workspace.workspaceDescription) ||
    clean(workspace.rootTopic) ||
    "";

  if (scope.kind === "block") {
    const block = (workspace.blocks || []).find((b) => b.id === scope.blockId);
    const blockTitle = clean(block?.title) || "Untitled block";
    const blockDescription = clean(block?.description);
    const planning = clean(block?.planning_prompt);
    const local = normalizeBlockLocalContext(block?.local_context ?? null);
    const localNotes = clean(local.notes);
    const files = collectSimulationSampleFiles(workspace, scope.blockId);
    const externalLinks = collectSimulationSampleExternalLinks(
      workspace,
      scope.blockId,
    );
    return {
      workspaceTitle: title,
      rootTopic: workspace.rootTopic,
      workspaceGoal: goal || null,
      workspaceDescription: workspace.workspaceDescription,
      notes: workspace.notes,
      blockTitle,
      blockDescription: blockDescription || null,
      planningPrompt: planning || null,
      localNotes: localNotes || null,
      files,
      externalLinks,
    };
  }

  // Workspace-wide: subject is the workspace itself; inventory lives in user prompt.
  const files = collectSimulationSampleFiles(workspace, null);
  const externalLinks = collectSimulationSampleExternalLinks(workspace, null);
  return {
    workspaceTitle: title,
    rootTopic: workspace.rootTopic,
    workspaceGoal: goal || null,
    workspaceDescription: workspace.workspaceDescription,
    notes: workspace.notes,
    blockTitle: title,
    blockDescription:
      clean(workspace.workspaceDescription) ||
      clean(workspace.notes) ||
      goal ||
      null,
    planningPrompt: null,
    localNotes: clean(workspace.notes) || null,
    files,
    externalLinks,
  };
}

/**
 * Assemble system + user prompts via the same builders the block Simulation
 * regenerate path and live Explore/Drill rules use.
 */
export function buildSimulationSamplePrompts(
  scope: SimulationSampleScope,
  workspace: SimulationSampleWorkspaceContext,
): {
  systemPrompt: string;
  userPrompt: string;
  practiceContext: PracticeItemContext;
  focusedBlockId: string | null;
} {
  const practiceContext = buildSimulationSamplePracticeContext(scope, workspace);
  const inventory = inventoryFromBlocks(workspace.blocks);
  const focusedBlockId = scope.kind === "block" ? scope.blockId : null;

  const systemPrompt = buildSimulationSamplesSystemPrompt();
  const userPrompt = buildSimulationSamplesUserPrompt({
    ...practiceContext,
    blocks: inventory,
    focusedBlockId,
    locale: workspace.locale,
    sampleScope: scope.kind,
  });

  return { systemPrompt, userPrompt, practiceContext, focusedBlockId };
}

/**
 * Deterministic pure samples (no LLM) using the same Explore/Drill builders.
 * Always returns exactly SIMULATION_QUESTION_COUNT questions +
 * SIMULATION_EXERCISE_COUNT exercises.
 */
export function deriveSimulationSamples(
  scope: SimulationSampleScope,
  workspace: SimulationSampleWorkspaceContext,
): SimulationSampleBundle {
  const { systemPrompt, userPrompt, practiceContext } =
    buildSimulationSamplePrompts(scope, workspace);

  const probesIn: SimulationProbe[] = [];
  for (let i = 0; i < SIMULATION_QUESTION_COUNT; i++) {
    const question = buildGroundedDialogueQuestion(practiceContext, i);
    probesIn.push({
      id: `q-${i}`,
      question,
      coachCue: "",
      difficulty: i === 0 ? "warmup" : "core",
      kind: "question",
    });
  }
  for (let i = 0; i < SIMULATION_EXERCISE_COUNT; i++) {
    const question = buildGroundedExerciseItem(practiceContext, i);
    probesIn.push({
      id: `ex-${i}`,
      question,
      coachCue: "",
      difficulty: "stretch",
      kind: "exercise",
    });
  }

  const probes = enforceSimulationProbeQuota(probesIn, {
    title: practiceContext.blockTitle,
    description: practiceContext.blockDescription,
    workspaceGoal: practiceContext.workspaceGoal,
    workspaceTitle: practiceContext.workspaceTitle,
    rootTopic: practiceContext.rootTopic,
    planningPrompt: practiceContext.planningPrompt,
    localNotes: practiceContext.localNotes,
    notes: practiceContext.notes,
    files: practiceContext.files,
    externalLinks: practiceContext.externalLinks,
  });

  const { questions: qProbes, exercises: eProbes } =
    partitionSimulationProbes(probes);

  return {
    scope,
    questions: qProbes.map((p) => p.question),
    exercises: eProbes.map((p) => p.question),
    probes,
    systemPrompt,
    userPrompt,
    practiceContext,
  };
}

/**
 * Normalize an LLM/API payload into questions + exercises for the tab.
 * Falls back to pure builders when the model response is thin.
 */
export function normalizeSimulationSampleResponse(
  raw: unknown,
  scope: SimulationSampleScope,
  workspace: SimulationSampleWorkspaceContext,
): {
  questions: string[];
  exercises: string[];
  probes: SimulationProbe[];
  scope: SimulationSampleScope;
} {
  const seed = deriveSimulationSamples(scope, workspace);
  if (!raw || typeof raw !== "object") {
    return {
      questions: seed.questions,
      exercises: seed.exercises,
      probes: seed.probes,
      scope,
    };
  }
  const rec = raw as Record<string, unknown>;

  const questionsRaw = Array.isArray(rec.questions)
    ? rec.questions
    : [];
  const exercisesRaw = Array.isArray(rec.exercises)
    ? rec.exercises
    : [];
  const probesRaw = Array.isArray(rec.probes) ? rec.probes : [];

  const fromQuestions = questionsRaw
    .map((q) => (typeof q === "string" ? clean(q) : ""))
    .filter((q) => q.length >= 8 && !isMetaLearningFluff(q));
  const fromExercises = exercisesRaw
    .map((ex) => {
      if (typeof ex === "string") return clean(ex);
      if (ex && typeof ex === "object") {
        return clean(
          (ex as Record<string, unknown>).question ||
            (ex as Record<string, unknown>).text,
        );
      }
      return "";
    })
    .filter((q) => q.length >= 8 && !isMetaLearningFluff(q));

  const probeQs: string[] = [];
  const probeEx: string[] = [];
  for (const p of probesRaw) {
    if (!p || typeof p !== "object") continue;
    const pr = p as Record<string, unknown>;
    const text = clean(pr.question || pr.prompt || pr.text);
    if (text.length < 8 || isMetaLearningFluff(text)) continue;
    const kind = clean(pr.kind || pr.type).toLowerCase();
    const diff = clean(pr.difficulty).toLowerCase();
    if (kind === "exercise" || (!kind && diff === "stretch")) {
      probeEx.push(text);
    } else {
      probeQs.push(text);
    }
  }

  const questionsDraft = [
    ...fromQuestions,
    ...probeQs.filter((q) => !fromQuestions.includes(q)),
  ].slice(0, SIMULATION_QUESTION_COUNT);
  const exercisesDraft = [
    ...fromExercises,
    ...probeEx.filter((q) => !fromExercises.includes(q)),
  ].slice(0, SIMULATION_EXERCISE_COUNT);

  // Build probes then re-run enforceSimulationProbeQuota so meta LLM output is
  // replaced with the same pure builders live Explore/Drill use.
  const draftProbes: SimulationProbe[] = [
    ...questionsDraft.map((question, i) => ({
      id: `q-${i}`,
      question,
      coachCue: "",
      difficulty: (i === 0 ? "warmup" : "core") as SimulationProbe["difficulty"],
      kind: "question" as const,
    })),
    ...exercisesDraft.map((question, i) => ({
      id: `ex-${i}`,
      question,
      coachCue: "",
      difficulty: "stretch" as const,
      kind: "exercise" as const,
    })),
  ];

  const probes = enforceSimulationProbeQuota(draftProbes, {
    title: seed.practiceContext.blockTitle,
    description: seed.practiceContext.blockDescription,
    workspaceGoal: seed.practiceContext.workspaceGoal,
    workspaceTitle: seed.practiceContext.workspaceTitle,
    rootTopic: seed.practiceContext.rootTopic,
    planningPrompt: seed.practiceContext.planningPrompt,
    localNotes: seed.practiceContext.localNotes,
    notes: seed.practiceContext.notes,
    files: seed.practiceContext.files,
    externalLinks: seed.practiceContext.externalLinks,
  });
  const { questions: qProbes, exercises: eProbes } =
    partitionSimulationProbes(probes);

  return {
    questions: qProbes.map((p) => p.question),
    exercises: eProbes.map((p) => p.question),
    probes,
    scope,
  };
}
