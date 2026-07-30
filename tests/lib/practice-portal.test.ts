/**
 * Practice Portal — pure config/normalize/allowance + structural wiring checks.
 * Drives shipped helpers; no re-implementation of the unit under test.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildPracticePortalLandingView,
  buildPracticePortalUrl,
  classifyPracticePortalLookup,
  isPracticePortalProductAllowed,
  isPracticePortalTimingAllowed,
  launchTargetForPracticePortalProduct,
  normalizePracticePortalConfig,
  parsePracticePortalProductId,
  PRACTICE_PORTAL_DEFAULT_TIMED_DRILL_MINUTES,
  PRACTICE_PORTAL_DEFAULT_TIMED_EXPLORE_MINUTES,
  PRACTICE_PORTAL_PRODUCT_IDS,
  PRACTICE_PORTAL_PUBLIC_PATH,
  practicePortalMintToCreateFields,
  validatePracticePortalMintRequest,
} from "@/lib/practice-portal";
import { productIntentToCreateFields, resolveProductIntent } from "@/lib/product-intent";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("normalizePracticePortalConfig", () => {
  it("defaults empty/invalid input to all four products with map-aligned timings", () => {
    const cfg = normalizePracticePortalConfig(undefined);
    expect(cfg.allowed_products).toEqual([...PRACTICE_PORTAL_PRODUCT_IDS]);
    expect(cfg.timings.timed_explore).toEqual([
      ...PRACTICE_PORTAL_DEFAULT_TIMED_EXPLORE_MINUTES,
    ]);
    expect(cfg.timings.timed_drill).toEqual([
      ...PRACTICE_PORTAL_DEFAULT_TIMED_DRILL_MINUTES,
    ]);

    const empty = normalizePracticePortalConfig({});
    expect(empty.allowed_products).toEqual(cfg.allowed_products);

    const junk = normalizePracticePortalConfig({
      allowed_products: ["nope", 12, null],
    });
    expect(junk.allowed_products).toEqual([...PRACTICE_PORTAL_PRODUCT_IDS]);
  });

  it("keeps only valid products and fills timings for enabled timed products", () => {
    const cfg = normalizePracticePortalConfig({
      allowed_products: ["timed_explore", "open_ended_drill", "timed_explore", "bogus"],
      timings: { timed_explore: [10, 5, 10, 999], timed_drill: [30] },
    });
    expect(cfg.allowed_products).toEqual(["open_ended_drill", "timed_explore"]);
    // sorted unique, clamped to max 120
    expect(cfg.timings.timed_explore).toEqual([5, 10, 120]);
    // timed_drill not allowed → empty timings
    expect(cfg.timings.timed_drill).toEqual([]);
  });

  it("uses default timings when timed product enabled without timings list", () => {
    const cfg = normalizePracticePortalConfig({
      allowed_products: ["timed_drill"],
      timings: {},
    });
    expect(cfg.allowed_products).toEqual(["timed_drill"]);
    expect(cfg.timings.timed_drill).toEqual([
      ...PRACTICE_PORTAL_DEFAULT_TIMED_DRILL_MINUTES,
    ]);
    expect(cfg.timings.timed_explore).toEqual([]);
  });

  it("persists optional fixed block_id (and defaults null)", () => {
    expect(normalizePracticePortalConfig({}).block_id).toBeNull();
    const withBlock = normalizePracticePortalConfig({
      allowed_products: ["open_ended_explore"],
      block_id: "  block-fixed-1  ",
    });
    expect(withBlock.block_id).toBe("block-fixed-1");
    expect(
      normalizePracticePortalConfig({
        allowed_products: ["timed_explore"],
        fixedBlockId: "camel-block",
      }).block_id,
    ).toBe("camel-block");
  });
});

describe("allowance helpers", () => {
  const cfg = normalizePracticePortalConfig({
    allowed_products: ["timed_explore", "open_ended_explore"],
    timings: { timed_explore: [5, 10], timed_drill: [30] },
  });

  it("isPracticePortalProductAllowed respects config", () => {
    expect(isPracticePortalProductAllowed(cfg, "timed_explore")).toBe(true);
    expect(isPracticePortalProductAllowed(cfg, "open_ended_explore")).toBe(true);
    expect(isPracticePortalProductAllowed(cfg, "timed_drill")).toBe(false);
    expect(isPracticePortalProductAllowed(cfg, "open_ended_drill")).toBe(false);
    expect(isPracticePortalProductAllowed(cfg, "nope")).toBe(false);
  });

  it("isPracticePortalTimingAllowed for timed and open-ended", () => {
    expect(isPracticePortalTimingAllowed(cfg, "timed_explore", 5)).toBe(true);
    expect(isPracticePortalTimingAllowed(cfg, "timed_explore", 10)).toBe(true);
    expect(isPracticePortalTimingAllowed(cfg, "timed_explore", 30)).toBe(false);
    // open-ended ignores minutes
    expect(isPracticePortalTimingAllowed(cfg, "open_ended_explore", 999)).toBe(true);
    // disallowed product
    expect(isPracticePortalTimingAllowed(cfg, "timed_drill", 30)).toBe(false);
  });
});

describe("validatePracticePortalMintRequest", () => {
  const cfg = normalizePracticePortalConfig({
    allowed_products: [
      "open_ended_explore",
      "open_ended_drill",
      "timed_explore",
      "timed_drill",
    ],
    timings: {
      timed_explore: [5, 10, 30],
      timed_drill: [15, 30, 45],
    },
  });

  it("accepts allowed open-ended with block_id", () => {
    const v = validatePracticePortalMintRequest(cfg, {
      product_id: "open_ended_explore",
      block_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.product_id).toBe("open_ended_explore");
    expect(v.minutes).toBeNull();
    expect(v.launch).toEqual(resolveProductIntent("explore", "open_ended"));
    expect(v.block_id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });

  it("refuses open-ended without block_id when portal has no fixed block", () => {
    const v = validatePracticePortalMintRequest(cfg, {
      product_id: "open_ended_drill",
    });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.code).toBe("block_required");
  });

  it("accepts open-ended without visitor block_id when portal config has fixed block", () => {
    const fixed = normalizePracticePortalConfig({
      allowed_products: ["open_ended_explore"],
      block_id: "fixed-block-uuid",
    });
    const v = validatePracticePortalMintRequest(fixed, {
      product_id: "open_ended_explore",
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.block_id).toBe("fixed-block-uuid");

    // Visitor override still wins
    const override = validatePracticePortalMintRequest(fixed, {
      product_id: "open_ended_explore",
      block_id: "visitor-block",
    });
    expect(override.ok).toBe(true);
    if (!override.ok) return;
    expect(override.block_id).toBe("visitor-block");
  });

  it("accepts allowed timed product + timing; defaults minutes when omitted", () => {
    const explicit = validatePracticePortalMintRequest(cfg, {
      product_id: "timed_explore",
      minutes: 10,
    });
    expect(explicit.ok).toBe(true);
    if (!explicit.ok) return;
    expect(explicit.minutes).toBe(10);
    expect(explicit.launch.product).toBe("tap");

    const def = validatePracticePortalMintRequest(cfg, {
      product_id: "timed_drill",
    });
    expect(def.ok).toBe(true);
    if (!def.ok) return;
    expect(def.minutes).toBe(15); // first in configured list
  });

  it("refuses disallowed product and disallowed timing", () => {
    const narrow = normalizePracticePortalConfig({
      allowed_products: ["timed_explore"],
      timings: { timed_explore: [10] },
    });

    const badProduct = validatePracticePortalMintRequest(narrow, {
      product_id: "timed_drill",
      minutes: 30,
    });
    expect(badProduct.ok).toBe(false);
    if (!badProduct.ok) expect(badProduct.code).toBe("product_not_allowed");

    const badTiming = validatePracticePortalMintRequest(narrow, {
      product_id: "timed_explore",
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
  it("maps timed explore/drill to TAP create body and open-ended to ILE", () => {
    const timedExplore = validatePracticePortalMintRequest(
      normalizePracticePortalConfig({
        allowed_products: ["timed_explore"],
        timings: { timed_explore: [10] },
      }),
      { product_id: "timed_explore", minutes: 10 },
    );
    expect(timedExplore.ok).toBe(true);
    if (!timedExplore.ok) return;
    const tap = practicePortalMintToCreateFields(timedExplore);
    expect(tap.linkKind).toBe("tap");
    expect(tap.body.minutes).toBe(10);
    expect(tap.body.participant_type).toBe("anonymous");
    expect(tap.body.interaction_kind).toBe(
      productIntentToCreateFields(resolveProductIntent("explore", "timed")).interaction_kind,
    );

    const timedDrill = validatePracticePortalMintRequest(
      normalizePracticePortalConfig({
        allowed_products: ["timed_drill"],
        timings: { timed_drill: [30] },
      }),
      { product_id: "timed_drill", minutes: 30 },
    );
    expect(timedDrill.ok).toBe(true);
    if (!timedDrill.ok) return;
    const tapDrill = practicePortalMintToCreateFields(timedDrill);
    expect(tapDrill.linkKind).toBe("tap");
    expect(tapDrill.body.exercise).toBe(true);

    const openEnded = validatePracticePortalMintRequest(
      normalizePracticePortalConfig({
        allowed_products: ["open_ended_drill"],
      }),
      {
        product_id: "open_ended_drill",
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
        allowed_products: ["timed_explore", "open_ended_explore"],
        timings: { timed_explore: [5, 10], timed_drill: [45] },
        block_id: null,
      },
      workspace: { id: "ws-1", title: "Algebra", root_topic: "Math" },
      blocks: [{ id: "b1", title: "Intro", is_start: true }],
      portal_id: "portal-1",
    });
    expect(view.products.map((p) => p.id)).toEqual([
      "open_ended_explore",
      "timed_explore",
    ]);
    const timed = view.products.find((p) => p.id === "timed_explore");
    expect(timed?.timings).toEqual([5, 10]);
    // drill timings not exposed when product disabled
    expect(view.products.some((p) => p.id === "timed_drill")).toBe(false);
    expect(view.workspace.title).toBe("Algebra");
    expect(view.blocks[0].is_start).toBe(true);
    expect(view.fixed_block_id).toBeNull();
  });

  it("landing view surfaces fixed block and filters blocks list", () => {
    const view = buildPracticePortalLandingView({
      config: {
        allowed_products: ["open_ended_explore"],
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
    expect(view.blocks.map((b) => b.id)).toEqual(["b2"]);
  });

  it("buildPracticePortalUrl uses /portal/{token} (not practice-portal)", () => {
    expect(PRACTICE_PORTAL_PUBLIC_PATH).toBe("portal");
    expect(buildPracticePortalUrl("https://app.example.com/", "tok123")).toBe(
      "https://app.example.com/portal/tok123",
    );
    expect(buildPracticePortalUrl("https://app.example.com/", "tok123")).not.toContain(
      "practice-portal",
    );
    expect(parsePracticePortalProductId("TIMED_DRILL")).toBe("timed_drill");
    expect(launchTargetForPracticePortalProduct("open_ended_explore").product).toBe(
      "ile",
    );
    expect(launchTargetForPracticePortalProduct("timed_drill").interaction_kind).toBe(
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
    expect(portalPanel).toMatch(/data-practice-portal-block/);
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
    expect(landingClient).toMatch(/Knowledge Portal/);
    expect(landingClient).toMatch(
      /Choose the session type that best fits your style/,
    );
    expect(landingClient).not.toMatch(/save it before you start/i);
    expect(landingClient).not.toMatch(/PRACTICE PORTAL/);
    expect(landingClient).toMatch(/fixedBlockId|data-practice-portal-block-fixed/);

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
