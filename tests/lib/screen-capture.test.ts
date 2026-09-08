/**
 * getDisplayMedia must run on a visible document. Mini-mode PiP is that document.
 */
import { describe, expect, it } from "vitest";
import {
  adoptScreenCaptureStreamOnOpener,
  isScreenCaptureInvalidState,
  isScreenCaptureStartQuietFailure,
  isScreenCaptureUserDenied,
  resolveScreenCaptureMediaDevices,
  screenCaptureShouldStopOnHostClose,
} from "@/lib/screen-capture";

function gdm() {
  return async () => new MediaStream();
}

describe("resolveScreenCaptureMediaDevices (shipped)", () => {
  it("uses the visible Document PiP window when the opener tab is hidden", () => {
    const pipGdm = gdm();
    const openerGdm = gdm();
    const resolved = resolveScreenCaptureMediaDevices({
      document: { visibilityState: "hidden" },
      navigator: { mediaDevices: { getDisplayMedia: openerGdm } },
      documentPictureInPicture: {
        window: {
          closed: false,
          document: { visibilityState: "visible" },
          navigator: { mediaDevices: { getDisplayMedia: pipGdm } },
        },
      },
    });
    expect(resolved.source).toBe("pip");
    expect(resolved.mediaDevices?.getDisplayMedia).toBe(pipGdm);
    expect(resolved.mediaDevices?.getDisplayMedia).not.toBe(openerGdm);
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

describe("screen capture stream lifetime vs PiP host (shipped)", () => {
  it("opener-held stream does not stop when the PiP host closes", () => {
    const original = {
      clone() {
        return { id: "opener-clone", getTracks: () => [] } as unknown as MediaStream;
      },
      getTracks() {
        return [];
      },
    } as unknown as MediaStream;
    const adopted = adoptScreenCaptureStreamOnOpener(original);
    expect(adopted).not.toBe(original);

    expect(
      screenCaptureShouldStopOnHostClose({
        streamOwner: "opener",
        hostClosed: true,
        host: "pip",
      }),
    ).toBe(false);
    expect(
      screenCaptureShouldStopOnHostClose({
        streamOwner: "pip",
        hostClosed: true,
        host: "pip",
      }),
    ).toBe(true);
    expect(
      screenCaptureShouldStopOnHostClose({
        streamOwner: "opener",
        hostClosed: false,
      }),
    ).toBe(false);
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
