/**
 * ILE chapter-map notes + drawing layers persist (session scope)
 * and smaller minimap/notes/layers chrome.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createLearnerMapNote,
  creatorMapNotesStorageKey,
  loadCreatorMapNotes,
  saveCreatorMapNotes,
  shouldMountMapNotes,
  type LearnerNotesStorage,
} from "@/lib/learner-map-notes";
import {
  annotationLayersStorageKey,
  appendAnnotationStroke,
  createAnnotationLayer,
  loadAnnotationLayers,
  saveAnnotationLayers,
  upsertAnnotationLayer,
} from "@/lib/map-annotation-layers";
import {
  resolveMapOverlayPersistScope,
  mapOverlayPersistToken,
} from "@/lib/map-overlay-persist";
import {
  MINIMAP_FRAME_HEIGHT,
  MINIMAP_FRAME_HEIGHT_LEGACY,
  MINIMAP_FRAME_HEIGHT_PREV,
  MINIMAP_FRAME_WIDTH,
  MINIMAP_FRAME_WIDTH_LEGACY,
  MINIMAP_FRAME_WIDTH_PREV,
} from "@/lib/map-minimap-clusters";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-700d83987fae/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
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

describe("ILE chapter-map notes + layers persist (shipped helpers)", () => {
  it("round-trips a chapter-map note and layer without colliding with workspace store", () => {
    const storage = memoryStore();
    const chapterScope = {
      sessionId: "sess-ile-1",
      mapKind: "chapter" as const,
    };
    const workspaceScope = { workspaceId: "ws-1" };

    const note = createLearnerMapNote({
      id: "n1",
      body: "chapter plane note",
      x: 40,
      y: 80,
      source: "creator",
    });
    saveCreatorMapNotes({ ...chapterScope, notes: [note], storage });
    const chapterReload = loadCreatorMapNotes({ ...chapterScope, storage });
    expect(chapterReload).toHaveLength(1);
    expect(chapterReload[0].body).toBe("chapter plane note");
    expect(chapterReload[0].x).toBe(40);
    expect(loadCreatorMapNotes({ ...workspaceScope, storage })).toHaveLength(0);

    const layer = createAnnotationLayer({ id: "L1", name: "Ink" });
    const withStroke = appendAnnotationStroke(layer, {
      id: "st1",
      kind: "freehand",
      color: "#ffffff",
      strokeWidth: 3,
      points: [
        { x: 1, y: 2 },
        { x: 8, y: 9 },
      ],
      createdAt: 1,
    });
    saveAnnotationLayers({
      ...chapterScope,
      layers: upsertAnnotationLayer([], withStroke),
      storage,
    });
    const layerReload = loadAnnotationLayers({ ...chapterScope, storage });
    expect(layerReload).toHaveLength(1);
    expect(layerReload[0].name).toBe("Ink");
    expect(layerReload[0].strokes[0].kind).toBe("freehand");
    expect(layerReload[0].strokes[0].points?.[1].x).toBe(8);
    expect(loadAnnotationLayers({ ...workspaceScope, storage })).toHaveLength(0);

    const chapterKey = creatorMapNotesStorageKey(chapterScope);
    const workspaceKey = creatorMapNotesStorageKey(workspaceScope);
    expect(chapterKey).toContain("ile-chapter:sess-ile-1");
    expect(workspaceKey).not.toContain("ile-chapter:");
    expect(chapterKey).not.toBe(workspaceKey);
    expect(annotationLayersStorageKey(chapterScope)).toContain("ile-chapter:sess-ile-1");
    expect(annotationLayersStorageKey(workspaceScope)).not.toContain("ile-chapter:");

    expect(
      shouldMountMapNotes({ sessionId: "sess-ile-1", mapKind: "chapter" }),
    ).toBe(true);
    expect(shouldMountMapNotes({ sessionId: "", mapKind: "chapter" })).toBe(false);
    expect(
      resolveMapOverlayPersistScope({ sessionId: "sess-ile-1", mapKind: "chapter" }),
    ).toEqual({ kind: "chapter", id: "sess-ile-1" });
    expect(
      mapOverlayPersistToken({ kind: "chapter", id: "sess-ile-1" }),
    ).toBe("ile-chapter:sess-ile-1");

    writeScratch(
      "ile-chapter-notes-layers.txt",
      [
        `noteBody=${chapterReload[0].body}`,
        `noteX=${chapterReload[0].x}`,
        `wsNoteCount=${loadCreatorMapNotes({ ...workspaceScope, storage }).length}`,
        `layerName=${layerReload[0].name}`,
        `strokeKind=${layerReload[0].strokes[0].kind}`,
        `wsLayerCount=${loadAnnotationLayers({ ...workspaceScope, storage }).length}`,
        `chapterNoteKey=${chapterKey}`,
        `wsNoteKey=${workspaceKey}`,
      ].join("\n"),
    );
  });
});

describe("ILE chapter-map chrome (shipped source + frame constants)", () => {
  it("chapter map mounts notes/layers without a workspace id", () => {
    const grid = read("components/BlockSkillGrid.tsx");
    const chapter = read("components/ChapterMapPanel.tsx");
    expect(grid).toContain("resolveMapOverlayPersistScope");
    expect(grid).toContain('mapKind: suggestMode === "chapter" ? "chapter"');
    expect(grid).toContain("overlayPersist");
    expect(grid).toContain("data-learner-map-notes-toolbar");
    expect(grid).toContain("data-annotation-layers-stack");
    expect(grid).toContain("data-learner-note-add");
    expect(chapter).toContain('suggestMode="chapter"');
    expect(chapter).toContain("sessionId={sessionId}");
    expect(chapter).toContain("BlockSkillGrid");

    writeScratch(
      "ile-chapter-notes-layers-excerpts.txt",
      [
        "ChapterMapPanel: BlockSkillGrid suggestMode=chapter sessionId",
        "BlockSkillGrid: overlayPersist chapter scope + notes/layers chrome",
      ].join("\n"),
    );
  });

  it("minimap frame and notes/layers stack are smaller than 220×168 and still above 148×108", () => {
    expect(MINIMAP_FRAME_WIDTH).toBeLessThan(MINIMAP_FRAME_WIDTH_PREV);
    expect(MINIMAP_FRAME_HEIGHT).toBeLessThan(MINIMAP_FRAME_HEIGHT_PREV);
    expect(MINIMAP_FRAME_WIDTH).toBeLessThan(220);
    expect(MINIMAP_FRAME_HEIGHT).toBeLessThan(168);
    expect(MINIMAP_FRAME_WIDTH).toBeGreaterThan(MINIMAP_FRAME_WIDTH_LEGACY);
    expect(MINIMAP_FRAME_HEIGHT).toBeGreaterThan(MINIMAP_FRAME_HEIGHT_LEGACY);
    expect(MINIMAP_FRAME_WIDTH_LEGACY).toBe(148);
    expect(MINIMAP_FRAME_HEIGHT_LEGACY).toBe(108);

    const grid = read("components/BlockSkillGrid.tsx");
    expect(grid).toContain("MINIMAP_FRAME_WIDTH");
    expect(grid).toContain("MINIMAP_FRAME_HEIGHT");
    expect(grid).toContain("width: MINIMAP_FRAME_WIDTH");
    expect(grid).not.toMatch(/w-\[220px\]/);

    writeScratch(
      "ile-chapter-minimap-size.txt",
      [
        `width=${MINIMAP_FRAME_WIDTH}`,
        `height=${MINIMAP_FRAME_HEIGHT}`,
        `prevW=${MINIMAP_FRAME_WIDTH_PREV}`,
        `prevH=${MINIMAP_FRAME_HEIGHT_PREV}`,
        `legacyW=${MINIMAP_FRAME_WIDTH_LEGACY}`,
        `legacyH=${MINIMAP_FRAME_HEIGHT_LEGACY}`,
      ].join("\n"),
    );
  });
});
