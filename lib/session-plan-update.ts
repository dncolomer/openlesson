/**
 * Pure fill for session_plan_update — no model call.
 * Mode-aware grain/closure/expansion is applied via ile-chapter-depth.
 */
import {
  applyIleChapterModeInstructions,
} from "@/lib/ile-chapter-depth";
import { composeChapterMapGlyphJsonInstruction } from "@/lib/block-map-glyph";
import type { IleSessionMode } from "@/lib/ile-mode";

/** Prompt fill only needs type / description / status — LLM and domain steps both fit. */
export type SessionPlanUpdateStep = {
  type: string;
  description: string;
  status?: string | null;
};

export interface FocusedProbeForPrompt {
  id: string;
  text: string;
}

export interface SessionPlanUpdatePromptVars {
  goal: string;
  strategy: string;
  steps: SessionPlanUpdateStep[];
  currentStepIndex: number;
  contextDescription?: string;
  previousProbes: string[];
  activeProbes?: FocusedProbeForPrompt[];
  focusedProbes?: FocusedProbeForPrompt[];
  openProbeCount?: number;
  lastProbeTimestamp?: number;
  nowMs?: number;
  sessionMode?: IleSessionMode | string | null;
  transcript?: string;
}

function formatSteps(steps: SessionPlanUpdateStep[]): string {
  return steps
    .map((s, i) => `${i + 1}. [${s.type}] ${s.description} (status: ${s.status || "pending"})`)
    .join("\n");
}

function formatProbes(probes?: FocusedProbeForPrompt[]): string {
  if (!probes?.length) return "None";
  return probes.map((p) => `- [${p.id}]: "${p.text}"`).join("\n");
}

/**
 * Fill the session_plan_update template with plan context and Dialog/Project
 * closure + expansion rules.
 */
export function composeSessionPlanUpdatePrompt(
  template: string,
  vars: SessionPlanUpdatePromptVars,
): string {
  const secondsSinceLastProbe = vars.lastProbeTimestamp
    ? Math.floor(((vars.nowMs ?? Date.now()) - vars.lastProbeTimestamp) / 1000)
    : 0;

  const focusedProbesText =
    vars.focusedProbes && vars.focusedProbes.length > 0
      ? vars.focusedProbes.map((p) => `- [${p.id}]: "${p.text}"`).join("\n")
      : "None";

  const filled = template
    .replace("{goal}", vars.goal)
    .replace("{strategy}", vars.strategy)
    .replace("{steps}", formatSteps(vars.steps))
    .replace("{current_step}", vars.currentStepIndex.toString())
    .replace(
      "{context_description}",
      vars.contextDescription ||
        "See attached session artifacts (transcripts, EEG, facial, tool events, screenshots) for recent activity.",
    )
    .replace(
      "{transcript}",
      vars.transcript ||
        "See the attached transcript chunks (search them via attachment_search).",
    )
    .replace(
      "{previous_probes}",
      vars.previousProbes.length > 0
        ? vars.previousProbes.map((p, i) => `${i + 1}. ${p}`).join("\n")
        : "None yet",
    )
    .replace("{active_probes}", formatProbes(vars.activeProbes))
    .replace("{open_probe_count}", (vars.openProbeCount ?? 0).toString())
    .replace("{focused_probes}", focusedProbesText)
    .replace("{secondsSinceLastProbe}", secondsSinceLastProbe.toString());

  return [
    applyIleChapterModeInstructions(filled, vars.sessionMode),
    composeChapterMapGlyphJsonInstruction(),
  ]
    .filter(Boolean)
    .join("\n\n");
}
