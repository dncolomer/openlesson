/**
 * Canonical map of actions the Orbit demo UI actually supports.
 * Workspace prompts, score cards, and coaching must stay within this surface.
 */
export type OrbitUiAction = {
  actionId: string;
  coachKey: string;
  label: string;
  instruction: string;
  /** false = only reachable via Cmd+K command palette */
  inMainUi: boolean;
  keywords: string[];
};

export const ORBIT_TAP_MIN_SCORE = 70;

export const ORBIT_TAP_VALIDATION_HINT =
  "Walk through your sprint delivery judgment aloud — triage, prioritization, assignment, status flow, and when you would ship Sprint 12.";

export const ORBIT_UI_ACTIONS: OrbitUiAction[] = [
  {
    actionId: "open_inbox",
    coachKey: "inbox",
    label: "Open inbox",
    instruction: "Sidebar → Inbox",
    inMainUi: true,
    keywords: ["inbox", "triage", "unread", "orientation"],
  },
  {
    actionId: "open_project_view",
    coachKey: "project",
    label: "Open project board",
    instruction: "Sidebar → Projects → open the sprint project that holds the target issue",
    inMainUi: true,
    keywords: [
      "project",
      "sprint",
      "sidebar",
      "board",
      "sprint 12",
      "open project",
      "project view",
    ],
  },
  {
    actionId: "focus_issue",
    coachKey: "focus-issue",
    label: "Open the learning-target issue",
    instruction: "Issue list → click the highlighted issue (ship-critical or mis-prioritized work)",
    inMainUi: true,
    keywords: [
      "select",
      "open issue",
      "click issue",
      "focus",
      "orb-12",
      "auth regression",
      "ship-critical",
      "mis-priorit",
    ],
  },
  {
    actionId: "triage_issue",
    coachKey: "triage",
    label: "Triage issue",
    instruction: "Inbox → click Triage on an unread issue",
    inMainUi: true,
    keywords: ["triage", "acknowledge", "review", "unread", "inbox triage", "complete inbox"],
  },
  {
    actionId: "skip_product_tour",
    coachKey: "tour",
    label: "Skip tour",
    instruction: "Top banner → Skip tour",
    inMainUi: true,
    keywords: ["tour", "onboarding", "skip"],
  },
  {
    actionId: "create_issue",
    coachKey: "create-issue",
    label: "Create issue",
    instruction: "Header → New issue",
    inMainUi: true,
    keywords: ["create", "file", "new issue"],
  },
  {
    actionId: "set_priority_urgent",
    coachKey: "priority",
    label: "Set urgent priority",
    instruction: "Select an issue → Priority dropdown → Urgent",
    inMainUi: true,
    keywords: ["urgent", "priority", "p0", "p1"],
  },
  {
    actionId: "set_priority_normal",
    coachKey: "priority",
    label: "Normalize priority",
    instruction: "Select an issue → Priority dropdown → Normal (or Low)",
    inMainUi: true,
    keywords: [
      "normal",
      "priority",
      "downgrade",
      "mis-priorit",
      "mispriorit",
      "too urgent",
      "lower priority",
      "depriorit",
    ],
  },
  {
    actionId: "assign_to_self",
    coachKey: "assign",
    label: "Assign to me",
    instruction: "Select an issue → Assign to me",
    inMainUi: true,
    keywords: ["assign", "ownership", "owner", "self", "take"],
  },
  {
    actionId: "assign_teammate",
    coachKey: "assign-teammate",
    label: "Assign teammate",
    instruction: "Select an issue → Assign Alex",
    inMainUi: true,
    keywords: ["assign", "handoff", "teammate", "alex"],
  },
  {
    actionId: "change_status_in_progress",
    coachKey: "status",
    label: "Move to In Progress",
    instruction: "Select an issue → Status → In Progress",
    inMainUi: true,
    keywords: ["in progress", "start", "status", "move"],
  },
  {
    actionId: "change_status_done",
    coachKey: "status",
    label: "Mark done",
    instruction: "Select an issue → Status → Done",
    inMainUi: true,
    keywords: ["done", "complete", "status"],
  },
  {
    actionId: "close_issue",
    coachKey: "status",
    label: "Close issue",
    instruction: "Select an issue → Status → Done",
    inMainUi: true,
    keywords: ["close", "archive", "resolve"],
  },
  {
    actionId: "add_label_bug",
    coachKey: "labels",
    label: "Add bug label",
    instruction: "Select an issue → Labels → + Bug",
    inMainUi: true,
    keywords: ["label", "bug", "regression", "defect"],
  },
  {
    actionId: "add_label_feature",
    coachKey: "labels",
    label: "Add feature label",
    instruction: "Select an issue → Labels → + Feature",
    inMainUi: true,
    keywords: ["label", "feature"],
  },
  {
    actionId: "move_to_project",
    coachKey: "project",
    label: "Scope to project",
    instruction: "Select an issue → Project dropdown — or sidebar → open a project view",
    inMainUi: true,
    keywords: ["project", "sprint", "scope", "move"],
  },
  {
    actionId: "filter_by_assignee",
    coachKey: "filter",
    label: "My issues",
    instruction: "Sidebar → My issues",
    inMainUi: true,
    keywords: ["filter", "assignee", "my issues", "owned"],
  },
  {
    actionId: "open_command_palette",
    coachKey: "command-palette",
    label: "Command palette",
    instruction: "Header → ⌘K or press Cmd+K",
    inMainUi: true,
    keywords: ["command", "cmd", "palette", "quick"],
  },
  {
    actionId: "add_comment",
    coachKey: "comment",
    label: "Add comment",
    instruction: "Select an issue → Comment → Post comment",
    inMainUi: true,
    keywords: ["comment", "context", "thread"],
  },
  {
    actionId: "start_cycle",
    coachKey: "command-palette",
    label: "Start cycle",
    instruction: "Cmd+K → Start cycle",
    inMainUi: false,
    keywords: ["cycle", "sprint plan"],
  },
  {
    actionId: "create_project",
    coachKey: "command-palette",
    label: "Create project",
    instruction: "Cmd+K → Create project",
    inMainUi: false,
    keywords: ["create project", "new project"],
  },
  {
    actionId: "misprioritize_then_fix",
    coachKey: "command-palette",
    label: "Fix mis-prioritization",
    instruction: "Cmd+K → Fix mis-prioritization",
    inMainUi: false,
    keywords: ["mis-priorit", "fix priority", "recovery"],
  },
  {
    actionId: "publish_sprint",
    coachKey: "publish",
    label: "Ship sprint",
    instruction: "Project view → Ship Sprint (requires Think Aloud Protocol ≥ 70)",
    inMainUi: true,
    keywords: ["publish", "ship", "deliver", "release", "sprint"],
  },
];

export function buildOrbitUiManifestForWorkspace(): string {
  const rows = ORBIT_UI_ACTIONS.map(
    (action) =>
      `| ${action.actionId} | ${action.inMainUi ? "In-app" : "Cmd+K only"} | ${action.instruction} |`
  );
  return `## Orbit demo UI surface (coach only toward these)
| Action ID | Surface | Where in Orbit |
|-----------|---------|----------------|
${rows.join("\n")}

Ship Sprint (completed Think Aloud Protocol session) gates sprint publication. Do not suggest actions outside this table.`;
}