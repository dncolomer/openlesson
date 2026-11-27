import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VerificationFlowRunner } from "@/components/VerificationFlowRunner";
import {
  applyVerificationCommand,
  emptyVerificationState,
  parseProtocolLaunchIdentity,
  verificationFlowLaunchPath,
  verificationFlowLaunchUrl,
} from "@/lib/verification-flow";
import {
  listVerificationFlowsForDashboard,
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
    expect(repository).toContain("listVerificationFlowsForDashboard");
    expect(repository).toContain("nullableId(value.flow.ownerUserId)");
    expect(repository).toContain("organization_id");
  });

  it("lists dashboard flows by organization_id when stamped", async () => {
    resetVerificationFlowRepository();
    await runVerificationCommand({
      type: "create",
      ownerUserId: "owner-ada",
      organizationId: "org-a",
      topic: "Series",
      questions: ["What is a series?"],
      publicToken: "org-a-token",
    });
    await runVerificationCommand({
      type: "create",
      ownerUserId: "owner-ada",
      organizationId: "org-b",
      topic: "Limits",
      questions: ["What is a limit?"],
      publicToken: "org-b-token",
    });
    const orgA = await listVerificationFlowsForDashboard({
      ownerUserId: "owner-ada",
      organizationId: "org-a",
    });
    const orgB = await listVerificationFlowsForDashboard({
      ownerUserId: "owner-ada",
      organizationId: "org-b",
    });
    expect(orgA.map((flow) => flow.publicToken)).toEqual(["org-a-token"]);
    expect(orgB.map((flow) => flow.publicToken)).toEqual(["org-b-token"]);
  });
});

describe("protocol launch URL identity", () => {
  it("reads identity, id, or candidate_id and builds a launch URL", () => {
    expect(parseProtocolLaunchIdentity({ identity: " ada " })).toBe("ada");
    expect(parseProtocolLaunchIdentity({ id: "bob" })).toBe("bob");
    expect(parseProtocolLaunchIdentity({ candidate_id: "cara" })).toBe("cara");
    expect(parseProtocolLaunchIdentity(new URLSearchParams("identity=dana"))).toBe("dana");
    expect(parseProtocolLaunchIdentity({ identity: "   " })).toBe("");
    expect(verificationFlowLaunchPath("tok", "")).toBe("/v/tok");
    expect(verificationFlowLaunchPath("tok", "ada")).toBe("/v/tok?identity=ada");
    expect(verificationFlowLaunchUrl("https://uncertain.systems/", "tok", "ada")).toBe(
      "https://uncertain.systems/v/tok?identity=ada",
    );
  });

  it("skips Identify yourself when the public URL already has an identity", () => {
    const page = readFileSync(join(root, "app/v/[token]/page.tsx"), "utf8");
    const runner = readFileSync(join(root, "components/VerificationFlowRunner.tsx"), "utf8");
    expect(page).toContain("parseProtocolLaunchIdentity");
    expect(page).toContain("prepopulatedIdentity");
    expect(runner).toContain("data-verification-identity-prepopulated");
    expect(runner).toContain('prepopulatedIdentity ? "claiming" : "identity"');
    expect(runner.indexOf("data-verification-identity-prepopulated")).toBeLessThan(
      runner.indexOf("<ProductFlowIdentityForm"),
    );
    const withId = renderToStaticMarkup(
      createElement(VerificationFlowRunner, {
        token: "tok",
        prepopulatedIdentity: "ada",
      }),
    );
    expect(withId).toContain("data-verification-identity-prepopulated");
    expect(withId).toContain("Opening this protocol as ada");
    expect(withId).not.toContain("data-verification-identity-input");
    expect(withId).not.toContain("Identify yourself");
    const withoutId = renderToStaticMarkup(createElement(VerificationFlowRunner, { token: "tok" }));
    expect(withoutId).toContain("data-verification-identity-input");
    expect(withoutId).toContain("Identify yourself");
  });
});
