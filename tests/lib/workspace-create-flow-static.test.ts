import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("workspace create + builder static wiring", () => {
  it("workspace new UI has blank + template cards, AYCL banner, and no Login control", () => {
    const page = read("app/workspace/new/page.tsx");
    expect(page).toContain("UI_WORKSPACE_CREATE_MODES");
    expect(page).toContain("isUiWorkspaceCreateMode");
    expect(page).toContain("Blank");
    expect(page).toContain("From Template");
    expect(page).toContain("Knowledge Region");
    expect(page).not.toContain("From Files + Goal");
    expect(page).not.toContain("files_goal");
    expect(page).not.toContain("handleCreateFilesGoal");
    expect(page).toContain("data-create-mode-cards");
    expect(page).toContain("data-aycl-banner");
    expect(page).toContain("/all-you-can-learn");
    expect(page).toContain("md:grid-cols-3");
    expect(page).toContain('data-create-layout="3-plus-1"');
    expect(page).toContain('data-create-mode-span="knowledge_region"');
    expect(page).toContain('data-create-mode="aycl"');
    expect(page).toContain("data-create-mode={card.mode}");
    expect(page).toContain('data-create-mode="knowledge_region"');
    expect(page).not.toContain("xl:grid-cols-4");
    expect(page).toContain("All You Can Learn");
    // Login control removed from header (auth redirect on submit remains)
    expect(page).not.toMatch(/href=["']\/login["']/);
    expect(page).toMatch(/Login removed from workspace new screen/);
    expect(page).toContain("createMode: \"blank\"");
    expect(page).toContain("createMode: \"template\"");
    expect(page).toContain("createMode: \"knowledge_region\"");
  });

  it("blank and template keep creating overlay through workspace redirect", () => {
    const page = read("app/workspace/new/page.tsx");
    expect(page).toContain("resolveWorkspaceCreateOverlay");
    expect(page).toContain("LoadingStatusMessage");
    expect(page).toContain("Creating workspace");
    expect(page).toContain("router.push(`/workspace/${payload.workspaceId}`)");
    expect(page).not.toMatch(/finally\s*\{\s*setBusy\(false\)\s*\}/);
    const blankFn = page.slice(
      page.indexOf("async function handleCreateBlank"),
      page.indexOf("async function handleCreateTemplate"),
    );
    const templateFn = page.slice(page.indexOf("async function handleCreateTemplate"));
    expect(blankFn).toContain("succeeded = true");
    expect(blankFn).toContain(
      "setBusy(resolveWorkspaceCreateOverlay({ succeeded }).busy)",
    );
    expect(blankFn.indexOf("router.push")).toBeGreaterThan(-1);
    expect(blankFn.indexOf("succeeded = true")).toBeGreaterThan(
      blankFn.indexOf("router.push"),
    );
    expect(templateFn).toContain("succeeded = true");
    expect(templateFn).toContain(
      "setBusy(resolveWorkspaceCreateOverlay({ succeeded }).busy)",
    );
    expect(templateFn.indexOf("router.push")).toBeGreaterThan(-1);
    expect(templateFn.indexOf("succeeded = true")).toBeGreaterThan(
      templateFn.indexOf("router.push"),
    );

    const wiringScratch =
      process.env.GROK_GOAL_SCRATCH ||
      "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-1caf392ccbf2/implementer";
    fs.mkdirSync(wiringScratch, { recursive: true });
    fs.writeFileSync(
      path.join(wiringScratch, "workspace-create-redirect-wiring.log"),
      [
        "uses_overlay_helper=" + page.includes("resolveWorkspaceCreateOverlay"),
        "blank_push=" + blankFn.includes("router.push(`/workspace/${payload.workspaceId}`)"),
        "template_push=" +
          templateFn.includes("router.push(`/workspace/${payload.workspaceId}`)"),
        "no_unconditional_finally_clear=" +
          String(!/finally\s*\{\s*setBusy\(false\)\s*\}/.test(page)),
        "overlay_copy=" + page.includes("Creating workspace"),
      ].join("\n") + "\n",
      "utf8",
    );
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

    // Workspace-scoped list UI; not Performance chat
    const insightsTab = read("components/InsightsDashboardTab.tsx");
    expect(insightsTab).toContain("export function InsightsDashboardTab");
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
    const gridOps = read("lib/workspace-grid-ops/generate_shape.ts");
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
    const grid = readMapGridSurface();
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

  it("multi-select grid ops are exposed (merge, split, move op, generate_shape)", () => {
    const grid = readMapGridSurface();
    expect(grid).toContain("generate_shape");
    expect(grid).toContain("merge");
    expect(grid).toContain("split");
    // Move is a grid op from click-and-drag (not a strip tool)
    expect(grid).toContain('op: "move"');
    expect(grid).toContain("selectedEmptyCells");
    expect(grid).toContain("selectedBlockIds");
    const dispatch = read("lib/workspace-grid-ops/dispatch.ts");
    expect(dispatch).toContain("handle_merge");
    expect(dispatch).toContain("handle_split");
    expect(dispatch).toContain("handle_move");
    expect(dispatch).toContain("handle_generate_shape");
    expect(read("lib/workspace-grid-ops/merge.ts")).toContain("composeMergeBlockUserPrompt");
    expect(read("lib/workspace-grid-ops/split.ts")).toContain("composeSplitBlockUserPrompt");
    expect(read("lib/workspace-grid-ops/generate_shape.ts")).toContain(
      "composeGenerateShapeBlockUserPrompt",
    );
    expect(read("lib/workspace-grid-ops/shared.ts")).toContain("block-footprint-prompt");
  });

  it("block map exposes a full-height icon tool column with Select + Lasso and wired grid ops", () => {
    const grid = readMapGridSurface();
    expect(grid).toContain("data-block-map-tool-strip");
    expect(grid).toContain("h-full w-11 shrink-0 flex-col");
    expect(grid).toContain("border-r border-neutral-800");
    expect(grid).not.toMatch(/data-block-map-tool-strip[\s\S]{0,120}absolute left-2 top-2/);
    expect(grid).toContain("MapToolStripButton");
    const strip = read("components/block-skill-grid/map-tool-strip-button.tsx");
    expect(strip).toContain("data-block-map-tool={tool}");
    expect(grid).toContain("activeTool");
    expect(grid).toContain("DEFAULT_BLOCK_MAP_MODE");
    expect(grid).toContain("nextActiveModeTool");
    expect(grid).toContain("isBlockMapToolEnabled");
    expect(grid).toContain("handleToolClick");
    expect(grid).toContain("toggleOrReplaceBlockSelection");
    expect(grid).toContain("applyBlockSelection");
    expect(grid).toContain("setSelectedBlockIds");
    expect(grid).toContain('"select"');
    expect(grid).toMatch(/aria-pressed/);
    expect(grid).toMatch(/title=\{title\}/);
    expect(grid).toContain('op: "split"');
    expect(grid).toContain('op: "move"');
    expect(grid).toContain("setMergePromptOpen(true)");
    expect(grid).toContain("setShapePromptOpen(true)");
    // Select click-and-drag (Move demoted from strip)
    expect(grid).toContain("allowsBlockDragInMode");
    expect(grid).toContain("isMapPanGesture");
    expect(grid).toContain("data-lasso-shape-submenu");
    expect(grid).toContain("isBlockMapManipulationMode");
    expect(grid).toContain("handleBlockPointerDown");
    expect(grid).toContain("data-block-map-draggable");
    expect(grid).toContain("onMapSelectionChange(selection)");
    expect(grid).toContain("handleBlockDoubleClick");
    expect(grid).not.toContain("data-block-map-move");
    expect(grid).not.toContain("showMovePad");
    expect(grid).not.toContain("multiToolbarVisible");
    const tools = read("lib/block-map-tools.ts");
    expect(tools).toContain("DEFAULT_BLOCK_MAP_MODE");
    expect(tools).toContain('"select"');
    expect(tools).toContain("isBlockMapToolEnabled");
    expect(tools).toContain("resolveBlockSelectionOnClick");
    expect(tools).toContain("blockDragMoveDelta");
    expect(tools).toContain("isBlockMapManipulationMode");
    expect(tools).toContain("allowsBlockDragInMode");
    // Strip contents: select + lasso only as modes (parse the array literal)
    const stripMatch = tools.match(
      /export const BLOCK_MAP_TOOL_STRIP[^=]*=\s*\[([\s\S]*?)\]\s*as const/,
    );
    expect(stripMatch).toBeTruthy();
    const stripBody = stripMatch![1];
    expect(stripBody).toContain('"select"');
    expect(stripBody).toContain('"lasso"');
    expect(stripBody).not.toContain('"move"');
    expect(stripBody).not.toContain('"lasso_circle"');
    expect(stripBody).not.toContain('"lasso_freehand"');
  });

  it("programmatic API/MCP create is disabled; UI generate remains", () => {
    const route = read("app/api/v3/pow/workspaces/route.ts");
    expect(route).not.toContain("createAgentWorkspace");
    expect(route).toContain("WORKSPACE_CREATE_UI_ONLY_MESSAGE");

    const catalog = read("lib/pow-api/mcp-proof-of-work-catalog.ts");
    expect(catalog).not.toMatch(/name:\s*"create_workspace"/);

    const mcp = read("lib/pow-api/mcp-tools/dispatch.ts");
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
    expect(gen).toContain('createMode === "knowledge_region"');
    expect(gen).toContain('createMode === "template"');
    expect(gen).toContain('createMode === "files_goal"');
    expect(gen).toContain("knowledgeRegionWorkspaceCreateOutcome");
    expect(gen).toContain('workspace_kind: krOutcome.workspaceKind');
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
