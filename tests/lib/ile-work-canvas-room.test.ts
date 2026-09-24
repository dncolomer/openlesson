/**
 * The Work/PiP canvas-room peer channel is gone. The main board stays one canvas.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ileCompactPaintKey } from "@/lib/ile-blur-screenshare";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("ILE Work canvas has no PiP peer channel", () => {
  it("does not subscribe a second collaborator", () => {
    expect(existsSync(join(ROOT, "lib/ile-work-canvas-room.ts"))).toBe(false);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).not.toContain("subscribeIleWorkCanvasRoom");
    expect(canvas).not.toContain("publishIleWorkCanvasRoom");
    expect(canvas).not.toContain("ile-work-canvas-room");
    expect(canvas).not.toContain("peerId");
    expect(canvas).not.toContain('from: "pip"');
    expect(canvas).toContain("export function WorkCanvas");
    expect(canvas).toContain("boardId");
    expect(canvas).toContain("bindIleSurfaceEditorEvents");
    expect(canvas).toContain("IleExcalidrawErrorBoundary");

    const view = read("components/SessionView.tsx");
    expect(view).not.toContain('renderWorkCanvas("pip")');
    expect(view).not.toContain("peerId");
    expect(view).toContain("boardId={boardId}");
    expect(view).toContain("<WorkCanvas");

    const scout = read("components/scout-tap/scout-tap-phases.tsx");
    const tap = read("components/tap-score/tap-score-phases.tsx");
    expect(scout).not.toContain("peerId");
    expect(tap).not.toContain("peerId");
    expect(scout).toContain("boardId=");
    expect(tap).toContain("boardId=");

    const hook = read("lib/useIleBlurScreenshare.tsx");
    expect(hook).not.toContain("ileCompactPaintKey");
    expect(hook).not.toContain("requestWindow");
    expect(ileCompactPaintKey({ isScreenSharing: false })).toBe(
      ileCompactPaintKey({ isScreenSharing: false, formingText: "" }),
    );
    expect(ileCompactPaintKey({ isScreenSharing: true })).not.toBe(
      ileCompactPaintKey({ isScreenSharing: false }),
    );
  });
});
