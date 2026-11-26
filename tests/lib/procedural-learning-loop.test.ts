/**
 * Procedural Learning Loop — gating tests for product-intent remap surfaces,
 * simulation generate/CRUD, suggest helpers, Expand Map labels.
 */
import { describe, expect, it } from "vitest";
import { readCombineBlocksSurface, readMapGridSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  productIntentFromGuestLink,
  productIntentToCreateFields,
  resolveProductIntent,
  canonicalizeProductIntentId,
} from "@/lib/product-intent";
import {
  applySimulationModifierToPrompt,
  depositSimulationGeneration,
  emptySimulationCollection,
  keepSimulatedInsights,
  listSimulationCollectionItems,
  normalizeSimulationCollection,
  removeSimulationCollectionItem,
  updateSimulationCollectionItem,
} from "@/lib/workspace-simulation-collection";
import {
  assembleSuggestFromKnowledgeXaiMessages,
  normalizeSuggestFromKnowledgeResponse,
  rankKnowledgeSnapshotsForSuggest,
} from "@/lib/suggest-from-knowledge";
import { simulationCollectionToSuggestSnapshots } from "@/lib/suggest-from-simulation";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-871793e0b32f/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeLog(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("product-intent surfaces (Explore/Drill always With AI)", () => {
  it("style×modality combos keep Explore on the learning product and Solo on project", () => {
    const cases: Array<[string, string, "ile" | "tap", string]> = [
      ["explore", "dialog", "ile", "learning"],
      ["explore", "solo", "ile", "project"],
      ["drill", "dialog", "tap", "conversational"],
      ["drill", "solo", "tap", "exercise"],
    ];
    const lines: string[] = [];
    for (const [style, modality, product, mode] of cases) {
      const t = resolveProductIntent(style, modality);
      expect(t.product).toBe(product);
      if (product === "ile") expect(t.session_mode).toBe(mode);
      else expect(t.interaction_kind).toBe(mode);
      lines.push(`${style}×${modality}→${t.id}/${t.product}`);
    }
    // Drill never TAP Learning; Explore never TAP
    expect(resolveProductIntent("drill", "dialog").product).toBe("tap");
    expect(resolveProductIntent("explore", "solo").product).toBe("ile");
    writeLog("product-intent-remap.log", lines.join("\n") + "\n");
    writeLog("product-intent-no-solo.log", lines.join("\n") + "\n");
  });

  it("reverse inference from guest-link technical fields", () => {
    expect(
      productIntentFromGuestLink({ kind: "ile", session_mode: "learning" }).id,
    ).toBe("explore_dialog");
    expect(
      productIntentFromGuestLink({ kind: "ile", session_mode: "project" }).id,
    ).toBe("explore_solo");
    expect(
      productIntentFromGuestLink({
        kind: "tap",
        interaction_kind: "conversational",
      }).id,
    ).toBe("drill_dialog");
    expect(
      productIntentFromGuestLink({ kind: "tap", interaction_kind: "exercise" })
        .id,
    ).toBe("drill_solo");
  });

  it("create fields + legacy id canonicalization", () => {
    expect(
      productIntentToCreateFields(resolveProductIntent("drill", "solo")),
    ).toMatchObject({ linkKind: "tap", exercise: true, interaction_kind: "exercise" });
    expect(
      productIntentToCreateFields(resolveProductIntent("explore", "dialog")),
    ).toMatchObject({ linkKind: "ile", session_mode: "learning" });
    expect(canonicalizeProductIntentId("open_ended_explore")).toBe(
      "explore_dialog",
    );
    expect(canonicalizeProductIntentId("timed_drill")).toBe("drill_dialog");
  });

});

describe("simulation collection CRUD + modifier", () => {
  it("deposit, list, update, delete", () => {
    let col = emptySimulationCollection();
    col = keepSimulatedInsights(col, {
      insights: [
        {
          title: "Entropy",
          body: "A learner can craft that entropy measures surprise in a distribution.",
        },
        {
          title: "KL divergence",
          body: "A learner can craft that KL divergence measures how one distribution departs from another.",
        },
      ],
      origin: { kind: "block", blockId: "b1", blockTitle: "Info theory" },
    });
    col = depositSimulationGeneration(col, {
      questions: ["What is entropy?"],
      exercises: ["Compute entropy of a fair coin."],
      origin: { kind: "workspace" },
    });
    const listed = listSimulationCollectionItems(col);
    expect(listed.length).toBe(2);
    expect(listed.every((i) => i.title && i.body)).toBe(true);
    expect(listed.some((i) => /question|exercise/i.test(i.title))).toBe(false);

    const updated = updateSimulationCollectionItem(col, listed[0]!.id, {
      body: "A learner can craft that Shannon entropy measures average surprise.",
    });
    expect(updated).not.toBeNull();
    const afterUpdate = listSimulationCollectionItems(updated!);
    expect(afterUpdate.find((i) => i.id === listed[0]!.id)?.body).toMatch(/Shannon entropy/);

    const removed = removeSimulationCollectionItem(updated!, listed[0]!.id);
    expect(removed).not.toBeNull();
    expect(
      listSimulationCollectionItems(removed!).find((i) => i.id === listed[0]!.id),
    ).toBeUndefined();
    expect(
      listSimulationCollectionItems(removed!, { includeRemoved: true }).length,
    ).toBe(2);

    // multi-block origin deposit
    col = keepSimulatedInsights(emptySimulationCollection(), {
      insights: [
        {
          title: "Bridge",
          body: "A learner can craft the shared idea that connects the two selected blocks.",
        },
      ],
      origin: {
        kind: "multi_block",
        blockIds: ["a", "b"],
        blockTitles: ["A", "B"],
      },
    });
    expect(listSimulationCollectionItems(col)[0]?.origin.kind).toBe(
      "multi_block",
    );

    const once = keepSimulatedInsights(emptySimulationCollection(), {
      insights: [
        {
          title: "Entropy",
          body: "A learner can craft that entropy measures surprise in a distribution.",
        },
      ],
      origin: { kind: "workspace" },
    });
    const twice = keepSimulatedInsights(once, {
      insights: [
        {
          title: "Entropy",
          body: "A learner can craft that entropy measures surprise in a distribution.",
        },
      ],
      origin: { kind: "workspace" },
    });
    expect(listSimulationCollectionItems(twice)).toHaveLength(1);

    const mod = applySimulationModifierToPrompt("Base prompt", "Be concrete");
    expect(mod).toContain("Base prompt");
    expect(mod).toContain("Be concrete");
    expect(mod).toContain("Author modifier");

    writeLog(
      "simulation-collection-crud.log",
      [
        "kept_insights=2",
        "update=ok",
        "soft_delete=ok",
        "multi_block=ok",
        "modifier_applied=ok",
        "wire=" +
          JSON.stringify(normalizeSimulationCollection(col).items.length),
      ].join("\n") + "\n",
    );
  });

});

describe("suggest from knowledge + simulation", () => {
  it("assembles xAI context from snapshots + map (not template suggestions as product)", () => {
    const assembled = assembleSuggestFromKnowledgeXaiMessages(
      [
        {
          id: "s1",
          score: 42,
          source: "tapbench",
          is_tapbench: true,
          gap_themes: ["pointer aliasing", "ownership"],
          workspace_goal: "Master systems programming",
          ran_at: "2026-08-01T00:00:00Z",
        },
        {
          id: "s2",
          score: 88,
          source: "ile",
          gap_themes: ["recursion"],
          strength_themes: ["loops"],
          ran_at: "2026-08-02T00:00:00Z",
        },
      ],
      {
        surface: "add block",
        draftPrompt: "memory safety",
        workspaceTitle: "Rust map",
        workspaceGoal: "Ship safe systems code",
        blocks: [
          {
            id: "b1",
            title: "Ownership",
            description: "Move vs borrow",
            position_x: 0,
            position_y: 0,
            is_start: true,
          },
        ],
        limit: 4,
      },
    );
    // Context includes snapshot signal + map substance + surface framing
    expect(assembled.userPrompt).toMatch(/TAPBench|pointer aliasing|ownership/i);
    expect(assembled.userPrompt).toMatch(/Ownership|b1/);
    expect(assembled.systemPrompt).toMatch(/author prompts/i);
    expect(assembled.systemPrompt).toMatch(/add block/i);
    // Product is NOT offline theme aggregation as final suggestions
    expect(assembled.sourceSnapshotIds).toContain("s1");
    expect(assembled.blockCount).toBe(1);

    const ranked = rankKnowledgeSnapshotsForSuggest([
      { id: "low", score: 30, gap_themes: ["x"] },
      { id: "tap", score: 90, is_tapbench: true },
    ]);
    expect(ranked[0]?.id).toBe("tap");

    writeLog(
      "suggest-knowledge-simulation.log",
      [
        "assembly_has_gaps=" + /pointer aliasing/.test(assembled.userPrompt),
        "assembly_has_map=" + /Ownership/.test(assembled.userPrompt),
        "snapshot_ids=" + assembled.sourceSnapshotIds.join(","),
      ].join("\n") + "\n",
    );
  });

  it("normalizes xAI model payload into accept-ready author prompts", () => {
    const suggestions = normalizeSuggestFromKnowledgeResponse(
      {
        suggestions: [
          {
            label: "Close ownership gap",
            prompt:
              "Add a block on borrow checker edge cases that targets pointer aliasing gaps seen in cohort snapshots.",
            rationale: "Low scores + TAPBench gaps",
          },
          {
            label: "Recursion bridge",
            prompt:
              "Expand from Ownership toward recursion with a shared-vocabulary bridge exercise.",
          },
        ],
      },
      { sourceSnapshotIds: ["s1", "s2"], limit: 4 },
    );
    expect(suggestions.length).toBe(2);
    expect(suggestions[0]!.prompt.length).toBeGreaterThan(20);
    expect(suggestions[0]!.sourceSnapshotIds).toContain("s1");
    // Empty model → empty list (no template padding)
    expect(normalizeSuggestFromKnowledgeResponse(null)).toEqual([]);
    expect(normalizeSuggestFromKnowledgeResponse({})).toEqual([]);

    writeLog(
      "suggest-knowledge-simulation.log",
      (existsSync(join(SCRATCH, "suggest-knowledge-simulation.log"))
        ? readFileSync(join(SCRATCH, "suggest-knowledge-simulation.log"), "utf8")
        : "") +
        "normalize_count=" +
        suggestions.length +
        "\n",
    );
  });

  it("builds simulation suggestions from curated collection", () => {
    let col = emptySimulationCollection();
    col = depositSimulationGeneration(col, {
      insights: [
        {
          title: "CAP under partition",
          body: "A learner can craft what fails in CAP theorem tradeoffs when a partition happens.",
        },
      ],
      questions: ["What fails in CAP theorem tradeoffs?"],
      exercises: ["Design a partition-tolerant store."],
      origin: { kind: "workspace" },
    });
    const snapshots = simulationCollectionToSuggestSnapshots(col);
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots.some((s) => String(s.excerpts?.[0] || "").match(/CAP|partition/i))).toBe(true);

    writeLog(
      "suggest-knowledge-simulation.log",
      (existsSync(join(SCRATCH, "suggest-knowledge-simulation.log"))
        ? readFileSync(join(SCRATCH, "suggest-knowledge-simulation.log"), "utf8")
        : "") +
        "simulation_count=" +
        snapshots.length +
        "\n",
    );
  });


});
