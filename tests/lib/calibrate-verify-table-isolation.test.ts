/**
 * Calibrate persist/open must not touch the Verify table, and Verify must not
 * touch Calibrate. Drives shipped helpers with a fake client.
 */
import { describe, expect, it } from "vitest";
import {
  CALIBRATE_SESSIONS_TABLE,
  VERIFY_SESSIONS_TABLE,
  findCalibrateSessionByToken,
  findVerifySessionByToken,
  insertGuestSession,
  storedCalibrateVerifyWrite,
} from "@/lib/guest-session-tables";

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
          data: rows[table] ?? { id: "row-1", ...rows[table] },
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
});
