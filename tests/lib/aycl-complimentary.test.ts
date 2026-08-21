import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ayclComplimentaryPurchaseRow,
  complimentaryAyclAccessTierFromInput,
  complimentaryAyclLinkEligible,
  complimentaryLinkPublicUrl,
  parseComplimentaryLinkCreateBody,
  resolveComplimentaryAyclCapabilities,
} from "@/lib/aycl-complimentary";

const root = join(__dirname, "../..");
const now = new Date("2026-08-21T12:00:00.000Z");

function link(partial: Partial<Parameters<typeof complimentaryAyclLinkEligible>[0]>) {
  return {
    status: "active",
    expires_at: null,
    max_uses: null,
    use_count: 0,
    ...partial,
  };
}

describe("complimentaryAyclLinkEligible (shipped)", () => {
  it("neither usage nor time limit: always grants while active", () => {
    expect(complimentaryAyclLinkEligible(link({}), now)).toEqual({ ok: true });
  });

  it("usage remaining vs exhausted", () => {
    expect(
      complimentaryAyclLinkEligible(link({ max_uses: 3, use_count: 0 }), now),
    ).toEqual({ ok: true });
    expect(
      complimentaryAyclLinkEligible(link({ max_uses: 3, use_count: 2 }), now),
    ).toEqual({ ok: true });
    expect(
      complimentaryAyclLinkEligible(link({ max_uses: 3, use_count: 3 }), now),
    ).toEqual({ ok: false, reason: "exhausted" });
    expect(
      complimentaryAyclLinkEligible(link({ max_uses: 1, use_count: 1 }), now),
    ).toEqual({ ok: false, reason: "exhausted" });
  });

  it("time unexpired vs expired", () => {
    expect(
      complimentaryAyclLinkEligible(
        link({ expires_at: "2026-08-21T12:00:01.000Z" }),
        now,
      ),
    ).toEqual({ ok: true });
    expect(
      complimentaryAyclLinkEligible(
        link({ expires_at: "2026-08-21T12:00:00.000Z" }),
        now,
      ),
    ).toEqual({ ok: false, reason: "expired" });
    expect(
      complimentaryAyclLinkEligible(
        link({ expires_at: "2026-08-20T00:00:00.000Z" }),
        now,
      ),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("usage-only: ignore missing expiration", () => {
    expect(
      complimentaryAyclLinkEligible(
        link({ max_uses: 2, use_count: 1, expires_at: null }),
        now,
      ),
    ).toEqual({ ok: true });
    expect(
      complimentaryAyclLinkEligible(
        link({ max_uses: 2, use_count: 2, expires_at: null }),
        now,
      ),
    ).toEqual({ ok: false, reason: "exhausted" });
  });

  it("time-only: ignore missing usage cap", () => {
    expect(
      complimentaryAyclLinkEligible(
        link({ max_uses: null, expires_at: "2026-12-01T00:00:00.000Z" }),
        now,
      ),
    ).toEqual({ ok: true });
    expect(
      complimentaryAyclLinkEligible(
        link({ max_uses: null, expires_at: "2026-01-01T00:00:00.000Z" }),
        now,
      ),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("both limits: fails if either is hit", () => {
    expect(
      complimentaryAyclLinkEligible(
        link({
          max_uses: 5,
          use_count: 1,
          expires_at: "2026-08-22T00:00:00.000Z",
        }),
        now,
      ),
    ).toEqual({ ok: true });
    expect(
      complimentaryAyclLinkEligible(
        link({
          max_uses: 5,
          use_count: 5,
          expires_at: "2026-08-22T00:00:00.000Z",
        }),
        now,
      ),
    ).toEqual({ ok: false, reason: "exhausted" });
    expect(
      complimentaryAyclLinkEligible(
        link({
          max_uses: 5,
          use_count: 1,
          expires_at: "2026-08-01T00:00:00.000Z",
        }),
        now,
      ),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("revoked never grants even with remaining uses and future expiry", () => {
    expect(
      complimentaryAyclLinkEligible(
        link({
          status: "revoked",
          max_uses: 10,
          use_count: 0,
          expires_at: "2027-01-01T00:00:00.000Z",
        }),
        now,
      ),
    ).toEqual({ ok: false, reason: "revoked" });
  });
});

describe("play vs full capability mapping (shipped)", () => {
  it("play / learner matches paid learner (practice-only)", () => {
    for (const input of ["play", "learner", "practice"] as const) {
      expect(complimentaryAyclAccessTierFromInput(input)).toBe("learner");
      const caps = resolveComplimentaryAyclCapabilities(input);
      expect(caps.tier).toBe("learner");
      expect(caps.canAuthor).toBe(false);
      expect(caps.canGrow).toBe(false);
      expect(caps.allowCreatorModeToggle).toBe(false);
      expect(caps.defaultInteractionMode).toBe("learner");
      expect(caps.allowExplore).toBe(true);
      expect(caps.canUpgrade).toBe(true);
    }
  });

  it("full matches paid full (Play + Build)", () => {
    for (const input of ["full", "build", "creator"] as const) {
      expect(complimentaryAyclAccessTierFromInput(input)).toBe("full");
      const caps = resolveComplimentaryAyclCapabilities(input);
      expect(caps.tier).toBe("full");
      expect(caps.canAuthor).toBe(true);
      expect(caps.canGrow).toBe(true);
      expect(caps.allowCreatorModeToggle).toBe(true);
      expect(caps.canUpgrade).toBe(false);
    }
  });
});

describe("parseComplimentaryLinkCreateBody", () => {
  it("accepts play or full with neither / usage-only / time-only / both", () => {
    expect(parseComplimentaryLinkCreateBody({ access_tier: "play" }, now)).toEqual({
      fields: { access_tier: "learner", max_uses: null, expires_at: null },
    });
    expect(
      parseComplimentaryLinkCreateBody({ access_tier: "full", max_uses: 5 }, now),
    ).toEqual({
      fields: { access_tier: "full", max_uses: 5, expires_at: null },
    });
    expect(
      parseComplimentaryLinkCreateBody(
        { access_tier: "learner", expires_at: "2026-09-01T00:00:00.000Z" },
        now,
      ),
    ).toEqual({
      fields: {
        access_tier: "learner",
        max_uses: null,
        expires_at: "2026-09-01T00:00:00.000Z",
      },
    });
    expect(
      parseComplimentaryLinkCreateBody(
        {
          access_tier: "full",
          max_uses: "2",
          expires_at: "2026-09-01T00:00:00.000Z",
        },
        now,
      ),
    ).toEqual({
      fields: {
        access_tier: "full",
        max_uses: 2,
        expires_at: "2026-09-01T00:00:00.000Z",
      },
    });
  });

  it("rejects invalid usage, past expiration, and unknown tier", () => {
    expect(parseComplimentaryLinkCreateBody({ access_tier: "vip" }, now)).toEqual({
      error: "access_tier must be play (learner) or full",
    });
    expect(
      parseComplimentaryLinkCreateBody({ access_tier: "play", max_uses: 0 }, now),
    ).toEqual({
      error: "max_uses must be a positive integer, or empty for unlimited",
    });
    expect(
      parseComplimentaryLinkCreateBody(
        { access_tier: "play", expires_at: "2026-01-01T00:00:00.000Z" },
        now,
      ),
    ).toEqual({ error: "expires_at must be in the future" });
  });
});

describe("complimentary grant row has no checkout session", () => {
  it("ayclComplimentaryPurchaseRow never sets stripe checkout", () => {
    const row = ayclComplimentaryPurchaseRow({
      sourceWorkspaceId: "src",
      forkedWorkspaceId: "fork",
      accessTokenHash: "hash",
      accessTier: "learner",
      complimentaryLinkId: "link-1",
      now,
    });
    expect(row.stripe_checkout_session_id).toBeNull();
    expect(row.status).toBe("completed");
    expect(row.access_tier).toBe("learner");
    expect(row.complimentary_link_id).toBe("link-1");
    expect(row.purchaser_email).toBeNull();
    expect(row.completed_at).toBe(now.toISOString());
  });

  it("builds /learn/{token} URLs", () => {
    expect(complimentaryLinkPublicUrl("https://uncertain.systems/", "tok")).toBe(
      "https://uncertain.systems/learn/tok",
    );
  });
});

describe("complimentary AYCL surfaces (structural)", () => {
  it("migration persists hashed tokens, usage, expiration, play vs full", () => {
    const sql = readFileSync(
      join(root, "supabase/migrations/20260821120000_aycl_complimentary_links.sql"),
      "utf8",
    );
    expect(sql).toContain("aycl_complimentary_links");
    expect(sql).toContain("access_token_hash");
    expect(sql).toContain("max_uses");
    expect(sql).toContain("use_count");
    expect(sql).toContain("expires_at");
    expect(sql).toContain("'learner'");
    expect(sql).toContain("'full'");
    expect(sql).toContain("complimentary_link_id");
  });

  it("Settings > AYCL exposes play and full create controls plus usage and expiration", () => {
    const settings = readFileSync(
      join(root, "components/WorkspaceAyclMarketplaceSettings.tsx"),
      "utf8",
    );
    expect(settings).toContain("data-aycl-complimentary-links");
    expect(settings).toContain("data-aycl-complimentary-create-play");
    expect(settings).toContain("data-aycl-complimentary-create-full");
    expect(settings).toContain("data-aycl-complimentary-play-max-uses");
    expect(settings).toContain("data-aycl-complimentary-play-expires-at");
    expect(settings).toContain("data-aycl-complimentary-full-max-uses");
    expect(settings).toContain("data-aycl-complimentary-full-expires-at");
    expect(settings).toContain("/api/workspaces/");
    expect(settings).toContain("/aycl/complimentary");
  });

  it("learn path redeems complimentary URL without checkout", () => {
    const page = readFileSync(join(root, "app/learn/[token]/page.tsx"), "utf8");
    expect(page).toContain("redeemComplimentaryAyclLink");
    expect(page).toContain("redirect(`/learn/${redeemed.accessToken}`)");
    expect(page).not.toContain("stripe");
    expect(page).not.toContain("create-checkout");

    const aycl = readFileSync(join(root, "lib/aycl.ts"), "utf8");
    const redeemStart = aycl.indexOf("export async function redeemComplimentaryAyclLink");
    const redeemEnd = aycl.indexOf("export async function getAyclPurchaseByToken");
    expect(redeemStart).toBeGreaterThan(-1);
    expect(redeemEnd).toBeGreaterThan(redeemStart);
    const redeemFn = aycl.slice(redeemStart, redeemEnd);
    expect(redeemFn).toContain("ayclComplimentaryPurchaseRow");
    expect(redeemFn).toContain("complimentaryAyclLinkEligible");
    expect(redeemFn).not.toContain("Checkout.Session");
    expect(redeemFn).not.toContain("stripe_checkout_session_id: sessionId");

    const route = readFileSync(
      join(root, "app/api/workspaces/[id]/aycl/complimentary/route.ts"),
      "utf8",
    );
    expect(route).toContain("parseComplimentaryLinkCreateBody");
    expect(route).toContain("hashPrivateToken");
    expect(route).toContain("createPrivateToken");
  });
});
