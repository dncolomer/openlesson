import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  AYCL_WORKSPACE_LOCAL_TABS,
  ayclWorkspaceLocalTabs,
  availableWorkspaceSections,
  resolveActiveSection,
  resolveWorkspaceSectionLayout,
} from "@/lib/workspace-sections";

const REPO_ROOT = path.resolve(__dirname, "../..");

/**
 * AYCL token holders are owner-equivalent for their purchased workspace clone.
 * Full shell: same sections as owner WorkspaceView (via reuse).
 */
describe("AYCL section layout mapping (shared helper)", () => {
  it("Workspace section keeps block-map chrome and has no local tabs", () => {
    const layout = resolveWorkspaceSectionLayout("workspace");
    expect(layout.showBlockMapChrome).toBe(true);
    expect(layout.showSessionsColumn).toBe(true);
    expect(layout.mountsPerformancePanel).toBe(false);
    expect(layout.localTabs).toEqual([]);
  });

  it("Knowledge section mounts performance panel without block-map chrome", () => {
    const layout = resolveWorkspaceSectionLayout("knowledge");
    expect(layout.mountsPerformancePanel).toBe(true);
    expect(layout.showBlockMapChrome).toBe(false);
  });

  it("owner-equivalent sections include DAGs second after Workspace", () => {
    expect(availableWorkspaceSections({ isOwner: true })).toEqual([
      "workspace",
      "dags",
      "context",
      "simulation",
      "knowledge",
      "settings",
    ]);
    expect(resolveActiveSection("settings", { isOwner: true })).toBe("settings");
    expect(resolveActiveSection("knowledge", { isOwner: true })).toBe("knowledge");
    expect(availableWorkspaceSections({ isOwner: false })).toEqual([
      "workspace",
      "context",
      "simulation",
    ]);
  });

  it("AYCL local tabs are empty", () => {
    expect(ayclWorkspaceLocalTabs()).toEqual([]);
    expect(AYCL_WORKSPACE_LOCAL_TABS).toEqual([]);
  });
});

describe("AyclWorkspaceView full-clone wiring", () => {
  const ayclSource = fs.readFileSync(
    path.join(REPO_ROOT, "components/AyclWorkspaceView.tsx"),
    "utf8",
  );
  const viewSource = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspaceView.tsx"),
    "utf8",
  );

  it("reuses WorkspaceView with ayclToken (not a reduced fork UI)", () => {
    expect(ayclSource).toContain("WorkspaceView");
    expect(ayclSource).toContain("ayclToken={accessToken}");
    expect(ayclSource).toContain("workspaceIdOverride");
    expect(ayclSource).toContain("hideNavbar");
    expect(ayclSource).toContain("accessBanner");
    expect(ayclSource).toMatch(/clone|cloning/i);
    // No duplicate sectionConfig fork
    expect(ayclSource).not.toContain("sectionConfig");
    expect(ayclSource).not.toContain("availableWorkspaceSections");
  });

  it("WorkspaceView supports AYCL owner-equivalent + token on APIs", () => {
    expect(viewSource).toContain("ayclToken");
    expect(viewSource).toContain("isAycl");
    expect(viewSource).toContain("refreshAyclWorkspace");
    expect(viewSource).toContain("withAycl");
    expect(viewSource).toContain("workspaceIdOverride");
    expect(viewSource).toContain('data-aycl-shell');
  });
});
