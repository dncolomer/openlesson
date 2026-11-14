import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  commitScene,
  liveSceneElements,
  liveWorkCanvasScene,
  type LiveExcalidrawAPI,
} from "@/components/excalidraw-canvas/excalidraw-api";
import type { IleWorkCanvasElement } from "@/lib/learn-work-canvas";

function api(overrides?: Partial<LiveExcalidrawAPI>): LiveExcalidrawAPI {
  return {
    updateScene: vi.fn(),
    getSceneElements: () => [],
    getSceneElementsIncludingDeleted: () => [],
    getAppState: () => ({}),
    getFiles: () => ({}),
    scrollToContent: vi.fn(),
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
    expect(live.scrollToContent).toHaveBeenCalledTimes(1);
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
    expect(mount).toContain("excalidrawAPI={bindApi}");
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
