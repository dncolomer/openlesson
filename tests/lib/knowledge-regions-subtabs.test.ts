/**
 * Knowledge Regions sub-tabs: Create · Browse regions (TAPBench mint lives under Knowledge Links).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  KNOWLEDGE_REGIONS_INNER_TABS,
  type KnowledgeRegionsInnerTab,
} from "@/components/CustomVerificationModelsPanel";

const ROOT = join(__dirname, "../..");
const PANEL = "components/CustomVerificationModelsPanel.tsx";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Knowledge Regions inner sub-tabs (shipped UI)", () => {
  it("exports two tab ids: create, browse-regions (no tapbench mint tab)", () => {
    const ids = KNOWLEDGE_REGIONS_INNER_TABS.map((t) => t.id);
    expect(ids).toEqual(["create", "browse-regions"]);
    expect(KNOWLEDGE_REGIONS_INNER_TABS).toHaveLength(2);
    const labels = KNOWLEDGE_REGIONS_INNER_TABS.map((t) => t.label.toLowerCase());
    expect(labels.some((l) => l.includes("create"))).toBe(true);
    expect(labels.some((l) => l.includes("browse") && l.includes("region"))).toBe(true);
    expect(labels.some((l) => l.includes("tapbench"))).toBe(false);
  });

  it("panel wires WorkspaceSectionSubTabs and gates content by active inner tab", () => {
    const ui = read(PANEL);
    expect(ui).toContain("WorkspaceSectionSubTabs");
    expect(ui).toContain("data-knowledge-regions-subtabs");
    expect(ui).toContain("data-knowledge-regions-inner-tabs");
    expect(ui).toContain("KNOWLEDGE_REGIONS_INNER_TABS");
    expect(ui).toContain('innerTab === "create"');
    expect(ui).toContain('innerTab === "browse-regions"');
    expect(ui).not.toContain('innerTab === "tapbench"');
    expect(ui).toContain('data-knowledge-regions-inner-tab="create"');
    expect(ui).toContain('data-knowledge-regions-inner-tab="browse-regions"');
    expect(ui).not.toContain('data-knowledge-regions-inner-tab="tapbench"');
    expect(ui).not.toContain("data-create-tapbench-link");
    expect(ui).not.toContain("data-tapbench-mint");
  });

  it("Create tab holds region builder create flow", () => {
    const ui = read(PANEL);
    const createStart = ui.indexOf('data-knowledge-regions-inner-tab="create"');
    const browseStart = ui.indexOf('data-knowledge-regions-inner-tab="browse-regions"');
    expect(createStart).toBeGreaterThan(-1);
    expect(browseStart).toBeGreaterThan(createStart);
    const createSlice = ui.slice(createStart, browseStart);
    expect(createSlice).toContain("data-region-builder");
    expect(createSlice).toContain("data-region-create-cohort");
    expect(createSlice).toContain("data-region-source-filter");
    expect(createSlice).toContain("data-region-link-filter");
    expect(createSlice).toContain("data-create-cohort-region");
    expect(ui).toContain('action: "create"');
    expect(createSlice).not.toContain("data-region-saved-list");
  });

  it("Browse regions tab holds saved list and remove", () => {
    const ui = read(PANEL);
    const browseStart = ui.indexOf('data-knowledge-regions-inner-tab="browse-regions"');
    expect(browseStart).toBeGreaterThan(-1);
    const browseSlice = ui.slice(browseStart);
    expect(browseSlice).toContain("data-region-saved-list");
    expect(browseSlice).toContain("data-knowledge-regions-list");
    expect(browseSlice).toContain("data-remove-knowledge-region");
    expect(ui).toContain('action: "delete"');
    expect(browseSlice).not.toContain("data-region-builder");
  });

  it("ships panel file and sub-tab component dependency", () => {
    expect(existsSync(join(ROOT, PANEL))).toBe(true);
    expect(existsSync(join(ROOT, "components/WorkspaceSectionSubTabs.tsx"))).toBe(true);
    const typeOk: KnowledgeRegionsInnerTab[] = ["create", "browse-regions"];
    expect(typeOk).toHaveLength(2);
  });
});
