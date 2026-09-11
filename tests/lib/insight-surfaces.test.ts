import { describe, expect, it } from "vitest";
import { readSessionViewSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";
import fs from "node:fs";
import path from "node:path";
import {
  GENERATE_INSIGHTS_ACTION_LABEL,
  LEARNER_WORK_DRAWER_TITLE,
  buildGenerateInsightsSuggestBody,
  formatInsightDate,
  insightApiErrorMessage,
  insightPublicPath,
  insightsListUrl,
  insightsSessionListUrl,
  insightsTracesUrl,
  resolveInsightSurfaceCapabilities,
  workspaceKnowledgeInsightsPath,
  workspacePlayInsightsPath,
} from "@/lib/insights";
import {
  INSIGHT_FALLBACK_WORKSPACE_NAME,
  INSIGHT_HOME_HREF,
  INSIGHT_HOME_LABEL,
  INSIGHT_WORKSPACE_TITLE_COLUMNS,
  INSIGHT_WORKSPACE_TITLE_TABLE,
  buildInsightOgShareInput,
  deriveInsightPageStats,
  insightOgTitle,
  insightShareSocialMetadata,
  loadWorkspaceTitleForPublicInsight,
  resolvePublicInsightWorkspaceTitle,
  type InsightWorkspaceTitleClient,
} from "@/lib/insight-share";
import { UNSYS_STANDARD_SHARE_TITLE } from "@/lib/og/standard";
import {
  ILE_TURN_INSIGHT_CREATE_PATH,
  ILE_TURN_INSIGHT_EVALUATE_PATH,
} from "@/lib/ile-turn-insights";
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

describe("insightApiErrorMessage", () => {
  it("reads nested insight API envelopes instead of [object Object]", () => {
    const nested = {
      error: { code: "unauthorized", message: "Sign in to view insights" },
    };
    expect(String(nested.error)).toBe("[object Object]");
    expect(new Error(nested.error as unknown as string).message).toBe("[object Object]");
    expect(insightApiErrorMessage(nested, "Failed to load insights")).toBe(
      "Sign in to view insights",
    );
    expect(insightApiErrorMessage({ error: "plain" }, "Failed")).toBe("plain");
    expect(insightApiErrorMessage({ error: { code: "x" } }, "Failed to load insights")).toBe(
      "Failed to load insights",
    );
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
    expect(insightsTab).toContain("insightApiErrorMessage");
    expect(insightsTab).not.toContain("data.error ||");
    expect(insightsTab).toContain("border-red-900/50");
    const insightsLib = fs.readFileSync(path.join(REPO_ROOT, "lib/insights.ts"), "utf8");
    expect(insightsLib).toContain("insightApiErrorMessage(data, \"Failed to archive insight\")");
    expect(insightDetail).toContain("insightApiErrorMessage");
    expect(thoughtMemory).toContain("insightApiErrorMessage");
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

  it("plugs ILE turn crafts into existing insight list, share, and dedicated page", () => {
    expect(insightsSessionListUrl("sess-1")).toBe("/api/insights?sessionId=sess-1");
    expect(insightPublicPath({ id: "ins-1", share_token: "tok-1" })).toBe("/insights/tok-1");
    expect(workspacePlayInsightsPath("ws-1")).toBe("/workspace/ws-1?section=insights");
    expect(ILE_TURN_INSIGHT_EVALUATE_PATH).toBe("/api/insights/evaluate");
    expect(ILE_TURN_INSIGHT_CREATE_PATH).toBe("/api/insights/create");

    const create = fs.readFileSync(
      path.join(REPO_ROOT, "app/api/insights/create/route.ts"),
      "utf8",
    );
    const list = fs.readFileSync(path.join(REPO_ROOT, "app/api/insights/route.ts"), "utf8");
    const evaluate = fs.readFileSync(
      path.join(REPO_ROOT, "app/api/insights/evaluate/route.ts"),
      "utf8",
    );
    const craft = fs.readFileSync(
      path.join(REPO_ROOT, "components/session-view/ile-turn-insight-craft.tsx"),
      "utf8",
    );
    expect(create).toContain("buildInsightCreateInsert");
    expect(create).toContain("chapterId");
    expect(create).toContain("evaluated");
    expect(list).toContain('searchParams.get("sessionId")');
    expect(list).toContain('.eq("session_id", sessionId)');
    expect(evaluate).toContain("allowIleTypedInsightCreate");
    expect(craft).toContain("insightPublicPath");
    expect(craft).toContain("buildIleTurnInsightPersistPayload");
    expect(sessionView).toContain("IleTurnInsightCraft");
    expect(sessionView).toContain("insightsSessionListUrl");
    expect(insightDetail).toContain("insightPublicPath");
  });
});

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-b71abb24c7f9/implementer";

function writeScratch(name: string, body: string) {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(path.join(SCRATCH, name), body, "utf8");
}

describe("public insight OG title + page stats", () => {
  it("composes OG title from the public insight, not the unsys standard card", () => {
    const title = "Gradient descent as a story";
    const summary = "A walk through the loss basin.";
    const input = buildInsightOgShareInput({
      id: "ins-1",
      title,
      summary,
      aesthetic_image: "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg",
    });
    expect(insightOgTitle({ title })).toBe(title);
    expect(input.title).toBe(title);
    expect(input.title).not.toBe(UNSYS_STANDARD_SHARE_TITLE);
    expect(input.description).toBe(summary);
    expect(input.eyebrow).toBe("Insight");
    expect(input.aestheticPath).toBe("/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg");

    const social = insightShareSocialMetadata({
      id: "ins-1",
      share_token: "tok-1",
      title,
      summary,
    });
    expect(social.openGraph.title).toBe(title);
    expect(social.twitter.title).toBe(title);
    expect(social.openGraph.title).not.toBe(UNSYS_STANDARD_SHARE_TITLE);
    expect(social.openGraph.images[0]?.url).toBe("/insights/tok-1/opengraph-image");

    const ogRoute = fs.readFileSync(
      path.join(REPO_ROOT, "app/insights/[id]/opengraph-image.tsx"),
      "utf8",
    );
    const page = fs.readFileSync(path.join(REPO_ROOT, "app/insights/[id]/page.tsx"), "utf8");
    expect(ogRoute).toContain("buildInsightOgShareInput");
    expect(ogRoute).toContain("composeOgImage");
    expect(page).toContain("insightShareSocialMetadata");
    expect(page).not.toContain("standardShareSocialMetadata");

    writeScratch(
      "insight-og-title.log",
      [
        `ogTitle=${input.title}`,
        `standardTitle=${UNSYS_STANDARD_SHARE_TITLE}`,
        `socialOgTitle=${social.openGraph.title}`,
        `image=${social.openGraph.images[0]?.url}`,
        "opengraph-image uses buildInsightOgShareInput + composeOgImage",
      ].join("\n"),
    );
  });

  it("derives PoW, time, and workspace stats and the page does not list source thoughts", () => {
    const createdAt = "2026-01-15T12:00:00.000Z";
    const stats = deriveInsightPageStats({
      thought_ids: ["t-a", "t-b", "t-c"],
      source_thoughts: [{ text: "must not appear" }, { text: "also hidden" }],
      created_at: createdAt,
      workspace_id: "ws-algebra",
      workspace_title: "Algebra studio",
    });
    expect(stats.powCount).toBe(3);
    expect(stats.powLabel).toMatch(/3/);
    expect(stats.powLabel).toMatch(/PoW/i);
    expect(stats.timeLabel).toBe(formatInsightDate(createdAt));
    expect(stats.workspaceName).toBe("Algebra studio");
    expect(stats.workspaceName).not.toBe(INSIGHT_FALLBACK_WORKSPACE_NAME);
    expect(stats.homeHref).toBe(INSIGHT_HOME_HREF);
    expect(stats.homeLabel).toBe(INSIGHT_HOME_LABEL);

    const fromThoughtsOnly = deriveInsightPageStats({
      source_thoughts: [{ text: "one" }, { text: "two" }],
    });
    expect(fromThoughtsOnly.powCount).toBe(2);

    const insightDetail = fs.readFileSync(
      path.join(REPO_ROOT, "components/InsightDetailClient.tsx"),
      "utf8",
    );
    const api = fs.readFileSync(
      path.join(REPO_ROOT, "app/api/insights/[id]/route.ts"),
      "utf8",
    );
    expect(insightDetail).toContain("deriveInsightPageStats");
    expect(insightDetail).toContain('data-insight-stat="pow"');
    expect(insightDetail).toContain('data-insight-stat="time"');
    expect(insightDetail).toContain('data-insight-stat="workspace"');
    expect(insightDetail).toContain("data-insight-home-link");
    expect(insightDetail).not.toContain("Source thoughts");
    expect(insightDetail).not.toContain("source_thoughts.map");
    expect(api).toContain("workspace_title");
    expect(api).toContain("createAdminClient");
    expect(api).toContain("resolvePublicInsightWorkspaceTitle");
    expect(api).not.toContain('.from("workspaces")');

    writeScratch(
      "insight-page-stats.log",
      [
        `pow=${stats.powLabel}`,
        `time=${stats.timeLabel}`,
        `workspace=${stats.workspaceName}`,
        `home=${stats.homeLabel} ${stats.homeHref}`,
        "InsightDetailClient: no source-thoughts list; three stats + Uncertain Systems link",
      ].join("\n"),
    );
  });

  it("resolves workspace_title through an admin read, not the user-scoped client", async () => {
    const userTables: string[] = [];
    const adminTables: string[] = [];
    const stub = (
      result: { title?: string; root_topic?: string } | null,
      tables: string[],
    ): InsightWorkspaceTitleClient => ({
      from(table: string) {
        tables.push(table);
        return {
          select(columns: string) {
            expect(columns).toBe(INSIGHT_WORKSPACE_TITLE_COLUMNS);
            return {
              eq(column: string, id: string) {
                expect(column).toBe("id");
                expect(id).toBe("ws-private");
                return {
                  maybeSingle: async () => ({ data: result }),
                };
              },
            };
          },
        };
      },
    });
    const userScoped = stub(null, userTables);
    const admin = stub({ title: "Algebra studio" }, adminTables);

    const title = await resolvePublicInsightWorkspaceTitle({
      workspaceId: "ws-private",
      userScoped,
      admin,
    });
    expect(title).toBe("Algebra studio");
    expect(adminTables).toEqual([INSIGHT_WORKSPACE_TITLE_TABLE]);
    expect(userTables).toEqual([]);
    expect(await loadWorkspaceTitleForPublicInsight(userScoped, "ws-private")).toBeNull();
    expect(userTables).toEqual([INSIGHT_WORKSPACE_TITLE_TABLE]);
    expect(
      deriveInsightPageStats({
        workspace_id: "ws-private",
        workspace_title: null,
      }).workspaceName,
    ).toBe(INSIGHT_FALLBACK_WORKSPACE_NAME);
    expect(
      deriveInsightPageStats({
        workspace_id: "ws-private",
        workspace_title: title,
      }).workspaceName,
    ).toBe("Algebra studio");
    expect(
      deriveInsightPageStats({
        workspace_id: "ws-private",
        workspace_title: title,
      }).workspaceName,
    ).not.toBe(INSIGHT_FALLBACK_WORKSPACE_NAME);

    const api = fs.readFileSync(
      path.join(REPO_ROOT, "app/api/insights/[id]/route.ts"),
      "utf8",
    );
    expect(api).toContain("createAdminClient()");
    expect(api).toContain("resolvePublicInsightWorkspaceTitle");
    expect(api).toContain("userScoped: supabase");
    expect(api).toContain("admin: createAdminClient()");
    const gated = api.indexOf("if (!insight.is_public && !isOwner)");
    const adminLoad = api.indexOf("resolvePublicInsightWorkspaceTitle({");
    expect(gated).toBeGreaterThan(-1);
    expect(adminLoad).toBeGreaterThan(gated);
  });
});
