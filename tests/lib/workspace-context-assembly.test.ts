/**
 * Shared workspace-context assembly for TAP / ILE / TAPBench.
 * Drives the real assembler + call-chain wiring (not a reimplementation).
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assembleFocusedBlockPromptContext,
  assemblePromptWorkspaceContext,
  formatPromptWorkspaceContextBlock,
  mergeGlobalAndLocalFiles,
  normalizeBlockLocalContext,
} from "@/lib/prompt-workspace-context";
import {
  buildExercisePromptText,
  resolveExercisePromptContext,
} from "@/lib/exercise-tap";
import { buildIleProjectChapterExercisePrompt } from "@/lib/ile-mode";
import { buildTapbenchExercise } from "@/lib/pow-api/tapbench";
import { buildDomainExerciseAuthorUserPrompt } from "@/lib/pow-api/tapbench-exercise-generate";
import { buildTapScoreInstructions, type TapScoreBrief } from "@/lib/tap-score";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.WORKSPACE_CONTEXT_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-0b9bfff9cca4/implementer";

function ensureScratch() {
  try {
    mkdirSync(SCRATCH, { recursive: true });
  } catch {
    /* optional */
  }
}

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const richFixture = {
  workspaceTitle: "SaaS tech team demo",
  rootTopic: "multi-tenant APIs",
  workspaceGoal: "Ship reliable multi-tenant APIs with predictable latency.",
  workspaceDescription: "Hands-on path for backend engineers.",
  notes: "Prefer composite indexes leading with tenant_id. Document cache key shapes.",
  blockTitle: "Data model & query performance",
  blockDescription:
    "Explain index choices, N+1 traps, and read-path caching for multi-tenant Postgres.",
  focusedBlockId: "b2",
  files: [
    {
      name: "query-checklist.md",
      excerpt: "Always filter by tenant_id. Batch child loads with ANY($1).",
    },
    {
      name: "schema.sql",
      excerpt: "CREATE TABLE tenants (id uuid PRIMARY KEY);",
    },
  ],
  blocks: [
    {
      id: "b1",
      title: "Auth foundations",
      description: "JWT + session cookies",
      status: "completed",
      is_start: true,
      position_x: 0,
      position_y: 0,
      span_w: 1,
      span_h: 1,
      next_block_ids: ["b2"],
    },
    {
      id: "b2",
      title: "Data model & query performance",
      description:
        "Explain index choices, N+1 traps, and read-path caching for multi-tenant Postgres.",
      status: "not_started",
      is_start: false,
      position_x: 1,
      position_y: 0,
      span_w: 2,
      span_h: 1,
      next_block_ids: ["b3"],
      lock_until_block_ids: ["b1"],
      local_context: {
        notes: "Local: cover EXPLAIN ANALYZE on tenant-scoped queries.",
        local_files: [
          {
            name: "local-query-tips.md",
            excerpt: "Use covering indexes for list endpoints.",
          },
        ],
        global_file_refs: ["query-checklist.md"],
      },
    },
    {
      id: "b3",
      title: "Caching layer",
      description: "Redis invalidation per tenant",
      status: "not_started",
      position_x: 3,
      position_y: 0,
      span_w: 1,
      span_h: 1,
      next_block_ids: [],
    },
  ],
  unusableCells: [
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ],
};

describe("assemblePromptWorkspaceContext — full layers", () => {
  it("includes notes, file names+excerpts, inventory, topology, and focused block", () => {
    const ctx = assemblePromptWorkspaceContext(richFixture);
    expect(ctx.hasDomainSubstance).toBe(true);
    expect(ctx.fileNames).toEqual(
      expect.arrayContaining(["query-checklist.md", "schema.sql", "local-query-tips.md"]),
    );
    expect(ctx.fileExcerpts.some((f) => /tenant_id/i.test(f.excerpt))).toBe(true);
    expect(ctx.contextBlock).toMatch(/Workspace notes/i);
    expect(ctx.contextBlock).toContain("query-checklist.md");
    expect(ctx.contextBlock).toMatch(/Workspace goal/i);
    expect(ctx.contextBlock).toMatch(/Focused block: Data model/i);
    expect(ctx.blockInventoryLines.length).toBeGreaterThanOrEqual(3);
    expect(ctx.contextBlock).toMatch(/Block inventory/i);
    expect(ctx.contextBlock).toMatch(/Auth foundations|start/i);
    expect(ctx.topologyLines.length).toBeGreaterThan(0);
    expect(ctx.contextBlock).toMatch(/Map layout|topology/i);
    expect(ctx.contextBlock).toMatch(/span 2×1|at \(0,1\)|next →/i);
    expect(ctx.contextBlock).toMatch(/Unusable ground/i);
    expect(ctx.contextBlock).toMatch(/\(1,0\)/);

    ensureScratch();
    try {
      writeFileSync(join(SCRATCH, "workspace-context-sample.txt"), ctx.contextBlock, "utf8");
    } catch {
      /* optional */
    }
  });

  it("formatPromptWorkspaceContextBlock matches assembled block", () => {
    const a = assemblePromptWorkspaceContext(richFixture);
    expect(formatPromptWorkspaceContextBlock(richFixture)).toBe(a.contextBlock);
    expect(formatPromptWorkspaceContextBlock(a)).toBe(a.contextBlock);
  });
});

describe("global + local merge for focused block", () => {
  it("workspace-only materials → no local section", () => {
    const ctx = assembleFocusedBlockPromptContext({
      workspaceTitle: "Demo",
      notes: "Global notes only",
      files: [{ name: "a.md", excerpt: "global body" }],
      blockTitle: "B1",
    });
    expect(ctx.hasLocalContext).toBe(false);
    expect(ctx.localContextLines).toEqual([]);
    expect(ctx.contextBlock).not.toMatch(/Local block context/i);
    expect(ctx.contextBlock).toContain("a.md");
  });

  it("block-local-only materials → distinct local section + shared workspace", () => {
    const ctx = assembleFocusedBlockPromptContext({
      workspaceTitle: "Demo",
      workspaceGoal: "Learn caching",
      blockTitle: "Redis",
      focusedBlockId: "bx",
      blockLocalContext: {
        notes: "Only this block cares about eviction policy.",
        local_files: [{ name: "eviction.md", excerpt: "LRU vs LFU tradeoffs." }],
      },
    });
    expect(ctx.hasLocalContext).toBe(true);
    expect(ctx.localContextLines.join("\n")).toMatch(/Local block notes|eviction/i);
    expect(ctx.contextBlock).toMatch(/## Local block context/i);
    expect(ctx.contextBlock).toContain("Workspace goal: Learn caching");
    expect(ctx.fileNames).toContain("eviction.md");
  });

  it("local → global refs merge excerpts from workspace files", () => {
    const merged = mergeGlobalAndLocalFiles({
      workspaceFiles: [
        { name: "query-checklist.md", excerpt: "Always filter by tenant_id." },
        { name: "other.md", excerpt: "skip" },
      ],
      local: {
        global_file_refs: ["query-checklist.md"],
        notes: "ref the checklist",
      },
    });
    expect(merged.localSection.hasLocal).toBe(true);
    expect(merged.localSection.globalRefs).toContain("query-checklist.md");
    expect(merged.files.some((f) => f.name === "query-checklist.md" && f.excerpt)).toBe(true);

    const ctx = assembleFocusedBlockPromptContext({
      ...richFixture,
      blockLocalContext: richFixture.blocks[1].local_context,
    });
    expect(ctx.hasLocalContext).toBe(true);
    expect(ctx.contextBlock).toMatch(/Local block context/i);
    expect(ctx.contextBlock).toMatch(/References into workspace materials|query-checklist/i);
    expect(ctx.contextBlock).toMatch(/local-query-tips|EXPLAIN ANALYZE/i);
  });

  it("normalizeBlockLocalContext ignores empty shells", () => {
    expect(normalizeBlockLocalContext(null).hasLocalMaterials).toBe(false);
    expect(normalizeBlockLocalContext({ notes: "  " }).hasLocalMaterials).toBe(false);
    expect(
      normalizeBlockLocalContext({ notes: "hi", global_file_refs: ["a.md"] }).hasLocalMaterials,
    ).toBe(true);
  });
});

describe("TAP / ILE / TAPBench consume the shared assembler", () => {
  it("exercise TAP framer receives inventory + local via shared path", () => {
    const input = {
      ...richFixture,
      files: richFixture.files,
      blockDescription: richFixture.blockDescription,
      blocks: richFixture.blocks,
      focusedBlockId: richFixture.focusedBlockId,
      blockLocalContext: richFixture.blocks[1].local_context,
      unusableCells: richFixture.unusableCells,
    };
    // Assembled object used by the framer must carry all layers.
    const ctx = resolveExercisePromptContext(input);
    expect(ctx.hasLocalContext).toBe(true);
    expect(ctx.blockInventoryLines.length).toBeGreaterThanOrEqual(3);
    expect(ctx.contextBlock).toMatch(/Local block context/i);
    expect(ctx.contextBlock).toMatch(/Block inventory/i);
    expect(ctx.contextBlock).toMatch(/Unusable ground/i);
    expect(ctx.localContextLines.join("\n")).toMatch(/EXPLAIN ANALYZE|local-query-tips/i);

    // Learner-facing exercise body is explicit-only (no pure inventory shells).
    const text = buildExercisePromptText(input);
    expect(text).toBe("");

    const withExplicit = buildExercisePromptText({
      ...input,
      exerciseText:
        "Given multi-tenant Postgres, pick a composite index and explain N+1 risk.",
    });
    expect(withExplicit.startsWith("Exercise:")).toBe(true);
    expect(withExplicit).toMatch(/index|N\+1|tenant|Postgres/i);

    // Structural: exercise-tap still can assemble context for LLM paths.
    const exerciseSrc = read("lib/exercise-tap.ts");
    expect(exerciseSrc).toContain("resolveExercisePromptContext");
    expect(exerciseSrc).toContain("assemblePromptWorkspaceContext");
    expect(exerciseSrc).toContain("blocks:");
    expect(exerciseSrc).toContain("blockLocalContext");
    expect(exerciseSrc).toContain("unusableCells");
    expect(exerciseSrc).toContain('from "@/lib/prompt-workspace-context"');
  });

  it("ILE project framer uses chapter/explicit text only (context stays in prompts)", () => {
    const prompt = buildIleProjectChapterExercisePrompt({
      chapterDescription: richFixture.blockDescription,
      blockTitle: richFixture.blockTitle,
      workspaceTitle: richFixture.workspaceTitle,
      workspaceGoal: richFixture.workspaceGoal,
      notes: richFixture.notes,
      files: richFixture.files,
      blocks: richFixture.blocks,
      focusedBlockId: richFixture.focusedBlockId,
      blockLocalContext: richFixture.blocks[1].local_context,
      unusableCells: richFixture.unusableCells,
    });
    // Chapter description is passed as exerciseText — kept as body, not inventory dump
    expect(prompt).toMatch(/index|N\+1|tenant|Postgres/i);
    expect(prompt).not.toMatch(/attachments\s*:|Given parameters\s+A\s*=/i);
    const emptyChapter = buildIleProjectChapterExercisePrompt({
      chapterDescription: "",
      blockTitle: richFixture.blockTitle,
      blockDescription: richFixture.blockDescription,
    });
    expect(emptyChapter).toBe("");
    const ileSrc = read("lib/ile-mode.ts");
    expect(ileSrc).toContain("buildExercisePromptText");
    expect(ileSrc).toContain("blocks:");
    expect(ileSrc).toContain("blockLocalContext");
    expect(ileSrc).toContain("unusableCells");
  });

  it("TAPBench author user prompt includes inventory; mint body is explicit-only", () => {
    const src = read("lib/pow-api/tapbench-exercise-generate.ts");
    expect(src).toContain("assemblePromptWorkspaceContext");
    expect(src).toContain("blocks: input.blocks");
    expect(src).toContain("blockLocalContext");
    expect(src).toContain("unusableCells");
    expect(src).toContain('from "@/lib/prompt-workspace-context"');

    const authorUser = buildDomainExerciseAuthorUserPrompt({
      surface: "tapbench",
      workspaceTitle: richFixture.workspaceTitle,
      rootTopic: richFixture.rootTopic,
      workspaceGoal: richFixture.workspaceGoal,
      notes: richFixture.notes,
      blockTitle: richFixture.blockTitle,
      blockDescription: richFixture.blockDescription,
      files: richFixture.files,
      blocks: richFixture.blocks,
      focusedBlockId: richFixture.focusedBlockId,
      blockLocalContext: richFixture.blocks[1].local_context,
      unusableCells: richFixture.unusableCells,
    });
    expect(authorUser).toMatch(/Block inventory/i);
    expect(authorUser).toMatch(/Map layout|topology|Unusable ground/i);
    expect(authorUser).toMatch(/Local block context|EXPLAIN ANALYZE|local-query-tips/i);
    expect(authorUser).toContain("query-checklist.md");

    // Learner-facing mint body: empty without explicit exerciseText
    const emptyEx = buildTapbenchExercise({
      workspaceTitle: richFixture.workspaceTitle,
      blockTitle: richFixture.blockTitle,
      blockDescription: richFixture.blockDescription,
      blocks: richFixture.blocks,
      focusedBlockId: richFixture.focusedBlockId,
      blockLocalContext: richFixture.blocks[1].local_context,
      unusableCells: richFixture.unusableCells,
      files: richFixture.files,
      notes: richFixture.notes,
    });
    expect(emptyEx).toBe("");
    const ex = buildTapbenchExercise({
      exerciseText:
        "Exercise: Choose an index for multi-tenant Postgres and explain N+1 risk.",
      workspaceTitle: richFixture.workspaceTitle,
      blockTitle: richFixture.blockTitle,
    });
    expect(ex).toMatch(/index|N\+1|Postgres/i);
  });

  it("tap-score brief path loads layout fields and injects shared context", () => {
    const tap = read("lib/tap-score.ts");
    expect(tap).toContain("formatPromptWorkspaceContextBlock");
    expect(tap).toContain("position_x");
    expect(tap).toContain("lock_until_block_ids");
    expect(tap).toContain("local_context");
    expect(tap).toContain("unusableCells");
    expect(tap).toContain("blocks: inventoryBlocks");

    // Full map: inventory + topology even without a single focused block.
    const fullBrief: TapScoreBrief = {
      plan: {
        id: "ws1",
        title: richFixture.workspaceTitle,
        root_topic: richFixture.rootTopic,
        description: richFixture.workspaceDescription,
        notes: richFixture.notes,
        workspace_goal: richFixture.workspaceGoal,
      },
      nodes: richFixture.blocks.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        status: b.status,
        is_start: b.is_start,
        position_x: b.position_x,
        position_y: b.position_y,
        span_w: b.span_w,
        span_h: b.span_h,
        next_block_ids: b.next_block_ids,
        lock_until_block_ids: b.lock_until_block_ids,
        local_context: b.local_context,
      })),
      sessions: [],
      files: richFixture.files.map((f) => ({ name: f.name })),
      unusableCells: richFixture.unusableCells,
    };
    const full = buildTapScoreInstructions(fullBrief, "curious", 15);
    expect(full).toMatch(/Workspace goal|query-checklist|Block inventory|Map layout/i);
    expect(full).toMatch(/Unusable ground|Auth foundations|span 2×1/i);

    // Single focused node → local block materials merge into shared context.
    const focusedNode = richFixture.blocks[1];
    const focusedBrief: TapScoreBrief = {
      ...fullBrief,
      nodes: [
        {
          id: focusedNode.id,
          title: focusedNode.title,
          description: focusedNode.description,
          status: focusedNode.status,
          is_start: focusedNode.is_start,
          position_x: focusedNode.position_x,
          position_y: focusedNode.position_y,
          span_w: focusedNode.span_w,
          span_h: focusedNode.span_h,
          next_block_ids: focusedNode.next_block_ids,
          lock_until_block_ids: focusedNode.lock_until_block_ids,
          local_context: focusedNode.local_context,
        },
      ],
    };
    const focused = buildTapScoreInstructions(focusedBrief, "curious", 15);
    expect(focused).toMatch(/Local block context|EXPLAIN ANALYZE|local-query-tips/i);
  });
});

describe("prompt impact layers for UI", () => {
  it("exposes creator/consumer readable layers with TAP/ILE/TAPBench feeds", () => {
    const ctx = assemblePromptWorkspaceContext(richFixture);
    expect(ctx.promptImpactLayers.length).toBeGreaterThanOrEqual(6);
    const ids = ctx.promptImpactLayers.map((l) => l.id);
    expect(ids).toContain("workspace_files");
    expect(ids).toContain("block_inventory");
    expect(ids).toContain("map_topology");
    expect(ids).toContain("local_context");
    expect(ids).toContain("surfaces");
    const local = ctx.promptImpactLayers.find((l) => l.id === "local_context");
    expect(local?.present).toBe(true);
    expect(local?.feeds).toEqual(expect.arrayContaining(["TAP", "ILE", "TAPBench"]));
  });
});

describe("structural artifacts", () => {
  it("ships context assembler, map-ground rules, Context UI surfaces", () => {
    expect(existsSync(join(ROOT, "lib/prompt-workspace-context.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "lib/map-ground-rules.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "components/WorkspacePromptImpactPanel.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "components/WorkspaceMapAuthoringPane.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "components/WorkspaceBlockLocalContextPanel.tsx"))).toBe(true);
    expect(
      existsSync(
        join(ROOT, "supabase/migrations/20260731180000_workspace_context_map_ground.sql"),
      ),
    ).toBe(true);
    expect(existsSync(join(ROOT, "app/api/workspace/map-ground/route.ts"))).toBe(true);

    const view = read("components/WorkspaceView.tsx");
    expect(view).toContain("data-workspace-context-section");
    expect(view).toContain("WorkspaceMapAuthoringPane");
    expect(view).toContain("WorkspaceBlockLocalContextPanel");
    expect(view).toContain("WorkspaceContextPanel");
    // Prompt-impact is not Workspace map primary chrome (Context hosts materials).
    expect(view).not.toContain("WorkspacePromptImpactPanel");
    expect(view).not.toContain("How context shapes practice");
    expect(view).toContain('sectionContext');
    expect(view).toContain("mountsContextPanel");
    // Panel still ships for block-local impact if mounted elsewhere
    expect(existsSync(join(ROOT, "components/WorkspacePromptImpactPanel.tsx"))).toBe(true);

    // Production start + generate-exercise pass layout/local into the shared path.
    const start = read("app/api/workspace-tap-score/start/route.ts");
    expect(start).toContain("generateTapExercisePrompt");
    expect(start).toContain("blocks:");
    expect(start).toContain("blockLocalContext");
    expect(start).toContain("unusableCells");
    const gen = read("app/api/generate-exercise/route.ts");
    expect(gen).toContain("generateDomainExercise");
    expect(gen).toContain("loadWorkspacePromptContext");
    expect(gen).toContain("blocks:");
    expect(gen).toContain("blockLocalContext");
    expect(gen).toContain("unusableCells");

    // Primary TAPBench mint path (tapbench-links) must pass inventory/local/unusable.
    const mint = read("app/api/workspace/tapbench-links/route.ts");
    expect(mint).toContain("generateTapbenchExercise");
    expect(mint).toContain("loadWorkspacePromptContext");
    expect(mint).toContain("blocks: promptCtx.blocks");
    expect(mint).toContain("blockLocalContext: promptCtx.blockLocalContext");
    expect(mint).toContain("unusableCells: promptCtx.unusableCells");
    expect(mint).toContain("focusedBlockId: promptCtx.focusedBlockId");

    // ILE SessionView pure framer + generate-exercise body pass layers.
    const sessionView = read("components/SessionView.tsx");
    expect(sessionView).toContain("buildIleProjectChapterExercisePrompt");
    expect(sessionView).toContain("blocks: ilePromptMaterials?.blocks");
    expect(sessionView).toContain("blockLocalContext: ilePromptMaterials?.blockLocalContext");
    expect(sessionView).toContain("unusableCells: ilePromptMaterials?.unusableCells");
    expect(sessionView).toContain("notes: ilePromptMaterials?.notes");
    expect(sessionView).toContain("/api/generate-exercise");
  });
});
