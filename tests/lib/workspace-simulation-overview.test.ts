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
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-d1253e1103eb/implementer";

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
    expect(o.sampleProbes[0]!.questions.length).toBeGreaterThan(0);
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
    expect(aycl).toContain('key: "simulation"');
    expect(aycl).toContain("WorkspaceSimulationPanel");
    expect(panel).toContain("data-workspace-simulation-section");
    expect(panel).toContain("data-workspace-simulation-panel");
    expect(panel).toContain("deriveWorkspaceSimulationOverview");
    // Workspace tab (not the per-block drawer chrome)
    expect(panel).toContain("data-workspace-simulation-section");
    expect(panel).toContain("author preview");
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
        "aycl_nav=" + aycl.includes('key: "simulation"'),
        "panel_hook=" + panel.includes("data-workspace-simulation-section"),
        "i18n=" + en.includes("sectionSimulation"),
      ].join("\n") + "\n",
      "utf8",
    );
  });
});
