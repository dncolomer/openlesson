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
  version: 1;
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
  };
  completedCoachSteps: string[];
};

export const ORBIT_APP_STORAGE_KEY = "orbit-app-state";

const DEFAULT_PROJECTS: OrbitProject[] = [
  { id: "proj-sprint-12", name: "Sprint 12", color: "#5e6ad2" },
  { id: "proj-platform", name: "Platform", color: "#26b5ce" },
];

function nowIso(): string {
  return new Date().toISOString();
}

export function createSeedOrbitState(): OrbitAppState {
  const sprintId = "proj-sprint-12";
  return {
    version: 1,
    workspaceName: "Acme Engineering",
    projects: DEFAULT_PROJECTS,
    issues: [
      {
        id: "issue-1",
        identifier: "ORB-12",
        title: "Regression in auth callback handler",
        description: "Users redirected to /login after OAuth on mobile Safari.",
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
        description: "Copy refresh for first-run project creation.",
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
        description: "Map top 10 actions to keyboard chords.",
        status: "backlog",
        priority: "low",
        assignee: null,
        labels: [],
        projectId: "proj-platform",
        unread: true,
        createdAt: nowIso(),
      },
    ],
    ui: {
      view: "inbox",
      selectedProjectId: sprintId,
      selectedIssueId: null,
      assigneeFilter: null,
      sidebarCollapsed: false,
      tourDismissed: false,
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
    if (parsed.version !== 1 || !Array.isArray(parsed.issues)) {
      return createSeedOrbitState();
    }
    return parsed;
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