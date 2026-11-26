import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { sessionEndEmbeddingTarget } from "@/lib/session-end-embedding";
import {
  listFlowEmbeddingsForOwner,
  persistCompletedFlowEmbedding,
  resetFlowEmbeddingStore,
} from "@/lib/flow-embedding-store";
import { learnSessionFieldInput, sessionBranchPrepareRequest, planSessionBranchPrepare } from "@/lib/session-branch-prepare";

const ROOT = join(__dirname, "../..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("sessionEndEmbeddingTarget", () => {
  it("sends Protocol runs to flow_kind=verify without a workspace id", () => {
    expect(
      sessionEndEmbeddingTarget({
        metadata: { verify_flow_id: "vf1", identity: "ada" },
      }),
    ).toEqual({ kind: "verify", flowId: "vf1", identity: "ada" });
    expect(
      sessionEndEmbeddingTarget({
        identity: "bob",
        metadata: { verifyFlowId: "vf2" },
      }),
    ).toEqual({ kind: "verify", flowId: "vf2", identity: "bob" });
    expect(
      sessionEndEmbeddingTarget({
        metadata: { solve_flow_id: "sf1", identity: "ada" },
      }),
    ).toEqual({ kind: "verify", flowId: "sf1", identity: "ada" });
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
    ).toEqual({ kind: "verify", flowId: "sf-col", identity: "cam" });
  });
});

describe("Protocol completed embeddings", () => {
  beforeEach(() => {
    resetFlowEmbeddingStore("memory");
  });

  it("persistCompletedFlowEmbedding stores flow_kind=verify on the owner", async () => {
    const stored = await persistCompletedFlowEmbedding({
      ownerUserId: "owner-1",
      flowKind: "verify",
      flowId: "vf1",
      runId: "sess-verify",
      identity: "ada",
      source: "verify",
      sequence: ["try", "insight"],
    });
    expect(stored.flow_kind).toBe("verify");
    expect(stored.flow_id).toBe("vf1");
    expect(stored.run_id).toBe("sess-verify");
    expect(stored.identity).toBe("ada");
    expect(stored.owner_user_id).toBe("owner-1");
    expect(stored.source).toBe("verify");
    const listed = await listFlowEmbeddingsForOwner({
      ownerUserId: "owner-1",
      flowKind: "verify",
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(stored.id);
  });
});

describe("Learn-canvas helpers", () => {
  it("learn field prepare includes leftover solveToken on the session-branch request", () => {
    const input = learnSessionFieldInput({
      sessionId: "sess-verify",
      problem: "Limits",
      solveToken: "stok",
    });
    const plan = planSessionBranchPrepare(input);
    expect(plan.kind).toBe("learn");
    expect(sessionBranchPrepareRequest(plan)).toMatchObject({
      sessionId: "sess-verify",
      solveToken: "stok",
    });
  });

  it("session-chat and confirm-end persist verify embeddings on the session embed route", () => {
    const chat = read("app/api/session-chat/route.ts");
    expect(chat).toContain("sessionGuestTokensFromBody");

    const persist = read("lib/learn-session-persist.ts");
    expect(persist).toContain("solveToken");

    const confirmEnd = read("components/session-view/use-session-phase.ts");
    const handle = confirmEnd.slice(confirmEnd.indexOf("const handleConfirmEnd"));
    expect(handle).toContain("sessionEndEmbeddingTarget");
    expect(handle).toContain("postWorkspaceFlowEmbedding");
    expect(handle).toContain('embeddingTarget?.kind === "verify"');
    expect(handle).toContain('flowKind: "verify"');
    expect(handle).toContain('flowKind: "learn"');

    const embedRoute = read("app/api/session/embed/route.ts");
    expect(embedRoute).toContain("persistCompletedFlowEmbedding");
    expect(embedRoute).toContain("requireSessionProofAccess");
  });
});
