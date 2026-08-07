/**
 * TAPBench project landing (Projects & Community) + Knowledge Links placement.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("TAPBench project landing", () => {
  it("ships public landing at /tapbench with dual-purpose copy and Map of Knowledge link", () => {
    expect(existsSync(join(ROOT, "app/tapbench/page.tsx"))).toBe(true);
    const page = read("app/tapbench/page.tsx");
    expect(page).toContain("LandingNav");
    expect(page).toContain("Footer");
    expect(page).toContain('bg-[#0a0a0a]');
    expect(page).toContain("data-tapbench-project-landing");
    expect(page).toContain("data-tapbench-landing-kicker");
    expect(page).toContain("TAPBENCH");
    expect(page).toContain("data-tapbench-landing-purpose-a");
    expect(page).toContain("data-tapbench-landing-purpose-b");
    expect(page).toMatch(/Think Aloud Protocol|agent/i);
    expect(page).toMatch(/Map of Knowledge|map of knowledge/i);
    expect(page).toContain('href="/map-of-knowledge"');
    expect(page).toContain("data-tapbench-landing-map-link");
    // Stash/Submit special + example timeline
    expect(page).toContain("data-tapbench-landing-special");
    expect(page).toContain("data-tapbench-landing-stash-submit");
    expect(page).toMatch(/Stash and Submit|What makes TAPBench special/i);
    expect(page).toContain("System 1");
    expect(page).toContain("System 2");
    expect(page).toContain("data-tapbench-landing-timeline");
    expect(page).toContain("data-tapbench-timeline-step");
    // Results coming soon + contact CTA
    expect(page).toContain("data-tapbench-landing-results");
    expect(page).toContain("data-tapbench-results-coming-soon");
    expect(page).toContain("data-tapbench-results-placeholder");
    expect(page).toContain("COMING SOON");
    expect(page).toContain("Recent benchmark results");
    expect(page).not.toContain("data-tapbench-results-table");
    expect(page).toContain("data-tapbench-landing-cta");
    expect(page).toContain("data-tapbench-landing-cta-email");
    expect(page).toContain("mailto:tapbench@uncertain.systems");
    expect(page).toContain("tapbench@uncertain.systems");
    // No em dashes in landing copy (learner-facing JSX strings)
    const withoutComments = page
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    // Unicode em dash U+2014
    expect(withoutComments).not.toMatch(/\u2014/);
  });

  it("is linked from Projects & Community nav (LandingNav + Navbar)", () => {
    const landing = read("components/LandingNav.tsx");
    expect(landing).toContain('href: "/tapbench"');
    expect(landing).toContain("TAPBench");
    const nav = read("components/Navbar.tsx");
    expect(nav).toContain('href: "/tapbench"');
    expect(nav).toContain("TAPBench");
  });
});

describe("TAPBench operator UI under Knowledge Links", () => {
  it("Knowledge Links hosts mint/list/skills download in Create + Browse only", () => {
    const guest = read("components/WorkspaceGuestLinksPanel.tsx");
    // No standalone third TAPBench tab — folded into Create + Browse
    expect(guest).not.toContain('id: "tapbench" as const');
    expect(guest).not.toContain('data-guest-links-inner-tab="tapbench"');
    expect(guest).toContain('data-guest-links-inner-tab="create"');
    expect(guest).toContain('data-guest-links-inner-tab="browse"');
    expect(guest).toContain("data-tapbench-mint");
    expect(guest).toContain("data-create-tapbench-link");
    expect(guest).toContain("data-tapbench-links-list");
    expect(guest).toContain("data-copy-tapbench-link");
    expect(guest).toContain("data-download-tapbench-skills");
    expect(guest).toContain("data-tapbench-skills-md");
    expect(guest).toContain("/api/workspace/tapbench-links");
    expect(guest).toContain("downloadTapbenchSkillsMarkdown");
    expect(guest).toContain("mintTapbenchLink");
    expect(guest).toContain('id: "tapbench"'); // product option in create form
  });

  it("Knowledge Regions no longer hosts TAPBench mint as a primary sub-tab", () => {
    const regions = read("components/CustomVerificationModelsPanel.tsx");
    expect(regions).not.toContain('id: "tapbench"');
    expect(regions).not.toContain("data-create-tapbench-link");
    expect(regions).not.toContain("data-tapbench-mint");
    expect(regions).toContain("data-region-builder");
    expect(regions).toContain("data-region-source-filter");
    // Still can filter by tapbench PoW when building regions
    expect(regions).toContain('value="tapbench"');
  });
});
