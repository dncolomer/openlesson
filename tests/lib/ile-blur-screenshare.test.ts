/**
 * Leave-tab and screenshare decisions do not open a floating ILE window.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyIleLeaveFocusPolicy,
  decideIleCompactWindow,
  decideIleLeaveFocusScreenshare,
  decideIleMiniAutoOpen,
} from "@/lib/ile-blur-screenshare";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const away = {
  isIleSession: true,
  sessionActive: true,
  tabFocused: false,
  isScreenSharing: false,
  leaveReason: "tab_hidden" as const,
};

describe("ILE leave-tab does not open a window", () => {
  it("screenshare stays a skip and the compact window stays hidden", () => {
    expect(decideIleLeaveFocusScreenshare(away)).toBe("skip");
    expect(decideIleCompactWindow(away)).toBe("hide");
    expect(decideIleMiniAutoOpen({
      sessionActive: true,
      tabFocused: false,
      leaveReason: "tab_hidden",
      documentPipSupported: true,
    })).toBe("hide");
    const policy = applyIleLeaveFocusPolicy(away);
    expect(policy.screenshare).toBe("skip");
    expect(policy.compactWindow).toBe("hide");

    const hook = read("lib/useIleBlurScreenshare.tsx");
    const policySource = read("lib/ile-blur-screenshare.ts");
    const capture = read("lib/screen-capture.ts");
    expect(hook).not.toContain("openIleCompactPopupWindow");
    expect(hook).not.toContain("openIleAlwaysOnTopWindow");
    expect(hook).not.toContain("IleCompactStashWindow");
    expect(hook).not.toContain("window.open");
    expect(policySource).not.toContain("openIleCompactPopupWindow");
    expect(policySource).not.toContain("openIleAlwaysOnTopWindow");
    expect(policySource).not.toContain("requestWindow");
    expect(policySource).not.toContain("openIleExternalLeaveTab");
    expect(policySource).not.toContain("window.open");
    expect(policySource).not.toContain("grokipedia.com");
    expect(capture).not.toContain("documentPictureInPicture");
    expect(capture).not.toContain('source === "pip"');
    expect(capture).toContain("resolveScreenCaptureMediaDevices");
  });
});
