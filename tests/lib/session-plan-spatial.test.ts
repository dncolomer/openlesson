import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  DEFAULT_INITIAL_CHAPTERS,
  INITIAL_CHAPTERS_BANDS,
  INITIAL_CHAPTERS_LEVELS,
  SPATIAL_MAP_LAYOUT_RULES,
  formatInitialChaptersForPrompt,
  getInitialChaptersBand,
  parseInitialChaptersLevel,
  resolveInitialChaptersFromBody,
} from "@/lib/initial-chapters";
import {
  composeSessionPlanCreatePrompt,
  normalizeSessionPlanCreateSteps,
  toPersistedCreatePlanSteps,
} from "@/lib/session-plan-create";
import {
  composeWorkspacePlanGeneratePrompt,
  composeWorkspaceSpatialGeneratePrompt,
  normalizeGeneratedWorkspaceBlocks,
} from "@/lib/workspace-spatial-create";
import { ensureChapterGridPositions } from "@/lib/chapter-skill-grid";
import { skillGridNodesFromRefs } from "@/lib/skill-grid-positions";
import { DEFAULT_PROMPTS } from "@/lib/prompts";
import type { SessionPlan } from "@/lib/domain/types";

describe("initial chapters → count bands", () => {
  it("exposes exactly three levels with raised counts", () => {
    expect(INITIAL_CHAPTERS_LEVELS).toEqual(["narrow", "mid", "broad"]);
    expect(DEFAULT_INITIAL_CHAPTERS).toBe("mid");
  });

  it("orders bands narrow < mid < broad with broad above prior ~12 target scale", () => {
    const narrow = INITIAL_CHAPTERS_BANDS.narrow;
    const mid = INITIAL_CHAPTERS_BANDS.mid;
    const broad = INITIAL_CHAPTERS_BANDS.broad;

    expect(narrow.target).toBeGreaterThanOrEqual(6);
    expect(mid.target).toBeGreaterThan(narrow.target);
    expect(broad.target).toBeGreaterThan(mid.target);
    expect(broad.target).toBeGreaterThan(12);
    expect(broad.max).toBeGreaterThan(14);
    expect(narrow.max).toBeLessThanOrEqual(mid.min);
  });

  it("parses unknown values to mid and resolves body field aliases", () => {
    expect(parseInitialChaptersLevel("narrow")).toBe("narrow");
    expect(parseInitialChaptersLevel("nope")).toBe(DEFAULT_INITIAL_CHAPTERS);
    expect(resolveInitialChaptersFromBody({ initial_chapters: "broad" })).toBe("broad");
    expect(resolveInitialChaptersFromBody({ initialChapters: "narrow" })).toBe("narrow");
    expect(resolveInitialChaptersFromBody({ mapSize: "broad" })).toBe("broad");
    expect(resolveInitialChaptersFromBody({})).toBe(DEFAULT_INITIAL_CHAPTERS);
  });

  it("formats prompt count instructions from the chosen band", () => {
    const broad = formatInitialChaptersForPrompt("broad");
    expect(broad.countInstruction).toContain(String(INITIAL_CHAPTERS_BANDS.broad.target));
    expect(broad.countInstruction).toMatch(/initial chapters/i);
    expect(getInitialChaptersBand("narrow").max).toBeLessThan(
      getInitialChaptersBand("broad").min,
    );
  });
});

describe("session plan create prompt composition", () => {
  it("injects origin/signed/branch spatial rules and initial-chapters band", () => {
    const narrowPrompt = composeSessionPlanCreatePrompt(DEFAULT_PROMPTS.session_plan_create, {
      problem: "Binary search trees",
      objectives: ["Insert nodes", "Balance a tree"],
      calibration: "2 prior sessions",
      initialChapters: "narrow",
    });

    expect(narrowPrompt).toContain("Binary search trees");
    expect(narrowPrompt).toContain(String(INITIAL_CHAPTERS_BANDS.narrow.target));
    expect(narrowPrompt).toMatch(/position_x=0,\s*position_y=0|\(0,\s*0\)|position_x=0/);
    expect(narrowPrompt).toMatch(/negative/i);
    expect(narrowPrompt).toMatch(/branch/i);
    expect(narrowPrompt).toMatch(/sparse|non-rectilinear|not a filled/i);
    expect(narrowPrompt).not.toContain("{initial_chapters_level}");
    expect(narrowPrompt).not.toContain("{spatial_map_layout_rules}");
    expect(narrowPrompt).not.toContain("{target_step_count}");

    const broadPrompt = composeSessionPlanCreatePrompt(DEFAULT_PROMPTS.session_plan_create, {
      problem: "Binary search trees",
      initialChapters: "broad",
    });
    expect(broadPrompt).toContain(String(INITIAL_CHAPTERS_BANDS.broad.target));
    expect(INITIAL_CHAPTERS_BANDS.broad.target).toBeGreaterThan(
      INITIAL_CHAPTERS_BANDS.narrow.target,
    );
  });

  it("default prompt template encodes multi-quadrant example coords", () => {
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("{initial_chapters_level}");
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("position_x\": -1");
    expect(SPATIAL_MAP_LAYOUT_RULES).toMatch(/negative/i);
  });
});

describe("normalizeSessionPlanCreateSteps multi-quadrant positions", () => {
  it("keeps signed unique coordinates including negatives", () => {
    const steps = normalizeSessionPlanCreateSteps(
      [
        { type: "task", description: "Origin start", order: 1, position_x: 0, position_y: 0 },
        { type: "task", description: "East arm", order: 2, position_x: 1, position_y: 0 },
        { type: "task", description: "West arm", order: 3, position_x: -1, position_y: 0 },
        { type: "checkpoint", description: "South branch", order: 4, position_x: 0, position_y: -1 },
        { type: "task", description: "NW deeper", order: 5, position_x: -2, position_y: 1 },
      ],
      { idSeed: 42 },
    );

    expect(steps).toHaveLength(5);
    expect(steps[0]).toMatchObject({ position_x: 0, position_y: 0 });
    expect(steps.some((s) => (s.position_x ?? 0) < 0)).toBe(true);
    expect(steps.some((s) => (s.position_y ?? 0) < 0)).toBe(true);
    const cells = new Set(steps.map((s) => `${s.position_x}:${s.position_y}`));
    expect(cells.size).toBe(5);
  });

  it("assigns origin to first step when missing and free", () => {
    const steps = normalizeSessionPlanCreateSteps(
      [
        { description: "Foundation", type: "task" },
        { description: "Next", type: "task", position_x: 1, position_y: 0 },
      ],
      { idSeed: 1 },
    );
    expect(steps[0]).toMatchObject({ position_x: 0, position_y: 0 });
    expect(steps[1]).toMatchObject({ position_x: 1, position_y: 0 });
  });

  it("toPersistedCreatePlanSteps preserves signed coords", () => {
    const normalized = normalizeSessionPlanCreateSteps(
      [
        { description: "Origin", type: "task", position_x: 0, position_y: 0 },
        { description: "West", type: "checkpoint", position_x: -1, position_y: 0 },
      ],
      { idSeed: 99 },
    );
    const persisted = toPersistedCreatePlanSteps(normalized, { idSeed: 99 });
    expect(persisted[0].status).toBe("in_progress");
    expect(persisted[1]).toMatchObject({ position_x: -1, position_y: 0 });
  });
});

describe("workspace spatial normalize + prompts", () => {
  it("composes workspace prompts with initial chapters and signed layout rules", () => {
    const agentPrompt = composeWorkspaceSpatialGeneratePrompt({
      topicOrPrompt: "Vector databases",
      initialChapters: "broad",
      fileContext: "\nInitial files: notes.md",
    });
    expect(agentPrompt).toContain("Vector databases");
    expect(agentPrompt).toContain(String(INITIAL_CHAPTERS_BANDS.broad.target));
    expect(agentPrompt).toMatch(/position_x=0|position_x\": 0|\(0, 0\)/);
    expect(agentPrompt).toMatch(/negative/i);
    expect(agentPrompt).toMatch(/branch/i);

    const planPrompt = composeWorkspacePlanGeneratePrompt({
      topic: "Linear algebra",
      initialChapters: "narrow",
      daysHint: 30,
    });
    expect(planPrompt).toContain("Linear algebra");
    expect(planPrompt).toContain(String(INITIAL_CHAPTERS_BANDS.narrow.min));
    expect(planPrompt).toMatch(/branch/i);
  });

  it("normalizes branched multi-quadrant workspace blocks and keeps next links", () => {
    const blocks = normalizeGeneratedWorkspaceBlocks(
      [
        {
          id: "a",
          title: "Foundations",
          description: "Core ideas",
          is_start: true,
          next: ["b", "c"],
          position_x: 0,
          position_y: 0,
        },
        {
          id: "b",
          title: "East path",
          description: "Apply east",
          next: ["d"],
          position_x: 1,
          position_y: 0,
        },
        {
          id: "c",
          title: "West branch",
          description: "Alternate west",
          next: [],
          position_x: -1,
          position_y: 0,
        },
        {
          id: "d",
          title: "East deeper",
          description: "Deeper arm",
          next: [],
          position_x: 2,
          position_y: -1,
        },
        {
          id: "ghost",
          title: "Bad next",
          description: "Drops unknown next",
          next: ["missing", "a"],
          position_x: 0,
          position_y: 1,
        },
      ],
      { idSeed: 3 },
    );

    expect(blocks.find((b) => b.id === "a")).toMatchObject({
      is_start: true,
      position_x: 0,
      position_y: 0,
      next: ["b", "c"],
    });
    expect(blocks.find((b) => b.id === "c")?.position_x).toBe(-1);
    expect(blocks.find((b) => b.id === "d")).toMatchObject({ position_x: 2, position_y: -1 });
    const branch = blocks.find((b) => b.id === "a");
    expect(branch?.next?.length).toBeGreaterThanOrEqual(2);
    expect(blocks.find((b) => b.id === "ghost")?.next).toEqual(["a"]);

    // skill-grid refs preserve positions + graph for persist path
    const idMap = new Map(blocks.map((b) => [b.id, `db-${b.id}`]));
    const skillNodes = skillGridNodesFromRefs(blocks, idMap);
    const origin = skillNodes.find((n) => n.id === "db-a");
    expect(origin?.position_x).toBe(0);
    expect(origin?.position_y).toBe(0);
    expect(origin?.next_block_ids).toEqual(["db-b", "db-c"]);
    const west = skillNodes.find((n) => n.id === "db-c");
    expect(west?.position_x).toBe(-1);
  });
});

describe("chapter-map position honor path", () => {
  it("does not overwrite intentional signed coordinates when ensuring grid positions", () => {
    const plan: SessionPlan = {
      id: "plan-spatial",
      sessionId: "session-1",
      userId: "user-1",
      goal: "Spatial plan",
      strategy: "Branches",
      steps: [
        {
          id: "s1",
          description: "Center",
          status: "in_progress",
          type: "task",
          order: 1,
          position_x: 0,
          position_y: 0,
        },
        {
          id: "s2",
          description: "West path",
          status: "pending",
          type: "task",
          order: 2,
          position_x: -2,
          position_y: 0,
        },
        {
          id: "s3",
          description: "Needs backfill only",
          status: "pending",
          type: "checkpoint",
          order: 3,
        },
      ],
      currentStepIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { plan: next, changed } = ensureChapterGridPositions(plan);
    expect(changed).toBe(true);
    const byId = Object.fromEntries(next.steps.map((s) => [s.id, s]));
    expect(byId.s1).toMatchObject({ position_x: 0, position_y: 0 });
    expect(byId.s2).toMatchObject({ position_x: -2, position_y: 0 });
    expect(byId.s3.position_x).toBeDefined();
    expect(`${byId.s3.position_x}:${byId.s3.position_y}`).not.toBe("0:0");
    expect(`${byId.s3.position_x}:${byId.s3.position_y}`).not.toBe("-2:0");
  });
});

describe("create surface wiring (structural)", () => {
  it("ILE create API accepts initialChapters and preserves positions", () => {
    const routeSrc = readFileSync(
      path.join(process.cwd(), "app/api/session-plan/create/route.ts"),
      "utf8",
    );
    expect(routeSrc).toContain("initialChapters");
    expect(routeSrc).toContain("resolveInitialChaptersFromBody");
    expect(routeSrc).toContain("toPersistedCreatePlanSteps");
  });

  it("welcome UI labels initial chapters and sends initialChapters", () => {
    const viewSrc = readFileSync(
      path.join(process.cwd(), "components/SessionView.tsx"),
      "utf8",
    );
    expect(viewSrc).toContain("INITIAL_CHAPTERS_LEVELS");
    expect(viewSrc).toContain("session.initialChapters");
    expect(viewSrc).toMatch(/initialChapters,/);
    // Existing chapter maps stay grayed until the user opts into regeneration.
    // chapterPlanStatus keeps the checkbox stable across load/confirm races.
    expect(viewSrc).toContain("regenerateChapters");
    expect(viewSrc).toContain("chapterPlanStatus");
    expect(viewSrc).toContain("hasExistingChapters");
    expect(viewSrc).toContain("shouldReuseExisting");
  });

  it("force create generates before deleting so regenerate failure keeps chapters", () => {
    const routeSrc = readFileSync(
      path.join(process.cwd(), "app/api/session-plan/create/route.ts"),
      "utf8",
    );
    const llmIdx = routeSrc.indexOf("createSessionPlanLLM");
    const deleteIdx = routeSrc.indexOf(".delete()");
    expect(llmIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(llmIdx).toBeLessThan(deleteIdx);
  });

  it("workspace generate + UI + agent create + MCP document initial_chapters", () => {
    const genSrc = readFileSync(
      path.join(process.cwd(), "app/api/workspace/generate/route.ts"),
      "utf8",
    );
    expect(genSrc).toContain("composeWorkspacePlanGeneratePrompt");
    expect(genSrc).toContain("normalizeGeneratedPlanNodes");
    expect(genSrc).toContain("insertGeneratedWorkspaceBlocks");
    expect(genSrc).toContain("extractGeneratedPlanNodes");

    const uiSrc = readFileSync(
      path.join(process.cwd(), "components/WorkspaceModeSelect.tsx"),
      "utf8",
    );
    expect(uiSrc).toContain("initialChapters");
    expect(uiSrc).toContain("planMode.initialChapters");

    const humanSrc = readFileSync(
      path.join(process.cwd(), "components/HumanModeSelect.tsx"),
      "utf8",
    );
    expect(humanSrc).toContain("initialChapters");
    expect(humanSrc).toContain("planMode.initialChapters");

    // Primary create surface at /workspace/new (standalone page, not WorkspaceModeSelect)
    const newWorkspaceSrc = readFileSync(
      path.join(process.cwd(), "app/workspace/new/page.tsx"),
      "utf8",
    );
    expect(newWorkspaceSrc).toContain("initialChapters");
    expect(newWorkspaceSrc).toContain("INITIAL_CHAPTERS_LEVELS");
    expect(newWorkspaceSrc).toMatch(/initialChapters,/);
    expect(newWorkspaceSrc).toMatch(/Initial chapters/i);

    const agentSrc = readFileSync(
      path.join(process.cwd(), "lib/agent-v2/create-agent-workspace.ts"),
      "utf8",
    );
    expect(agentSrc).toContain("composeWorkspaceSpatialGeneratePrompt");
    expect(agentSrc).toContain("normalizeGeneratedWorkspaceBlocks");
    expect(agentSrc).toContain("resolveInitialChaptersFromBody");

    const mcpSrc = readFileSync(
      path.join(process.cwd(), "lib/agent-v2/mcp-proof-of-work-server.ts"),
      "utf8",
    );
    expect(mcpSrc).toContain("initial_chapters");
    expect(mcpSrc).toMatch(/enum:\s*\[\s*"narrow"\s*,\s*"mid"\s*,\s*"broad"\s*\]/);

    const docs = readFileSync(
      path.join(process.cwd(), "docs/PROOF_OF_WORK_API.md"),
      "utf8",
    );
    expect(docs).toContain("initial_chapters");
    expect(docs).toMatch(/0,\s*0|\(0,0\)/);
  });
});
