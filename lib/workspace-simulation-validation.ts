/**
 * Pure workspace-level validation for the Simulation tab.
 * Holistic checks on name, goal, blocks, context (+ structure/path signals).
 * Returns structured findings and actionable improvement ideas — no I/O, no LLM.
 */

import type { WorkspaceSimulationBlockRef } from "@/lib/workspace-simulation-overview";

export type WorkspaceValidationDimension =
  | "name"
  | "goal"
  | "blocks"
  | "context"
  | "structure"
  | "learner_path";

export type ValidationSeverity = "critical" | "warning" | "info" | "ok";

export type WorkspaceValidationFinding = {
  id: string;
  dimension: WorkspaceValidationDimension;
  severity: ValidationSeverity;
  title: string;
  detail: string;
};

export type WorkspaceValidationIdea = {
  id: string;
  dimension: WorkspaceValidationDimension;
  priority: "high" | "medium" | "low";
  action: string;
  rationale: string;
};

export type WorkspaceValidationInput = {
  name?: string | null;
  goal?: string | null;
  description?: string | null;
  notes?: string | null;
  blocks?: readonly WorkspaceSimulationBlockRef[] | null;
  /** Workspace-level files attached (Context). */
  workspaceFileCount?: number | null;
  /** External resources in workspace context. */
  externalResourceCount?: number | null;
};

export type WorkspaceValidationResult = {
  /** 0–100 composite readiness (higher = healthier for learners). */
  score: number;
  summary: string;
  findings: WorkspaceValidationFinding[];
  ideas: WorkspaceValidationIdea[];
  dimensionsCovered: WorkspaceValidationDimension[];
  /** Counts used in scoring — useful for tests and UI badges. */
  stats: {
    blockCount: number;
    startCount: number;
    withTitleCount: number;
    withDescriptionCount: number;
    withLocalContextCount: number;
    withNextLinkCount: number;
    criticalCount: number;
    warningCount: number;
    ideaCount: number;
  };
};

const DIMENSIONS: WorkspaceValidationDimension[] = [
  "name",
  "goal",
  "blocks",
  "context",
  "structure",
  "learner_path",
];

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLocalMaterials(
  lc: WorkspaceSimulationBlockRef["local_context"],
): boolean {
  if (!lc || typeof lc !== "object") return false;
  if (typeof lc.notes === "string" && lc.notes.trim()) return true;
  if (Array.isArray(lc.local_files) && lc.local_files.length > 0) return true;
  if (Array.isArray(lc.global_file_refs) && lc.global_file_refs.length > 0) return true;
  if (
    Array.isArray(lc.external_resource_ids) &&
    lc.external_resource_ids.length > 0
  ) {
    return true;
  }
  return false;
}

function isGenericName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n === "untitled" ||
    n === "workspace" ||
    n === "new workspace" ||
    n === "plan" ||
    n === "test" ||
    n === "demo"
  );
}

/**
 * Holistic workspace validation for Simulation authors.
 * Content-sensitive: sparse workspaces produce critical gaps; richer ones
 * surface fewer criticals and more refinement ideas.
 */
export function validateWorkspaceSimulation(
  input: WorkspaceValidationInput,
): WorkspaceValidationResult {
  const findings: WorkspaceValidationFinding[] = [];
  const ideas: WorkspaceValidationIdea[] = [];

  const name = clean(input.name);
  const goal = clean(input.goal);
  const description = clean(input.description);
  const notes = clean(input.notes);
  const blocks = (input.blocks || []).filter(
    (b) => b && String(b.id || "").trim(),
  );
  const fileCount = Math.max(0, Math.floor(Number(input.workspaceFileCount) || 0));
  const externalCount = Math.max(
    0,
    Math.floor(Number(input.externalResourceCount) || 0),
  );

  const blockCount = blocks.length;
  const starts = blocks.filter((b) => b.is_start);
  const startCount = starts.length;
  const withTitleCount = blocks.filter((b) => clean(b.title).length > 0).length;
  const withDescriptionCount = blocks.filter(
    (b) => clean(b.description).length >= 12,
  ).length;
  const withLocalContextCount = blocks.filter((b) =>
    hasLocalMaterials(b.local_context),
  ).length;
  const withNextLinkCount = blocks.filter(
    (b) => (b.next_block_ids || []).filter(Boolean).length > 0,
  ).length;
  const withLockCount = blocks.filter(
    (b) => (b.lock_until_block_ids || []).filter(Boolean).length > 0,
  ).length;

  // ── Name ──────────────────────────────────────────────────────────────
  if (!name) {
    findings.push({
      id: "name-missing",
      dimension: "name",
      severity: "critical",
      title: "Workspace name is missing",
      detail:
        "Learners and collaborators see the workspace name first. An empty name weakens orientation and sharing.",
    });
    ideas.push({
      id: "idea-name-set",
      dimension: "name",
      priority: "high",
      action: "Set a clear, specific workspace name in Settings or Context.",
      rationale:
        "A named course signals intent (e.g. “Conflict facilitation for tech leads”) instead of a blank shell.",
    });
  } else if (name.length < 4 || isGenericName(name)) {
    findings.push({
      id: "name-weak",
      dimension: "name",
      severity: "warning",
      title: "Workspace name is weak or generic",
      detail: `“${name}” is too short or generic to communicate the learning focus.`,
    });
    ideas.push({
      id: "idea-name-specific",
      dimension: "name",
      priority: "medium",
      action: "Rename to a specific topic or audience (role + skill + domain).",
      rationale: "Specific titles improve discoverability and author discipline.",
    });
  } else {
    findings.push({
      id: "name-ok",
      dimension: "name",
      severity: "ok",
      title: "Workspace has a usable name",
      detail: `Named “${name}”.`,
    });
  }

  // ── Goal ──────────────────────────────────────────────────────────────
  if (!goal) {
    findings.push({
      id: "goal-missing",
      dimension: "goal",
      severity: "critical",
      title: "Learning goal is missing",
      detail:
        "Without a workspace goal, block design and practice probes lack a shared outcome.",
    });
    ideas.push({
      id: "idea-goal-write",
      dimension: "goal",
      priority: "high",
      action:
        "Write a workspace goal: what a learner should be able to do after completing the map.",
      rationale:
        "Goals anchor starter blocks, lock-until gates, and Simulation probes.",
    });
  } else if (goal.length < 24) {
    findings.push({
      id: "goal-thin",
      dimension: "goal",
      severity: "warning",
      title: "Goal is too thin",
      detail:
        "The goal is short; expand it into an observable outcome (who, skill, evidence).",
    });
    ideas.push({
      id: "idea-goal-expand",
      dimension: "goal",
      priority: "medium",
      action:
        "Expand the goal to at least one concrete sentence with success criteria.",
      rationale: "Thin goals produce vague blocks and weak practice design.",
    });
  } else {
    findings.push({
      id: "goal-ok",
      dimension: "goal",
      severity: "ok",
      title: "Workspace goal is present",
      detail: goal.length > 120 ? `${goal.slice(0, 117)}…` : goal,
    });
  }

  // ── Blocks ────────────────────────────────────────────────────────────
  if (blockCount === 0) {
    findings.push({
      id: "blocks-empty",
      dimension: "blocks",
      severity: "critical",
      title: "No blocks on the map",
      detail:
        "Learners cannot Explore or Drill until the map has at least one topic block.",
    });
    ideas.push({
      id: "idea-blocks-add",
      dimension: "blocks",
      priority: "high",
      action: "Add starter blocks on the Workspace map for the first learning steps.",
      rationale: "Simulation and practice require placed blocks with titles.",
    });
  } else {
    const untitled = blockCount - withTitleCount;
    if (untitled > 0) {
      findings.push({
        id: "blocks-untitled",
        dimension: "blocks",
        severity: "warning",
        title: `${untitled} block${untitled === 1 ? "" : "s"} lack a title`,
        detail: "Untitled blocks confuse map navigation and probe generation.",
      });
      ideas.push({
        id: "idea-blocks-title",
        dimension: "blocks",
        priority: "high",
        action: "Title every block with a learner-facing topic phrase.",
        rationale: "Titles are the primary map labels and simulation seed text.",
      });
    }

    const thinDesc = blockCount - withDescriptionCount;
    if (thinDesc === blockCount) {
      findings.push({
        id: "blocks-no-descriptions",
        dimension: "blocks",
        severity: "warning",
        title: "Blocks lack meaningful descriptions",
        detail:
          "Descriptions feed Explore dialogue and Drill exercises in Block Simulation.",
      });
      ideas.push({
        id: "idea-blocks-describe",
        dimension: "blocks",
        priority: "medium",
        action:
          "Add a short description to each block (outcome + what the learner practices).",
        rationale: "Empty descriptions yield generic probes and weak journey previews.",
      });
    } else if (thinDesc > 0) {
      findings.push({
        id: "blocks-partial-descriptions",
        dimension: "blocks",
        severity: "info",
        title: `${thinDesc} of ${blockCount} blocks need stronger descriptions`,
        detail: "Fill remaining thin blocks so practice quality is consistent.",
      });
      ideas.push({
        id: "idea-blocks-describe-rest",
        dimension: "blocks",
        priority: "low",
        action: "Complete descriptions on remaining thin blocks.",
        rationale: "Consistency across the map improves learner trust.",
      });
    } else {
      findings.push({
        id: "blocks-descriptions-ok",
        dimension: "blocks",
        severity: "ok",
        title: "Blocks have usable descriptions",
        detail: `All ${blockCount} blocks include a non-trivial description.`,
      });
    }

    findings.push({
      id: "blocks-inventory",
      dimension: "blocks",
      severity: "info",
      title: `${blockCount} block${blockCount === 1 ? "" : "s"} on the map`,
      detail: `${withTitleCount} titled · ${withDescriptionCount} well-described · ${withLocalContextCount} with local context`,
    });
  }

  // ── Context ───────────────────────────────────────────────────────────
  const hasWorkspaceContext =
    notes.length > 0 || fileCount > 0 || externalCount > 0;
  const hasBlockContext = withLocalContextCount > 0;

  if (!hasWorkspaceContext && !hasBlockContext) {
    findings.push({
      id: "context-none",
      dimension: "context",
      severity: "critical",
      title: "No learning context attached",
      detail:
        "Neither workspace notes/files nor block local context are present. Practice stays generic.",
    });
    ideas.push({
      id: "idea-context-attach",
      dimension: "context",
      priority: "high",
      action:
        "Add workspace notes or files in Context, and/or attach local context on key blocks.",
      rationale:
        "Context grounds probes, merge/generate quality, and author review of learner journey.",
    });
  } else {
    if (!notes && fileCount === 0 && externalCount === 0) {
      findings.push({
        id: "context-workspace-thin",
        dimension: "context",
        severity: "warning",
        title: "Workspace-level Context is empty",
        detail:
          "Block-level materials exist, but shared workspace notes/files would help course-wide coherence.",
      });
      ideas.push({
        id: "idea-context-workspace",
        dimension: "context",
        priority: "medium",
        action: "Add notes or reference files in the Context section.",
        rationale: "Workspace context shapes generation and author intent.",
      });
    } else {
      findings.push({
        id: "context-workspace-ok",
        dimension: "context",
        severity: "ok",
        title: "Workspace Context has materials",
        detail: [
          notes ? "notes" : null,
          fileCount > 0 ? `${fileCount} file(s)` : null,
          externalCount > 0 ? `${externalCount} external` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }

    if (!hasBlockContext && blockCount > 0) {
      findings.push({
        id: "context-blocks-none",
        dimension: "context",
        severity: "warning",
        title: "No block has local context",
        detail:
          "Local context on blocks improves Simulation probes and Explore grounding.",
      });
      ideas.push({
        id: "idea-context-blocks",
        dimension: "context",
        priority: "medium",
        action: "Attach notes or files on starter and high-stakes blocks.",
        rationale: "Per-block context makes practice specific to that topic.",
      });
    } else if (hasBlockContext) {
      findings.push({
        id: "context-blocks-ok",
        dimension: "context",
        severity: "info",
        title: `${withLocalContextCount} block${withLocalContextCount === 1 ? "" : "s"} carry local context`,
        detail: "Local materials strengthen Block Simulation probes.",
      });
    }
  }

  if (description.length === 0 && (name || goal)) {
    findings.push({
      id: "context-description-missing",
      dimension: "context",
      severity: "info",
      title: "Workspace description is empty",
      detail: "A short description helps collaborators understand scope.",
    });
    ideas.push({
      id: "idea-description",
      dimension: "context",
      priority: "low",
      action: "Add a one-paragraph workspace description for authors and guests.",
      rationale: "Descriptions complement the goal with audience and scope.",
    });
  }

  // ── Structure / learner path ──────────────────────────────────────────
  if (blockCount > 0 && startCount === 0) {
    findings.push({
      id: "structure-no-start",
      dimension: "structure",
      severity: "critical",
      title: "No starter block marked",
      detail:
        "Without is_start, Simulation cannot recommend a clear entry path.",
    });
    ideas.push({
      id: "idea-structure-start",
      dimension: "structure",
      priority: "high",
      action: "Mark at least one block as a starter on the map.",
      rationale: "Starters define sample paths and first-practice probes.",
    });
  } else if (startCount > 0) {
    findings.push({
      id: "structure-start-ok",
      dimension: "structure",
      severity: "ok",
      title: `${startCount} starter block${startCount === 1 ? "" : "s"}`,
      detail: "Entry points are defined for the learner journey.",
    });
  }

  if (blockCount >= 2 && withNextLinkCount === 0) {
    findings.push({
      id: "path-no-links",
      dimension: "learner_path",
      severity: "warning",
      title: "Blocks are not linked",
      detail:
        "No next_block_ids edges — sample paths stay single-step and order is unclear.",
    });
    ideas.push({
      id: "idea-path-link",
      dimension: "learner_path",
      priority: "medium",
      action: "Connect blocks with next-links so the journey has a spine.",
      rationale: "Linked maps produce multi-step Simulation paths.",
    });
  } else if (blockCount >= 2 && withNextLinkCount > 0) {
    findings.push({
      id: "path-links-ok",
      dimension: "learner_path",
      severity: "ok",
      title: "Map has forward links",
      detail: `${withNextLinkCount} block${withNextLinkCount === 1 ? "" : "s"} define next steps.`,
    });
  }

  if (blockCount >= 3 && withLockCount === 0 && startCount > 0) {
    findings.push({
      id: "path-no-gates",
      dimension: "learner_path",
      severity: "info",
      title: "No prerequisite gates",
      detail:
        "Optional: lock advanced blocks until earlier ones complete for a progressive path.",
    });
    ideas.push({
      id: "idea-path-locks",
      dimension: "learner_path",
      priority: "low",
      action:
        "Consider lock-until prerequisites on advanced blocks if order matters.",
      rationale: "Gates prevent skipping foundations in skill maps.",
    });
  }

  if (blockCount === 1 && startCount === 1) {
    findings.push({
      id: "path-single-block",
      dimension: "learner_path",
      severity: "info",
      title: "Single-block map",
      detail: "A one-block workspace works for a short drill; expand for a journey.",
    });
    ideas.push({
      id: "idea-path-expand-map",
      dimension: "learner_path",
      priority: "medium",
      action: "Add follow-on blocks that deepen or apply the starter topic.",
      rationale: "Multi-block maps enable richer Simulation paths and practice.",
    });
  }

  // Ensure sparse workspaces always have non-empty guidance
  if (ideas.length === 0) {
    ideas.push({
      id: "idea-refine-probes",
      dimension: "blocks",
      priority: "low",
      action:
        "Open Block Simulation on key blocks and regenerate probes after content edits.",
      rationale: "Even solid maps benefit from periodic practice refresh.",
    });
  }

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;
  const okCount = findings.filter((f) => f.severity === "ok").length;

  // Score: start 100, subtract for gaps, floor 0, cap 100
  let score = 100;
  score -= criticalCount * 22;
  score -= warningCount * 8;
  score += Math.min(12, okCount * 3);
  if (blockCount === 0) score = Math.min(score, 25);
  if (!name && !goal) score = Math.min(score, 20);
  score = Math.max(0, Math.min(100, Math.round(score)));

  let summary: string;
  if (criticalCount > 0) {
    summary = `Validation found ${criticalCount} critical gap${criticalCount === 1 ? "" : "s"} and ${ideas.length} improvement idea${ideas.length === 1 ? "" : "s"}. Address name, goal, blocks, and context before relying on this map with learners.`;
  } else if (warningCount > 0) {
    summary = `Workspace is usable but has ${warningCount} warning${warningCount === 1 ? "" : "s"}. Review the ideas below to strengthen the learner journey.`;
  } else {
    summary = `Workspace looks solid for Simulation (score ${score}). Refine with the optional ideas below or regenerate block probes after content changes.`;
  }

  return {
    score,
    summary,
    findings,
    ideas,
    dimensionsCovered: [...DIMENSIONS],
    stats: {
      blockCount,
      startCount,
      withTitleCount,
      withDescriptionCount,
      withLocalContextCount,
      withNextLinkCount,
      criticalCount,
      warningCount,
      ideaCount: ideas.length,
    },
  };
}
