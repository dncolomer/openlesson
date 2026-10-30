import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applySolveCommand,
  emptySolveState,
  solveFlowPublicPath,
  solveRunParent,
} from "@/lib/solve-flow";
import { acceptParticipantIdentity } from "@/lib/verification-flow";
import {
  isMapLearnSession,
  isSolveSession,
  parseSessionResult,
} from "@/lib/core-data-model";

const ROOT = join(__dirname, "../..");

describe("Solve flow identity claim", () => {
  it("rejects empty and duplicate identities and accepts a unique claim", () => {
    const created = applySolveCommand(emptySolveState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: "Limits",
      topic: "epsilon-delta",
      id: "sf1",
      publicToken: "stok",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.flow?.name).toBe("Limits");
    expect(created.flow?.topic).toBe("epsilon-delta");
    expect(solveFlowPublicPath(created.flow!.publicToken)).toBe("/s/stok");

    const empty = applySolveCommand(created.state, {
      type: "claim",
      flowId: "sf1",
      identity: "  ",
    });
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.reason).toBe("empty");
    expect(acceptParticipantIdentity("  ", [])).toEqual({ ok: false, reason: "empty" });

    const first = applySolveCommand(created.state, {
      type: "claim",
      flowId: "sf1",
      identity: "  ada ",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.identity).toBe("ada");

    const duplicate = applySolveCommand(first.state, {
      type: "claim",
      flowId: "sf1",
      identity: "ada",
    });
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.reason).toBe("duplicate");
    expect(acceptParticipantIdentity("ada", ["ada"])).toEqual({
      ok: false,
      reason: "duplicate",
    });

    const unique = applySolveCommand(first.state, {
      type: "claim",
      flowId: "sf1",
      identity: "bob",
    });
    expect(unique.ok).toBe(true);
    if (!unique.ok) return;
    expect(unique.identity).toBe("bob");
  });
});

describe("Solve run vs map Learn session", () => {
  it("parents a Solve run on solve_flow_id and leaves map Learn unparented", () => {
    const solveRow = { kind: "solve", solve_flow_id: "sf1" };
    const learnRow = { kind: "learn" };
    const verifyRow = { kind: "verify", verify_flow_id: "vf1" };
    expect(isSolveSession(solveRow)).toBe(true);
    expect(isMapLearnSession(learnRow)).toBe(true);
    expect(isMapLearnSession(solveRow)).toBe(false);
    expect(solveRunParent(solveRow)).toEqual({ kind: "solve", solveFlowId: "sf1" });
    expect(solveRunParent(learnRow)).toEqual({ kind: "learn", solveFlowId: null });
    expect(solveRunParent(verifyRow)).toEqual({ kind: "verify", solveFlowId: null });
    expect(parseSessionResult({ kind: "solve", projectedPolicy: null })?.kind).toBe("solve");
  });
});

describe("Solve flow schema", () => {
  it("commits owner scoping and session/region foreign keys", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20261030200000_solve_flows.sql"),
      "utf8",
    );
    expect(sql).toContain("create table if not exists public.solve_flows");
    expect(sql).toContain("owner_user_id uuid not null");
    expect(sql).toContain("auth.uid() = owner_user_id");
    expect(sql).toContain("sessions_solve_flow_id_fkey");
    expect(sql).toContain("foreign key (solve_flow_id) references public.solve_flows(id)");
    expect(sql).toContain("knowledge_regions_solve_flow_id_fkey");
    expect(sql).toContain("product = any (array['verification'::text, 'calibration'::text, 'solve'::text])");
    expect(sql).toContain("kind = any (array['learn'::text, 'calibrate'::text, 'verify'::text, 'solve'::text])");
  });
});
