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
    expect(isPracticePortalProductAllowed(cfg, "drill_solo")).toBe(false);
    expect(isPracticePortalProductAllowed(cfg, "explore_solo")).toBe(false);
    expect(isPracticePortalProductAllowed(cfg, "nope")).toBe(false);
  });

  it("isPracticePortalTimingAllowed for timed and explore", () => {
    expect(isPracticePortalTimingAllowed(cfg, "drill_dialog", 5)).toBe(true);
    expect(isPracticePortalTimingAllowed(cfg, "drill_dialog", 10)).toBe(true);
    expect(isPracticePortalTimingAllowed(cfg, "drill_dialog", 30)).toBe(false);
    // explore ignores minutes
    expect(isPracticePortalTimingAllowed(cfg, "explore_dialog", 999)).toBe(true);
    // disallowed product
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

    // Explore not mintable under workspace force (ILE requires a block)
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
    expect(def.minutes).toBe(15); // first in configured list
  });

  it("refuses disallowed product and disallowed timing", () => {
    const narrow = normalizePracticePortalConfig({
      allowed_products: ["drill_dialog"],
      timings: { timed_explore: [10] },
    });

    const badProduct = validatePracticePortalMintRequest(narrow, {
      product_id: "drill_solo",
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
  it("maps timed explore/drill to TAP create body and explore to ILE", () => {
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
    expect(tapDrill.body.exercise).toBe(true);

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
    expect(ile.body.session_mode).toBe("project");
    expect(ile.body.project).toBe(true);
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
    expect(view.products.map((p) => p.id)).toEqual([
      "drill_dialog",
      "drill_solo",
    ]);
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
    expect(parsePracticePortalProductId("TIMED_DRILL")).toBe("drill_solo");
    expect(launchTargetForPracticePortalProduct("explore_dialog").product).toBe(
      "ile",
    );
    expect(launchTargetForPracticePortalProduct("drill_solo").interaction_kind).toBe(
      "exercise",
    );
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

describe("Practice Portal structural wiring", () => {
  it("exposes owner create UI, public landing, mint API, middleware allowlist, migration", () => {
    const portalPanel = read("components/WorkspaceKnowledgePortalPanel.tsx");
    expect(portalPanel).toMatch(/practice.?portal|Knowledge Portal|practicePortal/i);
    expect(portalPanel).toMatch(/data-practice-portal/);
    expect(portalPanel).toMatch(/data-knowledge-portal-panel/);
    expect(portalPanel).toMatch(/data-knowledge-portal-inner-tab="create"/);
    expect(portalPanel).toMatch(/data-knowledge-portal-inner-tab="browse"/);
    expect(portalPanel).toMatch(/data-practice-portal-scope/);
    expect(portalPanel).toMatch(/data-practice-portal-scope-workspace/);
    expect(portalPanel).toMatch(/scope_mode/);
    expect(portalPanel).toMatch(/portalBlockId|block_id/);
    expect(portalPanel).not.toMatch(/practicePortalUrlOnce/);

    // Guest links no longer embed Knowledge Portal create chrome
    const guestPanel = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(guestPanel).not.toMatch(/data-practice-portal-create/);
    expect(guestPanel).not.toMatch(/data-practice-portal-create-submit/);
    expect(guestPanel).not.toMatch(/data-product-intent="practice-portal-create"/);

    const settings = read("components/WorkspaceIntegrationPanel.tsx");
    expect(settings).toMatch(/knowledge-portal/);
    expect(settings).toMatch(/WorkspaceKnowledgePortalPanel/);
    expect(settings).toMatch(/data-settings-tab-panel="knowledge-portal"/);

    const pure = read("lib/practice-portal.ts");
    expect(pure).toContain("normalizePracticePortalConfig");
    expect(pure).toContain("validatePracticePortalMintRequest");
    expect(pure).toContain("buildPracticePortalUrl");
    expect(pure).toContain("PRACTICE_PORTAL_PUBLIC_PATH");
    expect(pure).toContain("classifyPracticePortalLookup");

    const ownerApi = read("app/api/workspace/practice-portals/route.ts");
    expect(ownerApi).toMatch(/workspace_practice_portals/);
    expect(ownerApi).toMatch(/normalizePracticePortalConfig/);
    expect(ownerApi).toMatch(/public_token/);
    expect(ownerApi).toMatch(/buildPracticePortalUrl/);

    const publicGet = read("app/api/practice-portal/[token]/route.ts");
    expect(publicGet).toMatch(/buildPracticePortalLandingView|normalizePracticePortalConfig/);

    const mintApi = read("app/api/practice-portal/[token]/mint/route.ts");
    expect(mintApi).toMatch(/validatePracticePortalMintRequest/);
    expect(mintApi).toMatch(/createWorkspaceTapLink|createWorkspaceIleLink/);

    const landing = read("app/portal/[token]/page.tsx");
    expect(landing).toMatch(/PracticePortalLanding|PracticePortalShell/);
    expect(landing).toMatch(/classifyPracticePortalLookup/);
    expect(landing).toMatch(/storage_error|data-practice-portal-error|errorCode/);
    expect(landing).toMatch(/aestheticImageForId|\/aesthetics\//);
    expect(landing).toMatch(/PracticePortalShell/);

    const shell = read("components/PracticePortalShell.tsx");
    expect(shell).toMatch(/data-practice-portal-aesthetics-bg|data-aesthetics-bg/);
    expect(shell).toMatch(/\/aesthetics\/|backgroundImage/);
    expect(shell).toMatch(/bg-cover|bg-fixed|bg-center/);
    expect(shell).toMatch(/data-practice-portal-centered/);
    expect(shell).toMatch(/max-w-3xl|mx-auto/);
    expect(shell).toMatch(/radial-gradient|#0a0a0a/);
    expect(shell).toMatch(/z-10|fixed inset-0/);

    const legacy = read("app/practice-portal/[token]/page.tsx");
    expect(legacy).toMatch(/redirect\(`?\/portal\//);

    const landingClient = read("components/PracticePortalLandingClient.tsx");
    expect(landingClient).toMatch(/data-practice-portal-mint|data-mint-/);
    expect(landingClient).toMatch(/duration|minutes/i);
    expect(landingClient).toMatch(/product/i);
    expect(landingClient).toMatch(/font-mono|tracking-\[/);
    expect(landingClient).toMatch(/zinc-|amber-/);
    expect(landingClient).toMatch(/items-center text-center|text-center/);
    // Workspace-level force: hide block picker / no block_id on mint
    expect(landingClient).toMatch(/forceWorkspaceScope/);
    expect(landingClient).toMatch(/data-practice-portal-force-workspace/);
    expect(landingClient).toMatch(
      /data-practice-portal-workspace-scope|data-practice-portal-no-block-choice/,
    );
    expect(landingClient).toMatch(/!forceWorkspaceScope/);

    expect(pure).toContain("scope_mode");
    expect(pure).toContain('"workspace"');
    expect(pure).toContain("isPracticePortalWorkspaceScope");
    expect(pure).toContain("force_workspace_scope");
    expect(pure).toContain("resolvePracticePortalMintBlockId");

    expect(mintApi).toContain("validatePracticePortalMintRequest");
    expect(mintApi).toContain("normalizePracticePortalConfig");

    expect(landing).toMatch(/forceWorkspaceScope|force_workspace_scope/);

    const en = read("messages/en.json");
    expect(en).toContain("practicePortalScopeWorkspace");

    writeLog(
      "portal-workspace-scope-ui.log",
      [
        "owner_scope_control=" + portalPanel.includes("data-practice-portal-scope"),
        "owner_workspace_option=" +
          portalPanel.includes("data-practice-portal-scope-workspace"),
        "owner_scope_mode_payload=" + portalPanel.includes("scope_mode"),
        "landing_force_prop=" + landingClient.includes("forceWorkspaceScope"),
        "landing_no_block_hook=" +
          String(
            /data-practice-portal-workspace-scope|data-practice-portal-no-block-choice/.test(
              landingClient,
            ),
          ),
        "landing_hides_picker_when_workspace=" +
          landingClient.includes("forceWorkspaceScope"),
        "page_passes_force=" +
          String(/forceWorkspaceScope|force_workspace_scope/.test(landing)),
        "i18n_workspace=" + en.includes("practicePortalScopeWorkspace"),
        "pure_scope_mode=" + pure.includes("scope_mode"),
      ].join("\n") + "\n",
    );

    writeLog(
      "portal-workspace-scope-mint.log",
      [
        "mint_uses_validate=" +
          mintApi.includes("validatePracticePortalMintRequest"),
        "mint_uses_normalize=" + mintApi.includes("normalizePracticePortalConfig"),
        "pure_workspace_branch=" +
          pure.includes('scope_mode === "workspace"'),
        "pure_has_workspace_helper=" +
          pure.includes("isPracticePortalWorkspaceScope"),
        "create_fields_blockId=" + pure.includes("blockId: validated.block_id"),
      ].join("\n") + "\n",
    );
    expect(landingClient).toMatch(/Knowledge Portal/);
    expect(landingClient).toMatch(
      /Choose the session type that best fits your style\./,
    );
    // No workspace-name suffix on that subtitle
    expect(landingClient).not.toMatch(
      /Choose the session type that best fits your style[\s\S]{0,40}for\s*</,
    );
    expect(landingClient).not.toMatch(/save it before you start/i);
    expect(landingClient).not.toMatch(/PRACTICE PORTAL/);
    expect(landingClient).toMatch(/fixedBlockId|data-practice-portal-block-fixed/);

    // TAP/ILE learner chrome: live onboardingGuide + briefing (not dead session.* helpers)
    const enCopy = JSON.parse(read("messages/en.json")) as {
      tap?: { briefing?: { intro?: string }; welcome?: { panelIntro?: string } };
      onboardingGuide?: {
        tap?: { step1?: { title?: string; body?: string; highlight?: string } };
        ile?: {
          step1?: { body?: string };
          step3?: { start?: string };
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
    // Live ILE remaining first + last slides (step2 thought-interface tutorial is not the live intro)
    expect(enCopy.onboardingGuide?.ile?.step1?.body).toMatch(/Chapters on a spatial grid/i);
    expect(enCopy.onboardingGuide?.ile?.step3?.start).toMatch(/^Start$/);
    // Welcome panel intros used by TutorWelcome on TAP/ILE (long instructional intros)
    expect(enCopy.tap?.welcome?.panelIntro).toMatch(/How it works:|Socratic follow-ups/i);
    expect(enCopy.welcome?.panelIntro).toMatch(/desktop-first workspace|comic-style dialogue/i);

    // Simulation / helper chrome: no implementer-intent leak microcopy in shipped UI strings
    const simulationPanel = read("components/WorkspaceSimulationPanel.tsx");
    expect(simulationPanel).not.toMatch(/offline template/i);
    expect(simulationPanel).not.toMatch(/via xAI/i);
    expect(simulationPanel).not.toMatch(/xAI output/i);
    expect(simulationPanel).not.toMatch(/xAI questions and exercises/i);
    expect(simulationPanel).toContain("data-simulation-generate");
    expect(simulationPanel).toContain("data-simulation-collection");
    expect(simulationPanel).toContain("Generate workspace samples");
    const blockSimPanel = read("components/WorkspaceBlockSimulationPanel.tsx");
    expect(blockSimPanel).not.toMatch(/for xAI samples/i);
    expect(blockSimPanel).not.toMatch(/via xAI/i);
    expect(blockSimPanel).not.toMatch(/offline template/i);
    expect(blockSimPanel).toContain('data-simulation-auto-generate="false"');
    const newsWidget = read("components/WorkspaceTopicNewsWidget.tsx");
    expect(newsWidget).not.toMatch(/xAI-powered headlines/i);

    const exerciseTap = readExerciseTapSurface();
    expect(exerciseTap).toContain("SessionOnboardingGuide");
    expect(exerciseTap).not.toMatch(/Solution Stack — that stack is what will be evaluated/i);
    expect(exerciseTap).toMatch(/Solo practice|Del stashes|Solution/);
    const tapClient = readTapScoreSurface();
    expect(tapClient).toContain("SessionOnboardingGuide");

    const middleware = read("middleware.ts");
    expect(middleware).toMatch(/\/portal/);
    // subscription exempt + public route for canonical slug
    expect(middleware).toMatch(/"\/portal\/?"|"\/portal"/);

    const migration = read(
      "supabase/migrations/20260730120000_workspace_practice_portals.sql",
    );
    expect(migration).toMatch(/workspace_practice_portals/);
    expect(migration).toMatch(/private_token_hash/);
    expect(migration).toMatch(/config jsonb/);
  });

  it("en.json has Knowledge Portal i18n keys including fixed block", () => {
    const en = JSON.parse(read("messages/en.json")) as {
      planView?: Record<string, string>;
    };
    expect(en.planView?.practicePortalTitle).toMatch(/Knowledge Portal/i);
    expect(en.planView?.practicePortalCreate).toBeTruthy();
    expect(en.planView?.practicePortalHint).toBeTruthy();
    expect(en.planView?.practicePortalBlock).toBeTruthy();
    expect(en.planView?.practicePortalBlockOptional).toBeTruthy();
  });
});
