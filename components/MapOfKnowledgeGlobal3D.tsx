"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  MAP_INFINITE_GRID,
  buildGlobalMapModel,
  formatGlobalMapDistance,
  globalMapRegionSummary,
  layoutGlobalMapNodes3D,
  type GlobalMapRegionSummary,
  type MapRegion,
  type MapUserLocation,
} from "@/lib/map-of-knowledge";

export type MapOfKnowledgeGlobal3DProps = {
  userLocations: MapUserLocation[];
  regions: MapRegion[];
  className?: string;
  fill?: boolean;
  selectedRegionId?: string | null;
  onSelectRegion?: (summary: GlobalMapRegionSummary | null) => void;
  onOpenLocalMap?: (regionId: string) => void;
  openLocalLabel?: string;
  projectionAlgorithm?: string;
};

function makeCountSprite(label: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(8, 8, 80, 32);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 80, 32);
    ctx.fillStyle = "#f4f4f5";
    ctx.font = "bold 18px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label.slice(0, 4), 48, 24);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.55, 0.28, 1);
  return sprite;
}

function makeNameSprite(name: string): THREE.Sprite {
  const text = (name || "Region").slice(0, 28);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(9,9,11,0.75)";
    ctx.fillRect(0, 8, 256, 32);
    ctx.fillStyle = "#e4e4e7";
    ctx.font = "14px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 24);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.4, 0.28, 1);
  return sprite;
}

/**
 * Global Map 3D: multi-algo region graph in true x,y,z with dual membership orbits.
 * Shared by Map of Knowledge and workspace Knowledge (same component).
 */
export function MapOfKnowledgeGlobal3D({
  userLocations,
  regions,
  className = "",
  fill = false,
  selectedRegionId: controlledSelectedId,
  onSelectRegion,
  onOpenLocalMap,
  openLocalLabel = "Open Local Map",
  projectionAlgorithm = "pca",
}: MapOfKnowledgeGlobal3DProps) {
  const [uncontrolledSelectedId, setUncontrolledSelectedId] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const selectedRegionId =
    controlledSelectedId !== undefined ? controlledSelectedId : uncontrolledSelectedId;

  const model = useMemo(
    () => buildGlobalMapModel(regions, userLocations),
    [regions, userLocations],
  );
  const layout3d = useMemo(() => layoutGlobalMapNodes3D(model.nodes), [model.nodes]);

  const selectedNode = useMemo(
    () => layout3d.nodes.find((n) => n.id === selectedRegionId) ?? null,
    [layout3d.nodes, selectedRegionId],
  );
  const selectedSummary = useMemo(
    () => globalMapRegionSummary(selectedNode),
    [selectedNode],
  );

  const selectById = (id: string | null) => {
    if (controlledSelectedId === undefined) setUncontrolledSelectedId(id);
    if (!id) {
      onSelectRegion?.(null);
      return;
    }
    const node = layout3d.nodes.find((n) => n.id === id) ?? null;
    onSelectRegion?.(globalMapRegionSummary(node));
  };
  const selectByIdRef = useRef(selectById);
  selectByIdRef.current = selectById;

  // Scene lifecycle
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(MAP_INFINITE_GRID.backgroundHex);
    scene.fog = new THREE.Fog(
      MAP_INFINITE_GRID.backgroundHex,
      MAP_INFINITE_GRID.fogNear3d,
      MAP_INFINITE_GRID.fogFar3d,
    );

    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 400);
    camera.position.set(9, 7, 11);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.setAttribute("data-map-global-3d-canvas", "true");
    renderer.domElement.setAttribute("data-map-infinite-grid", "true");
    renderer.domElement.setAttribute(
      "aria-label",
      "Global Map of Knowledge 3D: region graph with membership orbits",
    );
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.5;
    controls.maxDistance = MAP_INFINITE_GRID.maxDistance3d;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xcffafe, 0.85);
    key.position.set(6, 10, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa78bfa, 0.35);
    rim.position.set(-5, 3, -6);
    scene.add(rim);

    const grid = new THREE.GridHelper(
      MAP_INFINITE_GRID.size3d,
      MAP_INFINITE_GRID.divisions3d,
      MAP_INFINITE_GRID.strokeHex,
      MAP_INFINITE_GRID.strokeHex,
    );
    grid.name = "map-infinite-grid";
    const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const mat of gridMats) {
      const m = mat as THREE.Material & { transparent?: boolean; opacity?: number };
      m.transparent = true;
      m.opacity = MAP_INFINITE_GRID.strokeOpacity;
    }
    scene.add(grid);

    const content = new THREE.Group();
    content.name = "global-map-3d-content";
    scene.add(content);

    const pickables: THREE.Object3D[] = [];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDown = { x: 0, y: 0, moved: false };

    type RegionUserData = {
      kind: "region";
      regionId: string;
      title: string;
      subtitle: string;
    };

    const disposeObject = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Sprite) {
          const geo = (child as THREE.Mesh).geometry;
          geo?.dispose?.();
          const mat = (child as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else {
            const map = (mat as THREE.SpriteMaterial | undefined)?.map;
            map?.dispose?.();
            mat?.dispose?.();
          }
        }
      });
    };

    const rebuild = (
      laid: ReturnType<typeof layoutGlobalMapNodes3D>,
      edges: ReturnType<typeof buildGlobalMapModel>["edges"],
      selectedId: string | null,
    ) => {
      while (content.children.length) {
        const child = content.children[0];
        content.remove(child);
        disposeObject(child);
      }
      pickables.length = 0;

      const byId = new Map(laid.nodes.map((n) => [n.id, n]));

      // Edges in world space (true 3D)
      for (const e of edges) {
        const a = byId.get(e.source_id);
        const b = byId.get(e.target_id);
        if (!a || !b) continue;
        const pts = new Float32Array([a.wx, a.wy, a.wz, b.wx, b.wy, b.wz]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
        const mat = new THREE.LineDashedMaterial({
          color: 0x52525b,
          dashSize: 0.18,
          gapSize: 0.12,
          transparent: true,
          opacity: 0.75,
        });
        const line = new THREE.Line(geo, mat);
        line.computeLineDistances();
        content.add(line);

        // Midpoint distance label
        const mx = (a.wx + b.wx) / 2;
        const my = (a.wy + b.wy) / 2;
        const mz = (a.wz + b.wz) / 2;
        const distSprite = makeNameSprite(formatGlobalMapDistance(e.distance));
        distSprite.scale.set(0.7, 0.16, 1);
        distSprite.position.set(mx, my + 0.15, mz);
        content.add(distSprite);
      }

      for (const n of laid.nodes) {
        const selected = n.id === selectedId;
        const group = new THREE.Group();
        group.position.set(n.wx, n.wy, n.wz);

        // Outer near orbit (amber)
        const nearGeo = new THREE.TorusGeometry(n.orbit_near, 0.018, 8, 48);
        const nearMat = new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: selected ? 0.75 : 0.4,
        });
        const nearOrbit = new THREE.Mesh(nearGeo, nearMat);
        nearOrbit.rotation.x = Math.PI / 2;
        group.add(nearOrbit);

        // Inner inside orbit (cyan)
        const inGeo = new THREE.TorusGeometry(n.orbit_inside, 0.022, 8, 48);
        const inMat = new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          transparent: true,
          opacity: selected ? 0.95 : 0.55,
        });
        const inOrbit = new THREE.Mesh(inGeo, inMat);
        inOrbit.rotation.x = Math.PI / 2;
        group.add(inOrbit);

        // Core region sphere
        const coreGeo = new THREE.SphereGeometry(n.display_radius, 24, 18);
        const coreMat = new THREE.MeshStandardMaterial({
          color: selected ? 0x67e8f9 : 0x22d3ee,
          emissive: selected ? 0x22d3ee : 0x0e7490,
          emissiveIntensity: selected ? 0.55 : 0.25,
          roughness: 0.35,
          metalness: 0.25,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        const ud: RegionUserData = {
          kind: "region",
          regionId: n.id,
          title: n.name,
          subtitle: `${n.workspace_title} · inside ${n.inside_count} · near ${n.near_count}`,
        };
        core.userData = ud;
        group.userData = ud;
        group.add(core);
        pickables.push(core);

        const nameSprite = makeNameSprite(n.name);
        nameSprite.position.set(0, n.orbit_near + 0.35, 0);
        group.add(nameSprite);

        const insideSprite = makeCountSprite(String(n.inside_count), "#67e8f9");
        insideSprite.position.set(n.orbit_inside * 0.75, n.orbit_inside * 0.35, 0);
        group.add(insideSprite);

        const nearSprite = makeCountSprite(String(n.near_count), "#fbbf24");
        nearSprite.position.set(-n.orbit_near * 0.75, n.orbit_near * 0.35, 0);
        group.add(nearSprite);

        content.add(group);
      }

      if (laid.nodes.length === 0) {
        const emptyGeo = new THREE.SphereGeometry(0.25, 16, 12);
        const emptyMat = new THREE.MeshBasicMaterial({ color: 0x52525b, wireframe: true });
        content.add(new THREE.Mesh(emptyGeo, emptyMat));
      }
    };

    (mount as HTMLDivElement & {
      __rebuildGlobal3d?: typeof rebuild;
    }).__rebuildGlobal3d = rebuild;

    rebuild(layout3d, model.edges, selectedRegionId);
    setReady(true);

    const onPointerDown = (event: PointerEvent) => {
      pointerDown = { x: event.clientX, y: event.clientY, moved: false };
    };
    const onPointerMoveHover = (event: PointerEvent) => {
      if (
        Math.abs(event.clientX - pointerDown.x) + Math.abs(event.clientY - pointerDown.y) >
        4
      ) {
        pointerDown.moved = true;
      }
    };
    const onClick = (event: PointerEvent) => {
      if (pointerDown.moved) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      if (hits.length === 0) {
        selectByIdRef.current(null);
        return;
      }
      const ud = hits[0].object.userData as { kind?: string; regionId?: string };
      if (ud.kind === "region" && ud.regionId) selectByIdRef.current(ud.regionId);
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMoveHover);
    renderer.domElement.addEventListener("click", onClick);

    const onResize = () => {
      if (!mount) return;
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    let raf = 0;
    const tick = () => {
      if (cancelled) return;
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMoveHover);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      disposeObject(content);
      scene.remove(content);
      scene.remove(grid);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      (mount as HTMLDivElement & { __rebuildGlobal3d?: unknown }).__rebuildGlobal3d = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scene mounts once; data via rebuild effect
  }, []);

  // Rebuild content when model / selection / projection layout changes
  useEffect(() => {
    const mount = mountRef.current as
      | (HTMLDivElement & {
          __rebuildGlobal3d?: (
            laid: ReturnType<typeof layoutGlobalMapNodes3D>,
            edges: typeof model.edges,
            selectedId: string | null,
          ) => void;
        })
      | null;
    mount?.__rebuildGlobal3d?.(layout3d, model.edges, selectedRegionId);
  }, [layout3d, model.edges, selectedRegionId]);

  const heightClass = fill ? "min-h-0 flex-1 h-full" : "h-[min(58vh,520px)]";

  return (
    <div
      className={`relative w-full overflow-hidden outline-none ${heightClass} ${className}`}
      style={{ backgroundColor: MAP_INFINITE_GRID.background }}
      data-map-global
      data-map-global-3d
      data-map-global-surface
      data-map-global-view="3d"
      data-map-infinite-grid-surface="global-3d"
      data-projection-algorithm={projectionAlgorithm}
      data-map-global-projection={projectionAlgorithm}
    >
      <div ref={mountRef} className="absolute inset-0" data-map-global-3d-mount />

      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
          Initializing Global Map 3D…
        </div>
      )}

      <div
        className="pointer-events-auto absolute bottom-3 left-3 z-10 max-w-[16rem] border border-zinc-800/90 bg-black/80 backdrop-blur-sm"
        data-map-global-legend
        data-legend-open={legendOpen ? "true" : "false"}
      >
        <button
          type="button"
          onClick={() => setLegendOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-white/[0.03]"
          aria-expanded={legendOpen}
          data-map-global-legend-toggle
        >
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-zinc-500">
            Global Map 3D
          </span>
          <span
            className={`font-mono text-[10px] text-zinc-500 transition-transform ${
              legendOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            ▾
          </span>
        </button>
        {legendOpen && (
          <ul
            className="space-y-1 border-t border-zinc-800/80 px-3 pb-2.5 pt-1.5 text-[11px] leading-snug text-zinc-400"
            data-map-global-legend-body
          >
            <li>
              <span className="text-cyan-300">Inner orbit</span> — users inside region
            </li>
            <li>
              <span className="text-amber-300">Outer orbit</span> — near, not inside
            </li>
            <li>Region dots use multi-algo x,y,z layout</li>
            <li className="text-zinc-500">Drag to orbit · scroll to zoom</li>
            <li className="text-zinc-500">Click a region for summary</li>
          </ul>
        )}
      </div>

      {selectedSummary && (
        <div
          className="absolute right-3 top-3 z-20 w-[min(100%-1.5rem,18rem)] border border-zinc-600 bg-zinc-950/95 p-3 shadow-xl backdrop-blur-sm"
          data-map-global-region-summary
          data-region-id={selectedSummary.region_id}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-zinc-500">
                Region
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-white">
                {selectedSummary.name}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                {selectedSummary.workspace_title}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-sm border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-500 hover:text-white"
              onClick={() => selectById(null)}
              data-map-global-summary-dismiss
              aria-label="Dismiss region summary"
            >
              Close
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="border border-cyan-500/25 bg-cyan-950/20 px-2 py-1.5">
              <dt className="font-mono text-[9px] uppercase tracking-wide text-cyan-500/90">
                Inside
              </dt>
              <dd className="mt-0.5 font-mono text-base text-cyan-100" data-summary-inside>
                {selectedSummary.inside_count}
              </dd>
            </div>
            <div className="border border-amber-500/25 bg-amber-950/20 px-2 py-1.5">
              <dt className="font-mono text-[9px] uppercase tracking-wide text-amber-500/90">
                Near
              </dt>
              <dd className="mt-0.5 font-mono text-base text-amber-100" data-summary-near>
                {selectedSummary.near_count}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
            Membership radius {selectedSummary.radius.toFixed(2)} in knowledge space. Open Local Map
            to inspect this region only.
          </p>
          {onOpenLocalMap && (
            <button
              type="button"
              className="mt-3 w-full rounded-sm border border-cyan-700/60 bg-cyan-950/40 px-3 py-2 text-left text-[11px] font-medium text-cyan-100 transition hover:border-cyan-500 hover:bg-cyan-900/40"
              onClick={() => onOpenLocalMap(selectedSummary.region_id)}
              data-map-global-open-local
            >
              {openLocalLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
