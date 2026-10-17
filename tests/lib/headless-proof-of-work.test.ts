/**
 * Drives shipped headless proof-of-work REST + MCP: start, ingest, clock, end.
 * TAPBench uses this same entry. LLM is stubbed the same way session-policy tests do.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createMemoryAgentSupabase } from "@/tests/helpers/memory-agent-supabase";
import type { AuthContext } from "@/lib/pow-api/types";
import { normalizeSessionBranchModel } from "@/lib/session-branch-model";
import type { LearningModelSize } from "@/lib/learning-model";
import { resetFlowEmbeddingStore } from "@/lib/flow-embedding-store";

vi.mock("@/lib/pow-api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pow-api/auth")>();
  return {
    ...actual,
    authenticateRequest: vi.fn(),
  };
});

import { authenticateRequest } from "@/lib/pow-api/auth";
import { POST as POST_WORKSPACES } from "@/app/api/v3/workspaces/route";
import { POST as POST_START } from "@/app/api/v3/pow/workspaces/[id]/sessions/route";
import { POST as POST_POW } from "@/app/api/v3/pow/workspaces/[id]/sessions/[sessionId]/proof-of-work/route";
import { POST as POST_END } from "@/app/api/v3/pow/workspaces/[id]/sessions/[sessionId]/end/route";
import {
  resetHeadlessSessionsForTests,
  setHeadlessSessionDepsForTests,
  setHeadlessSessionDurableBackendForTests,
  type HeadlessSessionDurableBackend,
  type HeadlessSessionRecord,
} from "@/lib/pow-api/headless-session";
import { callMcpProofOfWorkTool } from "@/lib/pow-api/mcp-proof-of-work-server";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-7ec135c42124/implementer";

const auth: AuthContext = {
  key_id: "key-test",
  user_id: "user-test",
  guest_user_id: null,
  organization_id: "org-1",
  is_org_admin: true,
  scopes: ["workspaces:read", "workspaces:write", "tap:read", "tap:write"],
};

function birthTree(catalogSize: LearningModelSize = 4) {
  return normalizeSessionBranchModel(
    {
      premise: "A priced field.",
      closePrice: 10,
      keepPrice: 40,
      discardPrice: 70,
      insightPrice: 90,
      regions: [
        {
          title: "Region",
          observation: "The region is open.",
          closePrice: 10,
          keepPrice: 40,
          discardPrice: 70,
          insightPrice: 90,
        },
      ],
    },
    "Priced",
    catalogSize,
  );
}

function confidenceReply() {
  return JSON.stringify({
    close: 0.82,
    keep: 0.05,
    discard: 0.04,
    insight: 0.03,
    closeLine: "Close this observation.",
    keepLine: "Keep looking.",
    discardLine: "Drop this line.",
    insightLine: "Insight waits.",
  });
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer sk_test",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function parseTool(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

describe("headless proof-of-work REST + MCP", () => {
  let supabase: ReturnType<typeof createMemoryAgentSupabase>;
  let now = 1_700_000_000_000;

  beforeEach(() => {
    now = 1_700_000_000_000;
    supabase = createMemoryAgentSupabase();
    vi.mocked(authenticateRequest).mockImplementation(async () => ({
      auth,
      supabase: supabase as never,
    }));
    resetHeadlessSessionsForTests();
    resetFlowEmbeddingStore("memory");
    setHeadlessSessionDepsForTests({
      nowMs: () => now,
      generateModel: async (input) => {
        const size = (input.catalogSize as LearningModelSize) || 4;
        const model = birthTree(size);
        if (!model) throw new Error("failed tree");
        return { ok: true, model };
      },
      inferPolicy: async () => ({ ok: true, reply: confidenceReply() }),
    });
  });

  afterEach(() => {
    resetHeadlessSessionsForTests();
    vi.mocked(authenticateRequest).mockReset();
  });

  it("starts Calibrate, infers a path from proof, rejects expired work, and ends; TAPBench uses the same entry", async () => {
    const created = await POST_WORKSPACES(
      jsonRequest("http://localhost/api/v3/workspaces", "POST", {
        kind: "learning",
        title: "Headless field",
        blocks: [{ title: "Chapter", description: "Priced field", is_start: true }],
      }),
    );
    const createdJson = (await created.json()) as { workspace: { id: string } };
    const workspaceId = createdJson.workspace.id;

    const start4 = await POST_START(
      jsonRequest(`http://localhost/api/v3/pow/workspaces/${workspaceId}/sessions`, "POST", {
        flow_kind: "calibrate",
        catalog_size: 4,
        duration_minutes: 15,
        chapter_title: "Priced",
        chapter_brief: "A priced field.",
      }),
      { params: Promise.resolve({ id: workspaceId }) },
    );
    expect(start4.status).toBe(201);
    const session4 = (await start4.json()) as {
      session_id: string;
      answers_model: { catalog_size: number; branch_count: number };
      remaining_ms: number;
      flow_kind: string;
    };
    expect(session4.flow_kind).toBe("calibrate");
    expect(session4.answers_model.catalog_size).toBe(4);
    expect(session4.answers_model.branch_count).toBeGreaterThan(0);
    expect(session4.remaining_ms).toBe(15 * 60_000);

    const start8 = await POST_START(
      jsonRequest(`http://localhost/api/v3/pow/workspaces/${workspaceId}/sessions`, "POST", {
        flow_kind: "learn",
        catalog_size: 8,
        duration_minutes: 10,
        chapter_title: "Priced",
      }),
      { params: Promise.resolve({ id: workspaceId }) },
    );
    const session8 = (await start8.json()) as {
      answers_model: { catalog_size: number };
    };
    expect(session8.answers_model.catalog_size).toBe(8);

    const ingested = await POST_POW(
      jsonRequest(
        `http://localhost/api/v3/pow/workspaces/${workspaceId}/sessions/${session4.session_id}/proof-of-work`,
        "POST",
        {
          events: [
            { tool_action: "board_prompt", metadata: { prompt: "I close this observation." } },
            { tool_action: "expand_more", metadata: { prompt: "Keep going." } },
            { tool_action: "dictate", metadata: { prompt: "Settled." } },
          ],
        },
      ),
      { params: Promise.resolve({ id: workspaceId, sessionId: session4.session_id }) },
    );
    expect(ingested.status).toBe(200);
    const ingestedJson = (await ingested.json()) as {
      sequence: string[];
      proof_count: number;
      remaining_ms: number;
    };
    expect(ingestedJson.proof_count).toBe(3);
    expect(ingestedJson.sequence.length).toBeGreaterThanOrEqual(1);
    expect(ingestedJson.remaining_ms).toBeGreaterThan(0);

    now += 15 * 60_000 + 1;
    const expired = await POST_POW(
      jsonRequest(
        `http://localhost/api/v3/pow/workspaces/${workspaceId}/sessions/${session4.session_id}/proof-of-work`,
        "POST",
        { events: [{ tool_action: "board_prompt", metadata: { prompt: "too late" } }] },
      ),
      { params: Promise.resolve({ id: workspaceId, sessionId: session4.session_id }) },
    );
    expect(expired.status).toBe(401);
    const expiredJson = (await expired.json()) as {
      error: { code: string; details?: { remaining_ms?: number } };
    };
    expect(expiredJson.error.code).toBe("session_expired");
    expect(expiredJson.error.details?.remaining_ms).toBe(0);

    const ended = await POST_END(
      jsonRequest(
        `http://localhost/api/v3/pow/workspaces/${workspaceId}/sessions/${session4.session_id}/end`,
        "POST",
        {},
      ),
      { params: Promise.resolve({ id: workspaceId, sessionId: session4.session_id }) },
    );
    expect(ended.status).toBe(200);
    const endedJson = (await ended.json()) as {
      embedding: { flow_kind: string; raw: { genModel: unknown; pow: unknown[] } } | null;
      sequence: string[];
    };
    expect(endedJson.embedding).toBeTruthy();
    expect(endedJson.embedding?.raw.genModel).toBeTruthy();
    expect(endedJson.embedding?.raw.pow.length).toBeGreaterThan(0);

    const tapbench = parseTool(
      (await callMcpProofOfWorkTool(
        "start_session",
        {
          workspace_id: workspaceId,
          flow_kind: "tapbench",
          catalog_size: 16,
          duration_minutes: 5,
          chapter_title: "Priced",
        },
        { auth, supabase: supabase as never, origin: "https://uncertain.systems" },
      )) as { content: Array<{ text: string }> },
    );
    expect(tapbench.flow_kind).toBe("tapbench");
    expect((tapbench.answers_model as { catalog_size: number }).catalog_size).toBe(16);

    const tapPow = parseTool(
      (await callMcpProofOfWorkTool(
        "upload_proof_of_work",
        {
          workspace_id: workspaceId,
          session_id: tapbench.session_id,
          events: [{ tool_action: "think", metadata: { prompt: "Agent reasoning." } }],
        },
        { auth, supabase: supabase as never, origin: "https://uncertain.systems" },
      )) as { content: Array<{ text: string }> },
    );
    expect((tapPow.proof_count as number) >= 1).toBe(true);

    const tapEnd = parseTool(
      (await callMcpProofOfWorkTool(
        "end_session",
        { workspace_id: workspaceId, session_id: tapbench.session_id },
        { auth, supabase: supabase as never, origin: "https://uncertain.systems" },
      )) as { content: Array<{ text: string }> },
    );
    expect(tapEnd.embedding).toBeTruthy();
    expect((tapEnd.embedding as { flow_kind: string }).flow_kind).toBe("verify");

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "headless-pow.log"),
      JSON.stringify(
        {
          calibrate: { session4, ingested: ingestedJson, ended: endedJson },
          learn8: session8,
          tapbench: { start: tapbench, pow: tapPow, end: tapEnd },
          expired: expiredJson,
        },
        null,
        2,
      ),
    );
  });

  it("round-trips start then upload across a fresh store", async () => {
    const table = new Map<string, string>();
    const durable: HeadlessSessionDurableBackend = {
      async get(id) {
        const raw = table.get(id);
        return raw ? (JSON.parse(raw) as HeadlessSessionRecord) : null;
      },
      async put(record) {
        table.set(record.id, JSON.stringify(record));
      },
      async listByWorkspace(workspaceId) {
        return [...table.values()]
          .map((raw) => JSON.parse(raw) as HeadlessSessionRecord)
          .filter((row) => row.workspace_id === workspaceId);
      },
    };
    setHeadlessSessionDurableBackendForTests(durable);

    const created = await POST_WORKSPACES(
      jsonRequest("http://localhost/api/v3/workspaces", "POST", {
        kind: "learning",
        title: "Durable field",
        blocks: [{ title: "Chapter", description: "Priced field", is_start: true }],
      }),
    );
    const createdJson = (await created.json()) as { workspace: { id: string } };
    const workspaceId = createdJson.workspace.id;

    const started = await POST_START(
      jsonRequest(`http://localhost/api/v3/pow/workspaces/${workspaceId}/sessions`, "POST", {
        flow_kind: "verify",
        catalog_size: 4,
        duration_minutes: 15,
        chapter_title: "Priced",
      }),
      { params: Promise.resolve({ id: workspaceId }) },
    );
    expect(started.status).toBe(201);
    const startedJson = (await started.json()) as { session_id: string };
    expect(table.has(startedJson.session_id)).toBe(true);

    resetHeadlessSessionsForTests();
    setHeadlessSessionDepsForTests({
      nowMs: () => now,
      generateModel: async (input) => {
        const size = (input.catalogSize as LearningModelSize) || 4;
        const model = birthTree(size);
        if (!model) throw new Error("failed tree");
        return { ok: true, model };
      },
      inferPolicy: async () => ({ ok: true, reply: confidenceReply() }),
    });
    setHeadlessSessionDurableBackendForTests(durable);

    const ingested = await POST_POW(
      jsonRequest(
        `http://localhost/api/v3/pow/workspaces/${workspaceId}/sessions/${startedJson.session_id}/proof-of-work`,
        "POST",
        { events: [{ tool_action: "board_prompt", metadata: { prompt: "Close it." } }] },
      ),
      { params: Promise.resolve({ id: workspaceId, sessionId: startedJson.session_id }) },
    );
    expect(ingested.status).toBe(200);
    const ingestedJson = (await ingested.json()) as { proof_count: number; session_id: string };
    expect(ingestedJson.session_id).toBe(startedJson.session_id);
    expect(ingestedJson.proof_count).toBeGreaterThan(0);
  });
});
