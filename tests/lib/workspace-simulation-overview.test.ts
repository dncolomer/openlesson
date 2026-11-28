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
import { tmpdir } from "node:os";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-a7ffc08ac118/implementer");

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
    expect(existsSync(join(process.cwd(), "components/WorkspaceBlockDetailPane.tsx"))).toBe(false);
    expect(existsSync(join(process.cwd(), "components/workspace-view/workspace-section-hosts.tsx"))).toBe(
      false,
    );

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
  });

  it("workspace section, block drawer, and multi-block drawer have no Simulate Insights runner", () => {
    expect(existsSync(join(process.cwd(), "components/SimulateInsightsSurface.tsx"))).toBe(false);
    expect(existsSync(join(process.cwd(), "app/api/workspace/simulate-insights/route.ts"))).toBe(
      false,
    );
    expect(availableWorkspaceSections({ isOwner: true })).not.toContain("simulation");

    mkdirSync(SCRATCH, { recursive: true });
    const uiLog = join(SCRATCH, "simulate-insights-ui.log");
    const uiPrev = existsSync(uiLog) ? readFileSync(uiLog, "utf8") : "";
    writeFileSync(
      uiLog,
      uiPrev +
        [
          "section=Simulate Insights unmounted",
        ].join("\n") +
        "\n",
      "utf8",
    );
  });
});
