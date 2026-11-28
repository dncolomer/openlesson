import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  omitEmptyFlowWorkspaceId,
  optionalFlowColumnNamedInError,
  writeFlowRowWithOptionalColumns,
} from "@/lib/flow-row-write";

const ROOT = join(__dirname, "../..");
const OPTIONAL = ["name", "action_catalog", "duration_minutes", "owner_user_id", "workspace_id"] as const;
const PROD_ERROR =
  "Could not find the 'workspace_id' column of 'verify_flows' in the schema cache.";

describe("flow row optional columns", () => {
  it("omits empty workspace_id so dashboard create does not send a missing column", () => {
    expect(omitEmptyFlowWorkspaceId({ id: "vf1", workspace_id: null, name: "Limits" })).toEqual({
      id: "vf1",
      name: "Limits",
    });
    expect(omitEmptyFlowWorkspaceId({ id: "vf1", workspace_id: "", name: "Limits" })).not.toHaveProperty(
      "workspace_id",
    );
    expect(omitEmptyFlowWorkspaceId({ id: "vf1", workspace_id: "ws-1" }).workspace_id).toBe("ws-1");
  });

  it("matches the quoted PostgREST column and does not treat name as a hit", () => {
    const row = { name: "Limits", workspace_id: "ws-1" };
    expect(optionalFlowColumnNamedInError(PROD_ERROR, row, OPTIONAL)).toBe("workspace_id");
    expect(optionalFlowColumnNamedInError(PROD_ERROR, row, ["name", "action_catalog"])).toBeNull();
  });

  it("retries without workspace_id after the prod schema-cache error", async () => {
    const calls: Record<string, unknown>[] = [];
    const result = await writeFlowRowWithOptionalColumns(
      async (body) => {
        calls.push({ ...body });
        if ("workspace_id" in body) return { error: { message: PROD_ERROR } };
        return { error: null };
      },
      { id: "vf1", name: "Limits", workspace_id: "ws-1", topic: "Limits" },
      OPTIONAL,
    );
    expect(result.error).toBeNull();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ name: "Limits", workspace_id: "ws-1" });
    expect(calls[1]).toMatchObject({ name: "Limits", topic: "Limits" });
    expect(calls[1]).not.toHaveProperty("workspace_id");
  });

  it("does not send a null workspace_id on the first write", async () => {
    const calls: Record<string, unknown>[] = [];
    const result = await writeFlowRowWithOptionalColumns(
      async (body) => {
        calls.push({ ...body });
        return { error: null };
      },
      { id: "vf1", name: "Limits", workspace_id: null },
      OPTIONAL,
    );
    expect(result.error).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toHaveProperty("workspace_id");
  });

  it("wires the verification writer onto the shared helper", () => {
    for (const rel of ["lib/verification-flow-repository.ts"]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).toContain("writeFlowRowWithOptionalColumns");
      expect(src).toContain("@/lib/flow-row-write");
    }
    const sql = readFileSync(
      join(ROOT, "supabase/archive/migrations-pre-20261128/20261121120000_flow_workspace_id.sql"),
      "utf8",
    );
    expect(sql).toContain("verify_flows");
    expect(sql).toContain("calibrate_flows");
    expect(sql).toContain("add column if not exists workspace_id");
  });
});
