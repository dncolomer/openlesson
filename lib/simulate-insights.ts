/**
 * Simulate Insights — multi-step rehearsal of craftable insights.
 * Pure: no network. A run is two sequential model steps. Insight candidates
 * are readable only after the second step finishes.
 */

export const SIMULATE_INSIGHTS_STEP_COUNT = 2;
/** Same per-request limit other xAI calls use. Each step may retry once. */
export const SIMULATE_INSIGHTS_FETCH_TIMEOUT_MS = 45_000;

/** How long the client keeps reading one job before offering another read of that same job. */
export function simulateInsightsPollBudgetMs(): number {
  const attemptsPerStep = 2;
  return (
    SIMULATE_INSIGHTS_STEP_COUNT * attemptsPerStep * SIMULATE_INSIGHTS_FETCH_TIMEOUT_MS +
    15_000
  );
}

/**
 * A click continues a job that is still running. A failed read or a job
 * that ended in error starts a new run. Waiting means the same job is
 * still in progress and should be read again.
 */
export function simulateInsightsClickStartsNewJob(input: {
  jobId: string | null;
  phase: "idle" | "running" | "waiting" | "done" | "failed";
}): boolean {
  if (input.phase === "running") return false;
  if (input.phase === "failed") return true;
  if (input.jobId && input.phase === "waiting") return false;
  return true;
}

export type SimulatedInsight = {
  id: string;
  title: string;
  body: string;
};

export type SimulateInsightsScope = "block" | "workspace" | "multi_block";

export type SimulateInsightsContext = {
  scope?: SimulateInsightsScope;
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  goal?: string | null;
  blockTitles?: string[] | null;
  modifier?: string | null;
};

export type SimulateInsightsStepCaller = (input: {
  step: 1 | 2;
  systemPrompt: string;
  userPrompt: string;
}) => Promise<unknown>;

export type SimulateInsightsJobStatus = "running" | "completed" | "error";

export type SimulateInsightsJob = {
  id: string;
  status: SimulateInsightsJobStatus;
  completedSteps: number;
  insights: SimulatedInsight[];
  error: string | null;
  scope: SimulateInsightsScope;
  blockId: string | null;
  blockIds: string[];
  createdAt: string;
  updatedAt: string;
};

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createSimulateInsightsJob(input: {
  scope?: SimulateInsightsScope;
  blockId?: string | null;
  blockIds?: string[] | null;
  id?: string;
}): SimulateInsightsJob {
  const ts = nowIso();
  return {
    id: clean(input.id) || `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    status: "running",
    completedSteps: 0,
    insights: [],
    error: null,
    scope: input.scope || "workspace",
    blockId: clean(input.blockId) || null,
    blockIds: (input.blockIds || []).map((id) => clean(id)).filter(Boolean),
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Insight candidates are visible only after both steps have finished. */
export function readableSimulateInsights(
  job: SimulateInsightsJob | null | undefined,
): SimulatedInsight[] {
  if (!job) return [];
  if (job.status !== "completed") return [];
  if (job.completedSteps < SIMULATE_INSIGHTS_STEP_COUNT) return [];
  return job.insights.filter((item) => clean(item.title) && clean(item.body));
}

export function normalizeSimulatedInsights(raw: unknown): SimulatedInsight[] {
  const list = insightRows(raw);
  const out: SimulatedInsight[] = [];
  const seen = new Set<string>();
  list.forEach((row, index) => {
    if (out.length >= 6) return;
    const title = clean(row.title);
    const body = clean(row.body);
    if (title.length < 2 || body.length < 12) return;
    const key = `${title.toLowerCase()}\n${body.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: clean(row.id) || `insight-${index + 1}`,
      title: clip(title, 120),
      body: clip(body, 600),
    });
  });
  return out;
}

function insightRows(raw: unknown): Array<{ id?: string; title?: string; body?: string }> {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((row) => row && typeof row === "object") as Array<{
    id?: string;
    title?: string;
    body?: string;
  }>;
  if (typeof raw !== "object") return [];
  const rec = raw as Record<string, unknown>;
  const list = Array.isArray(rec.insights)
    ? rec.insights
    : Array.isArray(rec.candidates)
      ? rec.candidates
      : [];
  return list.filter((row) => row && typeof row === "object") as Array<{
    id?: string;
    title?: string;
    body?: string;
  }>;
}

export function normalizeInsightObservations(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const rec = raw as Record<string, unknown>;
  const list = Array.isArray(rec.observations)
    ? rec.observations
    : Array.isArray(rec.noticings)
      ? rec.noticings
      : [];
  const out: string[] = [];
  for (const row of list) {
    const text =
      typeof row === "string"
        ? clean(row)
        : row && typeof row === "object"
          ? clean((row as { text?: unknown; observation?: unknown }).text ?? (row as { observation?: unknown }).observation)
          : "";
    if (text.length < 8) continue;
    out.push(clip(text, 280));
    if (out.length >= 8) break;
  }
  return out;
}

function contextBlock(context: SimulateInsightsContext): string {
  const lines = [
    context.title ? `Block: ${clip(clean(context.title), 160)}` : null,
    context.description ? `Description: ${clip(clean(context.description), 400)}` : null,
    context.goal ? `Workspace goal: ${clip(clean(context.goal), 240)}` : null,
    context.notes ? `Notes: ${clip(clean(context.notes), 800)}` : null,
    context.blockTitles?.length
      ? `Blocks: ${context.blockTitles.map((t) => clean(t)).filter(Boolean).slice(0, 12).join("; ")}`
      : null,
    context.modifier ? `Author modifier: ${clip(clean(context.modifier), 400)}` : null,
    context.scope ? `Scope: ${context.scope}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function stepOnePrompts(context: SimulateInsightsContext): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: [
      "You rehearse a learning block before a learner opens it.",
      "List concrete observations a learner could notice while crafting an insight on this material.",
      "Return JSON only: { \"observations\": [\"...\"] }",
      "Do not write the final insights. Do not write questions or exercises.",
    ].join("\n"),
    userPrompt: [
      contextBlock(context),
      "",
      "What could a learner notice here that is specific enough to become an insight?",
    ].join("\n"),
  };
}

function stepTwoPrompts(
  context: SimulateInsightsContext,
  observations: readonly string[],
): { systemPrompt: string; userPrompt: string } {
  const noticed = observations.length
    ? observations.map((line) => `- ${line}`).join("\n")
    : "- (no observations from the first pass)";
  return {
    systemPrompt: [
      "You turn a rehearsal's observations into insight candidates a learner could craft.",
      "Each candidate has a short title and an insight body written as the insight itself.",
      "Return JSON only: { \"insights\": [ { \"title\": \"short title\", \"body\": \"the insight a learner could submit\" } ] }",
      "Return 3 insights when the material supports them.",
      "Do not return questions or exercises.",
    ].join("\n"),
    userPrompt: [
      contextBlock(context),
      "",
      "Observations from the first pass:",
      noticed,
      "",
      "Write the insight candidates grounded in those observations.",
    ].join("\n"),
  };
}

/**
 * Two sequential model steps. Step 2 sees step 1's observations.
 * The returned list is only the step-2 insight candidates.
 */
export async function runSimulateInsights(input: {
  context: SimulateInsightsContext;
  callStep: SimulateInsightsStepCaller;
  onStep?: (update: {
    completedSteps: number;
    insights: SimulatedInsight[];
  }) => Promise<void> | void;
}): Promise<SimulatedInsight[]> {
  await input.onStep?.({ completedSteps: 0, insights: [] });
  const first = stepOnePrompts(input.context);
  const step1 = await input.callStep({ step: 1, ...first });
  const observations = normalizeInsightObservations(step1);
  await input.onStep?.({ completedSteps: 1, insights: [] });
  const second = stepTwoPrompts(input.context, observations);
  const step2 = await input.callStep({ step: 2, ...second });
  const insights = normalizeSimulatedInsights(step2);
  if (insights.length === 0) {
    throw new Error("Simulate Insights returned no insight candidates");
  }
  await input.onStep?.({
    completedSteps: SIMULATE_INSIGHTS_STEP_COUNT,
    insights,
  });
  return insights;
}

export async function runSimulateInsightsJob(input: {
  job: SimulateInsightsJob;
  context: SimulateInsightsContext;
  callStep: SimulateInsightsStepCaller;
  persist: (job: SimulateInsightsJob) => Promise<void> | void;
}): Promise<SimulateInsightsJob> {
  let current: SimulateInsightsJob = {
    ...input.job,
    status: "running",
    insights: [],
    error: null,
    updatedAt: nowIso(),
  };
  try {
    await runSimulateInsights({
      context: input.context,
      callStep: input.callStep,
      onStep: async (update) => {
        const finished = update.completedSteps >= SIMULATE_INSIGHTS_STEP_COUNT;
        current = {
          ...current,
          status: finished ? "completed" : "running",
          completedSteps: update.completedSteps,
          insights: finished ? update.insights : [],
          updatedAt: nowIso(),
        };
        await input.persist(current);
      },
    });
    return current;
  } catch (err) {
    current = {
      ...current,
      status: "error",
      insights: [],
      error: err instanceof Error ? err.message : "Simulation failed",
      updatedAt: nowIso(),
    };
    await input.persist(current);
    return current;
  }
}
