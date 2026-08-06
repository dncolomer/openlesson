/**
 * Learner map notes on a continuous plane: center-drop, drag, resize, persist.
 * Drives shipped helpers — no re-implementation of transform/CRUD.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SKILL_GRID_PITCH } from "@/lib/block-skill-grid";
import {
  applyLearnerNoteDragDelta,
  applyLearnerNoteResize,
  canDeleteMapNote,
  canEditMapNoteContent,
  createLearnerMapNote,
  createLearnerMapNoteAtViewportCenter,
  creatorMapNotesStorageKey,
  creatorMapNotesStoreOps,
  deleteLearnerMapNote,
  LEARNER_NOTE_DEFAULT_HEIGHT,
  LEARNER_NOTE_DEFAULT_WIDTH,
  LEARNER_NOTE_MAX_WIDTH,
  LEARNER_NOTE_MIN_HEIGHT,
  LEARNER_NOTE_MIN_WIDTH,
  learnerMapNoteIsBlockAgnostic,
  learnerMapNotesStorageKey,
  learnerMapNotesStoreOps,
  learnerNoteCommitFromGestureBox,
  learnerNoteLayerStyle,
  learnerNoteLiveBoxFromPointerMove,
  learnerNotePointerAllowsDragStart,
  learnerNoteScreenPosition,
  defaultMapNotesPlaneVisible,
  listVisibleMapNotes,
  loadCreatorMapNotes,
  loadLearnerMapNotes,
  mapNotesForPlaneRender,
  parseLearnerMapNotes,
  saveLearnerMapNotes,
  shouldMountMapNotes,
  shouldRenderMapNotesOnPlane,
  toggleLearnerMapNoteCollapsed,
  toggleMapNotesPlaneVisible,
  updateLearnerMapNote,
  upsertLearnerMapNote,
  viewportCenterToWorldPlane,
  type LearnerNotePointerTargetLike,
  type LearnerNotesStorage,
} from "@/lib/learner-map-notes";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.LEARNER_NOTES_PLANE_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-59c66ba00923/implementer";

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

function memoryStore(): LearnerNotesStorage {
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

describe("continuous plane model: create / drag / resize", () => {
  it("viewport center drop, drag delta, resize clamp; block-agnostic", () => {
    const viewport = {
      viewportWidth: 800,
      viewportHeight: 600,
      panX: 100,
      panY: 50,
      zoom: 1,
    };
    const center = viewportCenterToWorldPlane(viewport);
    // world = (local - pan) / zoom
    expect(center.x).toBe((800 / 2 - 100) / 1);
    expect(center.y).toBe((600 / 2 - 50) / 1);

    const note = createLearnerMapNoteAtViewportCenter({
      ...viewport,
      id: "c1",
      body: "hello",
      now: 1000,
    });
    expect(note.id).toBe("lnote-c1");
    expect(note.body).toBe("hello");
    expect(note.width).toBe(LEARNER_NOTE_DEFAULT_WIDTH);
    expect(note.height).toBe(LEARNER_NOTE_DEFAULT_HEIGHT);
    // top-left so note is roughly centered
    expect(note.x).toBeCloseTo(center.x - LEARNER_NOTE_DEFAULT_WIDTH / 2, 5);
    expect(note.y).toBeCloseTo(center.y - LEARNER_NOTE_DEFAULT_HEIGHT / 2, 5);
    expect(learnerMapNoteIsBlockAgnostic(note)).toBe(true);
    expect("blockId" in note).toBe(false);

    // Drag 40px right, 20px down at zoom 2 → world +20, +10
    const dragged = applyLearnerNoteDragDelta(note, {
      dxScreen: 40,
      dyScreen: 20,
      zoom: 2,
      now: 2000,
    });
    expect(dragged.x).toBeCloseTo(note.x + 20, 5);
    expect(dragged.y).toBeCloseTo(note.y + 10, 5);
    expect(dragged.updatedAt).toBe(2000);

    // Resize clamp
    const tiny = applyLearnerNoteResize(note, { width: 10, height: 5 });
    expect(tiny.width).toBe(LEARNER_NOTE_MIN_WIDTH);
    expect(tiny.height).toBe(LEARNER_NOTE_MIN_HEIGHT);
    const huge = applyLearnerNoteResize(note, { width: 9999, height: 40 });
    expect(huge.width).toBe(LEARNER_NOTE_MAX_WIDTH);

    // Screen position shares block transform
    const screen = learnerNoteScreenPosition({
      x: note.x,
      y: note.y,
      panX: 100,
      panY: 50,
      zoom: 1,
    });
    expect(screen.left).toBeCloseTo(note.x + 100, 5);
    expect(screen.top).toBeCloseTo(note.y + 50, 5);

    const layer = learnerNoteLayerStyle(note);
    expect(layer.left).toBe(note.x);
    expect(layer.top).toBe(note.y);
    expect(layer.width).toBe(note.width);

    // Collapse + CRUD
    const collapsed = toggleLearnerMapNoteCollapsed(note);
    expect(collapsed.collapsed).toBe(true);
    let list = upsertLearnerMapNote([], note);
    list = deleteLearnerMapNote(list, note.id);
    expect(list).toHaveLength(0);

    // v1 col/row migrates to world
    const fromV1 = parseLearnerMapNotes([
      { id: "old", body: "m", col: 2, row: 3, collapsed: false },
    ]);
    expect(fromV1[0].x).toBe(2 * SKILL_GRID_PITCH);
    expect(fromV1[0].y).toBe(3 * SKILL_GRID_PITCH);

    writeEvidence(
      "learner-notes-plane-model.log",
      [
        "center=" + JSON.stringify(center),
        "note=" + JSON.stringify(note),
        "dragged_x=" + dragged.x,
        "tiny_w=" + tiny.width,
        "layer=" + JSON.stringify(layer),
        "v1_x=" + fromV1[0].x,
        "agnostic=" + learnerMapNoteIsBlockAgnostic(note),
      ].join("\n"),
    );
  });
});

describe("plane coords under pan/zoom", () => {
  it("center drop and drag move predictably with pan/zoom", () => {
    const zoom = 1.5;
    const panX = -40;
    const panY = 80;
    const vw = 1000;
    const vh = 700;
    const note = createLearnerMapNoteAtViewportCenter({
      viewportWidth: vw,
      viewportHeight: vh,
      panX,
      panY,
      zoom,
      id: "z1",
    });
    const screenBefore = learnerNoteScreenPosition({
      x: note.x,
      y: note.y,
      panX,
      panY,
      zoom,
    });
    // Center of note roughly at viewport center
    const noteCenterScreenX = screenBefore.left + (note.width * zoom) / 2;
    const noteCenterScreenY = screenBefore.top + (note.height * zoom) / 2;
    expect(noteCenterScreenX).toBeCloseTo(vw / 2, 0);
    expect(noteCenterScreenY).toBeCloseTo(vh / 2, 0);

    // Pan change moves screen position but not stored world coords
    const screenPanned = learnerNoteScreenPosition({
      x: note.x,
      y: note.y,
      panX: panX + 30,
      panY,
      zoom,
    });
    expect(screenPanned.left - screenBefore.left).toBeCloseTo(30, 5);

    // Drag at zoom: 15 screen px → 10 world
    const moved = applyLearnerNoteDragDelta(note, {
      dxScreen: 15,
      dyScreen: 0,
      zoom,
    });
    expect(moved.x - note.x).toBeCloseTo(15 / zoom, 5);

    writeEvidence(
      "learner-notes-plane-coords.log",
      [
        "note=" + JSON.stringify({ x: note.x, y: note.y, w: note.width, h: note.height }),
        "screen_center_x=" + noteCenterScreenX,
        "screen_center_y=" + noteCenterScreenY,
        "pan_delta_screen=" + (screenPanned.left - screenBefore.left),
        "drag_world_dx=" + (moved.x - note.x),
        "zoom=" + zoom,
      ].join("\n"),
    );
  });
});

/**
 * Build a tiny Element.closest-like tree for drag-start gate tests.
 * Selectors supported: tag names, [attr], [attr=value] (quoted).
 */
function makePointerTree(spec: {
  tag: string;
  attrs?: Record<string, string>;
  children?: ReturnType<typeof makePointerTree>[];
}): LearnerNotePointerTargetLike & {
  tagName: string;
  attrs: Record<string, string>;
  parent: (LearnerNotePointerTargetLike & { tagName: string; attrs: Record<string, string> }) | null;
  children: ReturnType<typeof makePointerTree>[];
} {
  const node: ReturnType<typeof makePointerTree> = {
    tagName: spec.tag.toUpperCase(),
    attrs: spec.attrs ?? {},
    parent: null,
    children: [],
    closest(selector: string) {
      let cur: typeof node | null = node;
      while (cur) {
        if (matchesSelector(cur, selector)) return cur;
        cur = cur.parent as typeof node | null;
      }
      return null;
    },
  };
  for (const child of spec.children ?? []) {
    child.parent = node;
    node.children.push(child);
  }
  return node;
}

function matchesSelector(
  node: { tagName: string; attrs: Record<string, string> },
  selector: string,
): boolean {
  // comma-separated alternatives
  const parts = selector.split(",").map((s) => s.trim());
  return parts.some((sel) => {
    if (sel.startsWith("[") && sel.endsWith("]")) {
      const inner = sel.slice(1, -1);
      const eq = inner.indexOf("=");
      if (eq === -1) return Object.prototype.hasOwnProperty.call(node.attrs, inner);
      const key = inner.slice(0, eq);
      let val = inner.slice(eq + 1);
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      return node.attrs[key] === val;
    }
    return node.tagName === sel.toUpperCase();
  });
}

describe("drag-start gate + pure gesture commit path", () => {
  it("allows drag on dedicated handle surface; rejects button-covered targets", () => {
    // Shipped layout: drag-handle div (non-button) + separate collapse/delete buttons.
    const label = makePointerTree({
      tag: "span",
      attrs: { "data-learner-note-label": "true" },
    });
    const dragHandle = makePointerTree({
      tag: "div",
      attrs: { "data-learner-note-drag-handle": "true" },
      children: [label],
    });
    const collapseBtn = makePointerTree({
      tag: "button",
      attrs: {
        "data-learner-note-collapse": "true",
        "data-learner-note-no-drag": "true",
      },
    });
    const header = makePointerTree({
      tag: "div",
      attrs: { "data-learner-note-header": "true" },
      children: [dragHandle, collapseBtn],
    });
    void header;

    // Pointer on label inside drag handle → drag allowed
    expect(learnerNotePointerAllowsDragStart(label)).toBe(true);
    expect(learnerNotePointerAllowsDragStart(dragHandle)).toBe(true);
    // Pointer on collapse button → drag rejected (control)
    expect(learnerNotePointerAllowsDragStart(collapseBtn)).toBe(false);

    // Anti-pattern: button-covered header (old bug) — entire surface is a button
    const coveredLabel = makePointerTree({ tag: "span" });
    const coveredButton = makePointerTree({
      tag: "button",
      attrs: { "data-learner-note-collapse": "true", class: "flex-1" },
      children: [coveredLabel],
    });
    const brokenHandle = makePointerTree({
      tag: "div",
      attrs: { "data-learner-note-drag-handle": "true" },
      children: [coveredButton],
    });
    void brokenHandle;
    // Clicking the visible "drag" label inside the button must NOT start drag
    expect(learnerNotePointerAllowsDragStart(coveredLabel)).toBe(false);
    expect(learnerNotePointerAllowsDragStart(coveredButton)).toBe(false);

    // Outside any handle
    const orphan = makePointerTree({ tag: "div" });
    expect(learnerNotePointerAllowsDragStart(orphan)).toBe(false);
    expect(learnerNotePointerAllowsDragStart(null)).toBe(false);

    // Pure move/resize live box + commit-from-ref (no React state lag)
    const origin = {
      originLeft: 100,
      originTop: 200,
      originWidth: 168,
      originHeight: 120,
      startClientX: 50,
      startClientY: 50,
      zoom: 2,
    };
    // 20 screen px → 10 world at zoom 2
    const moved = learnerNoteLiveBoxFromPointerMove({
      kind: "move",
      ...origin,
      clientX: 70,
      clientY: 60,
    });
    expect(moved.left).toBe(110);
    expect(moved.top).toBe(205);
    // Commit from last box on the drag ref (simulate pointerup with no re-render)
    const dragRefLast = moved;
    const commitMove = learnerNoteCommitFromGestureBox("move", dragRefLast);
    expect(commitMove).toEqual({ kind: "move", x: 110, y: 205 });

    // Zero-move release still commits origin (ref holds last = origin at start)
    const originBox = learnerNoteLiveBoxFromPointerMove({
      kind: "move",
      ...origin,
      clientX: origin.startClientX,
      clientY: origin.startClientY,
    });
    expect(learnerNoteCommitFromGestureBox("move", originBox)).toEqual({
      kind: "move",
      x: 100,
      y: 200,
    });

    const resized = learnerNoteLiveBoxFromPointerMove({
      kind: "resize",
      ...origin,
      clientX: 90,
      clientY: 90,
    });
    // +40/+40 screen → +20/+20 world
    expect(resized.width).toBe(188);
    expect(resized.height).toBe(140);
    const commitResize = learnerNoteCommitFromGestureBox("resize", resized);
    expect(commitResize.kind).toBe("resize");
    if (commitResize.kind === "resize") {
      expect(commitResize.width).toBe(188);
      expect(commitResize.height).toBe(140);
    }

    writeEvidence(
      "learner-notes-plane-drag-gate.log",
      [
        "handle_label_allows=" + learnerNotePointerAllowsDragStart(label),
        "collapse_button_rejects=" + !learnerNotePointerAllowsDragStart(collapseBtn),
        "button_covered_label_rejects=" +
          !learnerNotePointerAllowsDragStart(coveredLabel),
        "commit_move=" + JSON.stringify(commitMove),
        "commit_resize=" + JSON.stringify(commitResize),
        "zero_move_commit=" +
          JSON.stringify(learnerNoteCommitFromGestureBox("move", originBox)),
      ].join("\n"),
    );
  });
});

describe("creator notes: visible in learner; not deletable by learner", () => {
  it("workspace creator notes merge into learner view; delete gated", () => {
    const storage = memoryStore();
    const creatorOps = creatorMapNotesStoreOps({
      workspaceId: "ws",
      storage,
    });
    const learnerOps = learnerMapNotesStoreOps({
      workspaceId: "ws",
      learnerScopeId: "u1",
      storage,
    });

    const authorNote = creatorOps.createAtViewportCenter(
      {
        viewportWidth: 400,
        viewportHeight: 300,
        panX: 0,
        panY: 0,
        zoom: 1,
      },
      { id: "auth1", body: "read me" },
    );
    expect(authorNote.source).toBe("creator");
    expect(creatorMapNotesStorageKey({ workspaceId: "ws" })).toMatch(
      /creatorMapNotes/,
    );

    const personal = learnerOps.createAtViewportCenter(
      {
        viewportWidth: 400,
        viewportHeight: 300,
        panX: 0,
        panY: 0,
        zoom: 1,
      },
      { id: "mine", body: "private" },
    );
    expect(personal.source).toBe("learner");

    // Creator mode: only author notes
    const creatorView = listVisibleMapNotes({
      workspaceId: "ws",
      learnerMode: false,
      storage,
    });
    expect(creatorView).toHaveLength(1);
    expect(creatorView[0].id).toBe(authorNote.id);
    expect(creatorView[0].source).toBe("creator");

    // Learner mode: author + personal
    const learnerView = listVisibleMapNotes({
      workspaceId: "ws",
      learnerMode: true,
      learnerScopeId: "u1",
      storage,
    });
    expect(learnerView).toHaveLength(2);
    expect(learnerView.map((n) => n.id).sort()).toEqual(
      [authorNote.id, personal.id].sort(),
    );

    // Permissions
    expect(
      canDeleteMapNote(authorNote, { learnerMode: true }),
    ).toBe(false);
    expect(
      canEditMapNoteContent(authorNote, { learnerMode: true }),
    ).toBe(false);
    expect(
      canDeleteMapNote(authorNote, { learnerMode: false }),
    ).toBe(true);
    expect(
      canDeleteMapNote(personal, { learnerMode: true }),
    ).toBe(true);

    // Learner store must not absorb creator notes
    const personalOnly = loadLearnerMapNotes({
      workspaceId: "ws",
      learnerScopeId: "u1",
      storage,
    });
    expect(personalOnly.every((n) => n.source === "learner")).toBe(true);
    expect(loadCreatorMapNotes({ workspaceId: "ws", storage })).toHaveLength(1);

    writeEvidence(
      "learner-notes-creator-visible.log",
      [
        "creator_view_count=" + creatorView.length,
        "learner_view_count=" + learnerView.length,
        "learner_cannot_delete_creator=" +
          !canDeleteMapNote(authorNote, { learnerMode: true }),
        "creator_can_delete_creator=" +
          canDeleteMapNote(authorNote, { learnerMode: false }),
        "learner_can_delete_personal=" +
          canDeleteMapNote(personal, { learnerMode: true }),
      ].join("\n"),
    );
  });
});

describe("store + UI structural", () => {
  it("persists free position/size; Add under minimap in creator+learner; no empty-cell arm", () => {
    const storage = memoryStore();
    const ops = learnerMapNotesStoreOps({
      workspaceId: "ws",
      learnerScopeId: "u1",
      storage,
    });
    const n = ops.createAtViewportCenter(
      {
        viewportWidth: 400,
        viewportHeight: 300,
        panX: 0,
        panY: 0,
        zoom: 1,
      },
      { id: "p1", body: "persist" },
    );
    ops.update(n.id, { x: 11, y: 22, width: 200, height: 100 });
    const reloaded = loadLearnerMapNotes({
      workspaceId: "ws",
      learnerScopeId: "u1",
      storage,
    });
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].x).toBe(11);
    expect(reloaded[0].y).toBe(22);
    expect(reloaded[0].width).toBe(200);
    expect(reloaded[0].height).toBe(100);
    expect(reloaded[0].body).toBe("persist");
    expect(learnerMapNotesStorageKey({ workspaceId: "ws", learnerScopeId: "u1" })).toMatch(
      /v2/,
    );

    // Notes mount in both creator and learner when workspaceId is set
    expect(shouldMountMapNotes({ workspaceId: "ws", learnerMode: true })).toBe(
      true,
    );
    expect(shouldMountMapNotes({ workspaceId: "ws", learnerMode: false })).toBe(
      true,
    );
    expect(shouldMountMapNotes({ workspaceId: "", learnerMode: true })).toBe(
      false,
    );

    const grid = read("components/BlockSkillGrid.tsx");
    const postIt = read("components/LearnerMapNotePostIt.tsx");
    const lib = read("lib/learner-map-notes.ts");

    // Under minimap, one-shot create, no arm place — both modes
    expect(grid).toContain("data-learner-notes-under-minimap");
    expect(grid).toContain("handleMapNoteAddAtCenter");
    expect(grid).toContain("createLearnerMapNoteAtViewportCenter");
    expect(grid).toContain("data-learner-note-add");
    expect(grid).toContain("source: \"creator\"");
    expect(grid).toContain("source: \"learner\"");
    expect(grid).toContain("canDeleteMapNote");
    expect(grid).toContain("loadCreatorMapNotes");
    expect(grid).not.toContain("learnerNotePlaceArmed");
    expect(grid).not.toContain("handleLearnerNoteCreateAtCell");
    expect(grid).not.toContain("data-learner-note-place-toggle");
    expect(grid).toContain("shouldMountMapNotes");
    // Creator strip still gated for authoring tools (not notes)
    expect(grid).toMatch(/!learnerMode\s*\?\s*\(/);

    // Post-it drag + resize — dedicated non-button handle, commit from ref
    expect(postIt).toContain("data-learner-note-drag-handle");
    expect(postIt).toContain("data-learner-note-resize-handle");
    expect(postIt).toContain("onDragEnd");
    expect(postIt).toContain("onResizeEnd");
    expect(postIt).toContain("data-learner-map-note");
    expect(postIt).toContain("canDelete");
    expect(postIt).toContain("data-learner-note-can-delete");
    expect(postIt).toContain("learnerNotePointerAllowsDragStart");
    expect(postIt).toContain("learnerNoteLiveBoxFromPointerMove");
    expect(postIt).toContain("learnerNoteCommitFromGestureBox");
    expect(postIt).toContain("drag.last");
    // Drag handle is a non-button presentation surface; collapse is a sibling button
    expect(postIt).toMatch(
      /role="presentation"[\s\S]{0,80}data-learner-note-drag-handle/,
    );
    // Old bug: flex-1 collapse button inside the drag handle covering the surface
    const handleBlock = postIt.slice(
      postIt.indexOf("data-learner-note-drag-handle"),
      postIt.indexOf("data-learner-note-collapse"),
    );
    expect(handleBlock).not.toMatch(/<button/);
    expect(handleBlock).not.toMatch(/flex-1/);
    // Collapse/delete are separate controls with no-drag marker
    expect(postIt).toContain("data-learner-note-collapse");
    expect(postIt).toContain("data-learner-note-no-drag");
    // Must not gate move solely on React `live` state
    expect(postIt).not.toMatch(/if\s*\(\s*!live\s*\)\s*return/);

    expect(lib).toContain("createLearnerMapNoteAtViewportCenter");
    expect(lib).toContain("applyLearnerNoteDragDelta");
    expect(lib).toContain("applyLearnerNoteResize");
    expect(lib).toContain("viewportCenterToWorldPlane");
    expect(lib).toContain("learnerNotePointerAllowsDragStart");
    expect(lib).toContain("canDeleteMapNote");
    expect(lib).toContain("creatorMapNotesStorageKey");
    expect(lib).toContain("listVisibleMapNotes");
    expect(lib).toContain("mapNotesForPlaneRender");
    expect(lib).toContain("toggleMapNotesPlaneVisible");

    // Notes plane hide/show eye (creator + learner) — independent of annotation layers
    expect(grid).toContain("data-map-notes-visibility-toggle");
    expect(grid).toContain("data-learner-notes-visibility-toggle");
    expect(grid).toContain("data-map-notes-visibility-row");
    expect(grid).toContain("data-map-notes-plane-visible");
    expect(grid).toContain('data-map-notes-eye="open"');
    expect(grid).toContain('data-map-notes-eye="closed"');
    expect(grid).toContain("mapNotesOnPlane");
    expect(grid).toContain("mapNotesForPlaneRender");
    expect(grid).toContain("toggleMapNotesPlaneVisible");
    expect(grid).toContain("defaultMapNotesPlaneVisible");
    // Toggle present under minimap stack for both modes (not gated on learnerMode alone)
    expect(grid).toContain('data-map-notes-mode={learnerMode ? "learner" : "creator"}');
    // Annotation layer eyes remain separate
    expect(grid).toContain("data-annotation-layer-toggle");
    expect(grid).toContain('data-annotation-eye="open"');

    writeEvidence(
      "learner-notes-plane-ui.log",
      [
        "under_minimap=true",
        "center_drop=true",
        "no_arm_place=true",
        "drag_resize=true",
        "drag_handle_not_button=true",
        "commit_from_drag_ref=true",
        "creator_and_learner_add=true",
        "notes_plane_visibility_toggle=true",
        "persist_xywh=" +
          JSON.stringify({
            x: reloaded[0].x,
            y: reloaded[0].y,
            w: reloaded[0].width,
            h: reloaded[0].height,
          }),
        "mount_learner=" +
          shouldMountMapNotes({ workspaceId: "ws", learnerMode: true }),
        "mount_creator=" +
          shouldMountMapNotes({ workspaceId: "ws", learnerMode: false }),
      ].join("\n"),
    );
  });
});

describe("map notes plane hide/show (eye toggle)", () => {
  it("defaults visible; hide gates render list without clearing note collections", () => {
    expect(defaultMapNotesPlaneVisible()).toBe(true);
    expect(shouldRenderMapNotesOnPlane(true)).toBe(true);
    expect(shouldRenderMapNotesOnPlane(false)).toBe(false);

    const notes = [
      createLearnerMapNote({
        id: "a",
        x: 10,
        y: 20,
        body: "keep me",
        source: "creator",
      }),
      createLearnerMapNote({
        id: "b",
        x: 30,
        y: 40,
        body: "also keep",
        source: "learner",
      }),
    ];

    // Default shown → all notes for plane
    const shown = mapNotesForPlaneRender(notes, defaultMapNotesPlaneVisible());
    expect(shown).toHaveLength(2);
    expect(shown.map((n) => n.id).sort()).toEqual([notes[0].id, notes[1].id].sort());

    // Toggle off → empty render list
    const afterHide = toggleMapNotesPlaneVisible(true);
    expect(afterHide).toBe(false);
    const hidden = mapNotesForPlaneRender(notes, afterHide);
    expect(hidden).toHaveLength(0);
    // Source collection intact (hide does not mutate)
    expect(notes).toHaveLength(2);
    expect(notes[0].body).toBe("keep me");

    // Toggle on again
    const afterShow = toggleMapNotesPlaneVisible(afterHide);
    expect(afterShow).toBe(true);
    expect(mapNotesForPlaneRender(notes, afterShow)).toHaveLength(2);

    // Storage keys still addressable after hide cycle (no wipe)
    const storage: LearnerNotesStorage = (() => {
      const m = new Map<string, string>();
      return {
        getItem: (k) => m.get(k) ?? null,
        setItem: (k, v) => {
          m.set(k, v);
        },
        removeItem: (k) => {
          m.delete(k);
        },
      };
    })();
    saveLearnerMapNotes({
      workspaceId: "ws-hide",
      learnerScopeId: "u1",
      notes: [notes[1]],
      storage,
    });
    const reloaded = loadLearnerMapNotes({
      workspaceId: "ws-hide",
      learnerScopeId: "u1",
      storage,
    });
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].id).toBe(notes[1].id);
    // Hide flag does not touch storage
    expect(mapNotesForPlaneRender(reloaded, false)).toHaveLength(0);
    expect(
      loadLearnerMapNotes({
        workspaceId: "ws-hide",
        learnerScopeId: "u1",
        storage,
      }),
    ).toHaveLength(1);

    writeEvidence(
      "map-notes-hide-toggle-tests.log",
      [
        "default_visible=" + defaultMapNotesPlaneVisible(),
        "hide_render_count=" + mapNotesForPlaneRender(notes, false).length,
        "show_render_count=" + mapNotesForPlaneRender(notes, true).length,
        "source_intact=" + notes.length,
        "storage_after_hide=" + reloaded.length,
        "toggle_off=" + toggleMapNotesPlaneVisible(true),
        "toggle_on=" + toggleMapNotesPlaneVisible(false),
      ].join("\n"),
    );
  });

  it("UI wires notes visibility toggle for creator and learner paths", () => {
    const grid = readFileSync(join(ROOT, "components/BlockSkillGrid.tsx"), "utf8");
    // Under minimap notes toolbar — not learner-only
    expect(grid).toContain("data-learner-map-notes-toolbar");
    expect(grid).toContain("data-map-notes-visibility-toggle");
    expect(grid).toContain("data-learner-notes-visibility-toggle");
    expect(grid).toMatch(
      /data-map-notes-mode=\{learnerMode \? "learner" : "creator"\}/,
    );
    // Render path gated on mapNotesOnPlane (not raw mapNotes alone)
    expect(grid).toContain("mapNotesOnPlane.map");
    expect(grid).toContain("mapNotesForPlaneRender(mapNotes, mapNotesPlaneVisible)");
    // Annotation layer toggles still present (independent)
    expect(grid).toContain("data-annotation-layer-toggle");
    expect(grid).toContain("handleAnnotationLayerToggle");
    expect(grid).toContain("data-annotation-layers-under-notes");

    writeEvidence(
      "map-notes-hide-toggle-ui.log",
      [
        "toggle_attr=data-map-notes-visibility-toggle",
        "row_attr=data-map-notes-visibility-row",
        "plane_attr=data-map-notes-plane-visible",
        "modes=creator+learner (same stack)",
        "render_gate=mapNotesOnPlane",
        "annotation_layer_toggle_independent=true",
        "has_annotation_eye=" + grid.includes('data-annotation-eye="open"'),
        "has_notes_eye=" + grid.includes('data-map-notes-eye="open"'),
      ].join("\n"),
    );
  });
});
