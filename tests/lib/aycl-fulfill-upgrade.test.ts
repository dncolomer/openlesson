import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  ayclPurchaseEligibleForUpgrade,
  fulfillAyclPurchase,
  type AyclPurchase,
} from "@/lib/aycl";
import { normalizeAyclAccessTier } from "@/lib/aycl-shared";

/**
 * Minimal chainable supabase mock for aycl_purchases upgrade fulfill path.
 * Tracks rows in memory so session-id re-lookup mirrors verify-session.
 */
function createAyclPurchaseStore(initial: AyclPurchase[]) {
  const rows = new Map(initial.map((r) => [r.id, { ...r }]));
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

  function from(table: string) {
    if (table !== "aycl_purchases") {
      throw new Error(`Unexpected table ${table}`);
    }
    let filter: { col: string; val: string } | null = null;
    let pendingPatch: Record<string, unknown> | null = null;

    const api = {
      select(_cols?: string) {
        return api;
      },
      eq(col: string, val: string) {
        filter = { col, val };
        return api;
      },
      maybeSingle: async () => {
        if (!filter) return { data: null, error: null };
        const found = [...rows.values()].find((r) => {
          if (filter!.col === "id") return r.id === filter!.val;
          if (filter!.col === "stripe_checkout_session_id")
            return r.stripe_checkout_session_id === filter!.val;
          return false;
        });
        return { data: found ? { ...found } : null, error: null };
      },
      update(patch: Record<string, unknown>) {
        pendingPatch = patch;
        return {
          eq: async (col: string, val: string) => {
            if (col !== "id") throw new Error("update only by id in mock");
            const row = rows.get(val);
            if (!row) return { data: null, error: { message: "not found" } };
            Object.assign(row, pendingPatch);
            updates.push({ id: val, patch: { ...pendingPatch } });
            return { data: { ...row }, error: null };
          },
        };
      },
    };
    return api;
  }

  return {
    client: { from } as unknown as SupabaseClient,
    rows,
    updates,
    getById: (id: string) => rows.get(id),
    getBySession: (sessionId: string) =>
      [...rows.values()].find((r) => r.stripe_checkout_session_id === sessionId),
  };
}

function stripeUpgradeSession(opts: {
  sessionId: string;
  purchaseId: string;
  email?: string;
}): Stripe.Checkout.Session {
  return {
    id: opts.sessionId,
    metadata: {
      aycl_upgrade: "1",
      upgrade_from_purchase_id: opts.purchaseId,
      price_type: "all_you_can_learn",
    },
    customer_details: opts.email
      ? ({ email: opts.email } as Stripe.Checkout.Session.CustomerDetails)
      : null,
    customer_email: opts.email ?? null,
  } as unknown as Stripe.Checkout.Session;
}

describe("fulfillAyclPurchase upgrade path (shipped)", () => {
  it("promotes learner→full on same purchase/fork and binds new Stripe session", async () => {
    const purchaseId = "purchase-learner-1";
    const forkId = "fork-ws-1";
    const originalSession = "cs_test_original_practice";
    const upgradeSession = "cs_test_upgrade_full";

    const store = createAyclPurchaseStore([
      {
        id: purchaseId,
        source_workspace_id: "catalog-ws",
        forked_workspace_id: forkId,
        access_token_hash: "hash-abc",
        stripe_checkout_session_id: originalSession,
        purchaser_email: "learner@example.com",
        status: "completed",
        access_tier: "learner",
        upgraded_from_purchase_id: null,
        created_at: "2026-01-01T00:00:00Z",
        completed_at: "2026-01-01T00:00:00Z",
      },
    ]);

    expect(
      ayclPurchaseEligibleForUpgrade(store.getById(purchaseId)!),
    ).toBe(true);

    const result = await fulfillAyclPurchase(
      store.client,
      stripeUpgradeSession({
        sessionId: upgradeSession,
        purchaseId,
        email: "learner@example.com",
      }),
    );

    expect(result).toEqual({ forkedWorkspaceId: forkId });

    const after = store.getById(purchaseId)!;
    // Same purchase identity + same fork — no second workspace.
    expect(after.id).toBe(purchaseId);
    expect(after.forked_workspace_id).toBe(forkId);
    expect(after.access_token_hash).toBe("hash-abc");
    expect(normalizeAyclAccessTier(after.access_tier)).toBe("full");
    // verify-session looks up by the NEW checkout session id.
    expect(after.stripe_checkout_session_id).toBe(upgradeSession);
    expect(store.getBySession(upgradeSession)?.id).toBe(purchaseId);
    expect(store.getBySession(originalSession)).toBeUndefined();

    expect(store.updates).toHaveLength(1);
    expect(store.updates[0].patch.access_tier).toBe("full");
    expect(store.updates[0].patch.stripe_checkout_session_id).toBe(
      upgradeSession,
    );
  });

  it("is idempotent when already full: rebinds session, keeps fork", async () => {
    const purchaseId = "purchase-full-1";
    const forkId = "fork-ws-2";
    const upgradeSession = "cs_test_upgrade_retry";

    const store = createAyclPurchaseStore([
      {
        id: purchaseId,
        source_workspace_id: "catalog-ws",
        forked_workspace_id: forkId,
        access_token_hash: "hash-xyz",
        stripe_checkout_session_id: "cs_prior",
        purchaser_email: "full@example.com",
        status: "completed",
        access_tier: "full",
        upgraded_from_purchase_id: null,
        created_at: "2026-01-01T00:00:00Z",
        completed_at: "2026-01-01T00:00:00Z",
      },
    ]);

    const result = await fulfillAyclPurchase(
      store.client,
      stripeUpgradeSession({ sessionId: upgradeSession, purchaseId }),
    );

    expect(result).toEqual({ forkedWorkspaceId: forkId });
    const after = store.getById(purchaseId)!;
    expect(after.access_tier).toBe("full");
    expect(after.forked_workspace_id).toBe(forkId);
    expect(after.stripe_checkout_session_id).toBe(upgradeSession);
    // verify-session can resolve ready after retry fulfill.
    expect(store.getBySession(upgradeSession)?.status).toBe("completed");
  });

  it("returns null when upgrade source purchase is missing", async () => {
    const store = createAyclPurchaseStore([]);
    const result = await fulfillAyclPurchase(
      store.client,
      stripeUpgradeSession({
        sessionId: "cs_missing",
        purchaseId: "no-such-purchase",
      }),
    );
    expect(result).toBeNull();
    expect(store.updates).toHaveLength(0);
  });
});

describe("upgrade success path wiring (structural)", () => {
  it("WorkspaceView stores access token before Stripe upgrade redirect", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(__dirname, "../..");
    const view = fs.readFileSync(
      path.join(root, "components/WorkspaceView.tsx"),
      "utf8",
    );
    expect(view).toContain("AYCL_TOKEN_STORAGE_KEY");
    expect(view).toContain("sessionStorage.setItem(AYCL_TOKEN_STORAGE_KEY");
    expect(view).toContain("startAyclUpgradeCheckout");

    const checkout = fs.readFileSync(
      path.join(root, "app/api/stripe/create-checkout/route.ts"),
      "utf8",
    );
    // Upgrade echoes existing token so clients can re-store it.
    expect(checkout).toContain("ayclUpgradePurchaseId &&");
    expect(checkout).toContain("ayclTokenEarly");

    const fulfill = fs.readFileSync(path.join(root, "lib/aycl.ts"), "utf8");
    expect(fulfill).toContain("stripe_checkout_session_id: sessionId");

    const verify = fs.readFileSync(
      path.join(root, "app/api/aycl/verify-session/route.ts"),
      "utf8",
    );
    expect(verify).toContain("getAyclPurchaseByCheckoutSession");
    expect(verify).toContain("fulfillAyclPurchase");
    expect(verify).toContain("accessTier");

    const success = fs.readFileSync(
      path.join(root, "app/all-you-can-learn/success/page.tsx"),
      "utf8",
    );
    expect(success).toContain("AYCL_TOKEN_STORAGE_KEY");
    expect(success).toContain("buildAyclAccessUrl");
    expect(success).toContain("data.upgraded");
  });
});
