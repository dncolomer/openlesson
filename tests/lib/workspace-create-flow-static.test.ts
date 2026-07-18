import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("workspace create + builder static wiring", () => {
  it("workspace new UI has three option cards, AYCL banner, and no Login control", () => {
    const page = read("app/workspace/new/page.tsx");
    expect(page).toContain('mode: "blank"');
    expect(page).toContain('mode: "template"');
    expect(page).toContain('mode: "files_goal"');
    expect(page).toContain("data-create-mode-cards");
    expect(page).toContain("data-aycl-banner");
    expect(page).toContain("/all-you-can-learn");
    // Login control removed from header (auth redirect on submit remains)
    expect(page).not.toMatch(/href=["']\/login["']/);
    expect(page).toMatch(/Login removed from workspace new screen/);
    expect(page).toContain("Goal");
    expect(page).toContain("createMode: \"blank\"");
    expect(page).toContain("createMode: \"template\"");
    expect(page).toContain("createMode: \"files_goal\"");
  });

  it("builder tab label is Builder in English messages", () => {
    const en = JSON.parse(read("messages/en.json"));
    expect(en.planView.planBuilder).toBe("Builder");
  });

  it("dashboard Insights mounts InsightsDashboardTab and is not Performance", () => {
    const dash = read("app/dashboard/page.tsx");
    expect(dash).toContain("InsightsDashboardTab");
    expect(dash).toContain('id: "insights"');
    expect(dash).toContain('label: "Insights"');
    // Performance is a workspace tab, not a dashboard Insights subtab
    const insightsTab = read("components/InsightsDashboardTab.tsx");
    expect(insightsTab).toMatch(/workspaces/i);
    expect(insightsTab).not.toContain("PerformanceChat");
  });

  it("insights API filters to workspace-origin only", () => {
    const route = read("app/api/insights/route.ts");
    expect(route).toContain('.not("workspace_id", "is", null)');
  });

  it("block create/generate paths pass files + notes into context", () => {
    const add = read("app/api/workspace/add-block-at-slot/route.ts");
    expect(add).toContain("composeBlockGenerationContext");
    expect(add).toContain("notes");
    expect(add).toContain("workspace_files");
    const gridOps = read("app/api/workspace/grid-ops/route.ts");
    expect(gridOps).toContain("composeBlockGenerationContext");
    expect(gridOps).toContain("fileNames");
    expect(gridOps).toContain("notes");
    // AI Builder chat + regenerate must include files/notes before LLM calls
    const chat = read("app/api/workspace/chat/route.ts");
    expect(chat).toContain("composeBlockGenerationContext");
    expect(chat).toContain("workspace_files");
    expect(chat).toContain("notes: plan.notes");
    expect(chat).toContain("alwaysContext");
    // Prompt includes alwaysContext before await callXaiJSON
    expect(chat.indexOf("alwaysContext")).toBeLessThan(chat.indexOf("await callXaiJSON"));
    const regen = read("app/api/workspace/regenerate/route.ts");
    expect(regen).toContain("composeBlockGenerationContext");
    expect(regen).toContain("workspace_files");
    expect(regen).toContain("notes: plan.notes");
    expect(regen).toContain("alwaysContext");
    expect(regen.indexOf("alwaysContext")).toBeLessThan(regen.indexOf("await callXaiJSON"));
    const expand = read("app/api/workspace/expand/route.ts");
    expect(expand).toContain("composeBlockGenerationContext");
    expect(expand).toContain("workspace_files");
  });

  it("sequential appear animation is wired for AI-added blocks", () => {
    const grid = read("components/BlockSkillGrid.tsx");
    expect(grid).toContain("appearingNodeIds");
    expect(grid).toContain("APPEAR_STAGGER_MS");
    expect(grid).toMatch(/opacity|fade|shadow/);
    const list = read("components/SessionList.tsx");
    expect(list).toContain("appearingNodeIds");
    expect(list).toContain("setAppearingNodeIds");
  });

  it("multi-select grid ops are exposed (merge, split, move, generate_shape, edit)", () => {
    const grid = read("components/BlockSkillGrid.tsx");
    expect(grid).toContain("generate_shape");
    expect(grid).toContain("merge");
    expect(grid).toContain("split");
    expect(grid).toContain("move");
    expect(grid).toContain("update_block");
    expect(grid).toContain("selectedEmptyCells");
    expect(grid).toContain("selectedBlockIds");
    const ops = read("app/api/workspace/grid-ops/route.ts");
    expect(ops).toContain('op === "merge"');
    expect(ops).toContain('op === "split"');
    expect(ops).toContain('op === "move"');
    expect(ops).toContain('op === "generate_shape"');
  });

  it("API/agent create is files+goal only", () => {
    const create = read("lib/agent-v2/create-agent-workspace.ts");
    expect(create).toContain("assertApiCreateMode");
    expect(create).toContain("composeAgentFilesGoalPrompt");
    expect(create).toContain("goalFieldsFromPrompt");
    const catalog = read("lib/agent-v2/mcp-proof-of-work-catalog.ts");
    expect(catalog).toMatch(/Files \+ Goal only/i);
  });
});
