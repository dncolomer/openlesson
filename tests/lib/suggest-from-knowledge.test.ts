/**
 * Suggest from Knowledge: xAI context assembly + response normalize.
 * Snapshots/map are context; product is author prompts for map generation.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { POST as suggestFromKnowledgePost } from "@/app/api/workspace/suggest-from-knowledge/route";
import {
  assembleSuggestFromKnowledgeXaiMessages,
  buildSuggestFromKnowledge,
  extractThemesFromEvalReport,
  mapEvalRunHistoryRowToSuggestInput,
  normalizeSuggestFromKnowledgeResponse,
  rankKnowledgeSnapshotsForSuggest,
  serializeKnowledgeMapBlocksForContext,
  serializeKnowledgeSnapshotsForContext,
  surfaceFramingForSuggestKnowledge,
} from "@/lib/suggest-from-knowledge";
import { runSuggestFromKnowledgeModel } from "@/lib/run-suggest-from-knowledge-model";
import {
  emptySimulationCollection,
  depositSimulationGeneration,
} from "@/lib/workspace-simulation-collection";
import { simulationCollectionToSuggestSnapshots } from "@/lib/suggest-from-simulation";
import { assembleSuggestFromContextXaiMessages } from "@/lib/suggest-from-context";
import { pickNextDistinctAuthorPrompt } from "@/lib/suggest-next-prompt";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-605d3ab12c6a/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeLog(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

const fixtureSnapshots = [
  {
    id: "snap-tap-1",
    score: 38,
    source: "tapbench",
    is_tapbench: true as const,
    gap_themes: ["borrow checker", "lifetime annotations"],
    strength_themes: ["structs"],
    workspace_goal: "Ship safe systems code",
    block_title: "Ownership",
    ran_at: "2026-08-01T12:00:00Z",
  },
  {
    id: "snap-ile-2",
    score: 72,
    source: "ile",
    gap_themes: ["async runtimes"],
    ran_at: "2026-08-02T12:00:00Z",
  },
];

const fixtureBlocks = [
  {
    id: "b-own",
    title: "Ownership",
    description: "Move vs borrow",
    position_x: 0,
    position_y: 0,
    is_start: true,
    next_block_ids: ["b-life"],
  },
  {
    id: "b-life",
    title: "Lifetimes",
    description: "Annotation basics",
    position_x: 2,
    position_y: 0,
  },
];

describe("context assembly (shipped)", () => {
  it("includes snapshot/report signal, map blocks, surface framing — not ranked themes as final product", () => {
    const assembled = assembleSuggestFromKnowledgeXaiMessages(fixtureSnapshots, {
      surface: "bridge blocks",
      draftPrompt: "link ownership to lifetimes",
      workspaceTitle: "Rust systems",
      workspaceGoal: "Ship safe systems code",
      blocks: fixtureBlocks,
      limit: 3,
    });

    expect(assembled.systemPrompt).toMatch(/author prompts/i);
    expect(assembled.systemPrompt).toMatch(/Do NOT list or recommend snapshot/i);
    expect(assembled.systemPrompt).toMatch(/bridge/i);
    expect(surfaceFramingForSuggestKnowledge("expand map suggest spot")).toMatch(
      /Expand Map|empty-cell/i,
    );

    expect(assembled.userPrompt).toMatch(/borrow checker|lifetime/i);
    expect(assembled.userPrompt).toMatch(/TAPBench/);
    expect(assembled.userPrompt).toMatch(/Ownership|Lifetimes|b-own/);
    expect(assembled.userPrompt).toMatch(/@\(0,0\)|@\(2,0\)/);
    expect(assembled.userPrompt).toMatch(/link ownership to lifetimes/i);
    expect(assembled.sourceSnapshotIds).toEqual(
      expect.arrayContaining(["snap-tap-1", "snap-ile-2"]),
    );
    expect(assembled.blockCount).toBe(2);
    expect(assembled.snapshotCount).toBeGreaterThan(0);

    // Pure offline builder must not produce template product
    expect(buildSuggestFromKnowledge(fixtureSnapshots, { surface: "add" })).toEqual(
      [],
    );

    const snapSer = serializeKnowledgeSnapshotsForContext(fixtureSnapshots);
    expect(snapSer.text).toMatch(/gaps:/);
    const mapSer = serializeKnowledgeMapBlocksForContext(fixtureBlocks);
    expect(mapSer.count).toBe(2);

    writeLog(
      "suggest-knowledge-context-assembly.log",
      [
        "system_has_author_prompts=" +
          /author prompts/i.test(assembled.systemPrompt),
        "user_has_gaps=" + /borrow checker/.test(assembled.userPrompt),
        "user_has_map=" + /Ownership/.test(assembled.userPrompt),
        "user_has_geometry=" + /@\(0,0\)/.test(assembled.userPrompt),
        "surface_bridge=" + /bridge/i.test(assembled.systemPrompt),
        "offline_empty=" +
          String(buildSuggestFromKnowledge(fixtureSnapshots).length === 0),
        "source_ids=" + assembled.sourceSnapshotIds.join(","),
      ].join("\n") + "\n",
    );
  });

  it("ranks TAPBench / gap-heavy rows first for context window", () => {
    const ranked = rankKnowledgeSnapshotsForSuggest([
      { id: "high", score: 95, gap_themes: [] },
      { id: "tap", score: 50, is_tapbench: true, gap_themes: ["a"] },
      { id: "gap", score: 40, gap_themes: ["x", "y"] },
    ]);
    expect(ranked[0]?.id).toBe("tap");
  });
});

describe("response normalize (shipped)", () => {
  it("fixture model JSON → non-empty suggestions[].prompt; empty → []", () => {
    const ok = normalizeSuggestFromKnowledgeResponse(
      {
        suggestions: [
          {
            label: "Lifetime expand",
            prompt:
              "Expand Ownership with a three-slot path: move semantics → partial moves → fix patterns.",
            rationale: "Cohort gaps on borrow checker",
          },
          "Plain string prompt about async runtimes for empty cells near Lifetimes.",
        ],
      },
      { sourceSnapshotIds: ["snap-tap-1"], limit: 4 },
    );
    expect(ok.length).toBe(2);
    expect(ok[0]!.prompt).toMatch(/Ownership|move semantics/i);
    expect(ok[0]!.sourceSnapshotIds).toContain("snap-tap-1");
    expect(ok[1]!.prompt).toMatch(/async runtimes/i);

    expect(normalizeSuggestFromKnowledgeResponse(null)).toEqual([]);
    expect(normalizeSuggestFromKnowledgeResponse({ suggestions: [] })).toEqual(
      [],
    );
    expect(
      normalizeSuggestFromKnowledgeResponse({ suggestions: [{ prompt: "x" }] }),
    ).toEqual([]); // too short

    writeLog(
      "suggest-knowledge-normalize.log",
      [
        "ok_count=" + ok.length,
        "first_prompt_len=" + ok[0]!.prompt.length,
        "empty_null=0",
        "no_template_pad=true",
      ].join("\n") + "\n",
    );
  });
});

describe("VerticalScoreReport → context (shipped mapper)", () => {
  it("maps realistic gap_analysis/strengths/growth_areas into assembled userPrompt", () => {
    // Shape matches VerticalScoreReport fields used by eval_run_history.report
    const report = {
      vertical: "verification",
      score: 41,
      workspace_goal: "Validate SCRUM related Skills",
      strengths: ["Facilitates clear daily standups", "Documents decisions"],
      growth_areas: ["Quantify tradeoffs before sprint commit"],
      summary:
        "Learner shows solid facilitation habits but under-specifies tradeoff analysis under time pressure.",
      gap_analysis: {
        gaps: [
          {
            title: "Missing acceptance criteria on backlog items",
            proof_of_work: "No DoR checklist in submitted board export",
            severity: "high",
            suggested_repair: "Write 3 measurable ACs per story",
          },
          {
            title: "Weak estimation calibration",
            proof_of_work: "Story points drift >2x across sprints",
            severity: "medium",
          },
        ],
        next_steps: {
          directions: ["Improve estimation discipline"],
          events: ["review_last_sprint_velocity"],
        },
      },
      suggestions: ["Practice planning poker with fixed reference stories"],
      confidence: "developing",
      ghc_score: 50,
      ghc_confidence: "medium",
      marker_scores: [],
    };

    const themes = extractThemesFromEvalReport(report);
    expect(themes.gap_themes).toEqual(
      expect.arrayContaining([
        "Missing acceptance criteria on backlog items",
        "Weak estimation calibration",
        "Quantify tradeoffs before sprint commit",
      ]),
    );
    expect(themes.strength_themes).toEqual(
      expect.arrayContaining(["Facilitates clear daily standups"]),
    );
    expect(themes.excerpts.some((e) => /facilitation|tradeoff/i.test(e))).toBe(
      true,
    );
    // Must NOT rely on non-existent gap_themes field on the report
    expect((report as { gap_themes?: unknown }).gap_themes).toBeUndefined();

    const row = mapEvalRunHistoryRowToSuggestInput({
      id: "hist-1",
      ran_at: "2026-08-03T10:00:00Z",
      score: 41,
      workspace_goal: "Validate SCRUM related Skills",
      vertical: "verification",
      source: "tap",
      subject_user_id: "user-abc",
      report,
    });
    expect(row.gap_themes).toEqual(
      expect.arrayContaining(["Missing acceptance criteria on backlog items"]),
    );
    expect(row.strength_themes?.length).toBeGreaterThan(0);
    expect(row.is_tapbench).toBe(false);

    const assembled = assembleSuggestFromKnowledgeXaiMessages([row], {
      surface: "expand block",
      workspaceTitle: "SCRUM map",
      blocks: [
        {
          id: "b-scrum",
          title: "Sprint planning",
          position_x: 1,
          position_y: 2,
        },
      ],
      limit: 3,
    });
    // Real report substance must reach the xAI user prompt
    expect(assembled.userPrompt).toMatch(/acceptance criteria|estimation/i);
    expect(assembled.userPrompt).toMatch(/standups|Documents decisions/i);
    expect(assembled.userPrompt).toMatch(/Sprint planning/);
    expect(assembled.userPrompt).toMatch(/gaps:/);

    writeLog(
      "suggest-knowledge-context-assembly.log",
      (existsSync(join(SCRATCH, "suggest-knowledge-context-assembly.log"))
        ? readFileSync(join(SCRATCH, "suggest-knowledge-context-assembly.log"), "utf8")
        : "") +
        [
          "vscore_gap_title=true",
          "vscore_strength=true",
          "vscore_in_user_prompt=" +
            /acceptance criteria/i.test(assembled.userPrompt),
          "mapper_not_gap_themes_field=true",
        ].join("\n") +
        "\n",
    );
  });
});

describe("structural: xAI route + UI control", () => {
  it("route loads history + blocks, calls shared model helper, uses report mapper", () => {
    const route = read("app/api/workspace/suggest-from-knowledge/route.ts");
    const sim = read("app/api/workspace/suggest-from-simulation/route.ts");
    const helper = read("lib/run-suggest-from-knowledge-model.ts");
    expect(route).toContain("runSuggestFromKnowledgeModel");
    expect(sim).toContain("runSuggestFromKnowledgeModel");
    expect(helper).toContain("callXaiJSON");
    expect(helper).toContain("systemMessage");
    expect(helper).toContain("userMessage");
    expect(route).toContain("listEvalRunHistory");
    expect(route).toContain('from("blocks")');
    expect(route).toContain("assembleSuggestFromKnowledgeXaiMessages");
    expect(route).toContain("normalizeSuggestFromKnowledgeResponse");
    expect(route).toContain("mapEvalRunHistoryRowToSuggestInput");
    expect(route).toContain("report: r.report");
    expect(route).toContain("suggestions");
    expect(route).not.toContain("buildSuggestFromKnowledge(");
    expect(route).not.toContain("callXaiJSON");
    expect(sim).not.toContain("callXaiJSON");
    // Old wrong fields must not be the primary extract path
    expect(route).not.toMatch(/report\?\.gap_themes/);
    expect(route).not.toMatch(/report\?\.themes\?\.gaps/);

    const alt = read("components/WorkspacePromptContextAlternatives.tsx");
    expect(alt).toContain("data-suggest-from-knowledge");
    expect(alt).toContain("/api/workspace/suggest-from-knowledge");
    expect(alt).toContain("onAccept(prompt)");
    expect(alt).toContain("onAdhocChange(prompt)");
    expect(alt).not.toContain("data-prompt-context-suggestions");
    expect(typeof suggestFromKnowledgePost).toBe("function");

    writeLog(
      "suggest-knowledge-xai-route.log",
      [
        "runSuggestFromKnowledgeModel=true",
        "listEvalRunHistory=true",
        "blocks_select=true",
        "assemble=true",
        "normalize=true",
        "mapEvalRunHistoryRowToSuggestInput=true",
        "report_r_report=true",
        "no_offline_builder=true",
        "ui_accept_prompt=true",
      ].join("\n") + "\n",
    );
  });
});

describe("shared suggest model + simulation corpus adapter", () => {
  it("empty corpus stays empty; non-empty is not stubbed; both routes share the helper", async () => {
    expect(simulationCollectionToSuggestSnapshots(emptySimulationCollection())).toEqual(
      [],
    );

    let col = emptySimulationCollection();
    col = depositSimulationGeneration(col, {
      questions: ["What fails in CAP theorem tradeoffs?"],
      exercises: ["Design a partition-tolerant store."],
      origin: { kind: "workspace" },
    });
    const snapshots = simulationCollectionToSuggestSnapshots(col);
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots.some((s) => String(s.excerpts?.[0] || "").match(/CAP|partition/i))).toBe(
      true,
    );

    const recovered = await runSuggestFromKnowledgeModel(
      { systemPrompt: "sys", userPrompt: "user" },
      {
        callModel: async () => ({
          success: false,
          rawContent: JSON.stringify({
            suggestions: [
              {
                id: "s1",
                prompt: "Write a partition-tolerant store design prompt",
                label: "Partition store",
              },
            ],
          }),
        }),
      },
    );
    expect(recovered.ok).toBe(true);
    if (recovered.ok) {
      expect(recovered.data.suggestions?.[0]?.prompt).toMatch(/partition/i);
    }

    const failed = await runSuggestFromKnowledgeModel(
      { systemPrompt: "sys", userPrompt: "user" },
      {
        callModel: async () => ({ success: false, error: "xAI down" }),
      },
    );
    expect(failed).toEqual({ ok: false, error: "xAI down" });

    writeLog(
      "suggest-tests.log",
      [
        `emptySnapshots=${simulationCollectionToSuggestSnapshots(emptySimulationCollection()).length}`,
        `nonEmptySnapshots=${snapshots.length}`,
        `recoveredOk=${recovered.ok}`,
        `failed=${failed.ok}`,
        "both routes call runSuggestFromKnowledgeModel",
      ].join("\n"),
    );
  });
});

describe("suggest from context corpus + one prompt", () => {
  it("puts notes, file name, and external resource in model messages and cycles one distinct prompt", () => {
    const notes = "Cohort struggles with partial moves in the ownership chapter.";
    const fileName = "ownership-notes.md";
    const excerpt = "Partial moves leave the rest of the struct valid.";
    const resource = {
      title: "Rust Book Ownership",
      url: "https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html",
      description: "Official chapter on ownership and moves.",
    };

    const assembled = assembleSuggestFromContextXaiMessages(
      {
        notes,
        files: [{ name: fileName, mime_type: "text/markdown", excerpt }],
        externalResources: [resource],
      },
      { surface: "add block", workspaceTitle: "Rust systems", limit: 3 },
    );

    expect(assembled.empty).toBe(false);
    expect(assembled.userPrompt).toContain(notes);
    expect(assembled.userPrompt).toContain(fileName);
    expect(assembled.userPrompt).toContain("text/markdown");
    expect(assembled.userPrompt).toContain(excerpt);
    expect(assembled.userPrompt).toContain(resource.title);
    expect(assembled.userPrompt).toContain(resource.url);
    expect(assembled.userPrompt).toContain(resource.description);
    expect(assembled.userPrompt).toContain("## Workspace Context materials");
    expect(assembled.systemPrompt).toMatch(/workspace Context materials/i);
    expect(assembled.systemPrompt).toMatch(
      /do not use eval snapshots or the simulation collection/i,
    );
    expect(assembled.userPrompt).not.toContain("Learner snapshot");
    expect(assembled.userPrompt).not.toContain("snap-tap-1");
    expect(assembled.userPrompt).not.toMatch(/simulation collection/i);
    expect(assembled.sourceSnapshotIds).toEqual([]);
    expect(assembled.snapshotCount).toBe(0);

    const empty = assembleSuggestFromContextXaiMessages(
      {
        notes: "   ",
        files: [{ name: "  ", excerpt: "" }, { file_name: "" }],
        externalResources: [{ title: "", url: "", description: "  " }],
      },
      {
        workspaceTitle: "Rust systems",
        workspaceGoal: "Ship safe systems code",
        draftPrompt: "keep this draft out of an empty corpus",
      },
    );
    expect(empty.empty).toBe(true);
    expect(empty.userPrompt).toBe("");
    expect(empty.systemPrompt).toBe("");
    expect(pickNextDistinctAuthorPrompt({ suggestions: [] }, "")).toBeNull();

    const payload = {
      suggestions: [
        {
          label: "Partial moves",
          prompt:
            "Add a block on partial moves that keeps the rest of a struct valid after a move.",
        },
        {
          label: "Ownership chapter",
          prompt:
            "Add a block that walks the Rust Book ownership chapter from moves to borrows.",
        },
        {
          label: "Stored notes",
          prompt:
            "Add a block that turns the ownership notes excerpt into a three-step exercise.",
        },
      ],
    };
    const current = "";
    const first = pickNextDistinctAuthorPrompt(payload, current);
    expect(first).toBe(payload.suggestions[0]!.prompt);
    const second = pickNextDistinctAuthorPrompt(payload, first);
    expect(second).toBe(payload.suggestions[1]!.prompt);
    expect(second).not.toBe(first);
    const third = pickNextDistinctAuthorPrompt(payload, second);
    expect(third).toBe(payload.suggestions[2]!.prompt);
    expect(third).not.toBe(second);
    const exhausted = pickNextDistinctAuthorPrompt(
      { suggestions: [{ prompt: first }] },
      first,
    );
    expect(exhausted).toBeNull();

    const knowledge = normalizeSuggestFromKnowledgeResponse(
      {
        suggestions: [
          {
            prompt:
              "Expand Ownership with a three-slot path: move semantics, partial moves, and fix patterns.",
          },
        ],
      },
      { sourceSnapshotIds: ["snap-tap-1"], limit: 4 },
    );
    expect(knowledge).toHaveLength(1);
    expect(knowledge[0]!.prompt).toMatch(/Ownership/);
    expect(knowledge[0]!.sourceSnapshotIds).toContain("snap-tap-1");

    expect(simulationCollectionToSuggestSnapshots(emptySimulationCollection())).toEqual(
      [],
    );
    let collection = emptySimulationCollection();
    collection = depositSimulationGeneration(collection, {
      questions: ["What fails in CAP theorem tradeoffs?"],
      exercises: ["Design a partition-tolerant store."],
      origin: { kind: "workspace" },
    });
    const simulationSnapshots = simulationCollectionToSuggestSnapshots(collection);
    expect(simulationSnapshots.length).toBeGreaterThan(0);
    const simulationPrompts = normalizeSuggestFromKnowledgeResponse({
      prompts: simulationSnapshots.map(
        (row) => `Author a practice prompt grounded in: ${row.excerpts?.[0] || ""}`,
      ),
    });
    expect(simulationPrompts.length).toBe(simulationSnapshots.length);
    expect(simulationPrompts.some((row) => /CAP|partition/i.test(row.prompt))).toBe(
      true,
    );

    const contextRoute = read("app/api/workspace/suggest-from-context/route.ts");
    expect(contextRoute).toContain("runSuggestFromKnowledgeModel");
    expect(contextRoute).not.toContain("buildSuggestFromContext(");
    expect(contextRoute.indexOf("assembled.empty")).toBeLessThan(
      contextRoute.indexOf("await runSuggestFromKnowledgeModel"),
    );

    writeLog(
      "suggest-context-one-prompt.log",
      [
        `notes_in_user=${assembled.userPrompt.includes(notes)}`,
        `file_in_user=${assembled.userPrompt.includes(fileName)}`,
        `mime_in_user=${assembled.userPrompt.includes("text/markdown")}`,
        `excerpt_in_user=${assembled.userPrompt.includes(excerpt)}`,
        `resource_title_in_user=${assembled.userPrompt.includes(resource.title)}`,
        `resource_url_in_user=${assembled.userPrompt.includes(resource.url)}`,
        `resource_desc_in_user=${assembled.userPrompt.includes(resource.description)}`,
        `user_has_learner_snapshot_section=${assembled.userPrompt.includes("Learner snapshot")}`,
        `user_has_simulation_collection=${/simulation collection/i.test(assembled.userPrompt)}`,
        `source_snapshot_ids=${assembled.sourceSnapshotIds.join(",") || "(none)"}`,
        `empty=${empty.empty}`,
        `empty_user_len=${empty.userPrompt.length}`,
        `empty_system_len=${empty.systemPrompt.length}`,
        `empty_payload_prompt=${String(pickNextDistinctAuthorPrompt({ suggestions: [] }, ""))}`,
        `first_prompt=${first}`,
        `second_prompt=${second}`,
        `third_prompt=${third}`,
        `second_differs=${second !== first}`,
        `exhausted=${String(exhausted)}`,
        `knowledge_prompt=${knowledge[0]!.prompt}`,
        `simulation_empty=${simulationCollectionToSuggestSnapshots(emptySimulationCollection()).length}`,
        `simulation_prompt=${simulationPrompts.find((row) => /CAP|partition/i.test(row.prompt))?.prompt}`,
      ].join("\n") + "\n",
    );
  });
});

