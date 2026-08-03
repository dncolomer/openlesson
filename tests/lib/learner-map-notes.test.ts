/**
 * Learner map post-it notes: pure model, placement math, store, UI wiring.
 * Drives shipped helpers — no re-implementation of CRUD or transform.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  SKILL_GRID_PITCH,
} from "@/lib/block-skill-grid";
import {
  clientPointToLearnerNoteCoords,
  createLearnerMapNote,
  deleteLearnerMapNote,
  learnerMapNoteIsBlockAgnostic,
  learnerMapNotesStorageKey,
  learnerMapNotesStoreOps,
  learnerNoteLayerStyle,
  learnerNoteScreenPosition,
  learnerNoteWorldOrigin,
  loadLearnerMapNotes,
  normalizeLearnerNoteBody,
  normalizeLearnerNoteCoord,
  parseLearnerMapNotes,
  pointerLocalToLearnerNoteCoords,
  saveLearnerMapNotes,
  shouldMountLearnerMapNotes,
  toggleLearnerMapNoteCollapsed,
  updateLearnerMapNote,
  upsertLearnerMapNote,
  LEARNER_NOTE_BODY_MAX,
  type LearnerNotesStorage,
} from "@/lib/learner-map-notes";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.LEARNER_MAP_NOTES_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-e24e312399ae/implementer";

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

describe("learner note model CRUD + collapse", () => {
  it("create/update/delete + collapse; coords independent of block ids", () => {
    const note = createLearnerMapNote({
      id: "n1",
      body: "  remember the quadratic  ",
      col: 3,
      row: 5,
      now: 1000,
    });
    expect(note.id).toBe("lnote-n1");
    expect(note.body).toBe("  remember the quadratic  ".slice(0, LEARNER_NOTE_BODY_MAX));
    expect(note.col).toBe(3);
    expect(note.row).toBe(5);
    expect(note.collapsed).toBe(false);
    expect(learnerMapNoteIsBlockAgnostic(note)).toBe(true);
    // No block linkage fields on model
    expect("blockId" in note).toBe(false);
    expect("block_id" in note).toBe(false);

    const updated = updateLearnerMapNote(note, {
      body: "new text",
      col: 4.5,
      now: 2000,
    });
    expect(updated.body).toBe("new text");
    expect(updated.col).toBe(4.5);
    expect(updated.row).toBe(5);
    expect(updated.updatedAt).toBe(2000);
    expect(updated.createdAt).toBe(1000);

    const collapsed = toggleLearnerMapNoteCollapsed(updated, 3000);
    expect(collapsed.collapsed).toBe(true);
    const expanded = toggleLearnerMapNoteCollapsed(collapsed, 4000);
    expect(expanded.collapsed).toBe(false);

    let list = upsertLearnerMapNote([], note);
    list = upsertLearnerMapNote(list, updated);
    expect(list).toHaveLength(1);
    expect(list[0].body).toBe("new text");
    list = deleteLearnerMapNote(list, note.id);
    expect(list).toHaveLength(0);

    // Body normalize caps length; invalid coords fall back
    expect(normalizeLearnerNoteBody("x".repeat(500)).length).toBe(
      LEARNER_NOTE_BODY_MAX,
    );
    expect(normalizeLearnerNoteCoord(Number.NaN, 7)).toBe(7);
    expect(normalizeLearnerNoteCoord("2.25")).toBe(2.25);

    // parse strips accidental blockId and keeps map coords
    const parsed = parseLearnerMapNotes([
      {
        id: "a",
        body: "hi",
        col: 1,
        row: 2,
        blockId: "SHOULD_IGNORE",
        collapsed: true,
      },
      { id: "", body: "bad" },
      null,
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].col).toBe(1);
    expect(parsed[0].row).toBe(2);
    expect(parsed[0].collapsed).toBe(true);
    expect(learnerMapNoteIsBlockAgnostic(parsed[0])).toBe(true);

    writeEvidence(
      "learner-map-notes-model.log",
      [
        "create=" + JSON.stringify(note),
        "update=" + JSON.stringify(updated),
        "collapsed=" + collapsed.collapsed,
        "expanded=" + expanded.collapsed,
        "after_delete_n=" + list.length,
        "body_max=" + LEARNER_NOTE_BODY_MAX,
        "parsed=" + JSON.stringify(parsed),
        "agnostic=" + learnerMapNoteIsBlockAgnostic(note),
      ].join("\n"),
    );
  });
});

describe("learner note map placement transform", () => {
  it("world origin matches block cell layout; screen moves with pan/zoom/coords", () => {
    // Blocks use left = col * PITCH, top = row * PITCH
    const world = learnerNoteWorldOrigin({ col: 2, row: 3 });
    expect(world.x).toBe(2 * SKILL_GRID_PITCH);
    expect(world.y).toBe(3 * SKILL_GRID_PITCH);

    const layer = learnerNoteLayerStyle({ col: 2, row: 3 });
    expect(layer.left).toBe(world.x);
    expect(layer.top).toBe(world.y);

    const atIdentity = learnerNoteScreenPosition({
      col: 2,
      row: 3,
      panX: 0,
      panY: 0,
      zoom: 1,
    });
    expect(atIdentity.left).toBe(world.x);
    expect(atIdentity.top).toBe(world.y);

    const panned = learnerNoteScreenPosition({
      col: 2,
      row: 3,
      panX: 40,
      panY: -10,
      zoom: 1,
    });
    expect(panned.left).toBe(atIdentity.left + 40);
    expect(panned.top).toBe(atIdentity.top - 10);

    const zoomed = learnerNoteScreenPosition({
      col: 2,
      row: 3,
      panX: 0,
      panY: 0,
      zoom: 2,
    });
    expect(zoomed.left).toBe(world.x * 2);
    expect(zoomed.top).toBe(world.y * 2);

    // Moving the note's stored coords moves placement predictably
    const moved = learnerNoteScreenPosition({
      col: 3,
      row: 3,
      panX: 0,
      panY: 0,
      zoom: 1,
    });
    expect(moved.left - atIdentity.left).toBe(SKILL_GRID_PITCH);
    expect(moved.top).toBe(atIdentity.top);

    // Inverse pointer → coords (shared transform)
    const coords = pointerLocalToLearnerNoteCoords({
      localX: world.x + 40,
      localY: world.y - 10,
      panX: 40,
      panY: -10,
      zoom: 1,
    });
    expect(coords.col).toBeCloseTo(2, 5);
    expect(coords.row).toBeCloseTo(3, 5);

    const fromClient = clientPointToLearnerNoteCoords({
      clientX: 100 + world.x,
      clientY: 50 + world.y,
      viewportLeft: 100,
      viewportTop: 50,
      panX: 0,
      panY: 0,
      zoom: 1,
    });
    expect(fromClient.col).toBeCloseTo(2, 5);
    expect(fromClient.row).toBeCloseTo(3, 5);

    writeEvidence(
      "learner-map-notes-coords.log",
      [
        "pitch=" + SKILL_GRID_PITCH,
        "world=" + JSON.stringify(world),
        "layer=" + JSON.stringify(layer),
        "screen_id=" + JSON.stringify(atIdentity),
        "screen_pan=" + JSON.stringify(panned),
        "screen_zoom=" + JSON.stringify(zoomed),
        "moved_col=" + JSON.stringify(moved),
        "inverse=" + JSON.stringify(coords),
      ].join("\n"),
    );
  });
});

describe("learner notes store persistence", () => {
  it("load/save/CRUD survive reload for same workspace+learner scope", () => {
    const storage = memoryStore();
    const ops = learnerMapNotesStoreOps({
      workspaceId: "ws-1",
      learnerScopeId: "user-9",
      storage,
    });
    expect(ops.list()).toEqual([]);
    const created = ops.create({
      id: "sticky1",
      body: "persist me",
      col: 1,
      row: 2,
      now: 10,
    });
    expect(ops.list()).toHaveLength(1);
    expect(ops.list()[0].body).toBe("persist me");

    // Simulate reload: new ops instance same storage/key
    const reloaded = loadLearnerMapNotes({
      workspaceId: "ws-1",
      learnerScopeId: "user-9",
      storage,
    });
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].id).toBe(created.id);
    expect(reloaded[0].col).toBe(1);

    ops.update(created.id, { body: "updated", collapsed: true, now: 20 });
    expect(ops.list()[0].body).toBe("updated");
    expect(ops.list()[0].collapsed).toBe(true);

    // Different scope → empty
    expect(
      loadLearnerMapNotes({
        workspaceId: "ws-1",
        learnerScopeId: "other-user",
        storage,
      }),
    ).toHaveLength(0);

    ops.remove(created.id);
    expect(ops.list()).toHaveLength(0);

    const key = learnerMapNotesStorageKey({
      workspaceId: "ws-1",
      learnerScopeId: "user-9",
    });
    expect(key).toContain("ws-1");
    expect(key).toContain("user-9");

    // Direct save round-trip
    const n = createLearnerMapNote({
      id: "r",
      body: "round",
      col: 0,
      row: 0,
    });
    saveLearnerMapNotes({
      workspaceId: "ws-2",
      learnerScopeId: "u",
      notes: [n],
      storage,
    });
    expect(
      loadLearnerMapNotes({
        workspaceId: "ws-2",
        learnerScopeId: "u",
        storage,
      })[0].body,
    ).toBe("round");
  });
});

describe("learner notes UI wiring (structural)", () => {
  it("learner map mounts post-it CRUD; creator chrome does not", () => {
    const grid = read("components/BlockSkillGrid.tsx");
    const postIt = read("components/LearnerMapNotePostIt.tsx");
    const view = read("components/WorkspaceView.tsx");
    const sessions = read("components/SessionList.tsx");
    const lib = read("lib/learner-map-notes.ts");

    expect(shouldMountLearnerMapNotes({ learnerMode: true })).toBe(true);
    expect(shouldMountLearnerMapNotes({ learnerMode: false })).toBe(false);

    // Post-it component: collapsible + edit/delete
    expect(postIt).toContain("data-learner-map-note");
    expect(postIt).toContain("data-learner-note-collapse");
    expect(postIt).toContain("data-learner-note-delete");
    expect(postIt).toContain("data-learner-note-edit");
    expect(postIt).toContain("data-learner-note-save");
    expect(postIt).toContain("data-learner-note-postit");

    // Map mounts notes + add toolbar only via shouldMountLearnerMapNotes / learnerMode
    expect(grid).toContain("LearnerMapNotePostIt");
    expect(grid).toContain("shouldMountLearnerMapNotes");
    expect(grid).toContain("data-learner-map-notes-toolbar");
    expect(grid).toContain("data-learner-note-add");
    expect(grid).toContain("handleLearnerNoteCreateAtCell");
    expect(grid).toContain("loadLearnerMapNotes");
    expect(grid).toContain("saveLearnerMapNotes");
    expect(grid).toContain("learnerNoteLayerStyle");
    // Creator tool strip remains gated off in learner mode
    expect(grid).toMatch(/!learnerMode\s*\?\s*\(/);

    // Host wires learner scope
    expect(view).toContain("learnerScopeId");
    expect(sessions).toContain("learnerScopeId");

    // Model has no block id fields in create path
    expect(lib).toContain("block-agnostic");
    expect(lib).not.toMatch(/createLearnerMapNote[\s\S]{0,200}blockId/);

    writeEvidence(
      "learner-map-notes-ui.log",
      [
        "mount_learner_true=" + shouldMountLearnerMapNotes({ learnerMode: true }),
        "mount_learner_false=" + shouldMountLearnerMapNotes({ learnerMode: false }),
        "grid_has_postit=true",
        "grid_has_add_toolbar=true",
        "postit_collapse_edit_delete=true",
        "view_scope=true",
        "storage_key_sample=" +
          learnerMapNotesStorageKey({
            workspaceId: "w",
            learnerScopeId: "u",
          }),
      ].join("\n"),
    );
  });
});
