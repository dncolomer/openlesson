/**
 * Practice Portal — pure config/normalize/allowance + structural wiring checks.
 * Drives shipped helpers; no re-implementation of the unit under test.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { readExerciseTapSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";
import {
  buildPracticePortalLandingView,
  buildPracticePortalUrl,
  classifyPracticePortalLookup,
  isPracticePortalProductAllowed,
  isPracticePortalTimingAllowed,
  isPracticePortalWorkspaceScope,
  launchTargetForPracticePortalProduct,
  normalizePracticePortalConfig,
  parsePracticePortalProductId,
  PRACTICE_PORTAL_DEFAULT_TIMED_DRILL_MINUTES,
  PRACTICE_PORTAL_DEFAULT_TIMED_EXPLORE_MINUTES,
  PRACTICE_PORTAL_PRODUCT_IDS,
  PRACTICE_PORTAL_PUBLIC_PATH,
  practicePortalMintToCreateFields,
  practicePortalProductsForScope,
  resolvePracticePortalMintBlockId,
  validatePracticePortalMintRequest,
} from "@/lib/practice-portal";
import { productIntentToCreateFields, resolveProductIntent } from "@/lib/product-intent";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-60457f8fcc6e/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeLog(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("normalizePracticePortalConfig", () => {
  it("defaults empty/invalid input to all four products with map-aligned timings", () => {
    const cfg = normalizePracticePortalConfig(undefined);
    expect(cfg.allowed_products).toEqual([...PRACTICE_PORTAL_PRODUCT_IDS]);
    expect(cfg.timings.drill_dialog).toEqual([
      ...PRACTICE_PORTAL_DEFAULT_TIMED_EXPLORE_MINUTES,
    ]);
    expect(cfg.timings.drill_solo).toEqual([
      ...PRACTICE_PORTAL_DEFAULT_TIMED_DRILL_MINUTES,
    ]);

    const empty = normalizePracticePortalConfig({});
    expect(empty.allowed_products).toEqual(cfg.allowed_products);

    const junk = normalizePracticePortalConfig({
      allowed_products: ["nope", 12, null],
    });
    expect(junk.allowed_products).toEqual([...PRACTICE_PORTAL_PRODUCT_IDS]);
  });

  it("keeps only valid products and fills timings for enabled drill products", () => {
    const cfg = normalizePracticePortalConfig({
      allowed_products: ["drill_dialog", "explore_solo", "drill_dialog", "bogus"],
      timings: { timed_explore: [10, 5, 10, 999], timed_drill: [30] },
    });
    expect(cfg.allowed_products).toEqual(["explore_solo", "drill_dialog"]);
    // sorted unique, clamped to max 120
    expect(cfg.timings.drill_dialog).toEqual([5, 10, 120]);
    // timed_drill not allowed → empty timings
    expect(cfg.timings.drill_solo).toEqual([]);
  });

  it("uses default timings when drill product enabled without timings list", () => {
    const cfg = normalizePracticePortalConfig({
      allowed_products: ["drill_solo"],
      timings: {},
    });
    expect(cfg.allowed_products).toEqual(["drill_solo"]);
    expect(cfg.timings.drill_solo).toEqual([
      ...PRACTICE_PORTAL_DEFAULT_TIMED_DRILL_MINUTES,
    ]);
    expect(cfg.timings.drill_dialog).toEqual([]);
  });

  it("persists optional fixed block_id (and defaults null)", () => {
    expect(normalizePracticePortalConfig({}).block_id).toBeNull();
    expect(normalizePracticePortalConfig({}).scope_mode).toBe("visitor_pick");
    const withBlock = normalizePracticePortalConfig({
      allowed_products: ["explore_dialog"],
      block_id: "  block-fixed-1  ",
    });
    expect(withBlock.block_id).toBe("block-fixed-1");
    expect(withBlock.scope_mode).toBe("fixed_block");
    expect(
      normalizePracticePortalConfig({
        allowed_products: ["drill_dialog"],
        fixedBlockId: "camel-block",
      }).block_id,
    ).toBe("camel-block");
  });

  it("workspace scope is distinct from visitor_pick and fixed_block; clears block_id", () => {
    const ws = normalizePracticePortalConfig({
      allowed_products: ["drill_dialog", "explore_dialog"],
      scope_mode: "workspace",
      block_id: "should-be-cleared",
    });
    expect(ws.scope_mode).toBe("workspace");
    expect(ws.block_id).toBeNull();
    expect(isPracticePortalWorkspaceScope(ws)).toBe(true);

    const visitor = normalizePracticePortalConfig({
      allowed_products: ["drill_dialog"],
      scope_mode: "visitor_pick",
    });
    expect(visitor.scope_mode).toBe("visitor_pick");
    expect(visitor.block_id).toBeNull();
    expect(isPracticePortalWorkspaceScope(visitor)).toBe(false);

    const fixed = normalizePracticePortalConfig({
      allowed_products: ["explore_dialog"],
      scope_mode: "fixed_block",
      block_id: "b-fixed",
    });
    expect(fixed.scope_mode).toBe("fixed_block");
    expect(fixed.block_id).toBe("b-fixed");

    // force_workspace boolean alias
    expect(
      normalizePracticePortalConfig({ force_workspace: true }).scope_mode,
    ).toBe("workspace");
  });
});

describe("allowance helpers", () => {
  const cfg = normalizePracticePortalConfig({
    allowed_products: ["drill_dialog", "explore_dialog"],
    timings: { timed_explore: [5, 10], timed_drill: [30] },
  });

  it("isPracticePortalProductAllowed respects config", () => {
    expect(isPracticePortalProductAllowed(cfg, "drill_dialog")).toBe(true);
    expect(isPracticePortalProductAllowed(cfg, "explore_dialog")).toBe(true);
    expect(isPracticePortalProductAllowed(cfg, "drill_solo")).toBe(true);
    expect(isPracticePortalProductAllowed(cfg, "explore_solo")).toBe(true);
    expect(isPracticePortalProductAllowed(cfg, "nope")).toBe(false);
  });

  it("isPracticePortalTimingAllowed for timed and explore", () => {
    expect(isPracticePortalTimingAllowed(cfg, "drill_dialog", 5)).toBe(true);
    expect(isPracticePortalTimingAllowed(cfg, "drill_dialog", 10)).toBe(true);
    expect(isPracticePortalTimingAllowed(cfg, "drill_dialog", 30)).toBe(false);
    // explore ignores minutes
    expect(isPracticePortalTimingAllowed(cfg, "explore_dialog", 999)).toBe(true);
    expect(isPracticePortalTimingAllowed(cfg, "drill_solo", 30)).toBe(false);
  });
});

describe("validatePracticePortalMintRequest", () => {
  const cfg = normalizePracticePortalConfig({
    allowed_products: [
      "explore_dialog",
      "explore_solo",
      "drill_dialog",
      "drill_solo",
    ],
    timings: {
      timed_explore: [5, 10, 30],
      timed_drill: [15, 30, 45],
    },
  });

  it("accepts allowed explore with block_id", () => {
    const v = validatePracticePortalMintRequest(cfg, {
      product_id: "explore_dialog",
      block_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.product_id).toBe("explore_dialog");
    expect(v.minutes).toBeNull();
    expect(v.launch).toEqual(resolveProductIntent("explore", "dialog"));
    expect(v.block_id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });

  it("refuses explore without block_id when portal has no fixed block", () => {
    const v = validatePracticePortalMintRequest(cfg, {
      product_id: "explore_solo",
    });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.code).toBe("block_required");
  });

  it("accepts explore without visitor block_id when portal config has fixed block", () => {
    const fixed = normalizePracticePortalConfig({
      allowed_products: ["explore_dialog"],
      block_id: "fixed-block-uuid",
    });
    const v = validatePracticePortalMintRequest(fixed, {
      product_id: "explore_dialog",
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.block_id).toBe("fixed-block-uuid");

    // Fixed scope ignores visitor override (forced block holds)
    const override = validatePracticePortalMintRequest(fixed, {
      product_id: "explore_dialog",
      block_id: "visitor-block",
    });
    expect(override.ok).toBe(true);
    if (!override.ok) return;
    expect(override.block_id).toBe("fixed-block-uuid");
  });

  it("workspace scope: timed mint yields null block_id; visitor block_id ignored", () => {
    const ws = normalizePracticePortalConfig({
      allowed_products: ["drill_dialog", "drill_solo", "explore_dialog"],
      timings: { timed_explore: [10, 30], timed_drill: [15, 45] },
      scope_mode: "workspace",
    });
    expect(ws.scope_mode).toBe("workspace");
    expect(ws.block_id).toBeNull();

    const timed = validatePracticePortalMintRequest(ws, {
      product_id: "drill_dialog",
      minutes: 10,
      block_id: "visitor-should-not-win",
    });
    expect(timed.ok).toBe(true);
    if (!timed.ok) return;
    expect(timed.block_id).toBeNull();
    expect(timed.minutes).toBe(10);
    expect(timed.launch.product).toBe("tap");

    const timedDrill = validatePracticePortalMintRequest(ws, {
      product_id: "drill_solo",
      minutes: 15,
    });
    expect(timedDrill.ok).toBe(true);
    if (!timedDrill.ok) return;
    expect(timedDrill.block_id).toBeNull();

    // Explore not mintable under workspace force (TAP Learning requires a block)
    const openEnded = validatePracticePortalMintRequest(ws, {
      product_id: "explore_dialog",
      block_id: "b1",
    });
    expect(openEnded.ok).toBe(false);
    if (!openEnded.ok) expect(openEnded.code).toBe("product_not_allowed");

    // resolve helper ignores visitor under workspace
    expect(
      resolvePracticePortalMintBlockId(ws, "visitor-block"),
    ).toBeNull();

    // create fields carry null block for TAP path
    const fields = practicePortalMintToCreateFields(timed);
    expect(fields.linkKind).toBe("tap");
    expect(fields.blockId).toBeNull();

    writeLog(
      "portal-workspace-scope-helpers.log",
      [
        "scope_mode=" + ws.scope_mode,
        "is_workspace=" + isPracticePortalWorkspaceScope(ws),
        "timed_ok=" + timed.ok,
        "timed_block_id_null=" + String(timed.block_id === null),
        "timed_drill_ok=" + timedDrill.ok,
        "open_ended_rejected=" + String(!openEnded.ok),
        "visitor_override_ignored=" +
          String(resolvePracticePortalMintBlockId(ws, "x") === null),
        "products_for_scope=" +
          practicePortalProductsForScope(ws).join(","),
        "create_blockId_null=" + String(fields.blockId === null),
      ].join("\n") + "\n",
    );
  });

  it("accepts allowed drill product + timing; defaults minutes when omitted", () => {
    const explicit = validatePracticePortalMintRequest(cfg, {
      product_id: "drill_dialog",
      minutes: 10,
    });
    expect(explicit.ok).toBe(true);
    if (!explicit.ok) return;
    expect(explicit.minutes).toBe(10);
    expect(explicit.launch.product).toBe("tap");

    const def = validatePracticePortalMintRequest(cfg, {
      product_id: "drill_solo",
    });
    expect(def.ok).toBe(true);
    if (!def.ok) return;
    expect(def.product_id).toBe("drill_dialog");
    expect(def.launch.interaction_kind).toBe("conversational");
    expect(typeof def.minutes).toBe("number");
  });

  it("refuses disallowed product and disallowed timing", () => {
    const narrow = normalizePracticePortalConfig({
      allowed_products: ["drill_dialog"],
      timings: { timed_explore: [10] },
    });

    const badProduct = validatePracticePortalMintRequest(narrow, {
      product_id: "explore_solo",
      minutes: 30,
    });
    expect(badProduct.ok).toBe(false);
    if (!badProduct.ok) expect(badProduct.code).toBe("product_not_allowed");

    const badTiming = validatePracticePortalMintRequest(narrow, {
      product_id: "drill_dialog",
      minutes: 5,
    });
    expect(badTiming.ok).toBe(false);
    if (!badTiming.ok) expect(badTiming.code).toBe("timing_not_allowed");
  });

  it("refuses unknown product_id", () => {
    const v = validatePracticePortalMintRequest(cfg, { product_id: "nope" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("validation_error");
  });
});

describe("practicePortalMintToCreateFields (create → mint shape)", () => {
  it("maps timed explore/drill to TAP create body and explore to TAP Learning", () => {
    const timedExplore = validatePracticePortalMintRequest(
      normalizePracticePortalConfig({
        allowed_products: ["drill_dialog"],
        timings: { timed_explore: [10] },
      }),
      { product_id: "drill_dialog", minutes: 10 },
    );
    expect(timedExplore.ok).toBe(true);
    if (!timedExplore.ok) return;
    const tap = practicePortalMintToCreateFields(timedExplore);
    expect(tap.linkKind).toBe("tap");
    expect(tap.body.minutes).toBe(10);
    expect(tap.body.participant_type).toBe("anonymous");
    expect(tap.body.interaction_kind).toBe(
      productIntentToCreateFields(resolveProductIntent("drill", "dialog")).interaction_kind,
    );

    const timedDrill = validatePracticePortalMintRequest(
      normalizePracticePortalConfig({
        allowed_products: ["drill_solo"],
        timings: { timed_drill: [30] },
      }),
      { product_id: "drill_solo", minutes: 30 },
    );
    expect(timedDrill.ok).toBe(true);
    if (!timedDrill.ok) return;
    const tapDrill = practicePortalMintToCreateFields(timedDrill);
    expect(tapDrill.linkKind).toBe("tap");
    expect(tapDrill.body.exercise).toBe(false);
    expect(tapDrill.body.interaction_kind).toBe("conversational");

    const openEnded = validatePracticePortalMintRequest(
      normalizePracticePortalConfig({
        allowed_products: ["explore_solo"],
      }),
      {
        product_id: "explore_solo",
        block_id: "block-1",
      },
    );
    expect(openEnded.ok).toBe(true);
    if (!openEnded.ok) return;
    const ile = practicePortalMintToCreateFields(openEnded);
    expect(ile.linkKind).toBe("ile");
    expect(ile.blockId).toBe("block-1");
    expect(ile.body.session_mode).toBe("learning");
    expect(ile.body.project).toBe(false);
  });

  it("buildPracticePortalLandingView only lists configured products/timings", () => {
    const view = buildPracticePortalLandingView({
      config: {
        allowed_products: ["drill_dialog", "explore_dialog"],
        timings: { timed_explore: [5, 10], timed_drill: [45] },
        block_id: null,
      },
      workspace: { id: "ws-1", title: "Algebra", root_topic: "Math" },
      blocks: [{ id: "b1", title: "Intro", is_start: true }],
      portal_id: "portal-1",
    });
    expect(view.products.map((p) => p.id)).toEqual([
      "explore_dialog",
      "drill_dialog",
    ]);
    const timed = view.products.find((p) => p.id === "drill_dialog");
    expect(timed?.timings).toEqual([5, 10]);
    // drill timings not exposed when product disabled
    expect(view.products.some((p) => p.id === "drill_solo")).toBe(false);
    expect(view.workspace.title).toBe("Algebra");
    expect(view.blocks[0].is_start).toBe(true);
    expect(view.fixed_block_id).toBeNull();
  });

  it("landing view surfaces fixed block and filters blocks list", () => {
    const view = buildPracticePortalLandingView({
      config: {
        allowed_products: ["explore_dialog"],
        timings: { timed_explore: [], timed_drill: [] },
        block_id: "b2",
      },
      workspace: { id: "ws-1", title: "Algebra" },
      blocks: [
        { id: "b1", title: "A", is_start: true },
        { id: "b2", title: "B", is_start: false },
      ],
    });
    expect(view.fixed_block_id).toBe("b2");
    expect(view.force_workspace_scope).toBe(false);
    expect(view.scope_mode).toBe("fixed_block");
    expect(view.blocks.map((b) => b.id)).toEqual(["b2"]);
  });

  it("landing view workspace scope: empty blocks, no fixed block, drill products only", () => {
    const view = buildPracticePortalLandingView({
      config: {
        allowed_products: [
          "explore_dialog",
          "explore_solo",
          "drill_dialog",
          "drill_solo",
        ],
        timings: { timed_explore: [10], timed_drill: [30] },
        scope_mode: "workspace",
        block_id: "ignored",
      },
      workspace: { id: "ws-1", title: "Algebra" },
      blocks: [
        { id: "b1", title: "A", is_start: true },
        { id: "b2", title: "B", is_start: false },
      ],
    });
    expect(view.force_workspace_scope).toBe(true);
    expect(view.scope_mode).toBe("workspace");
    expect(view.fixed_block_id).toBeNull();
    expect(view.blocks).toEqual([]);
    expect(view.products.map((p) => p.id)).toEqual(["drill_dialog"]);
    expect(view.config.block_id).toBeNull();
  });

  it("buildPracticePortalUrl uses /portal/{token} (not practice-portal)", () => {
    expect(PRACTICE_PORTAL_PUBLIC_PATH).toBe("portal");
    expect(buildPracticePortalUrl("https://app.example.com/", "tok123")).toBe(
      "https://app.example.com/portal/tok123",
    );
    expect(buildPracticePortalUrl("https://app.example.com/", "tok123")).not.toContain(
      "practice-portal",
    );
    expect(parsePracticePortalProductId("TIMED_DRILL")).toBe("drill_dialog");
    expect(launchTargetForPracticePortalProduct("explore_dialog").product).toBe(
      "ile",
    );
    expect(launchTargetForPracticePortalProduct("drill_solo").interaction_kind).toBe(
      "conversational",
    );
    expect(launchTargetForPracticePortalProduct("scout_dialog").interaction_kind).toBe(
      "scout",
    );
  });

  it("lists Prepare next to Learn and Drill and mints a timed scout link", () => {
    const cfg = normalizePracticePortalConfig({
      allowed_products: ["scout_dialog", "explore_dialog", "drill_dialog"],
      timings: { scout_dialog: [10, 30], timed_explore: [5] },
      block_id: "b1",
    });
    expect(practicePortalProductsForScope(cfg).map((id) => id)).toEqual([
      "scout_dialog",
      "explore_dialog",
      "drill_dialog",
    ]);
    const minted = validatePracticePortalMintRequest(cfg, {
      product_id: "scout_dialog",
      minutes: 10,
      block_id: "b1",
    });
    expect(minted.ok).toBe(true);
    if (!minted.ok) return;
    expect(minted.launch.interaction_kind).toBe("scout");
    expect(practicePortalMintToCreateFields(minted).body.interaction_kind).toBe("scout");
    expect(isPracticePortalTimingAllowed(cfg, "scout_dialog", 10)).toBe(true);
    expect(isPracticePortalTimingAllowed(cfg, "scout_dialog", 5)).toBe(false);
  });

  it("classifyPracticePortalLookup distinguishes storage errors from not found", () => {
    expect(
      classifyPracticePortalLookup({
        data: { status: "active" },
        error: null,
      }),
    ).toEqual({ outcome: "found", status: "active" });

    expect(classifyPracticePortalLookup({ data: null, error: null })).toEqual({
      outcome: "not_found",
    });

    expect(
      classifyPracticePortalLookup({
        data: { status: "revoked" },
        error: null,
      }),
    ).toEqual({ outcome: "revoked", status: "revoked" });

    const storage = classifyPracticePortalLookup({
      data: null,
      error: { message: "relation workspace_practice_portals does not exist" },
    });
    expect(storage.outcome).toBe("storage_error");
    if (storage.outcome === "storage_error") {
      expect(storage.message).toMatch(/workspace_practice_portals/);
    }
  });
});

describe("Knowledge Portal removal", () => {
  it("drops the portal from the product and keeps the database migration", () => {
    const gone = [
      "components/WorkspaceKnowledgePortalPanel.tsx",
      "components/PracticePortalLandingClient.tsx",
      "components/PracticePortalShell.tsx",
      "app/portal/[token]/page.tsx",
      "app/practice-portal/[token]/page.tsx",
      "app/api/workspace/practice-portals/route.ts",
      "app/api/practice-portal/[token]/route.ts",
      "app/api/practice-portal/[token]/mint/route.ts",
    ];
    for (const rel of gone) {
      expect(existsSync(join(process.cwd(), rel)), rel).toBe(false);
    }
    const settings = read("components/WorkspaceIntegrationPanel.tsx");
    expect(settings).not.toMatch(/knowledge-portal|WorkspaceKnowledgePortalPanel|Knowledge Portal/);
    const en = read("messages/en.json");
    expect(en).not.toMatch(/Knowledge Portal/);
    expect(en).not.toMatch(/practicePortalTitle/);
    const middleware = read("middleware.ts");
    expect(middleware).not.toMatch(/\/portal/);
    const migration = read(
      "supabase/migrations/20260730120000_workspace_practice_portals.sql",
    );
    expect(migration).toMatch(/workspace_practice_portals/);
  });

  it("keeps learner onboarding copy that used to sit beside the portal test", () => {
    const enCopy = JSON.parse(read("messages/en.json")) as {
      tap?: { briefing?: { intro?: string }; welcome?: { panelIntro?: string } };
      onboardingGuide?: {
        tap?: { step1?: { title?: string; body?: string; highlight?: string } };
        ile?: {
          step1?: { body?: string };
          step3?: { start?: string; body?: string; highlight?: string };
        };
      };
      welcome?: { panelIntro?: string };
    };
    expect(enCopy.tap?.briefing?.intro).toBeTruthy();
    expect((enCopy.tap?.briefing?.intro || "").length).toBeLessThan(80);
    // Live TAP remaining first slide: learner job (think out loud, close a turn, stay speaking)
    expect(enCopy.onboardingGuide?.tap?.step1?.title).toMatch(/What you'll do/i);
    expect(enCopy.onboardingGuide?.tap?.step1?.body).toMatch(/think out loud/i);
    expect(enCopy.onboardingGuide?.tap?.step1?.body).toMatch(/I'm done answering/);
    expect(enCopy.onboardingGuide?.tap?.step1?.body).toMatch(/Stay speaking/i);
    expect(enCopy.onboardingGuide?.tap?.step1?.body).not.toMatch(/^Think out loud on a timer\./);
    expect((enCopy.onboardingGuide?.tap?.step1?.body || "").length).toBeGreaterThan(180);
    // Live TAP Learning welcome: session goal is craft X insights via map areas
    expect(enCopy.onboardingGuide?.ile?.step3?.start).toMatch(/^Start$/);
    expect(enCopy.onboardingGuide?.ile?.step3?.body).toMatch(/craft insights/i);
    expect(enCopy.onboardingGuide?.ile?.step3?.body).toMatch(/canvas/i);
    expect(enCopy.onboardingGuide?.ile?.step3?.body).not.toMatch(/\bboard\b|end turn/i);
    expect((enCopy.onboardingGuide?.ile?.step3?.body || "").length).toBeLessThan(120);
    expect(enCopy.onboardingGuide?.ile?.step3?.highlight).toBe("");
    // Welcome panel intros used by TutorWelcome on TAP/TAP Learning (long instructional intros)
    expect(enCopy.tap?.welcome?.panelIntro).toMatch(/How it works:|Socratic follow-ups/i);
    expect(enCopy.welcome?.panelIntro).toMatch(/desktop-first workspace|comic-style dialogue/i);

    // Simulation / helper chrome: no implementer-intent leak microcopy in shipped UI strings
    const simulationPanel = read("components/SimulateInsightsSurface.tsx");
    expect(simulationPanel).not.toMatch(/offline template/i);
    expect(simulationPanel).not.toMatch(/via xAI/i);
    expect(simulationPanel).not.toMatch(/xAI output/i);
    expect(simulationPanel).not.toMatch(/xAI questions and exercises/i);
    expect(simulationPanel).toContain("data-simulation-generate");
    expect(simulationPanel).toContain("data-simulation-collection");
    expect(simulationPanel).not.toContain("Generate workspace samples");
    const blockSimPanel = read("components/WorkspaceBlockSimulationPanel.tsx");
    expect(blockSimPanel).not.toMatch(/for xAI samples/i);
    expect(blockSimPanel).not.toMatch(/via xAI/i);
    expect(blockSimPanel).not.toMatch(/offline template/i);
    expect(blockSimPanel).toContain("SimulateInsightsSurface");
    const newsWidget = read("components/WorkspaceTopicNewsWidget.tsx");
    expect(newsWidget).not.toMatch(/xAI-powered headlines/i);

    const exerciseTap = readExerciseTapSurface();
    expect(exerciseTap).toContain("SessionOnboardingGuide");
    expect(exerciseTap).not.toMatch(/Solution Stack — that stack is what will be evaluated/i);
    expect(exerciseTap).toMatch(/Solo practice|Del stashes|Solution/);
    const tapClient = readTapScoreSurface();
    expect(tapClient).toContain("SessionOnboardingGuide");

    const migration = read(
      "supabase/migrations/20260730120000_workspace_practice_portals.sql",
    );
    expect(migration).toMatch(/workspace_practice_portals/);
    expect(migration).toMatch(/private_token_hash/);
    expect(migration).toMatch(/config jsonb/);
  });

});
