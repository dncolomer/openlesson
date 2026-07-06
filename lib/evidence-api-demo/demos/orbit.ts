import {
  buildModelDoc,
  createTimeToolActions,
  type EvidenceApiDemoDefinition,
} from "../demo-definition";
import type { SimulationAction } from "../types";

const USE_CASE = "Engineering sprint adoption and delivery conversion";
const SCENARIO_INTRO =
  "Engineering leads learn Orbit by doing real work inside the product — triage the inbox, create and prioritize issues, assign owners, move statuses through the sprint cycle, scope work to projects, and ship deliverables. Every action streams Evidence API events so openLesson can verify learning and coach the next step toward productive adoption.";

const EVAL_DEFINITION = `Verify that engineering operators are learning Orbit and converting to productive sprint delivery across a non-linear workflow:
- inbox triage posture (guided onboarding vs veteran skip),
- issue creation, prioritization, and assignment judgment,
- status workflow (backlog → in progress → done) with correct sequencing,
- project and cycle scoping for sprint deliverables,
- labeling, filtering, and command-palette fluency,
- collaboration signals (comments, handoffs),
- recovery from mis-prioritized or mis-assigned work,
- re-engagement after idle gaps between triage sessions.

Evidence should capture non-linear issue workflows, idle calendar gaps, priority mistakes recovered, and outcomes tied to learning-to-conversion — did they learn the workflow well enough to adopt, activate, and ship? Score cards surface coaching overlays inside the live app to close gaps and move conversion forward.`;

const ORBIT_ACTIONS: SimulationAction[] = [
  {
    id: "open_inbox",
    label: "Open inbox",
    description: "Navigate to the triage inbox view.",
    category: "onboarding",
    blockHint: "Inbox orientation",
    cta: "Open inbox",
    kind: "evidence",
    dimension: "inbox_triage",
    outcome: "success",
  },
  {
    id: "triage_issue",
    label: "Triage issue",
    description: "Review and acknowledge an unread inbox item.",
    category: "onboarding",
    blockHint: "Inbox triage",
    cta: "Triage",
    kind: "evidence",
    dimension: "inbox_triage",
    outcome: "success",
  },
  {
    id: "skip_product_tour",
    label: "Skip product tour",
    description: "Experienced operator bypasses guided onboarding.",
    category: "onboarding",
    blockHint: "Self-directed setup",
    cta: "Skip tour",
    kind: "evidence",
    dimension: "self_directed_workflow",
    outcome: "partial",
  },
  {
    id: "create_issue",
    label: "Create issue",
    description: "File a new issue with title and description.",
    category: "projects",
    blockHint: "Issue creation",
    cta: "Create issue",
    kind: "evidence",
    dimension: "issue_creation",
    outcome: "success",
  },
  {
    id: "set_priority_urgent",
    label: "Set urgent priority",
    description: "Mark an issue as urgent priority.",
    category: "activation",
    blockHint: "Prioritization",
    cta: "Set urgent",
    kind: "evidence",
    dimension: "prioritization",
    outcome: "success",
  },
  {
    id: "set_priority_normal",
    label: "Set normal priority",
    description: "Downgrade or normalize issue priority.",
    category: "activation",
    blockHint: "Prioritization",
    cta: "Set normal",
    kind: "evidence",
    dimension: "prioritization",
    outcome: "success",
  },
  {
    id: "assign_to_self",
    label: "Assign to self",
    description: "Take ownership of an issue.",
    category: "team",
    blockHint: "Assignment",
    cta: "Assign self",
    kind: "evidence",
    dimension: "assignment",
    outcome: "success",
  },
  {
    id: "assign_teammate",
    label: "Assign teammate",
    description: "Route issue to another engineer.",
    category: "team",
    blockHint: "Handoff",
    cta: "Assign teammate",
    kind: "evidence",
    dimension: "assignment",
    outcome: "success",
  },
  {
    id: "change_status_in_progress",
    label: "Move to In Progress",
    description: "Start active work on an issue.",
    category: "projects",
    blockHint: "Status workflow",
    cta: "In Progress",
    kind: "evidence",
    dimension: "status_workflow",
    outcome: "success",
  },
  {
    id: "change_status_done",
    label: "Move to Done",
    description: "Complete and close an issue.",
    category: "projects",
    blockHint: "Delivery",
    cta: "Done",
    kind: "evidence",
    dimension: "status_workflow",
    outcome: "success",
  },
  {
    id: "add_label_bug",
    label: "Add bug label",
    description: "Tag issue as a regression or defect.",
    category: "support",
    blockHint: "Labeling",
    cta: "Add bug",
    kind: "evidence",
    dimension: "labeling",
    outcome: "success",
  },
  {
    id: "add_label_feature",
    label: "Add feature label",
    description: "Tag issue as product feature work.",
    category: "support",
    blockHint: "Labeling",
    cta: "Add feature",
    kind: "evidence",
    dimension: "labeling",
    outcome: "success",
  },
  {
    id: "move_to_project",
    label: "Move to project",
    description: "Scope issue to a sprint project.",
    category: "projects",
    blockHint: "Project scoping",
    cta: "Move project",
    kind: "evidence",
    dimension: "project_scoping",
    outcome: "success",
  },
  {
    id: "filter_by_assignee",
    label: "Filter by assignee",
    description: "Narrow issue list to owned work.",
    category: "activation",
    blockHint: "List filtering",
    cta: "Filter assignee",
    kind: "evidence",
    dimension: "list_navigation",
    outcome: "success",
  },
  {
    id: "open_command_palette",
    label: "Open command palette",
    description: "Invoke Cmd+K quick actions.",
    category: "activation",
    blockHint: "Power user flow",
    cta: "Cmd+K",
    kind: "evidence",
    dimension: "command_palette",
    outcome: "success",
  },
  {
    id: "add_comment",
    label: "Add comment",
    description: "Leave context on an issue thread.",
    category: "team",
    blockHint: "Collaboration",
    cta: "Comment",
    kind: "evidence",
    dimension: "collaboration",
    outcome: "success",
  },
  {
    id: "create_project",
    label: "Create project",
    description: "Stand up a new sprint project.",
    category: "projects",
    blockHint: "Project setup",
    cta: "New project",
    kind: "evidence",
    dimension: "project_scoping",
    outcome: "success",
  },
  {
    id: "start_cycle",
    label: "Start cycle",
    description: "Open a new sprint cycle window.",
    category: "activation",
    blockHint: "Cycle planning",
    cta: "Start cycle",
    kind: "evidence",
    dimension: "cycle_planning",
    outcome: "success",
  },
  {
    id: "close_issue",
    label: "Close issue",
    description: "Archive a resolved deliverable.",
    category: "projects",
    blockHint: "Completion",
    cta: "Close",
    kind: "evidence",
    dimension: "delivery",
    outcome: "success",
  },
  {
    id: "reopen_issue",
    label: "Reopen issue",
    description: "Recover a closed issue after regression.",
    category: "edge_cases",
    blockHint: "Recovery",
    cta: "Reopen",
    kind: "evidence",
    dimension: "recovery",
    outcome: "struggle",
  },
  {
    id: "misprioritize_then_fix",
    label: "Fix mis-prioritization",
    description: "Correct urgent flag applied to low-impact work.",
    category: "edge_cases",
    blockHint: "Priority recovery",
    cta: "Fix priority",
    kind: "evidence",
    dimension: "recovery",
    outcome: "partial",
  },
  ...createTimeToolActions(),
];

const CATEGORY_ORDER = [
  "onboarding",
  "projects",
  "team",
  "activation",
  "support",
  "edge_cases",
  "simulation_tools",
] as const;

export const orbitDemo: EvidenceApiDemoDefinition = {
  id: "orbit",
  productName: "Orbit",
  integrationName: "orbit-delivery-agent",
  useCase: USE_CASE,
  tagline: "Learn the workflow, ship sprint work, prove adoption with evidence",
  saasCategory: "Issue tracking",
  description:
    "A self-contained Linear-style issue tracker — learn by triaging, prioritizing, assigning, and shipping real sprint work while evidence uploads verify learning and drive conversion coaching.",
  scenarioTitle: "Learn Orbit. Convert to shipping.",
  scenarioIntro: SCENARIO_INTRO,
  workspaceDescription:
    "Orbit engineering adoption — verify learning and conversion through in-app issue workflows with continuous Evidence API uploads and score-driven coaching that tells users what to do next.",
  initials: "OR",
  accent: "indigo",
  simulatorMode: "external",
  evalDefinition: EVAL_DEFINITION,
  workspacePrompt:
    "Build a learning verification workspace for Orbit operators adopting inbox triage, issue prioritization, assignment, status workflows, project scoping, and sprint delivery — focused on learning-to-conversion, not exam completion.",
  modelDocFilename: "orbit-eval-model.md",
  modelDoc: buildModelDoc(
    {
      productName: "Orbit",
      integrationName: "orbit-delivery-agent",
      evalDefinition: EVAL_DEFINITION,
      modelDocFilename: "orbit-eval-model.md",
      useCase: USE_CASE,
      scenarioIntro: SCENARIO_INTRO,
    },
    `| inbox_triage | Inbox review and issue acknowledgment |
| issue_creation | Filing issues with actionable context |
| prioritization | Urgent vs normal judgment under load |
| assignment | Self-claim vs teammate handoff |
| status_workflow | Backlog → in progress → done sequencing |
| project_scoping | Sprint project and cycle alignment |
| labeling | Bug vs feature classification |
| list_navigation | Filters and view narrowing |
| command_palette | Cmd+K power-user fluency |
| collaboration | Comments and handoff context |
| delivery | Closing resolved deliverables |
| recovery | Mis-priority and reopen judgment |
| time_gap | Idle days between triage sessions |`
  ),
  toolName: "orbit",
  simulatorToolName: "orbit_events",
  schemaVersion: "orbit_evidence_v1",
  evidenceGoals: ["sprint_adoption", "delivery_conversion", "triage_learning"],
  integrationHints: {
    event_verbs: ["triage_issue", "create_issue", "change_status_done"],
    goals: ["sprint_adoption", "delivery_conversion"],
  },
  partnerDescription:
    "Orbit partner integration that streams issue-tracker actions as evidence to openLesson.",
  integrationSkillContext: "Orbit issue tracker with live evidence and smart coaching overlays",
  categoryMeta: {
    onboarding: {
      label: "Inbox",
      description: "Orientation, triage, and tour posture.",
    },
    integrations: {
      label: "Integrations",
      description: "Connector stubs and import flows.",
    },
    projects: {
      label: "Delivery",
      description: "Create issues, statuses, and project scoping.",
    },
    team: {
      label: "Team",
      description: "Assignment, handoffs, and comments.",
    },
    activation: {
      label: "Sprint",
      description: "Priorities, filters, cycles, and command palette.",
    },
    support: {
      label: "Labels",
      description: "Bug vs feature classification.",
    },
    edge_cases: {
      label: "Recovery",
      description: "Mis-prioritization and reopen flows.",
    },
    simulation_tools: {
      label: "Idle gaps",
      description: "Record days between triage sessions.",
    },
  },
  categoryOrder: [...CATEGORY_ORDER],
  actions: ORBIT_ACTIONS,
};