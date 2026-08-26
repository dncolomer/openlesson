/**
 * TAPBench 64D score from streamed traces. Dump wrap HTTP is closed.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GET as getTasks } from "@/app/api/v3/tapbench/tasks/route";
import { GET as getResults } from "@/app/api/v3/tapbench/results/route";
import {
  authenticateTapbenchKey,
  assertTapbenchKeyForTask,
  issueTapbenchTaskKey,
  resetTapbenchKeyStoreForTests,
} from "@/lib/tapbench/keys";
import {
  powFeatureRowsFromTapbenchUpload,
  snapshotTapbenchPowPayload,
} from "@/lib/tapbench/wrap";
import { selectTapbenchBenchmarkTasks } from "@/lib/tapbench/catalog";
import { TAPBENCH_OWNER_EMAIL, TAPBENCH_STASH_ONLY_MESSAGE } from "@/lib/tapbench/constants";
import { NextRequest } from "next/server";

const ROOT = join(__dirname, "../..");

const POW_DATA = Buffer.from(
  JSON.stringify({ action: "tool_call", tool: "search", args: { q: "64d" } }),
).toString("base64");

function powBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "tool",
    mime_type: "application/json",
    data: POW_DATA,
    tool_name: "search",
    tool_action: "query",
    timestamp_ms: 1_700_000_000_000,
    metadata: { step: 1 },
    ...overrides,
  };
}

describe("TAPBench dump endpoints closed", () => {
  it("does not ship POST /api/v3/tapbench/tasks/[id]/runs", () => {
    expect(
      existsSync(join(ROOT, "app/api/v3/tapbench/tasks/[id]/runs/route.ts")),
    ).toBe(false);
  });

  it("PoW dump and MCP upload reject TAPBench keys toward Stash", () => {
    const pow = readFileSync(
      join(ROOT, "app/api/v3/pow/workspaces/[id]/proof-of-work/route.ts"),
      "utf8",
    );
    expect(pow).toContain("tapbench_key");
    expect(pow).toContain("TAPBENCH_STASH_ONLY_MESSAGE");
    expect(pow).not.toContain("maybeScoreTapbenchPowUpload");
    const mcp = readFileSync(join(ROOT, "lib/pow-api/mcp-tools/dispatch.ts"), "utf8");
    expect(mcp).toContain("TAPBENCH_STASH_ONLY_MESSAGE");
    expect(TAPBENCH_STASH_ONLY_MESSAGE.toLowerCase()).toMatch(/stash/);
  });
});

describe("TAPBench 64D snapshot from streamed traces (no region)", () => {
  beforeEach(() => {
    resetTapbenchKeyStoreForTests();
  });

  it("writes a snapshot and tooling without building a region", async () => {
    const workspaceId = "ws-task-a";
    const issued = await issueTapbenchTaskKey({ workspaceId, userId: "user-1" });
    const pow = powBody();
    const persisted: Array<{ workspaceId: string; keyId: string; dim: number }> = [];

    const result = await snapshotTapbenchPowPayload(
      {
        key: issued.record,
        workspaceId,
        proofOfWork: pow,
        tooling: {
          agentic_harness: "custom ReAct loop",
          model: "grok-4",
          notes: "unit test run",
        },
        powRows: powFeatureRowsFromTapbenchUpload(pow),
      },
      {
        nowMs: pow.timestamp_ms,
        persistEmbedding: async ({ workspaceId: ws, vector, key }) => {
          persisted.push({ workspaceId: ws, keyId: key.id, dim: vector.length });
        },
      },
    );

    expect(result.snapshot.generated).toBe(true);
    expect(result.snapshot.dim).toBe(64);
    expect(result.snapshot.embedding_model_id).toBe("knowledgecfg-v1-d64");
    expect(result.tooling.agentic_harness).toBe("custom ReAct loop");
    expect(result.tooling.model).toBe("grok-4");
    expect(result.key_id).toBe(issued.record.id);
    expect(persisted).toEqual([
      { workspaceId, keyId: issued.record.id, dim: 64 },
    ]);
    expect(result).not.toHaveProperty("score");
    expect(result).not.toHaveProperty("region");
  });

  it("rejects a TAPBench key used on the wrong Task", async () => {
    const issued = await issueTapbenchTaskKey({ workspaceId: "ws-task-a" });
    const scoped = assertTapbenchKeyForTask(issued.record, "ws-task-b");
    expect(scoped.ok).toBe(false);
    if (scoped.ok) return;
    expect(scoped.code).toBe("forbidden");
    const authed = await authenticateTapbenchKey(issued.rawKey);
    expect(authed.ok).toBe(true);
  });
});

describe("TAPBench catalog + public HTTP", () => {
  it("selects only public workspaces of the tapbench owner", () => {
    const owner = "owner-tapbench";
    const tasks = selectTapbenchBenchmarkTasks(
      [
        {
          id: "pub-1",
          title: "Algebra",
          is_public: true,
          user_id: owner,
          archived_at: null,
        },
        {
          id: "priv-1",
          title: "Secret",
          is_public: false,
          user_id: owner,
        },
        {
          id: "other-1",
          title: "Other",
          is_public: true,
          user_id: "someone-else",
        },
      ],
      owner,
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("pub-1");
    expect(tasks[0].owner_email).toBe(TAPBENCH_OWNER_EMAIL);
  });

  it("GET /api/v3/tapbench/tasks is an honest empty catalog without live secrets", async () => {
    const first = await getTasks();
    const second = await getTasks();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const a = (await first.json()) as { tasks: unknown[]; owner_email: string };
    const b = (await second.json()) as { tasks: unknown[]; owner_email: string };
    expect(a.owner_email).toBe(TAPBENCH_OWNER_EMAIL);
    expect(Array.isArray(a.tasks)).toBe(true);
    expect(Array.isArray(b.tasks)).toBe(true);
    expect(a.tasks.length).toBe(b.tasks.length);
  });

  it("GET /api/v3/tapbench/results returns 64D score fields on an honest empty list", async () => {
    const req = () =>
      new NextRequest("http://localhost/api/v3/tapbench/results", { method: "GET" });
    const first = await getResults(req());
    const second = await getResults(req());
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const a = (await first.json()) as {
      dim: number;
      embedding_model_id: string;
      runs: unknown[];
      regions: unknown[];
    };
    const b = (await second.json()) as { dim: number; runs: unknown[]; regions: unknown[] };
    expect(a.dim).toBe(64);
    expect(a.embedding_model_id).toBe("knowledgecfg-v1-d64");
    expect(Array.isArray(a.runs)).toBe(true);
    expect(Array.isArray(a.regions)).toBe(true);
    expect(b.runs.length).toBe(a.runs.length);
    expect(b.regions.length).toBe(a.regions.length);
    for (const run of a.runs as Array<Record<string, unknown>>) {
      expect(run.dim).toBe(64);
      expect(run.embedding_model_id).toBe("knowledgecfg-v1-d64");
      expect(typeof run.in_region).toBe("boolean");
      expect(Number.isFinite(run.distance_to_center as number)).toBe(true);
      expect(run.tooling).toBeTruthy();
    }
  });
});
