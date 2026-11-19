import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, Image, Path2D } from "@napi-rs/canvas";
import { describe, expect, it, vi } from "vitest";
import {
  commitScene,
  exportWorkCanvasPng,
  exportWorkCanvasPngDataUrl,
  followViewport,
  liveSceneElements,
  liveWorkCanvasScene,
  sanitizeWorkCanvasExportElements,
  setLiveActiveTool,
  type LiveExcalidrawAPI,
} from "@/components/excalidraw-canvas/excalidraw-api";
import { convertToExcalidrawElements, type IleWorkCanvasElement } from "@/lib/learn-work-canvas";

function nodeExportEnvironment() {
  return {
    createCanvas: () => createCanvas() as unknown as HTMLCanvasElement,
    createImage: () => new Image() as unknown as HTMLImageElement,
    createPath: (d: string) => new Path2D(d) as unknown as globalThis.Path2D,
  };
}

function installNodeDomStubs() {
  const g = globalThis as typeof globalThis & { Element?: new () => unknown };
  if (typeof g.Element === "undefined") {
    class ElementStub {
      innerHTML = "";
      append() {}
      replaceChildren() {
        this.innerHTML = "";
      }
    }
    Object.defineProperty(globalThis, "Element", { value: ElementStub, configurable: true });
  }
  if (typeof (globalThis as { window?: unknown }).window === "undefined") {
    Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
  }
  if (typeof (globalThis as { navigator?: unknown }).navigator === "undefined") {
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
  }
}

function api(overrides?: Partial<LiveExcalidrawAPI>): LiveExcalidrawAPI {
  return {
    updateScene: vi.fn(),
    getSceneElements: () => [],
    getSceneElementsIncludingDeleted: () => [],
    getAppState: () => ({}),
    getFiles: () => ({}),
    setViewport: vi.fn(),
    ...overrides,
  };
}

describe("commitScene", () => {
  it("writes once through updateScene and can scroll after", () => {
    const live = api();
    const flag = { current: false };
    const mark = { id: "a", isDeleted: false } as IleWorkCanvasElement;
    expect(
      commitScene(
        live,
        { elements: [mark], appState: { selectedElementIds: { a: true } } },
        { applyingRemote: flag, scrollTo: [mark] },
      ),
    ).toBe(true);
    expect(live.updateScene).toHaveBeenCalledTimes(1);
    expect(live.updateScene).toHaveBeenCalledWith({
      elements: [mark],
      appState: { selectedElementIds: { a: true } },
    });
    expect(live.setViewport).toHaveBeenCalledTimes(1);
    expect(live.setViewport).toHaveBeenCalledWith({
      target: [mark],
      fit: "none",
      animation: false,
    });
    expect(flag.current).toBe(true);
  });

  it("keeps applyingRemote set until nested scene updates have flushed", async () => {
    const live = api();
    const flag = { current: false };
    commitScene(live, { elements: [] }, { applyingRemote: flag });
    expect(flag.current).toBe(true);
    await Promise.resolve();
    expect(flag.current).toBe(false);
  });

  it("returns false without an api and does not treat camera writes as remote", () => {
    expect(commitScene(null, { appState: { zoom: { value: 1 } } })).toBe(false);
    const live = api();
    const flag = { current: false };
    commitScene(live, { appState: { zoom: { value: 1 } } }, { remote: false, applyingRemote: flag });
    expect(flag.current).toBe(false);
    expect(live.updateScene).toHaveBeenCalledTimes(1);
  });

  it("pins Excalidraw scene callbacks so parent renders do not retrigger onChange", () => {
    const mount = readFileSync(
      join(process.cwd(), "components/excalidraw-canvas/learn-excalidraw-mount.tsx"),
      "utf8",
    );
    expect(mount).toContain("onChangeRef.current = onChange");
    expect(mount).toContain("IleExcalidrawStable");
    expect(mount).toContain("initialDataRef.current");
    expect(mount).toContain("onExcalidrawAPI={bindApi}");
    expect(mount).toContain("onChange={bindChange}");
  });

  it("reads including-deleted elements for live scene helpers", () => {
    const deleted = { id: "gone", type: "rectangle", isDeleted: true } as IleWorkCanvasElement;
    const live = api({
      getSceneElements: () => [],
      getSceneElementsIncludingDeleted: () => [deleted],
    });
    expect(liveSceneElements(live).map((el) => el.id)).toEqual(["gone"]);
    expect(liveWorkCanvasScene(live, true).elements.map((el) => el.id)).toEqual(["gone"]);
  });
});

describe("Excalidraw package adapters", () => {
  it("follows the viewport through setViewport after commitScene", () => {
    const live = api();
    const mark = { id: "b", type: "rectangle", isDeleted: false } as IleWorkCanvasElement;
    expect(followViewport(live, [mark])).toBe(true);
    expect(live.setViewport).toHaveBeenCalledWith({
      target: [mark],
      fit: "none",
      animation: false,
    });
    expect(setLiveActiveTool(live, { type: "laser" })).toBe(false);
    const withTool = api({ setActiveTool: vi.fn() });
    expect(setLiveActiveTool(withTool, { type: "laser" }, { toggle: true })).toBe(true);
    expect(withTool.setActiveTool).toHaveBeenCalledWith({ type: "laser" }, { toggle: true });
  });

  it("exports a tiny scene through the package exportScene helper as a PNG blob", async () => {
    installNodeDomStubs();
    const apiSrc = readFileSync(
      join(process.cwd(), "components/excalidraw-canvas/excalidraw-api.ts"),
      "utf8",
    );
    expect(apiSrc).toContain('await import("@excalidraw/excalidraw")');
    expect(apiSrc).toContain("exportScene");
    expect(apiSrc).toContain('type: "png"');
    expect(apiSrc).not.toContain("exportToBlob");
    expect(apiSrc).not.toContain("scrollToContent");

    const elements = convertToExcalidrawElements([
      { type: "rectangle", x: 0, y: 0, width: 48, height: 24, id: "tiny-rect" },
    ]);
    expect(elements.length).toBeGreaterThan(0);
    const blob = await exportWorkCanvasPng({
      elements,
      environment: nodeExportEnvironment(),
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toMatch(/png/i);
    const dataUrl = await exportWorkCanvasPngDataUrl({
      elements,
      environment: nodeExportEnvironment(),
    });
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(dataUrl!.length).toBeGreaterThan("data:image/png;base64,".length);
  });

  it("drops dangling arrow bindings before exportScene restore", async () => {
    const box = convertToExcalidrawElements([
      { type: "rectangle", x: 0, y: 0, width: 48, height: 24, id: "kept-rect" },
    ])[0]!;
    const [arrow] = convertToExcalidrawElements([
      { type: "arrow", x: 48, y: 12, width: 40, height: 0, id: "dangling-arrow" },
    ]);
    arrow.startBinding = { elementId: "gone-mark", focus: 0, gap: 4 };
    arrow.endBinding = { elementId: box.id, focus: 0, gap: 4 };
    const live = [box, arrow];
    const cleaned = sanitizeWorkCanvasExportElements(live);
    expect(cleaned).toHaveLength(2);
    expect(cleaned[1]!.startBinding).toBeNull();
    expect(cleaned[1]!.endBinding).toEqual({
      elementId: box.id,
      focus: 0,
      gap: 4,
      mode: "orbit",
      fixedPoint: [0.5, 0.5],
    });
    expect(cleaned[1]).not.toBe(arrow);
    expect(arrow.startBinding).toEqual({ elementId: "gone-mark", focus: 0, gap: 4 });
    arrow.startBinding = { elementId: undefined };
    expect(cleaned[1]!.endBinding).toMatchObject({ elementId: box.id, mode: "orbit" });

    installNodeDomStubs();
    const logged: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      logged.push(args.map(String).join(" "));
    });
    try {
      const blob = await exportWorkCanvasPng({
        elements: [box, arrow],
        environment: nodeExportEnvironment(),
      });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
      expect(logged.join("\n")).not.toMatch(/Could not repair binding/);
    } finally {
      spy.mockRestore();
    }
  });
});
