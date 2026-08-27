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
  it("ships a short-label Benchmark LP: results, tasks, skill, keys", () => {
    expect(existsSync(join(ROOT, "supabase/migrations/20260826140000_tapbench_benchmark.sql"))).toBe(
      true,
    );
    const keysSql = read("supabase/migrations/20260826140000_tapbench_benchmark.sql");
    const stoppedSql = read("supabase/migrations/20260826200000_tapbench_key_stopped_at.sql");
    const guestsSql = read("supabase/migrations/20260826220000_tapbench_key_guests.sql");
    expect(keysSql).toContain("CREATE TABLE public.tapbench_task_keys");
    expect(stoppedSql).toContain("stopped_at");
    expect(guestsSql).toContain("CREATE TABLE public.tapbench_key_guests");
    expect(existsSync(join(ROOT, "app/tapbench/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "components/TapbenchLanding.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "app/tapbench/results/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/TapbenchResultsBrowse.tsx"))).toBe(false);
    const page = read("app/tapbench/page.tsx");
    const landing = read("components/TapbenchLanding.tsx");
    const experiment = read("components/TapbenchExperimentTutorial.tsx");
    const intro = read("components/TapbenchResultsIntro.tsx");
    const shell = read("components/TapbenchShell.tsx");
    const table = read("components/TapbenchResultsTable.tsx");
    const surface = `${page}\n${landing}\n${experiment}\n${intro}\n${shell}\n${table}`;
    expect(page).toContain("TapbenchLanding");
    expect(page).toContain("loadTapbenchLandingData");
    expect(shell).toContain("LandingNav");
    expect(shell).toContain("Footer");
    expect(shell).toContain("bg-[#0a0a0a]");
    expect(shell).toContain("data-tapbench-project-landing");
    expect(landing).toContain("data-tapbench-landing-kicker");
    expect(landing).toContain("TAPBENCH");
    expect(landing).not.toContain("Browse tasks");
    expect(landing).not.toContain("data-tapbench-benchmark-tasks");
    expect(landing).not.toContain("data-tapbench-how-to");
    expect(landing).toContain('label: "How to run"');
    expect(experiment).not.toContain("data-tapbench-how-to");
    expect(experiment).not.toMatch(/<h2[\s\S]*How to run/);
    expect(landing).toContain("TapbenchExperimentTutorial");
    expect(landing).toContain("TapbenchResultsIntro");
    expect(landing).toContain("data-tapbench-tabs");
    expect(landing).toContain('id: "tapbench"');
    expect(landing).toContain('id: "results"');
    expect(landing).toContain('label: "ScoreBoard"');
    expect(landing).toContain('id: "experiment"');
    expect(landing).toContain("data-tapbench-tab={item.id}");
    expect(landing).toContain("data-tapbench-landing-about");
    expect(intro).toContain("data-tapbench-results-intro");
    expect(intro).not.toContain("data-tapbench-video-placeholder");
    expect(intro).not.toContain("data-tapbench-knowledge-map");
    expect(intro).not.toContain("/tapbench/knowledge-map.jpg");
    expect(intro).toContain('src="/knowledgeg2.png"');
    expect(intro).toContain("data-tapbench-kv-image");
    expect(intro).not.toContain("md:float-right");
    expect(intro.indexOf("data-tapbench-utility")).toBeLessThan(
      intro.indexOf("data-tapbench-kv-image"),
    );
    expect(intro).toContain("Think-Aloud Protocol");
    expect(intro).toContain("verify knowledge and capability without ground truth");
    expect(intro).toContain("knowledge configuration space");
    expect(intro).toContain("data-tapbench-utility");
    expect(intro).toContain("list of agentic setups");
    expect(intro).toContain("human knowledge verification");
    expect(intro).toContain("Recruitment, team building");
    expect(intro).toContain("agentic knowledge verification in a broader sense");
    expect(intro).toContain("is this person, or this agent, good at math?");
    expect(intro).toContain("uncertainty the question can carry");
    expect(intro).not.toContain("Human pin");
    expect(intro).not.toContain("Agent traces");
    expect(intro).not.toContain("data-tapbench-run-steps");
    expect(intro).not.toContain("draw a region");
    expect(intro).not.toContain("data-tapbench-vs");
    expect(intro).not.toContain("Typical benches");
    expect(intro).toContain("<img");
    expect(intro).toContain("How to run is the overall process");
    expect(intro).not.toContain("data-tapbench-how-to");
    expect(experiment).toContain("data-tapbench-experiment");
    expect(experiment).toContain('className="w-full"');
    expect(experiment).not.toContain("max-w-3xl");
    expect(landing).toContain('data-tapbench-landing-results');
    expect(experiment).toContain("data-tapbench-experiment-tutorial");
    expect(experiment).toContain("data-tapbench-howto-run");
    expect(experiment).toContain("data-tapbench-howto-steps");
    expect(experiment).toContain("<table");
    expect(experiment).not.toContain("lg:grid-cols-5");
    expect(experiment).not.toContain("data-tapbench-experiment-snippet");
    expect(surface).not.toContain("data-tapbench-experiment-step");
    expect(landing).not.toContain("/tapbench/experiment-mint.jpg");
    expect(landing).not.toContain("/tapbench/experiment-tap.jpg");
    expect(landing).toContain("Think-Aloud Protocol + Benchmark");
    expect(landing).toContain("measuring knowledge");
    expect(landing).toContain("configuration space");
    expect(experiment).not.toContain("/tapbench/experiment-mint.jpg");
    expect(experiment).not.toContain("guest_user_id");
    expect(experiment).not.toContain("X-Tapbench-Guest");
    expect(experiment).not.toContain("/api/v3/");
    expect(experiment).not.toContain("knowledgecfg-v1-d64");
    expect(experiment).not.toContain("<pre");
    expect(experiment).not.toContain("<code>");
    expect(experiment).toContain("Pick a task");
    expect(experiment).toContain("Instruct the agent");
    expect(experiment).toContain("free to instruct your agent");
    expect(experiment).toContain("reference goal");
    expect(experiment).toContain("Think aloud, several times");
    expect(experiment).toContain("Snapshot the runs");
    expect(experiment).toContain("Build a region");
    const bodyStart = landing.indexOf("return (");
    const resultsAt = landing.indexOf("data-tapbench-landing-results", bodyStart);
    const experimentAt = landing.indexOf("<TapbenchExperimentTutorial", bodyStart);
    expect(resultsAt).toBeGreaterThan(-1);
    expect(experimentAt).toBeGreaterThan(resultsAt);
    expect(table).toContain("data-tapbench-owner-distance-note");
    expect(table).toContain("TAPBench key");
    expect(table).toContain("data-tapbench-key-obtain");
    expect(table).toContain("skills.md");
    expect(table).toContain("data-tapbench-download-skill");
    expect(table).toContain("data-tapbench-issue-key");
    expect(table).toContain("tapbenchWorkspaceHref");
    expect(landing).not.toContain("data-tapbench-task-select");
    expect(landing).toContain("workspace_ids");
    expect(landing).not.toContain("/api/v3/tapbench/tasks/{workspace_id}/runs");
    expect(landing).toContain("TAPBENCH_API_BASE");
    expect(landing).not.toContain("/tapbench/results");
    expect(landing).toContain("data-tapbench-landing-results");
    expect(landing).toContain("TapbenchResultsTable");
    expect(table).toContain("data-tapbench-results-table");
    expect(table).not.toContain("data-tapbench-col-filter");
    expect(table).not.toContain("data-tapbench-pagination");
    expect(existsSync(join(ROOT, "app/tapbench/workspace/[id]/page.tsx"))).toBe(true);
    expect(surface).not.toContain("data-tapbench-results-coming-soon");
    expect(surface).not.toContain("data-tapbench-results-placeholder");
    expect(landing).not.toContain("COMING SOON");
    expect(landing).not.toContain("Submit a run");
    expect(landing).not.toContain("data-tapbench-run-form");
    expect(landing).not.toContain("Host a TAPBench Task");
    expect(landing).not.toContain("data-tapbench-landing-cta");
    const withoutComments = `${landing}\n${experiment}\n${intro}`
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    expect(withoutComments).not.toMatch(/\u2014/);
  });

  it("keeps /tapbench/[token] session resolve", () => {
    expect(existsSync(join(ROOT, "app/tapbench/[token]/page.tsx"))).toBe(true);
    const tokenPage = read("app/tapbench/[token]/page.tsx");
    expect(tokenPage).toContain("resolveTapbenchSessionToken");
    expect(tokenPage).toContain("data-tapbench-exercise");
  });

  it("is linked from Projects & Community nav (LandingNav + Navbar)", () => {
    const landing = read("components/LandingNav.tsx");
    const navLinks = read("lib/marketing/nav.ts");
    expect(landing).toContain("COMMUNITY_LINKS");
    expect(navLinks).toContain("TAPBENCH_PATH");
    expect(navLinks).toContain("TAPBench");
    const nav = read("components/Navbar.tsx");
    expect(nav).toContain('href: "/tapbench"');
    expect(nav).toContain("TAPBench");
  });
});

describe("TAPBench operator UI is the public /tapbench page", () => {
  it("Knowledge Links mints TAP and ILE only — not TAPBench links", () => {
    const guest = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(guest).not.toContain('id: "tapbench" as const');
    expect(guest).not.toContain('data-guest-links-inner-tab="tapbench"');
    expect(guest).toContain('data-guest-links-inner-tab="create"');
    expect(guest).toContain('data-guest-links-inner-tab="browse"');
    expect(guest).not.toContain("data-tapbench-mint");
    expect(guest).not.toContain("data-create-tapbench-link");
    expect(guest).not.toContain("data-tapbench-links-list");
    expect(guest).not.toContain("/api/workspace/tapbench-links");
    expect(guest).not.toContain("mintTapbenchLink");
    expect(guest).toContain("/api/workspace/tap-links");
    expect(guest).toContain("/api/workspace/ile-links");
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
