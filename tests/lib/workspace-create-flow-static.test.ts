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

  it("workspace Knowledge hosts InsightsDashboardTab; Dashboard no longer has Insights tab", () => {
    const dash = read("app/dashboard/page.tsx");
    expect(dash).not.toContain("InsightsDashboardTab");
    expect(dash).not.toMatch(/id:\s*"insights"/);
    expect(dash).not.toContain('activeTab === "insights"');

    const knowledge = read("components/WorkspacePerformancePanel.tsx");
    expect(knowledge).toContain("InsightsDashboardTab");
    expect(knowledge).toContain('id: "insights"');
    expect(knowledge).toContain("workspaceId={workspaceId}");
    expect(knowledge).toContain("<InsightsDashboardTab");

    // Workspace-scoped list UI; not Performance chat
    const insightsTab = read("components/InsightsDashboardTab.tsx");
    expect(insightsTab).toContain("workspaceId");
    expect(insightsTab).toContain("insightsListUrl(workspaceId)");
    expect(insightsTab).toMatch(/workspace/i);
    expect(insightsTab).not.toContain("PerformanceChat");
  });

  it("insights API filters to workspace-origin only and supports workspaceId scope", () => {
    const route = read("app/api/insights/route.ts");
    expect(route).toContain('.not("workspace_id", "is", null)');
    expect(route).toContain('searchParams.get("workspaceId")');
    expect(route).toContain('.eq("workspace_id", workspaceId)');
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
    // Avoid max-update-depth: stable empty default + content key + no setState(new Set()) every empty run
    expect(grid).toContain("EMPTY_APPEARING_NODE_IDS");
    expect(grid).toContain("appearingKey");
    expect(grid).toContain("onAppearingCompleteRef");
    expect(grid).toMatch(/prev\.size === 0 \? prev : new Set\(\)/);
    expect(grid).not.toMatch(/appearingNodeIds = \[\]/);
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
    // Size-relative ILE/TAP prompts for merge / split / generate-in-shape
    expect(ops).toContain("composeMergeBlockUserPrompt");
    expect(ops).toContain("composeSplitBlockUserPrompt");
    expect(ops).toContain("composeGenerateShapeBlockUserPrompt");
    expect(ops).toContain("block-footprint-prompt");
  });

  it("block map exposes a full-height icon tool column with Select and wired grid ops", () => {
    const grid = read("components/BlockSkillGrid.tsx");
    expect(grid).toContain("data-block-map-tool-strip");
    // Full top–bottom rail column (not floating absolute toolbox)
    expect(grid).toContain("h-full w-11 shrink-0 flex-col");
    expect(grid).toContain("border-r border-neutral-800");
    expect(grid).not.toMatch(/data-block-map-tool-strip[\s\S]{0,120}absolute left-2 top-2/);
    expect(grid).toContain("data-block-map-tool={tool}");
    expect(grid).toContain("activeTool");
    expect(grid).toContain("DEFAULT_BLOCK_MAP_MODE");
    expect(grid).toContain("nextActiveModeTool");
    expect(grid).toContain("isBlockMapToolEnabled");
    expect(grid).toContain("handleToolClick");
    // Select plain-click must populate selectedBlockIds via shared selection helpers
    expect(grid).toContain("toggleOrReplaceBlockSelection");
    expect(grid).toContain("applyBlockSelection");
    expect(grid).toContain("setSelectedBlockIds");
    // Explicit Select tool + mode affordance
    expect(grid).toContain('"select"');
    expect(grid).toMatch(/aria-pressed/);
    expect(grid).toMatch(/title=\{title\}/);
    // Ops still routed through real handlers / onGridOp
    expect(grid).toContain('op: "split"');
    expect(grid).toContain('op: "move"');
    expect(grid).toContain("setMergePromptOpen(true)");
    expect(grid).toContain("setShapePromptOpen(true)");
    expect(grid).toContain("openEditSelected");
    // Select/Move: drag-drop move, no arrow pad, no TAP/ILE on single click
    expect(grid).toContain("isBlockMapManipulationMode");
    expect(grid).toContain("handleBlockPointerDown");
    expect(grid).toContain("data-block-map-draggable");
    expect(grid).toContain("onSelectNode(null)");
    expect(grid).toContain("handleBlockDoubleClick");
    expect(grid).not.toContain("data-block-map-move");
    expect(grid).not.toContain("showMovePad");
    // Bottom text multi-toolbar is no longer the primary chrome
    expect(grid).not.toContain("multiToolbarVisible");
    const tools = read("lib/block-map-tools.ts");
    expect(tools).toContain("DEFAULT_BLOCK_MAP_MODE");
    expect(tools).toContain('"select"');
    expect(tools).toContain("isBlockMapToolEnabled");
    expect(tools).toContain("resolveBlockSelectionOnClick");
    expect(tools).toContain("blockDragMoveDelta");
    expect(tools).toContain("isBlockMapManipulationMode");
  });

  it("programmatic API/MCP create is disabled; UI generate remains", () => {
    const route = read("app/api/v3/pow/workspaces/route.ts");
    expect(route).not.toContain("createAgentWorkspace");
    expect(route).toContain("WORKSPACE_CREATE_UI_ONLY_MESSAGE");

    const catalog = read("lib/pow-api/mcp-proof-of-work-catalog.ts");
    expect(catalog).not.toMatch(/name:\s*"create_workspace"/);

    const mcp = read("lib/pow-api/mcp-proof-of-work-server.ts");
    expect(mcp).toContain("rejectProgrammaticWorkspaceCreate");
    // create_workspace must hard-fail, not call createAgentWorkspace
    expect(mcp).not.toMatch(/await createAgentWorkspace/);

    // Internal helper may still exist for legacy/demo paths, but public surfaces reject
    const create = read("lib/pow-api/create-agent-workspace.ts");
    expect(create).toContain("assertApiCreateMode");
  });

  it("generate route is mode-aware for blank, template, and files_goal", () => {
    const gen = read("app/api/workspace/generate/route.ts");
    expect(gen).toContain("parseWorkspaceCreateMode");
    expect(gen).toContain("blankWorkspaceCreateOutcome");
    expect(gen).toContain('createMode === "blank"');
    expect(gen).toContain('createMode === "template"');
    expect(gen).toContain('createMode === "files_goal"');
    expect(gen).toContain("composeTemplateCreatePrompt");
    expect(gen).toContain("composeFilesGoalCreatePrompt");
    expect(gen).toContain("composeTemplateWorkspaceNotes");
    // Blank short-circuit: uses pure zero-block outcome
    const blankIdx = gen.indexOf('createMode === "blank"');
    const blankReturn = gen.indexOf("blockCount: blankOutcome.blocks.length");
    expect(blankIdx).toBeGreaterThan(-1);
    expect(blankReturn).toBeGreaterThan(blankIdx);
    // Call sites for template/files_goal composition appear after blank early-return block
    const afterBlank = gen.slice(blankReturn);
    expect(afterBlank).toContain("composeTemplateCreatePrompt(");
    expect(afterBlank).toContain("composeFilesGoalCreatePrompt(");
  });
});
