/**
 * Leave-tab no longer opens a first-ask picture-in-picture window.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decideIleMiniAutoOpen } from "@/lib/ile-blur-screenshare";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("ILE mini first-ask is gone", () => {
  it("does not open a floating window on leave, blur, or an external tool", () => {
    for (const leaveReason of ["tab_hidden", "tab_blur", "grok", "grokipedia"] as const) {
      expect(
        decideIleMiniAutoOpen({
          sessionActive: true,
          tabFocused: false,
          leaveReason,
          documentPipSupported: true,
        }),
      ).toBe("hide");
    }
    const tools = read("components/ToolsPanel.tsx");
    const hook = read("lib/useIleBlurScreenshare.tsx");
    const view = read("components/SessionView.tsx");
    expect(tools).not.toContain("data-ile-open-pic-in-pic");
    expect(tools).not.toContain("ILE_OPEN_PIC_IN_PIC_LABEL");
    expect(hook).not.toContain("openIleDocumentPictureInPictureWindow");
    expect(hook).not.toContain("openManualPicInPic");
    expect(view).not.toContain("onOpenPicInPic");
  });
});
