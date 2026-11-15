import { describe, expect, it } from "vitest";
import { convertToExcalidrawElements } from "@/lib/learn-work-canvas";
import {
  classifyLaserStroke,
  emptyLaserGestureSession,
  finishLaserStroke,
  flushPendingLaserGesture,
  ileWorkCanvasPointerNextTool,
  ileWorkCanvasPointerToolActive,
  laserGestureTargetAt,
  LASER_DOUBLE_LINE_MS,
  type LaserStroke,
} from "@/lib/learn-work-canvas-laser-gestures";

function stroke(points: Array<[number, number]>): LaserStroke {
  return points.map(([x, y], i) => ({ x, y, t: i * 16 }));
}

function box(id: string, x: number, y: number) {
  const el = convertToExcalidrawElements([{ type: "rectangle", x, y, width: 80, height: 48 }])[0]!;
  el.id = id;
  return el;
}

describe("laser stroke shapes", () => {
  it("reads a straight trail as a line", () => {
    expect(classifyLaserStroke(stroke([[0, 40], [40, 41], [80, 39], [130, 42]]))).toBe("line");
  });

  it("reads a question mark trail", () => {
    expect(
      classifyLaserStroke(
        stroke([
          [18, 10],
          [30, 4],
          [50, 6],
          [62, 18],
          [52, 32],
          [36, 42],
          [32, 58],
          [32, 78],
        ]),
      ),
    ).toBe("question-mark");
  });

  it("ignores a tiny jab", () => {
    expect(classifyLaserStroke(stroke([[10, 10], [12, 11], [14, 10]]))).toBe("unknown");
  });

  it("ignores a round scribble", () => {
    const circle: Array<[number, number]> = [];
    for (let i = 0; i <= 16; i += 1) {
      const a = (Math.PI * 2 * i) / 16;
      circle.push([40 + Math.cos(a) * 28, 40 + Math.sin(a) * 28]);
    }
    expect(classifyLaserStroke(stroke(circle))).toBe("unknown");
  });
});

describe("laser gesture commands", () => {
  const host = box("host", 0, 0);
  const other = box("other", 240, 0);
  const elements = [host, other];

  it("maps a question mark over a mark to Define", () => {
    const result = finishLaserStroke({
      session: emptyLaserGestureSession(),
      elements,
      now: 0,
      stroke: stroke([
        [18, 10],
        [30, 4],
        [50, 6],
        [62, 18],
        [52, 32],
        [36, 42],
        [32, 58],
        [32, 78],
      ]),
    });
    expect(result.fire).toEqual({ command: "define", targetId: "host" });
    expect(result.waitMs).toBeNull();
  });

  it("maps a line from a mark into empty space to pending Concepts", () => {
    const result = finishLaserStroke({
      session: emptyLaserGestureSession(),
      elements,
      now: 10,
      stroke: stroke([
        [40, 24],
        [80, 24],
        [140, 26],
        [200, 24],
      ]),
    });
    expect(result.fire).toBeNull();
    expect(result.waitMs).toBe(LASER_DOUBLE_LINE_MS);
    expect(result.session.pending?.targetId).toBe("host");
    const flushed = flushPendingLaserGesture(result.session, 10 + LASER_DOUBLE_LINE_MS);
    expect(flushed.fire).toEqual({ command: "concepts", targetId: "host" });
  });

  it("maps two quick lines from a mark to Subdivide", () => {
    const only = [host];
    const first = finishLaserStroke({
      session: emptyLaserGestureSession(),
      elements: only,
      now: 0,
      stroke: stroke([
        [40, 24],
        [90, 24],
        [150, 25],
        [210, 24],
      ]),
    });
    const second = finishLaserStroke({
      session: first.session,
      elements: only,
      now: 120,
      stroke: stroke([
        [36, 30],
        [100, 32],
        [160, 30],
        [220, 31],
      ]),
    });
    expect(second.fire).toEqual({ command: "breakdown", targetId: "host" });
  });

  it("does not fire when a line lands on another mark", () => {
    const result = finishLaserStroke({
      session: emptyLaserGestureSession(),
      elements,
      now: 0,
      stroke: stroke([
        [40, 24],
        [120, 20],
        [200, 18],
        [260, 20],
      ]),
    });
    expect(result.fire).toBeNull();
    expect(result.session.pending).toBeNull();
  });

  it("snaps to the closest solid mark", () => {
    expect(laserGestureTargetAt(elements, { x: 10, y: 10 })?.id).toBe("host");
    expect(laserGestureTargetAt(elements, { x: 250, y: 10 })?.id).toBe("other");
    expect(laserGestureTargetAt(elements, { x: 800, y: 800 })).toBeNull();
  });
});

describe("laser pointer toggle", () => {
  it("turns the laser on from selection and off back to selection", () => {
    expect(ileWorkCanvasPointerToolActive({ type: "laser" })).toBe(true);
    expect(ileWorkCanvasPointerToolActive({ type: "selection" })).toBe(false);
    expect(ileWorkCanvasPointerNextTool(false)).toEqual({ type: "laser" });
    expect(ileWorkCanvasPointerNextTool(true)).toEqual({ type: "selection" });
  });
});
