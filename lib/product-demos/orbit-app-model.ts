export type OrbitIssueStatus = "backlog" | "todo" | "in_progress" | "done";
export type OrbitPriority = "none" | "low" | "normal" | "urgent";

export type OrbitProject = {
  id: string;
  name: string;
  color: string;
};

export type OrbitIssue = {
  id: string;
  identifier: string;
  title: string;
  description: string;
  status: OrbitIssueStatus;
  priority: OrbitPriority;
  assignee: string | null;
  labels: string[];
  projectId: string;
  unread: boolean;
  createdAt: string;
};

export type OrbitView = "inbox" | "my_issues" | "project";

export type OrbitAppState = {
  /** Bump when seed narrative changes so localStorage does not pin an old happy path. */
  version: 2;
  workspaceName: string;
  projects: OrbitProject[];
  issues: OrbitIssue[];
  ui: {
    view: OrbitView;
    selectedProjectId: string | null;
    selectedIssueId: string | null;
    assigneeFilter: string | null;
    sidebarCollapsed: boolean;
    tourDismissed: boolean;
    sprintPublished: boolean;
  };
  completedCoachSteps: string[];
};

export const ORBIT_APP_STORAGE_KEY = "orbit-app-state";
export const ORBIT_APP_STATE_VERSION = 2 as const;

const DEFAULT_PROJECTS: OrbitProject[] = [
  { id: "proj-sprint-12", name: "Sprint 12", color: "#5e6ad2" },
  { id: "proj-platform", name: "Platform", color: "#26b5ce" },
];

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Deliberately messy board: unread critical work, mis-prioritized noise,
 * unowned P0, wrong-project item, and no selection — so operators struggle
 * without a linear tutorial until coaching names the next click.
 */
export function createSeedOrbitState(): OrbitAppState {
  const sprintId = "proj-sprint-12";
  return {
    version: ORBIT_APP_STATE_VERSION,
    workspaceName: "Acme Engineering",
    projects: DEFAULT_PROJECTS,
    issues: [
      {
        id: "issue-1",
        identifier: "ORB-12",
        title: "Regression in auth callback handler",
        description:
          "Production: users redirected to /login after OAuth on mobile Safari. Blocks checkout for ~12% of traffic. Needs owner and active work before Sprint 12 ships.",
        status: "backlog",
        priority: "urgent",
        assignee: null,
        labels: [],
        projectId: sprintId,
        unread: true,
        createdAt: nowIso(),
      },
      {
        id: "issue-4",
        identifier: "ORB-15",
        title: "Fix typo in README footer copyright",
        description:
          "Low-impact docs-only copy fix. Someone marked this urgent by mistake — do not burn sprint capacity here first.",
        status: "todo",
        priority: "urgent",
        assignee: null,
        labels: [],
        projectId: sprintId,
        unread: true,
        createdAt: nowIso(),
      },
      {
        id: "issue-2",
        identifier: "ORB-11",
        title: "Update onboarding empty states",
        description:
          "Copy refresh for first-run project creation. Already assigned to you and in progress — finish after the auth regression is owned.",
        status: "in_progress",
        priority: "normal",
        assignee: "You",
        labels: ["feature"],
        projectId: sprintId,
        unread: false,
        createdAt: nowIso(),
      },
      {
        id: "issue-3",
        identifier: "ORB-10",
        title: "Design command palette shortcuts",
        description:
          "Map top 10 actions to keyboard chords. Platform backlog noise — not required for Sprint 12 ship gate.",
        status: "backlog",
        priority: "low",
        assignee: null,
        labels: [],
        projectId: "proj-platform",
        unread: true,
        createdAt: nowIso(),
      },
      {
        id: "issue-5",
        identifier: "ORB-09",
        title: "Auth session refresh edge case",
        description:
          "Related to ORB-12. Currently parked on Platform instead of Sprint 12 — scope it if it blocks the auth regression.",
        status: "todo",
        priority: "normal",
        assignee: null,
        labels: ["bug"],
        projectId: "proj-platform",
        unread: false,
        createdAt: nowIso(),
      },
    ],
    ui: {
      // Start on My issues (looks "owned") so the critical inbox work is easy to miss.
      view: "my_issues",
      selectedProjectId: sprintId,
      selectedIssueId: null,
      assigneeFilter: "You",
      sidebarCollapsed: false,
      // No linear product tour — coaching is the guide.
      tourDismissed: true,
      sprintPublished: false,
    },
    completedCoachSteps: [],
  };
}

export function loadOrbitAppState(): OrbitAppState {
  if (typeof window === "undefined") return createSeedOrbitState();
  try {
    const raw = localStorage.getItem(ORBIT_APP_STORAGE_KEY);
    if (!raw) return createSeedOrbitState();
    const parsed = JSON.parse(raw) as OrbitAppState;
    if (parsed.version !== ORBIT_APP_STATE_VERSION || !Array.isArray(parsed.issues)) {
      return createSeedOrbitState();
    }
    return {
      ...parsed,
      ui: {
        ...parsed.ui,
        sprintPublished: parsed.ui.sprintPublished ?? false,
        tourDismissed: parsed.ui.tourDismissed ?? true,
      },
    };
  } catch {
    return createSeedOrbitState();
  }
}

export function saveOrbitAppState(state: OrbitAppState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORBIT_APP_STORAGE_KEY, JSON.stringify(state));
}

export function nextIssueIdentifier(issues: OrbitIssue[]): string {
  const max = issues.reduce((acc, issue) => {
    const match = issue.identifier.match(/ORB-(\d+)/);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 12);
  return `ORB-${max + 1}`;
}

export function getInboxIssues(state: OrbitAppState): OrbitIssue[] {
  return state.issues.filter((issue) => issue.unread);
}

export function getVisibleIssues(state: OrbitAppState): OrbitIssue[] {
  let issues = [...state.issues];
  if (state.ui.view === "inbox") {
    issues = getInboxIssues(state);
  } else if (state.ui.view === "my_issues") {
    issues = issues.filter((issue) => issue.assignee === "You");
  } else if (state.ui.view === "project" && state.ui.selectedProjectId) {
    issues = issues.filter((issue) => issue.projectId === state.ui.selectedProjectId);
  }
  if (state.ui.assigneeFilter) {
    issues = issues.filter((issue) => issue.assignee === state.ui.assigneeFilter);
  }
  return issues;
}

/** Heuristic: urgent work that is clearly low-impact docs/copy noise. */
export function isMisprioritizedLowImpact(issue: OrbitIssue): boolean {
  if (issue.priority !== "urgent") return false;
  const hay = `${issue.title} ${issue.description}`.toLowerCase();
  return /typo|readme|copyright|footer|docs only|docs-only|copy fix|changelog|whitespace/.test(
    hay
  );
}

/**
 * Heuristic: work that should be treated as ship-critical for the demo path.
 * Keep this tight so related-but-parked tickets (e.g. platform follow-ups) do not
 * steal focus from the real P0 or mis-prioritized noise repair.
 */
export function isShipCriticalIssue(issue: OrbitIssue): boolean {
  const hay = `${issue.title} ${issue.description}`.toLowerCase();
  if (/production|outage|blocks checkout|~\d+% of traffic|p0\b/.test(hay)) return true;
  if (
    issue.priority === "urgent" &&
    /regression|oauth callback|auth callback/.test(hay)
  ) {
    return true;
  }
  return false;
}
