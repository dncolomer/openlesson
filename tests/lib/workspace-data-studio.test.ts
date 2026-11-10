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
  it("workspace Settings Data Studio panel and mutate route are gone; dashboard studio remains", () => {
    expect(existsSync(join(ROOT, "components/WorkspaceDataStudioPanel.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/workspace/data-studio/pow/route.ts"))).toBe(false);
    const panel = read("components/WorkspaceIntegrationPanel.tsx");
    expect(panel).not.toContain("WorkspaceDataStudioPanel");
    expect(existsSync(join(ROOT, "app/api/dashboard/data-studio/route.ts"))).toBe(true);
    const studio = read("app/api/dashboard/data-studio/route.ts");
    expect(studio.length).toBeGreaterThan(0);
  });
});

describe("link parse does not treat /tapbench as a live kind", () => {
  it("does not classify /tapbench/{token} as a TAPBench session", () => {
    const p = parseStudioSessionLinkInput(
      "http://localhost:3000/tapbench/czgktLvZB3di3xXm0UeWGzWisnk32Qosjws1LDLPF3g",
    );
    expect(p?.kind).not.toBe("tapbench" as never);
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
