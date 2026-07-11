"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  Calendar,
  Hammer,
  Loader2,
  Shield,
  Store,
  TrendingUp,
  Trees,
} from "lucide-react";
import type { ProofOfWorkApiDemoDefinition } from "@/lib/openlesson-demo/demo-definition";
import { DemoPerformanceHud } from "@/components/proof-of-work-demo/DemoPerformanceHud";
import { DemoVerificationPills } from "@/components/proof-of-work-demo/DemoVerificationPills";
import { getDemoVerificationPills } from "@/lib/openlesson-demo/verification-pills";
import {
  applyInGameAction,
  CAMPAIGN_PAUSE_ACTIONS,
  countBuildings,
  countExploredPlots,
  createInitialLocalState,
  deriveLocalStateFromWorld,
  getAvailableInGameActions,
  getPlotTile,
  INITIAL_RESOURCES,
  IN_GAME_ACTIONS,
  type GameMenu,
  type GameResources,
  type GameTarget,
  type InGameAction,
  type PlotResource,
  plotDisplayCoords,
  plotKey,
  plotResourceLabel,
  PLOT_COORDS,
  PLOT_COUNT,
  resolveSimulationAction,
} from "@/lib/openlesson-demo/nexusfront-game-model";
import { totalActionCount } from "@/lib/openlesson-demo/simulation";
import type { ConversionGoalSource } from "@/lib/agent-v2/conversion-goal";
import type { PerformanceReport } from "@/lib/agent-v2/performance-context";
import type { SimulationAction, SimulationWorldState } from "@/lib/openlesson-demo/types";

const GRID = {
  spacing: 2.85,
  tileSize: 2.72,
  tileHeight: 0.28,
  platformSize: 20,
  wallRadius: 10.5,
  highlightInner: 1.12,
  highlightOuter: 1.38,
} as const;

const PLOT_SIZE = GRID.spacing;

const ORBIT_TARGET = new THREE.Vector3(0, 0, 0);
const ORBIT_LIMITS = {
  minDistance: 11,
  maxDistance: 34,
  minPitch: 0.25,
  maxPitch: 1.35,
};
const ORBIT_DRAG_THRESHOLD = 4;

const PLOT_COLORS: Record<PlotResource, number> = {
  forest: 0x14532d,
  field: 0x3f6212,
  hill: 0x57534e,
  meadow: 0x4d7c0f,
};

type DecorKind = "trees" | "cottage" | "farm" | "wall" | "rocks" | "meadow";

function surfaceMat(
  color: number,
  opts?: { emissive?: number; emissiveIntensity?: number; roughness?: number }
) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissiveIntensity ?? 0,
    roughness: opts?.roughness ?? 0.82,
  });
}

function tagDecor(group: THREE.Object3D, kind: DecorKind) {
  group.userData.decor = kind;
  group.traverse((child) => {
    child.userData.decor = kind;
    child.raycast = () => {};
  });
  return group;
}

function hasPlotDecor(plot: THREE.Object3D, kind: DecorKind) {
  return plot.children.some((child) => child.userData.decor === kind);
}

type Pickable =
  | { kind: "townhall"; mesh: THREE.Object3D }
  | { kind: "plot"; gx: number; gz: number; mesh: THREE.Mesh };

type OrbitState = {
  yaw: number;
  pitch: number;
  distance: number;
};

type SceneHandle = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  pickables: Pickable[];
  plotHighlights: Map<string, THREE.Mesh>;
  roadLines: THREE.Object3D[];
  wallRing: THREE.Mesh | null;
  milestoneGlow: THREE.PointLight | null;
  orbit: OrbitState;
  frameId: number;
};

function orbitFromPosition(position: THREE.Vector3): OrbitState {
  const offset = position.clone().sub(ORBIT_TARGET);
  const distance = offset.length();
  return {
    yaw: Math.atan2(offset.x, offset.z),
    pitch: Math.asin(THREE.MathUtils.clamp(offset.y / distance, -1, 1)),
    distance,
  };
}

function updateCameraFromOrbit(camera: THREE.PerspectiveCamera, orbit: OrbitState) {
  const horizontal = orbit.distance * Math.cos(orbit.pitch);
  camera.position.set(
    ORBIT_TARGET.x + horizontal * Math.sin(orbit.yaw),
    ORBIT_TARGET.y + orbit.distance * Math.sin(orbit.pitch),
    ORBIT_TARGET.z + horizontal * Math.cos(orbit.yaw)
  );
  camera.lookAt(ORBIT_TARGET);
}

const MENU_META: Array<{ id: GameMenu; label: string; icon: typeof Hammer }> = [
  { id: "build", label: "Build", icon: Hammer },
  { id: "trade", label: "Trade", icon: Store },
  { id: "civic", label: "Civic", icon: Trees },
  { id: "defense", label: "Walls", icon: Shield },
  { id: "season", label: "Season", icon: Calendar },
  { id: "growth", label: "Growth", icon: TrendingUp },
];

function buildTownHall() {
  const hall = new THREE.Group();

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.28, 2.6),
    surfaceMat(0x57534e, { roughness: 0.95 })
  );
  foundation.position.y = 0.14;

  const mainHall = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.15, 1.55), surfaceMat(0xe7e5e4));
  mainHall.position.set(0, 0.88, 0.12);

  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.85, 0.85), surfaceMat(0xd6d3d1));
  tower.position.set(-0.72, 1.22, -0.55);

  const mainRoof = new THREE.Mesh(
    new THREE.ConeGeometry(1.45, 0.85, 4),
    surfaceMat(0x7c3aed, { emissive: 0x5b21b6, emissiveIntensity: 0.28, roughness: 0.55 })
  );
  mainRoof.position.set(0, 1.72, 0.12);
  mainRoof.rotation.y = Math.PI / 4;

  const towerRoof = new THREE.Mesh(
    new THREE.ConeGeometry(0.58, 0.72, 4),
    surfaceMat(0x6d28d9, { emissive: 0x4c1d95, emissiveIntensity: 0.35, roughness: 0.5 })
  );
  towerRoof.position.set(-0.72, 2.32, -0.55);
  towerRoof.rotation.y = Math.PI / 4;

  const steps = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.42), surfaceMat(0xa8a29e));
  steps.position.set(0, 0.22, 1.18);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.72, 0.06),
    surfaceMat(0x44403c, { emissive: 0x1c1917, emissiveIntensity: 0.4 })
  );
  door.position.set(0, 0.72, 0.92);

  const windowMat = surfaceMat(0xfef3c7, { emissive: 0xfbbf24, emissiveIntensity: 0.55 });
  for (const [x, z] of [
    [-0.55, 0.9],
    [0.55, 0.9],
    [0, -0.55],
  ] as const) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.05), windowMat);
    pane.position.set(x, 1.02, z);
    pane.raycast = () => {};
    hall.add(pane);
  }

  for (const x of [-0.95, 0.95]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.05, 8), surfaceMat(0xf5f5f4));
    column.position.set(x, 0.78, 0.92);
    column.raycast = () => {};
    hall.add(column);
  }

  const pickCollider = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 2.6, 2.8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  pickCollider.position.y = 1.2;
  pickCollider.userData = { kind: "townhall" };

  for (const part of [foundation, mainHall, tower, mainRoof, towerRoof, steps, door]) {
    part.raycast = () => {};
  }

  hall.add(foundation, mainHall, tower, mainRoof, towerRoof, steps, door, pickCollider);
  return { group: hall, roof: mainRoof, pickMesh: pickCollider };
}

function addCottage(parent: THREE.Object3D) {
  const cottage = new THREE.Group();

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.16, 1.2),
    surfaceMat(0x78716c, { roughness: 0.95 })
  );
  foundation.position.y = 0.24;

  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.88, 1.0), surfaceMat(0xd6d3d1));
  walls.position.y = 0.76;

  const beamMat = surfaceMat(0x78350f, { roughness: 0.9 });
  for (const x of [-0.52, 0.52]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 1.04), beamMat);
    beam.position.set(x, 0.78, 0);
    cottage.add(beam);
  }

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 0.62, 4),
    surfaceMat(0x991b1b, { emissive: 0x7f1d1d, emissiveIntensity: 0.12, roughness: 0.72 })
  );
  roof.position.y = 1.28;
  roof.rotation.y = Math.PI / 4;

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), surfaceMat(0x57534e));
  chimney.position.set(0.38, 1.45, -0.18);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.48, 0.06),
    surfaceMat(0x44403c, { emissive: 0x292524, emissiveIntensity: 0.35 })
  );
  door.position.set(0, 0.62, 0.54);

  const window = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.22, 0.05),
    surfaceMat(0xfef9c3, { emissive: 0xfde68a, emissiveIntensity: 0.45 })
  );
  window.position.set(-0.28, 0.82, 0.54);

  cottage.add(foundation, walls, roof, chimney, door, window);
  tagDecor(cottage, "cottage");
  parent.add(cottage);
}

function addFarm(parent: THREE.Object3D) {
  const farm = new THREE.Group();
  const cropMat = surfaceMat(0x84cc16, { emissive: 0x365314, emissiveIntensity: 0.22 });

  for (let row = 0; row < 5; row += 1) {
    const rowMesh = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 0.22), cropMat);
    rowMesh.position.set(0, 0.34 + row * 0.03, -0.55 + row * 0.28);
    farm.add(rowMesh);
  }

  const barnBase = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 0.72), surfaceMat(0xb91c1c));
  barnBase.position.set(0.55, 0.58, 0.45);

  const barnRoof = new THREE.Mesh(
    new THREE.ConeGeometry(0.62, 0.38, 4),
    surfaceMat(0xf5f5f4, { roughness: 0.75 })
  );
  barnRoof.position.set(0.55, 1.02, 0.45);
  barnRoof.rotation.y = Math.PI / 4;

  const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.75, 10), surfaceMat(0xe7e5e4));
  silo.position.set(-0.62, 0.62, 0.35);
  const siloCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    surfaceMat(0xd6d3d1)
  );
  siloCap.position.set(-0.62, 1.0, 0.35);

  for (const x of [-1.35, 1.35]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.08), surfaceMat(0xa8a29e));
    post.position.set(x, 0.45, -0.95);
    farm.add(post);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.05, 0.06), surfaceMat(0xa8a29e));
  rail.position.set(0, 0.62, -0.95);

  farm.add(barnBase, barnRoof, silo, siloCap, rail);
  tagDecor(farm, "farm");
  parent.add(farm);
}

function addTrees(parent: THREE.Object3D) {
  const forest = new THREE.Group();
  const placements: Array<[number, number, number]> = [
    [-0.85, -0.55, 0.95],
    [0.15, -0.75, 0.55],
    [0.82, -0.35, -0.35],
    [-0.35, 0.45, -0.82],
    [0.55, 0.65, 0.15],
    [-0.95, 0.25, 0.25],
  ];

  for (const [x, z, scale] of placements) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07 * scale, 0.1 * scale, 0.38 * scale, 6),
      surfaceMat(0x78350f)
    );
    trunk.position.y = 0.42 * scale;
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(0.28 * scale, 0.72 * scale, 7),
      surfaceMat(0x166534, { emissive: 0x14532d, emissiveIntensity: 0.15 })
    );
    crown.position.y = 0.86 * scale;
    const crown2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.2 * scale, 0.45 * scale, 7),
      surfaceMat(0x15803d, { emissive: 0x166534, emissiveIntensity: 0.12 })
    );
    crown2.position.y = 1.12 * scale;
    tree.add(trunk, crown, crown2);
    tree.position.set(x, 0, z);
    forest.add(tree);
  }

  tagDecor(forest, "trees");
  parent.add(forest);
}

function addRocks(parent: THREE.Object3D) {
  const rocks = new THREE.Group();
  const stoneMat = surfaceMat(0x78716c, { roughness: 0.98 });
  for (const [x, z, sx, sy] of [
    [-0.55, -0.35, 0.45, 0.28],
    [0.35, 0.45, 0.55, 0.34],
    [0.75, -0.55, 0.38, 0.22],
  ] as const) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(sx, 0), stoneMat);
    rock.position.set(x, 0.38 + sy * 0.25, z);
    rock.scale.y = sy;
    rocks.add(rock);
  }
  tagDecor(rocks, "rocks");
  parent.add(rocks);
}

function addMeadow(parent: THREE.Object3D) {
  const meadow = new THREE.Group();
  const tuftMat = surfaceMat(0xa3e635, { emissive: 0x4d7c0f, emissiveIntensity: 0.18 });
  for (const [x, z] of [
    [-0.65, -0.45],
    [0.25, -0.65],
    [0.72, 0.35],
    [-0.2, 0.72],
    [0.55, 0.62],
  ]) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 5), tuftMat);
    tuft.position.set(x, 0.4, z);
    meadow.add(tuft);
  }
  tagDecor(meadow, "meadow");
  parent.add(meadow);
}

export function NexusFrontGame({
  demo,
  worldState,
  runningActionId,
  onRunAction,
  report,
  isReporting,
  workspaceConversionGoal,
  conversionGoalSource,
}: {
  demo: ProofOfWorkApiDemoDefinition;
  worldState: SimulationWorldState;
  runningActionId: string | null;
  onRunAction: (action: SimulationAction) => void;
  report: PerformanceReport | null;
  isReporting: boolean;
  proofOfWorkCount?: number;
  workspaceConversionGoal?: string;
  conversionGoalSource?: ConversionGoalSource;
}) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const targetRef = useRef<GameTarget>(null);

  const [target, setTarget] = useState<GameTarget>(null);
  const [openMenu, setOpenMenu] = useState<GameMenu | null>(null);
  const [resources, setResources] = useState<GameResources>(INITIAL_RESOURCES);
  const [localState, setLocalState] = useState(createInitialLocalState);
  const [showIntro, setShowIntro] = useState(true);

  const turnCount = totalActionCount(worldState);
  const busy = runningActionId !== null;

  const contextualActions = useMemo(
    () =>
      getAvailableInGameActions({
        demo,
        worldState,
        local: localState,
        resources,
        target,
        menu: null,
        running: busy,
      }),
    [demo, worldState, localState, resources, target, busy]
  );

  const menuActions = useMemo(() => {
    if (!openMenu || openMenu === "season") return [];
    return getAvailableInGameActions({
      demo,
      worldState,
      local: localState,
      resources,
      target,
      menu: openMenu,
      running: busy,
    });
  }, [demo, worldState, localState, resources, target, openMenu, busy]);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  const applyPlotSelectionVisuals = useCallback((local: typeof localState, nextTarget: GameTarget) => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    for (const [key, ring] of ctx.plotHighlights) {
      const selected = nextTarget?.kind === "plot" && plotKey(nextTarget.gx, nextTarget.gz) === key;
      const mesh = ring.parent as THREE.Mesh | undefined;
      if (!mesh) continue;

      const tile = local.plots[key];
      const ringMat = ring.material as THREE.MeshBasicMaterial;
      ringMat.opacity = selected ? 1 : 0;

      const border = mesh.children.find((child) => child.userData.role === "selection-border") as
        | THREE.Mesh
        | undefined;
      if (border) {
        (border.material as THREE.MeshBasicMaterial).opacity = selected ? 0.9 : 0;
      }

      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (selected) {
        mat.emissive.setHex(0xfbbf24);
        mat.emissiveIntensity = tile?.explored ? 0.52 : 0.38;
        if (!tile?.explored) mat.color.setHex(0x57534e);
      } else if (tile?.explored) {
        mat.color.setHex(PLOT_COLORS[tile.resource]);
        mat.emissive.setHex(tile.strained ? 0x451a03 : PLOT_COLORS[tile.resource]);
        mat.emissiveIntensity = tile.strained ? 0.45 : 0.18;
      } else {
        mat.color.setHex(0x292524);
        mat.emissive.setHex(0x0c0a09);
        mat.emissiveIntensity = 0.15;
      }
    }
  }, []);

  const syncSceneVisuals = useCallback((local: typeof localState) => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    for (const [key, tile] of Object.entries(local.plots)) {
      const highlight = ctx.plotHighlights.get(key);
      if (!highlight) continue;
      const mesh = highlight.parent as THREE.Mesh | null;
      if (!mesh || mesh.children.length < 1) continue;

      const fog = mesh.children.find((child) => child.userData.role === "fog") as THREE.Mesh | undefined;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!fog) continue;

      if (tile.explored) {
        fog.visible = false;
        mat.color.setHex(PLOT_COLORS[tile.resource]);
        mat.emissive.setHex(tile.strained ? 0x451a03 : PLOT_COLORS[tile.resource]);
        mat.emissiveIntensity = tile.strained ? 0.45 : 0.18;

        if (tile.resource === "forest" && !hasPlotDecor(mesh, "trees")) addTrees(mesh);
        if (tile.resource === "hill" && !hasPlotDecor(mesh, "rocks")) addRocks(mesh);
        if (tile.resource === "meadow" && !hasPlotDecor(mesh, "meadow")) addMeadow(mesh);
        if (tile.building && !hasPlotDecor(mesh, "cottage") && !hasPlotDecor(mesh, "farm")) {
          if (tile.resource === "field") addFarm(mesh);
          else addCottage(mesh);
        }
        if (tile.walled && !hasPlotDecor(mesh, "wall")) {
          const wall = new THREE.Mesh(
            new THREE.TorusGeometry(1.42, 0.05, 6, 24),
            surfaceMat(0xd6d3d1, { emissive: 0x57534e, emissiveIntensity: 0.25 })
          );
          wall.rotation.x = Math.PI / 2;
          wall.position.y = GRID.tileHeight * 0.55;
          tagDecor(wall, "wall");
          mesh.add(wall);
        }
      }
    }

    if (local.roadsLaid && ctx.roadLines.length === 0) {
      const hub = new THREE.Vector3(0, 0.2, 0);
      const roadMat = new THREE.MeshStandardMaterial({
        color: 0xa8a29e,
        roughness: 0.95,
        transparent: true,
        opacity: 0.85,
      });
      for (const { gx, gz } of PLOT_COORDS) {
        const tile = local.plots[plotKey(gx, gz)];
        if (!tile?.explored) continue;
        const end = new THREE.Vector3(gx * PLOT_SIZE, 0.2, gz * PLOT_SIZE);
        const mid = hub.clone().lerp(end, 0.5);
        const length = hub.distanceTo(end);
        const road = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, length), roadMat);
        road.position.copy(mid);
        road.rotation.y = Math.atan2(end.x - hub.x, end.z - hub.z);
        road.position.y = 0.2;
        ctx.scene.add(road);
        ctx.roadLines.push(road);
      }
    }

    if (Object.values(local.plots).some((p) => p.walled) && !ctx.wallRing) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(GRID.wallRadius, 0.07, 8, 64),
        surfaceMat(0xe7e5e4, { emissive: 0x78716c, emissiveIntensity: 0.3 })
      );
      (ring.material as THREE.MeshStandardMaterial).transparent = true;
      (ring.material as THREE.MeshStandardMaterial).opacity = 0.9;
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.12;
      ctx.scene.add(ring);
      ctx.wallRing = ring;
    }

    if (local.tradePact && !ctx.milestoneGlow) {
      const glow = new THREE.PointLight(0xfbbf24, 1.4, 18);
      glow.position.set(0, 3.2, 0);
      ctx.scene.add(glow);
      ctx.milestoneGlow = glow;
    }

    applyPlotSelectionVisuals(local, targetRef.current);
  }, [applyPlotSelectionVisuals]);

  useEffect(() => {
    const derived = deriveLocalStateFromWorld(worldState, localState);
    setLocalState(derived);
    syncSceneVisuals(derived);
    if (derived.founded) setShowIntro(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldState]);

  useEffect(() => {
    syncSceneVisuals(localState);
  }, [localState, syncSceneVisuals]);

  useEffect(() => {
    applyPlotSelectionVisuals(localState, target);
  }, [target, localState, applyPlotSelectionVisuals]);

  const fireAction = useCallback(
    (inGame: InGameAction | (typeof CAMPAIGN_PAUSE_ACTIONS)[number], actionTarget: GameTarget) => {
      const simulation = resolveSimulationAction(demo, inGame.simulationId);
      if (!simulation || busy) return;

      onRunAction(simulation);

      const catalog = IN_GAME_ACTIONS.find((a) => a.id === inGame.id);
      if (catalog) {
        const { local, resources: nextResources } = applyInGameAction(
          localState,
          resources,
          catalog,
          actionTarget
        );
        setLocalState(local);
        setResources(nextResources);
        syncSceneVisuals(local);
      }
    },
    [demo, localState, resources, busy, onRunAction, syncSceneVisuals]
  );

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const width = host.clientWidth;
    const height = host.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x1c1917, 1);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1c1917, 0.028);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 140);
    const orbit = orbitFromPosition(new THREE.Vector3(12.5, 15, 12.5));
    updateCameraFromOrbit(camera, orbit);

    scene.add(new THREE.AmbientLight(0xfff7ed, 0.55));
    const sun = new THREE.DirectionalLight(0xfffbeb, 1.15);
    sun.position.set(6, 10, 4);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc4b5fd, 0.35);
    fill.position.set(-5, 4, -6);
    scene.add(fill);

    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID.platformSize + 6, GRID.platformSize + 6),
      surfaceMat(0x1c1917, { roughness: 1 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.06;
    scene.add(grass);

    const cityPad = new THREE.Mesh(
      new THREE.BoxGeometry(GRID.platformSize, 0.14, GRID.platformSize),
      surfaceMat(0x292524, { emissive: 0x1c1917, emissiveIntensity: 0.08, roughness: 0.98 })
    );
    cityPad.position.y = 0.02;
    scene.add(cityPad);

    const hubPlaza = new THREE.Mesh(
      new THREE.CylinderGeometry(2.05, 2.2, 0.08, 32),
      surfaceMat(0x44403c, { emissive: 0x292524, emissiveIntensity: 0.12, roughness: 0.92 })
    );
    hubPlaza.position.y = 0.1;
    scene.add(hubPlaza);

    const { group: townHall, roof: townHallRoof, pickMesh: townHallPick } = buildTownHall();
    scene.add(townHall);

    const pickables: Pickable[] = [{ kind: "townhall", mesh: townHallPick }];
    const plotHighlights = new Map<string, THREE.Mesh>();

    for (const { gx, gz } of PLOT_COORDS) {
      const x = gx * PLOT_SIZE;
      const z = gz * PLOT_SIZE;
      const resource = createInitialLocalState().plots[plotKey(gx, gz)].resource;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(GRID.tileSize, GRID.tileHeight, GRID.tileSize),
        surfaceMat(0x292524, { emissive: 0x0c0a09, emissiveIntensity: 0.15, roughness: 0.9 })
      );
      mesh.position.set(x, 0.16 + GRID.tileHeight / 2, z);
      mesh.userData = { kind: "plot", gx, gz, resource };

      const border = new THREE.Mesh(
        new THREE.BoxGeometry(GRID.tileSize + 0.04, 0.04, GRID.tileSize + 0.04),
        surfaceMat(0x1c1917, { roughness: 1 })
      );
      border.position.y = -GRID.tileHeight / 2 + 0.02;
      border.userData.role = "border";
      border.raycast = () => {};
      mesh.add(border);

      const fog = new THREE.Mesh(
        new THREE.BoxGeometry(GRID.tileSize + 0.06, 0.55, GRID.tileSize + 0.06),
        new THREE.MeshStandardMaterial({
          color: 0x1c1917,
          transparent: true,
          opacity: 0.88,
          roughness: 1,
        })
      );
      fog.position.y = 0.18;
      fog.userData.role = "fog";
      fog.raycast = () => {};
      mesh.add(fog);

      const highlight = new THREE.Mesh(
        new THREE.RingGeometry(GRID.highlightInner, GRID.highlightOuter, 40),
        new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      highlight.rotation.x = -Math.PI / 2;
      highlight.position.y = 0.46;
      highlight.raycast = () => {};
      mesh.add(highlight);

      const selectionBorder = new THREE.Mesh(
        new THREE.BoxGeometry(GRID.tileSize + 0.14, 0.05, GRID.tileSize + 0.14),
        new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
      );
      selectionBorder.position.y = 0.4;
      selectionBorder.userData.role = "selection-border";
      selectionBorder.raycast = () => {};
      mesh.add(selectionBorder);

      scene.add(mesh);
      pickables.push({ kind: "plot", gx, gz, mesh });
      plotHighlights.set(plotKey(gx, gz), highlight);
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let frameId = 0;
    const start = performance.now();

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      const t = (now - start) / 1000;
      townHallRoof.rotation.y = Math.PI / 4 + Math.sin(t * 0.5) * 0.02;
      if (sceneRef.current?.wallRing) sceneRef.current.wallRing.rotation.z = t * 0.15;
      if (sceneRef.current) updateCameraFromOrbit(camera, sceneRef.current.orbit);
      renderer.render(scene, camera);
    };
    frameId = requestAnimationFrame(animate);

    sceneRef.current = {
      renderer,
      scene,
      camera,
      raycaster,
      pointer,
      pickables,
      plotHighlights,
      roadLines: [],
      wallRing: null,
      milestoneGlow: null,
      orbit,
      frameId,
    };

    syncSceneVisuals(deriveLocalStateFromWorld(worldState, createInitialLocalState()));

    const pickAt = (clientX: number, clientY: number) => {
      const ctx = sceneRef.current;
      if (!ctx) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ctx.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ctx.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      ctx.raycaster.setFromCamera(ctx.pointer, ctx.camera);
      const hits = ctx.raycaster.intersectObjects(
        ctx.pickables.map((p) => p.mesh),
        false
      );
      if (hits.length === 0) {
        setTarget(null);
        return;
      }
      const data = hits[0].object.userData as { kind: string; gx?: number; gz?: number };
      if (data.kind === "townhall") {
        setTarget({ kind: "townhall" });
        setOpenMenu(null);
        return;
      }
      if (data.kind === "plot" && typeof data.gx === "number" && typeof data.gz === "number") {
        setTarget({ kind: "plot", gx: data.gx, gz: data.gz });
        setOpenMenu(null);
      }
    };

    let pointerDown = false;
    let didDrag = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointerDown = true;
      didDrag = false;
      lastX = event.clientX;
      lastY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown) return;
      const ctx = sceneRef.current;
      if (!ctx) return;

      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (!didDrag && Math.hypot(dx, dy) < ORBIT_DRAG_THRESHOLD) return;

      didDrag = true;
      renderer.domElement.classList.remove("cursor-grab");
      renderer.domElement.classList.add("cursor-grabbing");

      ctx.orbit.yaw -= dx * 0.005;
      ctx.orbit.pitch = THREE.MathUtils.clamp(
        ctx.orbit.pitch + dy * 0.004,
        ORBIT_LIMITS.minPitch,
        ORBIT_LIMITS.maxPitch
      );
      lastX = event.clientX;
      lastY = event.clientY;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDown) return;
      pointerDown = false;
      renderer.domElement.releasePointerCapture(event.pointerId);
      renderer.domElement.classList.remove("cursor-grabbing");
      renderer.domElement.classList.add("cursor-grab");
      if (!didDrag) pickAt(event.clientX, event.clientY);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const ctx = sceneRef.current;
      if (!ctx) return;
      ctx.orbit.distance = THREE.MathUtils.clamp(
        ctx.orbit.distance + event.deltaY * 0.02,
        ORBIT_LIMITS.minDistance,
        ORBIT_LIMITS.maxDistance
      );
    };

    renderer.domElement.classList.add("cursor-grab");
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const resize = () => {
      const nextW = host.clientWidth;
      const nextH = host.clientHeight;
      if (nextW === 0 || nextH === 0) return;
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(frameId);
      renderer.dispose();
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targetLabel =
    target?.kind === "townhall"
      ? "Town hall"
      : target?.kind === "plot"
        ? (() => {
            const tile = getPlotTile(localState, target.gx, target.gz);
            return tile
              ? `${plotResourceLabel(tile.resource)} plot (${plotDisplayCoords(target.gx, target.gz).col}, ${plotDisplayCoords(target.gx, target.gz).row})`
              : `Plot (${plotDisplayCoords(target.gx, target.gz).col}, ${plotDisplayCoords(target.gx, target.gz).row})`;
          })()
        : "Click a plot or the town hall";

  return (
    <div className="flex w-full min-h-[36rem] flex-col bg-zinc-950 sm:min-h-[42rem] lg:flex-row">
      <div className="relative min-h-[28rem] min-w-0 flex-1 lg:min-h-[36rem]">
        <div ref={canvasHostRef} className="absolute inset-0 min-h-[28rem]" />

        <div className="pointer-events-none absolute left-3 top-3 z-10">
          <div className="pointer-events-auto rounded-lg border border-zinc-800/90 bg-zinc-950/85 px-3 py-2 backdrop-blur-md">
            <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-amber-200/80">Haven Rise</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
              <span className="text-zinc-400">
                W <span className="font-mono text-amber-100">{resources.wood}</span>
              </span>
              <span className="text-zinc-400">
                S <span className="font-mono text-amber-100">{resources.stone}</span>
              </span>
              <span className="text-zinc-400">
                F <span className="font-mono text-amber-100">{resources.food}</span>
              </span>
              <span className="text-zinc-400">
                $ <span className="font-mono text-amber-100">{resources.coin}</span>
              </span>
              <span className="text-zinc-500">
                T{turnCount} · {countExploredPlots(localState)}/{PLOT_COUNT} · {countBuildings(localState)} bld
              </span>
            </div>
            <div className="mt-1 font-mono text-[9px] text-zinc-600">Drag rotate · scroll zoom</div>
            <DemoVerificationPills pills={getDemoVerificationPills(demo)} className="mt-2" />
          </div>
        </div>

      {showIntro && !localState.founded ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/75 backdrop-blur-sm">
          <div className="max-w-md rounded-xl border border-amber-500/20 bg-zinc-950/92 p-8 text-center shadow-2xl shadow-amber-950/30">
            <div className="font-mono text-[10px] uppercase tracking-[2px] text-amber-300/90">City builder</div>
            <h3 className="mt-3 text-xl font-medium text-white">Haven Rise</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Survey plots, gather wood and stone, raise cottages and farms, then open trade routes.
              Every action you take in the city streams evidence automatically.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setTarget({ kind: "townhall" });
                const found = IN_GAME_ACTIONS.find((a) => a.simulationId === "commission_outpost");
                if (found) fireAction(found, { kind: "townhall" });
                setShowIntro(false);
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Found settlement
            </button>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-16 z-10 flex flex-col items-center gap-2 px-4">
        <div className="pointer-events-auto w-full max-w-2xl rounded-lg border border-zinc-800/90 bg-zinc-950/88 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-500">{targetLabel}</span>
            {busy ? (
              <span className="flex items-center gap-1.5 text-[10px] text-amber-200/80">
                <Loader2 className="size-3 animate-spin" />
                Recording action…
              </span>
            ) : null}
          </div>
          {contextualActions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {contextualActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={busy}
                  onClick={() => fireAction(action, target)}
                  className={`rounded-md border px-3 py-2 text-left transition disabled:opacity-45 ${
                    action.risky
                      ? "border-amber-700/50 bg-amber-950/35 hover:border-amber-600"
                      : "border-zinc-700 bg-black/35 hover:border-amber-500/45 hover:bg-amber-950/25"
                  }`}
                >
                  <div className="text-xs font-medium text-white">{action.label}</div>
                  <div className="text-[10px] text-zinc-500">{action.hint}</div>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-zinc-600">
              {localState.founded
                ? "Select a plot to gather or build, or open a menu below."
                : "Click the town hall to found your settlement."}
            </p>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-zinc-800/90 bg-zinc-950/92 backdrop-blur-md">
        <div className="flex items-stretch justify-center gap-1 px-2 py-2">
          {MENU_META.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              disabled={!localState.founded || busy}
              onClick={() => setOpenMenu((prev) => (prev === id ? null : id))}
              className={`flex min-w-[4.5rem] flex-col items-center gap-1 rounded-md px-3 py-2 text-[10px] transition disabled:opacity-40 ${
                openMenu === id
                  ? "bg-amber-600/20 text-amber-100"
                  : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>

        {openMenu ? (
          <div className="border-t border-zinc-800/80 px-4 py-3">
            {openMenu === "season" ? (
              <div className="flex flex-wrap justify-center gap-2">
                {CAMPAIGN_PAUSE_ACTIONS.map((pause) => (
                  <button
                    key={pause.id}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      fireAction(pause, null);
                      setOpenMenu(null);
                    }}
                    className="rounded-md border border-zinc-700 bg-black/30 px-4 py-2 text-xs text-zinc-300 transition hover:border-amber-500/40 hover:text-white disabled:opacity-45"
                  >
                    <div className="font-medium">{pause.label}</div>
                    <div className="text-[10px] text-zinc-500">{pause.hint}</div>
                  </button>
                ))}
              </div>
            ) : menuActions.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                {menuActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      fireAction(action, target);
                      setOpenMenu(null);
                    }}
                    className={`rounded-md border px-4 py-2 text-xs transition disabled:opacity-45 ${
                      action.risky
                        ? "border-amber-700/50 bg-amber-950/35 text-amber-100 hover:border-amber-600"
                        : "border-zinc-700 bg-black/30 text-zinc-300 hover:border-amber-500/40 hover:text-white"
                    }`}
                  >
                    <div className="font-medium">{action.label}</div>
                    <div className="text-[10px] text-zinc-500">{action.hint}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs text-zinc-600">
                Survey more plots or gather resources to unlock these options.
              </p>
            )}
          </div>
        ) : null}
      </div>

      </div>

      <DemoPerformanceHud
        report={report}
        isReporting={isReporting}
        workspaceConversionGoal={workspaceConversionGoal}
        conversionGoalSource={conversionGoalSource}
      />
    </div>
  );
}