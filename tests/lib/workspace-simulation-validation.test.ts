import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateWorkspaceSimulation,
  type WorkspaceValidationInput,
  type WorkspaceValidationResult,
} from "@/lib/workspace-simulation-validation";
import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";

const SCRATCH =
  process.env.GROK_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-78aaf8f88920/implementer";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function dimsOf(result: WorkspaceValidationResult): Set<string> {
  return new Set(result.findings.map((f) => f.dimension));
}

function findingIds(result: WorkspaceValidationResult): string[] {
  return result.findings.map((f) => f.id);
}

function ideaDims(result: WorkspaceValidationResult): Set<string> {
  return new Set(result.ideas.map((i) => i.dimension));
}

const sparse: WorkspaceValidationInput = {
  name: "",
  goal: "",
  description: "",
  notes: "",
  blocks: [],
  workspaceFileCount: 0,
  externalResourceCount: 0,
};

const rich: WorkspaceValidationInput = {
  name: "Conflict facilitation for tech leads",
  goal:
    "Enable tech leads to run constructive conflict conversations with clear outcomes and psychological safety.",
  description: "A practical map for mid-level engineering managers.",
  notes: "Use real team retros. Prefer open questions over advice.",
  workspaceFileCount: 2,
  externalResourceCount: 1,
  blocks: [
    {
      id: "s1",
      title: "Name the tension",
      description: "Practice stating the conflict without blame.",
      is_start: true,
      next_block_ids: ["a"],
      lock_until_block_ids: [],
      local_context: { notes: "Scripts for opening a hard conversation." },
    },
    {
      id: "a",
      title: "Hold the frame",
      description: "Keep the dialogue on shared goals and next steps.",
      is_start: false,
      next_block_ids: ["b"],
      lock_until_block_ids: ["s1"],
      local_context: { notes: "Frame cards." },
    },
    {
      id: "b",
      title: "Close with commitments",
      description: "End with explicit owners and follow-up.",
      is_start: false,
      next_block_ids: [],
      lock_until_block_ids: ["a"],
    },
  ],
};

describe("validateWorkspaceSimulation (shipped pure path)", () => {
  it("sparse workspace: critical findings on name, goal, blocks, context + ideas", () => {
    const result = validateWorkspaceSimulation(sparse);

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.ideas.length).toBeGreaterThan(0);
    expect(result.stats.criticalCount).toBeGreaterThan(0);
    expect(result.stats.ideaCount).toBe(result.ideas.length);
    expect(result.score).toBeLessThan(50);

    const ids = findingIds(result);
    expect(ids).toContain("name-missing");
    expect(ids).toContain("goal-missing");
    expect(ids).toContain("blocks-empty");
    expect(ids).toContain("context-none");

    const dims = dimsOf(result);
    expect(dims.has("name")).toBe(true);
    expect(dims.has("goal")).toBe(true);
    expect(dims.has("blocks")).toBe(true);
    expect(dims.has("context")).toBe(true);

    // Actionable ideas for each critical dimension
    const ideaDim = ideaDims(result);
    expect(ideaDim.has("name")).toBe(true);
    expect(ideaDim.has("goal")).toBe(true);
    expect(ideaDim.has("blocks")).toBe(true);
    expect(ideaDim.has("context")).toBe(true);

    for (const idea of result.ideas) {
      expect(idea.action.trim().length).toBeGreaterThan(10);
      expect(idea.rationale.trim().length).toBeGreaterThan(10);
    }
  });

  it("rich fixture: higher score, fewer criticals, content-sensitive difference", () => {
    const sparseResult = validateWorkspaceSimulation(sparse);
    const richResult = validateWorkspaceSimulation(rich);

    expect(richResult.stats.blockCount).toBe(3);
    expect(richResult.stats.startCount).toBe(1);
    expect(richResult.stats.withLocalContextCount).toBe(2);
    expect(richResult.stats.criticalCount).toBe(0);
    expect(richResult.score).toBeGreaterThan(sparseResult.score);
    expect(richResult.score).toBeGreaterThanOrEqual(70);

    // Different substance: rich has ok findings sparse lacks
    const richIds = findingIds(richResult);
    expect(richIds).toContain("name-ok");
    expect(richIds).toContain("goal-ok");
    expect(richIds).toContain("structure-start-ok");
    expect(richIds).not.toContain("name-missing");
    expect(richIds).not.toContain("blocks-empty");

    // Still returns structured improvements (refinement, not empty)
    expect(richResult.ideas.length).toBeGreaterThan(0);
    expect(richResult.summary.length).toBeGreaterThan(20);
    expect(richResult.dimensionsCovered).toEqual(
      expect.arrayContaining(["name", "goal", "blocks", "context"]),
    );
  });

  it("no starter with blocks → structure critical + idea", () => {
    const result = validateWorkspaceSimulation({
      name: "Map without start",
      goal: "Practice something meaningful with a full sentence goal here.",
      blocks: [
        {
          id: "x",
          title: "Orphan",
          description: "A block that is not marked as starter.",
          is_start: false,
        },
      ],
      notes: "Some notes",
    });
    expect(findingIds(result)).toContain("structure-no-start");
    expect(result.ideas.some((i) => i.id === "idea-structure-start")).toBe(true);
  });

  it("generic name + thin goal → warnings", () => {
    const result = validateWorkspaceSimulation({
      name: "Demo",
      goal: "Learn stuff",
      blocks: [
        {
          id: "s",
          title: "Start",
          description: "Enough description text here.",
          is_start: true,
        },
      ],
      notes: "ctx",
    });
    const ids = findingIds(result);
    expect(ids).toContain("name-weak");
    expect(ids).toContain("goal-thin");
  });
});

describe("Simulation validation module remains pure (tab UI no longer primary host)", () => {
  it("validateWorkspaceSimulation still exported; panel redo uses scope+generate", () => {
    const panel = read("components/WorkspaceSimulationPanel.tsx");
    const blockSim = read("components/WorkspaceBlockSimulationPanel.tsx");
    const view = readWorkspaceViewSurface();
    const aycl = read("components/AyclWorkspaceView.tsx");
    const mod = read("lib/workspace-simulation-validation.ts");

    // Pure validation module stays available for non-tab use
    expect(mod).toContain("export function validateWorkspaceSimulation");

    // Tab redo: scope + generate + results (not validation-only narrative)
    expect(panel).toContain("data-simulation-scope");
    expect(panel).toContain("data-simulation-generate");
    expect(panel).toContain("data-simulation-questions");
    expect(panel).toContain("data-simulation-exercises");
    expect(panel).toContain("workspaceGoal");
    expect(panel).toMatch(/notes|workspaceNotes/);

    // Hosts pass snapshot fields
    expect(view).toContain("WorkspaceSimulationPanel");
    expect(view).toMatch(/workspaceGoal|workspace_goal/);
    expect(aycl).toContain("WorkspaceView");

    // Per-block drawer does not host workspace validation
    expect(blockSim).not.toContain("validateWorkspaceSimulation");
    expect(blockSim).not.toContain("data-simulation-validation-run");
  });
});

describe("evidence capture", () => {
  it("writes sparse vs rich summary for harness", () => {
    mkdirSync(SCRATCH, { recursive: true });
    const a = validateWorkspaceSimulation(sparse);
    const b = validateWorkspaceSimulation(rich);
    const lines = [
      "workspace-simulation-validation evidence",
      `sparse_score=${a.score}`,
      `sparse_criticals=${a.stats.criticalCount}`,
      `sparse_ideas=${a.stats.ideaCount}`,
      `sparse_ids=${findingIds(a).join(",")}`,
      `rich_score=${b.score}`,
      `rich_criticals=${b.stats.criticalCount}`,
      `rich_ideas=${b.stats.ideaCount}`,
      `rich_ids=${findingIds(b).join(",")}`,
      `score_delta=${b.score - a.score}`,
    ];
    writeFileSync(join(SCRATCH, "workspace-simulation-validation-summary.txt"), lines.join("\n") + "\n");
    expect(b.score).toBeGreaterThan(a.score);
  });
});
