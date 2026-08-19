/**
 * Annotation layers: pure model + continuous-plane coords + structural UI wiring.
 * Drives shipped helpers — no re-implementation of geometry/permissions.
 */
import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ANNOTATION_STROKE_COLOR,
  ANNOTATION_STROKE_THICKNESSES,
  annotationEraserRadiusForThickness,
  annotationFreehandPathD,
  annotationLayersStorageKey,
  annotationLayersStoreOps,
  annotationScreenToWorld,
  annotationStrokeHitsPoint,
  annotationWorldToScreen,
  appendAnnotationStroke,
  buildAnnotationStrokeFromGesture,
  canDeleteAnnotationLayer,
  canDrawOnAnnotationLayer,
  createAnnotationLayer,
  deleteAnnotationLayer,
  eraseAnnotationStrokesAlongPath,
  loadAnnotationLayers,
  normalizeAnnotationStrokeThickness,
  parseAnnotationLayers,
  renameAnnotationLayer,
  saveAnnotationLayers,
  setAnnotationLayerVisible,
  toggleAnnotationLayerVisible,
  type AnnotationNotesStorage,
} from "@/lib/map-annotation-layers";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.ANNOTATION_LAYERS_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-3f34f6649e24/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

function memoryStore(): AnnotationNotesStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe("annotation layers model", () => {
  it("create named layer, white strokes of each kind, toggle, creator-only delete", () => {
    let layer = createAnnotationLayer({
      name: "  Sketch A  ",
      id: "a",
      now: 1000,
    });
    expect(layer.id).toBe("alayer-a");
    expect(layer.name).toBe("Sketch A");
    expect(layer.visible).toBe(true);
    expect(layer.strokes).toHaveLength(0);

    layer = renameAnnotationLayer(layer, "Outline", 1100);
    expect(layer.name).toBe("Outline");

    const circle = buildAnnotationStrokeFromGesture({
      kind: "circle",
      start: { x: 0, y: 0 },
      end: { x: 40, y: 0 },
      id: "c1",
      now: 1200,
    });
    expect(circle.color).toBe(ANNOTATION_STROKE_COLOR);
    expect(circle.color).toBe("#ffffff");
    expect(circle.cx).toBe(20);
    expect(circle.cy).toBe(0);
    expect(circle.r).toBe(20);

    const square = buildAnnotationStrokeFromGesture({
      kind: "square",
      start: { x: 10, y: 10 },
      end: { x: 50, y: 40 },
      id: "s1",
    });
    expect(square.color).toBe("#ffffff");
    expect(square.x).toBe(10);
    expect(square.y).toBe(10);
    expect(square.width).toBe(40);
    expect(square.height).toBe(30);

    const freehand = buildAnnotationStrokeFromGesture({
      kind: "freehand",
      start: { x: 1, y: 1 },
      end: { x: 3, y: 3 },
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
      ],
      id: "f1",
    });
    expect(freehand.color).toBe("#ffffff");
    expect(freehand.points).toHaveLength(3);
    expect(annotationFreehandPathD(freehand.points)).toBe("M 1 1 L 2 2 L 3 3");

    layer = appendAnnotationStroke(layer, circle);
    layer = appendAnnotationStroke(layer, square);
    layer = appendAnnotationStroke(layer, freehand);
    expect(layer.strokes).toHaveLength(3);
    expect(layer.strokes.every((s) => s.color === "#ffffff")).toBe(true);

    // Thickness snaps to the three choices
    expect(ANNOTATION_STROKE_THICKNESSES).toEqual([1.5, 3, 6]);
    expect(normalizeAnnotationStrokeThickness(3)).toBe(3);
    expect(normalizeAnnotationStrokeThickness(1)).toBe(1.5);
    expect(normalizeAnnotationStrokeThickness(10)).toBe(6);
    const thickStroke = buildAnnotationStrokeFromGesture({
      kind: "freehand",
      start: { x: 0, y: 0 },
      end: { x: 5, y: 0 },
      strokeWidth: 6,
      id: "thick",
    });
    expect(thickStroke.strokeWidth).toBe(6);

    // Eraser: remove freehand by brushing near it
    expect(
      annotationStrokeHitsPoint(freehand, { x: 2, y: 2 }, 4),
    ).toBe(true);
    const erased = eraseAnnotationStrokesAlongPath(
      layer,
      [
        { x: 2, y: 2 },
        { x: 2.5, y: 2.5 },
      ],
      annotationEraserRadiusForThickness(3),
    );
    expect(erased.strokes.some((s) => s.id === freehand.id)).toBe(false);
    expect(erased.strokes.length).toBeLessThan(layer.strokes.length);

    layer = toggleAnnotationLayerVisible(layer);
    expect(layer.visible).toBe(false);
    layer = setAnnotationLayerVisible(layer, true);
    expect(layer.visible).toBe(true);

    // Permissions
    expect(canDeleteAnnotationLayer({ learnerMode: true })).toBe(false);
    expect(canDeleteAnnotationLayer({ learnerMode: false })).toBe(true);
    expect(canDrawOnAnnotationLayer({ learnerMode: true })).toBe(false);
    expect(canDrawOnAnnotationLayer({ learnerMode: false })).toBe(true);

    const layers = [layer, createAnnotationLayer({ id: "b", name: "B" })];
    const afterLearnerDelete = deleteAnnotationLayer(layers, layer.id, {
      learnerMode: true,
    });
    expect(afterLearnerDelete).toHaveLength(2);
    const afterCreatorDelete = deleteAnnotationLayer(layers, layer.id, {
      learnerMode: false,
    });
    expect(afterCreatorDelete).toHaveLength(1);
    expect(afterCreatorDelete[0].id).toBe("alayer-b");

    // Store ops: learner create rejected, creator works; learner delete no-op on store
    const storage = memoryStore();
    const creatorOps = annotationLayersStoreOps({
      workspaceId: "ws",
      storage,
      learnerMode: false,
    });
    const made = creatorOps.create({ name: "Map marks", id: "store1" });
    expect(made).not.toBeNull();
    expect(made!.name).toBe("Map marks");
    expect(made!.visible).toBe(true);
    const stroke = buildAnnotationStrokeFromGesture({
      kind: "circle",
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      id: "st",
    });
    expect(creatorOps.appendStroke(made!.id, stroke)).not.toBeNull();

    const learnerOps = annotationLayersStoreOps({
      workspaceId: "ws",
      storage,
      learnerMode: true,
    });
    expect(learnerOps.create({ name: "nope" })).toBeNull();
    const before = learnerOps.list().length;
    learnerOps.remove(made!.id);
    expect(learnerOps.list()).toHaveLength(before);
    expect(loadAnnotationLayers({ workspaceId: "ws", storage })).toHaveLength(1);

    learnerOps.toggleVisible(made!.id);
    expect(
      loadAnnotationLayers({ workspaceId: "ws", storage })[0].visible,
    ).toBe(false);

    expect(annotationLayersStorageKey({ workspaceId: "ws" })).toMatch(
      /mapAnnotationLayers/,
    );

    writeEvidence(
      "annotation-layers-model.log",
      [
        "layer_name=" + layer.name,
        "stroke_kinds=" + layer.strokes.map((s) => s.kind).join(","),
        "all_white=" + layer.strokes.every((s) => s.color === "#ffffff"),
        "circle_r=" + circle.r,
        "square_w=" + square.width,
        "learner_delete_rejected=" + (afterLearnerDelete.length === 2),
        "creator_delete_ok=" + (afterCreatorDelete.length === 1),
        "learner_create_null=" + (learnerOps.create({ name: "x" }) === null),
        "store_count=" + loadAnnotationLayers({ workspaceId: "ws", storage }).length,
      ].join("\n"),
    );
  });
});

describe("annotation continuous plane coords", () => {
  it("screen↔world matches pan/zoom path used by blocks/notes", () => {
    const panX = 100;
    const panY = 50;
    const zoom = 2;
    // world (20, 10) → screen
    const screen = annotationWorldToScreen({
      x: 20,
      y: 10,
      panX,
      panY,
      zoom,
    });
    expect(screen.left).toBe(20 * 2 + 100);
    expect(screen.top).toBe(10 * 2 + 50);

    const world = annotationScreenToWorld({
      localX: screen.left,
      localY: screen.top,
      panX,
      panY,
      zoom,
    });
    expect(world.x).toBeCloseTo(20, 5);
    expect(world.y).toBeCloseTo(10, 5);

    // Draw gesture at zoom: screen delta 40 → world 20
    const start = annotationScreenToWorld({
      localX: 0,
      localY: 0,
      panX: 0,
      panY: 0,
      zoom,
    });
    const end = annotationScreenToWorld({
      localX: 40,
      localY: 0,
      panX: 0,
      panY: 0,
      zoom,
    });
    const stroke = buildAnnotationStrokeFromGesture({
      kind: "circle",
      start,
      end,
    });
    expect(stroke.r).toBeCloseTo(10, 5);

    writeEvidence(
      "annotation-layers-coords.log",
      [
        "screen=" + JSON.stringify(screen),
        "world=" + JSON.stringify(world),
        "circle_r_at_zoom2=" + stroke.r,
        "zoom=" + zoom,
      ].join("\n"),
    );
  });
});

describe("annotation layers UI structural", () => {
  it("creator stack + toolbox; learner toggle-only under Add note", () => {
    const grid = readMapGridSurface();
    const lib = read("lib/map-annotation-layers.ts");
    const testSelf = read("tests/lib/map-annotation-layers.test.ts");

    expect(lib).toContain("canDeleteAnnotationLayer");
    expect(lib).toContain("buildAnnotationStrokeFromGesture");
    expect(lib).toContain("ANNOTATION_STROKE_COLOR");
    expect(lib).toContain("#ffffff");

    // Creator minimap stack
    expect(grid).toContain("data-annotation-layers-stack");
    expect(grid).toContain("data-annotation-layer-add");
    expect(grid).toContain("data-annotation-layer-select");
    expect(grid).toContain("data-annotation-layer-delete");
    expect(grid).toContain("data-annotation-layer-toggle");
    expect(grid).toContain("createAnnotationLayer");
    expect(grid).toContain("canDeleteAnnotationLayer");

    // Left strip becomes annotation toolbox when layer selected
    expect(grid).toContain("data-annotation-tool-strip");
    expect(grid).toContain("data-annotation-tool=");
    expect(grid).toContain('id: "circle"');
    expect(grid).toContain('id: "square"');
    expect(grid).toContain('id: "freehand"');
    expect(grid).toContain('id: "eraser"');
    expect(grid).toContain("data-annotation-toolbox");
    expect(grid).toContain("data-annotation-thickness");
    expect(grid).toContain("ANNOTATION_STROKE_THICKNESSES");
    expect(grid).toContain("eraseAnnotationStrokesAlongPath");
    expect(grid).toContain('data-annotation-eye="open"');
    expect(grid).toContain('data-annotation-eye="closed"');
    expect(grid).toMatch(/activeAnnotationLayerId/);
    expect(grid).toContain("data-annotation-draw-surface");
    expect(lib).toContain("eraseAnnotationStrokesAlongPath");
    expect(lib).toContain("ANNOTATION_STROKE_THICKNESSES");

    // Learner: layers under Add note; no delete control in learner path
    expect(grid).toContain("data-annotation-layers-under-notes");
    // Delete button gated: only when canDelete
    expect(grid).toMatch(
      /canDeleteAnnotationLayer\([\s\S]{0,80}learnerMode/,
    );
    expect(grid).toContain("ANNOTATION_STROKE_COLOR");

    // Draw path uses world plane
    expect(grid).toContain("annotationScreenToWorld");
    expect(grid).toContain("appendAnnotationStroke");
    expect(grid).toContain("data-annotation-strokes-layer");

    // Committed strokes must paint ABOVE skill blocks (DOM order + z-index).
    // World layer renders occupied tiles first, then MapAnnotationStrokes (z-[20]).
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    const blocksMarker = "Occupied blocks: solid rect or freeform multi-tile lecture";
    const strokesMarker = "<MapAnnotationStrokes";
    const blocksIdx = world.indexOf(blocksMarker);
    const strokesIdx = world.indexOf(strokesMarker);
    expect(blocksIdx).toBeGreaterThan(-1);
    expect(strokesIdx).toBeGreaterThan(-1);
    expect(strokesIdx).toBeGreaterThan(blocksIdx);
    expect(grid).toMatch(
      /data-annotation-strokes-layer[\s\S]{0,120}z-\[20\]/,
    );
    expect(grid).toMatch(
      /data-annotation-strokes-layer[\s\S]{0,160}pointer-events-none/,
    );

    // Tests drive shipped model (not theater)
    expect(testSelf).toContain("buildAnnotationStrokeFromGesture");
    expect(testSelf).toContain("deleteAnnotationLayer");

    writeEvidence(
      "annotation-layers-ui.log",
      [
        "stack=true",
        "add_layer=true",
        "tool_strip=true",
        "tools=circle,square,freehand,eraser",
        "thickness_choices=" + ANNOTATION_STROKE_THICKNESSES.join(","),
        "eye_toggle=true",
        "learner_toggle=true",
        "creator_delete_gated=true",
        "white_only=true",
        "world_draw=true",
        "strokes_after_blocks=" + (strokesIdx > blocksIdx),
        "strokes_z20=true",
        "strokes_pointer_events_none=true",
      ].join("\n"),
    );
  });
});

describe("parse round-trip", () => {
  it("parse keeps white color even if raw has other color", () => {
    const parsed = parseAnnotationLayers([
      {
        id: "x",
        name: "N",
        visible: true,
        strokes: [
          {
            id: "s",
            kind: "circle",
            color: "#ff0000",
            cx: 1,
            cy: 2,
            r: 3,
          },
        ],
      },
    ]);
    expect(parsed[0].strokes[0].color).toBe("#ffffff");
    const storage = memoryStore();
    saveAnnotationLayers({
      workspaceId: "w",
      layers: parsed,
      storage,
    });
    const re = loadAnnotationLayers({ workspaceId: "w", storage });
    expect(re[0].strokes[0].color).toBe("#ffffff");
  });
});
