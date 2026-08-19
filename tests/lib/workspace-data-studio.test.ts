/**
 * Workspace Settings Data Studio PoW invalidate — structural + pure mutate.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildStudioPowPatch,
  isInvalidatedPoWMetadata,
} from "@/lib/pow-api/studio-pow-mutate";
import { filterSnapshotEligibleProofOfWorkRows } from "@/lib/pow-api/pow-quality";
import { parseStudioSessionLinkInput } from "@/lib/admin/data-studio";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("workspace Data Studio surface", () => {
  it("Settings registry mounts Data Studio tab and panel", () => {
    const panel = read("components/WorkspaceIntegrationPanel.tsx");
    expect(panel).toContain('"data-studio"');
    expect(panel).toContain("Data Studio");
    expect(panel).toContain("WorkspaceDataStudioPanel");
    expect(panel).toContain('data-settings-tab-panel="data-studio"');
    expect(existsSync(join(ROOT, "components/WorkspaceDataStudioPanel.tsx"))).toBe(true);
    const studio = read("components/WorkspaceDataStudioPanel.tsx");
    expect(studio).toContain("data-workspace-data-studio");
    expect(studio).toContain("data-studio-filter-user");
    expect(studio).toContain("data-studio-filter-link");
    expect(studio).toContain("data-studio-filter-search");
    expect(studio).toContain("data-studio-bulk-invalidate");
    expect(studio).toContain("data-studio-invalidate");
    expect(studio).toContain("/api/workspace/data-studio/pow");
    // Expandable row details with metadata
    expect(studio).toContain("data-studio-pow-expand");
    expect(studio).toContain("data-studio-pow-details-row");
    expect(studio).toContain("data-studio-pow-metadata-json");
    expect(studio).toContain("data-studio-pow-details");
    expect(studio).toContain("JSON.stringify(meta");
  });

  it("ships workspace mutate route using metadata invalidate", () => {
    const ws = read("app/api/workspace/data-studio/pow/route.ts");
    expect(ws).toContain("buildStudioPowPatch");
    expect(ws).toContain("invalidate");
    expect(ws).toContain("guardWorkspaceRoute");
    expect(ws).toContain("updated_ids");
    // Writes after owner gate use service role (RLS lacked UPDATE historically)
    expect(ws).toContain("createAdminClient");
    // List: accurate range+count for simple browse; candidate scan for filters
    expect(ws).toContain("count: \"exact\"");
    expect(ws).toContain("POW_CANDIDATE_LIMIT");
    expect(ws).toContain("needsCandidateScan");
    expect(ws).toContain(".range(");

    // No dedicated invalidated column in select / updates beyond metadata object
    expect(ws).not.toMatch(/\.update\(\s*\{\s*invalidated\s*:/);

    // Owner UPDATE RLS migration ships
    expect(
      existsSync(
        join(ROOT, "supabase/migrations/20260731160000_workspace_pow_owner_update.sql"),
      ),
    ).toBe(true);
    const mig = read("supabase/migrations/20260731160000_workspace_pow_owner_update.sql");
    expect(mig).toMatch(/Workspace owners can update evidence/i);
    expect(mig).toMatch(/FOR UPDATE/i);
  });

  it("bulk invalidate UI closes inspect to avoid stale metadata wipe", () => {
    const wsUi = read("components/WorkspaceDataStudioPanel.tsx");
    expect(wsUi).toContain("setExpandedId(null)");
    expect(wsUi).toMatch(/bulkInvalidate[\s\S]*setExpandedId\(null\)/);
  });
});

describe("link parse includes TAPBench", () => {
  it("parses /tapbench/{token}", () => {
    const p = parseStudioSessionLinkInput(
      "http://localhost:3000/tapbench/czgktLvZB3di3xXm0UeWGzWisnk32Qosjws1LDLPF3g",
    );
    expect(p?.kind).toBe("tapbench");
    expect(p?.token).toBe("czgktLvZB3di3xXm0UeWGzWisnk32Qosjws1LDLPF3g");
  });
});

describe("invalidate contract drives snapshot eligibility", () => {
  it("bulk-style patch marks metadata so filterSnapshotEligible drops the row", () => {
    const before = { id: "pow-1", metadata: { text: "solution", source: "agent" } };
    const patch = buildStudioPowPatch(before.metadata, {
      invalidate: true,
      invalidateOptions: { by: "owner", reason: "bulk" },
    });
    expect(isInvalidatedPoWMetadata(patch.metadata)).toBe(true);
    const eligible = filterSnapshotEligibleProofOfWorkRows([
      before,
      { id: "pow-1-after", metadata: patch.metadata },
      { id: "pow-2", metadata: { text: "ok" } },
    ]);
    expect(eligible.map((r) => r.id)).toEqual(["pow-1", "pow-2"]);
  });
});
