/**
 * Calibrate persist/open must not touch the Verify table, and Verify must not
 * touch Calibrate. Drives shipped helpers with a fake client.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CALIBRATE_SESSIONS_TABLE,
  VERIFY_SESSIONS_TABLE,
  findCalibrateSessionByToken,
  findVerifySessionByToken,
  insertGuestSession,
  storedCalibrateVerifyWrite,
} from "@/lib/guest-session-tables";
import { tapSessionInsertRetryKind } from "@/lib/pow-api/tap-link-config";
import { tapStartInteractionKind } from "@/lib/exercise-tap";

function fakeClient() {
  const calls: { table: string; op: "select" | "insert" }[] = [];
  const rows: Record<string, Record<string, unknown>> = {};
  return {
    calls,
    from(table: string) {
      const chain = {
        select() {
          calls.push({ table, op: "select" });
          return chain;
        },
        insert(row: Record<string, unknown>) {
          calls.push({ table, op: "insert" });
          rows[table] = row;
          return chain;
        },
        eq() {
          return chain;
        },
        maybeSingle: async () => ({
          data: rows[table] ?? null,
          error: null,
        }),
        single: async () => ({
          data: rows[table] ?? { id: "row-1" },
          error: null,
        }),
      };
      return chain;
    },
  };
}

describe("Calibrate vs Verify table isolation", () => {
  it("inserting and opening Calibrate never reads or writes Verify", async () => {
    const client = fakeClient();
    const write = storedCalibrateVerifyWrite("scout");
    expect(write.table).toBe(CALIBRATE_SESSIONS_TABLE);
    expect(write.interaction_kind).toBe("calibrate");

    await insertGuestSession(client, write.table, {
      interaction_kind: write.interaction_kind,
      private_token_hash: "cal-hash",
    });
    const found = await findCalibrateSessionByToken(client, "cal-hash");
    expect(found).toBeTruthy();
    expect(client.calls.every((c) => c.table === CALIBRATE_SESSIONS_TABLE)).toBe(true);
    expect(client.calls.some((c) => c.table === VERIFY_SESSIONS_TABLE)).toBe(false);
  });

  it("inserting and opening Verify never reads or writes Calibrate", async () => {
    const client = fakeClient();
    const write = storedCalibrateVerifyWrite("conversational");
    expect(write.table).toBe(VERIFY_SESSIONS_TABLE);
    expect(write.interaction_kind).toBe("verify");
    expect(write.session_shell).toBe("dialog");

    await insertGuestSession(client, write.table, {
      interaction_kind: write.interaction_kind,
      session_shell: write.session_shell,
      private_token_hash: "ver-hash",
    });
    const found = await findVerifySessionByToken(client, "ver-hash");
    expect(found).toBeTruthy();
    expect(client.calls.every((c) => c.table === VERIFY_SESSIONS_TABLE)).toBe(true);
    expect(client.calls.some((c) => c.table === CALIBRATE_SESSIONS_TABLE)).toBe(false);
  });

  it("exercise Verify writes session_shell solo on the Verify table", () => {
    const write = storedCalibrateVerifyWrite("exercise");
    expect(write.table).toBe(VERIFY_SESSIONS_TABLE);
    expect(write.interaction_kind).toBe("verify");
    expect(write.session_shell).toBe("solo");
  });

  it("scout insert retry does not remap onto the Verify table", () => {
    const requested = "scout" as const;
    const retry = tapSessionInsertRetryKind(requested, "violates check constraint");
    expect(retry).toBeNull();
    const write = storedCalibrateVerifyWrite(requested);
    expect(write.table).toBe(CALIBRATE_SESSIONS_TABLE);
    expect(write.interaction_kind).toBe("calibrate");
  });

  it("reopening a stored Verify solo row stays on the exercise start path", () => {
    expect(
      tapStartInteractionKind({
        existingSession: {
          id: "row-solo",
          interaction_kind: "verify",
          session_shell: "solo",
        },
        bodyKind: "conversational",
      }),
    ).toBe("exercise");
  });

  it("cutover SQL sets matching kind defaults, Calibrate PK, and PoW calibrate vs verify", () => {
    const sql = readFileSync(
      join(__dirname, "../../supabase/migrations/20261021120000_product_language_cutover.sql"),
      "utf8",
    );
    expect(sql).toContain("ALTER COLUMN interaction_kind SET DEFAULT 'verify'");
    expect(sql).toContain("ALTER COLUMN interaction_kind SET DEFAULT 'calibrate'");
    expect(sql).toContain("ADD CONSTRAINT workspace_calibrate_sessions_pkey PRIMARY KEY (id)");
    expect(sql).toContain("workspace_calibrate_sessions c");
    expect(sql).toMatch(/THEN 'calibrate'/);
  });
});
