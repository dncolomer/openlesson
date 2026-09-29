import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildWorkspaceSectionNavItems } from "@/components/workspace-view/workspace-section-nav-items";
import {
  availableSectionsForMode,
  resolveActiveSectionForMode,
} from "@/lib/workspace-mode";
import { resolveWorkspaceSectionLayout } from "@/lib/workspace-sections";
import {
  averageTimeToInsightMs,
  formatTimeToInsightDuration,
  WORKSPACE_KPI_TIME_TO_INSIGHT_EMPTY,
  WORKSPACE_KPI_TIME_TO_INSIGHT_LABEL,
  workspaceKpiTimeToInsightReadout,
  type TimeToInsightInsightRecord,
  type TimeToInsightSessionRecord,
} from "@/lib/workspace-time-to-insight";

const VIEWER = "user-a";
const OTHER = "user-b";
const WORKSPACE = "ws-1";
const OTHER_WORKSPACE = "ws-2";
const T0 = "2026-01-01T00:00:00.000Z";

function atSeconds(seconds: number): string {
  return new Date(Date.parse(T0) + seconds * 1000).toISOString();
}

function session(
  id: string,
  extra: Partial<TimeToInsightSessionRecord> & { workspace_id?: string } = {},
): TimeToInsightSessionRecord & { workspace_id?: string } {
  const { workspace_id: topLevelWorkspaceId, metadata, ...rest } = extra;
  return {
    id,
    user_id: VIEWER,
    created_at: T0,
    session_started_at: T0,
    metadata: metadata ?? { workspace_id: WORKSPACE },
    ...rest,
    ...(topLevelWorkspaceId ? { workspace_id: topLevelWorkspaceId } : {}),
  };
}

function insight(
  sessionId: string,
  seconds: number,
  extra: Partial<TimeToInsightInsightRecord> = {},
): TimeToInsightInsightRecord {
  return {
    user_id: VIEWER,
    session_id: sessionId,
    workspace_id: WORKSPACE,
    created_at: atSeconds(seconds),
    archived_at: null,
    ...extra,
  };
}

/** 60s + 180s, plus every omission the average must ignore. */
function mixedRecords(): {
  sessions: TimeToInsightSessionRecord[];
  insights: TimeToInsightInsightRecord[];
} {
  return {
    sessions: [
      session("fast", {
        // Start is session_started_at, not the earlier created_at.
        created_at: atSeconds(-1000),
        session_started_at: T0,
      }),
      session("slow", {
        // Unparseable start falls back to created_at.
        session_started_at: "not-a-timestamp",
        created_at: T0,
      }),
      session("no-insight"),
      session("other-user", { user_id: OTHER }),
      session("other-workspace", {
        metadata: { workspace_id: OTHER_WORKSPACE },
      }),
      session("archived-only"),
      session("wrong-workspace-insight"),
      session("negative"),
      session("unparseable-insight"),
      // Top-level workspace_id is not a sessions column and must not qualify.
      session("column-ignored", {
        metadata: {},
        workspace_id: WORKSPACE,
      }),
    ],
    insights: [
      insight("fast", 10, { archived_at: atSeconds(10) }),
      insight("fast", 20, { workspace_id: OTHER_WORKSPACE }),
      insight("fast", 5, { user_id: OTHER }),
      insight("fast", 60, { workspace_id: null }),
      insight("fast", 90),
      insight("slow", 1, { workspace_id: OTHER_WORKSPACE }),
      insight("slow", 180, { workspace_id: "  " }),
      insight("other-user", 10, { user_id: OTHER }),
      insight("other-workspace", 10, { workspace_id: OTHER_WORKSPACE }),
      insight("archived-only", 15, { archived_at: atSeconds(15) }),
      insight("wrong-workspace-insight", 12, { workspace_id: OTHER_WORKSPACE }),
      insight("negative", -30),
      insight("unparseable-insight", 0, { created_at: "nope" }),
      insight("column-ignored", 10),
      insight("no-such-session", 10),
    ],
  };
}

describe("averageTimeToInsightMs", () => {
  it("means 60s and 180s as 120s and omits sessions that do not qualify", () => {
    const records = mixedRecords();
    const mean = averageTimeToInsightMs({
      ...records,
      viewerId: VIEWER,
      workspaceId: WORKSPACE,
    });
    expect(mean).toBe(120_000);
    expect(formatTimeToInsightDuration(mean!)).toBe("2m 0s");
  });

  it("is absent, not zero, when nothing qualifies", () => {
    const records = mixedRecords();
    const onlyOmissions = {
      sessions: records.sessions.filter((row) => row.id !== "fast" && row.id !== "slow"),
      insights: records.insights,
    };
    expect(
      averageTimeToInsightMs({
        ...onlyOmissions,
        viewerId: VIEWER,
        workspaceId: WORKSPACE,
      }),
    ).toBeNull();
    expect(
      averageTimeToInsightMs({
        sessions: [],
        insights: [],
        viewerId: VIEWER,
        workspaceId: WORKSPACE,
      }),
    ).toBeNull();
    expect(
      averageTimeToInsightMs({
        sessions: [session("fast")],
        insights: [insight("fast", 60)],
        viewerId: "",
        workspaceId: WORKSPACE,
      }),
    ).toBeNull();
  });
});

describe("workspace KPIs tab", () => {
  function labelsFor(input: {
    mode: "creator" | "learner";
    isOwner: boolean;
    isLoggedIn: boolean;
  }) {
    const sections = availableSectionsForMode({
      mode: input.mode,
      isOwner: input.isOwner,
      isLoggedIn: input.isLoggedIn,
    });
    const items = buildWorkspaceSectionNavItems({
      t: (key) => key,
      isLearnerMode: input.mode === "learner",
      isOwner: input.isOwner,
      visibleSections: sections,
    });
    return { sections, labels: items.map((item) => item.label), items };
  }

  it("shows KPIs to logged-in creator and learner viewers and hides it when logged out", () => {
    const creator = labelsFor({ mode: "creator", isOwner: false, isLoggedIn: true });
    const learner = labelsFor({ mode: "learner", isOwner: false, isLoggedIn: true });
    const loggedOut = labelsFor({ mode: "creator", isOwner: false, isLoggedIn: false });
    const guestLearner = labelsFor({ mode: "learner", isOwner: false, isLoggedIn: false });

    expect(creator.sections).toContain("kpis");
    expect(learner.sections).toContain("kpis");
    expect(creator.labels).toContain("KPIs");
    expect(learner.labels).toContain("KPIs");
    expect(loggedOut.sections).not.toContain("kpis");
    expect(loggedOut.labels).not.toContain("KPIs");
    expect(guestLearner.sections).not.toContain("kpis");
    expect(guestLearner.labels).not.toContain("KPIs");

    const krLearner = availableSectionsForMode({
      mode: "learner",
      isOwner: true,
      isLoggedIn: true,
      workspaceKind: "knowledge_region",
    });
    const krCreator = availableSectionsForMode({
      mode: "creator",
      isOwner: true,
      isLoggedIn: true,
      workspaceKind: "knowledge_region",
    });
    expect(krLearner).not.toContain("kpis");
    expect(krCreator).not.toContain("kpis");

    expect(
      resolveActiveSectionForMode({
        mode: "creator",
        requested: "kpis",
        isOwner: false,
        isLoggedIn: true,
      }),
    ).toBe("kpis");
    expect(
      resolveActiveSectionForMode({
        mode: "learner",
        requested: "kpis",
        isOwner: false,
        isLoggedIn: true,
      }),
    ).toBe("kpis");
    expect(
      resolveActiveSectionForMode({
        mode: "creator",
        requested: "kpis",
        isOwner: false,
        isLoggedIn: false,
      }),
    ).toBe("workspace");
    expect(resolveWorkspaceSectionLayout("kpis").mountsKpisPanel).toBe(true);
    expect(resolveWorkspaceSectionLayout("kpis").showBlockMapChrome).toBe(false);
  });

  it("renders the shipped average as a duration and does not show zero when empty", () => {
    const records = mixedRecords();
    const shown = workspaceKpiTimeToInsightReadout({
      ...records,
      viewerId: VIEWER,
      workspaceId: WORKSPACE,
    });
    const mean = averageTimeToInsightMs({
      ...records,
      viewerId: VIEWER,
      workspaceId: WORKSPACE,
    });

    expect(shown.metricLabel).toBe(WORKSPACE_KPI_TIME_TO_INSIGHT_LABEL);
    expect(shown.metricLabel.toLowerCase()).toContain("time-to-insight");
    expect(mean).toBe(120_000);
    expect(shown.averageMs).toBe(mean);
    expect(shown.valueText).toBe(formatTimeToInsightDuration(mean!));
    expect(shown.valueText).toBe("2m 0s");

    const empty = workspaceKpiTimeToInsightReadout({
      sessions: [],
      insights: [],
      viewerId: VIEWER,
      workspaceId: WORKSPACE,
    });
    expect(empty.averageMs).toBeNull();
    expect(empty.valueText).toBe(WORKSPACE_KPI_TIME_TO_INSIGHT_EMPTY);
    expect(empty.valueText).not.toMatch(/0/);
    expect(empty.valueText).not.toBe("0s");
    expect(empty.valueText).not.toBe("0");

    const panel = readFileSync(
      join(process.cwd(), "components/WorkspaceKpisPanel.tsx"),
      "utf8",
    );
    const hosts = readFileSync(
      join(process.cwd(), "components/workspace-view/workspace-section-hosts.tsx"),
      "utf8",
    );
    expect(panel).toContain("workspaceKpiTimeToInsightReadout");
    expect(panel).toContain("data-kpi-time-to-insight-value");
    expect(panel).toContain("data-kpi-time-to-insight-empty");
    expect(hosts).toContain("WorkspaceKpisPanel");
    expect(hosts).toContain('visibleSections.includes("kpis")');
  });
});
