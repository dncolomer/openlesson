/**
 * AYCL list + landing: lifetime system updates & platform improvements claim.
 * Catalog list uses compact key points; landing keeps claim near summary/CTA.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ayclCatalogKeyPoints,
  ayclLifetimeSystemUpdatesClaim,
  ayclLifetimeSystemUpdatesFootnote,
  ayclLifetimeSystemUpdatesHeroLine,
} from "@/lib/aycl-shared";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.AYCL_LIFETIME_UPDATES_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-4b23b2d6dbdd/implementer";

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

describe("aycl lifetime system updates copy", () => {
  it("shipped helpers name lifetime + system updates + platform improvements", () => {
    const claim = ayclLifetimeSystemUpdatesClaim();
    const hero = ayclLifetimeSystemUpdatesHeroLine();
    const footnote = ayclLifetimeSystemUpdatesFootnote();

    for (const line of [claim, hero, footnote]) {
      expect(line.toLowerCase()).toMatch(/lifetime/);
      expect(line.toLowerCase()).toMatch(/system update|platform improvement/);
    }
    expect(claim.toLowerCase()).toMatch(/system updates/);
    expect(claim.toLowerCase()).toMatch(/platform improvements/);
    expect(footnote).toMatch(/private fork/i);

    writeEvidence(
      "aycl-lifetime-updates-copy.log",
      [
        "claim=" + claim,
        "hero=" + hero,
        "footnote=" + footnote,
        "has_lifetime=" + /lifetime/i.test(claim),
        "has_system_updates=" + /system updates/i.test(claim),
        "has_platform_improvements=" + /platform improvements/i.test(claim),
      ].join("\n"),
    );
  });

  it("landing keeps claim near summary/CTA; listing uses compact key points + footnote", () => {
    const listing = read("app/all-you-can-learn/page.tsx");
    const landing = read("components/AyclLandingClient.tsx");
    const shared = read("lib/aycl-shared.ts");

    expect(shared).toContain("ayclLifetimeSystemUpdatesClaim");
    expect(shared).toContain("ayclLifetimeSystemUpdatesFootnote");
    expect(shared).toContain("ayclCatalogKeyPoints");
    expect(shared).toMatch(/lifetime system updates/i);
    expect(shared).toMatch(/platform improvements/i);

    // Landing still has full claim stack
    expect(landing).toContain("ayclLifetimeSystemUpdatesClaim");
    expect(landing).toContain("ayclLifetimeSystemUpdatesHeroLine");
    expect(landing).toContain("ayclLifetimeSystemUpdatesFootnote");
    expect(landing).toContain("data-aycl-lifetime-updates");
    expect(landing).toContain("data-aycl-lifetime-updates-claim");
    expect(landing).toContain("data-aycl-lifetime-updates-footnote");

    // Catalog: compact box + card footnote (not three long hero paragraphs)
    expect(listing).toContain("ayclCatalogKeyPoints");
    expect(listing).toContain("data-aycl-catalog-key-points");
    expect(listing).toContain("ayclLifetimeSystemUpdatesFootnote");
    expect(listing).toContain("data-aycl-lifetime-updates-footnote");
    expect(listing).not.toContain("ayclLifetimeSystemUpdatesClaim");
    expect(listing).not.toContain("ayclLifetimeSystemUpdatesHeroLine");
    expect(listing).not.toMatch(
      /For people who binge-learn for the sake of learning/,
    );
    expect(listing).not.toMatch(
      /Each package below is an editorially curated/,
    );

    const points = ayclCatalogKeyPoints();
    expect(points.length).toBeGreaterThanOrEqual(3);
    expect(points.length).toBeLessThanOrEqual(5);
    const joined = points.join(" ").toLowerCase();
    expect(joined).toMatch(/curiosity|credential|deadline/);
    expect(joined).toMatch(/system updates|platform improvements/);

    writeEvidence(
      "aycl-lifetime-updates-ui.log",
      [
        "landing_full_claim=true",
        "listing_compact_keypoints=true",
        "listing_footnote=true",
        "key_points=" + points.join(" | "),
      ].join("\n"),
    );
  });
});

describe("aycl compact catalog hero", () => {
  it("boxed key points then course cards; no multi-paragraph wall", () => {
    const listing = read("app/all-you-can-learn/page.tsx");
    const points = ayclCatalogKeyPoints();

    expect(listing).toContain("data-aycl-catalog-key-points");
    expect(listing).toContain("data-aycl-catalog-card");
    expect(listing).toContain("ayclCatalogKeyPoints()");

    // Order: H1 then key points then catalog cards
    const h1 = listing.indexOf("All-You-Can-Learn");
    const box = listing.indexOf("data-aycl-catalog-key-points");
    const cards = listing.indexOf("data-aycl-catalog-card");
    expect(h1).toBeGreaterThan(-1);
    expect(box).toBeGreaterThan(h1);
    expect(cards).toBeGreaterThan(box);

    // No mid-page "Curated learning environments" lead-in wall
    expect(listing).not.toContain("Curated learning environments");
    expect(listing).not.toMatch(
      /Choose practice-only access \(fixed private copy\)/,
    );

    expect(points.every((p) => p.length < 120)).toBe(true);

    writeEvidence(
      "aycl-compact-hero.log",
      [
        "points_count=" + points.length,
        "points=" + JSON.stringify(points),
        "h1_before_box=" + (h1 < box),
        "box_before_cards=" + (box < cards),
        "no_binge_paragraph=" +
          !/For people who binge-learn for the sake of learning/.test(listing),
        "no_curated_lead=" + !listing.includes("Curated learning environments"),
      ].join("\n"),
    );
  });

  it("hero polish: richer chrome while short bullets remain", () => {
    const listing = read("app/all-you-can-learn/page.tsx");
    const points = ayclCatalogKeyPoints();

    expect(listing).toContain("data-aycl-catalog-hero");
    expect(listing).toContain("data-aycl-catalog-key-points");
    expect(listing).toContain("data-aycl-catalog-key-point");
    // Visual polish markers (beyond bare border+list)
    expect(listing).toMatch(/rounded-2xl/);
    expect(listing).toMatch(/bg-gradient-to-b|bg-gradient-to-br|blur-3xl/);
    expect(listing).toMatch(/sm:grid-cols-2/);
    expect(listing).toContain("data-aycl-catalog-key-point-index");
    // Still compact: no long prose wall
    expect(listing).not.toMatch(
      /For people who binge-learn for the sake of learning/,
    );
    expect(points.length).toBeLessThanOrEqual(5);
    const joined = points.join(" ").toLowerCase();
    expect(joined).toMatch(/curiosity|credential|deadline/);
    expect(joined).toMatch(/system updates|platform improvements/);

    const hero = listing.indexOf("data-aycl-catalog-hero");
    const cards = listing.indexOf("data-aycl-catalog-card");
    expect(hero).toBeGreaterThan(-1);
    expect(cards).toBeGreaterThan(hero);

    writeEvidence(
      "aycl-hero-polish-ui.log",
      [
        "hero_marker=true",
        "key_points_marker=true",
        "grid_2col=true",
        "gradient_or_blur=true",
        "points_count=" + points.length,
        "hero_before_cards=" + (hero < cards),
        "no_long_binge_prose=true",
      ].join("\n"),
    );
  });
});
