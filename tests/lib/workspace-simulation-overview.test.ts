import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-a7ffc08ac118/implementer";

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
    expect(owner).not.toContain("simulation");
    expect(resolveWorkspaceSectionLayout("simulation").mountsSimulationPanel).toBe(false);

    const view = readWorkspaceViewSurface();
    const aycl = read("components/AyclWorkspaceView.tsx");
    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    const sections = read("lib/workspace-sections.ts");

    expect(view).not.toContain("WorkspaceSimulationPanel");
    expect(view).not.toContain("data-workspace-simulation-host");
    expect(aycl).toContain("WorkspaceView");
    expect(detail).toContain('title="Simulate Insights"');
    expect(detail).toContain("WorkspaceBlockSimulationPanel");

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
        "workspace_section_absent=" + String(!owner.includes("simulation")),
        "layout_sim_panel=false",
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
        "view_panel=" + view.includes("WorkspaceSimulationPanel"),
        "aycl_via_workspace_view=" + aycl.includes("WorkspaceView"),
        "block_drawer=" + detail.includes('title="Simulate Insights"'),
      ].join("\n") + "\n",
      "utf8",
    );
    writeFileSync(
      join(SCRATCH, "simulation-tab-ui.log"),
      [
        "workspace_host=" + view.includes("data-workspace-simulation-host"),
        "workspace_panel=" + view.includes("WorkspaceSimulationPanel"),
        "multi_block_drawer=" +
          read("components/WorkspaceCombineBlocksPane.tsx").includes(
            "WorkspaceMultiBlockSimulationPanel",
          ),
      ].join("\n") + "\n",
      "utf8",
    );
  });

  it("workspace section, block drawer, and multi-block drawer are Simulate Insights", () => {
    const surface = read("components/SimulateInsightsSurface.tsx");
    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    const combine = read("components/WorkspaceCombineBlocksPane.tsx");
    const route = read("app/api/workspace/simulate-insights/route.ts");
    const hosts = read("components/workspace-view/workspace-section-hosts.tsx");

    expect(hosts).not.toContain("WorkspaceSimulationPanel");
    expect(availableWorkspaceSections({ isOwner: true })).not.toContain("simulation");
    expect(detail).toContain('title="Simulate Insights"');
    expect(combine).toContain('title="Simulate Insights"');
    expect(route).toContain("Simulate Insights runs on a block");
    expect(surface).toContain("data-simulate-insights-keep");
    expect(surface).toContain("data-simulate-insights-start");
    expect(surface).toContain("/api/workspace/simulate-insights");
    expect(surface).not.toContain("data-simulation-questions");
    expect(surface).not.toContain("data-simulation-exercises");
    const post = route.slice(route.indexOf("export async function POST"), route.indexOf("export async function GET"));
    expect(post).toContain("runSimulateInsightsJob");
    expect(post).toContain("after(");
    expect(post).not.toContain("callXaiJSON");
    expect(route).toContain("readableSimulateInsights");

    mkdirSync(SCRATCH, { recursive: true });
    const uiLog = join(SCRATCH, "simulate-insights-ui.log");
    const uiPrev = existsSync(uiLog) ? readFileSync(uiLog, "utf8") : "";
    writeFileSync(
      uiLog,
      uiPrev +
        [
          "section=Simulate Insights",
          "block_drawer=" + detail.includes('title="Simulate Insights"'),
          "multi_drawer=" + combine.includes('title="Simulate Insights"'),
          "keep=" + surface.includes("data-simulate-insights-keep"),
          "job_runner=" + route.includes("runSimulateInsightsJob"),
          "question_list=" + surface.includes("data-simulation-questions"),
          "exercise_list=" + surface.includes("data-simulation-exercises"),
        ].join("\n") +
        "\n",
      "utf8",
    );
  });
});
