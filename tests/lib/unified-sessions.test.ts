import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  guestLinkFromRow,
  hydrateUnifiedGuestRow,
  kindFromGuestLogicalTable,
  unifiedSessionInsertPayload,
} from "@/lib/unified-sessions";
import { insertGuestSession, storedCalibrateVerifyWrite } from "@/lib/guest-session-tables";
import { proofOfWorkTypeForSensor, sensorPowInsertPayload } from "@/lib/session-sensor-pow";

const ROOT = join(__dirname, "../..");

describe("unified sessions", () => {
  it("maps logical TAP tables onto session kinds", () => {
    expect(kindFromGuestLogicalTable("workspace_calibrate_sessions")).toBe("calibrate");
    expect(kindFromGuestLogicalTable("workspace_verify_sessions")).toBe("verify");
    expect(kindFromGuestLogicalTable("workspace_learn_links")).toBe("learn");
  });

  it("hydrates guest_link fields onto the session row", () => {
    const row = hydrateUnifiedGuestRow({
      id: "s1",
      kind: "calibrate",
      guest_link: { requested_duration_seconds: 900, show_end_session: true },
    });
    expect(row?.requested_duration_seconds).toBe(900);
    expect(row?.interaction_kind).toBe("calibrate");
  });

  it("inserts Calibrate guest sessions onto the unified table", async () => {
    const calls: Array<{ table: string; row: Record<string, unknown> }> = [];
    const client = {
      from(table: string) {
        return {
          insert(row: Record<string, unknown>) {
            calls.push({ table, row });
            return {
              select() {
                return this;
              },
              async single() {
                return { data: { id: "new", ...row }, error: null };
              },
            };
          },
        };
      },
    };
    const write = storedCalibrateVerifyWrite("scout");
    const { data, error } = await insertGuestSession(client, write.table, {
      user_id: "u1",
      workspace_id: "w1",
      private_token_hash: "h",
      public_token: "p",
      status: "pending",
    });
    expect(error).toBeNull();
    expect(calls[0]?.table).toBe("sessions");
    expect(calls[0]?.row.kind).toBe("calibrate");
    expect(data?.kind).toBe("calibrate");
  });

  it("keeps extra TAP fields in guest_link", () => {
    const payload = unifiedSessionInsertPayload({
      kind: "verify",
      user_id: "u1",
      guest_link: guestLinkFromRow({
        user_id: "u1",
        requested_duration_seconds: 60,
        session_shell: "solo",
      }),
    });
    expect((payload.guest_link as { requested_duration_seconds: number }).requested_duration_seconds).toBe(60);
  });
});

describe("session sensor → proof of work", () => {
  it("maps leftover sensor kinds onto PoW types", () => {
    expect(proofOfWorkTypeForSensor("screen")).toBe("screen");
    expect(proofOfWorkTypeForSensor("eeg")).toBe("eeg");
    expect(proofOfWorkTypeForSensor("audio")).toBe("video");
    expect(proofOfWorkTypeForSensor("transcript")).toBe("tool");
    const row = sensorPowInsertPayload({
      sessionId: "s1",
      userId: "u1",
      workspaceId: "w1",
      kind: "transcript",
      xaiFileId: "file-1",
      mimeType: "text/plain",
    });
    expect(row.proof_of_work_type).toBe("tool");
    expect(row.tool_name).toBe("transcript");
    expect(row.session_id).toBe("s1");
  });
});

describe("core data-model remaining migrations", () => {
  it("ships drop migrations for leftover products and satellite tables", () => {
    const files = [
      "supabase/migrations/20261025210000_drop_rabbit_hole_leads_notify.sql",
      "supabase/migrations/20261025215000_unified_session_columns.sql",
      "supabase/migrations/20261025220000_drop_session_sensor_tables.sql",
      "supabase/migrations/20261025230000_drop_context_goals_session_plans.sql",
      "supabase/migrations/20261025240000_drop_legacy_session_tables.sql",
      "supabase/migrations/20261025250000_knowledge_regions.sql",
      "supabase/migrations/20261025260000_core_data_model_complete.sql",
    ];
    for (const file of files) {
      expect(existsSync(join(ROOT, file))).toBe(true);
    }
    const rabbit = readFileSync(join(ROOT, files[0]), "utf8");
    expect(rabbit).toContain("drop table if exists public.rabbit_hole_plays");
    expect(rabbit).toContain("drop table if exists public.leads");
    const sensors = readFileSync(join(ROOT, files[2]), "utf8");
    expect(sensors).toContain("drop table if exists public.session_transcript");
    expect(sensors).toContain("drop table if exists public.probes");
    const legacy = readFileSync(join(ROOT, files[4]), "utf8");
    expect(legacy).toContain("drop table if exists public.workspace_calibrate_sessions");
    expect(legacy).toContain("drop table if exists public.workspace_learn_links");
    expect(legacy).toContain("sessions_status_check");
    expect(legacy).toContain("revoked");
  });

  it("removes the Rabbit Hole product while keeping Expand", () => {
    expect(existsSync(join(ROOT, "app/rabbit-hole/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/rabbit-hole.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/rabbit-hole-expand.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/workspace/rabbit-hole-expand/route.ts"))).toBe(true);
  });
});
