import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  insightsListUrl,
  resolveInsightSurfaceCapabilities,
  workspaceKnowledgeInsightsPath,
} from "@/lib/insights";

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
  const tapClient = fs.readFileSync(path.join(REPO_ROOT, "components/TapScoreClient.tsx"), "utf8");
  const sessionView = fs.readFileSync(path.join(REPO_ROOT, "components/SessionView.tsx"), "utf8");
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
    expect(performancePanel).toContain('"insights"');
    expect(performancePanel).toContain("<InsightsDashboardTab");
    expect(performancePanel).toContain("workspaceId={workspaceId}");
    expect(insightsTab).toContain("insightsListUrl(workspaceId)");
    expect(insightsTab).toContain("workspaceId?: string");
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
    expect(tapClient).toContain('insightSurface="tap"');
    expect(tapClient).toContain("allowInsightGeneration={false}");
    expect(sessionView).toContain('insightSurface="ile"');
    expect(sessionView).toContain("allowInsightGeneration={true}");
  });

  it("does not link back to dashboard Insights; uses Knowledge path helper", () => {
    expect(thoughtMemory).not.toContain("/dashboard?tab=insights");
    expect(insightDetail).not.toContain("/dashboard?tab=insights");
    expect(insightDetail).toContain("workspaceKnowledgeInsightsPath");
    expect(thoughtMemory).toContain("workspaceKnowledgeInsightsPath");
  });
});
