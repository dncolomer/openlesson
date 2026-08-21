import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ayclForkAssignedUserId,
  ayclForkGuestEmail,
  ayclForkWorkspaceParams,
} from "@/lib/aycl-fork-guest";

const root = join(__dirname, "../..");
const CATALOG_OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GUEST = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("ayclForkAssignedUserId (shipped)", () => {
  it("assigns the generated guest, not the catalog owner", () => {
    const assigned = ayclForkAssignedUserId({
      catalogOwnerUserId: CATALOG_OWNER,
      guestUserId: GUEST,
    });
    expect(assigned).toBe(GUEST);
    expect(assigned).not.toBe(CATALOG_OWNER);
  });

  it("rejects missing guest, missing owner, or guest === owner", () => {
    expect(() =>
      ayclForkAssignedUserId({ catalogOwnerUserId: CATALOG_OWNER, guestUserId: "" }),
    ).toThrow(/generated guest/i);
    expect(() =>
      ayclForkAssignedUserId({ catalogOwnerUserId: "", guestUserId: GUEST }),
    ).toThrow(/catalog owner/i);
    expect(() =>
      ayclForkAssignedUserId({
        catalogOwnerUserId: CATALOG_OWNER,
        guestUserId: CATALOG_OWNER,
      }),
    ).toThrow(/must not be the catalog owner/i);
  });
});

describe("ayclForkWorkspaceParams (shared paid + complimentary path)", () => {
  it("passes guest as fork ownerUserId and keeps original_workspace linkage", () => {
    const params = ayclForkWorkspaceParams({
      sourceWorkspaceId: "ws-catalog",
      catalogOwnerUserId: CATALOG_OWNER,
      guestUserId: GUEST,
      title: "Bayes",
    });
    expect(params.ownerUserId).toBe(GUEST);
    expect(params.ownerUserId).not.toBe(CATALOG_OWNER);
    expect(params.sourceWorkspaceId).toBe("ws-catalog");
    expect(params.originalWorkspaceId).toBe("ws-catalog");
    expect(params.isAyclFork).toBe(true);
    expect(params.title).toBe("Bayes");
    expect(ayclForkGuestEmail("tok-1")).toBe(
      "aycl-fork+tok-1@aycl-guest.uncertain-systems",
    );
  });
});

describe("AYCL fork guest assignment surfaces", () => {
  it("paid fulfill and complimentary redeem both mint a guest then use ayclForkWorkspaceParams", () => {
    const aycl = readFileSync(join(root, "lib/aycl.ts"), "utf8");
    expect(aycl).toContain("createAyclForkGuestUser");
    expect(aycl).toContain("ayclForkWorkspaceParams");
    expect(aycl).not.toMatch(/ownerUserId:\s*sourceWorkspace\.user_id/);

    const redeemStart = aycl.indexOf("export async function redeemComplimentaryAyclLink");
    const redeemEnd = aycl.indexOf("export async function getAyclPurchaseByToken");
    const redeemFn = aycl.slice(redeemStart, redeemEnd);
    expect(redeemFn).toContain("createAyclForkGuestUser");
    expect(redeemFn).toContain("ayclForkWorkspaceParams");
    expect(redeemFn).toContain("catalogOwnerUserId: sourceWorkspace.user_id");
    expect(redeemFn).toContain("guestUserId: guest.id");

    const fulfillStart = aycl.indexOf("export async function fulfillAyclPurchase");
    const fulfillFn = aycl.slice(fulfillStart);
    expect(fulfillFn).toContain("createAyclForkGuestUser");
    expect(fulfillFn).toContain("ayclForkWorkspaceParams");
    expect(fulfillFn).toContain("catalogOwnerUserId: sourceWorkspace.user_id");
    expect(fulfillFn).toContain("guestUserId: guest.id");
  });

  it("fork insert uses ownerUserId as workspaces.user_id; dashboard lists by signed-in user_id", () => {
    const fork = readFileSync(join(root, "lib/fork-workspace.ts"), "utf8");
    expect(fork).toContain("user_id: params.ownerUserId");
    expect(fork).toContain("original_workspace_id: params.originalWorkspaceId");

    const dashFetch = readFileSync(join(root, "lib/storage/workspaces.ts"), "utf8");
    expect(dashFetch).toContain('.eq("user_id", user.id)');

    const learnAuth = readFileSync(join(root, "lib/aycl-session-auth.ts"), "utf8");
    expect(learnAuth).toContain("getAyclPurchaseByToken");
    expect(learnAuth).toContain("purchase.forked_workspace_id");
    expect(learnAuth).toContain("eq(\"id\", purchase.forked_workspace_id)");
  });

  it("guest mint creates a real auth user (FK-legal workspaces.user_id)", () => {
    const mint = readFileSync(join(root, "lib/aycl-fork-guest.ts"), "utf8");
    expect(mint).toContain("auth.admin.createUser");
    expect(mint).toContain("aycl_fork_guest");
    expect(mint).toContain("aycl-guest.uncertain-systems");
  });
});
