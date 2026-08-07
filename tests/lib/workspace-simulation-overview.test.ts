import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSimulationPathFromStart,
  deriveWorkspaceSimulationOverview,
} from "@/lib/workspace-simulation-overview";
import {
  availableWorkspaceSections,
  resolveWorkspaceSectionLayout,
} from "@/lib/workspace-sections";

const SCRATCH =
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-46f9864a291e/implementer";

function read(rel: string) {
  return require("node:fs").readFileSync(
    require("node:path").join(process.cwd(), rel),
    "utf8",
  );
}

describe("deriveWorkspaceSimulationOverview", () => {
  it("empty map: zero counts and author guidance", () => {
    const o = deriveWorkspaceSimulationOverview([]);
    expect(o.blockCount).toBe(0);
    expect(o.startCount).toBe(0);
    expect(o.samplePaths).toEqual([]);
    expect(o.sampleProbes).toEqual([]);
    expect(o.journeySummary.toLowerCase()).toMatch(/no blocks/);
    expect(o.interactionModes.length).toBeGreaterThan(0);
  });

  it("start + locked multi-block path and probes", () => {
    const blocks = [
      {
        id: "s1",
        title: "Intro",
        description: "Meet the team.",
        is_start: true,
        next_block_ids: ["a"],
        lock_until_block_ids: [],
      },
      {
        id: "a",
        title: "Conflict basics",
        description: "Name the tension.",
        is_start: false,
        next_block_ids: ["b"],
        lock_until_block_ids: ["s1"],
      },
      {
        id: "b",
        title: "Facilitate",
        description: "Run a retro.",
        is_start: false,
        next_block_ids: [],
        lock_until_block_ids: ["a"],
        local_context: { notes: "Use open questions." },
      },
    ];
    const o = deriveWorkspaceSimulationOverview(blocks);
    expect(o.blockCount).toBe(3);
    expect(o.startCount).toBe(1);
    expect(o.lockedCount).toBe(2);
    expect(o.withLocalContextCount).toBe(1);
    expect(o.samplePaths.length).toBeGreaterThanOrEqual(1);
    expect(o.samplePaths[0]!.map((s) => s.blockId)).toEqual(["s1", "a", "b"]);
    expect(o.samplePaths[0]![1]!.locked).toBe(true);
    expect(o.sampleProbes.length).toBeGreaterThanOrEqual(1);
    // Q/E empty until xAI regenerate (no pure seed)
    expect(o.sampleProbes[0]!.questions.length).toBe(0);
    expect(o.interactionModes.some((m) => /Explore|Drill|Start/i.test(m))).toBe(
      true,
    );
    expect(o.journeySummary).toMatch(/starter/i);

    const byId = new Map(blocks.map((b) => [b.id, b]));
    const path = buildSimulationPathFromStart("s1", byId);
    expect(path[0]!.isStart).toBe(true);
  });
});

describe("workspace Simulation section helpers + UI structure", () => {
  it("section order Context → Simulation; layout flags; shell wiring", () => {
    const owner = availableWorkspaceSections({ isOwner: true });
    expect(owner.indexOf("simulation")).toBe(owner.indexOf("context") + 1);

    const layout = resolveWorkspaceSectionLayout("simulation");
    expect(layout.mountsSimulationPanel).toBe(true);
    expect(layout.showBlockMapChrome).toBe(false);
    expect(layout.mountsContextPanel).toBe(false);

    const view = read("components/WorkspaceView.tsx");
    const aycl = read("components/AyclWorkspaceView.tsx");
    const panel = read("components/WorkspaceSimulationPanel.tsx");
    const sections = read("lib/workspace-sections.ts");
    const en = read("messages/en.json");

    expect(sections).toContain('"simulation"');
    expect(sections).toContain("mountsSimulationPanel");
    expect(en).toContain("sectionSimulation");
    expect(view).toContain('key: "simulation"');
    expect(view).toContain("sectionSimulation");
    expect(view).toContain("mountsSimulationPanel");
    expect(view).toContain("WorkspaceSimulationPanel");
    expect(view).toContain("data-workspace-simulation-host");
    expect(view).toMatch(/workspaceId=\{workspaceId\}/);
    // AYCL mounts Simulation via WorkspaceView clone
    expect(aycl).toContain("WorkspaceView");
    expect(panel).toContain("data-workspace-simulation-section");
    expect(panel).toContain("data-workspace-simulation-panel");
    // Redo: scope picker + generate + question/exercise surfaces (not validation-only)
    expect(panel).toContain("data-simulation-scope");
    expect(panel).toContain("data-simulation-generate");
    expect(panel).toContain("data-simulation-questions");
    expect(panel).toContain("data-simulation-exercises");
    // Raw xAI generate path only — no pure seed preview on the tab
    expect(panel).not.toContain("deriveSimulationSamples");
    expect(panel).toContain("data-simulation-generate");
    expect(panel).toContain("/api/workspace/simulation-samples");
    expect(panel).toContain("Block Simulation"); // points authors to per-block drawer

    mkdirSync(SCRATCH, { recursive: true });
    const empty = deriveWorkspaceSimulationOverview([]);
    const multi = deriveWorkspaceSimulationOverview([
      {
        id: "s",
        title: "Start",
        is_start: true,
        next_block_ids: ["x"],
      },
      { id: "x", title: "Next", is_start: false, lock_until_block_ids: ["s"] },
    ]);
    writeFileSync(
      join(SCRATCH, "workspace-simulation-section.log"),
      [
        "order_after_context=" +
          String(owner.indexOf("simulation") === owner.indexOf("context") + 1),
        "layout_sim_panel=" + layout.mountsSimulationPanel,
        "layout_no_map=" + !layout.showBlockMapChrome,
        "empty_blocks=" + empty.blockCount,
        "multi_starts=" + multi.startCount,
        "multi_locked=" + multi.lockedCount,
        "multi_path_len=" + (multi.samplePaths[0]?.length || 0),
        "multi_probes=" + multi.sampleProbes.length,
        "viewer_sections=" +
          availableWorkspaceSections({ isOwner: false }).join(","),
      ].join("\n") + "\n",
      "utf8",
    );
    writeFileSync(
      join(SCRATCH, "workspace-simulation-ui.log"),
      [
        "view_nav=" + view.includes('key: "simulation"'),
        "view_mount=" + view.includes("mountsSimulationPanel"),
        "view_panel=" + view.includes("WorkspaceSimulationPanel"),
        "aycl_via_workspace_view=" + aycl.includes("WorkspaceView"),
        "panel_hook=" + panel.includes("data-workspace-simulation-section"),
        "scope_control=" + panel.includes("data-simulation-scope"),
        "generate_control=" + panel.includes("data-simulation-generate"),
        "questions_surface=" + panel.includes("data-simulation-questions"),
        "exercises_surface=" + panel.includes("data-simulation-exercises"),
        "i18n=" + en.includes("sectionSimulation"),
      ].join("\n") + "\n",
      "utf8",
    );
    writeFileSync(
      join(SCRATCH, "simulation-tab-ui.log"),
      [
        "scope_control=" + panel.includes("data-simulation-scope-control"),
        "scope_workspace=" + panel.includes("data-simulation-scope-workspace"),
        "scope_block=" + panel.includes("data-simulation-scope-block"),
        "block_select=" + panel.includes("data-simulation-block-select"),
        "generate=" + panel.includes("data-simulation-generate"),
        "questions=" + panel.includes("data-simulation-questions"),
        "exercises=" + panel.includes("data-simulation-exercises"),
        "api_path=" + panel.includes("/api/workspace/simulation-samples"),
        "shell_mount=" + view.includes("data-workspace-simulation-host"),
        "shell_workspace_id=" + /workspaceId=\{workspaceId\}/.test(view),
        "no_pure_seed_display=" +
          String(!panel.includes("deriveSimulationSamples")),
        "generate_api=" +
          panel.includes("/api/workspace/simulation-samples"),
      ].join("\n") + "\n",
      "utf8",
    );
  });

  it("samples UI: loading skeletons while generating + compact two-column Q/E layout", () => {
    const panel = read("components/WorkspaceSimulationPanel.tsx");

    // 2-col layout wrapper (desktop md:grid-cols-2; stacked on narrow)
    expect(panel).toContain("data-simulation-samples-grid");
    expect(panel).toContain('data-simulation-samples-layout="two-col"');
    expect(panel).toMatch(/grid[\s\S]*md:grid-cols-2/);
    expect(panel).toContain("data-simulation-questions");
    expect(panel).toContain("data-simulation-exercises");

    // Loading effect on questions + exercises surfaces (not button-only)
    expect(panel).toContain("data-simulation-questions-loading");
    expect(panel).toContain("data-simulation-exercises-loading");
    expect(panel).toContain('data-simulation-loading="questions"');
    expect(panel).toContain('data-simulation-loading="exercises"');
    expect(panel).toContain("data-simulation-question-skeleton");
    expect(panel).toContain("data-simulation-exercise-skeleton");
    expect(panel).toContain("animate-pulse");
    // generating state gates the loading UI on both columns
    expect(panel).toMatch(
      /generating\s*\?\s*\([\s\S]*data-simulation-questions-loading[\s\S]*data-simulation-exercises-loading|generating\s*\?\s*\([\s\S]*data-simulation-exercises-loading/,
    );
    expect(panel).toContain('data-simulation-generating={generating ? "true" : "false"}');
    expect(panel).toContain("aria-busy={generating || undefined}");

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "simulation-samples-layout-loading.log"),
      [
        "two_col_grid=" + panel.includes("data-simulation-samples-grid"),
        "two_col_attr=" + panel.includes('data-simulation-samples-layout="two-col"'),
        "md_grid_cols_2=" + /md:grid-cols-2/.test(panel),
        "q_loading=" + panel.includes("data-simulation-questions-loading"),
        "e_loading=" + panel.includes("data-simulation-exercises-loading"),
        "pulse=" + panel.includes("animate-pulse"),
        "generating_attr=" +
          panel.includes('data-simulation-generating={generating ? "true" : "false"}'),
      ].join("\n") + "\n",
      "utf8",
    );
  });
});
