import { getSimulationAction, hasCompletedAction } from "./simulation";
import type { EvidenceApiDemoDefinition } from "./demo-definition";
import type { SimulationAction, SimulationWorldState } from "./types";

export type GameMenu = "build" | "trade" | "civic" | "defense" | "season" | "growth";

export type GameTarget =
  | { kind: "townhall" }
  | { kind: "plot"; gx: number; gz: number }
  | null;

export type PlotResource = "forest" | "field" | "hill" | "meadow";

export type PlotTile = {
  gx: number;
  gz: number;
  explored: boolean;
  gathered: boolean;
  building: boolean;
  walled: boolean;
  strained: boolean;
  resource: PlotResource;
};

export type CityGameLocalState = {
  founded: boolean;
  plots: Record<string, PlotTile>;
  roadsLaid: boolean;
  marketOpen: boolean;
  tradePact: boolean;
  recordsSynced: boolean;
  caravanLost: boolean;
};

/** @deprecated alias for city game state */
export type NexusFrontLocalState = CityGameLocalState;

export type InGameAction = {
  id: string;
  simulationId: string;
  label: string;
  hint: string;
  menu?: GameMenu;
  target?: "townhall" | "plot";
  requiresUnexplored?: boolean;
  requiresExplored?: boolean;
  plotResource?: PlotResource;
  requiresUngathered?: boolean;
  cost?: { wood?: number; stone?: number; food?: number; coin?: number };
  risky?: boolean;
};

export const GRID_DIMENSION = 6;
export const GRID_AXIS_MIN = -3;
export const GRID_AXIS_MAX = 2;

function buildPlotCoords(): Array<{ gx: number; gz: number }> {
  const coords: Array<{ gx: number; gz: number }> = [];
  for (let gx = GRID_AXIS_MIN; gx <= GRID_AXIS_MAX; gx += 1) {
    for (let gz = GRID_AXIS_MIN; gz <= GRID_AXIS_MAX; gz += 1) {
      if (gx === 0 && gz === 0) continue;
      coords.push({ gx, gz });
    }
  }
  return coords;
}

export const PLOT_COORDS = buildPlotCoords();
export const PLOT_COUNT = PLOT_COORDS.length;

/** @deprecated */
export const SECTOR_COORDS = PLOT_COORDS;

export function plotKey(gx: number, gz: number) {
  return `${gx},${gz}`;
}

/** @deprecated */
export const sectorKey = plotKey;

function assignPlotResource(gx: number, gz: number): PlotResource {
  const kinds: PlotResource[] = ["forest", "field", "hill", "meadow"];
  return kinds[Math.abs(gx * 7 + gz * 13) % kinds.length];
}

export function createInitialLocalState(): CityGameLocalState {
  const plots: Record<string, PlotTile> = {};
  for (const { gx, gz } of PLOT_COORDS) {
    plots[plotKey(gx, gz)] = {
      gx,
      gz,
      explored: false,
      gathered: false,
      building: false,
      walled: false,
      strained: false,
      resource: assignPlotResource(gx, gz),
    };
  }
  return {
    founded: false,
    plots,
    roadsLaid: false,
    marketOpen: false,
    tradePact: false,
    recordsSynced: false,
    caravanLost: false,
  };
}

const ACTION_EFFECTS: Partial<
  Record<string, (local: CityGameLocalState, target?: GameTarget) => void>
> = {
  commission_outpost: (local) => {
    local.founded = true;
  },
  deploy_scout_drone: (local, target) => {
    if (target?.kind !== "plot") return;
    const tile = local.plots[plotKey(target.gx, target.gz)];
    if (tile) tile.explored = true;
  },
  calibrate_sensors: (local, target) => {
    if (target?.kind !== "plot") return;
    const tile = local.plots[plotKey(target.gx, target.gz)];
    if (tile) tile.gathered = true;
  },
  expand_supply_depot: (local, target) => {
    if (target?.kind === "plot") {
      const tile = local.plots[plotKey(target.gx, target.gz)];
      if (tile) tile.gathered = true;
    }
  },
  stockpile_reserves: (local, target) => {
    if (target?.kind === "plot") {
      const tile = local.plots[plotKey(target.gx, target.gz)];
      if (tile) tile.gathered = true;
    }
  },
  run_intel_analysis: (local, target) => {
    if (target?.kind === "plot") {
      const tile = local.plots[plotKey(target.gx, target.gz)];
      if (tile) tile.gathered = true;
    }
  },
  establish_beacon: (local, target) => {
    if (target?.kind !== "plot") return;
    const tile = local.plots[plotKey(target.gx, target.gz)];
    if (tile) tile.building = true;
  },
  deploy_relay_satellite: (local, target) => {
    if (target?.kind !== "plot") return;
    const tile = local.plots[plotKey(target.gx, target.gz)];
    if (tile) tile.building = true;
  },
  fortify_perimeter: (local, target) => {
    if (target?.kind === "plot") {
      const tile = local.plots[plotKey(target.gx, target.gz)];
      if (tile) tile.walled = true;
    }
  },
  breach_response_drill: (local) => {
    for (const tile of Object.values(local.plots)) {
      if (tile.explored) tile.walled = true;
    }
  },
  assign_watch_rotation: (local, target) => {
    if (target?.kind !== "plot") return;
    const tile = local.plots[plotKey(target.gx, target.gz)];
    if (!tile) return;
    if (tile.resource === "hill") tile.gathered = true;
    else tile.walled = true;
  },
  misprioritize_sector: (local, target) => {
    if (target?.kind === "plot") {
      const tile = local.plots[plotKey(target.gx, target.gz)];
      if (tile) tile.strained = true;
    }
  },
  correct_sector_priority: (local) => {
    for (const tile of Object.values(local.plots)) {
      tile.strained = false;
    }
  },
  route_energy_grid: (local) => {
    local.roadsLaid = true;
  },
  redeploy_generators: (local) => {
    local.roadsLaid = true;
  },
  open_trade_channel: (local) => {
    local.marketOpen = true;
  },
  negotiate_alliance: (local) => {
    local.tradePact = true;
  },
  veteran_intel_sync: (local) => {
    local.recordsSynced = true;
  },
  misroute_envoy: (local) => {
    local.caravanLost = true;
  },
  recover_envoy_route: (local) => {
    local.caravanLost = false;
  },
};

export const IN_GAME_ACTIONS: InGameAction[] = [
  {
    id: "found_settlement",
    simulationId: "commission_outpost",
    label: "Found settlement",
    hint: "Raise the town hall and begin",
    target: "townhall",
  },
  {
    id: "skip_tutorial",
    simulationId: "skip_veteran_briefing",
    label: "Skip tutorial",
    hint: "Experienced mayor — dive in",
    target: "townhall",
  },
  {
    id: "survey_plot",
    simulationId: "deploy_scout_drone",
    label: "Survey plot",
    hint: "Reveal terrain and resources",
    target: "plot",
    requiresUnexplored: true,
    cost: { food: 8, coin: 2 },
  },
  {
    id: "chop_timber",
    simulationId: "calibrate_sensors",
    label: "Chop timber",
    hint: "Gather wood from forest plot",
    target: "plot",
    requiresExplored: true,
    requiresUngathered: true,
    plotResource: "forest",
    cost: { food: 6 },
  },
  {
    id: "quarry_stone",
    simulationId: "assign_watch_rotation",
    label: "Quarry stone",
    hint: "Mine stone from hill plot",
    target: "plot",
    requiresExplored: true,
    requiresUngathered: true,
    plotResource: "hill",
    cost: { food: 8 },
  },
  {
    id: "harvest_crops",
    simulationId: "expand_supply_depot",
    label: "Harvest crops",
    hint: "Collect food from field plot",
    target: "plot",
    requiresExplored: true,
    requiresUngathered: true,
    plotResource: "field",
    cost: { coin: 1 },
  },
  {
    id: "forage_supplies",
    simulationId: "run_intel_analysis",
    label: "Forage supplies",
    hint: "Scavenge coin and food from meadow",
    target: "plot",
    requiresExplored: true,
    requiresUngathered: true,
    plotResource: "meadow",
    cost: { food: 4 },
  },
  {
    id: "build_cottage",
    simulationId: "establish_beacon",
    label: "Build cottage",
    hint: "Grow population on this plot",
    target: "plot",
    requiresExplored: true,
    cost: { wood: 20, stone: 10 },
  },
  {
    id: "build_farm",
    simulationId: "deploy_relay_satellite",
    label: "Build farm",
    hint: "Steady food production",
    target: "plot",
    requiresExplored: true,
    plotResource: "field",
    cost: { wood: 15, stone: 8, coin: 3 },
  },
  {
    id: "wall_segment",
    simulationId: "fortify_perimeter",
    label: "Wall segment",
    hint: "Protect this district",
    target: "plot",
    requiresExplored: true,
    cost: { stone: 18, wood: 8 },
  },
  {
    id: "overzone_plot",
    simulationId: "misprioritize_sector",
    label: "Overzone district",
    hint: "Risky — drains reserves on weak plot",
    target: "plot",
    requiresExplored: true,
    cost: { wood: 35, stone: 25, food: 20 },
    risky: true,
  },
  {
    id: "lay_roads",
    simulationId: "route_energy_grid",
    label: "Lay roads",
    hint: "Connect plots to the town hall",
    menu: "build",
    cost: { stone: 15, wood: 10 },
  },
  {
    id: "build_granary",
    simulationId: "stockpile_reserves",
    label: "Build granary",
    hint: "City-wide food storage",
    menu: "build",
    cost: { wood: 25, stone: 20 },
  },
  {
    id: "build_mill",
    simulationId: "deploy_relay_satellite",
    label: "Build mill",
    hint: "Process timber into goods",
    menu: "build",
    cost: { wood: 30, stone: 15 },
  },
  {
    id: "rezone_districts",
    simulationId: "redeploy_generators",
    label: "Rezone districts",
    hint: "Shift growth after rebalance",
    menu: "build",
    cost: { coin: 8, food: 10 },
  },
  {
    id: "open_market",
    simulationId: "open_trade_channel",
    label: "Open market",
    hint: "Trade wood and stone for coin",
    menu: "trade",
    cost: { wood: 12, coin: 5 },
  },
  {
    id: "send_caravan",
    simulationId: "dispatch_envoy",
    label: "Send caravan",
    hint: "Trade with neighboring town",
    menu: "trade",
    cost: { food: 12, coin: 4 },
  },
  {
    id: "trade_pact",
    simulationId: "negotiate_alliance",
    label: "Sign trade pact",
    hint: "Steady exchange with allies",
    menu: "trade",
    cost: { coin: 15 },
  },
  {
    id: "lose_caravan",
    simulationId: "misroute_envoy",
    label: "Lose caravan",
    hint: "Risky — bad route through bandits",
    menu: "trade",
    risky: true,
  },
  {
    id: "recover_caravan",
    simulationId: "recover_envoy_route",
    label: "Recover caravan",
    hint: "Find the lost trade route",
    menu: "trade",
  },
  {
    id: "town_census",
    simulationId: "veteran_intel_sync",
    label: "Town census",
    hint: "Assess growth and needs",
    menu: "civic",
    cost: { coin: 6 },
  },
  {
    id: "sync_records",
    simulationId: "calibrate_sensors",
    label: "Sync town records",
    hint: "Align ledgers with regional hub",
    menu: "civic",
    cost: { coin: 10 },
  },
  {
    id: "city_walls",
    simulationId: "breach_response_drill",
    label: "Raise city walls",
    hint: "Fortify the whole settlement",
    menu: "defense",
    cost: { stone: 30, wood: 15 },
  },
  {
    id: "watchtower",
    simulationId: "assign_watch_rotation",
    label: "Build watchtower",
    hint: "Guard a surveyed plot",
    menu: "defense",
    target: "plot",
    requiresExplored: true,
    cost: { wood: 12, stone: 10 },
  },
  {
    id: "rebalance_growth",
    simulationId: "correct_sector_priority",
    label: "Rebalance growth",
    hint: "Recover from overzoning",
    menu: "growth",
  },
  {
    id: "city_milestone",
    simulationId: "complete_objective_alpha",
    label: "Reach city milestone",
    hint: "Capital status — certification goal",
    menu: "growth",
  },
];

export const CAMPAIGN_PAUSE_ACTIONS: Array<{
  id: string;
  simulationId: string;
  label: string;
  hint: string;
}> = [
  { id: "pause_1", simulationId: "wait_1_day", label: "End day", hint: "Short season break" },
  { id: "pause_3", simulationId: "wait_3_days", label: "Skip 3 days", hint: "Weekend away" },
  { id: "pause_7", simulationId: "wait_1_week", label: "Skip 1 week", hint: "Long idle season" },
];

export type GameResources = {
  wood: number;
  stone: number;
  food: number;
  coin: number;
};

export const INITIAL_RESOURCES: GameResources = {
  wood: 45,
  stone: 35,
  food: 70,
  coin: 14,
};

export function deriveLocalStateFromWorld(
  worldState: SimulationWorldState,
  base: CityGameLocalState = createInitialLocalState()
): CityGameLocalState {
  const local = structuredClone(base);
  const completed = new Set([
    ...worldState.completedActions,
    ...Object.keys(worldState.actionCounts),
  ]);

  const surveyCount = worldState.actionCounts.deploy_scout_drone ?? 0;
  if (surveyCount > 0) {
    let explored = 0;
    for (const tile of Object.values(local.plots)) {
      if (explored >= surveyCount) break;
      tile.explored = true;
      explored++;
    }
  }

  for (const id of completed) {
    if (id === "deploy_scout_drone") continue;
    const effect = ACTION_EFFECTS[id];
    if (!effect) continue;
    effect(local, null);
  }

  if (completed.has("commission_outpost")) local.founded = true;
  if (completed.has("route_energy_grid") || completed.has("redeploy_generators")) {
    local.roadsLaid = true;
  }
  if (completed.has("open_trade_channel")) local.marketOpen = true;
  if (completed.has("negotiate_alliance")) local.tradePact = true;
  if (completed.has("veteran_intel_sync")) local.recordsSynced = true;
  if (completed.has("misroute_envoy")) local.caravanLost = true;
  if (completed.has("recover_envoy_route")) local.caravanLost = false;

  const buildingTarget =
    (worldState.actionCounts.establish_beacon ?? 0) +
    (worldState.actionCounts.deploy_relay_satellite ?? 0);
  let buildingCount = 0;
  for (const tile of Object.values(local.plots)) {
    if (buildingCount >= buildingTarget) break;
    if (tile.explored) {
      tile.building = true;
      buildingCount++;
    }
  }

  return local;
}

function canAfford(resources: GameResources, cost?: InGameAction["cost"]) {
  if (!cost) return true;
  if ((cost.wood ?? 0) > resources.wood) return false;
  if ((cost.stone ?? 0) > resources.stone) return false;
  if ((cost.food ?? 0) > resources.food) return false;
  if ((cost.coin ?? 0) > resources.coin) return false;
  return true;
}

function applyCost(resources: GameResources, cost?: InGameAction["cost"]): GameResources {
  if (!cost) return resources;
  return {
    wood: resources.wood - (cost.wood ?? 0),
    stone: resources.stone - (cost.stone ?? 0),
    food: resources.food - (cost.food ?? 0),
    coin: resources.coin - (cost.coin ?? 0),
  };
}

function grantRewards(
  resources: GameResources,
  actionId: string,
  plotResource?: PlotResource
): GameResources {
  const next = { ...resources };
  if (actionId === "deploy_scout_drone") next.coin += 3;
  if (actionId === "calibrate_sensors") next.wood += 28;
  if (actionId === "assign_watch_rotation" && plotResource === "hill") next.stone += 22;
  if (actionId === "expand_supply_depot" && plotResource === "field") next.food += 35;
  if (actionId === "stockpile_reserves" && !plotResource) next.food += 35;
  if (actionId === "run_intel_analysis" && plotResource === "meadow") {
    next.food += 12;
    next.coin += 8;
  }
  if (actionId === "establish_beacon") {
    next.coin += 6;
    next.food += 8;
  }
  if (actionId === "deploy_relay_satellite" && !plotResource) next.food += 20;
  if (actionId === "open_trade_channel") {
    next.coin += 18;
    next.wood += 10;
  }
  if (actionId === "stockpile_reserves" && !plotResource) {
    next.food += 25;
  }
  return next;
}

export function getPlotTile(local: CityGameLocalState, gx: number, gz: number) {
  return local.plots[plotKey(gx, gz)];
}

export function plotResourceLabel(resource: PlotResource) {
  switch (resource) {
    case "forest":
      return "Forest";
    case "field":
      return "Farmland";
    case "hill":
      return "Quarry hill";
    default:
      return "Meadow";
  }
}

export function plotDisplayCoords(gx: number, gz: number) {
  return {
    col: gx - GRID_AXIS_MIN + 1,
    row: gz - GRID_AXIS_MIN + 1,
  };
}

export function isSimulationActionDone(
  demo: EvidenceApiDemoDefinition,
  worldState: SimulationWorldState,
  simulationId: string
) {
  const action = getSimulationAction(demo, simulationId);
  if (!action) return true;
  if (action.repeatable || action.kind === "time_simulation") return false;
  return hasCompletedAction(worldState, simulationId);
}

export function getAvailableInGameActions(options: {
  demo: EvidenceApiDemoDefinition;
  worldState: SimulationWorldState;
  local: CityGameLocalState;
  resources: GameResources;
  target: GameTarget;
  menu: GameMenu | null;
  running: boolean;
}): InGameAction[] {
  const { demo, worldState, local, resources, target, menu, running } = options;
  if (running) return [];

  return IN_GAME_ACTIONS.filter((action) => {
    if (menu && action.menu !== menu) return false;
    if (!menu && action.menu) return false;

    if (isSimulationActionDone(demo, worldState, action.simulationId)) return false;

    if (action.simulationId === "recover_envoy_route" && !local.caravanLost) return false;
    if (action.simulationId === "redeploy_generators") {
      const rebalanced = hasCompletedAction(worldState, "correct_sector_priority");
      const misallocated = hasCompletedAction(worldState, "misprioritize_sector");
      if (!rebalanced && !misallocated) return false;
    }
    if (
      action.simulationId === "negotiate_alliance" &&
      !local.marketOpen &&
      !hasCompletedAction(worldState, "dispatch_envoy")
    ) {
      return false;
    }
    if (action.simulationId === "complete_objective_alpha") {
      const buildings = Object.values(local.plots).filter((p) => p.building).length;
      if (!local.founded || buildings < 2 || !local.roadsLaid) return false;
      if (!local.marketOpen && !local.tradePact) return false;
    }

    if (!local.founded && action.simulationId !== "commission_outpost") return false;

    if (action.target === "townhall") {
      if (target?.kind !== "townhall") return false;
    }
    if (action.target === "plot") {
      if (target?.kind !== "plot") return false;
      const tile = getPlotTile(local, target.gx, target.gz);
      if (!tile) return false;
      if (action.requiresUnexplored && tile.explored) return false;
      if (action.requiresExplored && !tile.explored) return false;
      if (action.requiresUngathered && tile.gathered) return false;
      if (action.plotResource && tile.resource !== action.plotResource) return false;
      if (action.simulationId === "establish_beacon" && tile.building) return false;
      if (action.simulationId === "deploy_relay_satellite" && tile.building && action.menu !== "build") {
        return false;
      }
      if (action.simulationId === "fortify_perimeter" && tile.walled) return false;
    }

    if (action.simulationId === "calibrate_sensors" && action.menu) {
      if (action.id !== "sync_records") return false;
    }
    if (action.simulationId === "calibrate_sensors" && action.target === "plot" && action.id !== "chop_timber") {
      return false;
    }
    if (action.simulationId === "assign_watch_rotation") {
      if (action.id === "watchtower" && target?.kind !== "plot") return false;
      if (action.id === "quarry_stone" && action.plotResource !== "hill") return false;
      if (action.id === "watchtower" && action.plotResource) return false;
    }
    if (action.simulationId === "expand_supply_depot" && action.target !== "plot") return false;
    if (action.simulationId === "stockpile_reserves" && action.target === "plot") return false;
    if (action.simulationId === "veteran_intel_sync" && action.id !== "town_census") return false;
    if (action.simulationId === "run_intel_analysis" && action.target !== "plot") return false;
    if (action.simulationId === "deploy_relay_satellite" && action.target === "plot" && action.id !== "build_farm") {
      return false;
    }
    if (action.simulationId === "deploy_relay_satellite" && action.menu === "build" && action.id !== "build_mill") {
      return false;
    }
    if (action.simulationId === "establish_beacon" && action.id !== "build_cottage") return false;

    if (!canAfford(resources, action.cost)) return false;
    return true;
  });
}

export function resolveSimulationAction(
  demo: EvidenceApiDemoDefinition,
  simulationId: string
): SimulationAction | undefined {
  return getSimulationAction(demo, simulationId);
}

export function applyInGameAction(
  local: CityGameLocalState,
  resources: GameResources,
  inGame: InGameAction,
  target: GameTarget
): { local: CityGameLocalState; resources: GameResources } {
  const nextLocal = structuredClone(local);
  const effect = ACTION_EFFECTS[inGame.simulationId];
  if (effect) effect(nextLocal, target);

  let nextResources = applyCost(resources, inGame.cost);
  const plotRes =
    target?.kind === "plot" ? nextLocal.plots[plotKey(target.gx, target.gz)]?.resource : undefined;
  nextResources = grantRewards(nextResources, inGame.simulationId, plotRes);
  return { local: nextLocal, resources: nextResources };
}

export function countExploredPlots(local: CityGameLocalState) {
  return Object.values(local.plots).filter((p) => p.explored).length;
}

export function countBuildings(local: CityGameLocalState) {
  return Object.values(local.plots).filter((p) => p.building).length;
}

/** @deprecated */
export const countRevealedSectors = countExploredPlots;
/** @deprecated */
export const countBeacons = countBuildings;