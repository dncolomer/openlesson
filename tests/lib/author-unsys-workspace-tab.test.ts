/**
 * Workspace Unsys models tab: list saved seeds, edit/delete, owner-only section.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  authorUnsysSeedForPersist,
  exampleAuthorUnsysModel,
  listAuthorUnsysWorkspaceSeeds,
} from "@/lib/author-unsys-model";
import {
  availableWorkspaceSections,
  resolveWorkspaceSectionLayout,
} from "@/lib/workspace-sections";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-54e8f9ec94f9/implementer";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function writeEvidence(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("workspace unsys models tab", () => {
  it("lists saved seeds and wires an owner-only section", () => {
    const four = exampleAuthorUnsysModel("Just war");
    const items = listAuthorUnsysWorkspaceSeeds([
      { id: "a", title: "Alpha", answers_model_seed: authorUnsysSeedForPersist(four) },
      { id: "b", title: "Beta", answers_model_seed: authorUnsysSeedForPersist(four) },
      { id: "c", title: "Empty" },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ blockId: "a", branchCount: four.branches.length });
    expect(items[1]?.branchCount).toBe(four.branches.length);

    const owner = availableWorkspaceSections({ isOwner: true });
    expect(owner).toContain("unsys_models");
    expect(owner.indexOf("unsys_models")).toBe(owner.indexOf("map_types") + 1);
    expect(availableWorkspaceSections({ isOwner: false })).not.toContain("unsys_models");
    expect(availableWorkspaceSections({ isOrgAdmin: true })).not.toContain("unsys_models");
    const layout = resolveWorkspaceSectionLayout("unsys_models");
    expect(layout.mountsUnsysModelsPanel).toBe(true);
    expect(layout.showBlockMapChrome).toBe(false);
    expect(layout.mainSurface).toBe("unsys_models");

    const panel = read("components/WorkspaceUnsysModelsPanel.tsx");
    const hosts = read("components/workspace-view/workspace-section-hosts.tsx");
    const nav = read("components/workspace-view/workspace-section-nav-items.tsx");
    const view = read("components/WorkspaceView.tsx");
    const sections = read("lib/workspace-sections.ts");
    const en = read("messages/en.json");
    expect(panel).toContain("data-workspace-unsys-models-panel");
    expect(panel).toContain("data-workspace-unsys-model-edit");
    expect(panel).toContain("data-workspace-unsys-model-delete");
    expect(hosts).toContain("WorkspaceUnsysModelsPanel");
    expect(hosts).toContain("data-workspace-unsys-models-host");
    expect(nav).toContain('key: "unsys_models"');
    expect(nav).toContain("sectionUnsysModels");
    expect(nav).toContain('className="h-6 w-6 shrink-0"');
    expect(nav).not.toContain('className="w-4 h-4"');
    expect(view).toContain("onOpenUnsysStudio");
    expect(view).not.toContain("initialCatalogSize");
    expect(sections).toContain('"unsys_models"');
    expect(en).toContain("Unsys models");

    writeEvidence(
      "author-unsys-workspace-tab.log",
      [
        `count=${items.length}`,
        `branchCount=${items[1]?.branchCount}`,
        `ownerHas=${owner.includes("unsys_models")}`,
      ].join("\n"),
    );
    expect(existsSync(join(SCRATCH, "author-unsys-workspace-tab.log"))).toBe(true);
  });
});
