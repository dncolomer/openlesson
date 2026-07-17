import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { AdminLoading } from "@/components/admin/AdminStatus";

const REPO_ROOT = path.resolve(__dirname, "../..");

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

/** Full-page / primary gate screens that must use the shared CREATING WORKSPACE treatment. */
const GATE_FILES = [
  "app/dashboard/page.tsx",
  "app/dashboard/partner/page.tsx",
  "app/workspaces/page.tsx",
  "app/plans/page.tsx",
  "app/organization/page.tsx",
  "app/invite/[token]/page.tsx",
  "app/labs/layout.tsx",
  "app/session/page.tsx",
  "app/results/page.tsx",
  "app/session/analytics/page.tsx",
  "app/learn/[token]/session/page.tsx",
  "app/login/page.tsx",
  "app/all-you-can-learn/success/page.tsx",
  "app/all-you-can-learn/page.tsx",
  "app/workspace/new/page.tsx",
  "components/SessionView.tsx",
  "components/WorkspaceView.tsx",
  "components/admin/AdminStatus.tsx",
  "components/InsightsDashboardTab.tsx",
  "components/InsightDetailClient.tsx",
  "components/WorkspaceFilesTab.tsx",
  "components/SessionHeliosPanel.tsx",
  "components/ChapterMapPanel.tsx",
  "components/orbit/OrbitApp.tsx",
  "components/ProofOfWorkApiDemo.tsx",
  "app/admin/workspaces/[workspaceId]/page.tsx",
  "app/admin/partners/page.tsx",
  "app/admin/organizations/[orgId]/page.tsx",
] as const;

describe("LoadingStatusMessage (CREATING WORKSPACE treatment)", () => {
  it("renders mono uppercase label with three staggered bounce dots", () => {
    const html = renderToStaticMarkup(
      createElement(LoadingStatusMessage, { message: "Creating workspace" }),
    );

    expect(html).toContain("font-mono");
    expect(html).toContain("uppercase");
    expect(html).toContain("animate-pulse");
    expect(html).toContain("Creating workspace");

    const bounceMatches = html.match(/animate-bounce/g) ?? [];
    expect(bounceMatches).toHaveLength(3);
    expect(html).toContain("animation-delay:120ms");
    expect(html).toContain("animation-delay:240ms");

    // Three literal dots for the staggered "..." animation
    const dotSpans = html.match(/>\.<\/span>/g) ?? [];
    expect(dotSpans.length).toBeGreaterThanOrEqual(3);
  });

  it("strips trailing ellipsis so callers can pass Loading...", () => {
    const html = renderToStaticMarkup(
      createElement(LoadingStatusMessage, { message: "Loading..." }),
    );
    expect(html).toContain("Loading");
    expect(html).not.toMatch(/Loading\.\.\./);
  });

  it("AdminLoading composes LoadingStatusMessage (shared admin gate)", () => {
    const html = renderToStaticMarkup(createElement(AdminLoading));
    expect(html).toContain("font-mono");
    expect(html).toContain("uppercase");
    expect(html).toContain("animate-pulse");
    expect((html.match(/animate-bounce/g) ?? []).length).toBe(3);
    expect(html).toContain("Loading");
  });
});

describe("Loading gate call sites use shared treatment", () => {
  it("each primary gate file imports LoadingStatusMessage or AdminLoading", () => {
    const offenders: string[] = [];
    for (const file of GATE_FILES) {
      const source = readRepoFile(file);
      const usesShared =
        source.includes("LoadingStatusMessage") || source.includes("AdminLoading");
      if (!usesShared) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("primary min-h-screen centered gates are not spinner-only or bare Loading text", () => {
    // Structural scan: files with a full-viewport centered shell should compose the shared loader.
    // Error / empty states (notFound, Please log in) are allowed without LoadingStatusMessage.
    const scanRoots = ["app", "components"];
    const spinnerOnlyGate = /min-h-screen[^>]{0,120}justify-center[\s\S]{0,400}animate-spin/;
    const bareLoadingGate =
      /min-h-screen[^>]{0,120}justify-center[\s\S]{0,200}(Loading insight|Loading\.\.\.|Loading workspace)/i;

    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "api") continue;
          walk(rel);
          continue;
        }
        if (!entry.name.endsWith(".tsx")) continue;
        const source = readRepoFile(rel);
        if (!source.includes("min-h-screen")) continue;
        if (source.includes("LoadingStatusMessage") || source.includes("AdminLoading")) continue;
        if (spinnerOnlyGate.test(source) || bareLoadingGate.test(source)) {
          offenders.push(rel);
        }
      }
    }
    for (const root of scanRoots) walk(root);
    expect(offenders).toEqual([]);
  });

  it("shared component source keeps mono + three delayed bounce dots", () => {
    const source = readRepoFile("components/LoadingStatusMessage.tsx");
    expect(source).toContain("font-mono uppercase");
    expect(source).toContain("animate-pulse");
    expect(source).toContain("animate-bounce");
    expect(source).toContain('animationDelay: "120ms"');
    expect(source).toContain('animationDelay: "240ms"');
    // Exactly three bounce dots
    const bounceCount = (source.match(/animate-bounce/g) ?? []).length;
    expect(bounceCount).toBe(3);
  });
});
