/**
 * Exercise / dialog prompt quality: no out-loud stage directions; domain substance
 * from shared workspace context (description, notes, files).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildExercisePromptText,
  resolveExercisePromptAfterIntro,
} from "@/lib/exercise-tap";
import { buildIleProjectChapterExercisePrompt } from "@/lib/ile-mode";
import {
  assemblePromptWorkspaceContext,
  containsOutLoudStageDirection,
  formatPromptWorkspaceContextBlock,
} from "@/lib/prompt-workspace-context";
import {
  buildTapOpeningQuestionFallback,
  buildTapStartingTopicsFallback,
  type TapScoreBrief,
} from "@/lib/tap-score";
import { buildTapbenchExercise } from "@/lib/pow-api/tapbench";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.EXERCISE_PROMPT_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-64f1f256bfdf/implementer";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const richBlock = {
  blockTitle: "Data model & query performance",
  blockDescription:
    "Explain index choices, N+1 traps, and read-path caching for multi-tenant Postgres.",
  workspaceTitle: "SaaS tech team demo",
  workspaceGoal: "Ship reliable multi-tenant APIs with predictable latency.",
  notes: "Prefer composite indexes leading with tenant_id.",
  files: [
    {
      name: "query-checklist.md",
      excerpt: "Always filter by tenant_id. Batch child loads with ANY($1).",
    },
  ],
};

describe("assemblePromptWorkspaceContext", () => {
  it("includes goal, notes, file names, and excerpts when provided", () => {
    const ctx = assemblePromptWorkspaceContext(richBlock);
    expect(ctx.hasDomainSubstance).toBe(true);
    expect(ctx.fileNames).toContain("query-checklist.md");
    expect(ctx.fileExcerpts[0]?.excerpt).toMatch(/tenant_id/i);
    expect(ctx.contextBlock).toMatch(/Workspace goal|Block description|File excerpts/i);
    expect(ctx.contextBlock).toContain("query-checklist.md");
  });

  it("marks thin title-only input as lacking domain substance", () => {
    const ctx = assemblePromptWorkspaceContext({
      workspaceTitle: "Algo",
      blockTitle: "Sorts",
    });
    expect(ctx.hasDomainSubstance).toBe(false);
    expect(ctx.fileNames).toEqual([]);
  });
});

describe("TAP Exercise framing quality", () => {
  it("rich description + files → domain substance, no out-loud stage directions", () => {
    const text = buildExercisePromptText(richBlock);
    expect(text.startsWith("Exercise:")).toBe(true);
    expect(containsOutLoudStageDirection(text)).toBe(false);
    expect(text.toLowerCase()).not.toMatch(/out loud|think aloud|on your own/);
    expect(text).toMatch(/index|N\+1|caching|tenant|Postgres/i);
    expect(text).toMatch(/query-checklist|tenant_id|multi-tenant/i);
    try {
      writeFileSync(join(SCRATCH, "sample-exercise-prompt.txt"), text, "utf8");
    } catch {
      /* scratch optional outside harness */
    }
  });

  it("title-only thin input → no legacy Work through out loud template", () => {
    const text = buildExercisePromptText({
      blockTitle: "Binary search",
      workspaceTitle: "Algorithms",
    });
    expect(containsOutLoudStageDirection(text)).toBe(false);
    expect(text).not.toMatch(/Work through "Binary search" out loud/i);
    expect(text).not.toMatch(/Think aloud through/i);
    expect(text).toContain("Binary search");
    expect(text.startsWith("Exercise:")).toBe(true);
  });

  it("resolveExercisePromptAfterIntro strips stage directions from topic cards", () => {
    const text = resolveExercisePromptAfterIntro({
      topicOpeningQuestion: "Explain indexes out loud for multi-tenant tables",
      blockTitle: "Query performance",
      blockDescription: "Composite indexes and N+1.",
    });
    expect(containsOutLoudStageDirection(text)).toBe(false);
    expect(text).toMatch(/index|N\+1|multi-tenant|Composite/i);
  });

  it("legacy Work through out loud + rich blockDescription yields description substance (not title wrapper)", () => {
    const legacy =
      'Exercise: Work through "Heaps" out loud on your own. Explain your reasoning as you go.';
    const text = resolveExercisePromptAfterIntro({
      serverOpeningQuestion: legacy,
      blockTitle: "Heaps",
      blockDescription:
        "Binary heap insert and extract-min with O(log n) bubble-up and sift-down.",
      notes: "Compare with binary search tree height costs.",
      files: [
        {
          name: "heap-notes.md",
          excerpt: "sift-down swaps with the smaller child until heap property holds.",
        },
      ],
    });
    expect(containsOutLoudStageDirection(text)).toBe(false);
    expect(text).not.toMatch(/Work through "Heaps"/i);
    // Domain tokens from description / notes / file excerpt — not title-only.
    expect(text).toMatch(/extract-min|sift-down|bubble-up|O\(log n\)|heap property|binary search tree/i);
    expect(text).toMatch(/heap-notes|sift-down|materials/i);
    try {
      const thin = buildExercisePromptText({
        blockTitle: "Binary search",
        workspaceTitle: "Algorithms",
      });
      writeFileSync(
        join(SCRATCH, "sample-exercise-prompt.txt"),
        [
          "=== RICH: legacy out-loud server + blockDescription/files ===",
          text,
          "",
          "=== THIN: title-only ===",
          thin,
        ].join("\n"),
        "utf8",
      );
    } catch {
      /* optional */
    }
  });
});

describe("ILE Project exercise framing quality", () => {
  it("chapter description becomes substantive exercise without out-loud directions", () => {
    const prompt = buildIleProjectChapterExercisePrompt({
      chapterDescription:
        "Design an auth flow with short-lived access tokens and rotating refresh tokens for multi-tenant SaaS.",
      blockTitle: "Security",
    });
    expect(prompt).toMatch(/auth flow|refresh tokens|multi-tenant/i);
    expect(containsOutLoudStageDirection(prompt)).toBe(false);
    expect(prompt).not.toMatch(/Work through "Security" out loud/i);
  });
});

describe("TAP dialog opening / topic fallbacks", () => {
  const brief: TapScoreBrief = {
    plan: {
      id: "ws1",
      title: "SaaS platform",
      root_topic: "multi-tenant APIs",
      description: "Build reliable tenant-isolated services.",
      notes: "Focus on query plans and cache keys.",
      workspace_goal: "Predictable p95 latency under multi-tenant load.",
    },
    nodes: [
      {
        id: "b1",
        title: "Data model & query performance",
        description: "Indexes, N+1, caching for multi-tenant Postgres.",
        status: null,
      },
    ],
    sessions: [],
    files: [{ name: "schema.sql" }, { name: "caching-notes.md" }],
  };

  it("opening fallback is domain-grounded and has no stage directions", () => {
    const q = buildTapOpeningQuestionFallback(brief);
    expect(containsOutLoudStageDirection(q)).toBe(false);
    expect(q.toLowerCase()).not.toMatch(/out loud|think aloud/);
    expect(q).toMatch(/Data model|index|N\+1|caching|Postgres|query/i);
  });

  it("starting topics use description/file cues without out loud", () => {
    const topics = buildTapStartingTopicsFallback(brief);
    expect(topics).toHaveLength(3);
    for (const t of topics) {
      expect(containsOutLoudStageDirection(t.openingQuestion)).toBe(false);
      expect(t.openingQuestion.toLowerCase()).not.toMatch(/out loud/);
    }
  });
});

describe("TAPBench exercise uses improved framer", () => {
  it("no out-loud fallback when context is thin", () => {
    const ex = buildTapbenchExercise({
      workspaceTitle: "Demo",
      blockTitle: "Caching",
      blockDescription: "Redis invalidation per tenant.",
    });
    expect(containsOutLoudStageDirection(ex)).toBe(false);
    expect(ex).toMatch(/Redis|tenant|Caching/i);
  });
});

describe("wiring: richer context on start + brief + prompt surfaces", () => {
  it("start route passes files/notes/goal into buildExercisePromptText", () => {
    const start = read("app/api/workspace-tap-score/start/route.ts");
    expect(start).toContain("buildExercisePromptText");
    expect(start).toContain("brief.files");
    expect(start).toContain("workspaceGoal");
    expect(start).toContain("notes");
  });

  it("tap-score brief loads workspace_files and injects shared context block", () => {
    const tap = read("lib/tap-score.ts");
    expect(tap).toContain("workspace_files");
    expect(tap).toContain("formatPromptWorkspaceContextBlock");
    expect(tap).toContain("files:");
  });

  it("prompt-kernel opening/topics require context grounding + no stage directions", () => {
    const tapSurface = read("lib/prompt-kernel/surfaces/tap.ts");
    expect(tapSurface).toMatch(/file names|excerpts|workspace\/block context/i);
    expect(tapSurface).toMatch(/out loud/i);
  });

  it("shared assembler module ships", () => {
    expect(existsSync(join(ROOT, "lib/prompt-workspace-context.ts"))).toBe(true);
    expect(formatPromptWorkspaceContextBlock(richBlock)).toContain("query-checklist.md");
  });
});
