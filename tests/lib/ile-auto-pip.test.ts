/**
 * ILE picture-in-picture is gone. Leave-tab does not open a floating window.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyIleLeaveFocusPolicy,
  decideIleCompactWindow,
  decideIleMiniAutoOpen,
} from "@/lib/ile-blur-screenshare";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-9dd558f97ff3/implementer";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("ILE picture-in-picture is removed", () => {
  it("leave-tab never asks for a floating window", () => {
    const away = {
      sessionActive: true,
      tabFocused: false,
      leaveReason: "tab_hidden" as const,
      documentPipSupported: true,
    };
    expect(decideIleMiniAutoOpen(away)).toBe("hide");
    expect(
      decideIleCompactWindow({
        isIleSession: true,
        sessionActive: true,
        tabFocused: false,
        isScreenSharing: false,
        leaveReason: "tab_blur",
      }),
    ).toBe("hide");
    expect(
      applyIleLeaveFocusPolicy({
        isIleSession: true,
        sessionActive: true,
        tabFocused: false,
        isScreenSharing: false,
        leaveReason: "tab_hidden",
      }).compactWindow,
    ).toBe("hide");

    const view = read("components/SessionView.tsx");
    const tools = read("components/ToolsPanel.tsx");
    const voice = read("components/session-view/ile-voice-bar.tsx");
    const hook = read("lib/useIleBlurScreenshare.tsx");
    const compact = read("lib/ile-compact-window.ts");
    const capture = read("lib/screen-capture.ts");
    const policy = read("lib/ile-blur-screenshare.ts");
    const frame = read("components/session-view/ile-chapter-widget-frame.tsx");

    expect(existsSync(join(ROOT, "lib/ile-auto-pip.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "components/IleCompactStashWindow.tsx"))).toBe(false);
    expect(view).not.toContain('renderWorkCanvas("pip")');
    expect(view).not.toContain("openManualPicInPic");
    expect(view).not.toContain("showOpenPicInPic");
    expect(view).not.toContain("documentPictureInPicture");
    expect(view).not.toContain("requestWindow");
    expect(tools).not.toContain("data-ile-open-pic-in-pic");
    expect(tools).not.toContain("open pic-in-pic");
    expect(tools).not.toContain(">PiP<");
    expect(voice).not.toContain("onOpenPicInPic");
    expect(hook).not.toContain("requestWindow");
    expect(hook).not.toContain("documentPictureInPicture");
    expect(hook).not.toContain("window.open");
    expect(hook).not.toContain("IleCompactStashWindow");
    expect(hook).not.toContain("openIleDocumentPictureInPictureWindow");
    expect(compact).not.toContain("requestWindow");
    expect(compact).not.toContain("documentPictureInPicture");
    expect(compact).not.toContain("window.open");
    expect(policy).not.toContain("openIleCompactPopupWindow");
    expect(policy).not.toContain("openIleAlwaysOnTopWindow");
    expect(policy).not.toContain("requestWindow");
    expect(policy).not.toContain("openIleExternalLeaveTab");
    expect(policy).not.toContain("window.open");
    expect(policy).not.toContain("grokipedia.com");
    expect(capture).not.toContain("documentPictureInPicture");
    expect(capture).not.toContain('source === "pip"');
    expect(capture).not.toContain("adoptScreenCaptureStreamOnOpener");
    expect(capture).toContain("getDisplayMedia");
    expect(frame).not.toContain("IleChapterPipFrame");

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "ile-pip-removed.log"),
      [
        `mini_auto=${decideIleMiniAutoOpen(away)}`,
        "compact_window=hide",
        "pip_button=absent",
        "requestWindow=absent",
        "documentPictureInPicture=absent",
        "popup_opener=absent",
        "pip_canvas_clone=absent",
        "pip_host_capture=absent",
        "external_leave=absent",
        "screen_capture_stays=getDisplayMedia",
      ].join("\n") + "\n",
    );
  });
});
