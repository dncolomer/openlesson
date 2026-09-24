/**
 * getDisplayMedia runs on the main session page.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isScreenCaptureInvalidState,
  isScreenCaptureStartQuietFailure,
  isScreenCaptureUserDenied,
  resolveScreenCaptureMediaDevices,
} from "@/lib/screen-capture";

const ROOT = join(__dirname, "../..");

function gdm() {
  return async () => new MediaStream();
}

describe("resolveScreenCaptureMediaDevices (shipped)", () => {
  it("uses the main page even when the tab is hidden", () => {
    const openerGdm = gdm();
    const resolved = resolveScreenCaptureMediaDevices({
      document: { visibilityState: "hidden" },
      navigator: { mediaDevices: { getDisplayMedia: openerGdm } },
    });
    expect(resolved.source).toBe("opener");
    expect(resolved.mediaDevices?.getDisplayMedia).toBe(openerGdm);
  });

  it("uses the opener when the ILE tab is visible", () => {
    const openerGdm = gdm();
    const resolved = resolveScreenCaptureMediaDevices({
      document: { visibilityState: "visible" },
      navigator: { mediaDevices: { getDisplayMedia: openerGdm } },
    });
    expect(resolved.source).toBe("opener");
    expect(resolved.mediaDevices?.getDisplayMedia).toBe(openerGdm);
  });
});

describe("screen capture has no picture-in-picture host (shipped)", () => {
  it("does not branch getDisplayMedia onto a floating host", () => {
    const capture = readFileSync(join(ROOT, "lib/screen-capture.ts"), "utf8");
    expect(capture).not.toContain('source === "pip"');
    expect(capture).not.toContain("adoptScreenCaptureStreamOnOpener");
    expect(capture).not.toContain("screenCaptureShouldStopOnHostClose");
    expect(capture).not.toContain('host ?? "pip"');
    expect(capture).not.toContain("documentPictureInPicture");
    expect(capture).toContain("getDisplayMedia");
    expect(capture).toContain('source: "opener"');
    const hidden = resolveScreenCaptureMediaDevices({
      document: { visibilityState: "hidden" },
      navigator: { mediaDevices: { getDisplayMedia: gdm() } },
    });
    expect(hidden.source).not.toBe("pip");
    expect(hidden.source).toBe("opener");
  });
});

describe("screen capture start failures (shipped)", () => {
  it("InvalidStateError and user-deny are quiet; other errors are not", () => {
    const invalid = new DOMException("Invalid state", "InvalidStateError");
    expect(isScreenCaptureInvalidState(invalid)).toBe(true);
    expect(isScreenCaptureStartQuietFailure(invalid)).toBe(true);
    expect(isScreenCaptureUserDenied(invalid)).toBe(false);

    const denied = new DOMException("Permission denied by user", "NotAllowedError");
    expect(isScreenCaptureUserDenied(denied)).toBe(true);
    expect(isScreenCaptureStartQuietFailure(denied)).toBe(true);
    expect(isScreenCaptureInvalidState(denied)).toBe(false);

    expect(isScreenCaptureStartQuietFailure(new Error("device missing"))).toBe(false);
  });
});
