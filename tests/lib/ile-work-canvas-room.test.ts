import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  countIleWorkCanvasRoomPeers,
  ileWorkCanvasOtherPeer,
  ileWorkCanvasPeerLabel,
  ileWorkCanvasSceneFingerprint,
  nextIleWorkCanvasRoomNonce,
  publishIleWorkCanvasRoom,
  subscribeIleWorkCanvasRoom,
  type IleWorkCanvasRoomMessage,
} from "@/lib/ile-work-canvas-room";
import { ileCompactPaintKey } from "@/lib/ile-blur-screenshare";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("ILE Work canvas PiP room (shipped)", () => {
  it("treats Work and PiP as two local collaborators on one board", () => {
    expect(ileWorkCanvasPeerLabel("pip")).toBe("PiP");
    expect(ileWorkCanvasOtherPeer("work")).toBe("pip");
    const board = `board-${Date.now()}`;
    const seen: IleWorkCanvasRoomMessage[] = [];
    const unsubWork = subscribeIleWorkCanvasRoom(board, "work", (msg) => {
      if (msg.from !== "work") seen.push(msg);
    });
    const unsubPip = subscribeIleWorkCanvasRoom(board, "pip", () => {});
    expect(countIleWorkCanvasRoomPeers(board)).toBe(2);
    const nonce = nextIleWorkCanvasRoomNonce(board);
    publishIleWorkCanvasRoom(board, {
      kind: "scene",
      from: "pip",
      nonce,
      elements: [{ id: "a", version: 1, versionNonce: 2, isDeleted: false }],
      files: {},
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.kind).toBe("scene");
    expect(
      ileWorkCanvasSceneFingerprint(
        [{ id: "a", version: 1, versionNonce: 2, isDeleted: false }],
        {},
      ),
    ).toBe(
      ileWorkCanvasSceneFingerprint(
        [{ id: "a", version: 1, versionNonce: 2, isDeleted: false }],
        {},
      ),
    );
    unsubPip();
    unsubWork();
    expect(countIleWorkCanvasRoomPeers(board)).toBe(0);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("isCollaborating");
    expect(canvas).toContain("subscribeIleWorkCanvasRoom");
    expect(canvas).toContain("IleExcalidrawErrorBoundary");
    expect(canvas).toContain('captureUpdate: "NEVER"');
    const view = read("components/SessionView.tsx");
    expect(view).toContain('renderWorkCanvas("pip")');
    expect(view).toContain("boardId={boardId}");
    expect(view).toContain("peerId={peerId}");
    const hook = read("lib/useIleBlurScreenshare.tsx");
    expect(hook).toContain("ileCompactPaintKey");
    expect(hook).not.toContain("[input.compact, input.renderCompact, paintCompact]");
    expect(ileCompactPaintKey({ isScreenSharing: false })).toBe(
      ileCompactPaintKey({ isScreenSharing: false, formingText: "" }),
    );
    expect(ileCompactPaintKey({ isScreenSharing: true })).not.toBe(
      ileCompactPaintKey({ isScreenSharing: false }),
    );
  });
});
