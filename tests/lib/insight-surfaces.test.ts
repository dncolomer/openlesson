import { describe, expect, it } from "vitest";
import { readSessionViewSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";
import fs from "node:fs";
import path from "node:path";
import {
  GENERATE_INSIGHTS_ACTION_LABEL,
  LEARNER_WORK_DRAWER_TITLE,
  buildGenerateInsightsSuggestBody,
  insightsListUrl,
  insightsTracesUrl,
  resolveInsightSurfaceCapabilities,
  workspaceKnowledgeInsightsPath,
  workspacePlayInsightsPath,
} from "@/lib/insights";
import { availableSectionsForMode } from "@/lib/workspace-mode";

const REPO_ROOT = path.resolve(__dirname, "../..");

describe("resolveInsightSurfaceCapabilities", () => {
  it("disables generation and list on TAP", () => {
    expect(resolveInsightSurfaceCapabilities("tap")).toEqual({
      allowInsightGeneration: false,
      allowInsightList: false,
    });
  });

  it("enables generation and list on ILE", () => {
    expect(resolveInsightSurfaceCapabilities("ile")).toEqual({
      allowInsightGeneration: true,
      allowInsightList: true,
    });
  });

  it("enables generation and list on Knowledge", () => {
    expect(resolveInsightSurfaceCapabilities("knowledge")).toEqual({
      allowInsightGeneration: true,
      allowInsightList: true,
    });
  });
});

describe("insightsListUrl", () => {
  it("scopes to workspaceId when provided", () => {
    expect(insightsListUrl("ws-123")).toBe("/api/insights?workspaceId=ws-123");
    expect(insightsListUrl("a b")).toBe("/api/insights?workspaceId=a%20b");
  });

  it("returns unscoped list URL without workspaceId", () => {
    expect(insightsListUrl()).toBe("/api/insights");
    expect(insightsListUrl(null)).toBe("/api/insights");
    expect(insightsListUrl(undefined)).toBe("/api/insights");
  });
});

describe("workspaceKnowledgeInsightsPath", () => {
  it("deep-links to Knowledge Insights subview", () => {
    expect(workspaceKnowledgeInsightsPath("abc")).toBe(
      "/workspace/abc?section=knowledge&subview=insights",
    );
  });
});

describe("Play-only Insights tab + Generate Insights", () => {
  it("lists Insights next to Knowledge in Play and omits it in Build", () => {
    expect(availableSectionsForMode({ mode: "learner", isLoggedIn: true })).toEqual([
      "workspace",
      "knowledge",
      "insights",
    ]);
    expect(
      availableSectionsForMode({ mode: "creator", isOwner: true, isLoggedIn: true }),
    ).not.toContain("insights");
    expect(workspacePlayInsightsPath("abc")).toBe("/workspace/abc?section=insights");
    expect(insightsTracesUrl("ws-1", "block-9")).toContain("blockId=block-9");
    expect(LEARNER_WORK_DRAWER_TITLE).toBe("Work");
    expect(GENERATE_INSIGHTS_ACTION_LABEL).toBe("Generate Insights");
    expect(
      buildGenerateInsightsSuggestBody({
        thoughts: [{ id: "t1", text: "one" }],
        modifyingPrompt: "focus on tradeoffs",
      }).modifyingPrompt,
    ).toBe("focus on tradeoffs");

    const nav = fs.readFileSync(
      path.join(REPO_ROOT, "components/workspace-view/workspace-section-nav-items.tsx"),
      "utf8",
    );
    const hosts = fs.readFileSync(
      path.join(REPO_ROOT, "components/workspace-view/workspace-section-hosts.tsx"),
      "utf8",
    );
    const learner = fs.readFileSync(
      path.join(REPO_ROOT, "components/WorkspaceLearnerBlockPane.tsx"),
      "utf8",
    );
    expect(nav).toContain('key: "insights"');
    expect(nav).toContain("isLearnerMode && visibleSections.includes(\"insights\")");
    expect(hosts).toContain("InsightsDashboardTab");
    expect(hosts).toContain("data-play-insights-tab");
    expect(hosts).toContain("mountsInsightsPanel");
    expect(learner).toContain("data-generate-insights-drawer");
    expect(learner).toContain("data-generate-insights-prompt");
    expect(learner).toContain(GENERATE_INSIGHTS_ACTION_LABEL);
  });
});

describe("shipped insight surface wiring", () => {
  const dashboard = fs.readFileSync(path.join(REPO_ROOT, "app/dashboard/page.tsx"), "utf8");
  const performancePanel = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspacePerformancePanel.tsx"),
    "utf8",
  );
  const insightsTab = fs.readFileSync(
    path.join(REPO_ROOT, "components/InsightsDashboardTab.tsx"),
    "utf8",
  );
  const thoughtMemory = fs.readFileSync(
    path.join(REPO_ROOT, "components/thought-ui/ThoughtMemoryPanel.tsx"),
    "utf8",
  );
  const tapClient = readTapScoreSurface();
  const sessionView = readSessionViewSurface();
  const insightDetail = fs.readFileSync(
    path.join(REPO_ROOT, "components/InsightDetailClient.tsx"),
    "utf8",
  );

  it("removes Insights from the Dashboard tab set and mount", () => {
    expect(dashboard).not.toContain("InsightsDashboardTab");
    expect(dashboard).not.toMatch(/id:\s*"insights"/);
    expect(dashboard).not.toContain('activeTab === "insights"');
    expect(dashboard).not.toMatch(/\|\s*"insights"/);
  });

  it("hosts workspace-scoped Insights inside Knowledge performance panel", () => {
    expect(insightsTab).toContain("insightsListUrl(workspaceId)");
    expect(insightsTab).toContain("workspaceId?: string");
    expect(insightsTab).toContain("export function InsightsDashboardTab");
  });

  it("lets Knowledge Insights tab generate suggestions and bookmark them", () => {
    expect(insightsTab).toContain("Generate insight suggestions");
    expect(insightsTab).toContain("Bookmark insight");
    expect(insightsTab).toContain("/api/insights/suggest");
    expect(insightsTab).toContain("/api/insights/create");
    expect(insightsTab).toContain("/api/insights/traces");
  });

  it("gates ThoughtMemoryPanel generation off for TAP and on for ILE", () => {
    expect(thoughtMemory).toContain("allowInsightGeneration");
    expect(thoughtMemory).toContain("resolveInsightSurfaceCapabilities");
    expect(thoughtMemory).toContain("generationEnabled");
    expect(thoughtMemory).toContain('insightSurface = "ile"');
    expect(tapClient).toContain("ThoughtMemoryPanel");
    expect(tapClient).toContain('insightSurface="tap"');
    expect(tapClient).toContain("allowInsightGeneration={false}");
    expect(resolveInsightSurfaceCapabilities("ile").allowInsightGeneration).toBe(true);
    expect(sessionView).not.toContain('insightSurface="tap"');
  });

  it("does not link back to dashboard Insights; uses Knowledge path helper", () => {
    expect(thoughtMemory).not.toContain("/dashboard?tab=insights");
    expect(insightDetail).not.toContain("/dashboard?tab=insights");
    expect(insightDetail).toContain("workspaceKnowledgeInsightsPath");
    expect(thoughtMemory).toContain("workspaceKnowledgeInsightsPath");
  });
});
