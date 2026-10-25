import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyVerificationCommand,
  emptyVerificationState,
} from "@/lib/verification-flow";
import {
  listVerificationFlowsForOwnerUserId,
  resetVerificationFlowRepository,
  runVerificationCommand,
} from "@/lib/verification-flow-repository";

const root = join(__dirname, "../..");

describe("verification flow owner_user_id", () => {
  it("creates a flow owned by the user without a workspace", () => {
    const created = applyVerificationCommand(emptyVerificationState(), {
      type: "create",
      ownerUserId: "user-1",
      topic: "Limits",
      questions: ["What is a limit?"],
      publicToken: "owner-token",
    });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.flow) return;
    expect(created.flow.ownerUserId).toBe("user-1");
    expect(created.flow.workspaceId).toBe("");
    expect(created.flow.publicToken).toBe("owner-token");

    const hijack = applyVerificationCommand(created.state, {
      type: "update",
      ownerUserId: "user-2",
      flowId: created.flow.id,
      topic: "Hijacked",
    });
    expect(hijack.ok).toBe(false);
    if (hijack.ok) return;
    expect(hijack.reason).toBe("wrong_workspace");

    const updated = applyVerificationCommand(created.state, {
      type: "update",
      ownerUserId: "user-1",
      flowId: created.flow.id,
      topic: "Limits revised",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.flow?.topic).toBe("Limits revised");
  });

  it("lists memory flows by owner_user_id and persists that column", async () => {
    resetVerificationFlowRepository();
    const created = await runVerificationCommand({
      type: "create",
      ownerUserId: "owner-ada",
      topic: "Series",
      questions: ["What is a series?"],
      publicToken: "owner-list-token",
    });
    expect(created.ok).toBe(true);
    const listed = await listVerificationFlowsForOwnerUserId("owner-ada");
    expect(listed.some((flow) => flow.publicToken === "owner-list-token")).toBe(true);
    expect(await listVerificationFlowsForOwnerUserId("someone-else")).toEqual([]);

    const repository = readFileSync(join(root, "lib/verification-flow-repository.ts"), "utf8");
    expect(repository).toContain("owner_user_id");
    expect(repository).toContain("listVerificationFlowsForOwnerUserId");
    expect(repository).toContain("nullableId(value.flow.ownerUserId)");
  });
});
