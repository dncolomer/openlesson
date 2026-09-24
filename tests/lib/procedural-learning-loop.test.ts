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
  readableSimulateInsights,
  runSimulateInsights,
  runSimulateInsightsJob,
  createSimulateInsightsJob,
  simulateInsightsClickStartsNewJob,
  simulateInsightsPollBudgetMs,
  SIMULATE_INSIGHTS_FETCH_TIMEOUT_MS,
  SIMULATE_INSIGHTS_STEP_COUNT,
} from "@/lib/simulate-insights";
import {
  applySimulationModifierToPrompt,
  commitSimulationJob,
  depositSimulationGeneration,
  emptySimulationCollection,
  keepSimulatedInsights,
  listSimulationCollectionItems,
  normalizeSimulationCollection,
  removeSimulationCollectionItem,
  updateSimulationCollectionItem,
  upsertSimulationJob,
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
  it("style×modality combos collapse onto With AI launches", () => {
    const cases: Array<[string, string, "ile" | "tap", string]> = [
      ["explore", "dialog", "ile", "learning"],
      ["explore", "solo", "ile", "learning"],
      ["drill", "dialog", "tap", "conversational"],
      ["drill", "solo", "tap", "conversational"],
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
    ).toMatchObject({ linkKind: "tap", exercise: false });
    expect(
      productIntentToCreateFields(resolveProductIntent("explore", "dialog")),
    ).toMatchObject({ linkKind: "ile", session_mode: "learning" });
    expect(canonicalizeProductIntentId("open_ended_explore")).toBe(
      "explore_dialog",
    );
    expect(canonicalizeProductIntentId("timed_drill")).toBe("drill_dialog");
  });

  it("surfaces do not present Open-ended/Timed as second product axis", () => {
    const card = read("components/BlockDetailCard.tsx");
    expect(card).not.toContain("modalityDialog");
    expect(card).not.toContain("modalitySolo");
    expect(card).toContain("resolveLaunchFromStyleAndModality");
    expect(card).not.toContain("Timebox");
    expect(card).not.toContain("Open-ended session (no clock)");
    expect(card).not.toContain("Timed session (clock on)");

    const guest = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(guest).toContain("explore_dialog");
    expect(guest).toContain("drill_dialog");
    expect(guest).toContain("scout_dialog");
    expect(guest).not.toContain("drill_solo");
    expect(guest).not.toContain("Open-ended Exploration");
    expect(guest).not.toContain("Timed Exploration");

    const portal = read("components/WorkspaceKnowledgePortalPanel.tsx");
    expect(portal).toContain("explore_dialog");
    expect(portal).toContain("drill_dialog");
    expect(portal).toContain("scout_dialog");
    expect(portal).toContain("PRODUCT_INTENT_LABELS.scoutDialog");
    expect(portal).toContain("PRODUCT_INTENT_LABELS.exploreDialog");
    expect(portal).toContain("PRODUCT_INTENT_LABELS.drillDialog");
    expect(portal).not.toMatch(/With AI or\s*Solo/);
    expect(portal).not.toMatch(/open-ended or timed/i);

    const landing = read("components/PracticePortalLandingClient.tsx");
    expect(landing).toMatch(/Learn sessions require a block/);
    expect(landing).toContain('return "Prepare"');
    expect(landing).not.toMatch(/Open-ended sessions require a block/);

    const edit = read("components/WorkspaceBlockEditPanel.tsx");
    expect(edit).not.toContain("With AI");
    expect(edit).not.toContain(">Solo<");
    expect(edit).toContain("allowExplore");
    expect(edit).toContain("allowDrill");
    // Must not restate Explore-always-dialog / Drill-always-timed contradiction
    expect(edit).not.toContain("Explore is always dialogue");
    expect(edit).not.toContain("Drill is always timed practice");

    // SessionItem learner launch: Drill, not Timed
    const sessionItem = read("components/SessionItem.tsx");
    expect(sessionItem).toContain("Start Drill");
    expect(sessionItem).toContain("data-session-item-drill-dialog");
    expect(sessionItem).not.toContain("Start Timed Exploration");
    expect(sessionItem).not.toMatch(/>\s*Timed\s*</);

    // Map practice badges: Explore / Drill only
    const badges = read("components/block-skill-grid/map-tile-badges.tsx");
    expect(badges).toContain('"Learn"');
    expect(badges).toContain('"Drill"');
    expect(badges).toContain('"Prepare"');
    expect(badges).not.toContain('? "With AI"');
    expect(badges).not.toContain(': "Solo"');
    expect(badges).not.toContain('? "Open-ended"');
    expect(badges).not.toContain(': "Timed"');

    // Knowledge Links settings copy is gone. Portal is the remaining Settings share desk.
    const integration = read("components/WorkspaceIntegrationPanel.tsx");
    expect(integration).not.toMatch(/Explore or Drill/);
    expect(integration).not.toMatch(/With AI or\s*Solo/);
    expect(integration).not.toMatch(/open-ended or timed/i);
    expect(integration).not.toContain('activeSubview === "guest-links"');

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
        "BlockDetailCard: Explore/Drill only",
        "GuestLinks: explore_dialog+drill_dialog",
        "KnowledgePortal: explore_dialog+drill_dialog",
        "PracticePortalLanding: Explore sessions require a block",
        "BlockEdit: Explore + Drill (always With AI)",
        "SessionItem: Start Drill (not Timed)",
        "BlockSkillGrid badges: Explore / Drill",
        "KnowledgePortal: PRODUCT_INTENT_LABELS exploreDialog+drillDialog",
        "en.json: tapLinksExerciseMode/ileLinksProjectMode remapped",
      ].join("\n") + "\n",
    );
  });
});

describe("Simulate Insights runner", () => {
  it("runs two sequential model steps and returns insight candidates", async () => {
    const calls: number[] = [];
    let secondPrompt = "";
    const insights = await runSimulateInsights({
      context: {
        scope: "block",
        title: "Ownership",
        description: "Move versus borrow. Partial moves leave the rest valid.",
      },
      callStep: async ({ step, userPrompt }) => {
        calls.push(step);
        if (step === 1) {
          return {
            observations: ["Partial moves leave the rest of the struct valid."],
          };
        }
        secondPrompt = userPrompt;
        return {
          insights: [
            {
              title: "Partial moves",
              body: "A learner can craft that a partial move keeps the rest of a struct usable.",
            },
          ],
        };
      },
    });
    expect(calls).toEqual([1, 2]);
    expect(secondPrompt).toContain("Partial moves leave the rest of the struct valid.");
    expect(insights).toHaveLength(1);
    expect(insights[0]!.title).toBe("Partial moves");
    expect(insights[0]!.body).toMatch(/partial move/i);
    expect(insights[0]).not.toHaveProperty("kind");

    const job = createSimulateInsightsJob({ scope: "block", blockId: "b1" });
    expect(readableSimulateInsights(job)).toEqual([]);
    const persisted: Array<{ completedSteps: number; status: string; insightCount: number }> = [];
    const finished = await runSimulateInsightsJob({
      job,
      context: { scope: "block", title: "Ownership", description: "Moves and borrows." },
      callStep: async ({ step }) => {
        if (step === 1) return { observations: ["Borrowing does not take ownership."] };
        return {
          insights: [
            {
              title: "Borrow versus move",
              body: "A learner can craft that a borrow uses a value without taking ownership.",
            },
          ],
        };
      },
      persist: async (next) => {
        persisted.push({
          completedSteps: next.completedSteps,
          status: next.status,
          insightCount: readableSimulateInsights(next).length,
        });
      },
    });
    expect(persisted.some((row) => row.completedSteps === 1 && row.insightCount === 0)).toBe(true);
    expect(persisted.filter((row) => row.status === "completed")).toHaveLength(1);
    expect(readableSimulateInsights(finished)).toHaveLength(1);
    expect(finished.completedSteps).toBeGreaterThanOrEqual(2);

    let stored = keepSimulatedInsights(emptySimulationCollection(), {
      insights: [
        {
          title: "Already kept",
          body: "A learner can craft the idea that was saved before this step finished.",
        },
      ],
      origin: { kind: "block", blockId: "b1" },
    });
    stored = upsertSimulationJob(
      stored,
      createSimulateInsightsJob({ scope: "block", blockId: "b1", id: "job-race" }),
    );
    let raced = false;
    const completed = {
      ...createSimulateInsightsJob({ scope: "block", blockId: "b1", id: "job-race" }),
      status: "completed" as const,
      completedSteps: 2,
      insights: [
        {
          id: "fresh",
          title: "Fresh insight",
          body: "A learner can craft the idea produced by the second simulation step.",
        },
      ],
    };
    const committed = await commitSimulationJob({
      job: completed,
      load: async () => stored,
      saveIfVersion: async (next, expectedVersion) => {
        if (!raced) {
          raced = true;
          stored = keepSimulatedInsights(stored, {
            insights: [
              {
                title: "Kept during the run",
                body: "A learner can craft the idea the author kept while the job was saving.",
              },
            ],
            origin: { kind: "block", blockId: "b1" },
          });
          return false;
        }
        if (stored.updatedAt !== expectedVersion) return false;
        stored = next;
        return true;
      },
    });
    const keptTitles = listSimulationCollectionItems(committed).map((item) => item.title);
    expect(keptTitles).toContain("Kept during the run");
    expect(keptTitles).toContain("Already kept");
    expect(committed.jobs.find((job) => job.id === "job-race")?.status).toBe("completed");

    expect(simulateInsightsClickStartsNewJob({ jobId: "job-race", phase: "waiting" })).toBe(false);
    expect(simulateInsightsClickStartsNewJob({ jobId: "job-race", phase: "failed" })).toBe(true);
    expect(simulateInsightsClickStartsNewJob({ jobId: null, phase: "idle" })).toBe(true);
    expect(simulateInsightsPollBudgetMs()).toBeGreaterThanOrEqual(
      SIMULATE_INSIGHTS_STEP_COUNT * 2 * SIMULATE_INSIGHTS_FETCH_TIMEOUT_MS,
    );

    const legacy = normalizeSimulationCollection({
      items: [
        { id: "q1", kind: "question", text: "What is entropy?" },
        { id: "e1", kind: "exercise", text: "Compute entropy of a fair coin." },
      ],
    });
    expect(listSimulationCollectionItems(legacy)).toEqual([]);

    writeLog(
      "simulate-insights-runner.log",
      [
        `call_count=${calls.length}`,
        `step_order=${calls.join(",")}`,
        `insight_title=${insights[0]!.title}`,
        `insight_body=${insights[0]!.body}`,
        `second_prompt_has_observation=${secondPrompt.includes("Partial moves leave the rest")}`,
        `mid_job_insights_hidden=${persisted.some((row) => row.completedSteps === 1 && row.insightCount === 0)}`,
        `finished_insights=${readableSimulateInsights(finished).length}`,
        `legacy_kept=${listSimulationCollectionItems(legacy).length}`,
        `kept_during_job=${keptTitles.includes("Kept during the run")}`,
        `completed_persists=${persisted.filter((row) => row.status === "completed").length}`,
        `poll_budget_ms=${simulateInsightsPollBudgetMs()}`,
        `resume_waiting=${simulateInsightsClickStartsNewJob({ jobId: "job-race", phase: "waiting" })}`,
        `retry_after_failure=${simulateInsightsClickStartsNewJob({ jobId: "job-race", phase: "failed" })}`,
      ].join("\n") + "\n",
    );
  });

  it("job route starts in the background and reads insights later", () => {
    const route = read("app/api/workspace/simulate-insights/route.ts");
    const start = route.indexOf("export async function POST");
    const readJob = route.indexOf("export async function GET");
    const postBody = route.slice(start, readJob);
    expect(postBody).toContain("after(");
    expect(postBody).toContain("runSimulateInsightsJob");
    expect(postBody).toContain("commitSimulationJob");
    expect(postBody).toContain('status: "running"');
    expect(postBody).not.toContain("callXaiJSON");
    const collectionRoute = read("app/api/workspace/simulation-collection/route.ts");
    const collectionGet = collectionRoute.slice(
      collectionRoute.indexOf("export async function GET"),
      collectionRoute.indexOf("export async function POST"),
    );
    expect(collectionGet).toContain('searchParams.get("ayclToken")');
    const model = read("lib/simulate-insights-model.ts");
    expect(model).toContain("fetchTimeout: 45_000");
    const surface = read("components/SimulateInsightsSurface.tsx");
    expect(surface).toContain("ayclToken");
    expect(surface).toContain("simulation-collection?");
    expect(surface).toContain("simulateInsightsPollBudgetMs");
    expect(surface).toContain("simulateInsightsClickStartsNewJob");
    expect(surface).toContain('setPhase("failed")');
    expect(surface).not.toContain('setPhase(activeJobId ? "waiting" : "idle")');
    expect(surface).not.toContain("attempt < 40");
    expect(readJob).toBeGreaterThan(start);
    expect(route).toContain("readableSimulateInsights");
  });

  it("block panel does not auto-generate or auto-deposit to collection", () => {
    const panel = read("components/WorkspaceBlockSimulationPanel.tsx");
    const surface = read("components/SimulateInsightsSurface.tsx");
    expect(surface).toContain('data-simulation-auto-generate="false"');
    expect(surface).toContain('data-simulation-auto-deposit={autoDeposit ? "true" : "false"}');
    expect(panel).not.toContain("depositToCollection");
    expect(panel).not.toContain("autoRanForBlock");
    expect(surface).toContain("simulation-collection");
    expect(surface).toContain("data-simulate-insights-keep");
    expect(surface).not.toContain("addMany");
    const startFn = surface.slice(
      surface.indexOf("const start = async"),
      surface.indexOf("const keep = async"),
    );
    expect(startFn).not.toContain("action: \"keep\"");
    expect(surface).toContain("modifierPrompt");
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

  it("sim tab is workspace-only; multi-block lives on map drawer", () => {
    const surface = read("components/SimulateInsightsSurface.tsx");
    const hosts = read("components/workspace-view/workspace-section-hosts.tsx");
    expect(hosts).not.toContain("WorkspaceSimulationPanel");
    expect(surface).toContain("data-simulation-collection");
    expect(surface).not.toContain('scope="workspace"');
    expect(surface).not.toContain("data-simulation-questions");
    expect(surface).not.toContain("data-simulation-exercises");

    expect(surface).toContain("data-simulate-insights-keep");
    expect(surface).toContain("data-simulation-collection-delete");
    expect(surface).toContain('action: "keep"');
    expect(surface).toContain('action: "delete"');
    expect(surface).toContain("/api/workspace/simulate-insights");
    expect(surface).toContain("data-simulate-insights-start");
    expect(surface).not.toContain("data-simulation-questions");
    expect(surface).not.toContain("data-simulation-exercises");
    const startFn = surface.slice(
      surface.indexOf("const readJob = async"),
      surface.indexOf("const keep = async"),
    );
    expect(startFn).toContain('method: "POST"');
    expect(startFn).toContain('job.status === "completed"');
    expect(startFn).not.toContain("setInsights(started");
    expect(startFn).toContain("simulateInsightsClickStartsNewJob");

    const multi = read("components/WorkspaceMultiBlockSimulationPanel.tsx");
    expect(multi).toContain("data-multi-block-simulation");
    expect(multi).toContain("data-simulation-multi-block");
    expect(multi).toContain("SimulateInsightsSurface");
    expect(multi).toContain("multi_block");

    const combine = read("components/WorkspaceCombineBlocksPane.tsx");
    expect(combine).toContain("WorkspaceMultiBlockSimulationPanel");
    expect(combine).toContain('drawerId="simulation"');
    expect(combine).toContain("data-multi-block-simulation-drawer");

    // Single-block drawer still on block detail
    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    expect(detail).toContain("WorkspaceBlockSimulationPanel");
    expect(detail).toContain('drawerId="simulation"');
    expect(detail).toContain('title="Simulate Insights"');
    expect(combine).toContain('title="Simulate Insights"');
    const jobRoute = read("app/api/workspace/simulate-insights/route.ts");
    expect(jobRoute).toContain("Simulate Insights runs on a block");
    expect(jobRoute).toContain("runSimulateInsightsJob");
    expect(jobRoute).not.toContain("callXaiJSON");

    const uiLog = join(SCRATCH, "simulate-insights-ui.log");
    mkdirSync(SCRATCH, { recursive: true });
    const uiPrev = existsSync(uiLog) ? readFileSync(uiLog, "utf8") : "";
    writeFileSync(
      uiLog,
      uiPrev +
        [
          "section=Simulate Insights",
          "block_drawer=Simulate Insights",
          "multi_drawer=Simulate Insights",
          "keep=data-simulate-insights-keep",
          "job_start=POST /api/workspace/simulate-insights",
          "job_read=GET after status completed",
          "runner=runSimulateInsightsJob",
          "one_shot_callXaiJSON_in_job_route=false",
          "question_exercise_list=absent",
        ].join("\n") +
        "\n",
      "utf8",
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

  it("generative panes expose equal from-Knowledge, from-Simulation, and from-Context controls", () => {
    const panes = [
      "components/WorkspaceAddBlockPane.tsx",
      "components/WorkspaceGenerateShapePane.tsx",
      "components/WorkspaceExpandBlockPane.tsx",
      "components/WorkspaceCombineBlocksPane.tsx",
      "components/WorkspaceEmptyMapPane.tsx",
    ];
    const fieldHooks = [
      "data-add-block-prompt",
      "data-generate-shape-prompt",
      "data-expand-block-modifier-input",
      "data-bridge-prompt",
      "data-empty-map-suggest-input",
    ];
    for (const p of panes) {
      const src = read(p);
      expect(src, p).toContain("WorkspacePromptContextAlternatives");
      expect(src, p).toMatch(
        /data-generative-context-alternatives|data-expand-map-suggest-context|data-prompt-context-alternatives/,
      );
      expect(src, p).not.toContain("data-prompt-context-suggestions");
    }
    for (const hook of fieldHooks) {
      const owners = panes.filter((p) => read(p).includes(`adhocInputDataAttr="${hook}"`));
      expect(owners, hook).toHaveLength(1);
    }

    const alt = read("components/WorkspacePromptContextAlternatives.tsx");
    expect(alt).toContain("grid-cols-3");
    expect(alt).toContain("w-full min-w-0");
    expect(alt).toContain("sample from Knowledge");
    expect(alt).toContain("sample from Simulation");
    expect(alt).toContain("sample from Context");
    expect(alt).toContain("data-suggest-from-knowledge");
    expect(alt).toContain("data-suggest-from-simulation");
    expect(alt).toContain("data-suggest-from-context");
    expect(alt).toContain("/api/workspace/suggest-from-knowledge");
    expect(alt).toContain("/api/workspace/suggest-from-simulation");
    expect(alt).toContain("/api/workspace/suggest-from-context");
    expect(alt).toContain("pickNextDistinctAuthorPrompt");
    expect(alt).toContain("onAccept(prompt)");
    expect(alt).toContain("onAdhocChange(prompt)");
    expect(alt).toContain("data-prompt-context-adhoc-input");
    expect(alt).not.toContain('mode === "adhoc"');
    expect(alt).not.toContain("data-prompt-context-suggestions");
    expect(alt).not.toContain("suggestions.map");

    const route = read("app/api/workspace/suggest-from-knowledge/route.ts");
    expect(route).toContain("runSuggestFromKnowledgeModel");
    expect(route).toContain("assembleSuggestFromKnowledgeXaiMessages");
    expect(route).toContain("normalizeSuggestFromKnowledgeResponse");
    expect(route).toContain("listEvalRunHistory");
    expect(route).toContain("from(\"blocks\")");
    expect(route).not.toContain("buildSuggestFromKnowledge(");

    const contextRoute = read("app/api/workspace/suggest-from-context/route.ts");
    const emptyAt = contextRoute.indexOf("assembled.empty");
    const modelAt = contextRoute.indexOf("await runSuggestFromKnowledgeModel");
    expect(contextRoute).toContain("assembleSuggestFromContextXaiMessages");
    expect(contextRoute).toContain("normalizeSuggestFromKnowledgeResponse");
    expect(contextRoute).toContain('from("workspace_files")');
    expect(contextRoute).toContain('from("workspace_external_resources")');
    expect(contextRoute).toContain("notes");
    expect(contextRoute).not.toContain("listEvalRunHistory");
    expect(contextRoute).not.toContain("simulationCollection");
    expect(contextRoute).not.toContain("simulation_collection");
    expect(contextRoute).not.toContain("callXaiJSON");
    expect(contextRoute).not.toContain("buildSuggestFromContext(");
    expect(contextRoute).not.toContain("buildSuggestFromKnowledge(");
    expect(emptyAt).toBeGreaterThan(-1);
    expect(modelAt).toBeGreaterThan(emptyAt);

    writeLog(
      "suggest-context-ui.log",
      [
        "equal_grid=grid-cols-3",
        "button_share=w-full min-w-0",
        "labels=sample from Knowledge | sample from Simulation | sample from Context",
        "knowledge_endpoint=/api/workspace/suggest-from-knowledge",
        "simulation_endpoint=/api/workspace/suggest-from-simulation",
        "context_endpoint=/api/workspace/suggest-from-context",
        "picker=pickNextDistinctAuthorPrompt",
        "apply=onAccept(prompt)+onAdhocChange(prompt)",
        "field=data-prompt-context-adhoc-input",
        `field_hooks=${fieldHooks.join(",")}`,
        "suggestion_choice_list=absent",
        "adhoc_mode_gate=absent",
        "context_route_model=runSuggestFromKnowledgeModel",
        `context_empty_before_model=${emptyAt < modelAt}`,
        "context_offline_builder=absent",
        "context_route_skips_eval_history=true",
        "context_route_skips_simulation_collection=true",
        `panes=${panes.length}`,
      ].join("\n") + "\n",
    );
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
    expect(alt).toContain("sample from Knowledge");
    expect(alt).toContain("sample from Simulation");
    expect(alt).toContain("sample from Context");
    expect(alt).toContain("grid-cols-3");

    writeLog(
      "expand-map-ui.log",
      [
        "button=Explore (3-state toggle)",
        "drawer_title=Expand Map",
        "suggest_context=knowledge+simulation+context",
      ].join("\n") + "\n",
    );
  });
});
