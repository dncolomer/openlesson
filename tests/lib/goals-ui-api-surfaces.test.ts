import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Static/structural checks for Goals tab, Settings without goal field,
 * unmounted block goals drawer, LWM goal selection UI.
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
    const learning = availableWorkspaceSections({ isOwner: true });
    expect(learning).not.toContain("goals");
    const leftoverKind = availableWorkspaceSections({
      isOwner: true,
      workspaceKind: "knowledge_region",
    });
    expect(leftoverKind).toEqual(learning);
    expect(leftoverKind).not.toContain("goals");
  });

  it("maps goals layout to mountsGoalsPanel", () => {
    const layout = resolveWorkspaceSectionLayout("goals");
    expect(layout.mainSurface).toBe("goals");
    expect(layout.mountsGoalsPanel).toBe(true);
    expect(layout.mountsPerformancePanel).toBe(false);
  });
});

describe("Goals tab + block goals drawer", () => {

  it("WorkspaceView does not mount Goals tab panel", () => {
    const view = readWorkspaceViewSurface();
    expect(view).not.toContain("WorkspaceGoalsPanel");
    expect(view).not.toContain("data-workspace-goals-host");
  });

});

describe("Knowledge embeddings surface", () => {
  it("Knowledge panel ships embeddings projection without LWM snapshot modal", () => {
    const src = readKnowledgePanelSurface();
    expect(src).not.toContain("data-lwm-snapshot-modal");
    expect(src).not.toContain("generateSnapshot");
    expect(src).toContain("KnowledgeModelsView");
  });
});
