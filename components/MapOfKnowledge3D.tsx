"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  MAP_INFINITE_GRID,
  STEM_MINI_AVATARS,
  mapDotColor,
  type MapRegion,
  type MapUserLocation,
} from "@/lib/map-of-knowledge";

export type MapOfKnowledge3DProps = {
  userLocations: MapUserLocation[];
  regions: MapRegion[];
  className?: string;
  /** When true, stretch to fill parent flex area. */
  fill?: boolean;
  /**
   * Multi-algo 3D projection id that produced x/y/z on locations + regions.
   * Parent reprojects via projectMapVectors; this is for a11y / data attrs.
   */
  projectionAlgorithm?: string;
  /** Highlight a subject (e.g. Find yourself overlay). */
  focusedUserId?: string | null;
};

type HoverInfo = {
  title: string;
  subtitle: string;
  x: number;
  y: number;
};

const ILE_COLOR = 0xfbbf24;
const TAP_COLOR = 0x94a3b8;

/** Preload STEM mini-avatar textures once (shared across rebuilds). */
function loadStemAvatarTextures(): Promise<Map<string, THREE.Texture>> {
  const loader = new THREE.TextureLoader();
  const map = new Map<string, THREE.Texture>();
  return Promise.all(
    STEM_MINI_AVATARS.map(
      (avatar) =>
        new Promise<void>((resolve) => {
          loader.load(
            avatar.path,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.needsUpdate = true;
              map.set(avatar.id, tex);
              map.set(avatar.path, tex);
              resolve();
            },
            undefined,
            () => {
              // Missing asset → skip; sphere fallback used for that id.
              resolve();
            },
          );
        }),
    ),
  ).then(() => map);
}

/** Sprite billboard for a STEM mini avatar (replaces plain sphere dots). */
function makeAvatarSprite(
  texture: THREE.Texture,
  isIle: boolean,
): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const scale = isIle ? 0.42 : 0.36;
  sprite.scale.set(scale, scale, 1);
  sprite.userData = { isAvatarSprite: true };
  return sprite;
}

function boundsScale(points: Array<{ x: number; y: number; z: number }>): number {
  if (points.length === 0) return 1;
  let max = 0.01;
  for (const p of points) {
    max = Math.max(max, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
  }
  // Target ~5 unit radius for comfortable orbit
  return 5 / max;
}

/** Canvas texture sprite with short user-id preview next to a map dot. */
function makeIdLabelSprite(preview: string, isIle: boolean): THREE.Sprite {
  const text = (preview || "—").slice(0, 8);
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "600 22px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    // soft plate for readability
    const metrics = ctx.measureText(text);
    const padX = 10;
    const w = Math.min(canvas.width - 4, metrics.width + padX * 2);
    const h = 30;
    const x0 = 2;
    const y0 = (canvas.height - h) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = isIle ? "rgba(251,191,36,0.45)" : "rgba(148,163,184,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
    ctx.fillStyle = isIle ? "#fde68a" : "#e4e4e7";
    ctx.fillText(text, x0 + padX, canvas.height / 2 + 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.95, 0.36, 1);
  sprite.position.set(0.28, 0.18, 0);
  sprite.userData = { isLabel: true };
  return sprite;
}

/**
 * Interactive Three.js embedding-space explorer.
 * Orbit: left-drag rotate · right-drag / two-finger pan · scroll zoom · double-click reset.
 */
export function MapOfKnowledge3D({
  userLocations,
  regions,
  className = "",
  fill = false,
  projectionAlgorithm = "pca",
  focusedUserId = null,
}: MapOfKnowledge3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [ready, setReady] = useState(false);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const defaultCamRef = useRef({ position: new THREE.Vector3(8, 6, 10), target: new THREE.Vector3(0, 0, 0) });
  const avatarTexturesRef = useRef<Map<string, THREE.Texture>>(new Map());

  // Scene setup once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(MAP_INFINITE_GRID.backgroundHex);
    // Soft fog so the large infinite grid plane fades at distance (no hard edge).
    scene.fog = new THREE.Fog(
      MAP_INFINITE_GRID.backgroundHex,
      MAP_INFINITE_GRID.fogNear3d,
      MAP_INFINITE_GRID.fogFar3d,
    );

    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 400);
    camera.position.set(8, 6, 10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.setAttribute("data-map-3d-canvas", "true");
    renderer.domElement.setAttribute("data-map-infinite-grid", "true");
    renderer.domElement.setAttribute("data-map-infinite-grid-surface", "local-3d");
    renderer.domElement.setAttribute("aria-label", "3D Map of Knowledge embedding space");
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

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xcffafe, 0.85);
    key.position.set(6, 10, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa78bfa, 0.35);
    rim.position.set(-5, 3, -6);
    scene.add(rim);

    // Large infinite-style grid plane only (no axis helpers, no finite floor disc).
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

    // Content group rebuilt when data changes
    const content = new THREE.Group();
    content.name = "map-content";
    scene.add(content);

    // Raycast pickables
    const pickables: THREE.Object3D[] = [];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    type UserData =
      | { kind: "user"; title: string; subtitle: string }
      | { kind: "region"; title: string; subtitle: string };

    const state = {
      content,
      pickables,
      disposed: false,
    };

    // Expose rebuild via custom event on mount element
    const rebuild = (
      locations: MapUserLocation[],
      regs: MapRegion[],
      focusId: string | null = null,
    ) => {
      while (content.children.length) {
        const child = content.children[0];
        content.remove(child);
        child.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
            obj.geometry?.dispose?.();
            const mat = obj.material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat?.dispose?.();
          }
        });
      }
      pickables.length = 0;

      const allPts = [
        ...locations.map((p) => ({ x: p.x, y: p.y, z: p.z })),
        ...regs.map((r) => ({ x: r.x, y: r.y, z: r.z })),
      ];
      const s = boundsScale(allPts);

      // Regions first (behind dots visually)
      regs.forEach((region, i) => {
        const hue = (i * 47) % 360;
        const color = new THREE.Color(`hsl(${hue}, 70%, 58%)`);
        const radius = Math.max(0.35, (region.radius || 0.35) * s * 2.2);

        const sphereGeo = new THREE.SphereGeometry(radius, 24, 18);
        const fillMat = new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: 0.12,
          roughness: 0.6,
          metalness: 0.05,
          depthWrite: false,
        });
        const fill = new THREE.Mesh(sphereGeo, fillMat);
        fill.position.set(region.x * s, region.y * s, region.z * s);

        const wireGeo = new THREE.SphereGeometry(radius, 16, 12);
        const wireMat = new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          transparent: true,
          opacity: 0.35,
        });
        const wire = new THREE.Mesh(wireGeo, wireMat);
        wire.position.copy(fill.position);

        const ud: UserData = {
          kind: "region",
          title: region.name,
          subtitle: `${region.workspace_title} · region`,
        };
        fill.userData = ud;
        wire.userData = ud;
        content.add(fill);
        content.add(wire);
        pickables.push(fill);
      });

      // User markers: STEM mini avatars (sprite) with sphere fallback + id labels
      locations.forEach((p) => {
        const isIle = p.kind === "ile";
        const focused = Boolean(focusId && p.id === focusId);
        const colorHex = focused ? 0x22d3ee : isIle ? ILE_COLOR : TAP_COLOR;
        const radius = focused ? 0.2 : isIle ? 0.14 : 0.11;
        const preview =
          p.id_preview ||
          p.subject_label.replace(/^(user|guest|id):/, "").slice(0, 6) ||
          "—";
        const ud: UserData = {
          kind: "user",
          title: preview,
          subtitle: `${p.subject_label} · ${p.workspace_title} · ${p.kind.toUpperCase()}`,
        };

        const pos = new THREE.Vector3(p.x * s, p.y * s, p.z * s);

        if (focused) {
          const ringGeo = new THREE.TorusGeometry(radius * 1.8, 0.02, 8, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.9,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.copy(pos);
          ring.rotation.x = Math.PI / 2;
          content.add(ring);
        }

        const tex =
          (p.avatar_id && avatarTexturesRef.current.get(p.avatar_id)) ||
          (p.avatar_path && avatarTexturesRef.current.get(p.avatar_path)) ||
          null;

        if (tex) {
          const sprite = makeAvatarSprite(tex, isIle);
          if (focused) sprite.scale.multiplyScalar(1.35);
          sprite.position.copy(pos);
          sprite.userData = { ...ud, isAvatarSprite: true };
          const label = makeIdLabelSprite(preview, isIle);
          // Offset label so it sits beside the avatar sprite
          label.position.set(0.32, 0.12, 0);
          sprite.add(label);
          content.add(sprite);
          pickables.push(sprite);
          return;
        }

        // Fallback: plain sphere when texture not yet loaded / missing
        const geo = new THREE.SphereGeometry(radius, 20, 16);
        const mat = new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: focused ? 0.7 : isIle ? 0.55 : 0.2,
          roughness: 0.35,
          metalness: isIle ? 0.45 : 0.15,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.userData = ud;

        if (isIle || focused) {
          const glowGeo = new THREE.SphereGeometry(radius * 1.7, 16, 12);
          const glowMat = new THREE.MeshBasicMaterial({
            color: focused ? 0x22d3ee : ILE_COLOR,
            transparent: true,
            opacity: focused ? 0.28 : 0.18,
            depthWrite: false,
          });
          const glow = new THREE.Mesh(glowGeo, glowMat);
          mesh.add(glow);
        }

        const label = makeIdLabelSprite(preview, isIle);
        mesh.add(label);

        content.add(mesh);
        pickables.push(mesh);
      });

      // Empty state marker
      if (locations.length === 0 && regs.length === 0) {
        const emptyGeo = new THREE.SphereGeometry(0.25, 16, 12);
        const emptyMat = new THREE.MeshBasicMaterial({
          color: 0x52525b,
          wireframe: true,
        });
        content.add(new THREE.Mesh(emptyGeo, emptyMat));
      }
    };

    // Store rebuild on mount for data updates without remounting whole WebGL context
    (mount as HTMLDivElement & { __rebuildMap3d?: typeof rebuild }).__rebuildMap3d = rebuild;

    // Preload STEM avatars, then first rebuild (avatars replace sphere dots).
    void loadStemAvatarTextures().then((textures) => {
      if (cancelled) return;
      avatarTexturesRef.current = textures;
      rebuild(userLocations, regions, focusedUserId);
      setReady(true);
    });
    // Immediate first paint with sphere fallback until textures resolve
    rebuild(userLocations, regions, focusedUserId);
    setReady(true);

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      if (hits.length > 0) {
        const ud = hits[0].object.userData as UserData;
        if (ud?.title) {
          setHover({
            title: ud.title,
            subtitle: ud.subtitle,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
          renderer.domElement.style.cursor = "pointer";
          return;
        }
      }
      setHover(null);
      renderer.domElement.style.cursor = "grab";
    };

    const onPointerLeave = () => {
      setHover(null);
      renderer.domElement.style.cursor = "grab";
    };

    const onDblClick = () => {
      const cam = cameraRef.current;
      const ctrl = controlsRef.current;
      if (!cam || !ctrl) return;
      cam.position.copy(defaultCamRef.current.position);
      ctrl.target.copy(defaultCamRef.current.target);
      ctrl.update();
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("dblclick", onDblClick);

    let frame = 0;
    const animate = () => {
      if (state.disposed) return;
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount || state.disposed) return;
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      state.disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("dblclick", onDblClick);
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          obj.geometry?.dispose?.();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose?.();
        }
      });
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      delete (mount as HTMLDivElement & { __rebuildMap3d?: typeof rebuild }).__rebuildMap3d;
      controlsRef.current = null;
      cameraRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; data via rebuild
  }, []);

  // Rebuild content when data / region filters change
  useEffect(() => {
    const mount = mountRef.current as
      | (HTMLDivElement & {
          __rebuildMap3d?: (
            l: MapUserLocation[],
            r: MapRegion[],
            focusId?: string | null,
          ) => void;
        })
      | null;
    mount?.__rebuildMap3d?.(userLocations, regions, focusedUserId);
  }, [userLocations, regions, focusedUserId]);

  const resetView = () => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    cam.position.set(8, 6, 10);
    ctrl.target.set(0, 0, 0);
    ctrl.update();
  };

  return (
    <div
      className={`relative bg-zinc-950 ${fill ? "min-h-0 flex-1" : "h-[min(58vh,480px)]"} ${className}`}
      data-map-3d-root
      data-projection-algorithm={projectionAlgorithm}
      data-map-3d-projection={projectionAlgorithm}
      aria-label={`Map of Knowledge 3D embedding projection (${projectionAlgorithm})`}
    >
      <div ref={mountRef} className="absolute inset-0" />

      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
          Initializing 3D embedding space…
        </div>
      )}

      {/* Control legend */}
      <div
        className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[16rem] border border-zinc-800/90 bg-black/70 px-3 py-2.5 backdrop-blur-sm"
        data-map-3d-legend
      >
        <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-zinc-500">Controls</p>
        <ul className="mt-1.5 space-y-1 text-[11px] leading-snug text-zinc-400">
          <li>
            <span className="text-zinc-200">Drag</span> — orbit / rotate
          </li>
          <li>
            <span className="text-zinc-200">Right-drag</span> or{" "}
            <span className="text-zinc-200">two-finger</span> — pan
          </li>
          <li>
            <span className="text-zinc-200">Scroll</span> / pinch — zoom
          </li>
          <li>
            <span className="text-zinc-200">Double-click</span> — reset view
          </li>
          <li>
            <span className="text-zinc-200">Hover</span> — inspect point / region
          </li>
        </ul>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-800/80 pt-2 text-[10px] text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-neutral-200" /> ILE
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-400" /> TAP
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full border border-dashed border-pink-400/70" /> Region
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={resetView}
        className="absolute right-3 top-3 z-10 rounded-sm border border-zinc-700 bg-black/60 px-2.5 py-1.5 font-mono text-[10px] tracking-wide text-zinc-300 backdrop-blur-sm transition hover:border-zinc-500 hover:text-white"
      >
        Reset view
      </button>

      {hover && (
        <div
          className="pointer-events-none absolute z-20 max-w-[14rem] border border-zinc-700 bg-black/90 px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: Math.min(hover.x + 12, (mountRef.current?.clientWidth || 300) - 160),
            top: Math.max(8, hover.y - 40),
          }}
        >
          <p className="font-medium text-white">{hover.title}</p>
          <p className="mt-0.5 text-[10px] text-zinc-400">{hover.subtitle}</p>
        </div>
      )}

      {userLocations.length === 0 && regions.length === 0 && ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="max-w-xs text-center font-mono text-xs text-zinc-600">
            Awaiting public embeddings — make a workspace public to appear
          </p>
        </div>
      )}
    </div>
  );
}

/** Exported for tests / legend color parity with 2D map. */
export function map3dDotCssColor(kind: string): string {
  return mapDotColor(kind === "ile" ? "ile" : "tap");
}
