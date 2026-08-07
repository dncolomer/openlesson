/**
 * Domain exercise authoring — LLM generates a real timed problem for:
 * - TAPBench (agents)
 * - Human TAP exercise/drill mode
 * - ILE Project Mode chapters
 *
 * Server-only (imports xAI client). Pure quality helpers live in
 * tapbench-exercise-quality.ts for client-safe imports.
 */

import {
  callXaiText,
  DEFAULT_MODEL,
  systemMessage,
  userMessage,
} from "@/lib/xai-client";
import {
  assemblePromptWorkspaceContext,
  type BlockLocalContextInput,
  type PromptBlockInventoryItem,
  type PromptExternalResourceItem,
  type WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";
import {
  buildDomainExerciseAuthorSystemPrompt,
  buildTapbenchExerciseFallback,
  ensureExercisePrefix,
  isLowQualityTapbenchExercise,
  looksLikeTopicOverview,
  type DomainExerciseSurface,
  type TapbenchExerciseContext,
} from "@/lib/pow-api/tapbench-exercise-quality";
import { withConversationLanguageInstruction } from "@/lib/tutoring-languages";

export {
  buildDomainExerciseAuthorSystemPrompt,
  buildTapbenchExerciseAuthorSystemPrompt,
  buildTapbenchExerciseFallback,
  ensureExercisePrefix,
  isLowQualityTapbenchExercise,
  looksLikeTopicOverview,
  type DomainExerciseSurface,
} from "@/lib/pow-api/tapbench-exercise-quality";

export interface GenerateDomainExerciseInput extends TapbenchExerciseContext {
  workspaceDescription?: string | null;
  notes?: string | null;
  files?: WorkspaceFileContextItem[] | null;
  /**
   * Workspace external links — feeds JIT URL-bias in assemblePromptWorkspaceContext
   * so exercise authoring consults attached resources.
   */
  externalResources?: PromptExternalResourceItem[] | null;
  /** ILE chapter plan text (Project Mode). */
  chapterDescription?: string | null;
  /** Map inventory + layout for shared assembler (TAP/ILE/TAPBench). */
  blocks?: PromptBlockInventoryItem[] | null;
  focusedBlockId?: string | null;
  blockLocalContext?: BlockLocalContextInput | null;
  unusableCells?: Array<{ row: number; col: number }> | null;
  durationSeconds?: number | null;
  surface?: DomainExerciseSurface;
  /** Learner conversation language (e.g. ca) — exercise text should be in this language. */
  conversationLanguage?: string | null;
  /** Inject LLM for tests. */
  generateText?: (messages: { role: string; content: string }[]) => Promise<string | null>;
}

/** @deprecated Prefer GenerateDomainExerciseInput — alias kept for TAPBench call sites. */
export type GenerateTapbenchExerciseInput = GenerateDomainExerciseInput;

function surfaceLabel(surface: DomainExerciseSurface): string {
  switch (surface) {
    case "tap_exercise":
      return "human TAP timed drill";
    case "ile_project":
      return "ILE Project Mode chapter exercise";
    default:
      return "TAPBench agent evaluation";
  }
}

export function buildDomainExerciseAuthorUserPrompt(
  input: GenerateDomainExerciseInput,
): string {
  const surface = input.surface || "tapbench";
  const ctx = assemblePromptWorkspaceContext({
    workspaceTitle: input.workspaceTitle,
    rootTopic: input.rootTopic,
    workspaceGoal: input.workspaceGoal,
    workspaceDescription: input.workspaceDescription,
    notes: input.notes,
    blockTitle: input.blockTitle,
    blockDescription: input.blockDescription,
    chapterDescription: input.chapterDescription,
    files: input.files,
    externalResources: input.externalResources,
    blocks: input.blocks,
    focusedBlockId: input.focusedBlockId,
    blockLocalContext: input.blockLocalContext,
    unusableCells: input.unusableCells,
  });
  const minutes =
    typeof input.durationSeconds === "number" && input.durationSeconds > 0
      ? Math.max(1, Math.round(input.durationSeconds / 60))
      : surface === "ile_project"
        ? 45
        : 15;

  const lines = [
    `Product surface: ${surfaceLabel(surface)}.`,
    `Time budget: ~${minutes} minutes.`,
    `Workspace: ${ctx.workspaceTitle || ctx.rootTopic || "unspecified"}`,
  ];
  if (ctx.workspaceGoal) lines.push(`Workspace goal: ${ctx.workspaceGoal}`);
  if (ctx.blockTitle) lines.push(`Focus block: ${ctx.blockTitle}`);
  if (ctx.blockDescription) {
    lines.push(
      looksLikeTopicOverview(ctx.blockDescription)
        ? `Block topic scope (NOT the exercise — invent a real problem inside this scope): ${ctx.blockDescription}`
        : `Block description: ${ctx.blockDescription}`,
    );
  }
  if (ctx.chapterDescription) {
    lines.push(
      looksLikeTopicOverview(ctx.chapterDescription) ||
        isLowQualityTapbenchExercise(ctx.chapterDescription, input)
        ? `Chapter seed (NOT the final exercise — invent a real problem from this seed): ${ctx.chapterDescription}`
        : `Chapter seed: ${ctx.chapterDescription}`,
    );
  }
  if (ctx.notes) lines.push(`Notes: ${ctx.notes}`);
  if (ctx.fileNames.length) {
    lines.push(`Materials: ${ctx.fileNames.slice(0, 5).join(", ")}`);
  }
  for (const fe of ctx.fileExcerpts.slice(0, 2)) {
    lines.push(`Excerpt from ${fe.name}: ${fe.excerpt.slice(0, 400)}`);
  }
  if (ctx.blockInventoryLines.length > 0) {
    lines.push("Block inventory (map roles / kinds):");
    lines.push(...ctx.blockInventoryLines.slice(0, 12));
  }
  if (ctx.topologyLines.length > 0) {
    lines.push("Map layout / topology:");
    lines.push(...ctx.topologyLines.slice(0, 12));
  }
  if (ctx.hasLocalContext) {
    lines.push("Local block context (focused block materials):");
    lines.push(...ctx.localContextLines);
  }
  // Full shared context block so authors ground in the same layers TAP/ILE use.
  lines.push("");
  lines.push(ctx.contextBlock);
  lines.push("");
  lines.push(
    `Author one concrete exercise for ${surfaceLabel(surface)}. Return only the exercise text.`,
  );
  return lines.join("\n");
}

/** @deprecated use buildDomainExerciseAuthorUserPrompt */
export function buildTapbenchExerciseAuthorUserPrompt(
  input: GenerateDomainExerciseInput,
): string {
  return buildDomainExerciseAuthorUserPrompt({ ...input, surface: "tapbench" });
}

/**
 * Generate a real domain exercise (LLM preferred, pure fallback on failure).
 */
export async function generateDomainExercise(
  input: GenerateDomainExerciseInput,
): Promise<{ exercise: string; source: "explicit" | "llm" }> {
  const surface = input.surface || "tapbench";
  const explicit = (input.exerciseText || "").replace(/\s+/g, " ").trim();
  if (
    explicit &&
    !isLowQualityTapbenchExercise(explicit, input) &&
    !looksLikeTopicOverview(explicit)
  ) {
    return {
      exercise: ensureExercisePrefix(explicit.replace(/^exercise\s*:\s*/i, "")),
      source: "explicit",
    };
  }

  // Chapter seeds that are already solid exercises: keep without re-LLM when not thin.
  const chapter = (input.chapterDescription || "").replace(/\s+/g, " ").trim();
  if (
    !explicit &&
    chapter &&
    !isLowQualityTapbenchExercise(chapter, input) &&
    !looksLikeTopicOverview(chapter)
  ) {
    return {
      exercise: ensureExercisePrefix(chapter.replace(/^exercise\s*:\s*/i, "")),
      source: "explicit",
    };
  }

  const system = withConversationLanguageInstruction(
    buildDomainExerciseAuthorSystemPrompt(surface),
    input.conversationLanguage,
  );
  const user = buildDomainExerciseAuthorUserPrompt(input);

  try {
    let raw: string | null = null;
    if (input.generateText) {
      raw = await input.generateText([
        { role: "system", content: system },
        { role: "user", content: user },
      ]);
    } else {
      const res = await callXaiText([systemMessage(system), userMessage(user)], {
        model: DEFAULT_MODEL,
        maxTokens: surface === "ile_project" ? 900 : 700,
        temperature: 0.55,
        reasoningEffort: "low",
        fetchTimeout: 45_000,
        retries: 2,
      });
      if (res.success && res.data) raw = res.data;
      else {
        console.warn(
          `[domain-exercise:${surface}] LLM generate failed:`,
          res.error || "empty",
        );
      }
    }

    if (raw) {
      let text = raw.replace(/\s+/g, " ").trim();
      text = text.replace(/^```(?:text|markdown)?\s*/i, "").replace(/\s*```$/i, "").trim();
      text = ensureExercisePrefix(text.replace(/^exercise\s*:\s*/i, ""));
      if (text.length >= 8 && !isLowQualityTapbenchExercise(text, input)) {
        return { exercise: text, source: "llm" };
      }
      console.warn(
        `[domain-exercise:${surface}] LLM output empty or low quality; no pure fallback`,
      );
    }
  } catch (err) {
    console.warn(
      `[domain-exercise:${surface}] generate threw:`,
      err instanceof Error ? err.message : err,
    );
  }

  // Never substitute pure exercise shells — fail for callers to surface an error.
  throw new Error("Failed to generate practice content");
}

/** TAPBench mint entry — same generator with agent surface. */
export async function generateTapbenchExercise(
  input: GenerateDomainExerciseInput,
): Promise<{ exercise: string; source: "explicit" | "llm" }> {
  return generateDomainExercise({ ...input, surface: input.surface || "tapbench" });
}

/** Human TAP timed drill entry. */
export async function generateTapExercisePrompt(
  input: GenerateDomainExerciseInput,
): Promise<{ exercise: string; source: "explicit" | "llm" }> {
  return generateDomainExercise({ ...input, surface: "tap_exercise" });
}

/** ILE Project Mode chapter entry. */
export async function generateIleProjectExercise(
  input: GenerateDomainExerciseInput,
): Promise<{ exercise: string; source: "explicit" | "llm" }> {
  return generateDomainExercise({ ...input, surface: "ile_project" });
}
