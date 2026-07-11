import { describe, expect, it } from "vitest";
import { nexusfrontDemo } from "@/lib/openlesson-demo/demos/nexusfront";
import {
  createInitialLocalState,
  getAvailableInGameActions,
  GRID_DIMENSION,
  INITIAL_RESOURCES,
  isSimulationActionDone,
  PLOT_COUNT,
  plotDisplayCoords,
} from "@/lib/openlesson-demo/nexusfront-game-model";
import { createInitialWorldState } from "@/lib/openlesson-demo/simulation";

describe("haven rise city game model", () => {
  it("uses a 6x6 plot grid with the town hall at the center", () => {
    const local = createInitialLocalState();
    expect(PLOT_COUNT).toBe(GRID_DIMENSION * GRID_DIMENSION - 1);
    expect(Object.keys(local.plots)).toHaveLength(PLOT_COUNT);
    expect(local.plots["0,0"]).toBeUndefined();
    expect(plotDisplayCoords(-3, -3)).toEqual({ col: 1, row: 1 });
    expect(plotDisplayCoords(2, 2)).toEqual({ col: 6, row: 6 });
  });

  it("starts with founding as the only town hall action", () => {
    const local = createInitialLocalState();
    const actions = getAvailableInGameActions({
      demo: nexusfrontDemo,
      worldState: createInitialWorldState(),
      local,
      resources: INITIAL_RESOURCES,
      target: { kind: "townhall" },
      menu: null,
      running: false,
    });

    expect(actions.map((a) => a.simulationId)).toContain("commission_outpost");
    expect(actions.map((a) => a.simulationId)).not.toContain("deploy_scout_drone");
  });

  it("unlocks plot survey after founding", () => {
    const local = createInitialLocalState();
    local.founded = true;
    const world = {
      ...createInitialWorldState(),
      completedActions: ["commission_outpost"],
      actionCounts: { commission_outpost: 1 },
    };

    const actions = getAvailableInGameActions({
      demo: nexusfrontDemo,
      worldState: world,
      local,
      resources: INITIAL_RESOURCES,
      target: { kind: "plot", gx: 0, gz: -1 },
      menu: null,
      running: false,
    });

    expect(actions.map((a) => a.simulationId)).toContain("deploy_scout_drone");
  });

  it("offers timber chop on surveyed forest plots", () => {
    const local = createInitialLocalState();
    local.founded = true;
    const plot = local.plots["0,-1"];
    plot.explored = true;
    plot.resource = "forest";

    const world = {
      ...createInitialWorldState(),
      completedActions: ["commission_outpost"],
      actionCounts: { commission_outpost: 1 },
    };

    const actions = getAvailableInGameActions({
      demo: nexusfrontDemo,
      worldState: world,
      local,
      resources: INITIAL_RESOURCES,
      target: { kind: "plot", gx: 0, gz: -1 },
      menu: null,
      running: false,
    });

    expect(actions.map((a) => a.id)).toContain("chop_timber");
  });

  it("exposes build menu after founding", () => {
    const local = createInitialLocalState();
    local.founded = true;
    const world = {
      ...createInitialWorldState(),
      completedActions: ["commission_outpost"],
      actionCounts: { commission_outpost: 1 },
    };

    const actions = getAvailableInGameActions({
      demo: nexusfrontDemo,
      worldState: world,
      local,
      resources: INITIAL_RESOURCES,
      target: null,
      menu: "build",
      running: false,
    });

    expect(actions.map((a) => a.simulationId)).toContain("route_energy_grid");
    expect(isSimulationActionDone(nexusfrontDemo, world, "commission_outpost")).toBe(true);
  });
});