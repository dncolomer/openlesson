import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Static/structural checks for Goals tab, Settings without goal field,
 * block goals drawer, LWM goal selection UI.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readKnowledgePanelSurface } from "../helpers/surface-source";
import {
  availableWorkspaceSections,
  resolveWorkspaceSectionLayout,
  WORKSPACE_SECTION_KEYS,
} from "@/lib/workspace-sections";

const ROOT = join(__dirname, "../..");

describe("Goals workspace section registry", () => {
  it("includes goals in section keys and owner nav", () => {
    expect(WORKSPACE_SECTION_KEYS).toContain("goals");
    const owner = availableWorkspaceSections({ isOwner: true });
    expect(owner).toContain("goals");
    expect(owner.indexOf("goals")).toBeLessThan(owner.indexOf("knowledge"));
  });

  it("maps goals layout to mountsGoalsPanel", () => {
    const layout = resolveWorkspaceSectionLayout("goals");
    expect(layout.mainSurface).toBe("goals");
    expect(layout.mountsGoalsPanel).toBe(true);
    expect(layout.mountsPerformancePanel).toBe(false);
  });
});

describe("Settings identity has no goal field", () => {
  it("WorkspaceIdentitySettings does not expose workspace_goal editor", () => {
    const src = readFileSync(
      join(ROOT, "components/WorkspaceIdentitySettings.tsx"),
      "utf8",
    );
    expect(src).not.toContain("data-workspace-goal-settings");
    expect(src).not.toContain("workspace-settings-goal");
    expect(src).not.toContain("editGoal");
    expect(src).not.toContain("workspace_goal:");
  });
});

describe("Goals tab + block goals drawer", () => {
  it("WorkspaceGoalsPanel ships with CRUD data attributes", () => {
    expect(existsSync(join(ROOT, "components/WorkspaceGoalsPanel.tsx"))).toBe(true);
    const src = readFileSync(join(ROOT, "components/WorkspaceGoalsPanel.tsx"), "utf8");
    expect(src).toContain("data-workspace-goals-panel");
    expect(src).toContain("/api/workspace/goals");
  });

  it("WorkspaceView mounts Goals tab panel", () => {
    const view = readWorkspaceViewSurface();
    expect(view).toContain("WorkspaceGoalsPanel");
    expect(view).toContain("mountsGoalsPanel");
    expect(view).toContain('key: "goals"');
    expect(view).toContain("data-workspace-goals-host");
  });

  it("block-detail drawer includes goals only post-creation (blockId present)", () => {
    const pane = readFileSync(
      join(ROOT, "components/WorkspaceBlockDetailPane.tsx"),
      "utf8",
    );
    expect(pane).toContain("BlockGoalsPanel");
    expect(pane).toContain('drawerId="goals"');
    expect(pane).toContain("data-block-goals-drawer");
    // Not in add-block create flow
    const addPane = readFileSync(
      join(ROOT, "components/WorkspaceAddBlockPane.tsx"),
      "utf8",
    );
    expect(addPane).not.toContain("BlockGoalsPanel");
    expect(addPane).not.toContain('drawerId="goals"');
  });
});

describe("LWM UI goal selection", () => {
  it("KnowledgeConfigTrajectoryPanel exposes default/adhoc/custom controls in generate modal", () => {
    const src = readKnowledgePanelSurface();
    expect(src).toContain("data-lwm-snapshot-modal");
    expect(src).toContain("data-lwm-goal-selection");
    expect(src).toContain("data-lwm-goal-mode");
    expect(src).toContain("data-lwm-adhoc-goal");
    expect(src).toContain("data-lwm-goal-picker");
    expect(src).toContain("goal_mode");
    expect(src).toContain("adhoc_goal");
    expect(src).toContain("goal_ids");
    expect(src).toContain('id: "default"');
    expect(src).toContain('id: "adhoc"');
    expect(src).toContain('id: "selected"');
    // Compact control: generate opens modal rather than running immediately
    expect(src).toMatch(/openSnapshotModal\("single"\)/);
    expect(src).toMatch(/openSnapshotModal\("all"\)/);
    expect(src).toContain("data-lwm-snapshot-progress");
    // Snapshot-all uses the same goal payload as single generate
    expect(src).toMatch(
      /generateSnapshotAll[\s\S]*goal_mode:\s*goalMode[\s\S]*JSON\.stringify\(body\)/,
    );
  });
});
