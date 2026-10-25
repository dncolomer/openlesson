import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  noMapWorkspaceDashboardHref,
  parseWorkspaceKind,
} from "@/lib/workspace-kind";

describe("parseWorkspaceKind", () => {
  it("maps stored ids and aliases onto the three durable kinds", () => {
    expect(parseWorkspaceKind("standard")).toBe("standard");
    expect(parseWorkspaceKind("knowledge_region")).toBe("knowledge_region");
    expect(parseWorkspaceKind("knowledge-region")).toBe("knowledge_region");
    expect(parseWorkspaceKind("knowledgeRegion")).toBe("knowledge_region");
    expect(parseWorkspaceKind("calibration")).toBe("calibration");
    expect(parseWorkspaceKind("calibrate")).toBe("calibration");
    expect(parseWorkspaceKind("calibration_workspace")).toBe("calibration");
    expect(parseWorkspaceKind(undefined)).toBe("standard");
    expect(parseWorkspaceKind("learning")).toBe("standard");
  });

  it("ships a migration that keeps only standard on live workspace rows", () => {
    const migration = readFileSync(
      join(__dirname, "../../supabase/migrations/20261025180000_flow_owner_user.sql"),
      "utf8",
    );
    expect(migration).toContain("owner_user_id");
    expect(migration).toContain("check (workspace_kind = 'standard'::text)");
    expect(migration).toContain("workspace_verification_flows");
    expect(migration).toContain("workspace_calibration_flows");
  });
});

describe("noMapWorkspaceDashboardHref", () => {
  it("sends knowledge_region and calibration to dashboard Flows", () => {
    expect(noMapWorkspaceDashboardHref("knowledge_region")).toBe(
      "/dashboard?tab=verification",
    );
    expect(noMapWorkspaceDashboardHref("knowledge-region")).toBe(
      "/dashboard?tab=verification",
    );
    expect(noMapWorkspaceDashboardHref("calibration")).toBe(
      "/dashboard?tab=calibration",
    );
    expect(noMapWorkspaceDashboardHref("calibrate")).toBe(
      "/dashboard?tab=calibration",
    );
    expect(noMapWorkspaceDashboardHref("standard")).toBeNull();
    expect(noMapWorkspaceDashboardHref(undefined)).toBeNull();
  });
});
