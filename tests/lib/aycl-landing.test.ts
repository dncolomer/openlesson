/**
 * AYCL public landing: summary payload, view-only map flags, explore samples
 * parse/fallback, checkout body, hackathons page + listing links.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ayclLandingCheckoutBody,
  ayclLandingOgImagePath,
  ayclLandingPath,
  ayclLandingPracticeContext,
  assembleAyclLandingSummary,
  AYCL_HACKATHONS,
  buildAyclExploreLearnFallback,
  buildAyclExploreLearnSystemPrompt,
  buildAyclExploreLearnUserPrompt,
  parseAyclExploreLearnSamples,
} from "@/lib/aycl-landing";
import { isMetaLearningFluff } from "@/lib/practice-item-builders";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.AYCL_LANDING_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-1c24fded0075/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

const fixtureWorkspace = {
  id: "ws-aycl-1",
  title: "Bayesian clinical reasoning",
  root_topic: "Bayes",
  description:
    "Update clinical beliefs from diagnostic test evidence with transparent reasoning.",
  workspace_goal: "Update clinical beliefs from test evidence correctly",
  notes: "Focus on base rates and PPV.",
  cover_image_url: null,
  is_all_you_can_learn: true,
};

const fixtureBlocks = [
  {
    id: "b1",
    title: "Positive predictive value",
    description:
      "Compute PPV from sensitivity, specificity, and prevalence for a diagnostic test.",
    status: "available",
    is_start: true,
    next_block_ids: ["b2"],
    position_x: 0,
    position_y: 0,
    span_w: 1,
    span_h: 1,
  },
  {
    id: "b2",
    title: "Base rates",
    description: "How prevalence dominates posterior risk.",
    status: "available",
    is_start: false,
    next_block_ids: [],
    position_x: 1,
    position_y: 0,
    span_w: 1,
    span_h: 1,
  },
];

describe("aycl landing model", () => {
  it("assembles summary, view-only map, offers, and checkout body", () => {
    const landing = assembleAyclLandingSummary({
      workspace: fixtureWorkspace,
      blocks: fixtureBlocks,
    });

    expect(landing.workspaceId).toBe("ws-aycl-1");
    expect(landing.title).toMatch(/Bayesian/i);
    expect(landing.summary).toMatch(/clinical|evidence|beliefs/i);
    expect(landing.blockCount).toBe(2);
    expect(landing.map.viewOnly).toBe(true);
    expect(landing.map.canEdit).toBe(false);
    expect(landing.map.learnerMode).toBe(false);
    expect(landing.map.nodes).toHaveLength(2);
    expect(landing.map.nodes[0].title).toMatch(/Positive predictive/i);
    expect(landing.offers.learner.tier).toBe("learner");
    expect(landing.offers.full.tier).toBe("full");
    expect(landing.offers.learner.priceLabel).toMatch(/\$/);
    expect(landing.paths.landingPath).toBe("/all-you-can-learn/ws-aycl-1");
    expect(landing.paths.ogImagePath).toBe(
      "/all-you-can-learn/ws-aycl-1/opengraph-image",
    );
    expect(ayclLandingPath("ws-aycl-1")).toBe("/all-you-can-learn/ws-aycl-1");
    expect(ayclLandingOgImagePath("ws-aycl-1")).toContain("opengraph-image");

    const body = ayclLandingCheckoutBody("ws-aycl-1", "learner");
    expect(body).toEqual({
      priceType: "all_you_can_learn",
      workspaceId: "ws-aycl-1",
      ayclAccessTier: "learner",
    });
    expect(ayclLandingCheckoutBody("ws-aycl-1", "full").ayclAccessTier).toBe(
      "full",
    );

    writeEvidence(
      "aycl-landing-model.log",
      [
        "title=" + landing.title,
        "summary=" + landing.summary.slice(0, 120),
        "blockCount=" + landing.blockCount,
        "viewOnly=" + landing.map.viewOnly,
        "canEdit=" + landing.map.canEdit,
        "landingPath=" + landing.paths.landingPath,
        "checkout=" + JSON.stringify(body),
      ].join("\n"),
    );
  });
});

describe("aycl explore/learn samples", () => {
  it("builds prompts, parses xAI JSON, rejects meta, falls back offline", () => {
    const landing = assembleAyclLandingSummary({
      workspace: fixtureWorkspace,
      blocks: fixtureBlocks,
    });
    const ctx = ayclLandingPracticeContext(landing, fixtureBlocks);
    const system = buildAyclExploreLearnSystemPrompt();
    const user = buildAyclExploreLearnUserPrompt(landing, fixtureBlocks);

    expect(system).toMatch(/Things you'll Explore and Learn|Explore and Learn/i);
    expect(system).toMatch(/core mechanism|FORBIDDEN|json/i);
    expect(user).toMatch(/Bayesian|PPV|clinical/i);

    const fallback = buildAyclExploreLearnFallback(ctx, 3);
    expect(fallback.questions).toHaveLength(3);
    expect(fallback.exercises).toHaveLength(3);
    for (const q of fallback.questions) {
      expect(isMetaLearningFluff(q)).toBe(false);
      expect(q).not.toMatch(/core mechanism|explain it precisely/i);
    }
    for (const ex of fallback.exercises) {
      expect(ex).toMatch(/Exercise:|PPV|sensitivity|prevalence|Bayes|clinical/i);
    }

    // Meta LLM junk → replaced via parse
    const parsed = parseAyclExploreLearnSamples(
      {
        questions: [
          'What is the core mechanism in "Bayes" — and how would you explain it precisely?',
          "Good concrete question: compute PPV when prevalence is 2%.",
        ],
        exercises: [
          "Solve a non-trivial problem in Bayes. State the problem you chose.",
          "Exercise: A test has sensitivity 0.9, specificity 0.95, prevalence 0.01. Compute PPV.",
        ],
      },
      ctx,
    );
    expect(parsed.questions).toHaveLength(3);
    expect(parsed.exercises).toHaveLength(3);
    expect(parsed.questions.every((q) => !isMetaLearningFluff(q))).toBe(true);
    expect(
      parsed.questions.some((q) => /PPV|prevalence|2%/i.test(q)),
    ).toBe(true);

    writeEvidence(
      "aycl-landing-explore-samples.log",
      [
        "system_has_forbidden=" + /FORBIDDEN|core mechanism/i.test(system),
        "fallback_q0=" + fallback.questions[0],
        "fallback_ex0=" + fallback.exercises[0].slice(0, 160),
        "parsed_q_count=" + parsed.questions.length,
        "parsed_no_meta=" +
          parsed.questions.every((q) => !isMetaLearningFluff(q)),
      ].join("\n"),
    );
  });
});

describe("aycl landing + hackathons structural", () => {
  it("listing links to landing; landing mounts map/explore/CTA/OG; hackathons own page + nav", () => {
    const listing = read("app/all-you-can-learn/page.tsx");
    const landingPage = read("app/all-you-can-learn/[workspaceId]/page.tsx");
    const landingClient = read("components/AyclLandingClient.tsx");
    const og = read("app/all-you-can-learn/[workspaceId]/opengraph-image.tsx");
    const apiLanding = read("app/api/aycl/workspaces/[id]/route.ts");
    const apiSamples = read(
      "app/api/aycl/workspaces/[id]/explore-samples/route.ts",
    );
    const grid = read("components/BlockSkillGrid.tsx");
    const nav = read("components/LandingNav.tsx");
    const hackathons = read("app/hackathons/page.tsx");
    const lib = read("lib/aycl-landing.ts");

    // Listing → dedicated landing
    expect(listing).toContain("ayclLandingPath");
    expect(listing).toContain("data-aycl-catalog-landing-link");
    expect(listing).not.toContain('id: "hackathons"');
    expect(listing).not.toContain("HackathonsTab");
    expect(listing).toContain("/hackathons");

    // Landing surface
    expect(landingPage).toContain("AyclLandingClient");
    expect(landingPage).toContain("generateMetadata");
    expect(landingPage).toContain("ayclLandingOgImagePath");
    expect(landingPage).toContain("openGraph");
    expect(landingClient).toContain("data-aycl-landing");
    expect(landingClient).toContain("data-aycl-landing-summary");
    expect(landingClient).toContain("data-aycl-landing-map");
    expect(landingClient).toContain("data-aycl-landing-explore-learn");
    expect(landingClient).toContain("data-aycl-landing-cta");
    expect(landingClient).toContain("Things you");
    expect(landingClient).toContain("viewOnly");
    expect(landingClient).toContain("canEdit={false}");
    expect(landingClient).toContain("explore-samples");
    expect(landingClient).toContain("ayclLandingCheckoutBody");
    expect(landingClient).toContain("data-aycl-checkout-full");

    // View-only map wiring
    expect(grid).toContain("viewOnly");
    expect(grid).toContain('data-map-view-only={viewOnly ? "true" : "false"}');
    expect(lib).toContain("viewOnly: true");
    expect(lib).toContain("canEdit: false");

    // OG dedicated route
    expect(og).toContain("composeOgImageFromSurface");
    expect(og).toContain("assembleAyclLandingSummary");
    expect(og).toContain("All-You-Can-Learn");

    // APIs
    expect(apiLanding).toContain("is_all_you_can_learn");
    expect(apiLanding).toContain("assembleAyclLandingSummary");
    expect(apiSamples).toContain("callXaiJSON");
    expect(apiSamples).toContain("buildAyclExploreLearnFallback");
    expect(apiSamples).toContain("parseAyclExploreLearnSamples");

    // Hackathons as Projects & Community page
    expect(hackathons).toContain("data-hackathons-page");
    expect(hackathons).toContain("Projects & Community");
    expect(hackathons).toContain("AYCL_HACKATHONS");
    expect(nav).toMatch(/href:\s*["']\/hackathons["']/);
    expect(nav).toContain("Hackathons");
    expect(AYCL_HACKATHONS.length).toBeGreaterThan(0);
    expect(AYCL_HACKATHONS[0].href).toContain("/hackathons/");

    // Event detail breadcrumbs / CTAs must not point at the removed AYCL tab
    const pcHackathon = read("app/hackathons/probabilistic-computing/page.tsx");
    expect(pcHackathon).not.toContain("/all-you-can-learn?tab=hackathons");
    expect(pcHackathon).toMatch(/href=["']\/hackathons["']/);
    // Breadcrumb + "All hackathons" both go to the Projects & Community page
    expect(
      (pcHackathon.match(/href=["']\/hackathons["']/g) || []).length,
    ).toBeGreaterThanOrEqual(2);

    writeEvidence(
      "aycl-landing-ui.log",
      [
        "listing_links_landing=true",
        "no_hackathons_tab_on_aycl=true",
        "landing_summary_map_explore_cta=true",
        "view_only_map=true",
        "og_route=true",
        "explore_samples_api=true",
        "hackathons_page=true",
        "nav_hackathons=true",
        "pc_hackathon_no_dead_tab=true",
        "pc_hackathon_links_to_hackathons_index=true",
      ].join("\n"),
    );
  });
});
