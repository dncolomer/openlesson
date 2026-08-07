/**
 * Pure progress reducer + LWM multi-user snapshot surface wiring.
 * Exercises shipped snapshot-all-progress helpers and asserts real score path wiring.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  consumeSnapshotAllNdjson,
  formatSnapshotAllProgress,
  initialSnapshotAllProgress,
  labelForSnapshotSubject,
  parseSnapshotAllProgressLine,
  reduceSnapshotAllProgress,
} from "@/lib/pow-api/snapshot-all-progress";

const ROOT = join(__dirname, "../..");

describe("snapshot-all progress (pure)", () => {
  it("reduces start → subject_start → subject → complete into live counts", () => {
    let state = initialSnapshotAllProgress();
    expect(state.phase).toBe("idle");
    expect(formatSnapshotAllProgress(state)).toBe("");

    state = reduceSnapshotAllProgress(state, {
      type: "start",
      workspace_id: "ws1",
      total: 3,
    });
    expect(state.phase).toBe("running");
    expect(state.total).toBe(3);
    expect(formatSnapshotAllProgress(state)).toMatch(/0\/3/);

    state = reduceSnapshotAllProgress(state, {
      type: "subject_start",
      index: 1,
      total: 3,
      user_id: "u1",
      guest_user_id: null,
      label: "You",
    });
    expect(state.currentIndex).toBe(1);
    expect(state.currentLabel).toBe("You");
    expect(formatSnapshotAllProgress(state)).toMatch(/You/);

    state = reduceSnapshotAllProgress(state, {
      type: "subject",
      index: 1,
      total: 3,
      user_id: "u1",
      guest_user_id: null,
      status: "ok",
    });
    expect(state.completed).toBe(1);
    expect(state.succeeded).toBe(1);
    expect(state.currentIndex).toBeNull();

    state = reduceSnapshotAllProgress(state, {
      type: "subject",
      index: 2,
      total: 3,
      user_id: null,
      guest_user_id: "g1",
      status: "skipped",
      error: "No new PoW",
      code: "no_new_pow",
    });
    expect(state.skipped).toBe(1);
    expect(state.completed).toBe(2);

    state = reduceSnapshotAllProgress(state, {
      type: "subject",
      index: 3,
      total: 3,
      user_id: "u2",
      guest_user_id: null,
      status: "failed",
      error: "boom",
    });
    expect(state.failed).toBe(1);

    state = reduceSnapshotAllProgress(state, {
      type: "complete",
      workspace_id: "ws1",
      total: 3,
      succeeded: 1,
      skipped: 1,
      failed: 1,
    });
    expect(state.phase).toBe("complete");
    expect(state.summary).toMatch(/1 succeeded/);
    expect(formatSnapshotAllProgress(state)).toMatch(/complete/i);
  });

  it("parses and consumes NDJSON progress lines", () => {
    const line = JSON.stringify({
      type: "subject",
      index: 1,
      total: 2,
      user_id: "u1",
      guest_user_id: null,
      status: "ok",
    });
    const parsed = parseSnapshotAllProgressLine(line);
    expect(parsed?.type).toBe("subject");

    const { events, rest } = consumeSnapshotAllNdjson(
      "",
      `${line}\n{"type":"start","total":2`,
    );
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("subject");
    expect(rest).toContain('"type":"start"');

    const flushed = consumeSnapshotAllNdjson(rest, ',"workspace_id":"w"}\n');
    expect(flushed.events).toHaveLength(1);
    expect(flushed.events[0].type).toBe("start");
  });

  it("labels owner as You when currentUserId matches", () => {
    expect(labelForSnapshotSubject({ user_id: "abc" }, { currentUserId: "abc" })).toBe(
      "You",
    );
    expect(labelForSnapshotSubject({ guest_user_id: "guest-uuid-1234" })).toMatch(/Guest/);
  });

  it("error event ends progress without infinite running state", () => {
    let state = reduceSnapshotAllProgress(initialSnapshotAllProgress(), {
      type: "start",
      total: 2,
    });
    state = reduceSnapshotAllProgress(state, {
      type: "error",
      error: "Only the workspace owner can snapshot all users",
    });
    expect(state.phase).toBe("error");
    expect(state.error).toMatch(/owner/i);
    expect(formatSnapshotAllProgress(state)).toMatch(/failed/i);
  });
});

describe("LWM multi-user snapshot surface (structural)", () => {
  it("exposes snapshot-all control + progress hooks and wires real score path", () => {
    const lwmPath = join(ROOT, "components/KnowledgeConfigTrajectoryPanel.tsx");
    const routePath = join(ROOT, "app/api/workspaces/[id]/snapshot-all/route.ts");
    expect(existsSync(lwmPath)).toBe(true);
    expect(existsSync(routePath)).toBe(true);

    const lwm = readFileSync(lwmPath, "utf8");
    expect(lwm).toContain("data-lwm-generate-snapshot-all");
    expect(lwm).toContain("data-lwm-snapshot-modal");
    expect(lwm).toContain("data-lwm-snapshot-all-progress");
    expect(lwm).toContain("data-lwm-snapshot-all-status");
    expect(lwm).toContain("data-lwm-snapshot-all-bar");
    expect(lwm).toContain("generateSnapshotAll");
    expect(lwm).toContain("Snapshot all users");
    expect(lwm).toContain("/snapshot-all");
    expect(lwm).toContain("stream: true");
    expect(lwm).toContain("application/x-ndjson");
    expect(lwm).toContain("reduceSnapshotAllProgress");
    expect(lwm).toContain("consumeSnapshotAllNdjson");
    expect(lwm).toMatch(/openSnapshotModal\("all"\)/);
    // Same goal selection UI + payload as single-subject generate
    expect(lwm).toContain("data-lwm-goal-selection");
    expect(lwm).toMatch(/goal_mode:\s*goalMode/);
    expect(lwm).toMatch(/body\.adhoc_goal\s*=\s*adhocGoal/);
    expect(lwm).toMatch(/body\.goal_ids\s*=\s*selectedGoalIds/);
    // Owner-gated
    expect(lwm).toMatch(/isOwner[\s\S]*data-lwm-generate-snapshot-all|data-lwm-generate-snapshot-all[\s\S]*isOwner/);

    const route = readFileSync(routePath, "utf8");
    expect(route).toContain("listWorkspaceSnapshotSubjects");
    expect(route).toContain("runVerticalScore");
    expect(route).toContain("Only the workspace owner can snapshot all users");
    expect(route).toContain("application/x-ndjson");
    expect(route).toContain("subject_start");
    expect(route).toContain("stream");
    expect(route).toContain("parseGoalSelectionFromBody");
    expect(route).toContain("goalSelection");
    // Must not fake success without scoring
    expect(route).not.toMatch(/status:\s*["']ok["']\s*,\s*\/\/\s*fake/i);
  });

  it("snapshot-all route still supports non-stream JSON summary (no stream body)", () => {
    // Dashboard no longer hosts snapshot-all; LWM UI is the streaming client.
    // Route still defaults to a single JSON summary when stream is omitted.
    const route = readFileSync(
      join(ROOT, "app/api/workspaces/[id]/snapshot-all/route.ts"),
      "utf8",
    );
    expect(route).toContain("wantStream");
    expect(route).toContain("succeeded");
    expect(route).toContain("skipped");
    expect(route).toContain("failed");
    expect(route).toMatch(/NextResponse\.json\(\{[\s\S]*succeeded/);
  });
});
