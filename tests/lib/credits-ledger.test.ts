/**
 * Shipped credit ledger: starter grant, session debit, insufficient refuse,
 * guest vs signed-in billed account, unmetered map / knowledge-region create.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CREDIT_PACKS,
  FLOW_SESSION_CREDIT_COST,
  FLOW_SESSION_KINDS,
  STARTER_CREDIT_GRANT,
  applyStarterGrantIfNeeded,
  billedUserIdForSession,
  creditCostForAction,
  createMemoryCreditStore,
  debitFlowSessionCredits,
  grantCreditPack,
  isBillableAction,
  loadCreditSummary,
  startBillableFlowSession,
  unmeteredCreateLeavesBalance,
} from "@/lib/credits";
import { billedUserIdForIleLinkSession } from "@/lib/learn-link-auth";

describe("credit constants", () => {
  it("ships a positive starter grant and a positive per-session cost", () => {
    expect(STARTER_CREDIT_GRANT).toBeGreaterThan(0);
    expect(FLOW_SESSION_CREDIT_COST).toBeGreaterThan(0);
    expect(STARTER_CREDIT_GRANT).toBeGreaterThanOrEqual(FLOW_SESSION_CREDIT_COST);
    expect(CREDIT_PACKS.every((pack) => pack.credits > 0 && pack.priceCents > 0)).toBe(true);
  });
});

describe("starter grant on free signup", () => {
  it("applies STARTER_CREDIT_GRANT once", async () => {
    const store = createMemoryCreditStore();
    const first = await applyStarterGrantIfNeeded(store, "user-new");
    expect(first.applied).toBe(true);
    expect(first.balanceAfter).toBe(STARTER_CREDIT_GRANT);
    const second = await applyStarterGrantIfNeeded(store, "user-new");
    expect(second.applied).toBe(false);
    expect(second.balanceAfter).toBe(STARTER_CREDIT_GRANT);
    const summary = await loadCreditSummary(store, "user-new");
    expect(summary.balance).toBe(STARTER_CREDIT_GRANT);
    expect(summary.grants.some((entry) => entry.reason === "signup_starter")).toBe(true);
  });
});

describe("flow session debit", () => {
  it.each(FLOW_SESSION_KINDS)(
    "%s start deducts FLOW_SESSION_CREDIT_COST and persists a lower balance",
    async (flowKind) => {
      const store = createMemoryCreditStore({ runner: STARTER_CREDIT_GRANT });
      let created = false;
      const result = await startBillableFlowSession(
        store,
        { runnerUserId: "runner", ownerUserId: "runner", flowKind },
        async () => {
          created = true;
          return { sessionId: `${flowKind}-1` };
        },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(created).toBe(true);
      expect(result.value).toEqual({ sessionId: `${flowKind}-1` });
      expect(result.balanceAfter).toBe(STARTER_CREDIT_GRANT - FLOW_SESSION_CREDIT_COST);
      const summary = await loadCreditSummary(store, "runner");
      expect(summary.balance).toBe(STARTER_CREDIT_GRANT - FLOW_SESSION_CREDIT_COST);
      expect(summary.debits).toHaveLength(1);
      expect(summary.debits[0]?.flowKind).toBe(flowKind);
      expect(Math.abs(summary.debits[0]?.amount ?? 0)).toBe(FLOW_SESSION_CREDIT_COST);
    },
  );

  it("rejects an insufficient start and does not create a billable session", async () => {
    const store = createMemoryCreditStore({ broke: FLOW_SESSION_CREDIT_COST - 1 });
    let created = false;
    const result = await startBillableFlowSession(
      store,
      { runnerUserId: "broke", ownerUserId: "broke", flowKind: "learn" },
      async () => {
        created = true;
        return { sessionId: "should-not-exist" };
      },
    );
    expect(result.ok).toBe(false);
    expect(created).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("insufficient_credits");
    expect(result.balance).toBe(FLOW_SESSION_CREDIT_COST - 1);
    expect(result.amount).toBe(FLOW_SESSION_CREDIT_COST);
    const summary = await loadCreditSummary(store, "broke");
    expect(summary.balance).toBe(FLOW_SESSION_CREDIT_COST - 1);
    expect(summary.debits).toHaveLength(0);
  });
});

describe("guest vs signed-in billed account", () => {
  it("bills the owner when the runner is anonymous", async () => {
    expect(
      billedUserIdForSession({ runnerUserId: null, ownerUserId: "owner-1" }),
    ).toBe("owner-1");
    const store = createMemoryCreditStore({
      "owner-1": STARTER_CREDIT_GRANT,
      "runner-1": STARTER_CREDIT_GRANT,
    });
    const result = await debitFlowSessionCredits(store, {
      runnerUserId: null,
      ownerUserId: "owner-1",
      flowKind: "calibrate",
    });
    expect(result.ok).toBe(true);
    expect(result.billedUserId).toBe("owner-1");
    expect((await store.load("owner-1")).balance).toBe(
      STARTER_CREDIT_GRANT - FLOW_SESSION_CREDIT_COST,
    );
    expect((await store.load("runner-1")).balance).toBe(STARTER_CREDIT_GRANT);
  });

  it("bills the owner for an anonymous Learn-link start and the runner when signed in", () => {
    expect(
      billedUserIdForIleLinkSession({
        assignedUserId: null,
        cookieRunnerUserId: null,
        ownerUserId: "owner-1",
      }),
    ).toBe("owner-1");
    expect(
      billedUserIdForIleLinkSession({
        assignedUserId: null,
        cookieRunnerUserId: "runner-1",
        ownerUserId: "owner-1",
      }),
    ).toBe("runner-1");
    expect(
      billedUserIdForIleLinkSession({
        assignedUserId: "assigned-1",
        cookieRunnerUserId: "runner-1",
        ownerUserId: "owner-1",
      }),
    ).toBe("assigned-1");
  });

  it("bills the signed-in runner when they have an account", async () => {
    expect(
      billedUserIdForSession({ runnerUserId: "runner-1", ownerUserId: "owner-1" }),
    ).toBe("runner-1");
    const store = createMemoryCreditStore({
      "owner-1": STARTER_CREDIT_GRANT,
      "runner-1": STARTER_CREDIT_GRANT,
    });
    const result = await startBillableFlowSession(
      store,
      { runnerUserId: "runner-1", ownerUserId: "owner-1", flowKind: "solve" },
      async () => ({ sessionId: "shared-solve" }),
    );
    expect(result.ok).toBe(true);
    expect((await store.load("runner-1")).balance).toBe(
      STARTER_CREDIT_GRANT - FLOW_SESSION_CREDIT_COST,
    );
    expect((await store.load("owner-1")).balance).toBe(STARTER_CREDIT_GRANT);
  });
});

describe("session-start routes debit shipped credits", () => {
  it("wires Learn, Calibrate, Verify, and Solve starts onto the debit helper", () => {
    const root = join(__dirname, "../..");
    const files = [
      "app/api/play/start/route.ts",
      "app/api/play/curious/route.ts",
      "app/api/workspace/learner-launch/route.ts",
      "app/api/dashboard/maps/try/route.ts",
      "app/api/aycl/start-session/route.ts",
      "lib/learn-link-auth.ts",
      "lib/calibration-flow-repository.ts",
      "lib/verification-flow-repository.ts",
      "lib/solve-flow-repository.ts",
    ];
    for (const rel of files) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src).toMatch(/rejectIfInsufficientSessionCredits|debitClaimedFlowSession/);
    }
    expect(readFileSync(join(root, "app/results/page.tsx"), "utf8")).toContain("/api/play/start");
    const learnLink = readFileSync(join(root, "lib/learn-link-auth.ts"), "utf8");
    expect(learnLink).toContain("debitClaimedFlowSession");
    expect(learnLink).toContain("refundClaimedFlowSession");
    expect(learnLink).toContain("billedUserIdForIleLinkSession");
    const launch = readFileSync(join(root, "app/api/workspace/learner-launch/route.ts"), "utf8");
    const debitAt = launch.indexOf("rejectIfInsufficientSessionCredits(createAdminClient()");
    expect(debitAt).toBeGreaterThan(launch.indexOf("Block not found"));
    expect(debitAt).toBeGreaterThan(launch.indexOf("Failed to save prompt"));
    expect(launch).toContain("refundFlowSessionCredits");
  });
});

describe("unmetered creates", () => {
  it("does not debit map or knowledge-region create routes", () => {
    const root = join(__dirname, "../..");
    const generate = readFileSync(join(root, "app/api/workspace/generate/route.ts"), "utf8");
    const regions = readFileSync(join(root, "app/api/dashboard/knowledge-regions/route.ts"), "utf8");
    expect(generate).not.toContain("rejectIfInsufficientSessionCredits");
    expect(regions).not.toContain("rejectIfInsufficientSessionCredits");
    expect(generate).not.toContain("debitFlowSessionCredits");
    expect(regions).not.toContain("debitFlowSessionCredits");
  });

  it("leaves the balance unchanged for Learning Map and Knowledge Region create", async () => {
    const store = createMemoryCreditStore({ author: STARTER_CREDIT_GRANT });
    await applyStarterGrantIfNeeded(store, "author");
    const before = (await store.load("author")).balance;
    expect(isBillableAction("map_create")).toBe(false);
    expect(isBillableAction("knowledge_region_create")).toBe(false);
    expect(creditCostForAction("map_create")).toBe(0);
    expect(creditCostForAction("knowledge_region_create")).toBe(0);
    expect(unmeteredCreateLeavesBalance("map_create", before).balanceAfter).toBe(before);
    expect(unmeteredCreateLeavesBalance("knowledge_region_create", before).balanceAfter).toBe(
      before,
    );
    expect((await store.load("author")).balance).toBe(before);
  });
});

describe("credit packs", () => {
  it("grants pack credits from the shipped catalog", async () => {
    const store = createMemoryCreditStore({ buyer: STARTER_CREDIT_GRANT });
    const pack = CREDIT_PACKS[0];
    const granted = await grantCreditPack(store, "buyer", pack.id, "cs_test_1");
    expect(granted.applied).toBe(true);
    expect(granted.balanceAfter).toBe(STARTER_CREDIT_GRANT + pack.credits);
    const again = await grantCreditPack(store, "buyer", pack.id, "cs_test_1");
    expect(again.applied).toBe(false);
    expect((await store.load("buyer")).balance).toBe(STARTER_CREDIT_GRANT + pack.credits);
  });
});
