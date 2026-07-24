import { describe, expect, it, vi } from "vitest";
import {
  applyBillableIleSessionFilters,
  applyBillableTapSessionFilters,
  applyExternalPowFilters,
  BILLABLE_TAP_STATUSES,
  ILE_BILLABLE_DEMO_INTEGRATION_OR,
  billingPeriodStart,
  countIleSessions,
  countPowApiSubmissions,
  countTapSessions,
  isBillableExternalPow,
  isBillableIleSession,
  isBillableTapSession,
} from "@/lib/usage-metrics";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("usage-metrics period helper", () => {
  it("derives billing period start as ~30 days before period end", () => {
    const start = billingPeriodStart("2026-04-01T00:00:00.000Z");
    expect(start?.toISOString().slice(0, 10)).toBe("2026-03-02");
  });

  it("returns null when period end is missing", () => {
    expect(billingPeriodStart(null)).toBeNull();
  });
});

describe("isBillableTapSession (pure production predicate)", () => {
  it("charges only in_progress and completed runs", () => {
    expect(isBillableTapSession({ status: "in_progress", started_at: "2026-01-01" })).toBe(true);
    expect(isBillableTapSession({ status: "completed", started_at: "2026-01-01" })).toBe(true);
  });

  it("does not charge pending unused guest links or revoked links", () => {
    expect(isBillableTapSession({ status: "pending", started_at: null })).toBe(false);
    expect(isBillableTapSession({ status: "revoked", started_at: null })).toBe(false);
    // Even if somehow started_at leaked onto pending/revoked, status wins
    expect(isBillableTapSession({ status: "pending", started_at: "2026-01-01" })).toBe(false);
    expect(isBillableTapSession({ status: "revoked", started_at: "2026-01-01" })).toBe(false);
  });

  it("BILLABLE_TAP_STATUSES matches the predicate for known statuses", () => {
    expect([...BILLABLE_TAP_STATUSES].sort()).toEqual(["completed", "in_progress"]);
    for (const status of BILLABLE_TAP_STATUSES) {
      expect(isBillableTapSession({ status })).toBe(true);
    }
  });
});

describe("isBillableIleSession (pure production predicate)", () => {
  it("charges ordinary product ILE sessions (absent demo_integration key remains billable)", () => {
    // SQL/PostgREST: metadata->>demo_integration IS NULL when key absent — must be billable
    expect(isBillableIleSession({ metadata: {} })).toBe(true);
    expect(isBillableIleSession({ metadata: { workspace_id: "w1", block_id: "b1" } })).toBe(true);
    expect(isBillableIleSession({ metadata: null })).toBe(true);
    expect(isBillableIleSession({ metadata: { demo_integration: null } })).toBe(true);
    expect(isBillableIleSession({ metadata: { demo_integration: false } })).toBe(true);
  });

  it("excludes AYCL product sessions (metadata.aycl_purchase_id)", () => {
    expect(
      isBillableIleSession({
        metadata: { aycl_purchase_id: "pur_123", aycl_fork_workspace_id: "w" },
      })
    ).toBe(false);
  });

  it("excludes only demo_integration truthy sessions (not null-key rows)", () => {
    expect(isBillableIleSession({ metadata: { demo_integration: true } })).toBe(false);
    expect(isBillableIleSession({ metadata: { demo_integration: "true" } })).toBe(false);
    // Absent key is billable — same semantics as ILE_BILLABLE_DEMO_INTEGRATION_OR
    expect(isBillableIleSession({ metadata: { workspace_id: "w" } })).toBe(true);
  });

  it("documents PostgREST OR shape so bare not.eq.true cannot ship as the demo filter", () => {
    // Intended filter: (demo_integration IS NULL OR demo_integration <> 'true')
    expect(ILE_BILLABLE_DEMO_INTEGRATION_OR).toBe(
      "metadata->>demo_integration.is.null,metadata->>demo_integration.neq.true"
    );
    // Pure predicate must match: null-key billable, true excluded
    expect(isBillableIleSession({ metadata: {} })).toBe(true);
    expect(isBillableIleSession({ metadata: { demo_integration: true } })).toBe(false);
  });
});

describe("isBillableExternalPow (pure production predicate)", () => {
  it("bills only API-direct PoW (created_by_api_key_id set)", () => {
    expect(isBillableExternalPow({ created_by_api_key_id: "key-1" })).toBe(true);
    expect(isBillableExternalPow({ created_by_api_key_id: null })).toBe(false);
    expect(isBillableExternalPow({ created_by_api_key_id: "" })).toBe(false);
    expect(isBillableExternalPow({})).toBe(false);
  });
});

describe("applyBillable*Filters (query builders used by counters)", () => {
  it("TAP filter restricts status to in_progress|completed", () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const q = {
      in(col: string, vals: readonly string[]) {
        calls.push({ method: "in", args: [col, vals] });
        return this;
      },
    };
    applyBillableTapSessionFilters(q);
    expect(calls).toEqual([{ method: "in", args: ["status", BILLABLE_TAP_STATUSES] }]);
    expect(calls[0].args[1]).not.toContain("pending");
    expect(calls[0].args[1]).not.toContain("revoked");
  });

  it("ILE filter excludes aycl_purchase_id and demo_integration=true without dropping null keys", () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const q = {
      is(col: string, val: null) {
        calls.push({ method: "is", args: [col, val] });
        return this;
      },
      or(filters: string) {
        calls.push({ method: "or", args: [filters] });
        return this;
      },
      not(col: string, op: string, val: string) {
        calls.push({ method: "not", args: [col, op, val] });
        return this;
      },
    };
    applyBillableIleSessionFilters(q);
    expect(calls).toContainEqual({
      method: "is",
      args: ["metadata->>aycl_purchase_id", null],
    });
    // Must use OR (is.null | neq.true) — bare not.eq.true fails SQL null semantics
    expect(calls).toContainEqual({
      method: "or",
      args: [ILE_BILLABLE_DEMO_INTEGRATION_OR],
    });
    expect(ILE_BILLABLE_DEMO_INTEGRATION_OR).toContain("is.null");
    expect(ILE_BILLABLE_DEMO_INTEGRATION_OR).toContain("neq.true");
    // Anti-pattern: not.eq.true alone must never be the demo filter
    const badNotEq = calls.find(
      (c) =>
        c.method === "not" &&
        c.args[0] === "metadata->>demo_integration" &&
        c.args[1] === "eq" &&
        c.args[2] === "true"
    );
    expect(badNotEq).toBeUndefined();
  });

  it("external PoW filter requires created_by_api_key_id IS NOT NULL", () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const q = {
      not(col: string, op: string, val: null) {
        calls.push({ method: "not", args: [col, op, val] });
        return this;
      },
    };
    applyExternalPowFilters(q);
    expect(calls).toEqual([
      { method: "not", args: ["created_by_api_key_id", "is", null] },
    ]);
  });
});

/**
 * Minimal chainable Supabase mock that records filter ops and returns a fixed count.
 * Drives the real countTapSessions / countIleSessions / countPowApiSubmissions entry points.
 * Every chain method returns the same thenable so await always hits the terminal result.
 */
function makeCountMock(opts: {
  table: string;
  count: number;
}) {
  const ops: Array<{ method: string; args: unknown[] }> = [];
  const methods = [
    "select",
    "eq",
    "in",
    "gte",
    "is",
    "not",
    "neq",
    "or",
  ] as const;

  const thenable: Record<string, unknown> = {
    then(
      resolve: (v: { count: number; error: null }) => void,
      _reject?: (e: unknown) => void
    ) {
      resolve({ count: opts.count, error: null });
      return undefined;
    },
  };
  for (const m of methods) {
    thenable[m] = (...args: unknown[]) => {
      ops.push({ method: m, args });
      return thenable;
    };
  }

  const from = vi.fn((table: string) => {
    expect(table).toBe(opts.table);
    return thenable;
  });

  return {
    client: { from } as unknown as SupabaseClient,
    ops,
    from,
  };
}

describe("countTapSessions drives production TAP filters", () => {
  it("queries workspace_tap_sessions with billable status filter (not pending/revoked)", async () => {
    const mock = makeCountMock({ table: "workspace_tap_sessions", count: 2 });
    const n = await countTapSessions(mock.client, "user-1", new Date("2026-06-01T00:00:00.000Z"));
    expect(n).toBe(2);
    expect(mock.from).toHaveBeenCalledWith("workspace_tap_sessions");
    expect(mock.ops).toContainEqual({
      method: "eq",
      args: ["user_id", "user-1"],
    });
    expect(mock.ops).toContainEqual({
      method: "in",
      args: ["status", BILLABLE_TAP_STATUSES],
    });
    // Must not filter only on user_id without status restriction
    const statusIn = mock.ops.find((o) => o.method === "in" && o.args[0] === "status");
    expect(statusIn).toBeTruthy();
    expect(statusIn!.args[1]).toEqual(BILLABLE_TAP_STATUSES);
    expect(statusIn!.args[1]).not.toEqual(expect.arrayContaining(["pending"]));
    expect(statusIn!.args[1]).not.toEqual(expect.arrayContaining(["revoked"]));
  });
});

describe("countIleSessions drives production ILE filters", () => {
  it("excludes AYCL and demo sessions via metadata filters that keep null-key rows", async () => {
    const mock = makeCountMock({ table: "sessions", count: 1 });
    const n = await countIleSessions(mock.client, "user-1", new Date("2026-06-01T00:00:00.000Z"));
    expect(n).toBe(1);
    expect(mock.from).toHaveBeenCalledWith("sessions");
    expect(mock.ops).toContainEqual({
      method: "is",
      args: ["metadata->>aycl_purchase_id", null],
    });
    expect(mock.ops).toContainEqual({
      method: "or",
      args: [ILE_BILLABLE_DEMO_INTEGRATION_OR],
    });
    // Regression: bare not.eq.true would underbill ordinary ILE (null key)
    expect(
      mock.ops.find(
        (o) =>
          o.method === "not" &&
          o.args[0] === "metadata->>demo_integration" &&
          o.args[1] === "eq"
      )
    ).toBeUndefined();
  });
});

describe("countPowApiSubmissions drives external PoW filter", () => {
  it("requires created_by_api_key_id IS NOT NULL (API-direct only)", async () => {
    const mock = makeCountMock({ table: "workspace_proof_of_work", count: 7 });
    const n = await countPowApiSubmissions(mock.client, "user-1", null);
    expect(n).toBe(7);
    expect(mock.from).toHaveBeenCalledWith("workspace_proof_of_work");
    expect(mock.ops).toContainEqual({
      method: "not",
      args: ["created_by_api_key_id", "is", null],
    });
  });
});

describe("predicate ↔ filter consistency for billing", () => {
  it("pending/revoked TAP rows are not billable and not in status filter", () => {
    for (const status of ["pending", "revoked"] as const) {
      expect(isBillableTapSession({ status })).toBe(false);
      expect((BILLABLE_TAP_STATUSES as readonly string[]).includes(status)).toBe(false);
    }
  });

  it("AYCL/demo ILE rows are not billable; null-key ordinary ILE is billable", () => {
    // Rows that would be excluded by applyBillableIleSessionFilters must fail isBillableIleSession
    expect(isBillableIleSession({ metadata: { aycl_purchase_id: "x" } })).toBe(false);
    expect(isBillableIleSession({ metadata: { demo_integration: true } })).toBe(false);
    // Ordinary product ILE (no demo_integration key) is billable under SQL null-safe OR filter
    expect(isBillableIleSession({ metadata: { workspace_id: "w" } })).toBe(true);
    expect(isBillableIleSession({ metadata: {} })).toBe(true);
    // Filter string must encode null-safe semantics (is.null in OR), not bare not.eq
    expect(ILE_BILLABLE_DEMO_INTEGRATION_OR.startsWith("metadata->>demo_integration.is.null")).toBe(
      true
    );
  });
});
