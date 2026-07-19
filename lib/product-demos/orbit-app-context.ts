import type { OrbitAppState, OrbitIssue, OrbitView } from "./orbit-app-model";
import {
  getInboxIssues,
  getVisibleIssues,
  isMisprioritizedLowImpact,
  isShipCriticalIssue,
} from "./orbit-app-model";
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
  /** Issue the coach wants selected next (ship-critical / mispri before noise). */
  focus_issue_id: string | null;
  focus_issue_identifier: string | null;
  /** True when focus issue is in the current list (clickable now). */
  focus_issue_visible: boolean;
  /** Project the coach wants open so the focus issue becomes list-visible. */
  focus_project_id: string | null;
  focus_project_name: string | null;
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

/** Ship-critical work still needing an owner (not done). */
export function findCriticalNeedingOwner(state: OrbitAppState): OrbitIssue | null {
  return (
    state.issues.find(
      (issue) =>
        isShipCriticalIssue(issue) && issue.assignee !== "You" && issue.status !== "done"
    ) ?? null
  );
}

/** Mis-prioritized low-impact work still marked urgent. */
export function findMisprioritizedPending(state: OrbitAppState): OrbitIssue | null {
  return state.issues.find((issue) => isMisprioritizedLowImpact(issue)) ?? null;
}

/**
 * Highest-priority issue the learner should select next.
 * Prefer unowned ship-critical, then misprioritized noise — never random board items.
 */
export function getOrbitFocusIssue(state: OrbitAppState): OrbitIssue | null {
  const selected = selectedIssue(state);
  const critical = findCriticalNeedingOwner(state);

  if (critical && selected?.id !== critical.id) {
    return critical;
  }

  // Critical is selected or already owned — next learning target is mispri repair.
  const criticalStillUnowned = findCriticalNeedingOwner(state);
  if (!criticalStillUnowned) {
    const mispri = findMisprioritizedPending(state);
    if (mispri && selected?.id !== mispri.id) {
      return mispri;
    }
  }

  return null;
}

/** Whether an issue appears in the current Orbit list (what the user can click). */
export function isIssueVisibleInView(state: OrbitAppState, issueId: string): boolean {
  return getVisibleIssues(state).some((issue) => issue.id === issueId);
}

/**
 * Project that would list the focus issue (Sprint board), when inbox hides triaged work.
 */
export function getFocusProject(state: OrbitAppState, focusIssue: OrbitIssue | null) {
  if (!focusIssue) return null;
  return state.projects.find((project) => project.id === focusIssue.projectId) ?? null;
}

/**
 * True when the focus issue is already list-visible; otherwise the user must change view first.
 * Inbox only shows unread — triaged learning targets require the project board.
 */
export function isFocusIssueClickable(state: OrbitAppState, focusIssue: OrbitIssue | null): boolean {
  if (!focusIssue) return false;
  return isIssueVisibleInView(state, focusIssue.id);
}

/**
 * True when opening the focus issue's project view would make it list-visible
 * (and it is not list-visible in the current view — e.g. inbox hides triaged work).
 */
export function needsOpenProjectForFocus(
  state: OrbitAppState,
  focusIssue: OrbitIssue | null
): boolean {
  if (!focusIssue) return false;
  if (isFocusIssueClickable(state, focusIssue)) return false;
  const project = getFocusProject(state, focusIssue);
  if (!project) return false;
  const simulated: OrbitAppState = {
    ...state,
    ui: {
      ...state.ui,
      view: "project",
      selectedProjectId: project.id,
      assigneeFilter: null,
    },
  };
  return getVisibleIssues(simulated).some((issue) => issue.id === focusIssue.id);
}

function selectedIsNoiseWhileLearningPending(
  selected: OrbitIssue | null,
  state: OrbitAppState
): boolean {
  if (!selected) return false;
  if (isShipCriticalIssue(selected) || isMisprioritizedLowImpact(selected)) return false;
  return Boolean(findCriticalNeedingOwner(state) || findMisprioritizedPending(state));
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
  const criticalNeedingOwner = findCriticalNeedingOwner(state);
  const mispriPending = findMisprioritizedPending(state);
  const focusIssue = getOrbitFocusIssue(state);
  const focusProject = getFocusProject(state, focusIssue);
  const focusClickable = isFocusIssueClickable(state, focusIssue);
  const needProjectView = needsOpenProjectForFocus(state, focusIssue);
  const criticalSelected = Boolean(selected && isShipCriticalIssue(selected));
  const mispriSelected = Boolean(selected && isMisprioritizedLowImpact(selected));
  const noiseSelected = selectedIsNoiseWhileLearningPending(selected, state);

  const byId = (actionId: string) =>
    ORBIT_UI_ACTIONS.find((entry) => entry.actionId === actionId)?.label ?? actionId;

  const learningUnread = inboxUnread.filter(
    (issue) => isShipCriticalIssue(issue) || isMisprioritizedLowImpact(issue)
  );
  const needsInboxNav =
    state.ui.view !== "inbox" &&
    (learningUnread.length > 0 ||
      (Boolean(criticalNeedingOwner?.unread) || Boolean(mispriPending?.unread)));

  // Prefer triage only when a learning-target issue is still unread and we're on inbox
  // (or any unread while no focus redirect is needed and nothing learning-selected).
  const criticalUnreadOnInbox =
    state.ui.view === "inbox" && Boolean(criticalNeedingOwner?.unread);
  const mispriUnreadOnInbox = state.ui.view === "inbox" && Boolean(mispriPending?.unread);
  // Once critical is selected, stop pushing more triage — assign first.
  const triageAvailable =
    inboxUnread.length > 0 &&
    state.ui.view === "inbox" &&
    !(criticalSelected && selected && selected.assignee !== "You") &&
    (criticalUnreadOnInbox ||
      mispriUnreadOnInbox ||
      (!criticalNeedingOwner && !mispriPending && inboxUnread.length > 0) ||
      (!selected && inboxUnread.length > 0));

  const selectedNeedsSprintScope = Boolean(
    selected &&
      !noiseSelected &&
      selected.projectId !== "proj-sprint-12" &&
      (/auth|session|oauth|regression/.test(
        `${selected.title} ${selected.description}`.toLowerCase()
      ) ||
        selected.labels.includes("bug"))
  );

  return [
    {
      action_id: "open_inbox",
      label: byId("open_inbox"),
      available: needsInboxNav || (state.ui.view !== "inbox" && inboxUnread.length > 0),
      reason: needsInboxNav
        ? `${learningUnread.length || inboxUnread.length} unread learning-target issue(s) are waiting in Inbox.`
        : inboxUnread.length > 0
          ? "Inbox holds unread work that still needs triage."
          : "Inbox is always reachable from the sidebar.",
    },
    {
      action_id: "open_project_view",
      label: focusProject ? `Open ${focusProject.name}` : byId("open_project_view"),
      available: needProjectView,
      reason:
        focusIssue && focusProject
          ? `Sidebar → Projects → ${focusProject.name}. Inbox only shows unread — ${focusIssue.identifier} was triaged so open the project board to click it.`
          : "Open a project from the sidebar to see its issues.",
    },
    {
      action_id: "focus_issue",
      label: focusIssue ? `Open ${focusIssue.identifier}` : byId("focus_issue"),
      // Only when the issue is actually in the current list — never coach a dead click.
      available: Boolean(focusIssue && focusClickable),
      reason: focusIssue
        ? focusClickable
          ? isShipCriticalIssue(focusIssue)
            ? `Issue list → click ${focusIssue.identifier}. It is ship-critical and still needs an owner — open it before working noise.`
            : `Issue list → click ${focusIssue.identifier}. It is mis-prioritized urgent noise — open it to fix priority.`
          : `${focusIssue.identifier} is not in this view (inbox hides triaged items). Open its project board first.`
        : "No higher-priority learning-target issue needs selection.",
    },
    {
      action_id: "triage_issue",
      label: byId("triage_issue"),
      available: triageAvailable,
      reason:
        inboxUnread.length > 0
          ? criticalNeedingOwner?.unread
            ? `Triage ${criticalNeedingOwner.identifier} first (ship-critical unread).`
            : mispriPending?.unread
              ? `Triage ${mispriPending.identifier} (mis-prioritized unread).`
              : `${inboxUnread.length} unread issue(s) in inbox: ${inboxUnread.map((i) => i.identifier).join(", ")}`
          : "Inbox has no unread issues to triage.",
    },
    {
      action_id: "create_issue",
      label: byId("create_issue"),
      available: !criticalNeedingOwner && !mispriPending,
      reason: criticalNeedingOwner
        ? `Finish owning ${criticalNeedingOwner.identifier} before filing new work.`
        : "New issue is available from the header.",
    },
    {
      action_id: "filter_by_assignee",
      label: byId("filter_by_assignee"),
      available:
        !criticalNeedingOwner &&
        !mispriPending &&
        (myIssues.length > 0 || state.ui.view !== "my_issues"),
      reason:
        myIssues.length > 0
          ? `${myIssues.length} issue(s) assigned to you.`
          : "Open My issues to review owned work (may be empty).",
    },
    {
      action_id: "assign_to_self",
      label: byId("assign_to_self"),
      // Never coach assign on board noise while ship-critical still lacks an owner.
      available: Boolean(
        selected &&
          selected.assignee !== "You" &&
          (isShipCriticalIssue(selected) ||
            (!criticalNeedingOwner && !isMisprioritizedLowImpact(selected)))
      ),
      reason: selected
        ? selected.assignee === "You"
          ? `${selected.identifier} is already assigned to you.`
          : noiseSelected
            ? `Do not own ${selected.identifier} yet — open ${criticalNeedingOwner?.identifier ?? "ship-critical work"} first.`
            : isShipCriticalIssue(selected)
              ? `${selected.identifier} is ship-critical and unowned — claim it with Assign to me.`
              : `Assign ${selected.identifier} to yourself.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "assign_teammate",
      label: byId("assign_teammate"),
      available: Boolean(selected && !noiseSelected && !criticalNeedingOwner),
      reason: selected
        ? `Hand off ${selected.identifier} to a teammate.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "set_priority_urgent",
      label: byId("set_priority_urgent"),
      available: Boolean(
        selected &&
          selected.priority !== "urgent" &&
          !isMisprioritizedLowImpact(selected) &&
          !noiseSelected &&
          (isShipCriticalIssue(selected) || !criticalNeedingOwner)
      ),
      reason: selected
        ? selected.priority === "urgent"
          ? `${selected.identifier} is already urgent.`
          : `Raise priority on ${selected.identifier}.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "set_priority_normal",
      label: byId("set_priority_normal"),
      available: mispriSelected,
      reason: selected
        ? mispriSelected
          ? `${selected.identifier} looks like low-impact work marked urgent — drop priority via the Priority dropdown.`
          : `${selected.identifier} priority does not need a downgrade right now.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "change_status_in_progress",
      label: byId("change_status_in_progress"),
      available: Boolean(
        selected &&
          selected.status !== "in_progress" &&
          selected.status !== "done" &&
          !mispriSelected &&
          !noiseSelected &&
          selected.assignee === "You"
      ),
      reason: selected
        ? mispriSelected
          ? `Fix priority on ${selected.identifier} before starting work.`
          : selected.assignee !== "You"
            ? `Assign ${selected.identifier} before moving status.`
            : `Move ${selected.identifier} to In Progress.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "change_status_done",
      label: byId("change_status_done"),
      available: Boolean(
        selected &&
          selected.status !== "done" &&
          !mispriSelected &&
          !noiseSelected &&
          selected.assignee === "You"
      ),
      reason: selected
        ? `Mark ${selected.identifier} done.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "move_to_project",
      label: byId("move_to_project"),
      available: Boolean(selected && state.projects.length > 0 && selectedNeedsSprintScope),
      reason: selected
        ? selectedNeedsSprintScope
          ? `Scope ${selected.identifier} into Sprint 12 via the Project dropdown.`
          : `Scope ${selected.identifier} via the Project dropdown or open a project view.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "add_label_bug",
      label: byId("add_label_bug"),
      available: Boolean(
        selected &&
          !selected.labels.includes("bug") &&
          isShipCriticalIssue(selected) &&
          !noiseSelected
      ),
      reason: selected
        ? selected.labels.includes("bug")
          ? `${selected.identifier} already has the bug label.`
          : `Add bug label to ${selected.identifier}.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "add_label_feature",
      label: byId("add_label_feature"),
      available: Boolean(
        selected &&
          !selected.labels.includes("feature") &&
          !noiseSelected &&
          !criticalNeedingOwner &&
          !isShipCriticalIssue(selected)
      ),
      reason: selected
        ? selected.labels.includes("feature")
          ? `${selected.identifier} already has the feature label.`
          : `Add feature label to ${selected.identifier}.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "add_comment",
      label: byId("add_comment"),
      available: Boolean(selected && selected.assignee === "You" && !noiseSelected),
      reason: selected
        ? `Leave context on ${selected.identifier}.`
        : "Select an issue in the list first.",
    },
    {
      action_id: "open_command_palette",
      label: byId("open_command_palette"),
      available: !criticalNeedingOwner && !mispriPending,
      reason: "Cmd+K quick actions are always available.",
    },
    {
      action_id: "publish_sprint",
      label: byId("publish_sprint"),
      available: Boolean(
        state.ui.view === "project" &&
          !state.ui.sprintPublished &&
          tapCleared &&
          project &&
          !criticalNeedingOwner
      ),
      reason: !project
        ? "Open a project view first."
        : state.ui.sprintPublished
          ? `${project.name} is already shipped.`
          : criticalNeedingOwner
            ? `Own ${criticalNeedingOwner.identifier} before shipping.`
            : !tapCleared
              ? `Ship ${project.name} requires Think Aloud Protocol verification first.`
              : `Ready to ship ${project.name}.`,
    },
  ];
}

/**
 * Learning-optimized next actions: earlier steps unblock later ones.
 * Never abandons ship-critical / mispri work for board noise.
 */
export function buildSuggestedNextActions(
  affordances: OrbitAffordance[],
  state?: OrbitAppState
): string[] {
  const available = new Set(
    affordances.filter((entry) => entry.available).map((entry) => entry.action_id)
  );

  if (!state) {
    return affordances.filter((entry) => entry.available).map((entry) => entry.action_id);
  }

  const selected = selectedIssue(state);
  const criticalNeedingOwner = findCriticalNeedingOwner(state);
  const mispriPending = findMisprioritizedPending(state);
  const focusIssue = getOrbitFocusIssue(state);
  const criticalSelected = Boolean(selected && isShipCriticalIssue(selected));
  const mispriSelected = Boolean(selected && isMisprioritizedLowImpact(selected));
  const inboxUnread = getInboxIssues(state);
  const needsInboxNav =
    state.ui.view !== "inbox" &&
    inboxUnread.some((issue) => isShipCriticalIssue(issue) || isMisprioritizedLowImpact(issue));

  const priority: string[] = [];

  // 1. Get to inbox if learning-target unread is hidden.
  if (needsInboxNav) {
    priority.push("open_inbox");
  }

  // 2. Critical selected + unowned → assign BEFORE more triage/noise.
  //    Detail panel still works even when the issue is no longer in the inbox list.
  if (criticalSelected && selected && selected.assignee !== "You") {
    priority.push("assign_to_self", "add_label_bug");
  }

  // 3. If learning-target is not list-visible (triaged out of inbox), open its project board first.
  if (needsOpenProjectForFocus(state, focusIssue)) {
    priority.push("open_project_view");
  }

  // 4. Select critical/mispri only when it is currently clickable in the list.
  if (focusIssue && isFocusIssueClickable(state, focusIssue)) {
    priority.push("focus_issue");
  }

  // 5. Triage learning-target unread (not when critical is already selected for assign).
  if (!(criticalSelected && selected && selected.assignee !== "You")) {
    if (inboxUnread.some((issue) => isShipCriticalIssue(issue) || isMisprioritizedLowImpact(issue))) {
      priority.push("triage_issue");
    } else if (inboxUnread.length > 0 && !criticalNeedingOwner && !mispriPending) {
      priority.push("triage_issue");
    }
  }

  // 6. Mispri selected → fix priority before status/ship.
  if (mispriSelected) {
    priority.push("set_priority_normal", "misprioritize_then_fix");
  }

  // 7. Owned critical path.
  if (criticalSelected && selected?.assignee === "You") {
    priority.push("add_label_bug", "change_status_in_progress", "add_comment");
  }

  if (selected && selected.assignee !== "You" && !criticalNeedingOwner && !mispriSelected) {
    priority.push("assign_to_self");
  }

  if (
    selected &&
    selected.projectId !== "proj-sprint-12" &&
    isShipCriticalIssue(selected)
  ) {
    priority.push("move_to_project");
  }

  priority.push(
    "set_priority_urgent",
    "change_status_in_progress",
    "move_to_project",
    "change_status_done",
    "add_comment",
    "publish_sprint",
    "filter_by_assignee",
    "create_issue",
    "open_command_palette"
  );

  const ordered: string[] = [];
  for (const actionId of priority) {
    if (available.has(actionId) && !ordered.includes(actionId)) {
      ordered.push(actionId);
    }
  }

  for (const actionId of available) {
    if (!ordered.includes(actionId) && actionId !== "assign_teammate") {
      ordered.push(actionId);
    }
  }

  return ordered;
}

export function buildOrbitAppSnapshot(
  state: OrbitAppState,
  options?: { tapCleared?: boolean }
): OrbitAppSnapshot {
  const inboxUnread = getInboxIssues(state);
  const visible = getVisibleIssues(state);
  const selected = selectedIssue(state);
  const project = selectedProject(state);
  const focusIssue = getOrbitFocusIssue(state);
  const focusProject = getFocusProject(state, focusIssue);
  const focusVisible = isFocusIssueClickable(state, focusIssue);
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
    suggested_next: buildSuggestedNextActions(affordances, state),
    focus_issue_id: focusIssue?.id ?? null,
    focus_issue_identifier: focusIssue?.identifier ?? null,
    focus_issue_visible: focusVisible,
    focus_project_id: focusProject?.id ?? null,
    focus_project_name: focusProject?.name ?? null,
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
Focus issue (coach): ${snapshot.focus_issue_identifier ?? "none"} (visible=${snapshot.focus_issue_visible})
Focus project (coach): ${snapshot.focus_project_name ?? "none"}
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
    case "focus_issue":
      return snapshot.focus_issue_identifier
        ? `Opened learning-target issue ${snapshot.focus_issue_identifier}.`
        : "Focused the next learning-target issue in Orbit.";
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
