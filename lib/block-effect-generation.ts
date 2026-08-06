/**
 * Pure prompt builders + result helpers for creator-effect generation:
 * Dynamic (on unlock), Generator (targets on done).
 */

export type EffectGenerationMode =
  | "dynamic"
  | "generator_cell"
  | "generator_target"; // alias of generator_cell

export type EffectGenerationBlockRef = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
};

export type EffectGenerationResult = {
  title: string;
  description: string;
};

function clean(s: unknown): string {
  return String(s ?? "").trim();
}

/** System message shared by all effect-generation modes. */
export function composeEffectGenerationSystemMessage(): string {
  return [
    "You generate focused learning-block titles and descriptions for a skill map.",
    "Return JSON only: { \"title\": string, \"description\": string }.",
    "Title: concise topic name (≤ 80 chars). Description: 1–3 sentences of assessable scope for Explore/Drill practice.",
    "Ground hard in the provided framing, learner history, and map context. Do not invent unrelated domains.",
  ].join(" ");
}

/**
 * User prompt for Dynamic: unlock-time content from what the learner completed.
 */
export function composeDynamicGenerationUserPrompt(input: {
  workspaceTitle?: string | null;
  workspaceGoal?: string | null;
  blockSeedTitle?: string | null;
  blockSeedDescription?: string | null;
  completedBlocks: EffectGenerationBlockRef[];
  languageNote?: string;
}): string {
  const completedLines =
    input.completedBlocks.length > 0
      ? input.completedBlocks
          .map((b) => {
            const t = clean(b.title) || "Untitled";
            const d = clean(b.description);
            return d ? `- ${t}: ${d.slice(0, 200)}` : `- ${t}`;
          })
          .join("\n")
      : "(none completed yet)";

  return [
    `Workspace: ${clean(input.workspaceTitle) || "Untitled"}`,
    input.workspaceGoal ? `Goal: ${clean(input.workspaceGoal)}` : null,
    `Mode: Dynamic block — content is generated when unlocked and must depend on what the learner has already learned.`,
    clean(input.blockSeedTitle)
      ? `Author seed title (may refine): ${clean(input.blockSeedTitle)}`
      : "Author seed title: (none — invent a fitting next topic)",
    clean(input.blockSeedDescription)
      ? `Author seed description: ${clean(input.blockSeedDescription)}`
      : null,
    "Completed learning so far:",
    completedLines,
    "Produce a next-step block title + description that builds on completed topics without repeating them wholesale.",
    input.languageNote || null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * User prompt for Generator target: filled when the generator block is completed.
 */
export function composeGeneratorTargetUserPrompt(input: {
  workspaceTitle?: string | null;
  workspaceGoal?: string | null;
  generatorTitle?: string | null;
  generatorDescription?: string | null;
  targetSeedTitle?: string | null;
  targetSeedDescription?: string | null;
  geometryNote?: string | null;
  languageNote?: string;
}): string {
  return [
    `Workspace: ${clean(input.workspaceTitle) || "Untitled"}`,
    input.workspaceGoal ? `Goal: ${clean(input.workspaceGoal)}` : null,
    `Mode: Generator target — content created when the generator block was completed.`,
    clean(input.generatorTitle)
      ? `Generator block: ${clean(input.generatorTitle)}`
      : "Generator block: (unnamed)",
    clean(input.generatorDescription)
      ? `Generator description: ${clean(input.generatorDescription)}`
      : null,
    input.geometryNote ? `Map geometry: ${clean(input.geometryNote)}` : null,
    clean(input.targetSeedTitle)
      ? `Target seed title: ${clean(input.targetSeedTitle)}`
      : "Target seed title: (none)",
    clean(input.targetSeedDescription)
      ? `Target seed description: ${clean(input.targetSeedDescription)}`
      : null,
    "Produce a related block title + description that fits around the generator's topic and map position.",
    input.languageNote || null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Normalize LLM JSON into title/description. */
export function normalizeEffectGenerationResult(
  raw: unknown,
  fallback?: { title?: string | null; description?: string | null },
): EffectGenerationResult {
  const fbTitle = clean(fallback?.title) || "Generated topic";
  const fbDesc = clean(fallback?.description) || "";
  if (!raw || typeof raw !== "object") {
    return { title: fbTitle, description: fbDesc };
  }
  const o = raw as Record<string, unknown>;
  const title = clean(o.title) || fbTitle;
  const description = clean(o.description) || fbDesc;
  return {
    title: title.slice(0, 120),
    description: description.slice(0, 2000),
  };
}

/** Geometry note from relative positions (pure). */
export function formatGeneratorGeometryNote(input: {
  generator?: { position_x?: number | null; position_y?: number | null } | null;
  target?: { position_x?: number | null; position_y?: number | null } | null;
}): string | null {
  const gx = input.generator?.position_x;
  const gy = input.generator?.position_y;
  const tx = input.target?.position_x;
  const ty = input.target?.position_y;
  if (
    typeof gx !== "number" ||
    typeof gy !== "number" ||
    typeof tx !== "number" ||
    typeof ty !== "number"
  ) {
    return null;
  }
  const dCol = Math.trunc(tx) - Math.trunc(gx);
  const dRow = Math.trunc(ty) - Math.trunc(gy);
  const parts: string[] = [];
  if (dRow < 0) parts.push(`${Math.abs(dRow)} row(s) above`);
  if (dRow > 0) parts.push(`${dRow} row(s) below`);
  if (dCol < 0) parts.push(`${Math.abs(dCol)} col(s) left`);
  if (dCol > 0) parts.push(`${dCol} col(s) right`);
  if (parts.length === 0) return "Same anchor cell as generator (or overlapping).";
  return `Target is ${parts.join(", ")} of the generator.`;
}
