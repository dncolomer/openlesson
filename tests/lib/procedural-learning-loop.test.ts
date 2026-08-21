/**
 * Procedural Learning Loop — gating tests for product-intent remap surfaces,
 * simulation generate/CRUD, suggest helpers, Expand Map labels.
 */
import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  productIntentFromGuestLink,
  productIntentToCreateFields,
  resolveProductIntent,
  canonicalizeProductIntentId,
} from "@/lib/product-intent";
import {
  normalizeSimulationPayload,
  partitionSimulationProbes,
  SIMULATION_EXERCISE_COUNT,
  SIMULATION_QUESTION_COUNT,
} from "@/lib/block-simulation";
import {
  applySimulationModifierToPrompt,
  depositSimulationGeneration,
  emptySimulationCollection,
  listSimulationCollectionItems,
  removeSimulationCollectionItem,
  updateSimulationCollectionItem,
  normalizeSimulationCollection,
} from "@/lib/workspace-simulation-collection";
import {
  assembleSuggestFromKnowledgeXaiMessages,
  normalizeSuggestFromKnowledgeResponse,
  rankKnowledgeSnapshotsForSuggest,
} from "@/lib/suggest-from-knowledge";
import { simulationCollectionToSuggestSnapshots } from "@/lib/suggest-from-simulation";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-1a28af023b24/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeLog(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("product-intent surfaces (Dialog/Solo, Drill→TAP, Explore→ILE)", () => {
  it("four style×modality combos resolve correctly", () => {
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
    // Drill never ILE; Explore never TAP
    expect(resolveProductIntent("drill", "dialog").product).toBe("tap");
    expect(resolveProductIntent("explore", "solo").product).toBe("ile");
    writeLog("product-intent-remap.log", lines.join("\n") + "\n");
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
    ).toMatchObject({ linkKind: "tap", exercise: true });
    expect(
      productIntentToCreateFields(resolveProductIntent("explore", "dialog")),
    ).toMatchObject({ linkKind: "ile", session_mode: "learning" });
    expect(canonicalizeProductIntentId("open_ended_explore")).toBe(
      "explore_dialog",
    );
    expect(canonicalizeProductIntentId("timed_drill")).toBe("drill_solo");
  });

  it("surfaces do not present Open-ended/Timed as second product axis", () => {
    const card = read("components/BlockDetailCard.tsx");
    expect(card).toContain("modalityDialog");
    expect(card).toContain("modalitySolo");
    expect(card).toContain("resolveLaunchFromStyleAndModality");
    expect(card).not.toContain("Timebox");
    expect(card).not.toContain("Open-ended session (no clock)");
    expect(card).not.toContain("Timed session (clock on)");

    const guest = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(guest).toContain("explore_dialog");
    expect(guest).toContain("drill_solo");
    expect(guest).not.toContain("Open-ended Exploration");
    expect(guest).not.toContain("Timed Exploration");

    const portal = read("components/WorkspaceKnowledgePortalPanel.tsx");
    expect(portal).toContain("explore_dialog");
    expect(portal).toContain("drill_dialog");

    const landing = read("components/PracticePortalLandingClient.tsx");
    expect(landing).toMatch(/Explore sessions require a block/);
    expect(landing).not.toMatch(/Open-ended sessions require a block/);

    const edit = read("components/WorkspaceBlockEditPanel.tsx");
    expect(edit).toContain("With AI");
    expect(edit).toContain("Solo");
    expect(edit).toContain("allowExplore");
    expect(edit).toContain("allowDrill");
    // Must not restate Explore-always-dialog / Drill-always-timed contradiction
    expect(edit).not.toContain("Explore is always dialogue");
    expect(edit).not.toContain("Drill is always timed practice");

    // SessionItem learner launch: Drill, not Timed
    const sessionItem = read("components/SessionItem.tsx");
    expect(sessionItem).toContain("Start Drill · Dialog");
    expect(sessionItem).toContain("data-session-item-drill-dialog");
    expect(sessionItem).not.toContain("Start Timed Exploration");
    expect(sessionItem).not.toMatch(/>\s*Timed\s*</);

    // Map practice badges: With AI / Solo, not Open-ended / Timed
    const badges = read("components/block-skill-grid/map-tile-badges.tsx");
    expect(badges).toContain('? "With AI"');
    expect(badges).toContain(': "Solo"');
    expect(badges).not.toContain('? "Open-ended"');
    expect(badges).not.toContain(': "Timed"');

    // Guest-link settings shell
    const integration = read("components/WorkspaceIntegrationPanel.tsx");
    expect(integration).toMatch(/With AI or\s*Solo/);
    expect(integration).not.toMatch(/open-ended or timed/i);

    // i18n product-axis keys for guest links / portal
    const en = read("messages/en.json");
    expect(en).toContain('"tapLinksExerciseMode": "Drill · Solo Exercise"');
    expect(en).toContain('"ileLinksProjectMode": "Explore · Solo Exercise"');
    expect(en).toContain('"ileLinksTitle": "Explore practice links"');
    expect(en).toContain('"guestLinksFilterKindTap": "Drill only"');
    expect(en).toContain('"guestLinksFilterKindIle": "Explore only"');
    expect(en).not.toContain('"tapLinksExerciseMode": "Timed Drill');
    expect(en).not.toContain('"ileLinksProjectMode": "Open-ended Drill"');
    expect(en).not.toContain('"ileLinksTitle": "Open-ended practice links"');
    expect(en).not.toContain('"guestLinksFilterKindTap": "Timed only"');

    writeLog(
      "product-intent-surfaces.log",
      [
        "BlockDetailCard: modalityDialog+modalitySolo",
        "GuestLinks: explore_dialog+drill_solo",
        "KnowledgePortal: explore_dialog+drill_dialog",
        "PracticePortalLanding: Explore sessions require a block",
        "BlockEdit: With AI + Solo (Explore→ILE Drill→TAP)",
        "SessionItem: Start Drill · Dialog (not Timed)",
        "BlockSkillGrid badges: With AI / Solo",
        "IntegrationPanel: Explore/Drill × With AI/Solo",
        "BlockDetailCard modality: two buttons (With AI / Solo)",
        "en.json: tapLinksExerciseMode/ileLinksProjectMode remapped",
      ].join("\n") + "\n",
    );
  });
});

describe("block simulation generate path", () => {
  it("normalizeSimulationPayload yields non-empty Q+E from valid model payload", () => {
    const payload = {
      intent: "Practice Bayes",
      outcome: "Update beliefs correctly",
      questions: [
        "What is a prior?",
        "How does likelihood update the posterior?",
        "When is a flat prior inappropriate?",
      ],
      exercises: [
        "Compute PPV for sens 0.9, spec 0.9, prev 0.01.",
        "Update a prior of 0.2 after two positive tests.",
        "Design a medical screening example with Bayes rule.",
      ],
      probes: [
        { question: "Define the prior for this setup.", kind: "question" },
        { question: "Explain likelihood vs prior.", kind: "question" },
        { question: "Where do posteriors go wrong?", kind: "question" },
        {
          question: "Exercise: compute PPV for sens 0.9 / spec 0.9 / prev 0.01.",
          kind: "exercise",
        },
        {
          question: "Exercise: update prior 0.2 after two positives.",
          kind: "exercise",
        },
        {
          question: "Exercise: write a medical screening Bayes example.",
          kind: "exercise",
        },
      ],
    };
    const sim = normalizeSimulationPayload(payload, {
      title: "Bayes rule",
      description: "Update beliefs with evidence",
    });
    const { questions, exercises } = partitionSimulationProbes(sim.probes);
    expect(questions.length).toBeGreaterThan(0);
    expect(exercises.length).toBeGreaterThan(0);
    expect(questions.length).toBeLessThanOrEqual(SIMULATION_QUESTION_COUNT);
    expect(exercises.length).toBeLessThanOrEqual(SIMULATION_EXERCISE_COUNT);

    writeLog(
      "block-simulation-generate.log",
      `q=${questions.length} e=${exercises.length} total=${sim.probes.length}\n`,
    );
  });

  it("block simulation API route returns exercises + modifier + recovery", () => {
    const route = read("app/api/workspace/block-content-samples/route.ts");
    expect(route).toContain("applySimulationModifierToPrompt");
    expect(route).toContain("parseJsonLoose");
    expect(route).toContain("exercises");
    expect(route).toContain("maxTokens: 2800");
    expect(route).toContain("modifierPrompt");
  });

  it("block panel auto-generates and deposits to collection", () => {
    const panel = read("components/WorkspaceBlockSimulationPanel.tsx");
    const addUi = read("components/SimulationCollectionAddButton.tsx");
    expect(panel).toContain("data-simulation-auto-generate");
    expect(panel).toContain("simulation-collection");
    expect(panel).toContain("SimulationCollectionAddButton");
    expect(panel).toContain("addMany");
    expect(addUi).toContain("data-simulation-add-to-collection");
    expect(addUi).toContain('action: "deposit"');
    expect(addUi).toContain('action: "create"');
    expect(panel).toContain("modifierPrompt");
  });
});

describe("simulation collection CRUD + modifier", () => {
  it("deposit, list, update, delete", () => {
    let col = emptySimulationCollection();
    col = depositSimulationGeneration(col, {
      questions: ["What is entropy?", "Define KL divergence."],
      exercises: ["Compute entropy of a fair coin."],
      origin: { kind: "block", blockId: "b1", blockTitle: "Info theory" },
      modifierPrompt: "Focus on discrete distributions",
    });
    const listed = listSimulationCollectionItems(col);
    expect(listed.length).toBe(3);
    expect(listed.some((i) => i.kind === "question")).toBe(true);
    expect(listed.some((i) => i.kind === "exercise")).toBe(true);
    expect(listed[0]?.modifierPrompt).toBe("Focus on discrete distributions");

    const updated = updateSimulationCollectionItem(col, listed[0]!.id, {
      text: "What is Shannon entropy?",
    });
    expect(updated).not.toBeNull();
    const afterUpdate = listSimulationCollectionItems(updated!);
    expect(afterUpdate.find((i) => i.id === listed[0]!.id)?.text).toBe(
      "What is Shannon entropy?",
    );

    const removed = removeSimulationCollectionItem(updated!, listed[0]!.id);
    expect(removed).not.toBeNull();
    expect(
      listSimulationCollectionItems(removed!).find((i) => i.id === listed[0]!.id),
    ).toBeUndefined();
    expect(
      listSimulationCollectionItems(removed!, { includeRemoved: true }).length,
    ).toBe(3);

    // multi-block origin deposit
    col = depositSimulationGeneration(emptySimulationCollection(), {
      questions: ["Bridge Q"],
      exercises: ["Bridge E"],
      origin: {
        kind: "multi_block",
        blockIds: ["a", "b"],
        blockTitles: ["A", "B"],
      },
    });
    expect(listSimulationCollectionItems(col)[0]?.origin.kind).toBe(
      "multi_block",
    );

    const once = depositSimulationGeneration(emptySimulationCollection(), {
      questions: ["What is entropy?"],
      exercises: [],
      origin: { kind: "workspace" },
    });
    const twice = depositSimulationGeneration(once, {
      questions: ["What is entropy?"],
      exercises: [],
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
        "deposit=3",
        "update=ok",
        "soft_delete=ok",
        "multi_block=ok",
        "modifier_applied=ok",
        "wire=" +
          JSON.stringify(normalizeSimulationCollection(col).items.length),
      ].join("\n") + "\n",
    );
  });

  it("sim tab is workspace-only; multi-block lives on map drawer", () => {
    const panel = read("components/WorkspaceSimulationPanel.tsx");
    expect(panel).toContain("data-simulation-collection");
    expect(panel).toContain("data-simulation-collection-edit");
    expect(panel).toContain("data-simulation-collection-delete");
    expect(panel).toContain("data-simulation-modifier");
    expect(panel).toContain('data-simulation-scope="workspace"');
    expect(panel).toContain('scope: "workspace"');
    expect(panel).toContain("SimulationCollectionAddButton");
    expect(panel).toContain("addMany");
    // Block / multi-block pickers removed from the tab
    expect(panel).not.toContain("data-simulation-scope-block");
    expect(panel).not.toContain("data-simulation-multi-block");
    expect(panel).not.toContain("data-simulation-block-select");

    const multi = read("components/WorkspaceMultiBlockSimulationPanel.tsx");
    expect(multi).toContain("data-multi-block-simulation");
    expect(multi).toContain("data-simulation-multi-block");
    expect(multi).toContain("SimulationCollectionAddButton");
    expect(multi).toContain("addMany");
    expect(multi).toContain("multi_block");

    const combine = read("components/WorkspaceCombineBlocksPane.tsx");
    expect(combine).toContain("WorkspaceMultiBlockSimulationPanel");
    expect(combine).toContain('drawerId="simulation"');
    expect(combine).toContain("data-multi-block-simulation-drawer");

    // Single-block drawer still on block detail
    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    expect(detail).toContain("WorkspaceBlockSimulationPanel");
    expect(detail).toContain('drawerId="simulation"');
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

  it("generative panes expose Suggest from Knowledge + Simulation hooks; knowledge route uses xAI", () => {
    const panes = [
      "components/WorkspaceAddBlockPane.tsx",
      "components/WorkspaceGenerateShapePane.tsx",
      "components/WorkspaceExpandBlockPane.tsx",
      "components/WorkspaceCombineBlocksPane.tsx",
      "components/WorkspaceEmptyMapPane.tsx",
    ];
    for (const p of panes) {
      const src = read(p);
      expect(src).toContain("WorkspacePromptContextAlternatives");
      expect(src).toMatch(
        /data-generative-context-alternatives|data-expand-map-suggest-context|data-prompt-context-alternatives/,
      );
    }
    const alt = read("components/WorkspacePromptContextAlternatives.tsx");
    expect(alt).toContain("Suggest from Knowledge");
    expect(alt).toContain("Suggest from Simulation");
    expect(alt).toContain("data-suggest-from-knowledge");
    expect(alt).toContain("data-suggest-from-simulation");
    expect(alt).toContain('data-prompt-context-mode="adhoc"');

    const route = read("app/api/workspace/suggest-from-knowledge/route.ts");
    expect(route).toContain("runSuggestFromKnowledgeModel");
    expect(route).toContain("assembleSuggestFromKnowledgeXaiMessages");
    expect(route).toContain("normalizeSuggestFromKnowledgeResponse");
    expect(route).toContain("listEvalRunHistory");
    expect(route).toContain("from(\"blocks\")");
    // Must not ship pure offline template builder as success path
    expect(route).not.toContain("buildSuggestFromKnowledge(");
  });

  it("generative drawers keep one adhoc prompt field (no leftover sibling textarea)", () => {
    const alt = read("components/WorkspacePromptContextAlternatives.tsx");
    expect(alt).toContain("adhocInputDataAttr");
    expect(alt).toContain("data-prompt-context-adhoc-input");

    const cases: Array<{ file: string; hook: string }> = [
      { file: "components/WorkspaceAddBlockPane.tsx", hook: "data-add-block-prompt" },
      {
        file: "components/WorkspaceGenerateShapePane.tsx",
        hook: "data-generate-shape-prompt",
      },
      {
        file: "components/WorkspaceCombineBlocksPane.tsx",
        hook: "data-bridge-prompt",
      },
      {
        file: "components/WorkspaceExpandBlockPane.tsx",
        hook: "data-expand-block-modifier-input",
      },
      {
        file: "components/WorkspaceEmptyMapPane.tsx",
        hook: "data-empty-map-suggest-input",
      },
    ];
    for (const { file, hook } of cases) {
      const src = read(file);
      expect(src, file).toContain(`adhocInputDataAttr="${hook}"`);
      // The hook must live on the shared Adhoc box, not a second bound field.
      expect(src, file).not.toMatch(
        new RegExp(`<(?:textarea|input)[^>]*\\b${hook}\\b`),
      );
    }

    writeLog(
      "single-adhoc-prompt-field.log",
      "add+shape+bridge+expand+suggest_spot=one_adhoc_field\n",
    );
  });
});

describe("Expand Map rename + suggest UI", () => {
  it("button and drawer use Explore / Expand Map naming", () => {
    const grid = readMapGridSurface();
    expect(grid).toContain("WORKSPACE_MAP_TOGGLE_IDS");
    expect(grid).toContain("data-workspace-mode-toggle-states");
    expect(grid).not.toContain("data-map-explore-expand-toggle");

    const pane = read("components/WorkspaceEmptyMapPane.tsx");
    expect(pane).toContain("Expand Map");
    expect(pane).toContain("data-expand-map-title");
    expect(pane).toContain("data-expand-map-suggest-context");
    expect(pane).toContain("WorkspacePromptContextAlternatives");

    const alt = read("components/WorkspacePromptContextAlternatives.tsx");
    expect(alt).toContain("Suggest from Knowledge");
    expect(alt).toContain("Suggest from Simulation");

    writeLog(
      "expand-map-ui.log",
      [
        "button=Explore (3-state toggle)",
        "drawer_title=Expand Map",
        "suggest_context=knowledge+simulation",
      ].join("\n") + "\n",
    );
  });
});
