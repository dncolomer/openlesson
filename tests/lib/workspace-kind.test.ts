import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  noMapWorkspaceDashboardHref,
  parseWorkspaceKind,
} from "@/lib/workspace-kind";

describe("parseWorkspaceKind", () => {
  it("maps leftover aliases onto Learning", () => {
    expect(parseWorkspaceKind("standard")).toBe("standard");
    expect(parseWorkspaceKind("knowledge_region")).toBe("standard");
    expect(parseWorkspaceKind("knowledge-region")).toBe("standard");
    expect(parseWorkspaceKind("knowledgeRegion")).toBe("standard");
    expect(parseWorkspaceKind("calibration")).toBe("standard");
    expect(parseWorkspaceKind("calibrate")).toBe("standard");
    expect(parseWorkspaceKind("calibration_workspace")).toBe("standard");
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
    expect(migration).toContain("coalesce(product, '')");
    expect(migration).toContain("left(trim(m.name), 109)");
    expect(migration).not.toContain(
      "delete from public.workspace_flow_embeddings where owner_user_id is null",
    );
    expect(migration).not.toMatch(
      /workspace_flow_embeddings[\s\S]{0,80}owner_user_id set not null/,
    );
  });
});

describe("noMapWorkspaceDashboardHref", () => {
  it("does not treat leftover kinds as no-map workspaces", () => {
    expect(noMapWorkspaceDashboardHref("knowledge_region")).toBeNull();
    expect(noMapWorkspaceDashboardHref("knowledge-region")).toBeNull();
    expect(noMapWorkspaceDashboardHref("calibration")).toBeNull();
    expect(noMapWorkspaceDashboardHref("calibrate")).toBeNull();
    expect(noMapWorkspaceDashboardHref("standard")).toBeNull();
    expect(noMapWorkspaceDashboardHref(undefined)).toBeNull();
  });
});
