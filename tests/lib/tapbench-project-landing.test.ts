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
    const shell = read("components/TapbenchShell.tsx");
    const table = read("components/TapbenchResultsTable.tsx");
    const surface = `${page}\n${landing}\n${experiment}\n${shell}\n${table}`;
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
    expect(landing).not.toContain("How to");
    expect(experiment).not.toContain("data-tapbench-how-to");
    expect(experiment).not.toContain("How to");
    expect(landing).toContain("TapbenchExperimentTutorial");
    expect(experiment).toContain("data-tapbench-experiment");
    expect(experiment).toContain('className="mt-14 w-full"');
    expect(experiment).not.toContain("max-w-3xl");
    expect(landing).toContain('data-tapbench-landing-results');
    expect(landing).toContain("mt-10 w-full");
    expect(experiment).toContain("data-tapbench-experiment-tutorial");
    expect(experiment).toContain("data-tapbench-experiment-snippet");
    expect(surface).not.toContain("data-tapbench-experiment-step");
    expect(landing).not.toContain("/tapbench/experiment-mint.jpg");
    expect(landing).not.toContain("/tapbench/experiment-tap.jpg");
    expect(experiment).not.toContain("/tapbench/experiment-mint.jpg");
    expect(experiment).toContain("guest_user_id");
    expect(experiment).toContain("X-Tapbench-Guest");
    expect(experiment).toContain("/api/v3/stash/workspaces/{workspace_id}/proof-of-work");
    expect(experiment).toContain("/api/v3/stash/workspaces/{workspace_id}/stash");
    expect(experiment).toContain("/api/v3/stash/workspaces/{workspace_id}/submit");
    expect(experiment).toContain("/api/v3/tapbench/tasks/{workspace_id}/snapshot");
    expect(experiment).toContain("/api/v3/tapbench/tasks/{workspace_id}/region");
    expect(experiment).toContain("tbk_");
    expect(experiment).toContain("knowledgecfg-v1-d64");
    expect(experiment).toContain("tapbench@uncertain.systems");
    expect(experiment).toContain("<pre");
    expect(experiment).toContain("<code>");
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
    const withoutComments = `${landing}\n${experiment}`
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
    expect(navLinks).toContain('href: "/tapbench"');
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
