// ============================================
// xAI HIGH-LEVEL HELPERS
//
// Domain wrappers around the shared xAI client (lib/xai-client.ts):
//   - generateObjectives   (session objectives at start)
//   - createSessionPlanLLM (initial plan)
//
// Prompts live in lib/prompts.ts.
// ============================================

import {
  callXaiJSON,
  callXaiWithSchema,
  DEFAULT_MODEL,
  userMessage,
} from "./xai-client";
import { getPrompt, type UserPrompts } from "./prompts";
import { getInitialChaptersBand } from "./initial-chapters";
import { relocateChapterStepsOffBlocked } from "./learn-chapter-blocked";
import {
  composeSessionPlanCreatePrompt,
  normalizeSessionPlanCreateSteps,
  SESSION_PLAN_CREATE_JSON_SCHEMA,
} from "./session-plan-create";
import {
  blockedCellsFromMapType,
  clampPositionsToMapTypeFrame,
  resolveMapTypeRecord,
  type WorkspaceMapTypeRecord,
  type WorkspaceMapTypesState,
} from "./workspace-map-types";
import {
  type IleSessionMode,
} from "./learn-mode";

const MODEL = DEFAULT_MODEL;

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
  position_x?: number;
  position_y?: number;
  keyword?: string | null;
  map_keyword?: string | null;
  map_icon?: string | null;
}

export interface CreateSessionPlanResult {
  goal: string;
  strategy: string;
  description?: string; // Brief summary for display purposes
  steps: SessionPlanStep[];
  unusable_cells?: Array<{ row: number; col: number }>;
}

export async function createSessionPlanLLM(options: {
  problem: string;
  objectives?: string[];
  calibration?: string;
  promptOverrides?: UserPrompts;
  planningPrompt?: string; // Custom instructions for plan generation
  tutoringLanguage?: string; // Full language name for LLM response
  /**
   * Initial chapters pattern from welcome UI / API (technique id or random_sparse / random_dense).
   * Prefer initialChapters; mapSize kept as legacy alias (narrow/mid/broad).
   */
  initialChapters?: string | null;
  /** @deprecated Prefer initialChapters */
  mapSize?: string | null;
  /** Resolved map-type record (built-in or custom). */
  mapType?: WorkspaceMapTypeRecord | null;
  /** Workspace enable/disable + custom types. */
  mapTypesState?: WorkspaceMapTypesState | null;
  /** Dialog (learning) vs Project (solo exercise) grain. */
  sessionMode?: IleSessionMode | string | null;
  /** Exact chapter count (1–5). When set, map-type bands are not used. */
  chapterCount?: unknown;
}): Promise<{ success: boolean; plan?: CreateSessionPlanResult; error?: string }> {
  const initialChapters = options.initialChapters ?? options.mapSize;
  const mapType =
    options.mapType ??
    resolveMapTypeRecord(initialChapters, options.mapTypesState);
  let prompt = composeSessionPlanCreatePrompt(
    getPrompt("session_plan_create", options.promptOverrides),
    {
      problem: options.problem,
      objectives: options.objectives,
      calibration: options.calibration,
      initialChapters,
      mapType,
      mapTypesState: options.mapTypesState,
      sessionMode: options.sessionMode,
      chapterCount: options.chapterCount,
    },
  );

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

  const band = mapType.band ?? getInitialChaptersBand(initialChapters);
  // Scale output budget with map breadth so broad plans are not truncated mid-JSON.
  const maxTokens = Math.min(5000, 1400 + band.max * 140);

  const response = await callXaiWithSchema<CreateSessionPlanResult>(
    [userMessage(prompt)],
    SESSION_PLAN_CREATE_JSON_SCHEMA,
    {
      model: MODEL,
      maxTokens,
      temperature: 0.3,
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || "No plan generated" };
  }

  const numberedSteps = normalizeSessionPlanCreateSteps(response.data.steps || []);
  if (numberedSteps.length === 0) {
    return { success: false, error: "LLM generated plan with no valid steps (all descriptions empty)" };
  }

  const blocked = blockedCellsFromMapType(mapType);
  const pulled = clampPositionsToMapTypeFrame(
    relocateChapterStepsOffBlocked(numberedSteps, blocked),
    mapType,
  );
  const plan: CreateSessionPlanResult = {
    goal: response.data.goal || "Understand the topic deeply",
    strategy: response.data.strategy || "Optimize practice progress and augment with tools that produce proof of work",
    description: response.data.description,
    steps: relocateChapterStepsOffBlocked(pulled, blocked),
    unusable_cells: blocked,
  };

  return { success: true, plan };
}
