/**
 * TAPBench GET /tasks/{id}/goals — what agents should demonstrate.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TAPBENCH_OWNER_EMAIL } from "@/lib/tapbench/constants";
import { presentTapbenchTaskGoals } from "@/lib/tapbench/goals";
import type { TapbenchTask } from "@/lib/tapbench/catalog";
import { GET as getGoals } from "@/app/api/v3/tapbench/tasks/[id]/goals/route";
import { NextRequest } from "next/server";

const ROOT = join(__dirname, "../..");

const TASK: TapbenchTask = {
  id: "ws-graphs",
  title: "Graphs",
  root_topic: "CS",
  description: null,
  cover_image_url: null,
  created_at: null,
  owner_email: TAPBENCH_OWNER_EMAIL,
};

describe("presentTapbenchTaskGoals", () => {
  it("lists workspace and block goals with block titles for the agent", () => {
    const payload = presentTapbenchTaskGoals({
      task: TASK,
      workspaceGoal: "Show graph competence",
      workspaceGoals: [
        { id: "g-ws", text: "Prove or disprove short cycles", scope: "workspace", block_id: null },
      ],
      blockGoals: [
        {
          id: "g-b",
          text: "Give a concrete adjacency list",
          scope: "block",
          block_id: "blk-1",
        },
      ],
      blocks: [{ id: "blk-1", title: "Algorithms" }],
    });

    expect(payload.workspace_id).toBe("ws-graphs");
    expect(payload.task).toEqual({ id: "ws-graphs", title: "Graphs" });
    expect(payload.workspace_goal).toBe("Show graph competence");
    expect(payload.goals).toEqual([
      {
        id: "g-ws",
        text: "Prove or disprove short cycles",
        scope: "workspace",
        block_id: null,
        block_title: null,
      },
      {
        id: "g-b",
        text: "Give a concrete adjacency list",
        scope: "block",
        block_id: "blk-1",
        block_title: "Algorithms",
      },
    ]);
  });

  it("falls back to workspace_goal when the catalog is empty", () => {
    const payload = presentTapbenchTaskGoals({
      task: TASK,
      workspaceGoal: "  Demonstrate shortest-path reasoning  ",
      workspaceGoals: [],
      blockGoals: [],
    });
    expect(payload.workspace_goal).toBe("Demonstrate shortest-path reasoning");
    expect(payload.goals).toEqual([
      {
        id: null,
        text: "Demonstrate shortest-path reasoning",
        scope: "workspace",
        block_id: null,
        block_title: null,
      },
    ]);
  });

  it("skips blank goal text", () => {
    const payload = presentTapbenchTaskGoals({
      task: TASK,
      workspaceGoal: null,
      workspaceGoals: [{ id: "empty", text: "   ", scope: "workspace" }],
      blockGoals: [{ id: "b", text: "", scope: "block", block_id: "x" }],
    });
    expect(payload.workspace_goal).toBeNull();
    expect(payload.goals).toEqual([]);
  });
});

describe("GET /api/v3/tapbench/tasks/{id}/goals", () => {
  it("ships the public TAPBench goals route", () => {
    const rel = "app/api/v3/tapbench/tasks/[id]/goals/route.ts";
    expect(existsSync(join(ROOT, rel))).toBe(true);
    const src = readFileSync(join(ROOT, rel), "utf8");
    expect(src).toContain("loadTapbenchTaskGoals");
    expect(src).toContain("export async function GET");
  });

  it("returns 404 for an unknown Benchmark Task", async () => {
    const req = new NextRequest(
      "http://localhost/api/v3/tapbench/tasks/00000000-0000-4000-8000-000000000000/goals",
    );
    const res = await getGoals(req, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("workspace_not_found");
  });

  it("returns 400 when the task id is empty", async () => {
    const req = new NextRequest("http://localhost/api/v3/tapbench/tasks//goals");
    const res = await getGoals(req, { params: Promise.resolve({ id: "  " }) });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v3/tapbench/tasks/{id}/stop", () => {
  it("ships the TAPBench stop-session route", () => {
    const rel = "app/api/v3/tapbench/tasks/[id]/stop/route.ts";
    expect(existsSync(join(ROOT, rel))).toBe(true);
    const src = readFileSync(join(ROOT, rel), "utf8");
    expect(src).toContain("stopTapbenchSession");
    expect(src).toContain("export async function POST");
    expect(src).toContain("guest_user_id");
  });
});
