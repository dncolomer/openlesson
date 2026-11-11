import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { sessionEndEmbeddingTarget } from "@/lib/session-end-embedding";
import { persistSolveCompletedEmbedding } from "@/lib/solve-flow-embedding";
import {
  listFlowEmbeddingsForOwner,
  resetFlowEmbeddingStore,
} from "@/lib/flow-embedding-store";
import { learnSessionFieldInput, sessionBranchPrepareRequest, planSessionBranchPrepare } from "@/lib/session-branch-prepare";

const ROOT = join(__dirname, "../..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("sessionEndEmbeddingTarget", () => {
  it("sends Solve runs to flow_kind=solve without a workspace id", () => {
    expect(
      sessionEndEmbeddingTarget({
        metadata: { solve_flow_id: "sf1", identity: "ada" },
      }),
    ).toEqual({ kind: "solve", flowId: "sf1", identity: "ada" });
    expect(
      sessionEndEmbeddingTarget({
        identity: "bob",
        metadata: { solveFlowId: "sf2" },
      }),
    ).toEqual({ kind: "solve", flowId: "sf2", identity: "bob" });
  });

  it("sends map Learn sessions to the workspace embedding", () => {
    expect(
      sessionEndEmbeddingTarget({
        metadata: { workspace_id: "ws-1" },
      }),
    ).toEqual({ kind: "learn", workspaceId: "ws-1" });
    expect(sessionEndEmbeddingTarget({ metadata: {} })).toBeNull();
    expect(
      sessionEndEmbeddingTarget({
        solve_flow_id: "sf-col",
        identity: "cam",
      }),
    ).toEqual({ kind: "solve", flowId: "sf-col", identity: "cam" });
  });
});

describe("Solve completed embeddings", () => {
  beforeEach(() => {
    resetFlowEmbeddingStore("memory");
  });

  it("persistSolveCompletedEmbedding stores flow_kind=solve on the owner", async () => {
    const stored = await persistSolveCompletedEmbedding({
      ownerUserId: "owner-1",
      flowId: "sf1",
      runId: "sess-solve",
      identity: "ada",
      sequence: ["try", "insight"],
    });
    expect(stored.flow_kind).toBe("solve");
    expect(stored.flow_id).toBe("sf1");
    expect(stored.run_id).toBe("sess-solve");
    expect(stored.identity).toBe("ada");
    expect(stored.owner_user_id).toBe("owner-1");
    expect(stored.source).toBe("solve");
    const listed = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-1",
      flowKind: "solve",
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(stored.id);
  });
});

describe("Solve token plumbing on Learn-canvas helpers", () => {
  it("learn field prepare includes solveToken on the session-branch request", () => {
    const input = learnSessionFieldInput({
      sessionId: "sess-solve",
      problem: "Limits",
      solveToken: "stok",
    });
    const plan = planSessionBranchPrepare(input);
    expect(plan.kind).toBe("learn");
    expect(sessionBranchPrepareRequest(plan)).toMatchObject({
      sessionId: "sess-solve",
      solveToken: "stok",
    });
  });

  it("session-chat and confirm-end use the shipped Solve guest paths", () => {
    const chat = read("app/api/session-chat/route.ts");
    expect(chat).toContain("sessionGuestTokensFromBody");
    expect(chat).toContain("tokens.solveToken");

    const objectives = read("app/api/generate-objectives/route.ts");
    expect(objectives).toContain("resolveSolveFlowAccess");
    expect(objectives).toContain("solveToken");

    const persist = read("lib/learn-session-persist.ts");
    expect(persist).toContain("solveToken");
    expect(persist).toContain("saveSolveLinkSession");

    const confirmEnd = read("components/session-view/use-session-phase.ts");
    const handle = confirmEnd.slice(confirmEnd.indexOf("const handleConfirmEnd"));
    expect(handle).toContain("sessionEndEmbeddingTarget");
    expect(handle).toContain("postSolveFlowEmbedding");
    expect(handle).toContain("postWorkspaceFlowEmbedding");
    expect(handle).toContain('flowKind: "learn"');

    const embedRoute = read("app/api/solve-flow/public/[token]/embed/route.ts");
    expect(embedRoute).toContain("persistSolveCompletedEmbedding");
    expect(embedRoute).toContain("resolveSolveSessionAccess");
  });
});
