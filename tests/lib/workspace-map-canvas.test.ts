import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Workspace map Excalidraw canvas: pure scene normalize/persist + structural UI wire.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  emptyWorkspaceMapCanvasScene,
  normalizeWorkspaceMapCanvasScene,
  prepareWorkspaceMapCanvasPersist,
  serializeWorkspaceMapCanvasScene,
  workspaceMapCanvasSceneHasContent,
} from "@/lib/workspace-map-canvas";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.MAP_CANVAS_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-94d39669e869/implementer";

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

describe("normalizeWorkspaceMapCanvasScene", () => {
  it("empty/missing/invalid → blank valid scene", () => {
    const blank = emptyWorkspaceMapCanvasScene();
    expect(normalizeWorkspaceMapCanvasScene(null)).toEqual(blank);
    expect(normalizeWorkspaceMapCanvasScene(undefined)).toEqual(blank);
    expect(normalizeWorkspaceMapCanvasScene("")).toEqual(blank);
    expect(normalizeWorkspaceMapCanvasScene("not-json")).toEqual(blank);
    expect(normalizeWorkspaceMapCanvasScene(42)).toEqual(blank);
  });

  it("round-trips elements/appState/files and strips collaborators", () => {
    const raw = {
      elements: [{ id: "a", type: "rectangle", x: 1, y: 2 }],
      appState: {
        viewBackgroundColor: "#111",
        collaborators: new Map([["u1", {}]]),
        zoom: { value: 1 },
      },
      files: { f1: { mimeType: "image/png" } },
    };
    const scene = normalizeWorkspaceMapCanvasScene(raw);
    expect(scene.elements).toHaveLength(1);
    expect(scene.appState.viewBackgroundColor).toBe("#111");
    expect(scene.appState.collaborators).toBeUndefined();
    expect(scene.files).toHaveProperty("f1");
    expect(workspaceMapCanvasSceneHasContent(scene)).toBe(true);
    expect(workspaceMapCanvasSceneHasContent(emptyWorkspaceMapCanvasScene())).toBe(
      false,
    );

    const json = serializeWorkspaceMapCanvasScene(scene);
    const again = normalizeWorkspaceMapCanvasScene(json);
    expect(again.elements).toHaveLength(1);

    const prepared = prepareWorkspaceMapCanvasPersist(raw);
    expect(prepared.scene.elements).toHaveLength(1);
    expect(() => JSON.parse(prepared.json)).not.toThrow();

    writeEvidence(
      "excalidraw-persist.log",
      [
        "blankElements=" + emptyWorkspaceMapCanvasScene().elements.length,
        "normalizedCount=" + scene.elements.length,
        "hasContent=" + workspaceMapCanvasSceneHasContent(scene),
        "noCollaborators=" + !("collaborators" in scene.appState),
        "roundTrip=" + (again.elements.length === 1),
      ].join("\n"),
    );
  });
});

describe("structural: map right pane has no workspace canvas", () => {
  it("WorkspaceMapAuthoringPane does not mount Excalidraw canvas or news", () => {
    const pane = read("components/WorkspaceMapAuthoringPane.tsx");
    expect(pane).toContain("data-workspace-map-authoring-pane");
    expect(pane).not.toContain("WorkspaceMapCanvas");
    expect(pane).not.toContain("data-map-right-canvas");
    expect(pane).not.toContain("WorkspaceTopicNewsWidget");
    expect(pane).not.toContain("@excalidraw/excalidraw");

    const view = readWorkspaceViewSurface();
    expect(view).toContain("WorkspaceMapAuthoringPane");
    expect(view).not.toMatch(
      /WorkspaceMapAuthoringPane[\s\S]{0,200}workspaceId=\{workspaceId\}/,
    );

    writeEvidence(
      "map-right-canvas-ui.log",
      [
        "noNews=" + !pane.includes("WorkspaceTopicNewsWidget"),
        "noCanvas=" + !pane.includes("WorkspaceMapCanvas"),
        "noExcalidraw=" + !pane.includes("@excalidraw/excalidraw"),
        "hasMapToolsPane=" + pane.includes("data-workspace-map-authoring-pane"),
      ].join("\n"),
    );
  });
});
