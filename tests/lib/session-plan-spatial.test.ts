import { readMcpSurface, readSessionViewSurface } from "@/tests/helpers/surface-source";
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  DEFAULT_INITIAL_CHAPTERS,
  INITIAL_CHAPTERS_BANDS,
  INITIAL_CHAPTERS_CATALOG,
  INITIAL_CHAPTERS_LEVELS,
  INITIAL_CHAPTERS_TECHNIQUE_IDS,
  SPATIAL_MAP_LAYOUT_RULES,
  blockedChapterSlotsFromPattern,
  formatInitialChaptersForPrompt,
  getInitialChaptersBand,
  parseInitialChaptersLevel,
  resolveInitialChaptersFromBody,
  pickRandomInitialChapters,
  stepInitialChaptersCatalog,
} from "@/lib/initial-chapters";
import {
  isChapterSlotBlocked,
  relocateChapterStepsOffBlocked,
} from "@/lib/ile-chapter-blocked";
import {
  dummyDensityBlockedCount,
  dummyDensityOccupiedCount,
  dummyOccupiedClusterCount,
  dummyPatternCells,
  miniMapDummyFrame,
} from "@/lib/ile-chapter-mini-map";
import {
  composeSessionPlanCreatePrompt,
  normalizeSessionPlanCreateSteps,
  SESSION_PLAN_CREATE_JSON_SCHEMA,
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

describe("initial chapters → catalog + count bands", () => {
  it("exposes six technique ids including islands plus random sparse/dense", () => {
    expect(INITIAL_CHAPTERS_TECHNIQUE_IDS).toEqual([
      "islands",
      "spiral",
      "ladder",
      "hub",
      "tracks",
      "ring",
    ]);
    expect(INITIAL_CHAPTERS_TECHNIQUE_IDS).toHaveLength(6);
    expect(INITIAL_CHAPTERS_TECHNIQUE_IDS).toContain("islands");
    expect(INITIAL_CHAPTERS_LEVELS).toEqual([
      "islands",
      "spiral",
      "ladder",
      "hub",
      "tracks",
      "ring",
      "random_sparse",
      "random_dense",
    ]);
    expect(DEFAULT_INITIAL_CHAPTERS).toBe("islands");
    expect(INITIAL_CHAPTERS_CATALOG).toHaveLength(INITIAL_CHAPTERS_LEVELS.length);
    for (const option of INITIAL_CHAPTERS_CATALOG) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(12);
      expect(option.occupied.length).toBeGreaterThan(0);
    }
    const en = JSON.parse(
      readFileSync(path.join(process.cwd(), "messages/en.json"), "utf8"),
    ) as { session: Record<string, string>; planMode: Record<string, string> };
    for (const option of INITIAL_CHAPTERS_CATALOG) {
      expect(en.session[option.titleKey]).toBeTruthy();
      expect(en.session[option.descKey]).toBeTruthy();
      expect(en.planMode[option.titleKey]).toBeTruthy();
      expect(en.planMode[option.descKey]).toBeTruthy();
    }
  });

  it("keeps random-sparse occupied count below random-dense at the old broad scale", () => {
    const sparse = INITIAL_CHAPTERS_BANDS.random_sparse;
    const dense = INITIAL_CHAPTERS_BANDS.random_dense;
    expect(sparse.target).toBeGreaterThanOrEqual(6);
    expect(dense.target).toBeGreaterThan(sparse.target);
    expect(dense.target).toBeGreaterThan(12);
    expect(dense.max).toBeGreaterThan(14);
    expect(sparse.max).toBeLessThanOrEqual(dense.min);
    expect(dummyDensityOccupiedCount("random_sparse")).toBeLessThan(
      dummyDensityOccupiedCount("random_dense"),
    );
    expect(dummyDensityOccupiedCount("random_dense")).toBeGreaterThanOrEqual(18);
    const frame = miniMapDummyFrame();
    expect(frame).toEqual({ minRow: 0, maxRow: 6, minCol: 0, maxCol: 6 });
    for (const id of INITIAL_CHAPTERS_LEVELS) {
      const cells = dummyPatternCells(id);
      expect(cells.every((c) => c.row >= frame.minRow && c.row <= frame.maxRow)).toBe(true);
      expect(cells.every((c) => c.col >= frame.minCol && c.col <= frame.maxCol)).toBe(true);
    }
  });

  it("maps legacy narrow/broad/mid and unknown values", () => {
    expect(parseInitialChaptersLevel("narrow")).toBe("random_sparse");
    expect(parseInitialChaptersLevel("broad")).toBe("random_dense");
    expect(parseInitialChaptersLevel("mid")).toBe("islands");
    expect(parseInitialChaptersLevel("islands")).toBe("islands");
    expect(parseInitialChaptersLevel("nope")).toBe(DEFAULT_INITIAL_CHAPTERS);
    expect(resolveInitialChaptersFromBody({ initial_chapters: "broad" })).toBe("random_dense");
    expect(resolveInitialChaptersFromBody({ initialChapters: "narrow" })).toBe("random_sparse");
    expect(resolveInitialChaptersFromBody({ mapSize: "narrow" })).toBe("random_sparse");
    expect(resolveInitialChaptersFromBody({ mapSize: "broad" })).toBe("random_dense");
    expect(resolveInitialChaptersFromBody({ initial_chapters: "islands" })).toBe("islands");
    expect(resolveInitialChaptersFromBody({})).toBe(DEFAULT_INITIAL_CHAPTERS);
  });

  it("Islands schematic has ≥3 separated clusters plus blocked or empty corridors", () => {
    expect(dummyOccupiedClusterCount("islands")).toBeGreaterThanOrEqual(3);
    expect(dummyDensityBlockedCount("islands")).toBeGreaterThan(0);
    const islandsPrompt = formatInitialChaptersForPrompt("islands");
    expect(islandsPrompt.layoutInstruction).toMatch(/cluster|island/i);
    expect(islandsPrompt.layoutInstruction).toMatch(/bridge/i);
    expect(islandsPrompt.layoutInstruction).toMatch(/blocked|empty|corridor/i);
    expect(islandsPrompt.countInstruction).toMatch(/cluster|island/i);
    expect(islandsPrompt.countInstruction).toMatch(/bridge/i);
    expect(blockedChapterSlotsFromPattern("islands").length).toBeGreaterThan(0);
    expect(blockedChapterSlotsFromPattern("random_sparse")).toEqual([]);
    expect(islandsPrompt.countInstruction).toMatch(/BLOCKED CHAPTER SLOTS/i);
    expect(islandsPrompt.countInstruction).toMatch(/position_x=/);
    expect(formatInitialChaptersForPrompt("random_sparse").countInstruction).not.toMatch(
      /BLOCKED CHAPTER SLOTS/i,
    );
  });

  it("relocates generated chapters off blocked slots", () => {
    const blocked = blockedChapterSlotsFromPattern("islands");
    expect(blocked.length).toBeGreaterThan(0);
    const hit = blocked[0];
    const steps = relocateChapterStepsOffBlocked(
      [
        {
          id: "s1",
          description: "On a blocked cell",
          status: "pending",
          type: "task",
          order: 1,
          position_x: hit.col,
          position_y: hit.row,
        },
      ],
      blocked,
    );
    expect(steps[0].position_x).not.toBe(hit.col);
    expect(steps[0].position_y).not.toBeUndefined();
    expect(
      blocked.some((cell) => cell.col === steps[0].position_x && cell.row === steps[0].position_y),
    ).toBe(false);
    expect(
      isChapterSlotBlocked({ unusable_cells: blocked }, hit.row, hit.col),
    ).toBe(true);
  });

  it("formats prompt count instructions from the chosen band", () => {
    const dense = formatInitialChaptersForPrompt("random_dense");
    expect(dense.countInstruction).toContain(String(INITIAL_CHAPTERS_BANDS.random_dense.target));
    expect(dense.countInstruction).toMatch(/initial chapters/i);
    expect(getInitialChaptersBand("narrow").max).toBeLessThan(
      getInitialChaptersBand("broad").min,
    );
    expect(formatInitialChaptersForPrompt("random_sparse").layoutInstruction).toBe("");
  });

  it("carousel arrows wrap through the catalog", () => {
    expect(stepInitialChaptersCatalog("islands", 1)).toBe("spiral");
    expect(stepInitialChaptersCatalog("islands", -1)).toBe("random_dense");
    expect(stepInitialChaptersCatalog("random_dense", 1)).toBe("islands");
    expect(stepInitialChaptersCatalog("narrow", 1)).toBe(
      stepInitialChaptersCatalog("random_sparse", 1),
    );
  });

  it("picks uniformly among the eight catalog types", () => {
    expect(INITIAL_CHAPTERS_LEVELS).toHaveLength(8);
    expect(pickRandomInitialChapters(() => 0)).toBe("islands");
    expect(pickRandomInitialChapters(() => 0.99)).toBe("random_dense");
    expect(INITIAL_CHAPTERS_LEVELS).toContain(
      pickRandomInitialChapters(() => 0.5),
    );
  });
});

describe("session plan create prompt composition", () => {
  it("injects origin/signed/branch spatial rules and initial-chapters band", () => {
    const narrowPrompt = composeSessionPlanCreatePrompt(DEFAULT_PROMPTS.session_plan_create, {
      problem: "Binary search trees",
      objectives: ["Insert nodes", "Balance a tree"],
      calibration: "2 prior sessions",
      initialChapters: "random_sparse",
    });

    expect(narrowPrompt).toContain("Binary search trees");
    expect(narrowPrompt).toContain(String(INITIAL_CHAPTERS_BANDS.random_sparse.target));
    expect(narrowPrompt).toMatch(/position_x=0,\s*position_y=0|\(0,\s*0\)|position_x=0/);
    expect(narrowPrompt).toMatch(/negative/i);
    expect(narrowPrompt).toMatch(/keyword/);
    expect(narrowPrompt).toMatch(/Each chapter\/step must include "keyword"/);
    expect(narrowPrompt).toMatch(/not copy the first words/i);
    expect(narrowPrompt).toMatch(/branch/i);
    expect(narrowPrompt).toMatch(/sparse|non-rectilinear|not a filled/i);
    expect(narrowPrompt).not.toContain("{initial_chapters_level}");
    expect(narrowPrompt).not.toContain("{spatial_map_layout_rules}");
    expect(narrowPrompt).not.toContain("{target_step_count}");

    const broadPrompt = composeSessionPlanCreatePrompt(DEFAULT_PROMPTS.session_plan_create, {
      problem: "Binary search trees",
      initialChapters: "random_dense",
    });
    expect(broadPrompt).toContain(String(INITIAL_CHAPTERS_BANDS.random_dense.target));
    expect(INITIAL_CHAPTERS_BANDS.random_dense.target).toBeGreaterThan(
      INITIAL_CHAPTERS_BANDS.random_sparse.target,
    );
    const islandsPrompt = composeSessionPlanCreatePrompt(DEFAULT_PROMPTS.session_plan_create, {
      problem: "Binary search trees",
      initialChapters: "islands",
    });
    expect(islandsPrompt).toMatch(/cluster|island/i);
    expect(islandsPrompt).toMatch(/bridge/i);
    expect(islandsPrompt).toMatch(/blocked|empty|corridor/i);
    expect(islandsPrompt).toMatch(/BLOCKED CHAPTER SLOTS/i);
  });

  it("default prompt template encodes multi-quadrant example coords", () => {
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("{initial_chapters_level}");
    expect(DEFAULT_PROMPTS.session_plan_create).toContain("position_x\": -1");
    expect(SPATIAL_MAP_LAYOUT_RULES).toMatch(/negative/i);
  });

  it("asks for a 1–2 word keyword on each chapter, not a truncated title", () => {
    const prompt = DEFAULT_PROMPTS.session_plan_create;
    expect(prompt).toMatch(/"keyword": "Tree Insert"/);
    expect(prompt).toMatch(/keyword: 1 or 2 map words/i);
    expect(prompt).toMatch(/NOT the first words of the description/);
    expect(SESSION_PLAN_CREATE_JSON_SCHEMA.schema.properties.steps).toBeTruthy();
    const stepsSchema = SESSION_PLAN_CREATE_JSON_SCHEMA.schema.properties.steps as {
      items: { required?: string[] };
    };
    expect(stepsSchema.items.required).toContain("keyword");
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

  it("stores the model keyword instead of the first two words of the description", () => {
    const steps = normalizeSessionPlanCreateSteps(
      [
        {
          type: "task",
          description: "Prove AVL rotate-left after a failing insert",
          keyword: "Rotate Left",
          order: 1,
          position_x: 0,
          position_y: 0,
        },
      ],
      { idSeed: 7 },
    );
    expect(steps[0].map_keyword).toBe("Rotate Left");
    expect(steps[0].map_keyword).not.toBe("Prove Avl");
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
      initialChapters: "random_dense",
      fileContext: "\nInitial files: notes.md",
    });
    expect(agentPrompt).toContain("Vector databases");
    expect(agentPrompt).toContain(String(INITIAL_CHAPTERS_BANDS.random_dense.target));
    expect(agentPrompt).toMatch(/position_x=0|position_x\": 0|\(0, 0\)/);
    expect(agentPrompt).toMatch(/negative/i);
    expect(agentPrompt).toMatch(/branch/i);

    const planPrompt = composeWorkspacePlanGeneratePrompt({
      topic: "Linear algebra",
      initialChapters: "random_sparse",
      daysHint: 30,
    });
    expect(planPrompt).toContain("Linear algebra");
    expect(planPrompt).toContain(String(INITIAL_CHAPTERS_BANDS.random_sparse.min));
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
    expect(routeSrc).toContain("resolveMapTypeIdFromBody");
    expect(routeSrc).toContain("resolveMapTypeRecord");
    expect(routeSrc).toContain("toPersistedCreatePlanSteps");
    expect(routeSrc).toContain("sessionMode");
    expect(routeSrc).toContain("createSessionPlanLLM");
    expect(routeSrc).toMatch(/maxDuration\s*=\s*12[0-9]/);
    expect(routeSrc).toContain("unusable_cells");
    const xaiSrc = readFileSync(path.join(process.cwd(), "lib/xai.ts"), "utf8");
    expect(xaiSrc).toContain("SESSION_PLAN_CREATE_JSON_SCHEMA");
    expect(xaiSrc).toContain("callXaiWithSchema");
  });

  it("welcome UI labels initial chapters and sends initialChapters", () => {
    const viewSrc = readSessionViewSurface();
    expect(viewSrc).toContain("InitialChaptersPicker");
    expect(viewSrc).toContain("session.initialChapters");
    expect(viewSrc).toMatch(/initialChapters,/);
    // Existing chapter maps stay grayed until the user opts into regeneration.
    // chapterPlanStatus keeps the checkbox stable across load/confirm races.
    expect(viewSrc).toContain("regenerateChapters");
    expect(viewSrc).toContain("chapterPlanStatus");
    expect(viewSrc).toContain("hasExistingChapters");
    expect(viewSrc).toContain("shouldReuseExisting");
    expect(viewSrc).toContain("fetchSessionPlanChaptersStatus");
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
    // Race-safe replace: delete by session_id and upsert-friendly create.
    expect(routeSrc).toContain('.eq("session_id", sessionId)');
    expect(routeSrc).toContain("planAfterGenerate");
  });

  it("createSessionPlan upserts on session_id to avoid duplicate key races", () => {
    const src = readFileSync(
      path.join(process.cwd(), "lib/storage/session-plans.ts"),
      "utf8",
    );
    expect(src).toContain('onConflict: "session_id"');
    expect(src).toContain("upsert");
    expect(src).toContain("session_plans_session_id_key");
  });

  it("workspace generate + UI document initial_chapters (programmatic create is UI-only)", () => {
    const genSrc = readFileSync(
      path.join(process.cwd(), "app/api/workspace/generate/route.ts"),
      "utf8",
    );
    expect(genSrc).toContain("composeWorkspacePlanGeneratePrompt");
    expect(genSrc).toContain("normalizeGeneratedPlanNodes");
    expect(genSrc).toContain("insertGeneratedWorkspaceBlocks");
    expect(genSrc).toContain("unusable_cells");
    expect(genSrc).toContain("blockedChapterSlotsFromPattern");
    const chapter = readFileSync(
      path.join(process.cwd(), "components/ChapterMapPanel.tsx"),
      "utf8",
    );
    expect(chapter).toContain("unusableCells={plan.unusable_cells ?? []}");
    const xaiCreate = readFileSync(path.join(process.cwd(), "lib/xai.ts"), "utf8");
    expect(xaiCreate).toContain("relocateChapterStepsOffBlocked");
    expect(xaiCreate).toContain("blockedCellsFromMapType");
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
    expect(newWorkspaceSrc).toContain("InitialChaptersPicker");
    expect(newWorkspaceSrc).toMatch(/initialChapters,/);
    expect(newWorkspaceSrc).toMatch(/Map type|Starting map|Starting size|Initial chapters/i);
    expect(uiSrc).toContain("InitialChaptersPicker");
    expect(humanSrc).toContain("InitialChaptersPicker");
    const pickerSrc = readFileSync(
      path.join(process.cwd(), "components/InitialChaptersPicker.tsx"),
      "utf8",
    );
    expect(pickerSrc).toContain("dummyDensityCells");
    expect(pickerSrc).toContain("ChapterMiniMap");
    expect(pickerSrc).toContain("option.descKey");
    expect(pickerSrc).toContain("data-initial-chapters-carousel");
    expect(pickerSrc).toContain("data-initial-chapters-prev");
    expect(pickerSrc).toContain("data-initial-chapters-next");
    expect(pickerSrc).toContain("stepMapTypeCatalog");
    expect(pickerSrc).toContain("pickRandomMapType");
    expect(pickerSrc).toContain("data-initial-chapters-random-pick");
    expect(pickerSrc).toContain("fillHeight");
    expect(pickerSrc).not.toContain("grid-cols-2");
    expect(pickerSrc).not.toContain("sm:grid-cols-4");
    expect(pickerSrc).toContain("aspect-square");
    expect(pickerSrc).toContain("line-clamp-3");
    expect(pickerSrc).toContain("min-h-[3.6rem]");
    const welcomeSrc = readFileSync(
      path.join(process.cwd(), "components/session-view/session-welcome-modal.tsx"),
      "utf8",
    );
    expect(welcomeSrc).toContain("fillHeight");
    expect(welcomeSrc).toContain('data-ile-map-type-align="aesthetics"');
    const miniSrc = readFileSync(
      path.join(process.cwd(), "components/ChapterMiniMap.tsx"),
      "utf8",
    );
    expect(miniSrc).toContain("miniMapDummyFrame");
    const copy = JSON.parse(
      readFileSync(path.join(process.cwd(), "messages/en.json"), "utf8"),
    ) as { session: Record<string, string>; planMode: Record<string, string> };
    expect(copy.session.initialChapters).toBe("Map type");
    expect(copy.planMode.initialChapters).toBe("Map type");

    // Public MCP surface no longer offers create_workspace / initial_chapters on create
    const mcpSrc = readMcpSurface();
    expect(mcpSrc).toContain("rejectProgrammaticWorkspaceCreate");
    expect(mcpSrc).not.toMatch(/name:\s*"create_workspace"/);

    const docs = readFileSync(
      path.join(process.cwd(), "docs/PROOF_OF_WORK_API.md"),
      "utf8",
    );
    expect(docs).toMatch(/UI only|UI-only/i);
  });
});
