// ============================================
// xAI HIGH-LEVEL HELPERS
//
// Domain wrappers around the shared xAI client (lib/xai-client.ts):
//   - analyzeGap           (audio → transcript → gap analysis JSON)
//   - generateOpeningProbe (first question for a session)
//   - generateProbe        (mid-session probe)
//   - generateObjectives   (session objectives at start)
//   - generateReport       (post-session markdown report)
//   - createSessionPlanLLM (initial plan)
//   - updateSessionPlanLLM (heartbeat plan update with attached session files)
//
// Prompts live in lib/prompts.ts.
// ============================================

import {
  callXaiText,
  callXaiJSON,
  callXaiResponses,
  callXaiResponsesWithFiles,
  DEFAULT_MODEL,
  RECOMMENDED_TEMPS,
  userMessage,
  type ResponsesInputContent,
} from "./xai-client";
import { transcribeAudioBase64 } from "./xai-stt";
import { getPrompt, type UserPrompts } from "./prompts";

const MODEL = DEFAULT_MODEL;

// ============================================
// GAP DETECTION
// ============================================

export interface GapAnalysisResult {
  gap_score: number;
  signals: string[];
  transcript?: string;
}

export interface AnalyzeGapOptions {
  audioBase64: string;
  audioFormat: string;
  problem: string;
  openProbeCount?: number;
  lastProbeTimestamp?: number;
  promptOverrides?: UserPrompts;
  tutoringLanguage?: string;
}

export async function analyzeGap(
  options: AnalyzeGapOptions
): Promise<{ success: boolean; result?: GapAnalysisResult; error?: string }> {
  const secondsSinceLastProbe = options.lastProbeTimestamp
    ? Math.floor((Date.now() - options.lastProbeTimestamp) / 1000)
    : 0;
  const openProbeCount = options.openProbeCount ?? 0;

  // Step 1: Transcribe audio with xAI STT
  // Normalize: webm is not supported by xAI — treat as ogg (webm+opus ≈ ogg+opus)
  const rawFmt = options.audioFormat || "mp4";
  const fmt = rawFmt === "webm" ? "ogg" : rawFmt;
  const mimeType = fmt.startsWith("audio/") ? fmt : `audio/${fmt}`;
  const fileName = `chunk.${fmt.replace(/^audio\//, "")}`;

  const transcription = await transcribeAudioBase64(
    options.audioBase64,
    fileName,
    mimeType,
    options.tutoringLanguage ? { language: options.tutoringLanguage } : {}
  );

  if (!transcription || !transcription.text) {
    return { success: false, error: "Transcription failed or returned empty text" };
  }

  const transcriptText = transcription.text.trim();

  // Step 2: Send transcript + analysis prompt to Grok
  let prompt = getPrompt("gap_detection", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace("{openProbeCount}", openProbeCount.toString())
    .replace("{secondsSinceLastProbe}", secondsSinceLastProbe.toString());

  if (options.tutoringLanguage) {
    prompt = `IMPORTANT: Respond in ${options.tutoringLanguage} throughout.\n\n${prompt}`;
  }

  const fullPrompt = `${prompt}\n\nStudent's spoken words (transcribed):\n"""\n${transcriptText}\n"""\n\nReturn JSON with: { "gap_score": number 0-1, "signals": string[] }.`;

  const response = await callXaiJSON<GapAnalysisResult>(
    [userMessage(fullPrompt)],
    {
      model: MODEL,
      maxTokens: 300,
      temperature: RECOMMENDED_TEMPS.gapDetection,
    }
  );

  if (!response.success || !response.data) {
    console.error("analyzeGap failed:", response.error, "rawContent:", response.rawContent?.substring(0, 300));
    return { success: false, error: response.error || "No response" };
  }

  const result = response.data;
  result.gap_score = Math.max(0, Math.min(1, result.gap_score || 0));
  result.signals = result.signals || [];
  // Inject the transcript we already produced via STT
  result.transcript = transcriptText;

  return { success: true, result };
}

// ============================================
// OPENING PROBE (Session Kickoff Question)
// ============================================

export async function generateOpeningProbe(
  problem: string,
  promptOverrides?: UserPrompts,
  objectives?: string[],
  tutoringLanguage?: string
): Promise<{ success: boolean; probe?: string; error?: string }> {
  let prompt = getPrompt("opening_probe", promptOverrides)
    .replace("{problem}", problem)
    .replace(
      "{objectives}",
      objectives && objectives.length > 0
        ? `Session goals to work towards:\n${objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
        : ""
    );

  if (tutoringLanguage) {
    prompt = `IMPORTANT: Respond in ${tutoringLanguage} throughout.\n\n${prompt}`;
  }

  const response = await callXaiText(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 100,
      temperature: RECOMMENDED_TEMPS.openingProbe,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No opening probe generated" };
  }

  return { success: true, probe: response.data };
}

// ============================================
// PROBE GENERATION (Guiding Questions)
// ============================================

export interface GenerateProbeOptions {
  problem: string;
  gapScore: number;
  signals: string[];
  previousProbes: string[];
  ragContext?: string;
  audioBase64?: string;
  audioFormat?: string;
  promptOverrides?: UserPrompts;
  objectives?: string[];
  tutoringLanguage?: string;
}

export async function generateProbe(
  options: GenerateProbeOptions
): Promise<{ success: boolean; probe?: string; error?: string }> {
  let prompt = getPrompt("probe_generation", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace(
      "{objectives}",
      options.objectives && options.objectives.length > 0
        ? `Session goals to work towards:\n${options.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
        : "No specific session goals defined yet."
    )
    .replace("{score}", options.gapScore.toFixed(2))
    .replace("{signals}", options.signals.join(", ") || "general hesitation")
    .replace(
      "{previous_probes}",
      options.previousProbes.length > 0
        ? options.previousProbes.map((p, i) => `${i + 1}. ${p}`).join("\n")
        : "None yet"
    )
    .replace(
      "{rag_context}",
      options.ragContext
        ? `Context from this student's past think-aloud sessions:\n---\n${options.ragContext}\n---\n`
        : ""
    );

  if (options.tutoringLanguage) {
    prompt = `IMPORTANT: Respond in ${options.tutoringLanguage} throughout.\n\n${prompt}`;
  }

  // If audio is provided, transcribe it via xAI STT and inline the transcript
  let finalPrompt = prompt;
  if (options.audioBase64 && options.audioFormat) {
    // Normalize: webm is not supported by xAI — treat as ogg
    const rawFmt = options.audioFormat;
    const fmt = rawFmt === "webm" ? "ogg" : rawFmt;
    const mimeType = fmt.startsWith("audio/") ? fmt : `audio/${fmt}`;
    const fileName = `chunk.${fmt.replace(/^audio\//, "")}`;
    const transcription = await transcribeAudioBase64(
      options.audioBase64,
      fileName,
      mimeType,
      options.tutoringLanguage ? { language: options.tutoringLanguage } : {}
    );
    if (transcription?.text) {
      finalPrompt = `${prompt}\n\nStudent's most recent spoken words (transcribed):\n"""\n${transcription.text.trim()}\n"""`;
    }
  }

  const response = await callXaiText(
    [userMessage(finalPrompt)],
    {
      model: MODEL,
      maxTokens: 150,
      temperature: RECOMMENDED_TEMPS.probeGeneration,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No probe generated" };
  }

  return { success: true, probe: response.data };
}

// ============================================
// REPORT GENERATION
// ============================================

export async function generateReport(options: {
  problem: string;
  duration: string;
  probeCount: number;
  avgGapScore: number;
  probesSummary: string;
  eegContext?: string;
  promptOverrides?: UserPrompts;
  /** xAI file IDs (transcripts, analysis snapshots) to attach via Responses API */
  fileIds?: string[];
}): Promise<{ success: boolean; report?: string; error?: string }> {
  const prompt = getPrompt("report_generation", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace("{duration}", options.duration)
    .replace("{count}", options.probeCount.toString())
    .replace("{avg_gap}", options.avgGapScore.toFixed(2))
    .replace("{probes_summary}", options.probesSummary || "No probes triggered")
    .replace(
      "{eeg_context}",
      options.eegContext
        ? `EEG Data Summary:\n${options.eegContext}\n\nInclude observations about the student's brain state patterns and how they correlated with reasoning gaps.`
        : ""
    );

  // If file IDs provided, use Responses API with attachment_search capability
  if (options.fileIds && options.fileIds.length > 0) {
    const response = await callXaiResponsesWithFiles(
      prompt,
      options.fileIds,
      {
        model: MODEL,
        maxOutputTokens: 800,
        temperature: RECOMMENDED_TEMPS.report,
      }
    );

    if (!response.success || !response.text) {
      return { success: false, error: response.error || "No report generated" };
    }

    return { success: true, report: response.text };
  }

  // Fallback to standard chat completions API if no files
  const response = await callXaiText(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 800,
      temperature: RECOMMENDED_TEMPS.report,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No report generated" };
  }

  return { success: true, report: response.data };
}

// ============================================
// FOLLOW-UP SESSION SUGGESTIONS
// ============================================

export interface FollowUpSuggestion {
  title: string;
  description: string;
}

export async function generateFollowUpSessions(options: {
  problem: string;
  duration: string;
  gapsSummary: string;
  reportSummary: string;
  promptOverrides?: UserPrompts;
  /** xAI file IDs (transcripts, analysis snapshots) to attach via Responses API */
  fileIds?: string[];
}): Promise<{ success: boolean; suggestions?: FollowUpSuggestion[]; error?: string }> {
  const prompt = getPrompt("follow_up_sessions", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace("{duration}", options.duration)
    .replace("{gaps_summary}", options.gapsSummary || "No specific gaps noted")
    .replace("{report_summary}", options.reportSummary || "No report available");

  // If file IDs provided, use Responses API with attachment_search capability
  if (options.fileIds && options.fileIds.length > 0) {
    const response = await callXaiResponsesWithFiles<{ suggestions?: FollowUpSuggestion[] }>(
      prompt,
      options.fileIds,
      {
        model: MODEL,
        maxOutputTokens: 500,
        temperature: 0.7, // Slightly creative for suggestions
      }
    );

    if (!response.success || !response.text) {
      return { success: false, error: response.error || "No suggestions generated" };
    }

    // Parse the JSON from the response text
    try {
      const parsed = JSON.parse(response.text);
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        return { success: true, suggestions: parsed.suggestions };
      }
      return { success: false, error: "Invalid response format" };
    } catch {
      return { success: false, error: "Failed to parse suggestions JSON" };
    }
  }

  // Fallback to standard JSON API if no files
  const response = await callXaiJSON<{ suggestions?: FollowUpSuggestion[] }>(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 500,
      temperature: 0.7,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No suggestions generated" };
  }

  const suggestions = response.data.suggestions;
  if (!suggestions || !Array.isArray(suggestions)) {
    return { success: false, error: "Invalid suggestions format" };
  }

  return { success: true, suggestions };
}

// ============================================
// GENERATE OBJECTIVES (Session start)
// ============================================

export async function generateObjectives(
  problem: string,
  promptOverrides?: UserPrompts
): Promise<{ success: boolean; objectives?: string[]; error?: string }> {
  const prompt = getPrompt("generate_objectives", promptOverrides)
    .replace("{problem}", problem);

  const response = await callXaiJSON<{ objectives?: string[] } | string[]>(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 300,
      temperature: 0.3,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No objectives generated" };
  }

  // Handle both array format and object with objectives key
  let objectives: string[];
  if (Array.isArray(response.data)) {
    objectives = response.data;
  } else {
    objectives = response.data.objectives || [];
  }

  if (!Array.isArray(objectives)) {
    return { success: false, error: "Invalid objectives format" };
  }

  // Clean up objectives
  objectives = objectives.map((obj: string) => {
    let cleaned = obj.trim();
    if (cleaned.endsWith(".")) {
      cleaned = cleaned.slice(0, -1);
    }
    cleaned = cleaned.replace(/^```json|```$/g, "").trim();
    return cleaned;
  });

  // Filter and limit
  objectives = objectives.filter((obj: string) => {
    const wordCount = obj.split(/\s+/).length;
    return wordCount >= 3 && wordCount <= 30;
  });

  if (objectives.length > 3) {
    objectives = objectives.slice(0, 3);
  }

  return { success: true, objectives };
}

// ============================================
// SESSION PLAN CREATION
// ============================================

export interface SessionPlanStep {
  id?: string;
  type: "question" | "task" | "suggestion" | "checkpoint" | "feedback";
  description: string;
  order: number;
  status?: "pending" | "in_progress" | "completed" | "skipped";
}

export interface CreateSessionPlanResult {
  goal: string;
  strategy: string;
  description?: string; // Brief summary for display purposes
  steps: SessionPlanStep[];
}

export async function createSessionPlanLLM(options: {
  problem: string;
  objectives?: string[];
  calibration?: string;
  promptOverrides?: UserPrompts;
  planningPrompt?: string; // Custom instructions for plan generation
  tutoringLanguage?: string; // Full language name for LLM response
}): Promise<{ success: boolean; plan?: CreateSessionPlanResult; error?: string }> {
  let prompt = getPrompt("session_plan_create", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace("{objectives}", options.objectives?.length
      ? options.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")
      : "No specific objectives defined")
    .replace("{calibration}", options.calibration || "No prior learning data available");

  // Prepend language instruction if tutoring language specified
  if (options.tutoringLanguage) {
    prompt = `IMPORTANT: Respond in ${options.tutoringLanguage} throughout.\n\n${prompt}`;
  }

  // Append custom planning prompt if provided
  if (options.planningPrompt) {
    prompt = prompt.replace(
      'Return ONLY valid JSON',
      `Additional Planning Instructions from User:\n${options.planningPrompt}\n\nReturn ONLY valid JSON`
    );
  }

  const response = await callXaiJSON<CreateSessionPlanResult>(
    [userMessage(prompt)],
    {
      model: MODEL,
      maxTokens: 1500,
      temperature: 0.3,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No plan generated" };
  }

  // Normalize the plan and filter out steps with empty descriptions
  const allSteps = (response.data.steps || []).map((step: SessionPlanStep, idx: number) => ({
    id: `step_${idx + 1}_${Date.now()}`,
    type: step.type || "question",
    description: step.description || "",
    order: step.order || idx + 1,
    status: "pending" as const,
  }));

  const validSteps = allSteps.filter((s: SessionPlanStep) => s.description.trim().length > 0);
  if (validSteps.length === 0) {
    return { success: false, error: "LLM generated plan with no valid steps (all descriptions empty)" };
  }

  // Re-number orders after filtering
  const numberedSteps = validSteps.map((s: SessionPlanStep, idx: number) => ({ ...s, order: idx + 1 }));

  const plan: CreateSessionPlanResult = {
    goal: response.data.goal || "Understand the topic deeply",
    strategy: response.data.strategy || "Guide through Socratic questioning",
    description: response.data.description,
    steps: numberedSteps,
  };

  return { success: true, plan };
}

// ============================================
// SESSION PLAN UPDATE
// ============================================

export interface SessionPlanUpdateRequest {
  type: "question" | "task" | "suggestion" | "checkpoint" | "feedback";
  text: string;
}

export interface SessionPlanUpdateResult {
  planChanged: boolean;
  updatedSteps?: SessionPlanStep[];
  currentStepIndex: number;
  nextRequest: SessionPlanUpdateRequest | null;
  probesToArchive: string[];
  canGenerateProbe: boolean;
  reasoning: string;
  gapScore: number;
  signals: string[];
  canAutoAdvance: boolean;
  advanceReasoning: string;
}

export interface StuckPolicyRecommendationResult {
  stuck: boolean;
  severity: "low" | "medium" | "high";
  title: string;
  recommendationMarkdown: string;
  reason: string;
}

export interface FocusedProbeInfo {
  id: string;
  text: string;
}

// JSON schema mirror of RawPlanUpdate, used for Responses API structured output
const PLAN_UPDATE_JSON_SCHEMA = {
  name: "plan_update",
  schema: {
    type: "object",
    properties: {
      plan_changed: { type: "boolean" },
      updated_steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string" },
            description: { type: "string" },
            order: { type: "number" },
            status: { type: "string" },
          },
          required: ["type", "description"],
          additionalProperties: true,
        },
      },
      current_step_index: { type: "number" },
      next_request: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            properties: {
              type: { type: "string" },
              text: { type: "string" },
            },
            required: ["type", "text"],
            additionalProperties: false,
          },
        ],
      },
      probes_to_archive: { type: "array", items: { type: "string" } },
      can_generate_probe: { type: "boolean" },
      reasoning: { type: "string" },
      gap_score: { type: "number" },
      signals: { type: "array", items: { type: "string" } },
      can_auto_advance: { type: "boolean" },
      advance_reasoning: { type: "string" },
    },
    required: ["plan_changed", "current_step_index", "reasoning"],
    additionalProperties: true,
  },
};

export async function updateSessionPlanLLM(options: {
  goal: string;
  strategy: string;
  steps: SessionPlanStep[];
  currentStepIndex: number;
  /** High-level summary of recent activity (counts/types). Actual content
   *  is read by Grok agentically via attached files. */
  contextDescription?: string;
  previousProbes: string[];
  /** Currently open (non-archived) probes visible to the student. Must
   *  include each probe's real UUID so the LLM can return them verbatim
   *  in probes_to_archive (otherwise it hallucinates ordinals like "1"). */
  activeProbes?: FocusedProbeInfo[];
  focusedProbes?: FocusedProbeInfo[];
  openProbeCount?: number;
  lastProbeTimestamp?: number;
  promptOverrides?: UserPrompts;
  /** xAI file IDs for recent session artifacts (transcripts, eeg, facial,
   *  tool, screens). Grok reads them agentically via attachment_search. */
  sessionFileIds: string[];
}): Promise<{ success: boolean; result?: SessionPlanUpdateResult; error?: string }> {
  const stepsText = options.steps.map((s, i) =>
    `${i + 1}. [${s.type}] ${s.description} (status: ${s.status || "pending"})`
  ).join("\n");

  const focusedProbesText = options.focusedProbes && options.focusedProbes.length > 0
    ? options.focusedProbes.map(p => `- [${p.id}]: "${p.text}"`).join("\n")
    : "None";

  const secondsSinceLastProbe = options.lastProbeTimestamp
    ? Math.floor((Date.now() - options.lastProbeTimestamp) / 1000)
    : 0;

  const contextText = options.contextDescription
    || "See attached session artifacts (transcripts, EEG, facial, tool events, screenshots) for recent activity.";

  const prompt = getPrompt("session_plan_update", options.promptOverrides)
    .replace("{goal}", options.goal)
    .replace("{strategy}", options.strategy)
    .replace("{steps}", stepsText)
    .replace("{current_step}", options.currentStepIndex.toString())
    .replace("{context_description}", contextText)
    .replace("{transcript}", "See the attached transcript chunks (search them via attachment_search).")
    .replace("{previous_probes}", options.previousProbes.length > 0
      ? options.previousProbes.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "None yet")
    // IMPORTANT: include each probe's real UUID in the rendering. The
    // model is instructed to echo these verbatim in probes_to_archive; if
    // we only show ordinals the model hallucinates "1", "2" which then
    // explodes against the probes.id UUID column (Postgres 22P02).
    .replace("{active_probes}", options.activeProbes && options.activeProbes.length > 0
      ? options.activeProbes.map(p => `- [${p.id}]: "${p.text}"`).join("\n")
      : "None")
    .replace("{open_probe_count}", (options.openProbeCount ?? 0).toString())
    .replace("{focused_probes}", focusedProbesText)
    .replace("{secondsSinceLastProbe}", secondsSinceLastProbe.toString());

  interface RawPlanUpdate {
    plan_changed?: boolean;
    updated_steps?: SessionPlanStep[];
    current_step_index?: number;
    next_request?: { type?: string; text?: string } | null;
    probes_to_archive?: string[];
    can_generate_probe?: boolean;
    reasoning?: string;
    gap_score?: number;
    signals?: string[];
    can_auto_advance?: boolean;
    advance_reasoning?: string;
  }

  // Always go through Responses API. File refs (when present) trigger
  // attachment_search; if empty, Grok answers from the prompt alone.
  const content: ResponsesInputContent[] = [{ type: "input_text", text: prompt }];
  for (const fid of options.sessionFileIds) {
    content.push({ type: "input_file", file_id: fid });
  }

  const r = await callXaiResponses<RawPlanUpdate>({
    model: MODEL,
    input: [{ role: "user", content }],
    maxOutputTokens: 1500,
    temperature: 0.3,
    jsonSchema: PLAN_UPDATE_JSON_SCHEMA,
    retries: 2,
    retryDelay: 500,
    fetchTimeout: 45_000,
  });

  if (!r.success || !r.data) {
    return { success: false, error: r.error || "No update generated" };
  }
  const parsed = r.data;

  // Filter out steps with empty descriptions from LLM response.
  // If all steps end up empty, treat as if plan didn't change (don't overwrite good data).
  let updatedSteps: SessionPlanStep[] | undefined = parsed.updated_steps?.map((step: SessionPlanStep, idx: number) => ({
    id: step.id || `step_${idx + 1}_${Date.now()}`,
    type: step.type || "question",
    description: step.description || "",
    order: step.order || idx + 1,
    status: step.status || "pending",
  }));

  let planChanged = parsed.plan_changed || false;
  if (updatedSteps) {
    updatedSteps = updatedSteps.filter((s: SessionPlanStep) => s.description.trim().length > 0);
    if (updatedSteps.length === 0) {
      // LLM returned only empty steps — discard the update to protect existing plan
      console.warn('[updateSessionPlanLLM] LLM returned updated_steps with all empty descriptions, discarding step changes');
      updatedSteps = undefined;
      planChanged = false;
    } else {
      // Re-number orders after filtering
      updatedSteps = updatedSteps.map((s: SessionPlanStep, idx: number) => ({ ...s, order: idx + 1 }));
    }
  }

  const canAutoAdvance = parsed.can_auto_advance ?? false;
  const readyToMoveOnRequest: SessionPlanUpdateRequest = {
    type: "feedback",
    text: "That is enough to move on. Click Mark as Done when you're ready.",
  };

  const result: SessionPlanUpdateResult = {
    planChanged,
    updatedSteps,
    currentStepIndex: parsed.current_step_index ?? options.currentStepIndex,
    nextRequest: canAutoAdvance ? readyToMoveOnRequest : parsed.next_request === null ? null : {
      type: (parsed.next_request?.type as SessionPlanUpdateRequest["type"]) || "question",
      text: parsed.next_request?.text || "What are you thinking about right now?",
    },
    probesToArchive: parsed.probes_to_archive || [],
    canGenerateProbe: parsed.can_generate_probe ?? true,
    reasoning: parsed.reasoning || "",
    gapScore: Math.max(0, Math.min(1, parsed.gap_score ?? 0.5)),
    signals: parsed.signals || [],
    canAutoAdvance,
    advanceReasoning: parsed.advance_reasoning || "",
  };

  return { success: true, result };
}

export async function generateStuckPolicyRecommendation(options: {
  problem: string;
  currentStep?: string;
  activitySummary: string;
  transcript: string;
  secondsSinceLastStuckCard: number;
  stuckCardCount: number;
  sessionFileIds?: string[];
  promptOverrides?: UserPrompts;
  tutoringLanguage?: string;
}): Promise<{ success: boolean; result?: StuckPolicyRecommendationResult; error?: string }> {
  let prompt = getPrompt("stuck_policy_recommendation", options.promptOverrides)
    .replace("{problem}", options.problem)
    .replace("{current_step}", options.currentStep || "No current step available")
    .replace("{activity_summary}", options.activitySummary || "No recent activity available")
    .replace("{transcript}", options.transcript || "No recent transcript available")
    .replace("{seconds_since_last_stuck_card}", options.secondsSinceLastStuckCard.toString())
    .replace("{stuck_card_count}", options.stuckCardCount.toString());

  if (options.tutoringLanguage) {
    prompt = `IMPORTANT: Respond in ${options.tutoringLanguage} throughout. Keep JSON keys exactly as specified.\n\n${prompt}`;
  }

  interface RawStuckPolicyResult {
    stuck?: boolean;
    severity?: "low" | "medium" | "high";
    title?: string;
    recommendation_markdown?: string;
    reason?: string;
  }

  const jsonSchema = {
    name: "stuck_policy_recommendation",
    schema: {
      type: "object",
      properties: {
        stuck: { type: "boolean" },
        severity: { type: "string", enum: ["low", "medium", "high"] },
        title: { type: "string" },
        recommendation_markdown: { type: "string" },
        reason: { type: "string" },
      },
      required: ["stuck", "severity", "title", "recommendation_markdown", "reason"],
      additionalProperties: false,
    },
  };

  const fileIds = options.sessionFileIds?.filter(Boolean) || [];
  const response = fileIds.length > 0
    ? await callXaiResponsesWithFiles<RawStuckPolicyResult>(prompt, fileIds, {
      model: MODEL,
      maxOutputTokens: 700,
      temperature: 0.3,
      jsonSchema,
      retries: 2,
      retryDelay: 500,
      fetchTimeout: 30_000,
    })
    : await callXaiJSON<RawStuckPolicyResult>(
      [userMessage(prompt)],
      {
        model: MODEL,
        maxTokens: 700,
        temperature: 0.3,
      }
    );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No stuck policy result generated" };
  }

  const raw = response.data;
  const severity = raw.severity === "high" || raw.severity === "medium" || raw.severity === "low"
    ? raw.severity
    : "medium";

  return {
    success: true,
    result: {
      stuck: Boolean(raw.stuck),
      severity,
      title: raw.title || "Stuck Check",
      recommendationMarkdown: raw.recommendation_markdown || "",
      reason: raw.reason || "",
    },
  };
}
