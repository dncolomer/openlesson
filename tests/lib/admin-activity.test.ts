import { describe, expect, it } from "vitest";
import {
  activityTypeLabel,
  activityWindowStart,
  mergeActivityEvents,
  parseActivityWindow,
  rankActiveUsers,
  type RawActivityRow,
} from "@/lib/admin/activity";

const sampleRows: RawActivityRow[] = [
  {
    id: "s1",
    type: "ile_session",
    createdAt: "2026-07-17T12:00:00.000Z",
    summary: "Learn Rust",
    href: "/admin/sessions/s1",
    userId: "u1",
  },
  {
    id: "t1",
    type: "tap_session",
    createdAt: "2026-07-17T13:00:00.000Z",
    summary: "TAP session",
    href: "/admin/sessions/t1",
    userId: "u2",
  },
  {
    id: "p1",
    type: "proof_of_work",
    createdAt: "2026-07-17T11:00:00.000Z",
    summary: "Proof of work · tool",
    href: "/admin/workspaces/w1",
    userId: "u1",
  },
  {
    id: "w1",
    type: "workspace_created",
    createdAt: "2026-07-17T10:00:00.000Z",
    summary: "New workspace",
    href: "/admin/workspaces/w1",
    userId: null,
  },
];

describe("admin activity helpers", () => {
  it("parses activity windows with a safe default", () => {
    expect(parseActivityWindow("24h")).toBe("24h");
    expect(parseActivityWindow("7d")).toBe("7d");
    expect(parseActivityWindow("30d")).toBe("30d");
    expect(parseActivityWindow("nope")).toBe("7d");
    expect(parseActivityWindow(null)).toBe("7d");
  });

  it("computes window start relative to now", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    expect(activityWindowStart("24h", now).toISOString()).toBe("2026-07-16T12:00:00.000Z");
    expect(activityWindowStart("7d", now).toISOString()).toBe("2026-07-10T12:00:00.000Z");
  });

  it("merges and sorts activity events newest first", () => {
    const userMap = new Map([
      ["u1", { id: "u1", username: "alice", email: "a@example.com" }],
      ["u2", { id: "u2", username: "bob", email: "b@example.com" }],
    ]);

    const events = mergeActivityEvents(sampleRows, userMap, 3);
    expect(events).toHaveLength(3);
    expect(events[0].id).toBe("t1");
    expect(events[0].user.username).toBe("bob");
    expect(events[1].id).toBe("s1");
    expect(events[2].id).toBe("p1");
  });

  it("preserves proof-of-work details on merged events", () => {
    const details = {
      id: "p2",
      proofOfWorkType: "tool",
      fileName: "tool-usage.json",
      mimeType: "application/json",
      fileSize: 128,
      toolName: "editor",
      toolAction: "save",
      deviceName: null,
      sampleCount: null,
      workspaceId: "w1",
      workspaceTitle: "Demo",
      blockId: null,
      sessionId: null,
      chunkIndex: 0,
      timestampMs: 1,
      metadata: { ok: true },
      bandPowers: null,
      createdByApiKeyId: null,
      createdAt: "2026-07-17T14:00:00.000Z",
    };

    const rows: RawActivityRow[] = [
      {
        id: "p2",
        type: "proof_of_work",
        createdAt: details.createdAt,
        summary: "PoW · tool · editor",
        href: "/admin/workspaces/w1",
        userId: "u1",
        details,
      },
    ];

    const events = mergeActivityEvents(
      rows,
      new Map([["u1", { id: "u1", username: "alice", email: null }]]),
      10
    );
    expect(events[0].details?.toolName).toBe("editor");
    expect(events[0].details?.metadata).toEqual({ ok: true });
  });

  it("ranks active users by last activity and aggregates counts", () => {
    const profiles = new Map([
      ["u1", { username: "alice", email: "a@example.com", plan: "trial" }],
      ["u2", { username: "bob", email: "b@example.com", plan: "inactive" }],
    ]);

    const ranked = rankActiveUsers(sampleRows, profiles, 10);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].userId).toBe("u2");
    expect(ranked[0].tapSessions).toBe(1);
    expect(ranked[1].userId).toBe("u1");
    expect(ranked[1].ileSessions).toBe(1);
    expect(ranked[1].proofOfWork).toBe(1);
    expect(ranked[1].plan).toBe("trial");
  });

  it("labels activity types for UI", () => {
    expect(activityTypeLabel("ile_session")).toBe("ILE session");
    expect(activityTypeLabel("tap_session")).toBe("TAP session");
    expect(activityTypeLabel("proof_of_work")).toBe("Proof of work");
    expect(activityTypeLabel("workspace_created")).toBe("Workspace");
  });
});
