/**
 * Pure helpers for workspace create modes (Blank / Template / Files+Goal)
 * and shared AI context assembly (files + notes + goal).
 */

import {
  composeWorkspacePlanGeneratePrompt,
  composeWorkspaceSpatialGeneratePrompt,
} from "@/lib/workspace-spatial-create";
import type { InitialChaptersLevel } from "@/lib/initial-chapters";

export type WorkspaceCreateMode = "blank" | "template" | "files_goal";

export const UI_WORKSPACE_CREATE_MODES: WorkspaceCreateMode[] = [
  "blank",
  "template",
  "files_goal",
];

/** API / agent semantic create only supports Files + Goal Prompt. */
export const API_WORKSPACE_CREATE_MODES: WorkspaceCreateMode[] = ["files_goal"];

export function parseWorkspaceCreateMode(value: unknown): WorkspaceCreateMode | null {
  if (value === "blank" || value === "template" || value === "files_goal") return value;
  if (value === "files+goal" || value === "filesGoal" || value === "goal") return "files_goal";
  if (value === "from_template" || value === "dantes") return "template";
  return null;
}

export function isApiAllowedCreateMode(mode: WorkspaceCreateMode | null | undefined): boolean {
  if (!mode) return true; // default semantic path = files+goal
  return mode === "files_goal";
}

export function assertApiCreateMode(mode: unknown): { ok: true } | { ok: false; error: string } {
  const parsed = parseWorkspaceCreateMode(mode);
  if (mode != null && mode !== "" && !parsed) {
    return { ok: false, error: "Invalid create mode. API create only supports files_goal." };
  }
  if (parsed && !isApiAllowedCreateMode(parsed)) {
    return {
      ok: false,
      error: "API workspace creation only supports Files + Goal Prompt (files_goal).",
    };
  }
  return { ok: true };
}

export interface DantesResourceContextItem {
  title: string;
  type?: string;
  url?: string;
  description?: string | null;
  difficulty?: string;
}

export function composeDantesResourceContext(
  topicName: string,
  resources: DantesResourceContextItem[],
  options?: { maxResources?: number },
): string {
  const max = options?.maxResources ?? 12;
  const lines = resources.slice(0, max).map((r, i) => {
    const bits = [
      `${i + 1}. ${r.title}`,
      r.type ? `(${r.type})` : null,
      r.difficulty ? `[${r.difficulty}]` : null,
      r.description ? `— ${r.description.slice(0, 160)}` : null,
      r.url ? `url: ${r.url}` : null,
    ].filter(Boolean);
    return bits.join(" ");
  });
  return [
    `\nTemplate topic: ${topicName}`,
    resources.length
      ? `Curated resources used as generation context:\n${lines.join("\n")}`
      : "No curated resources were available; use the topic name alone.",
  ].join("\n");
}

/**
 * Persist selected template resources as workspace notes markdown with links.
 * Notes surface in the Notes tab and are re-injected into later block generation.
 * (External URLs are not workspace_files — those require uploaded binaries.)
 */
export function composeTemplateWorkspaceNotes(
  topicName: string,
  resources: DantesResourceContextItem[],
  options?: { topicDescription?: string | null },
): string {
  const title = topicName.trim() || "Template topic";
  const lines: string[] = [
    `# ${title}`,
    "",
    "Workspace created from a topic template. Selected resources below are linked for reference and used as learning context.",
  ];

  const desc = options?.topicDescription?.trim();
  if (desc) {
    lines.push("", desc);
  }

  lines.push("", "## Resource links", "");

  if (resources.length === 0) {
    lines.push("_No resources were selected for this template._");
    return lines.join("\n");
  }

  for (const r of resources) {
    const label = (r.title || "Resource").trim();
    const href = typeof r.url === "string" ? r.url.trim() : "";
    const meta = [r.type, r.difficulty].filter(Boolean).join(" · ");
    if (href) {
      lines.push(`- [${label}](${href})${meta ? ` — ${meta}` : ""}`);
    } else {
      lines.push(`- **${label}**${meta ? ` — ${meta}` : ""}`);
    }
    if (r.description?.trim()) {
      lines.push(`  - ${r.description.trim().slice(0, 240)}`);
    }
  }

  return lines.join("\n");
}

export interface BlockGenerationContextInput {
  workspaceTitle?: string;
  goal?: string | null;
  notes?: string | null;
  fileNames?: string[];
  /** Optional preformatted file body text already loaded by the caller. */
  fileBodyExcerpt?: string | null;
}

/**
 * Always include workspace files + notes (and goal when present) when generating blocks.
 * Pure string assembly — callers pass whatever payloads they have.
 */
export function composeBlockGenerationContext(input: BlockGenerationContextInput): string {
  const parts: string[] = [];
  if (input.workspaceTitle?.trim()) {
    parts.push(`Workspace: ${input.workspaceTitle.trim()}`);
  }
  if (input.goal?.trim()) {
    parts.push(`Goal: ${input.goal.trim()}`);
  }
  if (input.notes?.trim()) {
    parts.push(`Workspace notes:\n${input.notes.trim()}`);
  }
  const names = (input.fileNames || []).filter((n) => typeof n === "string" && n.trim());
  if (names.length > 0) {
    parts.push(`Workspace files always in context:\n${names.map((n) => `- ${n}`).join("\n")}`);
  }
  if (input.fileBodyExcerpt?.trim()) {
    parts.push(`File content:\n${input.fileBodyExcerpt.trim()}`);
  }
  return parts.join("\n\n");
}

export function composeFilesGoalCreatePrompt(vars: {
  goalPrompt: string;
  initialChapters?: InitialChaptersLevel | string | null;
  fileContext?: string;
  daysHint?: number | null;
}): string {
  const goal = vars.goalPrompt.trim();
  const base = composeWorkspacePlanGeneratePrompt({
    topic: goal,
    initialChapters: vars.initialChapters,
    fileContext: vars.fileContext,
    daysHint: vars.daysHint,
  });
  return `${base}

Important: The user prompt above is the workspace GOAL. Treat it as the success outcome the map must serve (not a loose topic label only).`;
}

export function composeTemplateCreatePrompt(vars: {
  topicName: string;
  dantesContext: string;
  initialChapters?: InitialChaptersLevel | string | null;
  daysHint?: number | null;
}): string {
  return composeWorkspacePlanGeneratePrompt({
    topic: vars.topicName,
    initialChapters: vars.initialChapters,
    fileContext: vars.dantesContext,
    daysHint: vars.daysHint,
  });
}

export function composeAgentFilesGoalPrompt(vars: {
  goalPrompt: string;
  initialChapters?: InitialChaptersLevel | string | null;
  fileContext?: string;
}): string {
  return composeWorkspaceSpatialGeneratePrompt({
    topicOrPrompt: vars.goalPrompt,
    initialChapters: vars.initialChapters,
    fileContext: vars.fileContext,
    extraRules:
      "The initial_prompt is the workspace Goal. Persist and honor it as conversion/success intent.",
  });
}

/** Blank create yields zero blocks — structural outcome for tests and API. */
export function blankWorkspaceCreateOutcome(): { blocks: []; mode: "blank" } {
  return { blocks: [], mode: "blank" };
}

export function goalFieldsFromPrompt(goalPrompt: string): {
  root_topic: string;
  notes: string;
  conversion_goal: string;
  goal: string;
} {
  const goal = goalPrompt.trim();
  return {
    root_topic: goal.slice(0, 160) || "Untitled goal",
    notes: goal,
    conversion_goal: goal.slice(0, 500),
    goal,
  };
}
