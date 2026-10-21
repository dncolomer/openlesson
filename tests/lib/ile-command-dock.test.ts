import { describe, expect, it } from "vitest";
import {
  ILE_COMMAND_DOCK_PAD,
  ILE_COMMAND_DOCK_RAIL_WIDTH,
  clampIleCommandDockPoint,
  ileCommandDockAfterDrag,
  ileCommandDockFloatWidth,
  ileCanvasCommandDockVisible,
  ileCommandDockFrame,
  parseIleCommandDock,
  serializeIleCommandDock,
} from "@/lib/ile-command-dock";

const host = { hostWidth: 800, hostHeight: 600, boxWidth: 480, boxHeight: 200 };

describe("command dock", () => {
  it("stays off the canvas when the sidebar already lists the commands", () => {
    expect(ileCanvasCommandDockVisible("learn")).toBe(false);
    expect(ileCanvasCommandDockVisible("calibrate")).toBe(false);
    expect(ileCanvasCommandDockVisible("verification")).toBe(false);
    expect(ileCanvasCommandDockVisible(undefined)).toBe(true);
    expect(ileCanvasCommandDockVisible(null)).toBe(true);
  });

  it("starts at the bottom left and can dock as a full-height bar", () => {
    const corner = ileCommandDockFrame({
      state: { mode: "bottom-left", left: 0, top: 0 },
      hostWidth: 800,
      hostHeight: 600,
      floatWidth: 480,
    });
    expect(corner.left).toBe(ILE_COMMAND_DOCK_PAD);
    expect(corner.bottom).toBe(ILE_COMMAND_DOCK_PAD);
    expect(corner.top).toBeNull();
    expect(corner.width).toBe(480);

    const left = ileCommandDockFrame({
      state: { mode: "left", left: 0, top: 0 },
      hostWidth: 800,
      hostHeight: 600,
      floatWidth: 480,
    });
    expect(left.left).toBe(0);
    expect(left.top).toBe(0);
    expect(left.bottom).toBe(0);
    expect(left.width).toBe(ILE_COMMAND_DOCK_RAIL_WIDTH);

    const right = ileCommandDockFrame({
      state: { mode: "right", left: 0, top: 0 },
      hostWidth: 800,
      hostHeight: 600,
      floatWidth: 480,
    });
    expect(right.right).toBe(0);
    expect(right.left).toBeNull();
    expect(right.top).toBe(0);
    expect(right.bottom).toBe(0);
    expect(right.width).toBe(ILE_COMMAND_DOCK_RAIL_WIDTH);
  });

  it("snaps a dropped box to the nearest dock and keeps a free drop inside the canvas", () => {
    expect(ileCommandDockAfterDrag({ ...host, left: 4, top: 360 }).mode).toBe("bottom-left");
    expect(ileCommandDockAfterDrag({ ...host, left: 4, top: 40 }).mode).toBe("left");
    expect(ILE_COMMAND_DOCK_RAIL_WIDTH).toBeGreaterThan(100);
    expect(ILE_COMMAND_DOCK_RAIL_WIDTH).toBeLessThan(200);
    expect(
      ileCommandDockAfterDrag({
        ...host,
        left: 800 - ILE_COMMAND_DOCK_RAIL_WIDTH,
        top: 0,
        boxWidth: ILE_COMMAND_DOCK_RAIL_WIDTH,
        boxHeight: 600,
      }).mode,
    ).toBe("right");
    const free = ileCommandDockAfterDrag({ ...host, left: 180, top: 80 });
    expect(free.mode).toBe("free");
    expect(free.left).toBe(180);
    expect(free.top).toBe(80);

    const shoved = ileCommandDockAfterDrag({ ...host, left: 200, top: 900 });
    expect(shoved.mode).toBe("free");
    expect(shoved.left).toBe(200);
    expect(shoved.top).toBe(600 - 200 - ILE_COMMAND_DOCK_PAD);

    const tallLeft = ileCommandDockAfterDrag({
      ...host,
      left: 0,
      top: 0,
      boxWidth: 320,
      boxHeight: 600,
    });
    expect(tallLeft.mode).toBe("left");
  });

  it("keeps a saved dock and ignores a broken one", () => {
    const saved = serializeIleCommandDock({ mode: "right", left: 12, top: 4 });
    expect(parseIleCommandDock(saved)).toEqual({ mode: "right", left: 12, top: 4 });
    expect(parseIleCommandDock("nope").mode).toBe("bottom-left");
    expect(parseIleCommandDock(null).mode).toBe("bottom-left");
    expect(ileCommandDockFloatWidth(700, 800)).toBe(480);
    expect(clampIleCommandDockPoint({ ...host, left: 20, top: 30 })).toEqual({ left: 20, top: 30 });
  });
});
