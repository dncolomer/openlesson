import { describe, expect, it, beforeEach } from "vitest";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import { createdByApiKeyId } from "@/lib/pow-api/auth";
import {
  issueTapbenchTaskKey,
  memoryTapbenchKeyStore,
  resetTapbenchKeyStoreForTests,
} from "@/lib/tapbench/keys";
import {
  authContextFromTapbenchKey,
  authenticateTapbenchPowKey,
  isTapbenchKeyMaterial,
  stashContextFromTapbenchKey,
} from "@/lib/tapbench/pow-auth";
import { toolingFromPowMetadata } from "@/lib/tapbench/tooling";

describe("TAPBench PoW API auth", () => {
  beforeEach(() => {
    resetTapbenchKeyStoreForTests();
  });

  it("recognizes tbk_ material and scopes access to the issued Task only", async () => {
    const issued = await issueTapbenchTaskKey({ workspaceId: "ws-task-a", userId: "u1" });
    expect(isTapbenchKeyMaterial(issued.rawKey)).toBe(true);
    expect(isTapbenchKeyMaterial("sk_not_tapbench")).toBe(false);

    const auth = authContextFromTapbenchKey(issued.record);
    expect(auth.auth_method).toBe("tapbench_key");
    expect(auth.tapbench_workspace_id).toBe("ws-task-a");
    expect(createdByApiKeyId(auth)).toBeNull();
    expect(
      canAccessAgentWorkspace(auth, {
        id: "ws-task-a",
        user_id: "owner",
        organization_id: "org",
      }),
    ).toBe(true);
    expect(
      canAccessAgentWorkspace(auth, {
        id: "ws-other",
        user_id: "owner",
        organization_id: "org",
      }),
    ).toBe(false);

    const ok = await authenticateTapbenchPowKey(
      issued.rawKey,
      "workspaces:write",
      {} as never,
      memoryTapbenchKeyStore,
    );
    expect(ok.ok).toBe(true);

    const tap = await authenticateTapbenchPowKey(
      issued.rawKey,
      "tap:write",
      {} as never,
      memoryTapbenchKeyStore,
    );
    expect(tap.ok).toBe(false);
    if (!tap.ok) expect(tap.status).toBe(403);

    const ctx = stashContextFromTapbenchKey(auth, "ws-task-a");
    expect(ctx?.workspace_id).toBe("ws-task-a");
    expect(stashContextFromTapbenchKey(auth, "ws-other")).toBeNull();
  });

  it("rejects TAP after stop session", async () => {
    const issued = await issueTapbenchTaskKey({ workspaceId: "ws-task-a", userId: "u1" });
    await memoryTapbenchKeyStore.markStopped(issued.record.id, new Date().toISOString());
    const stopped = await authenticateTapbenchPowKey(
      issued.rawKey,
      "workspaces:write",
      {} as never,
      memoryTapbenchKeyStore,
    );
    expect(stopped.ok).toBe(false);
    if (!stopped.ok) {
      expect(stopped.status).toBe(409);
      expect(stopped.code).toBe("session_stopped");
    }
  });

  it("reads tooling from PoW metadata", () => {
    const tooling = toolingFromPowMetadata({
      tooling: { agentic_harness: "react", model: "grok-4" },
    });
    expect(tooling.agentic_harness).toBe("react");
    expect(tooling.model).toBe("grok-4");
    const fallback = toolingFromPowMetadata({});
    expect(fallback.notes).toBe("PoW API");
  });
});
