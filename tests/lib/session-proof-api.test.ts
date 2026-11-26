import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sessionEndEmbeddingTarget } from "@/lib/session-end-embedding";
import { resolveIleSessionChatPowUpload } from "@/lib/learn-session-chat-pow";
import { sessionGuestTokensFromBody } from "@/lib/api/require-auth";
import { getAyclPurchaseByToken } from "@/lib/aycl";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("session-scoped PoW and embeddings", () => {
  it("ships session proof and embed routes", () => {
    expect(existsSync(join(ROOT, "app/api/session/proof-of-work/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/session/proof-of-work/impure/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/session/embed/route.ts"))).toBe(true);
    const pow = read("app/api/session/proof-of-work/route.ts");
    expect(pow).toContain("requireSessionProofAccess");
    expect(pow).toContain("uploadWorkspaceProofOfWork");
    const embed = read("app/api/session/embed/route.ts");
    expect(embed).toContain("persistCompletedFlowEmbedding");
    expect(embed).not.toContain("persistSolveCompletedEmbedding");
  });

  it("clients post to session routes without requiring a workspace id", () => {
    const client = read("lib/learn-proof-of-work-client.ts");
    expect(client).toContain("/api/session/proof-of-work");
    expect(client).toContain("/api/session/proof-of-work/impure");
    expect(client).not.toContain("/api/workspace/proof-of-work");
    const embedClient = read("lib/flow-embedding-client.ts");
    expect(embedClient).toContain("/api/session/embed");
    expect(embedClient).not.toContain("/api/workspace/flow-embeddings");
    const runtime = read("components/session-view/use-session-runtime.ts");
    expect(runtime).toContain("if (!currentSession || !powSessionEnabledRef.current) return");
    expect(runtime).not.toContain("if (!workspaceId || !currentSession");
  });

  it("Protocol session end persists verify embeddings with a public token or cookie session", () => {
    const phase = read("components/session-view/use-session-phase.ts");
    const handle = phase.slice(phase.indexOf("const handleConfirmEnd"));
    expect(handle).toContain('embeddingTarget?.kind === "verify"');
    expect(handle).toContain("postWorkspaceFlowEmbedding");
    expect(handle).toContain('flowKind: "verify"');
    expect(sessionEndEmbeddingTarget({ metadata: { solve_flow_id: "sf1" } })).toEqual({
      kind: "verify",
      flowId: "sf1",
      identity: null,
    });
  });

  it("Verify persists embeddings without a workspace gate", () => {
    const verify = read("components/tap-score/use-tap-score-flow.ts");
    expect(verify).toContain('s.kind === "verify" && policy && !s.localOpening');
    expect(verify).not.toContain("s.workspaceId && !s.localOpening");
  });

  it("TAP start/complete/chat write unified sessions and record PoW on tap session id", () => {
    const start = read("app/api/verify/session/start/route.ts");
    expect(start).toContain("insertGuestSession");
    expect(start).toContain("updateGuestSession");
    expect(start).not.toContain(".from(write.table)");
    expect(start).not.toContain(".from(access.sessionTable)");
    const complete = read("app/api/verify/session/complete/route.ts");
    expect(complete).toContain("insertGuestSession");
    expect(complete).toContain("updateGuestSession");
    expect(complete).toContain("tapProofSessionId");
    const chat = read("app/api/verify/session/chat/route.ts");
    expect(chat).toContain("updateGuestSession");
    expect(chat).toContain("tapProofSessionId");
    expect(chat).not.toContain('jsonError(400, "workspaceId is required")');
    const auth = read("lib/tap-score-session-auth.ts");
    expect(auth).toContain("guest_link");
    expect(auth).not.toContain("requested_duration_seconds, focus_block_ids");
  });

  it("session chat PoW persists on a uuid session id alone", () => {
    const sessionId = "550e8400-e29b-41d4-a716-446655440000";
    expect(resolveIleSessionChatPowUpload({ sessionId, workspaceId: "" })).toEqual({
      persist: true,
      sessionId,
      workspaceId: "",
    });
  });

  it("skips session chat PoW when session or workspace ids are not uuids", () => {
    expect(resolveIleSessionChatPowUpload({ sessionId: "klhkj", workspaceId: "" })).toEqual({
      persist: false,
    });
    expect(
      resolveIleSessionChatPowUpload({
        sessionId: "s",
        workspaceId: "klhkj",
      }),
    ).toEqual({ persist: false });
    const sessionId = "550e8400-e29b-41d4-a716-446655440000";
    expect(
      resolveIleSessionChatPowUpload({ sessionId, workspaceId: "klhkj" }),
    ).toEqual({ persist: true, sessionId, workspaceId: "" });
  });

  it("ignores leftover AYCL tokens and does not query dropped purchases", async () => {
    expect(sessionGuestTokensFromBody({ ayclToken: "tok", solveToken: "stok" })).toEqual({
      ayclToken: null,
      ileToken: null,
      solveToken: "stok",
    });
    await expect(getAyclPurchaseByToken({} as never, "tok")).resolves.toBeNull();
    const aycl = read("lib/aycl.ts");
    const start = aycl.indexOf("export async function getAyclPurchaseByToken");
    const end = aycl.indexOf("export async function getAyclPurchaseByCheckoutSession");
    expect(aycl.slice(start, end)).not.toContain('.from("aycl_purchases")');
  });
});
