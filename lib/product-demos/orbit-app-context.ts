import type { OrbitAppState, OrbitIssue, OrbitView } from "./orbit-app-model";
import { getInboxIssues, getVisibleIssues } from "./orbit-app-model";
import { ORBIT_UI_ACTIONS } from "./orbit-ui-manifest";

export type OrbitAffordance = {
  action_id: string;
  label: string;
  available: boolean;
  reason: string;
};

export type OrbitIssueSummary = {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: string;
  assignee: string | null;
  unread: boolean;
  project_id: string;
  labels: string[];
};

export type OrbitAppSnapshot = {
  captured_at: string;
  workspace_name: string;
  view: OrbitView;
  selected_issue_id: string | null;
  selected_issue_identifier: string | null;
  selected_project_id: string | null;
  selected_project_name: string | null;
  assignee_filter: string | null;
  tour_dismissed: boolean;
  sprint_published: boolean;
  inbox_unread_count: number;
  inbox_unread_identifiers: string[];
  my_issues_count: number;
  visible_issue_count: number;
  issues: OrbitIssueSummary[];
  affordances: OrbitAffordance[];
  suggested_next: string[];
};

function summarizeIssue(issue: OrbitIssue): OrbitIssueSummary {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    assignee: issue.assignee,
    unread: issue.unread,
    project_id: issue.projectId,
    labels: issue.labels,
  };
}

function selectedIssue(state: OrbitAppState): OrbitIssue | null {
  if (!state.ui.selectedIssueId) return null;
  return state.issues.find((issue) => issue.id === state.ui.selectedIssueId) ?? null;
}

function selectedProject(state: OrbitAppState) {
  const projectId = state.ui.selectedProjectId ?? state.projects[0]?.id ?? null;
  if (!projectId) return null;
  return state.projects.find((project) => project.id === projectId) ?? null;
}

export function buildOrbitAffordances(
  state: OrbitAppState,
  options?: { tapCleared?: boolean }
): OrbitAffordance[] {
  const inboxUnread = getInboxIssues(state);
  const selected = selectedIssue(state);
  const project = selectedProject(state);
  const myIssues = state.issues.filter((issue) => issue.assignee === "You");
  const tapCleared = options?.tapCleared ?? false;

  const byId = (actionId: string) =>
    ORBIT_UI_ACTIONS.find((entry) => entry.actionId === actionId)?.label ?? actionId;

  return [
    {
      action_id: "open_inbox",
      label: byId("open_inbox"),
      available: true,
      reason: "Inbox is always reachable from the sidebar.",
    },
    {
      action_id: "triage_issue",
      label: byId("triage_issue"),
      available: inboxUnread.length > 0,
      reason:
        inboxUnread.length > 0
          ? `${inboxUnread.length} unread issue(s) in inbox: ${inboxUnread.map((i) => i.identifier).join(", ")}`
          : "Inbox has no unread issues to triage.",
    },
    {
      action_id: "create_issue",
      label: byId("create_issue"),
      available: true,
      reason: "New issue is available from the header.",
    },
    {
      action_id: "filter_by_assignee",
      label: byId("filter_by_assignee"),
      available: myIssues.length > 0 || state.ui.view !== "my_issues",
      reason:
        myIssues.length > 0
          ? `${myIssues.length} issue(s) assigned to you.`
          : "Open My issues to review owned work (may be empty).",
    },
    {
      action_id: "assign_to_self",
      label: byId("assign_to_self"),
      available: Boolean(selected && selected.assignee !== "You"),
      reason: selected
        ? selected.assignee === "You"
          ? `${selected.identifier} is already assigned to you.`
          : `Assign ${selected.identifier} to yourself.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "assign_teammate",
      label: byId("assign_teammate"),
      available: Boolean(selected),
      reason: selected
        ? `Hand off ${selected.identifier} to a teammate.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "set_priority_urgent",
      label: byId("set_priority_urgent"),
      available: Boolean(selected && selected.priority !== "urgent"),
      reason: selected
        ? selected.priority === "urgent"
          ? `${selected.identifier} is already urgent.`
          : `Raise priority on ${selected.identifier}.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "change_status_in_progress",
      label: byId("change_status_in_progress"),
      available: Boolean(selected && selected.status !== "in_progress" && selected.status !== "done"),
      reason: selected
        ? `Move ${selected.identifier} to In Progress.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "change_status_done",
      label: byId("change_status_done"),
      available: Boolean(selected && selected.status !== "done"),
      reason: selected
        ? `Mark ${selected.identifier} done.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "move_to_project",
      label: byId("move_to_project"),
      available: Boolean(selected && state.projects.length > 0),
      reason: selected
        ? `Scope ${selected.identifier} via the Project dropdown or open a project view.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "add_label_bug",
      label: byId("add_label_bug"),
      available: Boolean(selected && !selected.labels.includes("bug")),
      reason: selected
        ? selected.labels.includes("bug")
          ? `${selected.identifier} already has the bug label.`
          : `Add bug label to ${selected.identifier}.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "add_label_feature",
      label: byId("add_label_feature"),
      available: Boolean(selected && !selected.labels.includes("feature")),
      reason: selected
        ? selected.labels.includes("feature")
          ? `${selected.identifier} already has the feature label.`
          : `Add feature label to ${selected.identifier}.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "add_comment",
      label: byId("add_comment"),
      available: Boolean(selected),
      reason: selected
        ? `Leave context on ${selected.identifier}.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "open_command_palette",
      label: byId("open_command_palette"),
      available: true,
      reason: "Cmd+K quick actions are always available.",
    },
    {
      action_id: "publish_sprint",
      label: byId("publish_sprint"),
      available: Boolean(
        state.ui.view === "project" && !state.ui.sprintPublished && tapCleared && project
      ),
      reason: !project
        ? "Open a project view first."
        : state.ui.sprintPublished
          ? `${project.name} is already shipped.`
          : !tapCleared
            ? `Ship ${project.name} requires Think Aloud Protocol verification first.`
            : `Ready to ship ${project.name}.`,
    },
  ];
}

export function buildSuggestedNextActions(affordances: OrbitAffordance[]): string[] {
  const priority = [
    "triage_issue",
    "assign_to_self",
    "set_priority_urgent",
    "change_status_in_progress",
    "move_to_project",
    "change_status_done",
    "add_comment",
    "publish_sprint",
    "create_issue",
    "filter_by_assignee",
  ];
  const available = new Set(
    affordances.filter((entry) => entry.available).map((entry) => entry.action_id)
  );
  return priority.filter((actionId) => available.has(actionId));
}

export function buildOrbitAppSnapshot(
  state: OrbitAppState,
  options?: { tapCleared?: boolean }
): OrbitAppSnapshot {
  const inboxUnread = getInboxIssues(state);
  const visible = getVisibleIssues(state);
  const selected = selectedIssue(state);
  const project = selectedProject(state);
  const affordances = buildOrbitAffordances(state, options);

  return {
    captured_at: new Date().toISOString(),
    workspace_name: state.workspaceName,
    view: state.ui.view,
    selected_issue_id: state.ui.selectedIssueId,
    selected_issue_identifier: selected?.identifier ?? null,
    selected_project_id: project?.id ?? null,
    selected_project_name: project?.name ?? null,
    assignee_filter: state.ui.assigneeFilter,
    tour_dismissed: state.ui.tourDismissed,
    sprint_published: state.ui.sprintPublished,
    inbox_unread_count: inboxUnread.length,
    inbox_unread_identifiers: inboxUnread.map((issue) => issue.identifier),
    my_issues_count: state.issues.filter((issue) => issue.assignee === "You").length,
    visible_issue_count: visible.length,
    issues: state.issues.map(summarizeIssue),
    affordances,
    suggested_next: buildSuggestedNextActions(affordances),
  };
}

export function isOrbitActionAvailable(
  actionId: string,
  snapshot: OrbitAppSnapshot | null | undefined
): boolean {
  if (!snapshot) return true;
  const affordance = snapshot.affordances.find((entry) => entry.action_id === actionId);
  return affordance?.available ?? true;
}

export function formatOrbitSnapshotForPrompt(snapshot: OrbitAppSnapshot): string {
  const available = snapshot.affordances
    .filter((entry) => entry.available)
    .map((entry) => `- ${entry.action_id}: ${entry.reason}`)
    .join("\n");
  const unavailable = snapshot.affordances
    .filter((entry) => !entry.available)
    .slice(0, 8)
    .map((entry) => `- ${entry.action_id}: ${entry.reason}`)
    .join("\n");

  return `Orbit UI snapshot (${snapshot.captured_at})
View: ${snapshot.view}
Selected issue: ${snapshot.selected_issue_identifier ?? "none"}
Inbox unread: ${snapshot.inbox_unread_count} (${snapshot.inbox_unread_identifiers.join(", ") || "none"})
Visible issues in current view: ${snapshot.visible_issue_count}
Sprint published: ${snapshot.sprint_published}

Available next actions:
${available || "- none"}

Not available right now:
${unavailable || "- none"}

Issue board:
${snapshot.issues.map((issue) => `${issue.identifier} [${issue.status}/${issue.priority}] assignee=${issue.assignee ?? "none"} unread=${issue.unread}`).join("\n")}`;
}

export function buildActionReflection(
  actionId: string,
  state: OrbitAppState,
  snapshot: OrbitAppSnapshot
): string {
  const selected = selectedIssue(state);
  switch (actionId) {
    case "triage_issue":
      return snapshot.inbox_unread_count > 0
        ? `Triaged unread inbox issue in Orbit (inbox still has ${snapshot.inbox_unread_count} unread).`
        : "Opened inbox — no unread issues remain to triage.";
    case "open_inbox":
      return snapshot.inbox_unread_count > 0
        ? `Opened inbox with ${snapshot.inbox_unread_count} unread issue(s): ${snapshot.inbox_unread_identifiers.join(", ")}.`
        : "Opened inbox — triage queue is empty.";
    case "assign_to_self":
      return selected
        ? `Assigned ${selected.identifier} to self.`
        : "Attempted self-assignment without a selected issue.";
    case "move_to_project":
      return selected
        ? `Scoped ${selected.identifier} to project ${snapshot.selected_project_name ?? "unknown"}.`
        : "Changed project view in Orbit.";
    case "publish_sprint":
      return `Shipped sprint ${snapshot.selected_project_name ?? "project"} after verification.`;
    default:
      return `Completed "${actionId}" in Orbit while viewing ${snapshot.view}.`;
  }
}