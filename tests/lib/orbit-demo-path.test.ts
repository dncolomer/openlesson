import { describe, expect, it } from "vitest";
import { buildOrbitAppSnapshot } from "@/lib/product-demos/orbit-app-context";
import {
  createSeedOrbitState,
  getInboxIssues,
  getVisibleIssues,
  isMisprioritizedLowImpact,
  isShipCriticalIssue,
  type OrbitAppState,
  type OrbitIssue,
} from "@/lib/product-demos/orbit-app-model";
import {
  getAffordanceForAction,
  matchCoachingHintToAction,
  resolveOrbitPrimaryCoachStep,
} from "@/lib/product-demos/orbit-coach-map";
import { ORBIT_UI_ACTIONS } from "@/lib/product-demos/orbit-ui-manifest";

const UI_SURFACE_RE =
  /sidebar|inbox|priority|status|assign|header|cmd\+k|command|project|dropdown|triage|ship|panel|issue|list|click/i;

const NOISE_IDS = new Set(["ORB-10", "ORB-09", "ORB-11"]);

function primaryOf(state: OrbitAppState, options?: { tapCleared?: boolean }) {
  const snapshot = buildOrbitAppSnapshot(state, options);
  return {
    snapshot,
    primary: resolveOrbitPrimaryCoachStep([], snapshot),
  };
}

function assertConcreteAvailableStep(
  actionId: string,
  snapshot: ReturnType<typeof buildOrbitAppSnapshot>
) {
  const primary = resolveOrbitPrimaryCoachStep([], snapshot);
  expect(primary, `expected primary step for ${actionId}`).not.toBeNull();
  expect(primary!.actionId).toBe(actionId);

  const inManifest = ORBIT_UI_ACTIONS.some((entry) => entry.actionId === primary!.actionId);
  expect(inManifest).toBe(true);

  const affordance = snapshot.affordances.find((entry) => entry.action_id === primary!.actionId);
  expect(affordance?.available).toBe(true);

  const instruction =
    getAffordanceForAction(primary!.actionId, snapshot) ?? primary!.instruction;
  expect(instruction.trim().length).toBeGreaterThan(8);
  expect(
    primary!.actionId === "focus_issue"
      ? `${primary!.instruction} ${instruction}`
      : primary!.instruction
  ).toMatch(UI_SURFACE_RE);
}

/** Mirrors OrbitApp handleSelectView("inbox"). */
function openInbox(state: OrbitAppState): OrbitAppState {
  return {
    ...state,
    ui: { ...state.ui, view: "inbox", assigneeFilter: null },
  };
}

/** Mirrors OrbitApp handleTriage(issue). */
function triageIssue(state: OrbitAppState, issue: OrbitIssue): OrbitAppState {
  return {
    ...state,
    ui: { ...state.ui, selectedIssueId: issue.id },
    issues: state.issues.map((entry) =>
      entry.id === issue.id ? { ...entry, unread: false } : entry
    ),
  };
}

function selectIssue(state: OrbitAppState, issueId: string): OrbitAppState {
  return {
    ...state,
    ui: { ...state.ui, selectedIssueId: issueId },
  };
}

/** Mirrors OrbitApp sidebar project click (clears assignee filter). */
function openProjectView(state: OrbitAppState, projectId: string): OrbitAppState {
  return {
    ...state,
    ui: {
      ...state.ui,
      view: "project",
      selectedProjectId: projectId,
      assigneeFilter: null,
    },
  };
}

function assignToSelf(state: OrbitAppState, issueId: string): OrbitAppState {
  return {
    ...state,
    issues: state.issues.map((issue) =>
      issue.id === issueId ? { ...issue, assignee: "You" } : issue
    ),
  };
}

function assertFocusTargetVisible(
  state: OrbitAppState,
  snapshot: ReturnType<typeof buildOrbitAppSnapshot>
) {
  expect(snapshot.focus_issue_identifier).toBeTruthy();
  expect(snapshot.focus_issue_visible).toBe(true);
  expect(
    getVisibleIssues(state).some((issue) => issue.identifier === snapshot.focus_issue_identifier)
  ).toBe(true);
}

describe("Orbit demo struggle path", () => {
  it("seed introduces intentional struggle traps (not a clean happy path)", () => {
    const seed = createSeedOrbitState();

    expect(seed.version).toBe(2);
    expect(seed.ui.tourDismissed).toBe(true);
    expect(seed.ui.selectedIssueId).toBeNull();
    expect(seed.ui.view).toBe("my_issues");
    expect(seed.ui.sprintPublished).toBe(false);

    const unread = seed.issues.filter((issue) => issue.unread);
    expect(unread.length).toBeGreaterThanOrEqual(2);

    const critical = seed.issues.find((issue) => issue.identifier === "ORB-12");
    expect(critical).toBeDefined();
    expect(critical!.assignee).toBeNull();
    expect(critical!.priority).toBe("urgent");
    expect(critical!.unread).toBe(true);
    expect(isShipCriticalIssue(critical!)).toBe(true);

    const misprioritized = seed.issues.find((issue) => issue.identifier === "ORB-15");
    expect(misprioritized).toBeDefined();
    expect(isMisprioritizedLowImpact(misprioritized!)).toBe(true);

    const ownedOnly = seed.issues.filter((issue) => issue.assignee === "You");
    expect(ownedOnly.some((issue) => issue.identifier === "ORB-12")).toBe(false);
  });

  it("on the seed board, primary step unblocks via open_inbox (exact UI instruction)", () => {
    const seed = createSeedOrbitState();
    const snapshot = buildOrbitAppSnapshot(seed);

    expect(snapshot.suggested_next[0]).toBe("open_inbox");
    assertConcreteAvailableStep("open_inbox", snapshot);

    const primary = resolveOrbitPrimaryCoachStep([], snapshot)!;
    expect(primary.instruction.toLowerCase()).toContain("inbox");
    expect(primary.source).toBe("snapshot");
  });

  it("after opening inbox, primary targets ship-critical work (focus or triage), not noise", () => {
    const state = openInbox(createSeedOrbitState());
    const { snapshot, primary } = primaryOf(state);
    expect(primary).not.toBeNull();
    expect(["focus_issue", "triage_issue"]).toContain(primary!.actionId);
    if (primary!.actionId === "focus_issue") {
      expect(snapshot.focus_issue_identifier).toBe("ORB-12");
    }
    assertConcreteAvailableStep(primary!.actionId, snapshot);
  });

  it("selected unowned critical issue → assign_to_self before status/ship", () => {
    const base = createSeedOrbitState();
    const critical = base.issues.find((issue) => issue.identifier === "ORB-12")!;
    const state: OrbitAppState = {
      ...base,
      issues: base.issues.map((issue) => ({ ...issue, unread: false })),
      ui: {
        ...base.ui,
        view: "inbox",
        assigneeFilter: null,
        selectedIssueId: critical.id,
      },
    };

    const snapshot = buildOrbitAppSnapshot(state);
    expect(snapshot.suggested_next[0]).toBe("assign_to_self");
    assertConcreteAvailableStep("assign_to_self", snapshot);

    const order = snapshot.suggested_next;
    const assignIdx = order.indexOf("assign_to_self");
    const statusIdx = order.indexOf("change_status_in_progress");
    const shipIdx = order.indexOf("publish_sprint");
    expect(assignIdx).toBeGreaterThanOrEqual(0);
    if (statusIdx >= 0) expect(assignIdx).toBeLessThan(statusIdx);
    if (shipIdx >= 0) expect(assignIdx).toBeLessThan(shipIdx);
  });

  it("selected mis-prioritized issue → set_priority_normal as primary", () => {
    const base = createSeedOrbitState();
    const noise = base.issues.find((issue) => issue.identifier === "ORB-15")!;
    // Critical already owned so mispri becomes the learning focus.
    const critical = base.issues.find((issue) => issue.identifier === "ORB-12")!;
    const state: OrbitAppState = {
      ...base,
      issues: base.issues.map((issue) => {
        if (issue.id === critical.id) return { ...issue, unread: false, assignee: "You" };
        if (issue.id === noise.id) return { ...issue, unread: false };
        return { ...issue, unread: false };
      }),
      ui: {
        ...base.ui,
        view: "inbox",
        assigneeFilter: null,
        selectedIssueId: noise.id,
      },
    };

    const snapshot = buildOrbitAppSnapshot(state);
    expect(snapshot.suggested_next[0]).toBe("set_priority_normal");
    assertConcreteAvailableStep("set_priority_normal", snapshot);
    expect(resolveOrbitPrimaryCoachStep([], snapshot)!.instruction.toLowerCase()).toMatch(
      /priority/
    );
  });

  it("ship blocked by TAP / wrong view does not recommend publish_sprint", () => {
    const base = createSeedOrbitState();
    const state: OrbitAppState = {
      ...base,
      issues: base.issues.map((issue) =>
        isShipCriticalIssue(issue)
          ? { ...issue, unread: false, assignee: "You" }
          : { ...issue, unread: false, priority: issue.priority === "urgent" && isMisprioritizedLowImpact(issue) ? "normal" : issue.priority }
      ),
      ui: {
        ...base.ui,
        view: "my_issues",
        selectedIssueId: base.issues.find((i) => i.assignee === "You")!.id,
        sprintPublished: false,
      },
    };

    const snapshot = buildOrbitAppSnapshot(state, { tapCleared: false });
    const publish = snapshot.affordances.find((entry) => entry.action_id === "publish_sprint");
    expect(publish?.available).toBe(false);
    expect(snapshot.suggested_next.includes("publish_sprint")).toBe(false);

    const primary = resolveOrbitPrimaryCoachStep(
      ["Ship Sprint 12 now and publish the deliverable."],
      snapshot
    );
    expect(primary).not.toBeNull();
    expect(primary!.actionId).not.toBe("publish_sprint");
    const aff = snapshot.affordances.find((entry) => entry.action_id === primary!.actionId);
    expect(aff?.available).toBe(true);
  });

  it("scorecard hints map to concrete available UI actions", () => {
    const base = createSeedOrbitState();
    const critical = base.issues.find((issue) => issue.identifier === "ORB-12")!;
    const state: OrbitAppState = {
      ...base,
      issues: base.issues.map((issue) => ({ ...issue, unread: false })),
      ui: {
        ...base.ui,
        view: "inbox",
        selectedIssueId: critical.id,
        assigneeFilter: null,
      },
    };
    const snapshot = buildOrbitAppSnapshot(state);

    const assign = matchCoachingHintToAction(
      ["Assign the regression issue to yourself before starting work."],
      snapshot
    );
    expect(assign?.actionId).toBe("assign_to_self");

    const inboxState = openInbox(createSeedOrbitState());
    const inbox = resolveOrbitPrimaryCoachStep(
      ["Complete inbox triage for unread issues."],
      buildOrbitAppSnapshot(inboxState)
    );
    expect(["triage_issue", "focus_issue"]).toContain(inbox?.actionId);

    const mispri = base.issues.find((i) => i.identifier === "ORB-15")!;
    const priority = matchCoachingHintToAction(
      ["This issue is mis-prioritized — lower priority on the typo work."],
      buildOrbitAppSnapshot({
        ...state,
        issues: base.issues.map((issue) =>
          issue.id === critical.id
            ? { ...issue, unread: false, assignee: "You" }
            : { ...issue, unread: false }
        ),
        ui: {
          ...state.ui,
          selectedIssueId: mispri.id,
        },
      })
    );
    expect(priority?.actionId).toBe("set_priority_normal");
  });

  it("learning order prefers unblocking steps first on multi-gap boards", () => {
    const seed = createSeedOrbitState();
    const snapshot = buildOrbitAppSnapshot(seed);
    const order = snapshot.suggested_next;

    expect(order[0]).toBe("open_inbox");
    expect(order.indexOf("open_inbox")).toBeLessThan(
      order.includes("change_status_done")
        ? order.indexOf("change_status_done")
        : order.length
    );
    expect(order.includes("publish_sprint")).toBe(false);
  });

  it("sequential walk: triage-all never abandons ship-critical/mispri for ORB-10 noise", () => {
    let state = createSeedOrbitState();
    const critical = state.issues.find((issue) => issue.identifier === "ORB-12")!;
    const mispri = state.issues.find((issue) => issue.identifier === "ORB-15")!;
    const sprintId = critical.projectId;

    // Seed → open_inbox
    let { primary, snapshot } = primaryOf(state);
    expect(primary?.actionId).toBe("open_inbox");

    state = openInbox(state);
    ({ primary, snapshot } = primaryOf(state));
    expect(["focus_issue", "triage_issue"]).toContain(primary?.actionId);
    if (primary?.actionId === "focus_issue") {
      expect(snapshot.focus_issue_identifier).toBe("ORB-12");
      assertFocusTargetVisible(state, snapshot);
    }

    // Triage each unread in list order (same as clicking through the inbox).
    const triageOrder: string[] = [];
    while (getInboxIssues(state).length > 0) {
      const nextUnread = getInboxIssues(state)[0]!;
      triageOrder.push(nextUnread.identifier);
      state = triageIssue(state, nextUnread);
      ({ primary, snapshot } = primaryOf(state));

      expect(primary, `primary after triaging ${nextUnread.identifier}`).not.toBeNull();

      // Never coach a focus click on an issue that is not list-visible.
      if (primary!.actionId === "focus_issue") {
        assertFocusTargetVisible(state, snapshot);
      }

      // Never coach assign/priority on pure noise while critical still unowned.
      if (findCriticalStillUnowned(state)) {
        if (primary!.actionId === "assign_to_self") {
          expect(snapshot.selected_issue_identifier).toBe("ORB-12");
        }
        if (primary!.actionId === "set_priority_urgent") {
          expect(snapshot.selected_issue_identifier).not.toMatch(/ORB-10|ORB-09/);
        }
        // Selection on noise: redirect via project board and/or focus — not assign-on-noise.
        if (snapshot.selected_issue_identifier && NOISE_IDS.has(snapshot.selected_issue_identifier)) {
          expect(["open_project_view", "focus_issue"]).toContain(primary!.actionId);
          expect(snapshot.focus_issue_identifier).toBe("ORB-12");
          if (primary!.actionId === "focus_issue") {
            assertFocusTargetVisible(state, snapshot);
          } else {
            // Inbox hid triaged critical — open project is the reachable next step.
            expect(snapshot.focus_issue_visible).toBe(false);
            expect(
              getVisibleIssues(state).some((i) => i.identifier === "ORB-12")
            ).toBe(false);
          }
        }
      }
    }

    expect(triageOrder).toContain("ORB-12");
    expect(triageOrder).toContain("ORB-15");
    expect(triageOrder[triageOrder.length - 1]).toBe("ORB-10");

    // After full triage, still on inbox: ORB-12 is triaged → not in inbox list.
    ({ primary, snapshot } = primaryOf(state));
    expect(snapshot.selected_issue_identifier).toBe("ORB-10");
    expect(getVisibleIssues(state).some((i) => i.identifier === "ORB-12")).toBe(false);
    expect(primary?.actionId).toBe("open_project_view");
    expect(snapshot.focus_issue_identifier).toBe("ORB-12");
    expect(snapshot.focus_issue_visible).toBe(false);
    expect(snapshot.focus_project_id).toBe(sprintId);
    expect(snapshot.suggested_next[0]).toBe("open_project_view");
    // assign on noise must not be available
    const assignNoise = snapshot.affordances.find((a) => a.action_id === "assign_to_self");
    expect(assignNoise?.available).toBe(false);
    // focus_issue must not be primary while target is invisible
    expect(snapshot.affordances.find((a) => a.action_id === "focus_issue")?.available).toBe(
      false
    );

    // Open Sprint project board (sidebar) → critical becomes clickable.
    state = openProjectView(state, sprintId);
    ({ primary, snapshot } = primaryOf(state));
    expect(getVisibleIssues(state).some((i) => i.identifier === "ORB-12")).toBe(true);
    expect(primary?.actionId).toBe("focus_issue");
    expect(snapshot.focus_issue_identifier).toBe("ORB-12");
    assertFocusTargetVisible(state, snapshot);
    assertConcreteAvailableStep("focus_issue", snapshot);

    // Select critical → assign
    state = selectIssue(state, critical.id);
    ({ primary, snapshot } = primaryOf(state));
    expect(primary?.actionId).toBe("assign_to_self");
    assertConcreteAvailableStep("assign_to_self", snapshot);

    // Own critical → mispri next; still on project board so ORB-15 should be visible → focus_issue
    state = assignToSelf(state, critical.id);
    ({ primary, snapshot } = primaryOf(state));
    expect(snapshot.focus_issue_identifier).toBe("ORB-15");
    expect(primary?.actionId).toBe("focus_issue");
    assertFocusTargetVisible(state, snapshot);

    // Select mispri → normalize priority
    state = selectIssue(state, mispri.id);
    ({ primary, snapshot } = primaryOf(state));
    expect(primary?.actionId).toBe("set_priority_normal");
    assertConcreteAvailableStep("set_priority_normal", snapshot);
  });
});

function findCriticalStillUnowned(state: OrbitAppState): boolean {
  return state.issues.some(
    (issue) => isShipCriticalIssue(issue) && issue.assignee !== "You" && issue.status !== "done"
  );
}
